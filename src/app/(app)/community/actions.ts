"use server";

import { auth } from "@/auth";
import {
  createPost,
  toggleLike,
  addReply,
  getReplies,
  getHomeFeed,
  getTitleFeed,
  deletePost,
  deleteReply,
  recentPostCount,
  recentReplyCount,
  type CommunityPost,
  type CommunityReply,
  type PostKind,
  type FeedSort,
  type FeedPage,
  type SymbolRating,
} from "@/lib/community";
import { searchCatalog } from "@/lib/catalog";
import type { SearchResult } from "@/features/search/types";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

// Anti-spam: cap how many posts/replies a single user can fire in a window.
const POST_LIMIT = 12; // posts per minute
const REPLY_LIMIT = 30; // replies per minute (lighter than posts)
const WINDOW = 60;

// Returned (not thrown) so the reason reliably crosses the server-action
// boundary to the client (thrown error messages get redacted).
export type CreatePostResult =
  | { ok: true; post: CommunityPost }
  | { ok: false; reason: "empty" | "needs_title" | "rate_limit" };

export type RawPost = {
  titleId?: string | null;
  kind?: string;
  episode?: string;
  heading?: string;
  body?: string;
  rateMode?: string;
  feeling?: string | null;
  symbol?: { style?: string; value?: number } | null;
  dims?: Record<string, number> | null;
  spoiler?: boolean;
};

const RATE_MODES = ["glyphs", "axes", "symbols"];
const SYMBOL_STYLES = ["stars", "grades", "emoji"];
const FEELINGS = ["loved", "liked", "mixed", "dropped"];
const AXES = ["story", "art", "music", "pacing"];
const clamp5 = (n: unknown) => Math.min(5, Math.max(0, Math.round(Number(n) || 0)));

function cleanSymbol(s: RawPost["symbol"]): SymbolRating | null {
  if (!s || typeof s !== "object") return null;
  const value = clamp5(s.value);
  if (value <= 0) return null;
  return { style: SYMBOL_STYLES.includes(s.style ?? "") ? s.style! : "stars", value };
}
function cleanDims(d: RawPost["dims"]): Record<string, number> {
  const out: Record<string, number> = { story: 0, art: 0, music: 0, pacing: 0 };
  if (d && typeof d === "object") for (const k of AXES) out[k] = clamp5(d[k]);
  return out;
}
const cleanEpisode = (s: unknown): string => {
  const m = String(s ?? "").match(/\d{1,4}/);
  return m ? `EP ${parseInt(m[0], 10)}` : "";
};

/** Create a community post. Returns a result describing success or why not. */
export async function createPostAction(raw: RawPost): Promise<CreatePostResult> {
  const userId = await requireUserId();
  const kind: PostKind = raw.kind === "review" ? "review" : "discussion";
  const heading = (raw.heading ?? "").trim().slice(0, 160);
  const body = (raw.body ?? "").trim().slice(0, 6000);
  if (!heading && !body) return { ok: false, reason: "empty" };
  // a review must be tied to a specific anime
  if (kind === "review" && !raw.titleId) return { ok: false, reason: "needs_title" };
  // rate-limit check fails open: a transient DB hiccup shouldn't block legit posts
  const recent = await recentPostCount(userId, WINDOW).catch(() => 0);
  if (recent >= POST_LIMIT) return { ok: false, reason: "rate_limit" };
  const rateMode = RATE_MODES.includes(raw.rateMode ?? "") ? raw.rateMode! : "glyphs";
  const post = await createPost(userId, {
    titleId: raw.titleId || null,
    kind,
    episode: cleanEpisode(raw.episode),
    heading,
    body,
    rateMode,
    feeling: FEELINGS.includes(raw.feeling ?? "") ? raw.feeling! : null,
    symbol: cleanSymbol(raw.symbol),
    dims: cleanDims(raw.dims),
    spoiler: !!raw.spoiler,
  });
  return { ok: true, post };
}

export async function toggleLikeAction(postId: string): Promise<{ liked: boolean; likeCount: number }> {
  const userId = await requireUserId();
  return toggleLike(userId, postId);
}

export async function deletePostAction(postId: string): Promise<void> {
  const userId = await requireUserId();
  await deletePost(userId, postId);
}

export async function deleteReplyAction(replyId: string): Promise<void> {
  const userId = await requireUserId();
  await deleteReply(userId, replyId);
}

export async function getRepliesAction(postId: string): Promise<CommunityReply[]> {
  const session = await auth();
  return getReplies(postId, session?.user?.id);
}

export type AddReplyResult = { ok: true; reply: CommunityReply } | { ok: false; reason: "empty" | "rate_limit" };

export async function addReplyAction(postId: string, body: string): Promise<AddReplyResult> {
  const userId = await requireUserId();
  const clean = body.trim().slice(0, 4000);
  if (!clean) return { ok: false, reason: "empty" };
  // fail open on a transient DB error (the check is a safeguard, not security)
  const recent = await recentReplyCount(userId, WINDOW).catch(() => 0);
  if (recent >= REPLY_LIMIT) return { ok: false, reason: "rate_limit" };
  const reply = await addReply(userId, postId, clean);
  return { ok: true, reply };
}

/** Fetch a page of the home feed (sort + optional kind filter + cursor). */
export async function getHomeFeedAction(
  sort: FeedSort,
  kind: PostKind | null,
  cursor: string | null = null,
): Promise<FeedPage> {
  const session = await auth();
  return getHomeFeed(session?.user?.id, { sort, kind: kind ?? undefined, cursor });
}

/** Fetch a page of a title's feed (filters + sort + cursor). */
export async function getTitleFeedAction(
  titleId: string,
  kind: PostKind | null,
  episode: string | null,
  sort: FeedSort = "latest",
  cursor: string | null = null,
): Promise<FeedPage> {
  const session = await auth();
  return getTitleFeed(titleId, {
    kind: kind ?? undefined,
    episode: episode ?? undefined,
    sort,
    cursor,
    viewerId: session?.user?.id,
  });
}

/** Search the catalog to find a title's community to open. */
export async function searchCommunityAction(query: string): Promise<SearchResult[]> {
  try {
    return await searchCatalog(query);
  } catch {
    return [];
  }
}
