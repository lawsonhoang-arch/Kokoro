import "server-only";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { watchlists, watchlistEntries, titles } from "@/db/schema";
import { entryScore } from "@/lib/profile";

// Full-fidelity, re-importable dump of everything a user tracks. JSON keeps all
// per-title data; CSV is a flattened, spreadsheet-friendly view.

export type ExportEntry = {
  titleId: string;
  title: string;
  englishTitle: string | null;
  kind: string;
  year: number | null;
  genres: string[];
  episodes: number;
  status: string;
  feeling: string | null;
  score: number | null;
  rateMode: string;
  dims: Record<string, number>;
  symbol: unknown;
  progress: number | null;
  watchedEps: number[];
  watchedAt: string | null;
  notes: string;
};

export type ExportList = {
  title: string;
  description: string;
  hue: string;
  pinned: boolean;
  customAxes: unknown;
  entries: ExportEntry[];
};

export type ExportData = {
  app: "Kokoro";
  version: 1;
  exportedAt: string;
  counts: { lists: number; titles: number };
  lists: ExportList[];
};

export async function getExportData(userId: string, listId?: string): Promise<ExportData> {
  const rows = await db
    .select({
      listId: watchlists.id,
      listTitle: watchlists.title,
      listDesc: watchlists.description,
      listHue: watchlists.hue,
      listPinned: watchlists.pinned,
      listAxes: watchlists.customAxes,
      listCreated: watchlists.createdAt,
      status: watchlistEntries.status,
      feeling: watchlistEntries.feeling,
      rateMode: watchlistEntries.rateMode,
      symbol: watchlistEntries.symbol,
      progress: watchlistEntries.progress,
      watchedEps: watchlistEntries.watchedEps,
      watchedAt: watchlistEntries.watchedAt,
      take: watchlistEntries.take,
      dims: watchlistEntries.dims,
      position: watchlistEntries.position,
      titleId: titles.id,
      title: titles.title,
      english: titles.englishTitle,
      kind: titles.kind,
      year: titles.year,
      genres: titles.genres,
      episodes: titles.episodes,
    })
    .from(watchlists)
    .innerJoin(watchlistEntries, eq(watchlistEntries.watchlistId, watchlists.id))
    .innerJoin(titles, eq(watchlistEntries.titleId, titles.id))
    // userId in the filter also scopes ownership when a listId is passed
    .where(listId ? and(eq(watchlists.userId, userId), eq(watchlists.id, listId)) : eq(watchlists.userId, userId));

  // group by list, preserving each list's entry order
  const byList = new Map<string, { meta: ExportList; created: number; entries: { pos: number; e: ExportEntry }[] }>();
  const titleSeen = new Set<string>();
  for (const r of rows) {
    let bucket = byList.get(r.listId);
    if (!bucket) {
      bucket = {
        created: new Date(r.listCreated).getTime(),
        meta: { title: r.listTitle, description: r.listDesc, hue: r.listHue, pinned: r.listPinned, customAxes: r.listAxes, entries: [] },
        entries: [],
      };
      byList.set(r.listId, bucket);
    }
    titleSeen.add(r.titleId);
    const dims = (r.dims as Record<string, number> | null) ?? {};
    bucket.entries.push({
      pos: r.position ?? 0,
      e: {
        titleId: r.titleId,
        title: r.title,
        englishTitle: r.english,
        kind: r.kind,
        year: r.year ?? null,
        genres: r.genres ?? [],
        episodes: r.episodes,
        status: r.status,
        feeling: r.feeling,
        score: entryScore({ rateMode: r.rateMode, feeling: r.feeling, symbol: r.symbol, dims: r.dims }),
        rateMode: r.rateMode,
        dims,
        symbol: r.symbol ?? null,
        progress: r.progress,
        watchedEps: (r.watchedEps as number[] | null) ?? [],
        watchedAt: r.watchedAt,
        notes: r.take,
      },
    });
  }

  const lists: ExportList[] = [...byList.values()]
    .sort((a, b) => Number(b.meta.pinned) - Number(a.meta.pinned) || a.created - b.created)
    .map(({ meta, entries }) => ({ ...meta, entries: entries.sort((a, b) => a.pos - b.pos).map((x) => x.e) }));

  return {
    app: "Kokoro",
    version: 1,
    exportedAt: new Date().toISOString(),
    counts: { lists: lists.length, titles: titleSeen.size },
    lists,
  };
}

export function toJson(data: ExportData): string {
  return JSON.stringify(data, null, 2);
}

const s1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, "");
// RFC-4180 escaping: quote cells with commas/quotes/newlines, double inner quotes
function cell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(data: ExportData): string {
  const cols = ["List", "Title", "English", "Kind", "Year", "Genres", "Status", "Feeling", "Score", "Story", "Art", "Music", "Pacing", "Progress", "Episodes", "WatchedAt", "Notes"];
  const lines = [cols.join(",")];
  for (const list of data.lists) {
    for (const e of list.entries) {
      lines.push([
        cell(list.title),
        cell(e.title),
        cell(e.englishTitle),
        cell(e.kind),
        cell(e.year),
        cell(e.genres.join("; ")),
        cell(e.status),
        cell(e.feeling),
        cell(e.score == null ? "" : s1(e.score)),
        cell(e.dims.story || ""),
        cell(e.dims.art || ""),
        cell(e.dims.music || ""),
        cell(e.dims.pacing || ""),
        cell(e.progress ?? ""),
        cell(e.episodes || ""),
        cell(e.watchedAt),
        cell(e.notes),
      ].join(","));
    }
  }
  // BOM so Excel reads UTF-8 correctly
  return "﻿" + lines.join("\r\n");
}
