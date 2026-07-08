import "server-only";
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { entryScore } from "@/lib/profile";

export type ActivityKind = "completed" | "favorited" | "rated" | "take" | "note" | "rewatched";

export type ActivityEvent = {
  id: string; // stable key
  kind: ActivityKind;
  at: Date;
  user: { username: string; name: string | null; image: string | null };
  title: { id: string; name: string; cover: string | null } | null;
  // journal specifics (present for rated/take/note)
  heading?: string;
  body?: string;
  episode?: string;
  score?: number | null; // 0–5 when the entry carries a rating
  feeling?: string | null;
  // rewatched specifics
  ordinal?: number; // which time through (2 = second time, i.e. first rewatch)
};

type Audience = ReturnType<typeof sql>;
const userAudience = (userId: string): Audience => sql`= ${userId}`;
const followAudience = (viewerId: string): Audience =>
  sql`in (select following_id from follows where follower_id = ${viewerId})`;

type Row = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const nstr = (v: unknown): string | null => (typeof v === "string" ? v : null);

function mapJournal(res: unknown): ActivityEvent[] {
  const rows = res as unknown as Row[];
  return rows.map((r) => {
    const score = entryScore({
      rateMode: nstr(r.rate_mode),
      feeling: nstr(r.feeling),
      symbol: r.symbol,
      dims: r.dims,
    });
    const isTake = r.is_take === true;
    const kind: ActivityKind = score != null ? "rated" : isTake ? "take" : "note";
    return {
      id: "journal:" + str(r.evid),
      kind,
      at: new Date(str(r.at)),
      user: { username: str(r.username), name: nstr(r.name), image: nstr(r.image) },
      title: r.title_id ? { id: str(r.title_id), name: str(r.tname) || "Untitled", cover: nstr(r.cover) } : null,
      heading: str(r.heading),
      body: str(r.body),
      episode: str(r.episode),
      score,
      feeling: nstr(r.feeling),
    };
  });
}

function mapSimple(res: unknown, kind: "completed" | "favorited"): ActivityEvent[] {
  const rows = res as unknown as Row[];
  return rows.map((r) => ({
    id: `${kind}:${str(r.user_id)}:${str(r.title_id)}`,
    kind,
    at: new Date(str(r.at)),
    user: { username: str(r.username), name: nstr(r.name), image: nstr(r.image) },
    title: { id: str(r.title_id), name: str(r.tname) || "Untitled", cover: nstr(r.cover) },
  }));
}

function mapRewatch(res: unknown): ActivityEvent[] {
  const rows = res as unknown as Row[];
  return rows.map((r) => ({
    id: "rewatch:" + str(r.evid),
    kind: "rewatched" as const,
    at: new Date(str(r.at)),
    user: { username: str(r.username), name: nstr(r.name), image: nstr(r.image) },
    title: { id: str(r.title_id), name: str(r.tname) || "Untitled", cover: nstr(r.cover) },
    ordinal: Number(r.rnum ?? 1) + 1, // 1st rewatch = 2nd time through
  }));
}

// Rewatch/reread passes — a separate table added later, so it's fetched apart
// from the core sources (a missing table must not wipe the rest of the feed).
async function fetchRewatches(aud: Audience, limit: number): Promise<ActivityEvent[]> {
  try {
    const res = await db.execute(sql`
      select rw.id::text as evid, rw.title_id, rw.created_at as at,
             row_number() over (partition by rw.user_id, rw.title_id order by rw.created_at asc) as rnum,
             u.username, u.name, u.image, coalesce(t.english_title, t.title) as tname, t.cover
      from rewatches rw
      join users u on u.id = rw.user_id
      join titles t on t.id = rw.title_id
      where rw.user_id ${aud}
      order by rw.created_at desc limit ${limit}`);
    return mapRewatch(res);
  } catch {
    return [];
  }
}

// Merge the three timestamped activity sources (journal notes/ratings, marked
// completions, favourites) into one newest-first stream. Never throws.
async function fetchActivity(aud: Audience, limit: number): Promise<ActivityEvent[]> {
  try {
    const [jr, cr, fr] = await Promise.all([
      db.execute(sql`
        select j.id::text as evid, j.title_id, j.created_at as at,
               j.heading, j.body, j.episode, j.feeling, j.rate_mode, j.symbol, j.dims, j.is_take,
               u.username, u.name, u.image, coalesce(t.english_title, t.title) as tname, t.cover
        from journal_entries j
        join users u on u.id = j.user_id
        left join titles t on t.id = j.title_id
        where j.user_id ${aud}
        order by j.created_at desc limit ${limit}`),
      db.execute(sql`
        select c.user_id, c.title_id, c.created_at as at,
               u.username, u.name, u.image, coalesce(t.english_title, t.title) as tname, t.cover
        from completions c
        join users u on u.id = c.user_id
        join titles t on t.id = c.title_id
        where c.user_id ${aud}
        order by c.created_at desc limit ${limit}`),
      db.execute(sql`
        select fv.user_id, fv.title_id, fv.created_at as at,
               u.username, u.name, u.image, coalesce(t.english_title, t.title) as tname, t.cover
        from favorites fv
        join users u on u.id = fv.user_id
        join titles t on t.id = fv.title_id
        where fv.user_id ${aud}
        order by fv.created_at desc limit ${limit}`),
    ]);
    const core = [...mapJournal(jr), ...mapSimple(cr, "completed"), ...mapSimple(fr, "favorited")];
    const rw = await fetchRewatches(aud, limit);
    const events = [...core, ...rw];
    events.sort((a, b) => b.at.getTime() - a.at.getTime());
    return events.slice(0, limit);
  } catch {
    // core sources failed — still surface any rewatches
    const rw = await fetchRewatches(aud, limit);
    return rw.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
  }
}

/** One user's activity diary — newest first. */
export function getUserActivity(userId: string, limit = 40): Promise<ActivityEvent[]> {
  return fetchActivity(userAudience(userId), limit);
}

/** The activity of everyone the viewer follows — newest first. */
export function getFollowingFeed(viewerId: string | undefined, limit = 40): Promise<ActivityEvent[]> {
  if (!viewerId) return Promise.resolve([]);
  return fetchActivity(followAudience(viewerId), limit);
}
