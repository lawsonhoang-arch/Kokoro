import "server-only";
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { getProfileSummary, entryScore } from "@/lib/profile";

export type WrappedMood = { loved: number; liked: number; mixed: number; dropped: number };
export type WrappedShowcase = { id: string; title: string; cover: string | null; value: string };
export type WrappedScope = number | "all";

export type Wrapped = {
  scope: WrappedScope;
  years: number[]; // years with any activity, newest first (for the selector)
  hasData: boolean;

  // all-time taste portrait (always populated if the user tracks anything)
  completed: number;
  hours: number;
  episodes: number;
  chapters: number;
  animeCompleted: number;
  mangaCompleted: number;
  topGenres: { genre: string; n: number }[];
  mood: WrappedMood;
  moodTotal: number;
  showcase: WrappedShowcase[];
  rewatchChampion: { title: string; cover: string | null; count: number } | null;
  tasteLine: string;

  // highlights for the selected scope (a year, or all-time totals)
  periodFinished: number;
  periodHours: number;
  periodNotes: number;
  periodRewatches: number;
  periodFavorites: number;
};

type Row = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

// Bucket every rated title into a feeling, across all rate modes (glyphs/axes/
// symbols) via the shared 0–5 score.
async function getMood(userId: string): Promise<WrappedMood> {
  const m: WrappedMood = { loved: 0, liked: 0, mixed: 0, dropped: 0 };
  try {
    const res = await db.execute(sql`
      select we.feeling, we.rate_mode, we.symbol, we.dims
      from watchlist_entries we
      join watchlists w on w.id = we.watchlist_id
      where w.user_id = ${userId}`);
    for (const r of res as unknown as Row[]) {
      const s = entryScore({ rateMode: r.rate_mode as string | null, feeling: r.feeling as string | null, symbol: r.symbol, dims: r.dims });
      if (s == null) continue;
      if (s >= 4.5) m.loved++;
      else if (s >= 3.5) m.liked++;
      else if (s >= 2) m.mixed++;
      else m.dropped++;
    }
  } catch { /* leave empty */ }
  return m;
}

async function getRewatchChampion(userId: string): Promise<Wrapped["rewatchChampion"]> {
  try {
    const res = await db.execute(sql`
      select count(*)::int as n, coalesce(t.english_title, t.title) as title, t.cover
      from rewatches rw join titles t on t.id = rw.title_id
      where rw.user_id = ${userId}
      group by t.id, t.english_title, t.title, t.cover
      order by n desc limit 1`);
    const [row] = res as unknown as Row[];
    if (!row || num(row.n) < 1) return null;
    return { title: String(row.title ?? "Untitled"), cover: (row.cover as string | null) ?? null, count: num(row.n) };
  } catch {
    return null;
  }
}

async function getYears(userId: string): Promise<number[]> {
  try {
    const res = await db.execute(sql`
      select distinct y from (
        select extract(year from created_at)::int as y from completions where user_id = ${userId}
        union all select extract(year from created_at)::int from journal_entries where user_id = ${userId}
        union all select extract(year from created_at)::int from favorites where user_id = ${userId}
      ) s where y is not null order by y desc`);
    return (res as unknown as Row[]).map((r) => num(r.y)).filter((y) => y > 2000);
  } catch {
    return [];
  }
}

// Counts + hours for the chosen scope. A `count(*) filter (where …)` per table.
async function getPeriod(userId: string, scope: WrappedScope): Promise<Pick<Wrapped, "periodFinished" | "periodHours" | "periodNotes" | "periodRewatches" | "periodFavorites">> {
  const out = { periodFinished: 0, periodHours: 0, periodNotes: 0, periodRewatches: 0, periodFavorites: 0 };
  const yearOf = (col: string) => (scope === "all" ? sql`` : sql` and extract(year from ${sql.raw(col)}) = ${scope}`);
  try {
    const [fin] = await db.execute(sql`
      select count(*)::int as cnt,
             coalesce(sum(case when t.kind <> 'manga' then t.episodes else 0 end), 0)::int as aeps
      from completions c join titles t on t.id = c.title_id
      where c.user_id = ${userId}${yearOf("c.created_at")}`) as unknown as Row[];
    out.periodFinished = num(fin?.cnt);
    out.periodHours = Math.round((num(fin?.aeps) * 24) / 60);
  } catch { /* skip */ }
  try {
    const [n] = await db.execute(sql`select count(*)::int as cnt from journal_entries where user_id = ${userId}${yearOf("created_at")}`) as unknown as Row[];
    out.periodNotes = num(n?.cnt);
  } catch { /* skip */ }
  try {
    const [n] = await db.execute(sql`select count(*)::int as cnt from favorites where user_id = ${userId}${yearOf("created_at")}`) as unknown as Row[];
    out.periodFavorites = num(n?.cnt);
  } catch { /* skip */ }
  try {
    const [n] = await db.execute(sql`select count(*)::int as cnt from rewatches where user_id = ${userId}${yearOf("created_at")}`) as unknown as Row[];
    out.periodRewatches = num(n?.cnt);
  } catch { /* skip */ }
  return out;
}

function tasteLine(mood: WrappedMood, total: number, topGenre: string | null, completed: number): string {
  const lovedPct = total ? mood.loved / total : 0;
  const droppedPct = total ? mood.dropped / total : 0;
  const heart =
    lovedPct >= 0.5 ? "warm-hearted" :
    droppedPct >= 0.25 ? "hard to impress" :
    lovedPct >= 0.3 ? "openhearted" : "discerning";
  const rank = completed >= 300 ? "veteran" : completed >= 80 ? "devotee" : completed >= 15 ? "explorer" : "newcomer";
  const genre = topGenre ? topGenre.toLowerCase() + " " : "";
  return `A ${heart} ${genre}${rank}.`;
}

/** Everything the Wrapped recap needs. `scope` is a year or "all". */
export async function getWrapped(userId: string, scope: WrappedScope): Promise<Wrapped> {
  const [summary, mood, champ, years, period] = await Promise.all([
    getProfileSummary(userId),
    getMood(userId),
    getRewatchChampion(userId),
    getYears(userId),
    getPeriod(userId, scope),
  ]);
  const s = summary.stats;
  const moodTotal = mood.loved + mood.liked + mood.mixed + mood.dropped;
  const topGenres = summary.genres.slice(0, 5);
  const showcase: WrappedShowcase[] = summary.superlatives
    .filter((x) => x.cover || x.title)
    .slice(0, 4)
    .map((x) => ({ id: x.titleId, title: x.title, cover: x.cover, value: x.value }));

  return {
    scope,
    years,
    hasData: s.completed > 0 || s.tracked > 0 || moodTotal > 0,
    completed: s.completed,
    hours: s.hours,
    episodes: s.episodesWatched,
    chapters: s.chaptersRead,
    animeCompleted: s.anime.completed,
    mangaCompleted: s.manga.completed,
    topGenres,
    mood,
    moodTotal,
    showcase,
    rewatchChampion: champ,
    tasteLine: tasteLine(mood, moodTotal, s.topGenre, s.completed),
    ...period,
  };
}
