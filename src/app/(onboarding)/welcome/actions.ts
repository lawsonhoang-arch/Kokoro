"use server";

import { eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { toggleFavorite, isFavorite } from "@/lib/favorites";
import { followUser } from "@/lib/follows";
import { completeOnboarding, getStarterTitles, setHomeFocus } from "@/lib/onboarding";
import type { SearchResult } from "@/features/search/types";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

/** Fetch acclaimed titles in the picked genres for the favorites step. */
export async function starterTitlesAction(genres: string[]): Promise<SearchResult[]> {
  await requireUserId();
  const clean = genres.filter((g) => typeof g === "string").slice(0, 12);
  return getStarterTitles(clean, 24);
}

export type FinishOnboardingInput = {
  name?: string;
  favoriteIds?: string[];
  followIds?: string[];
  focus?: string[];
};

/** Persist everything the user chose, then mark the flow complete. Best-effort:
 *  a hiccup on one favorite/follow never blocks finishing. */
export async function finishOnboardingAction(input: FinishOnboardingInput): Promise<{ ok: true }> {
  const userId = await requireUserId();

  const name = (input.name ?? "").trim().slice(0, 60);
  if (name) {
    try {
      await db.update(users).set({ name }).where(eq(users.id, userId));
    } catch {
      /* ignore */
    }
  }

  // favorites are capped at 10 in the lib; add until it declines (atLimit)
  for (const id of Array.from(new Set(input.favoriteIds ?? [])).slice(0, 10)) {
    try {
      if (!(await isFavorite(userId, id))) await toggleFavorite(userId, id);
    } catch {
      /* skip a bad id */
    }
  }

  for (const id of Array.from(new Set(input.followIds ?? [])).slice(0, 30)) {
    if (!id || id === userId) continue;
    try {
      await followUser(userId, id);
    } catch {
      /* skip */
    }
  }

  if (input.focus?.length) {
    try {
      await setHomeFocus(userId, input.focus);
    } catch {
      /* ignore */
    }
  }

  await completeOnboarding(userId);
  return { ok: true };
}
