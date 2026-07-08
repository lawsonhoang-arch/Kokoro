"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { toggleTrack } from "@/lib/calendar";

/** Toggle whether the signed-in user tracks a title's weekly releases. */
export async function toggleTrackAction(titleId: string): Promise<{ tracking: boolean }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const r = await toggleTrack(session.user.id, titleId);
  revalidatePath("/calendar");
  return r;
}
