import "server-only";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { getTopInGenres } from "@/lib/search-index";
import type { SearchResult } from "@/features/search/types";

export type SuggestedPerson = {
  id: string;
  username: string;
  name: string | null;
  image: string | null;
  bio: string;
  followers: number;
};

// Broad, friendly seed genres shown as the taste picker in onboarding.
export const ONBOARD_GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Romance",
  "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Mystery", "Psychological",
] as const;

// Genres to fall back on when the user skips the taste step (so the favorites
// grid is never empty).
const DEFAULT_GENRES = ["Action", "Adventure", "Fantasy", "Romance", "Comedy", "Drama"];

/** True only when the account exists and hasn't finished onboarding. Degrades to
 *  false (never forces the flow) if the column isn't migrated in yet. */
export async function needsOnboarding(userId: string): Promise<boolean> {
  try {
    const [u] = await db.select({ at: users.onboardedAt }).from(users).where(eq(users.id, userId)).limit(1);
    return !!u && u.at == null;
  } catch {
    return false;
  }
}

/** Mark the first-run flow complete. */
export async function completeOnboarding(userId: string): Promise<void> {
  try {
    await db.update(users).set({ onboardedAt: new Date() }).where(eq(users.id, userId));
  } catch {
    /* pre-migration — no-op */
  }
}

/** Acclaimed titles in the chosen genres (or a broad default) for the favorites
 *  picker. */
export async function getStarterTitles(genres: string[], limit = 24): Promise<SearchResult[]> {
  const use = genres.length ? genres : DEFAULT_GENRES;
  try {
    return await getTopInGenres(use, new Set(), limit);
  } catch {
    return [];
  }
}

/** People worth following on day one — most-followed accounts the user doesn't
 *  already follow. */
export async function getSuggestedPeople(userId: string, limit = 12): Promise<SuggestedPerson[]> {
  try {
    const rows = await db.execute(sql`
      select u.id, u.username, u.name, u.image, u.bio,
             (select count(*) from follows f where f.following_id = u.id)::int as followers
      from users u
      where u.id <> ${userId}
        and u.id not in (select following_id from follows where follower_id = ${userId})
      order by followers desc, u.created_at desc
      limit ${limit}
    `);
    return (rows as unknown as SuggestedPerson[]).map((r) => ({
      id: r.id, username: r.username, name: r.name, image: r.image, bio: r.bio ?? "", followers: Number(r.followers ?? 0),
    }));
  } catch {
    return [];
  }
}
