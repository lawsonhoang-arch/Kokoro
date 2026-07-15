import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { notifications, users, communityPosts, titles } from "@/db/schema";

export type NotificationType = "like" | "reply" | "recommend";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  read: boolean;
  at: string; // ISO
  actor: { username: string; name: string | null; image: string | null; hue: number };
  title: { id: string; name: string; cover: string | null } | null;
  href: string;
  note: string;
};

function hueOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 6) + 1;
}

// Insert or (on the same recipient+actor+type+key) refresh a notification —
// re-liking/re-replying just bumps it back to unread instead of stacking.
async function upsert(v: {
  userId: string; actorId: string; type: NotificationType; key: string;
  postId?: string | null; titleId?: string | null; note?: string;
}): Promise<void> {
  try {
    await db
      .insert(notifications)
      .values({ userId: v.userId, actorId: v.actorId, type: v.type, key: v.key, postId: v.postId ?? null, titleId: v.titleId ?? null, note: v.note ?? "", read: false })
      .onConflictDoUpdate({
        target: [notifications.userId, notifications.actorId, notifications.type, notifications.key],
        set: { read: false, createdAt: new Date(), postId: v.postId ?? null, titleId: v.titleId ?? null, note: v.note ?? "" },
      });
  } catch {
    /* table not set up yet — no-op */
  }
}

/** A like or reply on someone's post → notify its author (never yourself). */
export async function notifyPostInteraction(actorId: string, postId: string, type: "like" | "reply"): Promise<void> {
  try {
    const [post] = await db
      .select({ authorId: communityPosts.userId, titleId: communityPosts.titleId })
      .from(communityPosts)
      .where(eq(communityPosts.id, postId))
      .limit(1);
    if (!post || post.authorId === actorId) return;
    await upsert({ userId: post.authorId, actorId, type, key: postId, postId, titleId: post.titleId });
  } catch {
    /* no-op */
  }
}

/** Recommend a title to another user — lands as a notification, not a DM. */
export async function sendRecommendation(actorId: string, toUserId: string, titleId: string, note = ""): Promise<{ ok: boolean }> {
  if (!toUserId || actorId === toUserId) return { ok: false };
  await upsert({ userId: toUserId, actorId, type: "recommend", key: titleId, titleId, note: note.slice(0, 200) });
  return { ok: true };
}

type Row = {
  id: string; type: string; read: boolean; createdAt: Date; note: string;
  postId: string | null; titleId: string | null;
  aUser: string; aName: string | null; aImage: string | null;
  tEnglish: string | null; tTitle: string | null; tCover: string | null;
};

function toItem(r: Row): NotificationItem {
  const type = r.type as NotificationType;
  const title = r.titleId && (r.tEnglish || r.tTitle)
    ? { id: r.titleId, name: r.tEnglish || r.tTitle || "Untitled", cover: r.tCover }
    : null;
  const href =
    type === "recommend"
      ? (r.titleId ? `/anime/${encodeURIComponent(r.titleId)}` : "/community")
      : (r.titleId ? `/community/${encodeURIComponent(r.titleId)}` : "/community");
  return {
    id: r.id, type, read: r.read, at: r.createdAt.toISOString(), note: r.note,
    actor: { username: r.aUser, name: r.aName, image: r.aImage, hue: hueOf(r.aUser) },
    title,
    href,
  };
}

/** The user's notifications, newest first. Empty (never throws) if the table
 *  isn't set up yet. */
export async function getNotifications(userId: string, limit = 30): Promise<NotificationItem[]> {
  try {
    const rows = await db
      .select({
        id: notifications.id, type: notifications.type, read: notifications.read, createdAt: notifications.createdAt, note: notifications.note,
        postId: notifications.postId, titleId: notifications.titleId,
        aUser: users.username, aName: users.name, aImage: users.image,
        tEnglish: titles.englishTitle, tTitle: titles.title, tCover: titles.cover,
      })
      .from(notifications)
      .innerJoin(users, eq(users.id, notifications.actorId))
      .leftJoin(titles, eq(titles.id, notifications.titleId))
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
    return rows.map((r) => toItem(r as Row));
  } catch {
    return [];
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

export async function markAllRead(userId: string): Promise<void> {
  try {
    await db.update(notifications).set({ read: true }).where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  } catch {
    /* no-op */
  }
}
