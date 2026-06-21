import "server-only";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { db } from "@/db";
import { communityPosts, communityLikes, communityReplies, titles, users } from "@/db/schema";
import { hiResCover } from "@/lib/cover";

// Public aggregates (trending, per-title pulse + episode counts) are identical
// for every viewer, so they're cached on a short TTL. Under heavy write load,
// TTL caching keeps the hit-rate high (vs. invalidating on every single post).
const AGG_TTL = 60; // seconds

export type PostKind = "discussion" | "review";

export type Author = { id: string; name: string; username: string; avatarHue: number };

export type SymbolRating = { style: string; value: number };
export type Rating = {
  rateMode: string; // glyphs | axes | symbols
  feeling: string | null;
  symbol: SymbolRating | null;
  dims: Record<string, number>;
};

export type CommunityPost = {
  id: string;
  kind: PostKind;
  episode: string;
  heading: string;
  body: string;
  rateMode: string;
  feeling: string | null;
  symbol: SymbolRating | null;
  dims: Record<string, number>;
  spoiler: boolean;
  likeCount: number;
  replyCount: number;
  liked: boolean;
  mine: boolean; // viewer is the author (drives the delete control)
  createdAt: string; // ISO
  author: Author;
  title: { id: string; name: string; cover: string | null } | null;
};

export type CommunityReply = {
  id: string;
  body: string;
  createdAt: string;
  author: Author;
  mine: boolean;
};

export type TrendingTitle = {
  id: string;
  name: string;
  cover: string | null;
  postCount: number;
};

export type PostInput = {
  titleId: string | null;
  kind: PostKind;
  episode: string;
  heading: string;
  body: string;
  rateMode: string;
  feeling: string | null;
  symbol: SymbolRating | null;
  dims: Record<string, number>;
  spoiler: boolean;
};

// Stable 1–6 avatar hue from a user id (matches .avatar--h{n}).
function hueOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 6) + 1;
}

const POST_COLS = {
  id: communityPosts.id,
  kind: communityPosts.kind,
  episode: communityPosts.episode,
  heading: communityPosts.heading,
  body: communityPosts.body,
  rateMode: communityPosts.rateMode,
  feeling: communityPosts.feeling,
  symbol: communityPosts.symbol,
  dims: communityPosts.dims,
  spoiler: communityPosts.spoiler,
  likeCount: communityPosts.likeCount,
  replyCount: communityPosts.replyCount,
  createdAt: communityPosts.createdAt,
  authorId: users.id,
  authorName: users.name,
  authorUsername: users.username,
  titleId: titles.id,
  titleName: titles.title,
  titleEnglish: titles.englishTitle,
  cover: titles.cover,
};

type PostRow = {
  id: string;
  kind: string;
  episode: string;
  heading: string;
  body: string;
  rateMode: string;
  feeling: string | null;
  symbol: unknown;
  dims: unknown;
  spoiler: boolean;
  likeCount: number;
  replyCount: number;
  createdAt: Date;
  authorId: string;
  authorName: string | null;
  authorUsername: string;
  titleId: string | null;
  titleName: string | null;
  titleEnglish: string | null;
  cover: string | null;
  liked?: number | string | boolean | null;
};

const DEFAULT_DIMS = { story: 0, art: 0, music: 0, pacing: 0 };

function toPost(r: PostRow, viewerId?: string): CommunityPost {
  return {
    id: r.id,
    kind: (r.kind as PostKind) ?? "discussion",
    episode: r.episode,
    heading: r.heading,
    body: r.body,
    rateMode: r.rateMode || "glyphs",
    feeling: r.feeling,
    symbol: (r.symbol as SymbolRating | null) ?? null,
    dims: (r.dims as Record<string, number>) ?? { ...DEFAULT_DIMS },
    spoiler: r.spoiler,
    likeCount: r.likeCount,
    replyCount: r.replyCount,
    liked: !!r.liked,
    mine: !!viewerId && r.authorId === viewerId,
    createdAt: r.createdAt.toISOString(),
    author: {
      id: r.authorId,
      name: r.authorName || "@" + r.authorUsername,
      username: r.authorUsername,
      avatarHue: hueOf(r.authorId),
    },
    title: r.titleId
      ? { id: r.titleId, name: r.titleEnglish || r.titleName || "Untitled", cover: hiResCover(r.cover) }
      : null,
  };
}

export type FeedSort = "latest" | "top" | "discussed";

/** One page of feed posts. `nextCursor` is the id to pass back for the next
 *  page (null = no more). */
export type FeedPage = { posts: CommunityPost[]; nextCursor: string | null };

const PAGE_SIZE = 20;

// Order including a stable `id` tiebreaker so keyset pagination is deterministic.
function sortOrder(sort: FeedSort) {
  if (sort === "top")
    return [desc(communityPosts.likeCount), desc(communityPosts.createdAt), desc(communityPosts.id)];
  if (sort === "discussed")
    return [desc(communityPosts.replyCount), desc(communityPosts.createdAt), desc(communityPosts.id)];
  return [desc(communityPosts.createdAt), desc(communityPosts.id)];
}

// Keyset condition: rows that come AFTER the cursor post in the sort order. The
// cursor's sort values are looked up by id in SQL (a row-value comparison), so
// no timestamp is serialized through JS — same robustness lesson as the rate
// limit. A bad/missing cursor id makes the subqueries NULL → empty page.
function cursorCond(sort: FeedSort, cursorId: string) {
  const created = sql`(select created_at from ${communityPosts} where id = ${cursorId}::uuid)`;
  const idVal = sql`${cursorId}::uuid`;
  if (sort === "top") {
    const lk = sql`(select like_count from ${communityPosts} where id = ${cursorId}::uuid)`;
    return sql`(${communityPosts.likeCount}, ${communityPosts.createdAt}, ${communityPosts.id}) < (${lk}, ${created}, ${idVal})`;
  }
  if (sort === "discussed") {
    const rp = sql`(select reply_count from ${communityPosts} where id = ${cursorId}::uuid)`;
    return sql`(${communityPosts.replyCount}, ${communityPosts.createdAt}, ${communityPosts.id}) < (${rp}, ${created}, ${idVal})`;
  }
  return sql`(${communityPosts.createdAt}, ${communityPosts.id}) < (${created}, ${idVal})`;
}

async function fetchPage(conds: SQL[], sort: FeedSort, viewerId?: string): Promise<FeedPage> {
  // `liked` via a LEFT JOIN scoped to the viewer's own like (PK = post_id+user_id,
  // so ≤1 match per post → no row duplication). One join instead of a correlated
  // subquery per row. When there's no viewer, join on `false` so nothing matches.
  const likeJoin = viewerId
    ? and(eq(communityLikes.postId, communityPosts.id), eq(communityLikes.userId, viewerId))
    : sql`false`;
  const rows = await db
    .select({ ...POST_COLS, liked: communityLikes.userId })
    .from(communityPosts)
    .innerJoin(users, eq(communityPosts.userId, users.id))
    .leftJoin(titles, eq(communityPosts.titleId, titles.id))
    .leftJoin(communityLikes, likeJoin)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(...sortOrder(sort))
    .limit(PAGE_SIZE + 1); // +1 sentinel to know if there's another page
  const hasMore = rows.length > PAGE_SIZE;
  const posts = rows.slice(0, PAGE_SIZE).map((r) => toPost(r as PostRow, viewerId));
  return { posts, nextCursor: hasMore ? posts[posts.length - 1].id : null };
}

/** A page of recent posts across every title — the community home feed. */
export async function getHomeFeed(
  viewerId?: string,
  opts: { sort?: FeedSort; kind?: PostKind; cursor?: string | null } = {},
): Promise<FeedPage> {
  const sort = opts.sort ?? "latest";
  const conds: SQL[] = [];
  if (opts.kind) conds.push(eq(communityPosts.kind, opts.kind));
  if (opts.cursor) conds.push(cursorCond(sort, opts.cursor));
  return fetchPage(conds, sort, viewerId);
}

/** A page of posts for one title's community, optionally filtered. */
export async function getTitleFeed(
  titleId: string,
  opts: { kind?: PostKind; episode?: string; viewerId?: string; sort?: FeedSort; cursor?: string | null } = {},
): Promise<FeedPage> {
  const sort = opts.sort ?? "latest";
  const conds: SQL[] = [eq(communityPosts.titleId, titleId)];
  if (opts.kind) conds.push(eq(communityPosts.kind, opts.kind));
  if (opts.episode) conds.push(eq(communityPosts.episode, opts.episode));
  if (opts.cursor) conds.push(cursorCond(sort, opts.cursor));
  return fetchPage(conds, sort, opts.viewerId);
}

/** Normalize any review's rating to a 0–5 score (or null if unrated). */
export function reviewScore(p: Pick<CommunityPost, "rateMode" | "feeling" | "symbol" | "dims">): number | null {
  if (p.rateMode === "symbols") return p.symbol && p.symbol.value > 0 ? p.symbol.value : null;
  if (p.rateMode === "axes") {
    const vals = ["story", "art", "music", "pacing"].map((k) => p.dims?.[k] ?? 0).filter((v) => v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  // glyphs: feeling → score (loved 5 · liked 4 · mixed 2.5 · dropped 1)
  const map: Record<string, number> = { loved: 5, liked: 4, mixed: 2.5, dropped: 1 };
  return p.feeling ? map[p.feeling] ?? null : null;
}

export type TitlePulse = {
  reviews: number;
  discussions: number;
  avgScore: number | null;
  mood: { loved: number; liked: number; mixed: number; dropped: number };
};

/** Aggregate a title's community: review/discussion counts, average score, and
 *  a "mood" breakdown (every rated review bucketed into a feeling). Unique to
 *  Kokoro — it turns the catalog's rating systems into a community sentiment.
 *
 *  Done as ONE server-side aggregation (not by loading every post into JS), so a
 *  title with 100k+ posts still returns a single row. Cached per title. */
async function computeTitlePulse(titleId: string): Promise<TitlePulse> {
  // per-review score normalized to 0–5 across all three rating systems
  const score = sql`
    case
      when rate_mode = 'symbols' then nullif(symbol->>'value','')::numeric
      when rate_mode = 'axes' then
        nullif(
          coalesce(nullif(dims->>'story','')::numeric,0) + coalesce(nullif(dims->>'art','')::numeric,0)
          + coalesce(nullif(dims->>'music','')::numeric,0) + coalesce(nullif(dims->>'pacing','')::numeric,0), 0)
        / nullif(
          (case when coalesce(nullif(dims->>'story','')::numeric,0) > 0 then 1 else 0 end)
          + (case when coalesce(nullif(dims->>'art','')::numeric,0) > 0 then 1 else 0 end)
          + (case when coalesce(nullif(dims->>'music','')::numeric,0) > 0 then 1 else 0 end)
          + (case when coalesce(nullif(dims->>'pacing','')::numeric,0) > 0 then 1 else 0 end), 0)
      when feeling = 'loved' then 5 when feeling = 'liked' then 4
      when feeling = 'mixed' then 2.5 when feeling = 'dropped' then 1
      else null
    end`;
  const result = await db.execute(sql`
    select
      count(*) filter (where kind = 'review')::int as reviews,
      count(*) filter (where kind <> 'review')::int as discussions,
      avg(score) as avg_score,
      count(*) filter (where score >= 4.5)::int as loved,
      count(*) filter (where score >= 3.5 and score < 4.5)::int as liked,
      count(*) filter (where score >= 2.5 and score < 3.5)::int as mixed,
      count(*) filter (where score is not null and score < 2.5)::int as dropped
    from (
      select kind, case when kind = 'review' then (${score}) else null end as score
      from community_posts
      where title_id = ${titleId}
    ) s`);
  const row = (result as unknown as Record<string, unknown>[])[0] ?? {};
  const num = (v: unknown) => (v == null ? 0 : Number(v));
  return {
    reviews: num(row.reviews),
    discussions: num(row.discussions),
    avgScore: row.avg_score == null ? null : Number(row.avg_score),
    mood: { loved: num(row.loved), liked: num(row.liked), mixed: num(row.mixed), dropped: num(row.dropped) },
  };
}
export function getTitlePulse(titleId: string): Promise<TitlePulse> {
  return unstable_cache(() => computeTitlePulse(titleId), ["community-pulse", titleId], {
    revalidate: AGG_TTL,
  })();
}

/** Per-episode post counts for a title (powers the episode grid). Cached per
 *  title (not user-specific); invalidated when that title gets a new post. */
async function computeEpisodeCounts(titleId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ episode: communityPosts.episode, n: sql<number>`count(*)::int` })
    .from(communityPosts)
    .where(and(eq(communityPosts.titleId, titleId), sql`${communityPosts.episode} <> ''`))
    .groupBy(communityPosts.episode);
  const out: Record<string, number> = {};
  for (const r of rows) out[r.episode] = Number(r.n);
  return out;
}
export function getEpisodeCounts(titleId: string): Promise<Record<string, number>> {
  return unstable_cache(() => computeEpisodeCounts(titleId), ["community-epcounts", titleId], {
    revalidate: AGG_TTL,
  })();
}

/** Titles ranked by recent post activity — the trending rail. Identical for
 *  every viewer, so it's cached on a short TTL (a full-table aggregation we
 *  must not run on every home-page view under load). */
async function computeTrending(limit: number): Promise<TrendingTitle[]> {
  const rows = await db
    .select({
      id: titles.id,
      name: titles.title,
      english: titles.englishTitle,
      cover: titles.cover,
      postCount: sql<number>`count(${communityPosts.id})::int`,
      recent: sql<Date>`max(${communityPosts.createdAt})`,
    })
    .from(communityPosts)
    .innerJoin(titles, eq(communityPosts.titleId, titles.id))
    .groupBy(titles.id, titles.title, titles.englishTitle, titles.cover)
    .orderBy(desc(sql`count(${communityPosts.id})`), desc(sql`max(${communityPosts.createdAt})`))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    name: r.english || r.name,
    cover: hiResCover(r.cover),
    postCount: Number(r.postCount),
  }));
}
export const getTrending = unstable_cache(
  (limit = 8) => computeTrending(limit),
  ["community-trending"],
  { revalidate: AGG_TTL },
);

export async function createPost(userId: string, input: PostInput): Promise<CommunityPost> {
  const isReview = input.kind === "review";
  const [row] = await db
    .insert(communityPosts)
    .values({
      userId,
      titleId: input.titleId,
      kind: input.kind,
      episode: input.episode,
      heading: input.heading,
      body: input.body,
      rateMode: isReview ? input.rateMode : "glyphs",
      feeling: isReview ? input.feeling : null,
      symbol: isReview ? input.symbol : null,
      dims: isReview ? input.dims : { ...DEFAULT_DIMS },
      spoiler: input.spoiler,
    })
    .returning({ id: communityPosts.id });
  const [post] = await db
    .select({ ...POST_COLS, liked: sql<number>`null` })
    .from(communityPosts)
    .innerJoin(users, eq(communityPosts.userId, users.id))
    .leftJoin(titles, eq(communityPosts.titleId, titles.id))
    .where(eq(communityPosts.id, row.id))
    .limit(1);
  return toPost(post as PostRow, userId);
}

/** Delete a post the user authored (replies/likes cascade). Returns the deleted
 *  post's titleId (for cache invalidation), or null if nothing was deleted. */
export async function deletePost(userId: string, postId: string): Promise<string | null> {
  const [row] = await db
    .delete(communityPosts)
    .where(and(eq(communityPosts.id, postId), eq(communityPosts.userId, userId)))
    .returning({ titleId: communityPosts.titleId });
  return row?.titleId ?? null;
}

/** Number of posts the user has created in the last `seconds` (rate limiting).
 *  `created_at` is `timestamp without time zone`, so we compare it against
 *  `now()::timestamp` (now cast to a naive timestamp in the same session tz the
 *  column was written with) — otherwise the implicit timestamptz↔timestamp
 *  conversion skews every row by the UTC offset and the window matches nothing. */
export async function recentPostCount(userId: string, seconds: number): Promise<number> {
  // Burst counter: how many of the user's posts fall within `seconds` of their
  // MOST RECENT post. Anchored on stored created_at values (same basis on both
  // sides) — NOT now() — because the transaction pooler routes requests to
  // different backends whose now() clocks can differ by tens of seconds, which
  // erratically shrinks a now()-based window. The interval is a literal (built
  // from the trusted integer `seconds`), since a parameterized interval bound to
  // NULL was silently matching no rows.
  const secs = Math.max(1, Math.floor(seconds));
  const window = sql.raw(`interval '${secs} seconds'`);
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(communityPosts)
    .where(
      and(
        eq(communityPosts.userId, userId),
        sql`${communityPosts.createdAt} > (select max(c2.created_at) from community_posts c2 where c2.user_id = ${userId}) - ${window}`,
      ),
    );
  return Number(rows[0]?.n ?? 0);
}

/** Replies the user has created within `seconds` of their most recent reply
 *  (rate limiting). Same now()-free, literal-interval pattern as recentPostCount. */
export async function recentReplyCount(userId: string, seconds: number): Promise<number> {
  const window = sql.raw(`interval '${Math.max(1, Math.floor(seconds))} seconds'`);
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(communityReplies)
    .where(
      and(
        eq(communityReplies.userId, userId),
        sql`${communityReplies.createdAt} > (select max(c2.created_at) from community_replies c2 where c2.user_id = ${userId}) - ${window}`,
      ),
    );
  return Number(rows[0]?.n ?? 0);
}

/** Delete a reply the user authored, decrementing the post's reply count. */
export async function deleteReply(userId: string, replyId: string): Promise<void> {
  const [r] = await db
    .select({ postId: communityReplies.postId })
    .from(communityReplies)
    .where(and(eq(communityReplies.id, replyId), eq(communityReplies.userId, userId)))
    .limit(1);
  if (!r) return;
  await db.delete(communityReplies).where(eq(communityReplies.id, replyId));
  await db
    .update(communityPosts)
    .set({ replyCount: sql`greatest(${communityPosts.replyCount} - 1, 0)` })
    .where(eq(communityPosts.id, r.postId));
}

/** Toggle the viewer's like on a post; returns the new state + count. */
export async function toggleLike(userId: string, postId: string): Promise<{ liked: boolean; likeCount: number }> {
  const existing = await db
    .select({ postId: communityLikes.postId })
    .from(communityLikes)
    .where(and(eq(communityLikes.postId, postId), eq(communityLikes.userId, userId)))
    .limit(1);
  if (existing.length) {
    await db.delete(communityLikes).where(and(eq(communityLikes.postId, postId), eq(communityLikes.userId, userId)));
    await db
      .update(communityPosts)
      .set({ likeCount: sql`greatest(${communityPosts.likeCount} - 1, 0)` })
      .where(eq(communityPosts.id, postId));
  } else {
    await db.insert(communityLikes).values({ postId, userId }).onConflictDoNothing();
    await db
      .update(communityPosts)
      .set({ likeCount: sql`${communityPosts.likeCount} + 1` })
      .where(eq(communityPosts.id, postId));
  }
  const [row] = await db
    .select({ likeCount: communityPosts.likeCount })
    .from(communityPosts)
    .where(eq(communityPosts.id, postId))
    .limit(1);
  return { liked: !existing.length, likeCount: row?.likeCount ?? 0 };
}

export async function getReplies(postId: string, viewerId?: string): Promise<CommunityReply[]> {
  const rows = await db
    .select({
      id: communityReplies.id,
      body: communityReplies.body,
      createdAt: communityReplies.createdAt,
      authorId: users.id,
      authorName: users.name,
      authorUsername: users.username,
    })
    .from(communityReplies)
    .innerJoin(users, eq(communityReplies.userId, users.id))
    .where(eq(communityReplies.postId, postId))
    .orderBy(communityReplies.createdAt);
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    author: { id: r.authorId, name: r.authorName || "@" + r.authorUsername, username: r.authorUsername, avatarHue: hueOf(r.authorId) },
    mine: !!viewerId && r.authorId === viewerId,
  }));
}

export async function addReply(userId: string, postId: string, body: string): Promise<CommunityReply> {
  const [row] = await db
    .insert(communityReplies)
    .values({ postId, userId, body })
    .returning({ id: communityReplies.id, createdAt: communityReplies.createdAt });
  await db
    .update(communityPosts)
    .set({ replyCount: sql`${communityPosts.replyCount} + 1` })
    .where(eq(communityPosts.id, postId));
  const [u] = await db
    .select({ id: users.id, name: users.name, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return {
    id: row.id,
    body,
    createdAt: row.createdAt.toISOString(),
    author: { id: u.id, name: u.name || "@" + u.username, username: u.username, avatarHue: hueOf(u.id) },
    mine: true,
  };
}
