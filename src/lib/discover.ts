import "server-only";
import { desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { users, follows, watchlists, watchlistEntries } from "@/db/schema";
import { ratedByUser, getTasteAffinityBulk, type MatchLite } from "@/lib/affinity";
import type { UserLite } from "@/lib/follows";

export type PeopleResult = { list: UserLite[]; matches: Map<string, MatchLite> };

type URow = { id: string; username: string; name: string | null; image: string | null; bio: string | null };

function toLite(u: URow, viewerFollows: boolean): UserLite {
  return { id: u.id, username: u.username, name: u.name, image: u.image, bio: u.bio ?? "", viewerFollows };
}

/** People whose ratings line up with yours: co-raters ranked by taste affinity,
 *  excluding yourself and anyone you already follow. Empty (never throws) when
 *  you haven't rated enough for a signal — the page falls back to popular users. */
export async function getSimilarPeople(userId: string, limit = 12): Promise<PeopleResult> {
  try {
    const mine = await ratedByUser(userId);
    if (mine.size === 0) return { list: [], matches: new Map() };
    // cap the fan-out; the most-rated titles are plenty to find co-raters
    const myTitleIds = [...mine.keys()].slice(0, 500);

    const fRows = await db.select({ id: follows.followingId }).from(follows).where(eq(follows.followerId, userId));
    const exclude = new Set(fRows.map((r) => r.id));
    exclude.add(userId);

    // candidate pool: users who've also rated titles you have, most-overlapping first
    const cand = await db
      .select({ uid: watchlists.userId, shared: sql<number>`count(distinct ${watchlistEntries.titleId})::int` })
      .from(watchlistEntries)
      .innerJoin(watchlists, eq(watchlists.id, watchlistEntries.watchlistId))
      .where(inArray(watchlistEntries.titleId, myTitleIds))
      .groupBy(watchlists.userId)
      .orderBy(desc(sql`count(distinct ${watchlistEntries.titleId})`))
      .limit(150);
    const candIds = cand.map((c) => c.uid).filter((id) => !exclude.has(id)).slice(0, 60);
    if (candIds.length === 0) return { list: [], matches: new Map() };

    const matches = await getTasteAffinityBulk(userId, candIds);
    // keep only genuine taste matches (enough shared ratings to score), best first
    const ranked = candIds
      .map((id) => ({ id, m: matches.get(id) }))
      .filter((x): x is { id: string; m: MatchLite } => !!x.m && x.m.score != null)
      .sort((a, b) => b.m.score! - a.m.score! || b.m.shared - a.m.shared)
      .slice(0, limit);
    if (ranked.length === 0) return { list: [], matches };

    const ids = ranked.map((r) => r.id);
    const urows = await db
      .select({ id: users.id, username: users.username, name: users.name, image: users.image, bio: users.bio })
      .from(users)
      .where(inArray(users.id, ids));
    const byId = new Map(urows.map((u) => [u.id, u]));
    const list = ids.filter((id) => byId.has(id)).map((id) => toLite(byId.get(id)!, false));
    return { list, matches };
  } catch {
    return { list: [], matches: new Map() };
  }
}

/** Free-text user search by handle or display name, tagged with whether the
 *  viewer already follows each. Exact-prefix handle matches rank first. */
export async function searchUsers(query: string, viewerId: string | undefined, limit = 15): Promise<UserLite[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const safe = q.replace(/[%_\\]/g, "");
    const like = `%${safe}%`;
    const prefix = `${safe}%`;
    const rows = await db.execute(sql`
      select u.id, u.username, u.name, u.image, u.bio,
             ${viewerId ? sql`(vf.follower_id is not null)` : sql`false`} as viewer_follows
      from users u
      ${viewerId ? sql`left join follows vf on vf.follower_id = ${viewerId} and vf.following_id = u.id` : sql``}
      where (u.username ilike ${like} or u.name ilike ${like})
      ${viewerId ? sql`and u.id <> ${viewerId}` : sql``}
      order by (u.username ilike ${prefix}) desc, char_length(u.username), u.username
      limit ${limit}
    `);
    return (rows as unknown as (URow & { viewer_follows: boolean })[]).map((r) => toLite(r, !!r.viewer_follows));
  } catch {
    return [];
  }
}
