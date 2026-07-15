import "server-only";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { watchlists, watchlistEntries, titles } from "@/db/schema";
import { hiResCover } from "./cover";
import type { Watchlist } from "./storage";
import type { HueKey } from "./palette";

// Row shape coming back from the count query.
type Row = {
  id: string;
  title: string;
  description: string;
  hue: string;
  pinned: boolean;
  customAxes: unknown;
  createdAt: Date;
  lastEditedAt: Date;
  titleCount: number;
  watching: number;
};

// Map a DB row to the serializable DTO the gallery client already renders
// (timestamps as epoch ms, matching the original localStorage shape).
function toDTO(r: Row): Watchlist {
  return {
    id: r.id,
    title: r.title,
    desc: r.description,
    hue: r.hue as HueKey,
    pinned: r.pinned,
    customAxes: Array.isArray(r.customAxes) ? (r.customAxes as string[]) : [],
    titleCount: Number(r.titleCount),
    watching: Number(r.watching),
    createdAt: r.createdAt.getTime(),
    lastEdited: r.lastEditedAt.getTime(),
  };
}

const selectWithCounts = {
  id: watchlists.id,
  title: watchlists.title,
  description: watchlists.description,
  hue: watchlists.hue,
  pinned: watchlists.pinned,
  customAxes: watchlists.customAxes,
  createdAt: watchlists.createdAt,
  lastEditedAt: watchlists.lastEditedAt,
  titleCount: sql<number>`count(${watchlistEntries.id})`,
  watching: sql<number>`count(*) filter (where ${watchlistEntries.status} = 'watching')`,
};

/** All of a user's watchlists, newest-edited first, with derived counts + up to
 *  four cover images per list for the gallery card mosaic. */
export async function getWatchlists(userId: string): Promise<Watchlist[]> {
  const rows = await db
    .select(selectWithCounts)
    .from(watchlists)
    .leftJoin(watchlistEntries, eq(watchlistEntries.watchlistId, watchlists.id))
    .where(eq(watchlists.userId, userId))
    .groupBy(watchlists.id)
    .orderBy(desc(watchlists.lastEditedAt));

  // first few covers per list (by entry position) — one query, grouped in JS
  const coverRows = await db
    .select({ wid: watchlistEntries.watchlistId, cover: titles.cover })
    .from(watchlistEntries)
    .innerJoin(watchlists, eq(watchlistEntries.watchlistId, watchlists.id))
    .innerJoin(titles, eq(watchlistEntries.titleId, titles.id))
    .where(and(eq(watchlists.userId, userId), isNotNull(titles.cover)))
    .orderBy(asc(watchlistEntries.watchlistId), asc(watchlistEntries.position));
  const coversByList = new Map<string, string[]>();
  for (const r of coverRows) {
    const cover = r.cover;
    if (!cover) continue;
    const arr = coversByList.get(r.wid) ?? [];
    if (arr.length < 4) { arr.push(hiResCover(cover) ?? cover); coversByList.set(r.wid, arr); }
  }

  return rows.map((r) => ({ ...toDTO(r), covers: coversByList.get(r.id) ?? [] }));
}

/** A single watchlist the user owns (or null). Used by the app's [id] page. */
export async function getWatchlist(userId: string, id: string): Promise<Watchlist | null> {
  const rows = await db
    .select(selectWithCounts)
    .from(watchlists)
    .leftJoin(watchlistEntries, eq(watchlistEntries.watchlistId, watchlists.id))
    .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)))
    .groupBy(watchlists.id)
    .limit(1);
  return rows[0] ? toDTO(rows[0]) : null;
}

export async function createWatchlist(
  userId: string,
  input: { title: string; desc: string; hue: HueKey },
): Promise<Watchlist> {
  const [row] = await db
    .insert(watchlists)
    .values({ userId, title: input.title, description: input.desc, hue: input.hue })
    .returning();
  return toDTO({ ...row, titleCount: 0, watching: 0 });
}

const touch = () => ({ lastEditedAt: new Date() });

/** Rename a list and/or update its description. */
export async function updateWatchlist(
  userId: string,
  id: string,
  input: { title: string; desc: string },
): Promise<void> {
  const title = input.title.trim().slice(0, 60) || "Untitled";
  await db
    .update(watchlists)
    .set({ title, description: input.desc.trim().slice(0, 240), ...touch() })
    .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)));
}

export async function togglePin(userId: string, id: string): Promise<void> {
  await db
    .update(watchlists)
    .set({ pinned: sql`not ${watchlists.pinned}`, ...touch() })
    .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)));
}

export async function setHue(userId: string, id: string, hue: HueKey): Promise<void> {
  await db
    .update(watchlists)
    .set({ hue, ...touch() })
    .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)));
}

export async function deleteWatchlist(userId: string, id: string): Promise<void> {
  await db
    .delete(watchlists)
    .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)));
}

const BASE_AXIS_NAMES = ["story", "art", "music", "pacing"];

async function readCustomAxes(userId: string, id: string): Promise<string[]> {
  const [row] = await db
    .select({ axes: watchlists.customAxes })
    .from(watchlists)
    .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)))
    .limit(1);
  return row && Array.isArray(row.axes) ? (row.axes as string[]) : [];
}

/** Add a shared custom rating axis to a list (deduped, name-normalised). Returns
 *  the resulting axis list, or null if the name was empty/duplicate/reserved. */
export async function addCustomAxis(userId: string, id: string, name: string): Promise<string[] | null> {
  const clean = name.trim().slice(0, 24);
  if (!clean) return null;
  const lc = clean.toLowerCase();
  if (BASE_AXIS_NAMES.includes(lc)) return null;
  const cur = await readCustomAxes(userId, id);
  if (cur.some((a) => a.toLowerCase() === lc)) return null;
  if (cur.length >= 8) return null; // keep the panel sane
  const next = [...cur, clean];
  await db.update(watchlists).set({ customAxes: next, ...touch() })
    .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)));
  return next;
}

/** Remove a shared custom rating axis from a list. Returns the resulting list. */
export async function removeCustomAxis(userId: string, id: string, name: string): Promise<string[]> {
  const cur = await readCustomAxes(userId, id);
  const next = cur.filter((a) => a.toLowerCase() !== name.trim().toLowerCase());
  await db.update(watchlists).set({ customAxes: next, ...touch() })
    .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)));
  return next;
}
