"use server";

import { auth } from "@/auth";
import { searchUsers } from "@/lib/discover";
import { getTasteAffinityBulk, type MatchLite } from "@/lib/affinity";
import type { UserLite } from "@/lib/follows";

export type UserSearchResult = { list: UserLite[]; matches: Record<string, MatchLite> };

/** Search users by handle/name, annotated with the viewer's taste match. */
export async function searchUsersAction(query: string): Promise<UserSearchResult> {
  const session = await auth();
  const viewerId = session?.user?.id;
  const list = await searchUsers(query, viewerId, 15);
  const matches: Record<string, MatchLite> = {};
  if (viewerId && list.length) {
    const m = await getTasteAffinityBulk(viewerId, list.map((u) => u.id));
    for (const [id, v] of m) matches[id] = v;
  }
  return { list, matches };
}
