"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getTitleCharacters, type Character } from "@/lib/profile";

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

/** Set (or clear, with null) the catalog title whose art fills the profile banner. */
export async function setProfileBannerAction(titleId: string | null): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const value = titleId ? titleId.trim().slice(0, 200) : null;
  await db.update(users).set({ bannerTitleId: value }).where(eq(users.id, userId));
  revalidatePath("/profile");
  return { ok: true };
}

/** Set (or clear, with null) the profile avatar image. Only MAL cdn character
 *  art (the picker's source) is accepted; anything else clears it. */
export async function setAvatarAction(image: string | null): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const url = image?.trim() || null;
  const value = url && /^https:\/\/cdn\.myanimelist\.net\//.test(url) ? url.slice(0, 500) : null;
  await db.update(users).set({ image: value }).where(eq(users.id, userId));
  revalidatePath("/profile");
  return { ok: true };
}

/** Fetch a catalog title's characters (for the avatar picker). */
export async function getTitleCharactersAction(titleId: string): Promise<Character[]> {
  await requireUserId();
  return getTitleCharacters(titleId);
}

/** Save the banner's framing (CSS background-position "x% y%", each clamped 0–100). */
export async function setProfileBannerPosAction(pos: string): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const m = pos.match(/^(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%$/);
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const value = m ? `${clamp(parseFloat(m[1]))}% ${clamp(parseFloat(m[2]))}%` : "50% 32%";
  await db.update(users).set({ bannerPos: value }).where(eq(users.id, userId));
  revalidatePath("/profile");
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
