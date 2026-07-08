import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { titles, watchlists, watchlistEntries } from "@/db/schema";

export type ImportSource = "anilist" | "mal";
type ExtStatus = "watching" | "completed" | "planned" | "dropped";

// One normalised list entry from an external tracker, keyed by MAL id (which our
// catalog also carries) so it can be mapped back into our titles.
export type ImportEntry = {
  malId: number;
  kind: "anime" | "manga";
  score10: number; // 0 = unrated, else 1–10
  status: ExtStatus;
  progress: number; // episodes watched / chapters read
};

export type ImportSummary = {
  source: ImportSource;
  total: number; // entries fetched from the source
  matched: number; // titles found in our catalog
  imported: number; // newly added to the list
  duplicates: number; // already in the list (skipped)
  unmatched: number; // not in our catalog
  listId: string | null;
  listTitle: string;
};

// ============================================================
// SOURCE 1 — AniList (public GraphQL, by username)
// ============================================================
const ANILIST_STATUS: Record<string, ExtStatus> = {
  CURRENT: "watching", REPEATING: "watching", PAUSED: "watching",
  PLANNING: "planned", COMPLETED: "completed", DROPPED: "dropped",
};

// AniList returns scores in the user's chosen format — normalise to 0–10.
function normScore(raw: number, fmt: string): number {
  if (!raw) return 0;
  switch (fmt) {
    case "POINT_100": return raw / 10;
    case "POINT_5": return raw * 2;
    case "POINT_3": return raw === 1 ? 3 : raw === 2 ? 6 : 9;
    default: return raw; // POINT_10 / POINT_10_DECIMAL
  }
}

const ANILIST_QUERY =
  `query($n:String){` +
  `User(name:$n){mediaListOptions{scoreFormat}} ` +
  `anime:MediaListCollection(userName:$n,type:ANIME){lists{entries{status score progress media{idMal}}}} ` +
  `manga:MediaListCollection(userName:$n,type:MANGA){lists{entries{status score progress media{idMal}}}}}`;

type AlEntry = { status?: string; score?: number; progress?: number; media?: { idMal?: number } };
type AlColl = { lists?: { entries?: AlEntry[] }[] };

/** Fetch a public AniList user's anime + manga lists. Throws "NOT_FOUND" for a
 *  missing/private user, "ANILIST_ERROR" otherwise. */
export async function fetchAniList(username: string): Promise<ImportEntry[]> {
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ query: ANILIST_QUERY, variables: { n: username } }),
    signal: AbortSignal.timeout(15000),
  });
  const j = (await res.json()) as { data?: { User?: { mediaListOptions?: { scoreFormat?: string } }; anime?: AlColl; manga?: AlColl }; errors?: { message?: string }[] };
  if (j.errors?.length) {
    const msg = j.errors[0]?.message ?? "";
    throw new Error(/not found|private/i.test(msg) ? "NOT_FOUND" : "ANILIST_ERROR");
  }
  const fmt = j.data?.User?.mediaListOptions?.scoreFormat ?? "POINT_10";
  const out: ImportEntry[] = [];
  const collect = (coll: AlColl | undefined, kind: "anime" | "manga") => {
    for (const l of coll?.lists ?? []) {
      for (const e of l.entries ?? []) {
        const idMal = e.media?.idMal;
        if (typeof idMal !== "number") continue;
        out.push({
          malId: idMal,
          kind,
          score10: normScore(e.score ?? 0, fmt),
          status: ANILIST_STATUS[e.status ?? ""] ?? "planned",
          progress: e.progress ?? 0,
        });
      }
    }
  };
  collect(j.data?.anime, "anime");
  collect(j.data?.manga, "manga");
  return out;
}

// ============================================================
// SOURCE 2 — MyAnimeList XML export (the file MAL lets you download)
// ============================================================
const MAL_STATUS: Record<string, ExtStatus> = {
  watching: "watching", reading: "watching", completed: "completed",
  "on-hold": "watching", on_hold: "watching", dropped: "dropped",
  "plan to watch": "planned", "plan to read": "planned",
};

function grab(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
  return m ? m[1].trim() : "";
}

/** Parse a MAL list export (anime + manga blocks). */
export function parseMalExport(xml: string): ImportEntry[] {
  const out: ImportEntry[] = [];
  const eat = (blocks: string[], kind: "anime" | "manga", idTag: string, progTag: string) => {
    for (const raw of blocks.slice(1)) {
      const block = raw.split(kind === "anime" ? "</anime>" : "</manga>")[0];
      const id = parseInt(grab(block, idTag), 10);
      if (!Number.isFinite(id) || id <= 0) continue;
      const status = MAL_STATUS[grab(block, "my_status").toLowerCase()] ?? "planned";
      out.push({
        malId: id,
        kind,
        score10: parseInt(grab(block, "my_score"), 10) || 0,
        status,
        progress: parseInt(grab(block, progTag), 10) || 0,
      });
    }
  };
  eat(xml.split("<anime>"), "anime", "series_animedb_id", "my_watched_episodes");
  eat(xml.split("<manga>"), "manga", "manga_mangadb_id", "my_read_chapters");
  return out;
}

// ============================================================
// APPLY — map to our catalog and bulk-insert into an "Imported" list
// ============================================================
function ratingFor(e: ImportEntry): { rateMode: string; feeling: string | null; symbol: unknown } {
  if (e.score10 > 0) {
    const stars = Math.max(1, Math.min(5, Math.round(e.score10 / 2)));
    return { rateMode: "symbols", feeling: null, symbol: { style: "stars", value: stars } };
  }
  if (e.status === "dropped") return { rateMode: "glyphs", feeling: "dropped", symbol: null };
  return { rateMode: "glyphs", feeling: null, symbol: null };
}
const wlStatus = (s: ExtStatus) => (s === "planned" ? "planned" : s === "watching" ? "watching" : "completed");

export async function applyImport(userId: string, source: ImportSource, entries: ImportEntry[]): Promise<ImportSummary> {
  const listTitle = source === "anilist" ? "Imported from AniList" : "Imported from MyAnimeList";
  const summary: ImportSummary = { source, total: entries.length, matched: 0, imported: 0, duplicates: 0, unmatched: 0, listId: null, listTitle };
  if (entries.length === 0) return summary;

  // 1. map (kind, malId) → our catalog id (uses titles_mal_idx)
  const animeIds = [...new Set(entries.filter((e) => e.kind === "anime").map((e) => e.malId))];
  const mangaIds = [...new Set(entries.filter((e) => e.kind === "manga").map((e) => e.malId))];
  const byKey = new Map<string, string>();
  if (animeIds.length) {
    for (const r of await db.select({ id: titles.id, malId: titles.malId }).from(titles).where(and(eq(titles.kind, "anime"), inArray(titles.malId, animeIds)))) {
      if (r.malId != null) byKey.set("anime:" + r.malId, r.id);
    }
  }
  if (mangaIds.length) {
    for (const r of await db.select({ id: titles.id, malId: titles.malId }).from(titles).where(and(eq(titles.kind, "manga"), inArray(titles.malId, mangaIds)))) {
      if (r.malId != null) byKey.set("manga:" + r.malId, r.id);
    }
  }

  const extKeys = new Set(entries.map((e) => e.kind + ":" + e.malId));
  for (const k of extKeys) { if (byKey.has(k)) summary.matched++; else summary.unmatched++; }

  // resolve to our title ids (one entry per title — the first wins)
  const resolved = new Map<string, ImportEntry>();
  for (const e of entries) {
    const tid = byKey.get(e.kind + ":" + e.malId);
    if (tid && !resolved.has(tid)) resolved.set(tid, e);
  }
  if (resolved.size === 0) return summary;

  // 2. get / create the destination list
  const [existingList] = await db
    .select({ id: watchlists.id })
    .from(watchlists)
    .where(and(eq(watchlists.userId, userId), eq(watchlists.title, listTitle)))
    .limit(1);
  const listId = existingList?.id ?? (
    await db.insert(watchlists).values({ userId, title: listTitle, description: `Imported ${new Date().toLocaleDateString()}`, hue: "warm" }).returning({ id: watchlists.id })
  )[0].id;
  summary.listId = listId;

  // 3. dedupe against what's already in the list, then bulk insert
  const existing = new Set((await db.select({ titleId: watchlistEntries.titleId }).from(watchlistEntries).where(eq(watchlistEntries.watchlistId, listId))).map((r) => r.titleId));
  const [{ next }] = await db.select({ next: sql<number>`coalesce(max(${watchlistEntries.position}), -1) + 1` }).from(watchlistEntries).where(eq(watchlistEntries.watchlistId, listId));
  let pos = Number(next);

  const rows: (typeof watchlistEntries.$inferInsert)[] = [];
  for (const [titleId, e] of resolved) {
    if (existing.has(titleId)) { summary.duplicates++; continue; }
    const r = ratingFor(e);
    rows.push({
      watchlistId: listId, titleId, status: wlStatus(e.status),
      rateMode: r.rateMode, feeling: r.feeling, symbol: r.symbol,
      progress: e.progress > 0 ? e.progress : null, position: pos++,
    });
  }
  // chunk the insert so a big list can't blow the statement timeout
  for (let i = 0; i < rows.length; i += 100) {
    await db.insert(watchlistEntries).values(rows.slice(i, i + 100));
  }
  summary.imported = rows.length;
  if (rows.length) await db.update(watchlists).set({ lastEditedAt: new Date() }).where(eq(watchlists.id, listId));
  return summary;
}
