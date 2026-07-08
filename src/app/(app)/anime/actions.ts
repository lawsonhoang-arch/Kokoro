"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { toggleCompletion } from "@/lib/completions";
import { toggleFavorite } from "@/lib/favorites";
import { logRewatch, undoRewatch } from "@/lib/rewatches";

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
