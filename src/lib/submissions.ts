import "server-only";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { descriptionSubmissions, titles, users } from "@/db/schema";

export const isModerator = (role?: string | null) => role === "moderator" || role === "admin";

export const MIN_LEN = 40;
export const MAX_LEN = 4000;

export type TitleDescription = {
  description: string | null;
  authorUsername: string | null;
};

/** The live (approved) description for a title, with its author's handle. */
export async function getTitleDescription(titleId: string): Promise<TitleDescription> {
  const [row] = await db
    .select({ description: titles.description, authorUsername: users.username })
    .from(titles)
    .leftJoin(users, eq(titles.descriptionAuthorId, users.id))
    .where(eq(titles.id, titleId))
    .limit(1);
  return { description: row?.description ?? null, authorUsername: row?.authorUsername ?? null };
}

export type SubmitResult = { ok: true } | { ok: false; error: string };

/** Submit (or replace your own pending) description for review. */
export async function submitDescription(
  userId: string,
  titleId: string,
  body: string,
): Promise<SubmitResult> {
  const text = body.trim();
  if (text.length < MIN_LEN) return { ok: false, error: `Please write at least ${MIN_LEN} characters.` };
  if (text.length > MAX_LEN) return { ok: false, error: `Keep it under ${MAX_LEN} characters.` };

  // make sure the title exists
  const [t] = await db.select({ id: titles.id }).from(titles).where(eq(titles.id, titleId)).limit(1);
  if (!t) return { ok: false, error: "That title isn't in the catalog yet." };

  // one pending submission per user per title — replace if it exists
  const [existing] = await db
    .select({ id: descriptionSubmissions.id })
    .from(descriptionSubmissions)
    .where(
      and(
        eq(descriptionSubmissions.titleId, titleId),
        eq(descriptionSubmissions.userId, userId),
        eq(descriptionSubmissions.status, "pending"),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(descriptionSubmissions)
      .set({ body: text, createdAt: new Date() })
      .where(eq(descriptionSubmissions.id, existing.id));
  } else {
    await db.insert(descriptionSubmissions).values({ titleId, userId, body: text });
  }
  return { ok: true };
}

/** Whether the user already has a pending submission for this title. */
export async function hasPending(userId: string, titleId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: descriptionSubmissions.id })
    .from(descriptionSubmissions)
    .where(
      and(
        eq(descriptionSubmissions.titleId, titleId),
        eq(descriptionSubmissions.userId, userId),
        eq(descriptionSubmissions.status, "pending"),
      ),
    )
    .limit(1);
  return !!row;
}

export type PendingItem = {
  id: string;
  titleId: string;
  title: string;
  body: string;
  authorUsername: string;
  createdAt: number;
};

/** The moderation queue — all pending submissions, oldest first. */
export async function getPendingSubmissions(): Promise<PendingItem[]> {
  const rows = await db
    .select({
      id: descriptionSubmissions.id,
      titleId: descriptionSubmissions.titleId,
      title: titles.title,
      body: descriptionSubmissions.body,
      authorUsername: users.username,
      createdAt: descriptionSubmissions.createdAt,
    })
    .from(descriptionSubmissions)
    .innerJoin(titles, eq(descriptionSubmissions.titleId, titles.id))
    .innerJoin(users, eq(descriptionSubmissions.userId, users.id))
    .where(eq(descriptionSubmissions.status, "pending"))
    .orderBy(desc(descriptionSubmissions.createdAt));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.getTime() }));
}

/** Approve: the submission body becomes the title's live description. */
export async function approveSubmission(reviewerId: string, submissionId: string): Promise<void> {
  const [sub] = await db
    .select()
    .from(descriptionSubmissions)
    .where(and(eq(descriptionSubmissions.id, submissionId), eq(descriptionSubmissions.status, "pending")))
    .limit(1);
  if (!sub) return;

  await db
    .update(titles)
    .set({ description: sub.body, descriptionAuthorId: sub.userId })
    .where(eq(titles.id, sub.titleId));

  await db
    .update(descriptionSubmissions)
    .set({ status: "approved", reviewerId, reviewedAt: new Date() })
    .where(eq(descriptionSubmissions.id, submissionId));
}

export async function rejectSubmission(
  reviewerId: string,
  submissionId: string,
  note?: string,
): Promise<void> {
  await db
    .update(descriptionSubmissions)
    .set({ status: "rejected", reviewerId, reviewNote: note ?? null, reviewedAt: new Date() })
    .where(and(eq(descriptionSubmissions.id, submissionId), eq(descriptionSubmissions.status, "pending")));
}
