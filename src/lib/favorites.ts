import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { favorites, titles, watchlists, watchlistEntries } from "@/db/schema";
import { hiResCover } from "@/lib/cover";
import type { ProfileTitle } from "@/lib/profile";
import { entryScore } from "@/lib/profile";

export const MAX_FAVORITES = 10;

export async function isFavorite(userId: string, titleId: string): Promise<boolean> {
  const r = await db
    .select({ titleId: favorites.titleId })
    .from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.titleId, titleId)))
    .limit(1);
  return r.length > 0;
}

/** Toggle a title's favorite status. `atLimit` is true when an add was blocked
 *  because the user already has MAX_FAVORITES. */
export async function toggleFavorite(
  userId: string,
  titleId: string,
): Promise<{ favorite: boolean; atLimit: boolean }> {
  if (await isFavorite(userId, titleId)) {
    await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.titleId, titleId)));
    return { favorite: false, atLimit: false };
  }
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(favorites)
    .where(eq(favorites.userId, userId));
  if (Number(n) >= MAX_FAVORITES) return { favorite: false, atLimit: true };
  await db.insert(favorites).values({ userId, titleId }).onConflictDoNothing();
  return { favorite: true, atLimit: false };
}

/** The user's hand-picked favorites (newest first), with their rating if any. */
export async function getFavorites(userId: string): Promise<ProfileTitle[]> {
  const rows = await db
    .select({
      id: titles.id,
      title: titles.title,
      english: titles.englishTitle,
      cover: titles.cover,
      year: titles.year,
      genres: titles.genres,
      episodes: titles.episodes,
      createdAt: favorites.createdAt,
      // the user's rating for this title, if it's in any of their lists
      status: watchlistEntries.status,
      progress: watchlistEntries.progress,
      feeling: watchlistEntries.feeling,
      rateMode: watchlistEntries.rateMode,
      symbol: watchlistEntries.symbol,
      dims: watchlistEntries.dims,
    })
    .from(favorites)
    .innerJoin(titles, eq(favorites.titleId, titles.id))
    .leftJoin(watchlists, eq(watchlists.userId, favorites.userId))
    .leftJoin(
      watchlistEntries,
      and(eq(watchlistEntries.watchlistId, watchlists.id), eq(watchlistEntries.titleId, favorites.titleId)),
    )
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt));

  // a title can join multiple lists — keep the first (highest-rated) row per title
  const byId = new Map<string, ProfileTitle>();
  for (const r of rows) {
    const score = entryScore({ rateMode: r.rateMode, feeling: r.feeling, symbol: r.symbol, dims: r.dims });
    const prev = byId.get(r.id);
    if (prev && (prev.score ?? -1) >= (score ?? -1)) continue;
    byId.set(r.id, {
      id: r.id,
      title: r.english || r.title,
      cover: hiResCover(r.cover),
      year: r.year,
      genres: r.genres ?? [],
      episodes: r.episodes,
      status: r.status ?? "",
      progress: r.progress,
      score,
    });
  }
  return [...byId.values()];
}
