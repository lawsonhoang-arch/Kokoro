import "server-only";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { db } from "@/db";
import { titles, watchlists, watchlistEntries } from "@/db/schema";
import { ratedByUser, getTasteAffinityBulk } from "@/lib/affinity";
import { entryScore } from "@/lib/profile";
import { getTopInGenres } from "@/lib/search-index";
import { hiResCover } from "@/lib/cover";
import type { SearchResult } from "@/features/search/types";

export type RecTitle = SearchResult & { raters: number; matchTop: number; reason: string };
export type ForYou = {
  mode: "matched" | "blindspots" | "none";
  heading: string;
  sub: string;
  neighbors: number;
  recs: RecTitle[];
};

const DAY = 86400;
const MIN_RATED = 5; // need enough signal to recommend
const GOOD_MATCH = 60; // an affinity worth trusting

type TitleRow = {
  id: string; kind: string; title: string; english: string | null; native: string | null;
  format: string | null; episodes: number; year: number; genres: string[]; cover: string | null; status: string | null; nsfw: boolean;
};
function titleToResult(t: TitleRow): SearchResult {
  return {
    id: t.id,
    kind: t.kind === "manga" ? "manga" : "anime",
    title: t.english || t.title,
    native: t.native,
    format: t.format,
    episodes: t.episodes || null,
    year: t.year || null,
    genres: t.genres ?? [],
    cover: hiResCover(t.cover),
    status: t.status,
  };
}
const titleCols = {
  id: titles.id, kind: titles.kind, title: titles.title, english: titles.englishTitle, native: titles.nativeTitle,
  format: titles.format, episodes: titles.episodes, year: titles.year, genres: titles.genres, cover: titles.cover, status: titles.status, nsfw: titles.nsfw,
} as const;

// ============================================================
// COLLABORATIVE — titles loved by users whose taste matches yours
// ============================================================
async function computeMatched(userId: string, limit: number): Promise<{ recs: RecTitle[]; neighbors: number }> {
  try {
    const mine = await ratedByUser(userId);
    if (mine.size < MIN_RATED) return { recs: [], neighbors: 0 };
    const myIds = [...mine.keys()];

    // candidate neighbours — users who've rated ≥3 of the same titles
    const cand = await db
      .select({ uid: watchlists.userId })
      .from(watchlistEntries)
      .innerJoin(watchlists, eq(watchlists.id, watchlistEntries.watchlistId))
      .where(and(inArray(watchlistEntries.titleId, myIds), ne(watchlists.userId, userId)))
      .groupBy(watchlists.userId)
      .having(sql`count(*) >= 3`)
      .orderBy(desc(sql`count(*)`))
      .limit(40);
    const candIds = cand.map((c) => c.uid);
    if (candIds.length === 0) return { recs: [], neighbors: 0 };

    // keep only well-matched neighbours
    const aff = await getTasteAffinityBulk(userId, candIds);
    const affScore = new Map<string, number>();
    for (const [uid, m] of aff) if (m.score != null && m.score >= GOOD_MATCH && m.shared >= 3) affScore.set(uid, m.score);
    if (affScore.size === 0) return { recs: [], neighbors: 0 };
    const neighborIds = [...affScore.keys()];

    // their highly-rated titles you haven't rated
    const rows = await db
      .select({ uid: watchlists.userId, titleId: watchlistEntries.titleId, feeling: watchlistEntries.feeling, rateMode: watchlistEntries.rateMode, symbol: watchlistEntries.symbol, dims: watchlistEntries.dims })
      .from(watchlistEntries)
      .innerJoin(watchlists, eq(watchlists.id, watchlistEntries.watchlistId))
      .where(inArray(watchlists.userId, neighborIds));

    const acc = new Map<string, { score: number; raters: number; top: number }>();
    const seen = new Set<string>();
    for (const r of rows) {
      if (mine.has(r.titleId)) continue;
      const key = r.uid + ":" + r.titleId;
      if (seen.has(key)) continue;
      seen.add(key);
      const s = entryScore({ rateMode: r.rateMode, feeling: r.feeling, symbol: r.symbol, dims: r.dims });
      if (s == null || s < 4) continue; // they liked/loved it
      const a = affScore.get(r.uid) ?? 0;
      const cur = acc.get(r.titleId) ?? { score: 0, raters: 0, top: 0 };
      cur.score += (a / 100) * (s / 5);
      cur.raters += 1;
      cur.top = Math.max(cur.top, a);
      acc.set(r.titleId, cur);
    }
    const ranked = [...acc.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, limit * 2);
    if (ranked.length === 0) return { recs: [], neighbors: affScore.size };

    const rowsById = new Map((await db.select(titleCols).from(titles).where(inArray(titles.id, ranked.map(([id]) => id)))).map((t) => [t.id, t]));
    const recs: RecTitle[] = [];
    for (const [id, m] of ranked) {
      const t = rowsById.get(id);
      if (!t || t.nsfw || !t.cover) continue;
      recs.push({
        ...titleToResult(t),
        raters: m.raters,
        matchTop: Math.round(m.top),
        reason: `♥ ${m.raters} ${m.raters === 1 ? "match" : "matches"} loved this`,
      });
      if (recs.length >= limit) break;
    }
    return { recs, neighbors: affScore.size };
  } catch {
    return { recs: [], neighbors: 0 };
  }
}

const getMatched = (userId: string, limit: number) =>
  unstable_cache(() => computeMatched(userId, limit), ["taste-recs", userId, String(limit)], { revalidate: DAY })();

// ============================================================
// CONTENT-BASED — acclaimed titles in your favourite genres, unseen
// ============================================================
async function computeBlindSpots(userId: string, limit: number): Promise<RecTitle[]> {
  try {
    const mine = await ratedByUser(userId);
    if (mine.size === 0) return [];
    // everything you've already engaged with (don't recommend it back)
    const seenRows = await db.execute(sql`
      select we.title_id as id from watchlist_entries we join watchlists w on w.id = we.watchlist_id where w.user_id = ${userId}
      union select title_id from completions where user_id = ${userId}`);
    const seen = new Set((seenRows as unknown as { id: string }[]).map((r) => r.id));

    // favourite genres = most common across the titles you loved
    const lovedIds = [...mine.entries()].filter(([, v]) => v.score >= 4).map(([id]) => id).slice(0, 300);
    if (lovedIds.length === 0) return [];
    const gRows = await db.select({ genres: titles.genres }).from(titles).where(inArray(titles.id, lovedIds));
    const tally = new Map<string, number>();
    for (const r of gRows) for (const g of r.genres ?? []) tally.set(g, (tally.get(g) ?? 0) + 1);
    const favGenres = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g);
    if (favGenres.length === 0) return [];

    const top = await getTopInGenres(favGenres, seen, limit);
    return top.map((t) => ({ ...t, raters: 0, matchTop: 0, reason: `Acclaimed ${t.genres.find((g) => favGenres.includes(g)) ?? favGenres[0]}` }));
  } catch {
    return [];
  }
}

const getBlindSpots = (userId: string, limit: number) =>
  unstable_cache(() => computeBlindSpots(userId, limit), ["blind-spots", userId, String(limit)], { revalidate: DAY })();

// ============================================================
// The Home "For you" section: matched recs if we can, else blind spots.
// ============================================================
export async function getForYou(userId: string, limit = 14): Promise<ForYou> {
  const matched = await getMatched(userId, limit);
  if (matched.recs.length >= 4) {
    return {
      mode: "matched",
      heading: "Because your taste matches theirs",
      sub: `Loved by ${matched.neighbors} ${matched.neighbors === 1 ? "person" : "people"} who rate like you`,
      neighbors: matched.neighbors,
      recs: matched.recs,
    };
  }
  const blind = await getBlindSpots(userId, limit);
  if (blind.length >= 4) {
    return { mode: "blindspots", heading: "Blind spots", sub: "Acclaimed titles in your favourite genres you haven't touched", neighbors: 0, recs: blind };
  }
  return { mode: "none", heading: "", sub: "", neighbors: 0, recs: [] };
}
