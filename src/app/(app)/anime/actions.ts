"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { toggleCompletion } from "@/lib/completions";
import { toggleFavorite } from "@/lib/favorites";
import { logRewatch, undoRewatch } from "@/lib/rewatches";
import { getFollowing } from "@/lib/follows";
import { sendRecommendation } from "@/lib/notifications";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

/** Toggle a standalone "watched/done" mark for a title (no list needed). */
export async function toggleCompletionAction(titleId: string): Promise<{ completed: boolean }> {
  const userId = await requireUserId();
  const res = await toggleCompletion(userId, titleId);
  revalidatePath("/profile");
  return res;
}

/** Toggle a title as a hand-picked favorite (shown on the profile). Note: no
 *  revalidatePath — /profile is dynamic (re-fetched each visit), and revalidating
 *  it from the profile's own Add-favorites modal would self-refresh mid-edit. */
export async function toggleFavoriteAction(titleId: string): Promise<{ favorite: boolean; atLimit: boolean }> {
  const userId = await requireUserId();
  return toggleFavorite(userId, titleId);
}

/** Log one more rewatch / reread pass for a title. Returns the new count. */
export async function logRewatchAction(titleId: string): Promise<{ count: number }> {
  const userId = await requireUserId();
  const count = await logRewatch(userId, titleId);
  revalidatePath("/profile");
  return { count };
}

/** Undo the most recent rewatch / reread pass. Returns the new count. */
export async function undoRewatchAction(titleId: string): Promise<{ count: number }> {
  const userId = await requireUserId();
  const count = await undoRewatch(userId, titleId);
  revalidatePath("/profile");
  return { count };
}

export type RecommendFriend = { id: string; username: string; name: string | null; image: string | null; hue: number };

function hueOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 6) + 1;
}

/** The friends (people the user follows) they can recommend a title to. */
export async function getRecommendTargetsAction(): Promise<RecommendFriend[]> {
  const userId = await requireUserId();
  const following = await getFollowing(userId, userId);
  return following.map((u) => ({ id: u.id, username: u.username, name: u.name, image: u.image, hue: hueOf(u.username) }));
}

/** Send a title recommendation (as a notification) to one or more friends. */
export async function recommendTitleAction(titleId: string, toUserIds: string[], note = ""): Promise<{ sent: number }> {
  const userId = await requireUserId();
  const ids = Array.from(new Set(toUserIds)).filter((id) => id && id !== userId).slice(0, 20);
  const clean = note.trim().slice(0, 200);
  let sent = 0;
  for (const to of ids) {
    const r = await sendRecommendation(userId, to, titleId, clean);
    if (r.ok) sent++;
  }
  return { sent };
}
