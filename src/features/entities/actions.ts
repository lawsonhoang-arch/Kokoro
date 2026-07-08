"use server";

import { auth } from "@/auth";
import { setEntityFollow, type EntityRef } from "@/lib/entities";

/** Follow / unfollow a studio, person, or character (from MAL). */
export async function setEntityFollowAction(ref: EntityRef, follow: boolean): Promise<{ following: boolean }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  await setEntityFollow(session.user.id, ref, follow);
  return { following: follow };
}
