import "server-only";
import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { titles, watchlistEntries } from "@/db/schema";
import { createWatchlist } from "@/lib/watchlists";
import { HUES, type HueKey } from "@/lib/palette";
import type { Watchlist } from "@/lib/storage";

// Restore a Kokoro JSON export (from lib/exportList) back into new lists. Titles
// are matched by our own catalog id, so a round-trip within the app is exact.

export type KokoroImportResult =
  | { ok: true; lists: Watchlist[]; imported: number; unmatched: number }
  | { ok: false; error: string };

type AnyEntry = Record<string, unknown>;
type AnyList = { title?: unknown; description?: unknown; hue?: unknown; entries?: unknown };

const HUE_KEYS = new Set(HUES.map((h) => h.key));
const STATUSES = new Set(["watching", "completed", "planned"]);
const FEELINGS = new Set(["loved", "liked", "mixed", "dropped"]);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

export async function importKokoroExport(userId: string, jsonText: string): Promise<KokoroImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  if (!isObj(parsed) || parsed.app !== "Kokoro" || !Array.isArray(parsed.lists)) {
    return { ok: false, error: "That doesn't look like a Kokoro export (.json)." };
  }
  const fileLists = parsed.lists as AnyList[];

  // every referenced title id
  const wantIds = new Set<string>();
  for (const l of fileLists) {
    if (!Array.isArray(l.entries)) continue;
    for (const e of l.entries as AnyEntry[]) { const id = str(e.titleId); if (id) wantIds.add(id); }
  }
  if (wantIds.size === 0) return { ok: false, error: "No titles found in that file." };

  // which of them exist in our catalog
  const inCatalog = new Set<string>();
  const idArr = [...wantIds];
  for (let i = 0; i < idArr.length; i += 500) {
    for (const r of await db.select({ id: titles.id }).from(titles).where(inArray(titles.id, idArr.slice(i, i + 500)))) {
      inCatalog.add(r.id);
    }
  }

  const created: Watchlist[] = [];
  let imported = 0, unmatched = 0;

  for (const l of fileLists) {
    const rawEntries = Array.isArray(l.entries) ? (l.entries as AnyEntry[]) : [];
    const seen = new Set<string>();
    const rows: (typeof watchlistEntries.$inferInsert)[] = [];

    // build rows first so we don't create an empty list for a fully-unmatched one
    const hue: HueKey = HUE_KEYS.has(l.hue as HueKey) ? (l.hue as HueKey) : "warm";
    const title = (str(l.title) || "Imported list").slice(0, 60);
    const desc = (str(l.description) || "").slice(0, 240);

    for (const e of rawEntries) {
      const tid = str(e.titleId);
      if (!tid) continue;
      if (!inCatalog.has(tid)) { unmatched++; continue; }
      if (seen.has(tid)) continue;
      seen.add(tid);
      const feeling = str(e.feeling);
      rows.push({
        watchlistId: "", // set after the list is created
        titleId: tid,
        status: STATUSES.has(str(e.status) ?? "") ? (str(e.status) as string) : "planned",
        feeling: feeling && FEELINGS.has(feeling) ? feeling : null,
        rateMode: str(e.rateMode) ?? "glyphs",
        symbol: e.symbol ?? null,
        dims: isObj(e.dims) ? (e.dims as Record<string, number>) : { story: 0, art: 0, music: 0, pacing: 0 },
        progress: typeof e.progress === "number" ? e.progress : null,
        watchedEps: Array.isArray(e.watchedEps) ? (e.watchedEps as unknown[]).filter((n): n is number => typeof n === "number") : [],
        watchedAt: str(e.watchedAt),
        take: str(e.notes) ?? "",
        position: rows.length,
      });
    }
    if (rows.length === 0) continue;

    const list = await createWatchlist(userId, { title, desc, hue });
    for (const r of rows) r.watchlistId = list.id;
    for (let i = 0; i < rows.length; i += 100) await db.insert(watchlistEntries).values(rows.slice(i, i + 100));

    imported += rows.length;
    created.push({ ...list, titleCount: rows.length, watching: rows.filter((r) => r.status === "watching").length });
  }

  if (created.length === 0) {
    return { ok: false, error: "None of those titles are in our catalog yet — nothing to import." };
  }
  return { ok: true, lists: created, imported, unmatched };
}
