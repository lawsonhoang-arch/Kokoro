import "server-only";
import { sql } from "drizzle-orm";

import { getDbDirect } from "@/db";
import { hiResCover } from "@/lib/cover";
import type { SearchResult } from "@/features/search/types";
import type { CatalogFilters } from "@/features/search/constants";

// ============================================================
// In-memory catalog search.
//
// Querying Supabase (us-west-2) per keystroke costs ~600ms network + ~1s for
// the trigram query. Instead we load the whole catalog into the server's
// memory once (~10MB for ~42k rows) and search it in RAM — a few milliseconds,
// no network. The index is refreshed in the background on a TTL so it stays in
// sync with imports / new covers.
// ============================================================

export type IndexRow = {
  id: string;
  kind: "anime" | "manga";
  title: string;
  native: string | null;
  year: number;
  episodes: number;
  seasons: number;
  format: string | null;
  genres: string[];
  cover: string | null;
  score: number | null;
  popularity: number | null;
  season: string | null; // winter | spring | summer | fall
  status: string | null; // finished | ongoing | upcoming
  nsfw: boolean; // adult/explicit — excluded from Home
  lc: string; // lowercased title (for ranking)
  hay: string; // lowercased title + synonyms (search_text)
};

let cache: IndexRow[] | null = null;
let loadedAt = 0;
let loading: Promise<IndexRow[]> | null = null;
const TTL = 3 * 60 * 1000; // refresh at most every 3 minutes

type Raw = {
  id: string; kind: string; title: string; english_title: string | null; native: string | null;
  year: number | null; episodes: number | null; seasons: number | null;
  format: string | null; genres: string[] | null; cover: string | null;
  score: number | null; popularity: number | null; season: string | null; status: string | null;
  nsfw: boolean | null; search_text: string | null;
};

async function load(): Promise<IndexRow[]> {
  // Runs on the DIRECT connection (session pooler / direct), never the
  // transaction pooler — this one big streaming query would be cancelled there.
  const res = await getDbDirect().execute(sql`
    select id, kind, title, english_title, native_title as native, year, episodes, seasons,
           format, genres, cover, score, popularity, season, status, nsfw, search_text
    from titles where search_text is not null
  `);
  const rows = res as unknown as Raw[];
  return rows.map((r) => {
    // prefer the English title for display; keep romaji searchable
    const display = r.english_title || r.title;
    return {
      id: r.id,
      kind: r.kind === "manga" ? "manga" : "anime",
      title: display,
      native: r.native,
      year: r.year ?? 0,
      episodes: r.episodes ?? 0,
      seasons: r.seasons ?? 1,
      format: r.format,
      genres: r.genres ?? [],
      cover: hiResCover(r.cover),
      score: r.score,
      popularity: r.popularity,
      season: r.season,
      status: r.status,
      nsfw: r.nsfw === true,
      lc: display.toLowerCase(),
      hay: ((r.search_text ?? "") + " " + (r.english_title ?? "")).toLowerCase(),
    };
  });
}

/** The in-memory catalog. Serves a slightly stale copy while refreshing. */
export async function getIndex(): Promise<IndexRow[]> {
  const fresh = cache && Date.now() - loadedAt < TTL;
  if (fresh) return cache!;
  if (!loading) {
    loading = load()
      .then((rows) => { cache = rows; loadedAt = Date.now(); loading = null; return rows; })
      .catch((e) => { loading = null; throw e; });
  }
  // stale-while-revalidate: return the old copy immediately if we have one
  return cache ?? loading;
}

export function toResult(r: IndexRow): SearchResult {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    native: r.native,
    format: r.format,
    episodes: r.episodes > 0 ? r.episodes : null,
    year: r.year > 0 ? r.year : null,
    genres: r.genres,
    cover: r.cover,
  };
}

// relevance score for a query (higher = better); -1 means "no match"
function relevance(r: IndexRow, q: string): number {
  const lc = r.lc;
  if (lc === q) return 1_000_000;
  if (lc.startsWith(q)) return 900_000 - lc.length;
  const i = lc.indexOf(q);
  if (i >= 0) {
    const wordStart = i === 0 || lc[i - 1] === " " || lc[i - 1] === ":" || lc[i - 1] === "-";
    return (wordStart ? 800_000 : 700_000) - i * 40 - lc.length;
  }
  const h = r.hay.indexOf(q); // match against synonyms / native title
  if (h >= 0) return 500_000 - h * 8;
  return -1;
}

/** Live autocomplete (nav dropdown). */
export async function indexSearch(query: string, limit = 20): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const rows = await getIndex();
  const hits: Array<{ s: number; r: IndexRow }> = [];
  for (const r of rows) {
    const s = relevance(r, q);
    if (s > 0) hits.push({ s, r });
  }
  // relevance, then shortest title, then popularity — so the canonical entry
  // wins over near-duplicate catalog rows with the same name but no metadata.
  hits.sort(
    (a, b) =>
      b.s - a.s ||
      a.r.lc.length - b.r.lc.length ||
      (b.r.popularity ?? 0) - (a.r.popularity ?? 0),
  );
  return hits.slice(0, limit).map((h) => toResult(h.r));
}

const inRange = (v: string): ((n: number) => boolean) | null => {
  const m = v.match(/^(\d+)-(\d*)$/);
  if (!m) return null;
  const lo = parseInt(m[1], 10);
  const hi = m[2] ? parseInt(m[2], 10) : Number.MAX_SAFE_INTEGER;
  return (n) => n >= lo && n <= hi;
};

/** Full results page: filter + sort + paginate, all in memory.
 *  `personalIds` (when given) restricts to titles in the user's library that
 *  matched the personal-rating filters (computed via the DB by the caller). */
export async function indexQuery(
  query: string,
  f: CatalogFilters,
  page: number,
  perPage: number,
  personalIds: Set<string> | null,
  excludeNsfw = false,
): Promise<{ results: SearchResult[]; total: number }> {
  const q = query.trim().toLowerCase();
  const hasQ = q.length >= 2;
  const rows = await getIndex();

  const lenTest = f.length ? inRange(f.length) : null;
  const seasonN = f.seasons ? parseInt(f.seasons, 10) : NaN;
  const scoreMin = f.score ? Math.round(parseFloat(f.score) * 100) : NaN;
  const decade = f.decade ? parseInt(f.decade, 10) : NaN;

  const matched: Array<{ s: number; r: IndexRow }> = [];
  for (const r of rows) {
    if (excludeNsfw && r.nsfw) continue;
    if (personalIds && !personalIds.has(r.id)) continue;
    if ((f.type === "anime" || f.type === "manga") && r.kind !== f.type) continue;
    if (f.format && r.format !== f.format) continue;
    if (f.genre && !r.genres.includes(f.genre)) continue;
    if (!Number.isNaN(decade) && (r.year < decade || r.year > decade + 9)) continue;
    if (lenTest && !lenTest(r.episodes)) continue;
    if (!Number.isNaN(seasonN) && (seasonN >= 4 ? r.seasons < 4 : r.seasons !== seasonN)) continue;
    if (!Number.isNaN(scoreMin) && scoreMin > 0 && (r.score ?? -1) < scoreMin) continue;
    let s = 0;
    if (hasQ) {
      s = relevance(r, q);
      if (s <= 0) continue; // a query must match
    }
    matched.push({ s, r });
  }

  const byYearDesc = (a: IndexRow, b: IndexRow) => b.year - a.year || a.lc.length - b.lc.length;
  let cmp: (a: { s: number; r: IndexRow }, b: { s: number; r: IndexRow }) => number;
  switch (f.sort) {
    case "newest": cmp = (a, b) => byYearDesc(a.r, b.r); break;
    case "oldest": cmp = (a, b) => a.r.year - b.r.year; break;
    case "title": cmp = (a, b) => (a.r.lc < b.r.lc ? -1 : a.r.lc > b.r.lc ? 1 : 0); break;
    case "rated": cmp = (a, b) => (b.r.score ?? -1) - (a.r.score ?? -1) || b.r.year - a.r.year; break;
    case "popular": cmp = (a, b) => (b.r.popularity ?? -1) - (a.r.popularity ?? -1) || (b.r.score ?? -1) - (a.r.score ?? -1); break;
    default:
      cmp = hasQ ? (a, b) => b.s - a.s || a.r.lc.length - b.r.lc.length : (a, b) => byYearDesc(a.r, b.r);
  }
  matched.sort(cmp);

  const total = matched.length;
  const start = (page - 1) * perPage;
  const results = matched.slice(start, start + perPage).map((m) => toResult(m.r));
  return { results, total };
}

/** Acclaimed manga for the Manga tab (score desc), from the index. */
export async function indexBrowseManga(limit: number): Promise<SearchResult[]> {
  const rows = await getIndex();
  return rows
    .filter((r) => r.kind === "manga")
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.year - a.year)
    .slice(0, limit)
    .map(toResult);
}

/** A single title by id, from the index (instant). Returns null if absent. */
export async function indexGetTitle(id: string): Promise<SearchResult | null> {
  const rows = await getIndex();
  const r = rows.find((x) => x.id === id);
  return r ? toResult(r) : null;
}

// deterministic "most popular" order: popularity, then score, then id (so the
// pick is stable across index reloads regardless of DB row order)
function morePopular(a: IndexRow, b: IndexRow): number {
  return (b.popularity ?? 0) - (a.popularity ?? 0) || (b.score ?? 0) - (a.score ?? 0) || (a.id < b.id ? -1 : 1);
}

// most popular first (deterministic), used by the seasonal / latest-updated rows
const byPopularity = (a: IndexRow, b: IndexRow) =>
  (b.popularity ?? 0) - (a.popularity ?? 0) || (b.score ?? 0) - (a.score ?? 0) || (a.id < b.id ? -1 : 1);

/** The current anime season + year (Winter=Jan–Mar, Spring=Apr–Jun, Summer=Jul–Sep, Fall=Oct–Dec). */
export function currentSeason(): { season: string; year: number } {
  const d = new Date();
  const m = d.getMonth(); // 0–11
  const season = m <= 2 ? "winter" : m <= 5 ? "spring" : m <= 8 ? "summer" : "fall";
  return { season, year: d.getFullYear() };
}

/** The current season's most popular anime. */
export async function getSeasonal(limit: number): Promise<{ season: string; year: number; results: SearchResult[] }> {
  const { season, year } = currentSeason();
  const rows = await getIndex();
  const results = rows
    .filter((r) => r.kind === "anime" && !r.nsfw && r.cover && r.season === season && r.year === year)
    .sort(byPopularity)
    .slice(0, limit)
    .map(toResult);
  return { season, year, results };
}

/** Anime currently airing (getting new episodes / a new season), most popular first. */
export async function getLatestUpdated(limit: number): Promise<SearchResult[]> {
  const rows = await getIndex();
  return rows
    .filter((r) => r.kind === "anime" && !r.nsfw && r.cover && r.status === "ongoing")
    .sort(byPopularity)
    .slice(0, limit)
    .map(toResult);
}

// title markers that indicate a sequel / continuation (so we can exclude them
// from "new premieres")
const SEQUEL_RE =
  /\b(season\s*0*[2-9]|[2-9](st|nd|rd|th)\s+season|(second|third|fourth|fifth|sixth|final)\s+season|part\s*0*[2-9]|cour\s*0*[2-9]|season\s+(ii|iii|iv|v))\b|[\s:](ii|iii|iv)\s*$|\s[2-9]\s*$/i;

/** Popular NEW premieres — newly premiering shows (this year / upcoming),
 *  excluding sequels and continuations, most popular first. */
export async function getNewNotable(limit: number): Promise<SearchResult[]> {
  const { year } = currentSeason();
  const rows = await getIndex();
  return rows
    .filter(
      (r) =>
        r.kind === "anime" &&
        !r.nsfw &&
        r.cover &&
        r.popularity != null &&
        (r.status === "ongoing" || r.status === "upcoming") &&
        r.year >= year &&
        !SEQUEL_RE.test(r.title),
    )
    .sort(byPopularity)
    .slice(0, limit)
    .map(toResult);
}

/** Upcoming anime — announced but not yet aired, by anticipation (popularity).
 *  Sequels are kept (the most-awaited upcoming titles are often new seasons). */
export async function getUpcoming(limit: number): Promise<SearchResult[]> {
  const rows = await getIndex();
  return rows
    .filter(
      (r) =>
        r.kind === "anime" &&
        !r.nsfw &&
        r.cover &&
        r.status === "upcoming",
    )
    .sort(byPopularity)
    .slice(0, limit)
    .map(toResult);
}

/** Underrated gems — highly rated but below-median audience (and not sequels). */
export async function getUnderratedGems(limit: number): Promise<SearchResult[]> {
  const rows = await getIndex();
  return rows
    .filter(
      (r) =>
        r.kind === "anime" &&
        !r.nsfw &&
        r.cover &&
        r.score != null && r.score >= 780 && // ≥ 7.8, well reviewed
        r.popularity != null && r.popularity >= 15000 && r.popularity <= 140000 && // known but under the radar
        !SEQUEL_RE.test(r.title),
    )
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (a.popularity ?? 0) - (b.popularity ?? 0))
    .slice(0, limit)
    .map(toResult);
}

/** For each genre, the cover of its most popular anime — backs the Home browse
 *  tiles. Picks are deduped (no anime backs two genres) and deterministic, so
 *  the tiles stay stable. */
export async function getGenreTiles(genres: string[]): Promise<{ genre: string; cover: string | null }[]> {
  const rows = await getIndex();
  const used = new Set<string>();
  return genres.map((genre) => {
    const ranked = rows
      .filter((r) => r.kind === "anime" && !r.nsfw && r.cover && r.genres.includes(genre))
      .sort(morePopular);
    const pick = ranked.find((r) => !used.has(r.id)) ?? ranked[0] ?? null;
    if (pick) used.add(pick.id);
    return { genre, cover: pick?.cover ?? null };
  });
}

/** For each genre, the cover of a specific hand-picked title (matched by name),
 *  backing the Home browse tiles. Best name match (anime, with art) wins; null
 *  if nothing matches. */
export async function getGenreFeatureTiles(
  features: { genre: string; query: string }[],
): Promise<{ genre: string; cover: string | null }[]> {
  const rows = await getIndex();
  return features.map(({ genre, query }) => {
    const q = query.trim().toLowerCase();
    let best: IndexRow | null = null;
    let bestScore = -1;
    for (const r of rows) {
      if (r.kind !== "anime" || r.nsfw || !r.cover) continue;
      const s = relevance(r, q);
      if (s <= 0) continue;
      if (s > bestScore || (s === bestScore && (r.popularity ?? 0) > (best?.popularity ?? 0))) {
        best = r;
        bestScore = s;
      }
    }
    return { genre, cover: best?.cover ?? null };
  });
}
