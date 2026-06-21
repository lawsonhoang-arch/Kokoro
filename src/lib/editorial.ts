import "server-only";
import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { editorialPicks } from "@/db/schema";

export type EditorialPick = typeof editorialPicks.$inferSelect;

export type PickInput = {
  kicker: string;
  title: string;
  excerpt: string;
  hue: number;
  avatarHue: number;
  byline: string;
  href: string | null;
  cover: string | null;
  published: boolean;
};

const ORDER = [asc(editorialPicks.position), asc(editorialPicks.createdAt)] as const;

/** Published picks for the Home page, in display order. */
export async function getPublishedPicks(): Promise<EditorialPick[]> {
  return db.select().from(editorialPicks).where(eq(editorialPicks.published, true)).orderBy(...ORDER);
}

/** Every pick (published or not) for the editor. */
export async function getAllPicks(): Promise<EditorialPick[]> {
  return db.select().from(editorialPicks).orderBy(...ORDER);
}

export async function createPick(authorId: string, input: PickInput): Promise<void> {
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${editorialPicks.position}), -1) + 1` })
    .from(editorialPicks);
  await db.insert(editorialPicks).values({ ...input, authorId, position: Number(next) });
}

export async function updatePick(id: string, input: PickInput): Promise<void> {
  await db
    .update(editorialPicks)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(editorialPicks.id, id));
}

export async function deletePick(id: string): Promise<void> {
  await db.delete(editorialPicks).where(eq(editorialPicks.id, id));
}

export async function setPublished(id: string, published: boolean): Promise<void> {
  await db
    .update(editorialPicks)
    .set({ published, updatedAt: new Date() })
    .where(eq(editorialPicks.id, id));
}

/** Swap a pick with its neighbour in the given direction to reorder. */
export async function movePick(id: string, dir: "up" | "down"): Promise<void> {
  const all = await getAllPicks();
  const i = all.findIndex((p) => p.id === id);
  if (i < 0) return;
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= all.length) return;
  const a = all[i];
  const b = all[j];
  // swap their positions (use index as the canonical order to avoid ties)
  await db.update(editorialPicks).set({ position: j }).where(eq(editorialPicks.id, a.id));
  await db.update(editorialPicks).set({ position: i }).where(eq(editorialPicks.id, b.id));
}
