import "server-only";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { follows } from "@/db/schema";

export type UserLite = {
  id: string;
  username: string;
  name: string | null;
  image: string | null;
  bio: string;
  viewerFollows: boolean; // does the signed-in viewer follow this user?
};

export type FollowCounts = { followers: number; following: number };
export type FollowRelationship = { following: boolean; followsYou: boolean };

// ---- mutations ---------------------------------------------------------
export async function followUser(followerId: string, followingId: string): Promise<void> {
  if (followerId === followingId) return; // no self-follow
  await db.insert(follows).values({ followerId, followingId }).onConflictDoNothing();
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  await db.delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
}

// ---- reads (all degrade to empty if the table isn't set up yet) --------
export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  try {
    const [row] = await db
      .select({
        followers: sql<number>`count(*) filter (where ${follows.followingId} = ${userId})::int`,
        following: sql<number>`count(*) filter (where ${follows.followerId} = ${userId})::int`,
      })
      .from(follows)
      .where(sql`${follows.followerId} = ${userId} or ${follows.followingId} = ${userId}`);
    return { followers: Number(row?.followers ?? 0), following: Number(row?.following ?? 0) };
  } catch {
    return { followers: 0, following: 0 };
  }
}

/** viewer → user (following) and user → viewer (followsYou); a mutual pair =
 *  "friends". */
export async function getFollowRelationship(viewerId: string | undefined, userId: string): Promise<FollowRelationship> {
  if (!viewerId || viewerId === userId) return { following: false, followsYou: false };
  try {
    const rows = await db
      .select({ a: follows.followerId, b: follows.followingId })
      .from(follows)
      .where(
        sql`(${follows.followerId} = ${viewerId} and ${follows.followingId} = ${userId})
         or (${follows.followerId} = ${userId} and ${follows.followingId} = ${viewerId})`,
      );
    let following = false;
    let followsYou = false;
    for (const r of rows) {
      if (r.a === viewerId && r.b === userId) following = true;
      if (r.a === userId && r.b === viewerId) followsYou = true;
    }
    return { following, followsYou };
  } catch {
    return { following: false, followsYou: false };
  }
}

type Row = { id: string; username: string; name: string | null; image: string | null; bio: string | null; viewer_follows: boolean };

function toLite(rows: Row[]): UserLite[] {
  return rows.map((r) => ({
    id: r.id, username: r.username, name: r.name, image: r.image, bio: r.bio ?? "", viewerFollows: !!r.viewer_follows,
  }));
}

/** Users who follow `userId`, newest first, tagged with whether the viewer follows each. */
export async function getFollowers(userId: string, viewerId?: string): Promise<UserLite[]> {
  try {
    const rows = await db.execute(sql`
      select u.id, u.username, u.name, u.image, u.bio,
             ${viewerId ? sql`(vf.follower_id is not null)` : sql`false`} as viewer_follows
      from follows f
      join users u on u.id = f.follower_id
      ${viewerId ? sql`left join follows vf on vf.follower_id = ${viewerId} and vf.following_id = u.id` : sql``}
      where f.following_id = ${userId}
      order by f.created_at desc
      limit 100
    `);
    return toLite(rows as unknown as Row[]);
  } catch {
    return [];
  }
}

/** Users `userId` follows, newest first, tagged with whether the viewer follows each. */
export async function getFollowing(userId: string, viewerId?: string): Promise<UserLite[]> {
  try {
    const rows = await db.execute(sql`
      select u.id, u.username, u.name, u.image, u.bio,
             ${viewerId ? sql`(vf.follower_id is not null)` : sql`false`} as viewer_follows
      from follows f
      join users u on u.id = f.following_id
      ${viewerId ? sql`left join follows vf on vf.follower_id = ${viewerId} and vf.following_id = u.id` : sql``}
      where f.follower_id = ${userId}
      order by f.created_at desc
      limit 100
    `);
    return toLite(rows as unknown as Row[]);
  } catch {
    return [];
  }
}
