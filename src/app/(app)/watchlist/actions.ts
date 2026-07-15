"use server";

import { gunzipSync } from "node:zlib";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import * as wl from "@/lib/watchlists";
import { addEntry, updateEntry, removeEntry, reorderEntries, type EntryPatch } from "@/lib/entries";
import { syncGroups, type GroupInput } from "@/lib/groups";
import { importKokoroExport, type KokoroImportResult } from "@/lib/importKokoro";
import { fetchAniList, parseMalExport, applyImport, type ImportSummary } from "@/lib/importList";
import type { Watchlist } from "@/lib/storage";
import type { HueKey } from "@/lib/palette";

type ImportResult = { ok: true; summary: ImportSummary } | { ok: false; error: string };

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

/** Import a public AniList user's anime + manga lists by username. */
export async function importAniListAction(usernameRaw: string): Promise<ImportResult> {
  const userId = await requireUserId();
  const username = usernameRaw.trim().replace(/^@/, "");
  if (!username || !/^[\w.-]{2,40}$/.test(username)) return { ok: false, error: "Enter a valid AniList username." };
  let entries;
  try {
    entries = await fetchAniList(username);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NOT_FOUND") return { ok: false, error: `No public AniList user “${username}” — check the spelling, and that the profile isn't private.` };
    return { ok: false, error: "Couldn't reach AniList right now. Please try again in a moment." };
  }
  if (entries.length === 0) return { ok: false, error: "That AniList list looks empty — nothing to import." };
  const summary = await applyImport(userId, "anilist", entries);
  revalidatePath("/watchlist");
  revalidatePath("/profile");
  return { ok: true, summary };
}

const MAX_XML = 12 * 1024 * 1024; // 12 MB

/** Import a MyAnimeList list from its exported XML file (gzipped or plain). */
export async function importMalAction(formData: FormData): Promise<ImportResult> {
  const userId = await requireUserId();
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose your MAL export file first." };
  if (file.size > MAX_XML) return { ok: false, error: "That file is too large (max 12 MB)." };

  let xml: string;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const isGzip = buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b; // MAL exports .xml.gz
    xml = (isGzip ? gunzipSync(buf) : buf).toString("utf8");
  } catch {
    return { ok: false, error: "Couldn't read that file — upload the .xml (or .xml.gz) MAL gives you." };
  }
  if (!/<myanimelist|<anime>|<manga>/i.test(xml)) {
    return { ok: false, error: "That doesn't look like a MAL export. In MAL: Profile → List → Export." };
  }
  const entries = parseMalExport(xml);
  if (entries.length === 0) return { ok: false, error: "No entries found in that export." };
  const summary = await applyImport(userId, "mal", entries);
  revalidatePath("/watchlist");
  revalidatePath("/profile");
  return { ok: true, summary };
}

const MAX_IMPORT = 6 * 1024 * 1024; // 6 MB of JSON text

/** Restore a Kokoro JSON export into new list(s). */
export async function importListFileAction(jsonText: string): Promise<KokoroImportResult> {
  const userId = await requireUserId();
  if (typeof jsonText !== "string" || jsonText.length === 0) return { ok: false, error: "Choose a Kokoro export file first." };
  if (jsonText.length > MAX_IMPORT) return { ok: false, error: "That file is too large (max 6 MB)." };
  const res = await importKokoroExport(userId, jsonText);
  if (res.ok) revalidatePath("/watchlist");
  return res;
}

export async function updateWatchlistAction(id: string, input: { title: string; desc: string }): Promise<void> {
  const userId = await requireUserId();
  await wl.updateWatchlist(userId, id, input);
  revalidatePath("/watchlist");
  revalidatePath(`/watchlist/${id}`);
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
