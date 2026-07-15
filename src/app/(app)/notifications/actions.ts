"use server";

import { auth } from "@/auth";
import { getNotifications, getUnreadCount, markAllRead, type NotificationItem } from "@/lib/notifications";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

/** Load the bell panel's list and mark everything read in the same trip. */
export async function openNotificationsAction(): Promise<NotificationItem[]> {
  const userId = await requireUserId();
  const items = await getNotifications(userId);
  await markAllRead(userId);
  return items;
}

/** Poll just the unread badge count (cheap). */
export async function unreadCountAction(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;
  return getUnreadCount(session.user.id);
}
