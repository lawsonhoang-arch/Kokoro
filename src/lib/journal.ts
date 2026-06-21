import "server-only";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { journalEntries, titles } from "@/db/schema";
import { hiResCover } from "@/lib/cover";

// Glyph feelings mirror the watchlist's (loved | liked | mixed | dropped).
export const FEELINGS = ["loved", "liked", "mixed", "dropped"] as const;
export type Feeling = (typeof FEELINGS)[number];

export type SymbolRating = { style: string; value: number };

/** A journal entry plus the (optional) catalog title it's about. Serializable. */
export type JournalEntry = {
  id: string;
  titleId: string | null;
  title: string | null;
  cover: string | null;
  year: number | null;
  episodes: number | null;
  episode: string;
  isTake: boolean; // the title's overall "take" (synced from the watchlist entry)
  heading: string; // user-written note title ("" → derived on display)
  rateMode: string; // glyphs | axes | symbols
  feeling: string | null;
  symbol: SymbolRating | null;
  dims: Record<string, number>;
  quote: string;
  body: string;
  createdAt: string; // ISO
};

export type JournalInput = {
  titleId: string | null;
  episode: string;
  heading: string;
  rateMode: string;
  feeling: string | null;
  symbol: SymbolRating | null;
  dims: Record<string, number>;
  quote: string;
  body: string;
};

const COLS = {
  id: journalEntries.id,
  titleId: journalEntries.titleId,
  episode: journalEntries.episode,
  isTake: journalEntries.isTake,
  heading: journalEntries.heading,
  rateMode: journalEntries.rateMode,
  feeling: journalEntries.feeling,
  symbol: journalEntries.symbol,
  dims: journalEntries.dims,
  quote: journalEntries.quote,
  body: journalEntries.body,
  createdAt: journalEntries.createdAt,
  title: titles.title,
  english: titles.englishTitle,
  cover: titles.cover,
  year: titles.year,
  episodes: titles.episodes,
};

type Row = {
  id: string; titleId: string | null; episode: string; isTake: boolean | null; heading: string;
  rateMode: string | null; feeling: string | null; symbol: unknown; dims: unknown;
  quote: string; body: string; createdAt: Date;
  title: string | null; english: string | null; cover: string | null;
  year: number | null; episodes: number | null;
};

function toEntry(r: Row): JournalEntry {
  return {
    id: r.id,
    titleId: r.titleId,
    title: r.english || r.title || null,
    cover: hiResCover(r.cover),
    year: r.year && r.year > 0 ? r.year : null,
    episodes: r.episodes && r.episodes > 0 ? r.episodes : null,
    episode: r.episode,
    isTake: r.isTake ?? false,
    heading: r.heading ?? "",
    rateMode: r.rateMode ?? "glyphs",
    feeling: r.feeling,
    symbol: (r.symbol as SymbolRating | null) ?? null,
    dims: (r.dims as Record<string, number>) ?? {},
    quote: r.quote,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
  };
}

/** All of a user's journal entries, newest first, with title info joined in. */
export async function getJournalEntries(userId: string): Promise<JournalEntry[]> {
  const rows = await db
    .select(COLS)
    .from(journalEntries)
    .leftJoin(titles, eq(journalEntries.titleId, titles.id))
    .where(eq(journalEntries.userId, userId))
    .orderBy(desc(journalEntries.createdAt));
  return rows.map((r) => toEntry(r as Row));
}

/** A user's journal entries for one catalog title, newest first. Used by the
 *  watchlist detail's episode grid. */
export async function getJournalEntriesForTitle(userId: string, titleId: string): Promise<JournalEntry[]> {
  const rows = await db
    .select(COLS)
    .from(journalEntries)
    .leftJoin(titles, eq(journalEntries.titleId, titles.id))
    .where(and(eq(journalEntries.userId, userId), eq(journalEntries.titleId, titleId)))
    .orderBy(desc(journalEntries.createdAt));
  return rows.map((r) => toEntry(r as Row));
}

/** Add a new overall "take" note for a title (a journal is_take entry). */
export async function addTitleTake(userId: string, titleId: string, body: string): Promise<JournalEntry> {
  const [{ id }] = await db
    .insert(journalEntries)
    .values({
      userId, titleId, isTake: true, episode: "", heading: "", body: body.trim().slice(0, 6000),
      rateMode: "glyphs", feeling: null, quote: "",
    })
    .returning({ id: journalEntries.id });
  const [r] = await db
    .select(COLS)
    .from(journalEntries)
    .leftJoin(titles, eq(journalEntries.titleId, titles.id))
    .where(eq(journalEntries.id, id))
    .limit(1);
  return toEntry(r as Row);
}

/** Update an existing take's body (verifying it's the user's is_take entry). */
export async function updateTitleTake(userId: string, id: string, body: string): Promise<void> {
  const owned = await db
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(and(
      eq(journalEntries.id, id),
      eq(journalEntries.userId, userId),
      eq(journalEntries.isTake, true),
    ))
    .limit(1);
  if (!owned.length) return;
  await db.update(journalEntries)
    .set({ body: body.trim().slice(0, 6000), updatedAt: new Date() })
    .where(eq(journalEntries.id, id));
}

export async function createJournalEntry(userId: string, input: JournalInput): Promise<JournalEntry> {
  const [{ id }] = await db
    .insert(journalEntries)
    .values({ userId, ...input })
    .returning({ id: journalEntries.id });
  const [r] = await db
    .select(COLS)
    .from(journalEntries)
    .leftJoin(titles, eq(journalEntries.titleId, titles.id))
    .where(eq(journalEntries.id, id))
    .limit(1);
  return toEntry(r as Row);
}

export async function updateJournalEntry(userId: string, id: string, input: JournalInput): Promise<void> {
  const owned = await db
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)))
    .limit(1);
  if (!owned.length) return;
  await db
    .update(journalEntries)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(journalEntries.id, id));
}

export async function deleteJournalEntry(userId: string, id: string): Promise<void> {
  await db.delete(journalEntries).where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)));
}
