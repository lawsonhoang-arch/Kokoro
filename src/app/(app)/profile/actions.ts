"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** Update the display name and/or bio. */
export async function updateProfileAction(input: { name?: string; bio?: string }): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const patch: { name?: string | null; bio?: string } = {};
  if (input.name !== undefined) {
    const name = input.name.trim().slice(0, 60);
    patch.name = name || null;
  }
  if (input.bio !== undefined) patch.bio = input.bio.trim().slice(0, 240);
  if (Object.keys(patch).length) {
    await db.update(users).set(patch).where(eq(users.id, userId));
    revalidatePath("/profile");
  }
  return { ok: true };
}

/** Change the handle. Validates format + uniqueness. */
export async function changeUsernameAction(raw: string): Promise<{ ok: boolean; error?: string; username?: string }> {
  const userId = await requireUserId();
  const username = raw.trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    return { ok: false, error: "3–20 characters — letters, numbers, or underscores." };
  }
  const taken = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, username), ne(users.id, userId)))
    .limit(1);
  if (taken.length) return { ok: false, error: "That username is taken." };
  try {
    await db.update(users).set({ username }).where(eq(users.id, userId));
  } catch {
    return { ok: false, error: "Couldn't change username — try again." };
  }
  revalidatePath("/profile");
  return { ok: true, username };
}
