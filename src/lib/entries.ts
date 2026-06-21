import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { watchlists, watchlistEntries, titles } from "@/db/schema";
import type { Entry, Feeling, Status, Dims, RateMode, SymbolRating } from "@/features/watchlist/types";
import { hiResCover } from "@/lib/cover";

type JoinedRow = {
  entryId: string;
  titleId: string;
  status: string;
  feeling: string | null;
  rateMode: string | null;
  symbol: unknown;
  progress: number | null;
  watchedEps: number[] | null;
  watchedAt: string | null;
  take: string;
  dims: unknown;
  title: string;
  english: string | null;
  year: number;
  genres: string[];
  episodes: number;
  seasons: number;
  cover: string | null;
};

function toEntry(r: JoinedRow): Entry {
  return {
    id: r.entryId,
    titleId: r.titleId,
    cover: hiResCover(r.cover),
    title: r.english || r.title,
    year: r.year,
    genres: r.genres,
    episodes: r.episodes,
    seasons: r.seasons,
    status: r.status as Status,
    feeling: (r.feeling as Feeling | null) ?? null,
    rateMode: (r.rateMode as RateMode | null) ?? "glyphs",
    symbol: (r.symbol as SymbolRating | null) ?? null,
    watched: r.watchedAt,
    dims: (r.dims as Dims) ?? { story: 0, art: 0, music: 0, pacing: 0 },
    take: r.take,
    air: { day: "—", time: "" },
    progress: r.progress ?? undefined,
    watchedEps: r.watchedEps ?? [],
  };
}

const ENTRY_COLS = {
  entryId: watchlistEntries.id,
  titleId: watchlistEntries.titleId,
  status: watchlistEntries.status,
  feeling: watchlistEntries.feeling,
  rateMode: watchlistEntries.rateMode,
  symbol: watchlistEntries.symbol,
  progress: watchlistEntries.progress,
  watchedEps: watchlistEntries.watchedEps,
  watchedAt: watchlistEntries.watchedAt,
  take: watchlistEntries.take,
  dims: watchlistEntries.dims,
  title: titles.title,
  english: titles.englishTitle,
  year: titles.year,
  genres: titles.genres,
  episodes: titles.episodes,
  seasons: titles.seasons,
  cover: titles.cover,
};

/** All entries in a watchlist the user owns, mapped to the app's Entry shape. */
export async function getWatchlistEntries(userId: string, watchlistId: string): Promise<Entry[]> {
  const rows = await db
    .select(ENTRY_COLS)
    .from(watchlistEntries)
    .innerJoin(titles, eq(watchlistEntries.titleId, titles.id))
    .innerJoin(watchlists, eq(watchlistEntries.watchlistId, watchlists.id))
    .where(and(eq(watchlistEntries.watchlistId, watchlistId), eq(watchlists.userId, userId)))
    .orderBy(asc(watchlistEntries.position));
  return rows.map((r) => toEntry(r as JoinedRow));
}

async function ownsWatchlist(userId: string, watchlistId: string): Promise<boolean> {
  const r = await db
    .select({ id: watchlists.id })
    .from(watchlists)
    .where(and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId)))
    .limit(1);
  return r.length > 0;
}

export type AddResult =
  | { ok: true; entry: Entry }
  | { ok: false; reason: "duplicate" | "forbidden" | "notfound" };

/** Add a catalog title (by id) to a watchlist. The title already exists in the
 *  self-hosted catalog, so this just creates the entry — no external lookup. */
export async function addEntry(
  userId: string,
  watchlistId: string,
  titleId: string,
): Promise<AddResult> {
  if (!(await ownsWatchlist(userId, watchlistId))) return { ok: false, reason: "forbidden" };

  const [t] = await db
    .select({
      title: titles.title,
      english: titles.englishTitle,
      year: titles.year,
      genres: titles.genres,
      episodes: titles.episodes,
      seasons: titles.seasons,
      cover: titles.cover,
    })
    .from(titles)
    .where(eq(titles.id, titleId))
    .limit(1);
  if (!t) return { ok: false, reason: "notfound" };

  const dup = await db
    .select({ id: watchlistEntries.id })
    .from(watchlistEntries)
    .where(and(eq(watchlistEntries.watchlistId, watchlistId), eq(watchlistEntries.titleId, titleId)))
    .limit(1);
  if (dup.length) return { ok: false, reason: "duplicate" };

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${watchlistEntries.position}), -1) + 1` })
    .from(watchlistEntries)
    .where(eq(watchlistEntries.watchlistId, watchlistId));

  const [row] = await db
    .insert(watchlistEntries)
    .values({ watchlistId, titleId, status: "planned", position: Number(next) })
    .returning({ id: watchlistEntries.id });

  await db.update(watchlists).set({ lastEditedAt: new Date() }).where(eq(watchlists.id, watchlistId));

  const entry: Entry = {
    id: row.id,
    titleId,
    cover: hiResCover(t.cover),
    title: t.english || t.title,
    year: t.year,
    genres: t.genres,
    episodes: t.episodes,
    seasons: t.seasons,
    status: "planned",
    feeling: null,
    rateMode: "glyphs",
    symbol: null,
    watched: null,
    dims: { story: 0, art: 0, music: 0, pacing: 0 },
    take: "",
    air: { day: "—", time: "" },
    watchedEps: [],
  };
  return { ok: true, entry };
}

export type EntryPatch = {
  status?: Status;
  feeling?: Feeling | null;
  rateMode?: RateMode;
  symbol?: SymbolRating | null;
  progress?: number | null;
  watchedEps?: number[];
  take?: string;
  dims?: Record<string, number>;
};

/** Verify the entry belongs to a watchlist the user owns, then update it. */
export async function updateEntry(userId: string, entryId: string, patch: EntryPatch): Promise<void> {
  const owned = await db
    .select({ id: watchlistEntries.id })
    .from(watchlistEntries)
    .innerJoin(watchlists, eq(watchlistEntries.watchlistId, watchlists.id))
    .where(and(eq(watchlistEntries.id, entryId), eq(watchlists.userId, userId)))
    .limit(1);
  if (!owned.length) return;
  await db.update(watchlistEntries).set(patch).where(eq(watchlistEntries.id, entryId));
}

/** Persist a manual order for a watchlist's entries (position = index in the
 *  given list). Scoped to the user's own list; ids not in it are ignored. */
export async function reorderEntries(
  userId: string,
  watchlistId: string,
  orderedIds: string[],
): Promise<void> {
  if (!orderedIds.length) return;
  if (!(await ownsWatchlist(userId, watchlistId))) return;
  // bind the ordered ids as one jsonb array param. (Interpolating a JS array
  // into Drizzle's sql`` spreads it into a tuple, which can't be cast to a
  // Postgres array — so we pass JSON text and unwrap it server-side.)
  await db.execute(sql`
    update watchlist_entries as w
    set position = (t.ord - 1)::int
    from (
      select value as id, ordinality as ord
      from jsonb_array_elements_text(${JSON.stringify(orderedIds)}::jsonb) with ordinality
    ) as t
    where w.id = t.id::uuid and w.watchlist_id = ${watchlistId}::uuid
  `);
}

export async function removeEntry(userId: string, entryId: string): Promise<void> {
  const owned = await db
    .select({ id: watchlistEntries.id, watchlistId: watchlistEntries.watchlistId })
    .from(watchlistEntries)
    .innerJoin(watchlists, eq(watchlistEntries.watchlistId, watchlists.id))
    .where(and(eq(watchlistEntries.id, entryId), eq(watchlists.userId, userId)))
    .limit(1);
  if (!owned.length) return;
  await db.delete(watchlistEntries).where(eq(watchlistEntries.id, entryId));
}
