"use server";

import { auth } from "@/auth";
import { searchCatalog } from "@/lib/catalog";
import * as wl from "@/lib/watchlists";
import { addEntry } from "@/lib/entries";
import type { SearchResult } from "@/features/search/types";
import type { HueKey } from "@/lib/palette";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export type MatchRow = {
  /** the raw line the user wrote */
  input: string;
  /** best catalogue match, or null if nothing looked close */
  match: SearchResult | null;
  /** a few runners-up, so the user can correct a wrong guess without searching */
  alternatives: SearchResult[];
};

/** Strip the noise around a title on a hand-written line: leading list markers
 *  (1. — • *), and trailing annotations people jot next to a show — a rating,
 *  an episode count, a status in brackets or after a dash. Returns "" for a
 *  line that is only noise (a blank, a header like "Currently watching:"). */
function cleanLine(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  // leading bullet / number / checkbox markers
  s = s.replace(/^\s*(?:[-*•·▪●○►▶>]+|\d+[.)]|\[[ xX]?\]|[✓✔☑])\s*/, "");
  // a section header ("Watching:", "Plan to watch —") with nothing after it
  if (/^[\w\s]{1,24}[:—-]\s*$/.test(s)) return "";
  // trailing " - 9/10", " – finished", " (rewatching)", " — 12 eps"
  s = s.replace(/\s+[-–—(]\s*.*$/, "");
  // trailing bracketed note with no dash: "Bleach [dropped]"
  s = s.replace(/\s*\[[^\]]*\]\s*$/, "");
  // a bare score at the end: "Frieren 9.5"
  s = s.replace(/\s+\d{1,2}(?:\.\d)?\s*\/?\s*(?:10|5)?\s*$/, "");
  return s.trim();
}

/** Break a pasted note into candidate titles and match each to the catalogue.
 *  Runs the searches with a small concurrency cap so a long paste can't fan out
 *  into hundreds of simultaneous index queries. */
export async function matchTitlesAction(text: string): Promise<MatchRow[]> {
  await requireUserId();
  if (!text || text.length > 20000) return [];

  // One title per line — the normal case. A line is only treated as an inline
  // list when it has TWO OR MORE commas ("A, B, C"): a single comma is usually
  // a subtitle ("Fate/stay night, Unlimited Blade Works"), and semicolons are
  // never split on because real titles use them (Steins;Gate, Robotics;Notes).
  const lines = text
    .split(/\r?\n/)
    .flatMap((l) => ((l.match(/,/g) || []).length >= 2 ? l.split(/\s*,\s*/) : [l]));

  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const l of lines) {
    const c = cleanLine(l);
    const key = c.toLowerCase();
    if (!c || c.length < 2 || seen.has(key)) continue;
    seen.add(key);
    candidates.push(c);
    if (candidates.length >= 200) break; // hard cap
  }

  const rows: MatchRow[] = [];
  const CONCURRENCY = 6;
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const batch = candidates.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(
      batch.map(async (input): Promise<MatchRow> => {
        try {
          const hits = await searchCatalog(input, 5);
          return { input, match: hits[0] ?? null, alternatives: hits.slice(1, 4) };
        } catch {
          return { input, match: null, alternatives: [] };
        }
      }),
    );
    rows.push(...settled);
  }
  return rows;
}

/** Create a new list from the verified titles and add them all. Returns the new
 *  list id so the client can jump straight into it. */
export async function buildListFromTitlesAction(input: {
  name: string;
  hue: HueKey;
  titleIds: string[];
}): Promise<{ ok: true; listId: string; added: number } | { ok: false; error: string }> {
  const userId = await requireUserId();
  const ids = [...new Set(input.titleIds)].filter(Boolean).slice(0, 500);
  if (ids.length === 0) return { ok: false, error: "Nothing to add — verify at least one title first." };

  const created = await wl.createWatchlist(userId, {
    title: (input.name || "Imported list").trim().slice(0, 60) || "Imported list",
    desc: "",
    hue: input.hue,
  });

  let added = 0;
  for (const id of ids) {
    try {
      const r = await addEntry(userId, created.id, id);
      if (r.ok) added++;
    } catch {
      /* skip a title that fails to add rather than abort the whole import */
    }
  }
  return { ok: true, listId: created.id, added };
}
