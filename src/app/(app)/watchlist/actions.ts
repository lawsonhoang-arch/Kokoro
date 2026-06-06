"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import * as wl from "@/lib/watchlists";
import { addEntry, updateEntry, removeEntry, type EntryPatch } from "@/lib/entries";
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
