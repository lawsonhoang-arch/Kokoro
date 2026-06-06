"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  submitDescription,
  getTitleDescription,
  hasPending,
  getPendingSubmissions,
  approveSubmission,
  rejectSubmission,
  isModerator,
  type SubmitResult,
  type PendingItem,
} from "@/lib/submissions";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user;
}

async function requireModerator() {
  const user = await requireUser();
  if (!isModerator(user.role)) throw new Error("Forbidden");
  return user;
}

export type TitleDescState = {
  description: string | null;
  authorUsername: string | null;
  pending: boolean;
};

/** Current description + whether the viewer has a pending submission. */
export async function getTitleDescriptionAction(titleId: string): Promise<TitleDescState> {
  const user = await requireUser();
  const { description, authorUsername } = await getTitleDescription(titleId);
  const pending = await hasPending(user.id, titleId);
  return { description, authorUsername, pending };
}

export async function submitDescriptionAction(titleId: string, body: string): Promise<SubmitResult> {
  const user = await requireUser();
  return submitDescription(user.id, titleId, body);
}

export async function getPendingSubmissionsAction(): Promise<PendingItem[]> {
  await requireModerator();
  return getPendingSubmissions();
}

export async function approveSubmissionAction(id: string): Promise<void> {
  const mod = await requireModerator();
  await approveSubmission(mod.id, id);
  revalidatePath("/review");
}

export async function rejectSubmissionAction(id: string, note?: string): Promise<void> {
  const mod = await requireModerator();
  await rejectSubmission(mod.id, id, note);
  revalidatePath("/review");
}
