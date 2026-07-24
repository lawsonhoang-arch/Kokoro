import "server-only";
import { sql } from "drizzle-orm";

import { db, getDbDirect } from "@/db";
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
// The 43k-row load is heavy (~8MB over the wire) and is BY FAR the largest
// source of Supabase egress: every instance that renders home/search/genres
// pulls the whole catalogue. At the old 15-minute TTL a single warm instance
// re-pulled it ~96x/day (~770MB/day) — enough on its own to blow the egress
// quota. The catalogue only changes when the sync job runs, so a long TTL costs
// nothing in freshness. Stale-while-revalidate keeps reads instant regardless.
// Override with SEARCH_INDEX_TTL_MIN (minutes) without redeploying code.
const TTL_MIN = Number(process.env.SEARCH_INDEX_TTL_MIN ?? 720); // default 12h
const TTL = (Number.isFinite(TTL_MIN) && TTL_MIN > 0 ? TTL_MIN : 720) * 60 * 1000;

type Raw = {
  id: string; kind: string; title: string; english_title: string | null; native: string | null;
  year: number | null; episodes: number | null; seasons: number | null;
  format: string | null; genres: string[] | null; cover: string | null;
  score: number | null; popularity: number | null; season: string | null; status: string | null;
  nsfw: boolean | null; search_text: string | null;
};

// search_text is title + synonyms (built up to 2000 chars). Across 43k rows its
// long tail dominates the cold-load payload, yet the important terms (title,
// romaji, common alternate titles) sit up front — so cap what we pull. Deep,
// rarely-queried synonyms drop out; primary + common-synonym search is intact.
const HAY_MAX = 280;

async function load(): Promise<IndexRow[]> {
  // Runs on the DIRECT connection (session pooler / direct), never the
  // transaction pooler — this one big streaming query would be cancelled there.
  const t0 = Date.now();
  const res = await getDbDirect().execute(sql`
    select id, kind, title, english_title, native_title as native, year, episodes, seasons,
           format, genres, cover, score, popularity, season, status, nsfw,
           left(search_text, ${HAY_MAX}) as search_text
    from titles where search_text is not null
  `);
  // filter(Boolean) drops any nullish/holes before mapping, so the index never
  // contains an undefined row (defensive against a partial/streaming result)
  const rows = (res as unknown as Raw[]).filter(Boolean);
  console.log(`[search-index] loaded ${rows.length} rows in ${Date.now() - t0}ms`);
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

// On a cold start the full 43k-row load can take many seconds on a loaded DB.
// Don't block a page render for the whole thing: wait briefly, then serve an
// empty index and let the load finish in the background (it populates the cache
// for the next request). Callers already handle an empty index gracefully.
const COLD_WAIT_MS = 5000;

/** The in-memory catalog. Serves a slightly stale copy while refreshing, and
 *  degrades to an empty index (never rejects) if a load fails — a transient DB
 *  timeout should mean "no results this once", not a 500. Crucially, the
 *  background load resolves (never rejects), so serving a stale copy while it
 *  runs can't leak an unhandled rejection. */
function startLoad(): Promise<IndexRow[]> {
  if (!loading) {
    loading = load()
      .then((rows) => { cache = rows; loadedAt = Date.now(); return rows; })
      .catch((e) => {
        console.error("[search-index] load failed:", (e as Error)?.message ?? e);
        return cache ?? []; // resolve to the stale copy (or empty) — never reject
      })
      .finally(() => { loading = null; });
  }
  return loading;
}

export async function getIndex(): Promise<IndexRow[]> {
  const fresh = cache && Date.now() - loadedAt < TTL;
  if (fresh) return cache!;
  const p = startLoad();
  // stale-while-revalidate: serve the old copy immediately if we have one
  if (cache) return cache;
  // no cache yet — wait only briefly, then serve empty while the load continues
  const bail = new Promise<IndexRow[]>((res) => setTimeout(() => res([]), COLD_WAIT_MS));
  return Promise.race([p, bail]);
}

/** Await the FULL index load — no cold-serve bail. For flows that prefer a
 *  correct result over latency (bulk import matching), so early lookups don't
 *  race an empty index on a cold instance. Cheap when the cache is warm. */
export async function ensureIndex(): Promise<void> {
  if (cache && Date.now() - loadedAt < TTL) return;
  await startLoad();
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
    status: r.status,
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
    if (!r) continue;
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
    if (!r) continue; // defensive: never let a stray row 500 the search page
    if (excludeNsfw && r.nsfw) continue;
    if (personalIds && !personalIds.has(r.id)) continue;
    if ((f.type === "anime" || f.type === "manga") && r.kind !== f.type) continue;
    if (f.format && r.format !== f.format) continue;
    if (f.airing && r.status !== f.airing) continue;
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
  const r = rows.find((x) => x && x.id === id);
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
/* ===== discovery shelves: bounded SQL, NOT the in-memory index ==============
   These only ever need a dozen rows, but scanning the index forced a ~43k-row
   (~8MB) catalogue pull on every instance that rendered Home — the single
   biggest source of Supabase egress. Running them as small LIMITed queries
   means Home never loads the index at all; only search does. Each degrades to
   an empty shelf on error, matching the old stale-index behaviour. */

type SqlRow = {
  id: string; kind: string; title: string; english: string | null; native: string | null;
  year: number | null; episodes: number | null; format: string | null;
  genres: string[] | null; cover: string | null; status: string | null;
};

const SHELF_COLS = sql`id, kind, title, english_title as english, native_title as native,
  year, episodes, format, genres, cover, status`;
/** anime, safe, and actually showable (has art) */
const SHELF_BASE = sql`kind = 'anime' and nsfw is not true and cover is not null`;

const sqlToResult = (r: SqlRow): SearchResult => ({
  id: r.id,
  kind: r.kind === "manga" ? "manga" : "anime",
  title: r.english || r.title,
  native: r.native,
  format: r.format,
  episodes: r.episodes && r.episodes > 0 ? r.episodes : null,
  year: r.year && r.year > 0 ? r.year : null,
  genres: r.genres ?? [],
  cover: hiResCover(r.cover),
  status: r.status ?? null,
});

export function currentSeason(): { season: string; year: number } {
  const d = new Date();
  const m = d.getMonth(); // 0–11
  const season = m <= 2 ? "winter" : m <= 5 ? "spring" : m <= 8 ? "summer" : "fall";
  return { season, year: d.getFullYear() };
}

/** The current season's most popular anime. */
export async function getSeasonal(limit: number): Promise<{ season: string; year: number; results: SearchResult[] }> {
  const { season, year } = currentSeason();
  try {
    const res = await db.execute(sql`
      select ${SHELF_COLS} from titles
      where ${SHELF_BASE} and season = ${season} and year = ${year}
      order by popularity desc nulls last
      limit ${limit}
    `);
    return { season, year, results: (res as unknown as SqlRow[]).filter(Boolean).map(sqlToResult) };
  } catch {
    return { season, year, results: [] };
  }
}

/** Anime currently airing (getting new episodes / a new season), most popular first. */
export async function getLatestUpdated(limit: number): Promise<SearchResult[]> {
  try {
    const res = await db.execute(sql`
      select ${SHELF_COLS} from titles
      where ${SHELF_BASE} and status = 'ongoing'
      order by popularity desc nulls last
      limit ${limit}
    `);
    return (res as unknown as SqlRow[]).filter(Boolean).map(sqlToResult);
  } catch {
    return [];
  }
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
  try {
    const res = await db.execute(sql`
      select ${SHELF_COLS} from titles
      where ${SHELF_BASE} and status = 'upcoming'
      order by popularity desc nulls last
      limit ${limit}
    `);
    return (res as unknown as SqlRow[]).filter(Boolean).map(sqlToResult);
  } catch {
    return [];
  }
}

/** Underrated gems — highly rated but below-median audience (and not sequels).
 *  SQL does the score/popularity band + ordering; the sequel regex is applied in
 *  JS over a small over-fetch (Postgres ARE doesn't take the JS `\b` syntax). */
export async function getUnderratedGems(limit: number): Promise<SearchResult[]> {
  try {
    const res = await db.execute(sql`
      select ${SHELF_COLS} from titles
      where ${SHELF_BASE}
        and score >= 780
        and popularity between 15000 and 140000
      order by score desc nulls last, popularity asc
      limit ${limit * 5}
    `);
    return (res as unknown as SqlRow[])
      .filter(Boolean)
      .filter((r) => !SEQUEL_RE.test(r.title))
      .slice(0, limit)
      .map(sqlToResult);
  } catch {
    return [];
  }
}

/** Acclaimed titles within the given genres, best-scored first, skipping ids the
 *  viewer has already seen. Backs "blind spots" recommendations. */
export async function getTopInGenres(genres: string[], exclude: Set<string>, limit: number): Promise<SearchResult[]> {
  if (genres.length === 0) return [];
  const want = new Set(genres.map((g) => g.toLowerCase()));
  const rows = await getIndex();
  return rows
    .filter(
      (r) =>
        !r.nsfw &&
        r.cover &&
        r.score != null && r.score >= 750 &&
        !exclude.has(r.id) &&
        r.genres.some((g) => want.has(g.toLowerCase())),
    )
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit)
    .map(toResult);
}

// A mood is a filter over the catalog: genres (any / all / excluded), length,
// and a quality floor. Everything runs against the in-memory index (no DB).
export type MoodCriteria = {
  anyGenres?: string[];
  allGenres?: string[];
  notGenres?: string[];
  minScore?: number;
  minEpisodes?: number;
  maxEpisodes?: number;
  includeManga?: boolean;
};

/** Titles matching a mood, best-scored first. Anime only unless `includeManga`. */
export async function getByMood(c: MoodCriteria, limit: number): Promise<SearchResult[]> {
  const rows = await getIndex();
  const any = c.anyGenres?.map((g) => g.toLowerCase());
  const all = c.allGenres?.map((g) => g.toLowerCase());
  const not = c.notGenres?.map((g) => g.toLowerCase());
  return rows
    .filter((r) => {
      if (r.nsfw || !r.cover) return false;
      if (!c.includeManga && r.kind !== "anime") return false;
      if (c.minScore != null && (r.score == null || r.score < c.minScore)) return false;
      if (c.minEpisodes != null && (!r.episodes || r.episodes < c.minEpisodes)) return false;
      if (c.maxEpisodes != null && (!r.episodes || r.episodes > c.maxEpisodes)) return false;
      const g = r.genres.map((x) => x.toLowerCase());
      if (any && !any.some((x) => g.includes(x))) return false;
      if (all && !all.every((x) => g.includes(x))) return false;
      if (not && not.some((x) => g.includes(x))) return false;
      return true;
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
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
/** A cover tile per genre, using that genres single most popular anime — for
 *  personalised Browse-by-genre where the genres are chosen at runtime (the
 *  users top genres) rather than a hand-picked query per tile. */
export async function getGenreTilesByPopularity(
  genres: string[],
): Promise<{ genre: string; cover: string | null }[]> {
  const rows = await getIndex();
  return genres.map((genre) => {
    let best: IndexRow | null = null;
    let bestPop = -1;
    for (const r of rows) {
      if (!r || r.kind !== "anime" || r.nsfw || !r.cover) continue;
      if (!r.genres.includes(genre)) continue;
      if ((r.popularity ?? 0) > bestPop) { best = r; bestPop = r.popularity ?? 0; }
    }
    return { genre, cover: best?.cover ?? null };
  });
}

export async function getGenreFeatureTiles(
  features: { genre: string; query: string }[],
): Promise<{ genre: string; cover: string | null }[]> {
  // One tiny LIMIT 1 lookup per tile instead of scanning the whole index — a
  // dozen sub-kilobyte queries beats an 8MB catalogue pull just to draw covers.
  return Promise.all(
    features.map(async ({ genre, query }) => {
      const like = `%${query.trim()}%`;
      try {
        const res = await db.execute(sql`
          select cover from titles
          where ${SHELF_BASE} and (english_title ilike ${like} or title ilike ${like})
          order by popularity desc nulls last
          limit 1
        `);
        const row = (res as unknown as { cover: string | null }[])[0];
        return { genre, cover: hiResCover(row?.cover ?? null) };
      } catch {
        return { genre, cover: null };
      }
    }),
  );
}

/* ===== fuzzy matching (typo-tolerant) — for the notes-import matcher ========
   The main relevance() is pure substring, so it returns nothing for a
   misspelling ("Fulmetal Alchemist"). This scans the in-memory index with a
   token-level edit-distance similarity so typos still resolve. It is heavier
   than relevance(), so it is only used as a fallback for lines that didn't
   match exactly, and it is bounded by a cheap first-letter pre-filter. */

function fnorm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

// bounded Levenshtein: bails once the distance is known to exceed `cap`.
function levCapped(a: string, b: string, cap: number): number {
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > cap) return cap + 1;
  let prev = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    let best = i;
    const cur = new Array(lb + 1);
    cur[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < best) best = cur[j];
    }
    if (best > cap) return cap + 1;
    prev = cur;
  }
  return prev[lb];
}

function tokenSim(a: string, b: string): number {
  if (a === b) return 1;
  const m = Math.max(a.length, b.length);
  if (m === 0) return 1;
  if (Math.abs(a.length - b.length) > 3) return 0;
  const d = levCapped(a, b, 3);
  return d > 3 ? 0 : 1 - d / m;
}

export async function fuzzySearch(query: string, limit = 6): Promise<SearchResult[]> {
  const q = fnorm(query);
  if (q.length < 3) return [];
  const qtok = q.split(" ").filter((t) => t.length > 0);
  if (qtok.length === 0) return [];
  const qFirst = new Set(qtok.map((t) => t[0]));
  const rows = await getIndex();

  const scored: Array<{ s: number; r: IndexRow }> = [];
  for (const r of rows) {
    if (!r) continue;
    // a title far shorter than the query can't contain it — skip
    if (r.lc.length + 4 < q.length) continue;
    const ttok = r.lc.split(/[^a-z0-9]+/).filter((t) => t.length > 0);
    // cheap pre-filter: at least one title token must share a first letter with
    // a query token (typos rarely change the first character)
    if (!ttok.some((t) => qFirst.has(t[0]))) continue;

    let sum = 0;
    let matchedAll = true;
    for (const qt of qtok) {
      let best = 0;
      for (const tt of ttok) {
        const s = tokenSim(qt, tt);
        if (s > best) best = s;
        if (best === 1) break;
      }
      if (best < 0.6) { matchedAll = false; break; }
      sum += best;
    }
    if (!matchedAll) continue;
    const score = sum / qtok.length;
    if (score >= 0.82) scored.push({ s: score, r });
  }

  scored.sort(
    (a, b) =>
      b.s - a.s ||
      a.r.lc.length - b.r.lc.length ||
      (b.r.popularity ?? 0) - (a.r.popularity ?? 0),
  );
  return scored.slice(0, limit).map((h) => toResult(h.r));
}
