import "server-only";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { completions, titles } from "@/db/schema";
import { hiResCover } from "@/lib/cover";

export type Completion = {
  titleId: string;
  title: string;
  cover: string | null;
  episodes: number;
  kind: string;
  createdAt: string;
};

export async function isCompleted(userId: string, titleId: string): Promise<boolean> {
  const r = await db
    .select({ titleId: completions.titleId })
    .from(completions)
    .where(and(eq(completions.userId, userId), eq(completions.titleId, titleId)))
    .limit(1);
  return r.length > 0;
}

/** Toggle a standalone "watched" mark for a title. Returns the new state. */
export async function toggleCompletion(userId: string, titleId: string): Promise<{ completed: boolean }> {
  if (await isCompleted(userId, titleId)) {
    await db.delete(completions).where(and(eq(completions.userId, userId), eq(completions.titleId, titleId)));
    return { completed: false };
  }
  await db.insert(completions).values({ userId, titleId }).onConflictDoNothing();
  return { completed: true };
}

/** All of a user's standalone completions, with title info (newest first). */
export async function getCompletions(userId: string): Promise<Completion[]> {
  const rows = await db
    .select({
      titleId: titles.id,
      title: titles.title,
      english: titles.englishTitle,
      cover: titles.cover,
      episodes: titles.episodes,
      kind: titles.kind,
      createdAt: completions.createdAt,
    })
    .from(completions)
    .innerJoin(titles, eq(completions.titleId, titles.id))
    .where(eq(completions.userId, userId))
    .orderBy(desc(completions.createdAt));
  return rows.map((r) => ({
    titleId: r.titleId,
    title: r.english || r.title,
    cover: hiResCover(r.cover),
    episodes: r.episodes,
    kind: r.kind,
    createdAt: r.createdAt.toISOString(),
  }));
}
