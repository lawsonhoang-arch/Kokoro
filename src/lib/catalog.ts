import "server-only";
import { sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import type { SearchResult } from "@/features/search/types";
import { type CatalogFilters, hasPersonalFilter } from "@/features/search/constants";
import { hiResCover } from "@/lib/cover";

const DIM_KEYS = ["story", "art", "music", "pacing"] as const;

// parse a "min-max" / "min-" bucket value into numeric bounds
function parseRange(v: string): { min: number; max: number } | null {
  const m = v.match(/^(\d+)-(\d*)$/);
  if (!m) return null;
  const min = parseInt(m[1], 10);
  const max = m[2] ? parseInt(m[2], 10) : 1_000_000;
  if (Number.isNaN(min)) return null;
  return { min, max };
}

type Row = {
  id: string;
  kind: string | null;
  title: string;
  native: string | null;
  year: number | null;
  episodes: number | null;
  format: string | null;
  genres: string[] | null;
  cover: string | null;
};

// columns selected for every catalog query (kept in sync with toResult / Row).
// Qualified with `titles.` so it stays unambiguous when joined with the
// watchlist_entries / watchlists tables (which also have id / title columns).
const COLS = sql`titles.id, titles.kind, titles.title, titles.native_title as native, titles.year, titles.episodes, titles.format, titles.genres, titles.cover`;

// Self-hosted fuzzy search over your own catalog using pg_trgm. Ranks exact →
// prefix → contains → fuzzy, shortest-title tiebreak. No external API.
export async function searchCatalog(query: string, limit = 20): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const prefix = `${q}%`;

  const result = await db.execute(sql`
    select ${COLS}
    from titles
    where search_text is not null
      and (search_text ilike ${like} or similarity(search_text, ${q}) > 0.2)
    order by
      (lower(title) = ${q}) desc,
      (lower(title) like ${prefix}) desc,
      (search_text ilike ${like}) desc,
      similarity(title, ${q}) desc,
      length(title) asc
    limit ${limit}
  `);

  const rows = result as unknown as Row[];
  return rows.map(toResult);
}

function toResult(r: Row): SearchResult {
  return {
    id: r.id,
    kind: r.kind === "manga" ? "manga" : "anime",
    title: r.title,
    native: r.native,
    format: r.format,
    episodes: r.episodes && r.episodes > 0 ? r.episodes : null,
    year: r.year && r.year > 0 ? r.year : null,
    genres: r.genres ?? [],
    cover: hiResCover(r.cover),
  };
}

// Full results for the /search page: closest-match ranking, filters, paging.
export async function searchCatalogFull(
  q: string,
  f: CatalogFilters,
  page = 1,
  perPage = 30,
  userId?: string,
): Promise<{ results: SearchResult[]; total: number }> {
  const query = q.trim().toLowerCase();
  const hasQ = query.length >= 2;

  const conds: SQL[] = [sql`search_text is not null`];
  if (hasQ) conds.push(sql`(search_text ilike ${"%" + query + "%"} or similarity(search_text, ${query}) > 0.2)`);
  if (f.type === "anime" || f.type === "manga") conds.push(sql`kind = ${f.type}`);
  if (f.format) conds.push(sql`format = ${f.format}`);
  if (f.genre) conds.push(sql`${f.genre} = any(genres)`);
  if (f.decade) {
    const y = parseInt(f.decade, 10);
    if (!Number.isNaN(y)) conds.push(sql`year between ${y} and ${y + 9}`);
  }
  // length — episodes for anime, chapters for manga (same column)
  if (f.length) {
    const r = parseRange(f.length);
    if (r) conds.push(sql`episodes between ${r.min} and ${r.max}`);
  }
  // seasons (volumes for manga); "4" means 4 or more
  if (f.seasons) {
    const n = parseInt(f.seasons, 10);
    if (!Number.isNaN(n)) conds.push(n >= 4 ? sql`seasons >= 4` : sql`seasons = ${n}`);
  }
  // minimum catalog score (stored ×100)
  if (f.score) {
    const s = parseFloat(f.score);
    if (!Number.isNaN(s) && s > 0) conds.push(sql`score >= ${Math.round(s * 100)}`);
  }

  // personal ratings → require an entry in the user's library matching them
  if (userId && hasPersonalFilter(f)) {
    const pc: SQL[] = [sql`e.title_id = titles.id`, sql`w.user_id = ${userId}`];
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
    conds.push(
      sql`exists (select 1 from watchlist_entries e join watchlists w on e.watchlist_id = w.id where ${sql.join(pc, sql` and `)})`,
    );
  }

  const where = sql.join(conds, sql` and `);

  let order: SQL;
  if (f.sort === "newest") order = sql`year desc nulls last, length(title) asc`;
  else if (f.sort === "oldest") order = sql`year asc nulls last`;
  else if (f.sort === "title") order = sql`lower(title) asc`;
  else if (f.sort === "rated") order = sql`score desc nulls last, year desc nulls last`;
  else if (f.sort === "popular") order = sql`popularity desc nulls last, score desc nulls last`;
  else if (hasQ)
    order = sql`(lower(title) = ${query}) desc, (lower(title) like ${query + "%"}) desc, (search_text ilike ${"%" + query + "%"}) desc, similarity(title, ${query}) desc, length(title) asc`;
  else order = sql`year desc nulls last`;

  const offset = (page - 1) * perPage;
  const rowsRes = await db.execute(sql`
    select ${COLS}
    from titles where ${where} order by ${order} limit ${perPage} offset ${offset}
  `);
  const countRes = await db.execute(sql`select count(*)::int as total from titles where ${where}`);

  const rows = rowsRes as unknown as Row[];
  const total = (countRes as unknown as { total: number }[])[0]?.total ?? 0;
  return { results: rows.map(toResult), total: Number(total) };
}

/** Acclaimed manga for the Manga tab's browse grid (score desc, then recent). */
export async function browseManga(limit = 30): Promise<SearchResult[]> {
  const result = await db.execute(sql`
    select ${COLS}
    from titles
    where kind = 'manga' and search_text is not null
    order by score desc nulls last, year desc nulls last, length(title) asc
    limit ${limit}
  `);
  return (result as unknown as Row[]).map(toResult);
}

/** The featured Home hero — the highest-scored anime that has cover art. */
export async function getHero(): Promise<
  (SearchResult & { description: string | null; score: number | null }) | null
> {
  const r = await db.execute(sql`
    select ${COLS}, description, score
    from titles
    where kind = 'anime' and cover is not null and score is not null
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
export async function getRecommendations(
  userId: string,
  limit = 12,
): Promise<{ seedGenre: string | null; seedTitle: string | null; results: SearchResult[] }> {
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

  const recRes = await db.execute(sql`
    select ${COLS} from titles
    where ${seedGenre} = any(genres)
      and search_text is not null
      and id not in (
        select e.title_id from watchlist_entries e
        join watchlists w on e.watchlist_id = w.id
        where w.user_id = ${userId}
      )
    order by score desc nulls last, popularity desc nulls last, year desc nulls last
    limit ${limit}
  `);
  return {
    seedGenre,
    seedTitle,
    results: (recRes as unknown as Row[]).map(toResult),
  };
}

/** A single catalog title by id — for the standalone /anime/[id] page. */
export async function getTitle(id: string): Promise<SearchResult | null> {
  const result = await db.execute(sql`
    select ${COLS}
    from titles where id = ${id} limit 1
  `);
  const rows = result as unknown as Row[];
  return rows[0] ? toResult(rows[0]) : null;
}
