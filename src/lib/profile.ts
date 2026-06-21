import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { users, watchlists, watchlistEntries, titles, communityPosts, journalEntries, completions } from "@/db/schema";
import { hiResCover } from "@/lib/cover";

export type ProfileUser = {
  id: string;
  name: string | null;
  username: string;
  email: string;
  role: string;
  bio: string;
  createdAt: string; // ISO
};

export type ProfileTitle = {
  id: string;
  title: string;
  cover: string | null;
  year: number | null;
  genres: string[];
  episodes: number;
  status: string;
  progress: number | null;
  score: number | null; // 0–5, when rated
};

export type GenreCount = { genre: string; n: number };

export type ProfileStats = {
  tracked: number;
  completed: number;
  watching: number;
  planned: number;
  episodesWatched: number;
  hours: number;
  lists: number;
  reviews: number;
  topGenre: string | null;
};

export type ProfileSummary = {
  stats: ProfileStats;
  watching: ProfileTitle[];
  genres: GenreCount[];
};

export type ProfileReview = {
  id: string;
  titleId: string | null;
  titleName: string | null;
  cover: string | null;
  rateMode: string;
  feeling: string | null;
  symbol: { style: string; value: number } | null;
  dims: Record<string, number>;
  heading: string;
  body: string;
  spoiler: boolean;
  likeCount: number;
  createdAt: string;
};

export type ActivityItem = {
  id: string;
  kind: "review" | "discussion" | "note" | "take" | "completed";
  titleName: string | null;
  episode: string;
  text: string;
  createdAt: string;
};

const FEELING_SCORE: Record<string, number> = { loved: 5, liked: 4, mixed: 2.5, dropped: 1 };

/** Normalize a watchlist entry's rating to a 0–5 score (or null if unrated). */
export function entryScore(e: {
  rateMode: string | null;
  feeling: string | null;
  symbol: unknown;
  dims: unknown;
}): number | null {
  const mode = e.rateMode || "glyphs";
  if (mode === "symbols") {
    const s = e.symbol as { value?: number } | null;
    return s && (s.value ?? 0) > 0 ? s.value! : null;
  }
  if (mode === "axes") {
    const d = (e.dims as Record<string, number>) ?? {};
    const vals = ["story", "art", "music", "pacing"].map((k) => d[k] ?? 0).filter((v) => v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  return e.feeling ? FEELING_SCORE[e.feeling] ?? null : null;
}

export async function getProfileUser(userId: string): Promise<ProfileUser | null> {
  const [u] = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      email: users.email,
      role: users.role,
      bio: users.bio,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) return null;
  return { ...u, createdAt: u.createdAt.toISOString() };
}

/** Stats + favorites + currently-watching + genre breakdown, computed from one
 *  pass over the user's watchlist entries (bounded by their own activity). */
export async function getProfileSummary(userId: string): Promise<ProfileSummary> {
  const rows = await db
    .select({
      titleId: titles.id,
      title: titles.title,
      english: titles.englishTitle,
      cover: titles.cover,
      year: titles.year,
      genres: titles.genres,
      episodes: titles.episodes,
      kind: titles.kind,
      status: watchlistEntries.status,
      progress: watchlistEntries.progress,
      watchedEps: watchlistEntries.watchedEps,
      feeling: watchlistEntries.feeling,
      rateMode: watchlistEntries.rateMode,
      symbol: watchlistEntries.symbol,
      dims: watchlistEntries.dims,
    })
    .from(watchlistEntries)
    .innerJoin(watchlists, eq(watchlistEntries.watchlistId, watchlists.id))
    .innerJoin(titles, eq(watchlistEntries.titleId, titles.id))
    .where(eq(watchlists.userId, userId));

  const [{ lists }] = await db
    .select({ lists: sql<number>`count(*)::int` })
    .from(watchlists)
    .where(eq(watchlists.userId, userId));
  const [{ reviews }] = await db
    .select({ reviews: sql<number>`count(*)::int` })
    .from(communityPosts)
    .where(and(eq(communityPosts.userId, userId), eq(communityPosts.kind, "review")));

  let completed = 0, watching = 0, planned = 0, minutes = 0, episodesWatched = 0;
  const genreTally: Record<string, number> = {};
  const watchingList: ProfileTitle[] = [];

  // de-dupe a title that appears in multiple lists (count it once)
  const seen = new Set<string>();
  for (const r of rows) {
    const name = r.english || r.title;
    const score = entryScore(r);
    if (r.status === "watching")
      watchingList.push({
        id: r.titleId,
        title: name,
        cover: hiResCover(r.cover),
        year: r.year,
        genres: r.genres ?? [],
        episodes: r.episodes,
        status: r.status,
        progress: r.progress,
        score,
      });
    if (seen.has(r.titleId)) continue;
    seen.add(r.titleId);

    // episodes watched = the explicit set, falling back to progress (or full for
    // completed) for legacy/edge entries; capped at the title's episode count.
    const we = (r.watchedEps as number[] | null) ?? [];
    const watchedCount = Math.min(
      r.episodes || Infinity,
      we.length || (r.status === "completed" ? r.episodes : r.progress ?? 0),
    );
    if (r.kind !== "manga") {
      episodesWatched += watchedCount;
      minutes += watchedCount * 24;
    }

    if (r.status === "completed") completed++;
    else if (r.status === "watching") watching++;
    else planned++;
    for (const g of r.genres ?? []) genreTally[g] = (genreTally[g] ?? 0) + 1;
  }

  // fold in standalone completions (marked watched without a list), skipping any
  // title already counted from a list so it's never double-counted.
  const comps = await db
    .select({ titleId: titles.id, episodes: titles.episodes, kind: titles.kind, genres: titles.genres })
    .from(completions)
    .innerJoin(titles, eq(completions.titleId, titles.id))
    .where(eq(completions.userId, userId));
  for (const c of comps) {
    if (seen.has(c.titleId)) continue;
    seen.add(c.titleId);
    completed++;
    if (c.kind !== "manga") { episodesWatched += c.episodes; minutes += c.episodes * 24; }
    for (const g of c.genres ?? []) genreTally[g] = (genreTally[g] ?? 0) + 1;
  }

  const genres = Object.entries(genreTally)
    .map(([genre, n]) => ({ genre, n }))
    .sort((a, b) => b.n - a.n || a.genre.localeCompare(b.genre));

  const watchingTop = watchingList
    .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
    .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))
    .slice(0, 6);

  return {
    stats: {
      tracked: seen.size,
      completed,
      watching,
      planned,
      episodesWatched,
      hours: Math.round(minutes / 60),
      lists: Number(lists),
      reviews: Number(reviews),
      topGenre: genres[0]?.genre ?? null,
    },
    watching: watchingTop,
    genres: genres.slice(0, 8),
  };
}

export async function getProfileReviews(userId: string, limit = 20): Promise<ProfileReview[]> {
  const rows = await db
    .select({
      id: communityPosts.id,
      titleId: titles.id,
      titleName: titles.title,
      english: titles.englishTitle,
      cover: titles.cover,
      rateMode: communityPosts.rateMode,
      feeling: communityPosts.feeling,
      symbol: communityPosts.symbol,
      dims: communityPosts.dims,
      heading: communityPosts.heading,
      body: communityPosts.body,
      spoiler: communityPosts.spoiler,
      likeCount: communityPosts.likeCount,
      createdAt: communityPosts.createdAt,
    })
    .from(communityPosts)
    .leftJoin(titles, eq(communityPosts.titleId, titles.id))
    .where(and(eq(communityPosts.userId, userId), eq(communityPosts.kind, "review")))
    .orderBy(desc(communityPosts.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    titleId: r.titleId,
    titleName: r.titleId ? r.english || r.titleName : null,
    cover: hiResCover(r.cover),
    rateMode: r.rateMode || "glyphs",
    feeling: r.feeling,
    symbol: (r.symbol as { style: string; value: number } | null) ?? null,
    dims: (r.dims as Record<string, number>) ?? {},
    heading: r.heading,
    body: r.body,
    spoiler: r.spoiler,
    likeCount: r.likeCount,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Merged recent activity: community posts + journal notes, newest first. */
export async function getProfileActivity(userId: string, limit = 10): Promise<ActivityItem[]> {
  const posts = await db
    .select({
      id: communityPosts.id,
      kind: communityPosts.kind,
      episode: communityPosts.episode,
      heading: communityPosts.heading,
      title: titles.title,
      english: titles.englishTitle,
      createdAt: communityPosts.createdAt,
    })
    .from(communityPosts)
    .leftJoin(titles, eq(communityPosts.titleId, titles.id))
    .where(eq(communityPosts.userId, userId))
    .orderBy(desc(communityPosts.createdAt))
    .limit(limit);

  const notes = await db
    .select({
      id: journalEntries.id,
      isTake: journalEntries.isTake,
      episode: journalEntries.episode,
      heading: journalEntries.heading,
      title: titles.title,
      english: titles.englishTitle,
      createdAt: journalEntries.createdAt,
    })
    .from(journalEntries)
    .leftJoin(titles, eq(journalEntries.titleId, titles.id))
    .where(eq(journalEntries.userId, userId))
    .orderBy(desc(journalEntries.createdAt))
    .limit(limit);

  const comps = await db
    .select({ titleId: titles.id, title: titles.title, english: titles.englishTitle, createdAt: completions.createdAt })
    .from(completions)
    .innerJoin(titles, eq(completions.titleId, titles.id))
    .where(eq(completions.userId, userId))
    .orderBy(desc(completions.createdAt))
    .limit(limit);

  const items: ActivityItem[] = [
    ...comps.map((c) => ({
      id: "c" + c.titleId,
      kind: "completed" as ActivityItem["kind"],
      titleName: c.english || c.title || null,
      episode: "",
      text: "Marked as watched",
      createdAt: c.createdAt.toISOString(),
    })),
    ...posts.map((p) => ({
      id: "p" + p.id,
      kind: (p.kind === "review" ? "review" : "discussion") as ActivityItem["kind"],
      titleName: p.english || p.title || null,
      episode: p.episode,
      text: p.heading || (p.kind === "review" ? "Posted a review" : "Started a discussion"),
      createdAt: p.createdAt.toISOString(),
    })),
    ...notes.map((n) => ({
      id: "j" + n.id,
      kind: (n.isTake ? "take" : "note") as ActivityItem["kind"],
      titleName: n.english || n.title || null,
      episode: n.episode,
      text: n.heading || (n.isTake ? "Wrote an overall take" : "Wrote a journal note"),
      createdAt: n.createdAt.toISOString(),
    })),
  ];
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}
