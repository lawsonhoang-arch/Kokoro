import "server-only";
import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { eventBanners } from "@/db/schema";

export type EventBanner = typeof eventBanners.$inferSelect;

export type BannerInput = {
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string | null;
  image: string | null;
  accent: string | null;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

const ORDER = [desc(eventBanners.position), desc(eventBanners.updatedAt)] as const;

// render priority: a hand-picked manual banner beats the auto featured premiere,
// which beats the ambient new-season banner.
const SOURCE_RANK = sql`case ${eventBanners.source}
  when 'manual' then 3 when 'auto-premiere' then 2 when 'auto-season' then 1 else 0 end`;

/** The one banner to show on Home: active + within its schedule, top priority. */
export async function getActiveBanner(): Promise<EventBanner | null> {
  const now = new Date();
  const [row] = await db
    .select()
    .from(eventBanners)
    .where(
      and(
        eq(eventBanners.active, true),
        or(isNull(eventBanners.startsAt), lte(eventBanners.startsAt, now)),
        or(isNull(eventBanners.endsAt), gte(eventBanners.endsAt, now)),
      ),
    )
    .orderBy(desc(SOURCE_RANK), desc(eventBanners.position), desc(eventBanners.updatedAt))
    .limit(1);
  return row ?? null;
}

/** Every banner for the editor. */
export async function getAllBanners(): Promise<EventBanner[]> {
  return db.select().from(eventBanners).orderBy(...ORDER);
}

export async function createBanner(authorId: string, input: BannerInput): Promise<void> {
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${eventBanners.position}), -1) + 1` })
    .from(eventBanners);
  await db.insert(eventBanners).values({ ...input, authorId, position: Number(next) });
}

export async function updateBanner(id: string, input: BannerInput): Promise<void> {
  await db
    .update(eventBanners)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(eventBanners.id, id));
}

export async function deleteBanner(id: string): Promise<void> {
  await db.delete(eventBanners).where(eq(eventBanners.id, id));
}

export async function setBannerActive(id: string, active: boolean): Promise<void> {
  await db
    .update(eventBanners)
    .set({ active, updatedAt: new Date() })
    .where(eq(eventBanners.id, id));
}

/** Swap a banner with its neighbour to reorder (top of list = highest priority). */
export async function moveBanner(id: string, dir: "up" | "down"): Promise<void> {
  const all = await db.select().from(eventBanners).orderBy(...ORDER);
  const i = all.findIndex((b) => b.id === id);
  if (i < 0) return;
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= all.length) return;
  // higher list position should get a higher `position` value (desc order)
  const hi = all.length;
  await db.update(eventBanners).set({ position: hi - j }).where(eq(eventBanners.id, all[i].id));
  await db.update(eventBanners).set({ position: hi - i }).where(eq(eventBanners.id, all[j].id));
}
