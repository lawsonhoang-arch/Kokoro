import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { db } from "@/db";
import type { SearchResult } from "@/features/search/types";
import { type CatalogFilters, hasPersonalFilter } from "@/features/search/constants";
import { hiResCover } from "@/lib/cover";
import { indexSearch, indexQuery, indexBrowseManga, indexGetTitle, getNewNotable } from "@/lib/search-index";

// Period keys used to rotate cached carousels: the hero refreshes daily, the
// recommendations weekly. Including the key in the cache key means a new
// day/week is a fresh entry (recompute); within it, the pick stays stable.
// A key that changes once every 2 days — used to freeze the shuffled home
// selections (hero + "because you added") so the titles rotate every 2 days
// rather than on every load or daily/weekly.
const TWO_DAYS = 2 * 86400;
const twoDayKey = () => String(Math.floor(Date.now() / (TWO_DAYS * 1000)));

/** Titles the signed-in user has already WATCHED/READ — a completion (the
 *  Mark-watched button) or a list entry marked completed. Excluded from the
 *  hero and recommendations so finished titles aren't surfaced back. */
async function watchedTitleIds(userId: string): Promise<Set<string>> {
  try {
    const r = await db.execute(sql`
      select e.title_id as id from watchlist_entries e
        join watchlists w on w.id = e.watchlist_id
        where w.user_id = ${userId} and e.status = 'completed'
      union
      select title_id as id from completions where user_id = ${userId}
    `);
    return new Set((r as unknown as { id: string }[]).map((x) => x.id));
  } catch {
    return new Set<string>();
  }
}

const DIM_KEYS = ["story", "art", "music", "pacing"] as const;

type Row = {
  id: string;
  kind: string | null;
  title: string;
  english: string | null;
  native: string | null;
  year: number | null;
  episodes: number | null;
  format: string | null;
  genres: string[] | null;
  cover: string | null;
  status: string | null;
};

// columns selected for every catalog query (kept in sync with toResult / Row).
// Qualified with `titles.` so it stays unambiguous when joined with the
// watchlist_entries / watchlists tables (which also have id / title columns).
const COLS = sql`titles.id, titles.kind, titles.title, titles.english_title as english, titles.native_title as native, titles.year, titles.episodes, titles.format, titles.genres, titles.cover, titles.status`;

// Self-hosted search over the in-memory catalog index — no per-keystroke DB
// round trip. Ranks exact → prefix → word-boundary → contains → synonym.
export async function searchCatalog(query: string, limit = 20): Promise<SearchResult[]> {
  return indexSearch(query, limit);
}

function toResult(r: Row): SearchResult {
  return {
    id: r.id,
    kind: r.kind === "manga" ? "manga" : "anime",
    title: r.english || r.title, // prefer English for display
    native: r.native,
    format: r.format,
    episodes: r.episodes && r.episodes > 0 ? r.episodes : null,
    year: r.year && r.year > 0 ? r.year : null,
    genres: r.genres ?? [],
    cover: hiResCover(r.cover),
    status: r.status ?? null,
  };
}

// The set of title ids in a user's library matching the personal-rating
// filters (status / feeling / per-axis / overall) — the only part of a search
// that still needs the DB, since ratings are per-user and not in the index.
async function personalTitleIds(userId: string, f: CatalogFilters): Promise<Set<string>> {
  const pc: SQL[] = [sql`w.user_id = ${userId}`];
  if (f.status) pc.push(sql`e.status = ${f.status}`);
  if (f.feeling) pc.push(sql`e.feeling = ${f.feeling}`);
  for (const d of DIM_KEYS) {
    const v = f[d];
    if (v) {
      const n = parseInt(v, 10);
      if (!Number.isNaN(n) && n > 0) pc.push(sql`(e.dims->>${d})::int >= ${n}`);
    }
  }
  if (f.rating) {
    const n = parseFloat(f.rating);
    if (!Number.isNaN(n) && n > 0)
      pc.push(
        sql`(((e.dims->>'story')::numeric + (e.dims->>'art')::numeric + (e.dims->>'music')::numeric + (e.dims->>'pacing')::numeric) / 4) >= ${n}`,
      );
  }
  const res = await db.execute(
    sql`select distinct e.title_id from watchlist_entries e join watchlists w on e.watchlist_id = w.id where ${sql.join(pc, sql` and `)}`,
  );
  return new Set((res as unknown as { title_id: string }[]).map((r) => r.title_id));
}

// Full results for the /search page — closest-match ranking, filters, paging.
// Served from the in-memory index; only personal-rating filters touch the DB.
export async function searchCatalogFull(
  q: string,
  f: CatalogFilters,
  page = 1,
  perPage = 30,
  userId?: string,
  excludeNsfw = false,
): Promise<{ results: SearchResult[]; total: number }> {
  const personalIds = userId && hasPersonalFilter(f) ? await personalTitleIds(userId, f) : null;
  return indexQuery(q, f, page, perPage, personalIds, excludeNsfw);
}

/** Acclaimed manga for the Manga tab's browse grid (score desc), from the index. */
export async function browseManga(limit = 30): Promise<SearchResult[]> {
  return indexBrowseManga(limit);
}

/** The featured Home hero — the highest-scored anime that has cover art. */
export async function getHero(): Promise<
  (SearchResult & { description: string | null; score: number | null }) | null
> {
  const r = await db.execute(sql`
    select ${COLS}, description, score
    from titles
    where kind = 'anime' and cover is not null and score is not null and nsfw = false
    order by score desc nulls last
    limit 1
  `);
  const rows = r as unknown as (Row & { description: string | null; score: number | null })[];
  if (!rows[0]) return null;
  return {
    ...toResult(rows[0]),
    description: rows[0].description ?? null,
    score: rows[0].score ?? null,
  };
}

export type HeroSlide = SearchResult & {
  description: string | null;
  score: number | null;
  eyebrow: string; // category label shown on the slide
  banner: string | null; // wide hero art (AniList); falls back to cover when null
};

/**
 * Featured Home hero carousel — a curated mix that changes each load: one random
 * top-rated title, one random trending title (anime or manga), one random new &
 * notable premiere, then the rest suggested from the signed-in user's lists
 * (falling back to more from the pools for brand-new users). Enriched with
 * description + score for display.
 */
/** Featured Home hero — a random-ish mix, frozen per day so it stays put across
 *  refreshes and rotates once daily (also spares the DB the 4 sub-queries). */
export function getHeroSlides(userId?: string, limit = 6): Promise<HeroSlide[]> {
  return unstable_cache(
    () => computeHeroSlides(userId, limit),
    ["hero-slides", userId ?? "anon", String(limit), twoDayKey()],
    { revalidate: TWO_DAYS },
  )();
}

async function computeHeroSlides(userId?: string, limit = 6): Promise<HeroSlide[]> {
  const [topRated, trending, newNotable, recs, watched] = await Promise.all([
    searchCatalogFull("", { type: "anime", sort: "rated" }, 1, 30, undefined, true),
    searchCatalogFull("", { sort: "popular" }, 1, 30, undefined, true),
    getNewNotable(30),
    userId
      ? getRecommendations(userId, 30)
      : Promise.resolve({ seedGenre: null, seedTitle: null, results: [] as SearchResult[] }),
    userId ? watchedTitleIds(userId) : Promise.resolve(new Set<string>()),
  ]);

  const rand = (a: SearchResult[]) => (a.length ? a[Math.floor(Math.random() * a.length)] : null);
  const shuffle = <T,>(a: T[]): T[] =>
    a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map(([, v]) => v);

  type Cand = { item: SearchResult; eyebrow: string };
  const seen = new Set<string>();
  const chosen: Cand[] = [];
  const add = (item: SearchResult | null, eyebrow: string) => {
    // skip anything already watched/read — the hero shouldn't feature finished titles
    if (!item || seen.has(item.id) || watched.has(item.id) || chosen.length >= limit) return;
    seen.add(item.id);
    chosen.push({ item, eyebrow });
  };

  // one from each headline category…
  add(rand(topRated.results), "Top rated");
  add(rand(trending.results), "Trending now");
  add(rand(newNotable), "New & notable");
  // …then fill the rest from the user's recommendations…
  for (const r of shuffle(recs.results)) add(r, "Suggested for you");
  // …and finally top up from the pools so the carousel is never short.
  const pool: Cand[] = shuffle([
    ...topRated.results.map((i) => ({ item: i, eyebrow: "Top rated" })),
    ...trending.results.map((i) => ({ item: i, eyebrow: "Trending now" })),
    ...newNotable.map((i) => ({ item: i, eyebrow: "New & notable" })),
  ]);
  for (const c of pool) add(c.item, c.eyebrow);

  if (chosen.length === 0) return [];
  const idList = sql.join(chosen.map((c) => sql`${c.item.id}`), sql`, `);
  const r = await db.execute(sql`select id, description, score, banner from titles where id in (${idList})`);
  const meta = new Map(
    (r as unknown as { id: string; description: string | null; score: number | null; banner: string | null }[]).map(
      (m) => [m.id, m],
    ),
  );
  return chosen.map((c) => ({
    ...c.item,
    eyebrow: c.eyebrow,
    description: meta.get(c.item.id)?.description ?? null,
    score: meta.get(c.item.id)?.score ?? null,
    // wide AniList banner art; '' means "checked, none" → fall back to the cover
    banner: meta.get(c.item.id)?.banner || null,
  }));
}

export type HomeEntry = SearchResult & {
  entryId: string;
  listId: string;
  listTitle: string;
  status: string;
  progress: number | null;
};

/** The signed-in user's in-progress titles (status = watching), most-recent first. */
export async function getContinueWatching(userId: string, limit = 12): Promise<HomeEntry[]> {
  const r = await db.execute(sql`
    select e.id as entry_id, w.id as list_id, w.title as list_title, e.status, e.progress, ${COLS}
    from watchlist_entries e
    join watchlists w on e.watchlist_id = w.id
    join titles on titles.id = e.title_id
    where w.user_id = ${userId} and e.status = 'watching'
    order by w.last_edited_at desc
    limit ${limit}
  `);
  const rows = r as unknown as (Row & {
    entry_id: string; list_id: string; list_title: string; status: string; progress: number | null;
  })[];
  return rows.map((row) => ({
    ...toResult(row),
    entryId: row.entry_id,
    listId: row.list_id,
    listTitle: row.list_title,
    status: row.status,
    progress: row.progress,
  }));
}

/** Genre-matched recommendations from the user's library (excludes owned titles). */
type Recs = { seedGenre: string | null; seedTitle: string | null; results: SearchResult[] };

/** Suggestions for the "Because you added …" shelf. Rotated every 2 days (a
 *  fresh shuffle of the top matches), frozen in between via the 2-day key. */
export function getRecommendations(userId: string, limit = 12): Promise<Recs> {
  return unstable_cache(
    () => computeRecommendations(userId, limit),
    ["recommendations", userId, String(limit), twoDayKey()],
    { revalidate: TWO_DAYS },
  )();
}

/** The users top genres from their library, most-tracked first. Drives the
 *  personalised Browse-by-genre tiles on Home. Empty for a new/empty library. */
export async function getUserTopGenres(userId: string, limit = 6): Promise<string[]> {
  try {
    const res = await db.execute(sql`
      select g as genre, count(*)::int as c from (
        select unnest(t.genres) as g
        from watchlist_entries e
        join watchlists w on e.watchlist_id = w.id
        join titles t on t.id = e.title_id
        where w.user_id = ${userId}
      ) s where g is not null group by g order by c desc limit ${limit}
    `);
    return (res as unknown as { genre: string }[]).map((r) => r.genre).filter(Boolean);
  } catch {
    return [];
  }
}

async function computeRecommendations(userId: string, limit = 12): Promise<Recs> {
  const topGenreRes = await db.execute(sql`
    select g as genre, count(*)::int as c from (
      select unnest(t.genres) as g
      from watchlist_entries e
      join watchlists w on e.watchlist_id = w.id
      join titles t on t.id = e.title_id
      where w.user_id = ${userId}
    ) s where g is not null group by g order by c desc limit 1
  `);
  const seedGenre = (topGenreRes as unknown as { genre: string }[])[0]?.genre ?? null;
  if (!seedGenre) return { seedGenre: null, seedTitle: null, results: [] };

  const seedRes = await db.execute(sql`
    select t.title from watchlist_entries e
    join watchlists w on e.watchlist_id = w.id
    join titles t on t.id = e.title_id
    where w.user_id = ${userId} and ${seedGenre} = any(t.genres)
    order by w.last_edited_at desc limit 1
  `);
  const seedTitle = (seedRes as unknown as { title: string }[])[0]?.title ?? null;

  // pull a wider pool of strong matches, then take a shuffled slice — the
  // shuffle is frozen for the week by the cache key, so recs rotate weekly
  const recRes = await db.execute(sql`
    select ${COLS} from titles
    where ${seedGenre} = any(genres)
      and search_text is not null
      and nsfw = false
      and id not in (
        select e.title_id from watchlist_entries e
        join watchlists w on e.watchlist_id = w.id
        where w.user_id = ${userId}
        union
        select title_id from completions where user_id = ${userId}
      )
    order by score desc nulls last, popularity desc nulls last, year desc nulls last
    limit ${limit * 3}
  `);
  const pool = (recRes as unknown as Row[]).map(toResult);
  const results = pool
    .map((v) => [Math.random(), v] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => v)
    .slice(0, limit);
  return { seedGenre, seedTitle, results };
}

/** A single catalog title by id — for the standalone /anime/[id] page. */
export async function getTitle(id: string): Promise<SearchResult | null> {
  // instant from the in-memory index; fall back to the DB for any row that
  // isn't indexed (e.g. missing search_text, or index not yet warmed).
  const fromIndex = await indexGetTitle(id);
  if (fromIndex) return fromIndex;
  const result = await db.execute(sql`
    select ${COLS}
    from titles where id = ${id} limit 1
  `);
  const rows = result as unknown as Row[];
  return rows[0] ? toResult(rows[0]) : null;
}

/** Wide AniList banner art for one title (for the community/detail hero).
 *  Returns null when none is available or the row isn't enriched yet, so
 *  callers fall back to the cover. */
export async function getTitleBanner(id: string): Promise<string | null> {
  const r = await db.execute(sql`select banner from titles where id = ${id} limit 1`);
  const rows = r as unknown as { banner: string | null }[];
  return rows[0]?.banner || null;
}
