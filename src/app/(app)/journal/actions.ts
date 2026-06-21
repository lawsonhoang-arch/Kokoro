"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  createJournalEntry, updateJournalEntry, deleteJournalEntry, getJournalEntriesForTitle,
  addTitleTake, updateTitleTake, FEELINGS, type JournalInput, type JournalEntry,
} from "@/lib/journal";
import { searchCatalog } from "@/lib/catalog";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export type RawJournal = {
  titleId?: string | null;
  episode?: string;
  heading?: string;
  rateMode?: string;
  feeling?: string | null;
  symbol?: { style?: string; value?: number } | null;
  dims?: Record<string, number> | null;
  quote?: string;
  body?: string;
};

const RATE_MODES = ["glyphs", "axes", "symbols"];
const SYMBOL_STYLES = ["stars", "grades", "emoji"];
const AXES = ["story", "art", "music", "pacing"];
const clamp5 = (n: unknown) => Math.min(5, Math.max(0, Math.round(Number(n) || 0)));

function cleanSymbol(s: RawJournal["symbol"]): JournalInput["symbol"] {
  if (!s || typeof s !== "object") return null;
  const value = clamp5(s.value);
  if (value <= 0) return null;
  return { style: SYMBOL_STYLES.includes(s.style ?? "") ? s.style! : "stars", value };
}
function cleanDims(d: RawJournal["dims"]): Record<string, number> {
  const out: Record<string, number> = { story: 0, art: 0, music: 0, pacing: 0 };
  if (d && typeof d === "object") for (const k of AXES) out[k] = clamp5(d[k]);
  return out;
}

function clean(input: RawJournal): JournalInput {
  const feeling = (input.feeling ?? "").trim();
  return {
    titleId: (input.titleId ?? "")?.toString().trim() || null,
    episode: (input.episode ?? "").trim().slice(0, 60),
    heading: (input.heading ?? "").trim().slice(0, 120),
    rateMode: RATE_MODES.includes(input.rateMode ?? "") ? input.rateMode! : "glyphs",
    feeling: (FEELINGS as readonly string[]).includes(feeling) ? feeling : null,
    symbol: cleanSymbol(input.symbol),
    dims: cleanDims(input.dims),
    quote: (input.quote ?? "").trim().slice(0, 600),
    body: (input.body ?? "").trim().slice(0, 6000),
  };
}

export async function createJournalEntryAction(input: RawJournal): Promise<JournalEntry> {
  const userId = await requireUserId();
  const entry = await createJournalEntry(userId, clean(input));
  revalidatePath("/journal");
  return entry;
}

export async function updateJournalEntryAction(id: string, input: RawJournal): Promise<void> {
  const userId = await requireUserId();
  await updateJournalEntry(userId, id, clean(input));
  revalidatePath("/journal");
}

export async function deleteJournalEntryAction(id: string): Promise<void> {
  const userId = await requireUserId();
  await deleteJournalEntry(userId, id);
  revalidatePath("/journal");
}

/** The signed-in user's journal entries for one title — backs the watchlist
 *  detail's per-episode notes grid. */
export async function getTitleJournalAction(titleId: string): Promise<JournalEntry[]> {
  const userId = await requireUserId();
  if (!titleId) return [];
  return getJournalEntriesForTitle(userId, titleId);
}

/** Add a new overall "take" note for a title (shown in the watchlist detail and
 *  the Journal). Returns the created entry. */
export async function addTitleTakeAction(titleId: string, body: string): Promise<JournalEntry | null> {
  const userId = await requireUserId();
  if (!titleId || !body.trim()) return null;
  const entry = await addTitleTake(userId, titleId, body);
  revalidatePath("/journal");
  return entry;
}

/** Update an existing take's body. */
export async function updateTitleTakeAction(id: string, body: string): Promise<void> {
  const userId = await requireUserId();
  await updateTitleTake(userId, id, body);
  revalidatePath("/journal");
}

/** Title autocomplete for the compose box's "what are you writing about?" picker. */
export async function searchJournalTitlesAction(
  q: string,
): Promise<{ id: string; title: string; cover: string | null; year: number | null; episodes: number | null }[]> {
  await requireUserId();
  const res = await searchCatalog(q.trim(), 8);
  return res.map((r) => ({ id: r.id, title: r.title, cover: r.cover, year: r.year, episodes: r.episodes }));
}
