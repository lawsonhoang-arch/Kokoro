"use server";

import { auth } from "@/auth";
import { followUser, unfollowUser } from "@/lib/follows";

/** Follow (follow=true) or unfollow (false) another user. Returns the new state. */
export async function setFollowAction(targetUserId: string, follow: boolean): Promise<{ following: boolean }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const me = session.user.id;
  if (me === targetUserId) return { following: false };
  if (follow) await followUser(me, targetUserId);
  else await unfollowUser(me, targetUserId);
  return { following: follow };
}
