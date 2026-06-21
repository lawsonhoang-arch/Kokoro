"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import * as wl from "@/lib/watchlists";
import { addEntry, updateEntry, removeEntry, reorderEntries, type EntryPatch } from "@/lib/entries";
import { syncGroups, type GroupInput } from "@/lib/groups";
import type { Watchlist } from "@/lib/storage";
import type { HueKey } from "@/lib/palette";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

// ---- entries (titles inside a watchlist) ----------------------------------

/** Lists for the search overlay's "add to" picker. */
export async function getMyWatchlistsAction(): Promise<{ id: string; title: string }[]> {
  const userId = await requireUserId();
  const lists = await wl.getWatchlists(userId);
  return lists.map((l) => ({ id: l.id, title: l.title }));
}

export async function addAnimeToWatchlistAction(
  watchlistId: string,
  titleId: string,
): Promise<{ ok: boolean; reason?: "duplicate" | "forbidden" | "notfound" }> {
  const userId = await requireUserId();
  const res = await addEntry(userId, watchlistId, titleId);
  if (res.ok) {
    revalidatePath("/watchlist");
    revalidatePath(`/watchlist/${watchlistId}`);
    return { ok: true };
  }
  return { ok: false, reason: res.reason };
}

export async function updateEntryAction(entryId: string, patch: EntryPatch): Promise<void> {
  const userId = await requireUserId();
  await updateEntry(userId, entryId, patch);
}

export async function removeEntryAction(entryId: string): Promise<void> {
  const userId = await requireUserId();
  await removeEntry(userId, entryId);
}

/** Persist a manual drag-reorder of a list's entries. */
export async function reorderEntriesAction(watchlistId: string, orderedIds: string[]): Promise<void> {
  const userId = await requireUserId();
  await reorderEntries(userId, watchlistId, orderedIds);
}

/** Persist the watchlist's collections (tabs) + their membership. */
export async function syncGroupsAction(watchlistId: string, groups: GroupInput[]): Promise<void> {
  const userId = await requireUserId();
  await syncGroups(userId, watchlistId, groups);
}

/** Add a shared custom rating axis to a list. Returns the resulting axis list
 *  (or null if rejected: empty / duplicate / reserved / limit). */
export async function addCustomAxisAction(listId: string, name: string): Promise<string[] | null> {
  const userId = await requireUserId();
  return wl.addCustomAxis(userId, listId, name);
}

/** Remove a shared custom rating axis from a list. Returns the resulting list. */
export async function removeCustomAxisAction(listId: string, name: string): Promise<string[]> {
  const userId = await requireUserId();
  return wl.removeCustomAxis(userId, listId, name);
}

export async function createWatchlistAction(input: {
  title: string;
  desc: string;
  hue: HueKey;
}): Promise<Watchlist> {
  const userId = await requireUserId();
  const created = await wl.createWatchlist(userId, {
    title: input.title.trim().slice(0, 60) || "Untitled",
    desc: input.desc.trim(),
    hue: input.hue,
  });
  revalidatePath("/watchlist");
  return created;
}

export async function togglePinAction(id: string): Promise<void> {
  const userId = await requireUserId();
  await wl.togglePin(userId, id);
  revalidatePath("/watchlist");
}

export async function setHueAction(id: string, hue: HueKey): Promise<void> {
  const userId = await requireUserId();
  await wl.setHue(userId, id, hue);
  revalidatePath("/watchlist");
}

export async function deleteWatchlistAction(id: string): Promise<void> {
  const userId = await requireUserId();
  await wl.deleteWatchlist(userId, id);
  revalidatePath("/watchlist");
}
