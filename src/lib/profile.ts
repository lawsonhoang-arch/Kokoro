import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { db } from "@/db";
import { users, watchlists, watchlistEntries, titles, communityPosts, completions } from "@/db/schema";
import { hiResCover } from "@/lib/cover";
import { getRewatchTotal } from "@/lib/rewatches";

export type ProfileUser = {
  id: string;
  name: string | null;
  username: string;
  email: string;
  role: string;
  bio: string;
  createdAt: string; // ISO
  image: string | null; // chosen avatar image URL (character art) or null → hue circle
  bannerTitleId: string | null;
  bannerArt: string | null; // resolved art for the chosen banner title (or null)
  bannerPos: string | null; // background-position "x% y%" for the banner art
};

// A title the user can pick as their profile banner (has wide art or a cover).
export type BannerCandidate = { id: string; title: string; kind: string; art: string };

// A title the user can pull a character avatar from (has a MAL id for the Jikan lookup).
export type AvatarTitle = { id: string; title: string; cover: string | null; kind: string };
export type Character = { name: string; image: string; role: string };

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

// per-medium slice: `units` = episodes (anime) or chapters (manga)
export type MediumStats = {
  tracked: number;
  completed: number;
  watching: number;
  planned: number;
  units: number;
  hours: number;
};

export type ProfileStats = {
  tracked: number;
  completed: number;
  watching: number;
  planned: number;
  episodesWatched: number;
  chaptersRead: number;
  mangaCompleted: number;
  hours: number;
  lists: number;
  reviews: number;
  rewatches: number; // total rewatch/reread passes logged
  topGenre: string | null;
  genresDistinct: number; // count of distinct genres across tracked titles (badges)
  // breakdown for the Both / Anime / Manga toggle on the profile
  anime: MediumStats;
  manga: MediumStats;
};

// A "record" card on the profile: the title that best exemplifies some superlative.
export type Superlative = {
  key: string; // top | longest | deepest | boldest
  label: string;
  titleId: string;
  title: string;
  cover: string | null;
  value: string; // the record itself, pre-formatted (e.g. "★ 5.0", "1,096 eps")
};

export type ProfileSummary = {
  stats: ProfileStats;
  watching: ProfileTitle[];
  genres: GenreCount[];
  superlatives: Superlative[];
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

/** Resolve a public handle to a user id (for /u/[username] pages). */
export async function getUserIdByUsername(username: string): Promise<string | null> {
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.username, username.toLowerCase())).limit(1);
  return u?.id ?? null;
}

export async function getProfileUser(userId: string): Promise<ProfileUser | null> {
  const base = {
    id: users.id, name: users.name, username: users.username,
    email: users.email, role: users.role, bio: users.bio, createdAt: users.createdAt,
    image: users.image,
  };
  try {
    const [u] = await db
      .select({ ...base, bannerTitleId: users.bannerTitleId, bannerPos: users.bannerPos, banner: titles.banner, cover: titles.cover })
      .from(users)
      .leftJoin(titles, eq(titles.id, users.bannerTitleId))
      .where(eq(users.id, userId))
      .limit(1);
    if (!u) return null;
    // prefer wide banner art; '' means "checked, none available" → fall back to cover
    const bannerArt = u.banner || hiResCover(u.cover) || null;
    return {
      id: u.id, name: u.name, username: u.username, email: u.email, role: u.role,
      bio: u.bio, createdAt: u.createdAt.toISOString(), image: u.image,
      bannerTitleId: u.bannerTitleId, bannerArt, bannerPos: u.bannerPos,
    };
  } catch {
    // banner columns not migrated yet — serve the profile without a banner
    const [u] = await db.select(base).from(users).where(eq(users.id, userId)).limit(1);
    if (!u) return null;
    return { ...u, createdAt: u.createdAt.toISOString(), bannerTitleId: null, bannerArt: null, bannerPos: null };
  }
}

/** Titles the user tracks/favorites/finished that have art, offered as banner
 *  choices. Wide AniList banner art is preferred; falls back to the cover. */
export async function getBannerCandidates(userId: string): Promise<BannerCandidate[]> {
  const rows = await db.execute(sql`
    select t.id,
           coalesce(nullif(t.english_title, ''), t.title) as title,
           t.kind, t.banner, t.cover
    from titles t
    where t.id in (
      select e.title_id from watchlist_entries e
        join watchlists w on w.id = e.watchlist_id where w.user_id = ${userId}
      union select f.title_id from favorites f where f.user_id = ${userId}
      union select c.title_id from completions c where c.user_id = ${userId}
    )
    and ((t.banner is not null and t.banner <> '') or t.cover is not null)
    order by title
    limit 120
  `);
  const out: BannerCandidate[] = [];
  for (const r of rows as unknown as { id: string; title: string; kind: string; banner: string | null; cover: string | null }[]) {
    const art = (r.banner && r.banner !== "" ? r.banner : hiResCover(r.cover)) || null;
    if (art) out.push({ id: r.id, title: r.title, kind: r.kind, art });
  }
  return out;
}

/** The user's library titles that have a MAL id, offered as sources for a
 *  character avatar (they pick a title, then a character from it). */
export async function getAvatarTitles(userId: string): Promise<AvatarTitle[]> {
  const rows = await db.execute(sql`
    select t.id, coalesce(nullif(t.english_title, ''), t.title) as title, t.cover, t.kind
    from titles t
    where t.id in (
      select e.title_id from watchlist_entries e
        join watchlists w on w.id = e.watchlist_id where w.user_id = ${userId}
      union select f.title_id from favorites f where f.user_id = ${userId}
      union select c.title_id from completions c where c.user_id = ${userId}
    )
    and ((t.kind = 'anime' and t.mal_id is not null) or (t.kind = 'manga' and t.id like 'mga:%'))
    order by title
    limit 100
  `);
  return (rows as unknown as { id: string; title: string; cover: string | null; kind: string }[]).map((r) => ({
    id: r.id, title: r.title, cover: hiResCover(r.cover), kind: r.kind,
  }));
}

async function fetchCharacters(titleId: string): Promise<Character[]> {
  const [t] = await db.select({ kind: titles.kind, malId: titles.malId }).from(titles).where(eq(titles.id, titleId)).limit(1);
  if (!t) return [];
  const manga = t.kind === "manga";
  const malId = manga ? parseInt(titleId.replace(/^mga:/, ""), 10) : t.malId;
  if (!malId) return [];
  try {
    const res = await fetch(`https://api.jikan.moe/v4/${manga ? "manga" : "anime"}/${malId}/characters`, {
      headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const j = (await res.json()) as { data?: { character?: { name?: string; images?: { jpg?: { image_url?: string } } }; role?: string }[] };
    const out: Character[] = [];
    for (const c of j.data ?? []) {
      const image = c.character?.images?.jpg?.image_url;
      const name = c.character?.name;
      if (image && name && !/questionmark|apple-touch/i.test(image)) out.push({ name, image, role: c.role ?? "" });
    }
    out.sort((a, b) => (a.role === "Main" ? 0 : 1) - (b.role === "Main" ? 0 : 1)); // main characters first
    return out.slice(0, 48);
  } catch {
    return [];
  }
}

/** A title's characters (name + portrait) from Jikan, cached a week. */
export function getTitleCharacters(titleId: string): Promise<Character[]> {
  return unstable_cache(() => fetchCharacters(titleId), ["title-characters", titleId], { revalidate: 604800 })();
}

/** Just the user's avatar image URL (for the nav). Defensive: null pre-migration. */
export async function getUserAvatar(userId: string): Promise<string | null> {
  try {
    const [u] = await db.select({ image: users.image }).from(users).where(eq(users.id, userId)).limit(1);
    return u?.image ?? null;
  } catch {
    return null;
  }
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
      catalogScore: titles.score, // MAL 0–10 ×100 (e.g. 870); /200 → 0–5 personal scale
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
  const rewatchTotal = await getRewatchTotal(userId);

  let completed = 0, watching = 0, planned = 0, minutes = 0, episodesWatched = 0;
  let chaptersRead = 0, mangaCompleted = 0;
  // per-medium tallies (a = anime, m = manga)
  let aTracked = 0, mTracked = 0, aWatching = 0, mWatching = 0, aPlanned = 0, mPlanned = 0;
  const genreTally: Record<string, number> = {};
  const watchingList: ProfileTitle[] = [];

  // running "record holders" for the profile superlatives
  type Rec = { titleId: string; title: string; cover: string | null; year: number | null; episodes: number; kind: string; score: number | null; catalog: number | null };
  let longest: Rec | null = null; // completed title with the most episodes/chapters
  let topRated: Rec | null = null; // highest personal score
  let deepest: Rec | null = null; // oldest title they rated highly (a classic they love)
  let boldest: { rec: Rec; gap: number } | null = null; // biggest gap vs the crowd
  const consider = (rec: Rec, completed: boolean) => {
    if (completed && rec.episodes > 0 && (!longest || rec.episodes > longest.episodes)) longest = rec;
    if (rec.score != null && (!topRated || rec.score > topRated.score!)) topRated = rec;
    if (rec.score != null && rec.score >= 4 && rec.year && (!deepest || rec.year < deepest.year!)) deepest = rec;
    if (rec.score != null && rec.catalog != null) {
      const gap = rec.score - rec.catalog / 200; // both on 0–5
      if (!boldest || Math.abs(gap) > Math.abs(boldest.gap)) boldest = { rec, gap };
    }
  };

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
    consider(
      { titleId: r.titleId, title: name, cover: hiResCover(r.cover), year: r.year, episodes: r.episodes, kind: r.kind, score, catalog: r.catalogScore },
      r.status === "completed",
    );

    // episodes watched = the explicit set, falling back to progress (or full for
    // completed) for legacy/edge entries; capped at the title's episode count.
    const we = (r.watchedEps as number[] | null) ?? [];
    const watchedCount = Math.min(
      r.episodes || Infinity,
      we.length || (r.status === "completed" ? r.episodes : r.progress ?? 0),
    );
    const isM = r.kind === "manga";
    if (isM) { chaptersRead += watchedCount; mTracked++; }
    else { episodesWatched += watchedCount; minutes += watchedCount * 24; aTracked++; }

    if (r.status === "completed") { completed++; if (isM) mangaCompleted++; }
    else if (r.status === "watching") { watching++; if (isM) mWatching++; else aWatching++; }
    else { planned++; if (isM) mPlanned++; else aPlanned++; }
    for (const g of r.genres ?? []) genreTally[g] = (genreTally[g] ?? 0) + 1;
  }

  // fold in standalone completions (marked watched without a list), skipping any
  // title already counted from a list so it's never double-counted.
  const comps = await db
    .select({ titleId: titles.id, title: titles.title, english: titles.englishTitle, cover: titles.cover, year: titles.year, episodes: titles.episodes, kind: titles.kind, genres: titles.genres })
    .from(completions)
    .innerJoin(titles, eq(completions.titleId, titles.id))
    .where(eq(completions.userId, userId));
  for (const c of comps) {
    if (seen.has(c.titleId)) continue;
    seen.add(c.titleId);
    completed++;
    // marked-watched titles are unrated, but still eligible for the "longest" record
    consider(
      { titleId: c.titleId, title: c.english || c.title, cover: hiResCover(c.cover), year: c.year, episodes: c.episodes, kind: c.kind, score: null, catalog: null },
      true,
    );
    if (c.kind === "manga") { mangaCompleted++; mTracked++; chaptersRead += c.episodes; }
    else { aTracked++; episodesWatched += c.episodes; minutes += c.episodes * 24; }
    for (const g of c.genres ?? []) genreTally[g] = (genreTally[g] ?? 0) + 1;
  }

  const genres = Object.entries(genreTally)
    .map(([genre, n]) => ({ genre, n }))
    .sort((a, b) => b.n - a.n || a.genre.localeCompare(b.genre));

  const watchingTop = watchingList
    .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
    .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))
    .slice(0, 6);

  // Assemble the superlative cards (only those with a record holder).
  const fmtScore = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1));
  const superlatives: Superlative[] = [];
  const card = (r: Rec, key: string, label: string, value: string): Superlative => ({
    key, label, titleId: r.titleId, title: r.title, cover: r.cover, value,
  });
  if (topRated) {
    const r = topRated as Rec;
    superlatives.push(card(r, "top", "Top rated", `★ ${fmtScore(r.score!)}`));
  }
  if (longest) {
    const r = longest as Rec;
    const unit = r.kind === "manga" ? "ch" : "eps";
    superlatives.push(card(r, "longest", r.kind === "manga" ? "Longest read" : "Longest finished", `${r.episodes.toLocaleString()} ${unit}`));
  }
  if (deepest) {
    const r = deepest as Rec;
    superlatives.push(card(r, "deepest", "Deepest cut", `${r.year}`));
  }
  if (boldest && Math.abs((boldest as { gap: number }).gap) >= 1) {
    const b = boldest as { rec: Rec; gap: number };
    superlatives.push(card(b.rec, "boldest", "Boldest take", `${b.gap > 0 ? "+" : "−"}${Math.abs(b.gap).toFixed(1)} vs crowd`));
  }

  return {
    stats: {
      tracked: seen.size,
      completed,
      watching,
      planned,
      episodesWatched,
      chaptersRead,
      mangaCompleted,
      hours: Math.round(minutes / 60),
      lists: Number(lists),
      reviews: Number(reviews),
      rewatches: rewatchTotal,
      topGenre: genres[0]?.genre ?? null,
      genresDistinct: Object.keys(genreTally).length,
      anime: {
        tracked: aTracked,
        completed: completed - mangaCompleted,
        watching: aWatching,
        planned: aPlanned,
        units: episodesWatched,
        hours: Math.round(minutes / 60),
      },
      manga: {
        tracked: mTracked,
        completed: mangaCompleted,
        watching: mWatching,
        planned: mPlanned,
        units: chaptersRead,
        hours: 0,
      },
    },
    watching: watchingTop,
    genres: genres.slice(0, 8),
    superlatives,
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
