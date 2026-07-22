"use server";

import { auth } from "@/auth";
import { searchCatalog } from "@/lib/catalog";
import { ensureIndex, fuzzySearch } from "@/lib/search-index";
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
  /** the anime the title matched, if any */
  anime: SearchResult | null;
  /** the manga the title matched, if any — a title can be both, and then both go
   *  onto the board */
  manga: SearchResult | null;
  /** whether a match came from a strict title hit (title found as whole words in
   *  the line) vs a loose fuzzy fallback — the loose ones are flagged to review */
  strict: boolean;
  /** a few runners-up, so the user can correct a wrong guess without searching */
  alternatives: SearchResult[];
};

/** Normalise for comparison: lowercase, punctuation → spaces, collapse runs. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Common fan abbreviations → a canonical title to search. These are community
 *  conventions no algorithm can derive (JJK isn't the initials of Jujutsu
 *  Kaisen), so the popular ones are mapped by hand. Keys are normalised. */
const ABBREV: Record<string, string> = {
  jjk: "Jujutsu Kaisen",
  aot: "Attack on Titan", snk: "Attack on Titan", "shingeki no kyojin": "Attack on Titan",
  fmab: "Fullmetal Alchemist: Brotherhood", fma: "Fullmetal Alchemist",
  dbz: "Dragon Ball Z", dbs: "Dragon Ball Super", db: "Dragon Ball",
  hxh: "Hunter x Hunter", kny: "Demon Slayer", "kimetsu no yaiba": "Demon Slayer",
  jojo: "JoJo's Bizarre Adventure", opm: "One Punch Man",
  mha: "My Hero Academia", bnha: "My Hero Academia", "boku no hero": "My Hero Academia",
  csm: "Chainsaw Man", tpn: "The Promised Neverland",
  nge: "Neon Genesis Evangelion", eva: "Evangelion",
  konosuba: "KonoSuba", madoka: "Puella Magi Madoka Magica",
  rezero: "Re:Zero", "re zero": "Re:Zero",
  ygo: "Yu-Gi-Oh", ohshc: "Ouran High School Host Club",
  fmt: "Fruits Basket", "code geass": "Code Geass",
  "steins gate": "Steins;Gate", ass: "Assassination Classroom",
  bsd: "Bungo Stray Dogs", ttgl: "Tengen Toppa Gurren Lagann", gurren: "Tengen Toppa Gurren Lagann",
  aoashi: "Ao Ashi", spy: "Spy x Family", sxf: "Spy x Family",
  dandadan: "Dan Da Dan", "the boy and the heron": "The Boy and the Heron",
};

/** How well a catalogue title matches a written line, in "matched characters".
 *  It works in BOTH directions, which is the whole point:
 *   • the title sits inside the line, surrounded by tags/notes
 *     ("Attack on Titan · shounen · finished") — matched = the title's length;
 *   • the line is a whole-word prefix of a longer title, i.e. the user wrote a
 *     short common name ("Demon Slayer" → "Demon Slayer: Kimetsu no Yaiba") —
 *     matched = the whole line.
 *  Scoring by matched length means the abbreviation of the real title beats a
 *  stray generic word that happens to sit in the line ("Demon" inside "demon
 *  slayer"), because the prefix match covers the whole line and the fragment
 *  doesn't. 0 means no match. A short/vague line can't prefix-match (the
 *  `specific` guard), so "One" won't latch onto everything. */
function matchScore(nLine: string, nTitle: string): number {
  if (!nTitle || nTitle.length < 2) return 0;
  if (nLine === nTitle) return nLine.length + 0.5; // exact — nudge above ties
  // title present in the line as whole words
  if (
    nLine.startsWith(nTitle + " ") ||
    nLine.endsWith(" " + nTitle) ||
    nLine.includes(" " + nTitle + " ")
  ) {
    return nTitle.length;
  }
  // line is a whole-word prefix of the title (an abbreviation of the full name)
  const specific = nLine.includes(" ") || nLine.length >= 5;
  if (specific && nTitle.startsWith(nLine + " ")) return nLine.length;
  return 0;
}

/** Best matched length for a hit, considering its display and native titles. */
function hitScore(nLine: string, h: SearchResult): number {
  const a = matchScore(nLine, norm(h.title));
  const b = h.native ? matchScore(nLine, norm(h.native)) : 0;
  return Math.max(a, b);
}

/** Strip the noise around a title on a hand-written line: leading list markers
 *  (1. — • *), and trailing annotations people jot next to a show — a rating,
 *  an episode count, a status in brackets or after a dash. Returns "" for a
 *  line that is only noise (a blank, a header like "Currently watching:"). */
function cleanLine(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  // strip inline markdown that wraps titles in notes: backticks, **bold**,
  // __underline__, ~~strike~~ — so "**Title** `[tag]`" reduces to the title
  s = s.replace(/`+/g, "").replace(/\*\*|__|~~/g, "");
  // leading list markers: bullets, numbers, checkboxes, a lone * / _ emphasis
  s = s.replace(/^\s*(?:[-*_•·▪●○►▶>]+|\d+[.)]|\[[ xX]?\]|[✓✔☑])\s*/, "");
  // Remove ALL [bracketed] tags anywhere on the line ("[Action] [Adventure]").
  // But if the line is ONLY a bracketed title (["Oshi no Ko"]-style), unwrap it
  // instead of deleting everything.
  const hasContentOutsideBrackets = s.replace(/\[[^\]]*\]/g, " ").trim().length > 0;
  s = hasContentOutsideBrackets ? s.replace(/\[[^\]]*\]/g, " ") : s.replace(/[[\]]/g, " ");
  // a section header ("Watching:", "Plan to watch —") with nothing meaningful after
  if (/^[\w\s]{1,24}[:—-]\s*$/.test(s.trim())) return "";
  // trailing " - 9/10", " – finished", " (rewatching)", " — 12 eps"
  s = s.replace(/\s+[-–—(]\s*.*$/, "");
  // a bare score at the end: "Frieren 9.5"
  s = s.replace(/\s+\d{1,2}(?:\.\d)?\s*\/?\s*(?:10|5)?\s*$/, "");
  // stray trailing emphasis / whitespace, then collapse runs
  s = s.replace(/[\s*_~]+$/, "");
  return s.replace(/\s+/g, " ").trim();
}

/** Break a pasted note into candidate titles and match each to the catalogue.
 *  Runs the searches with a small concurrency cap so a long paste can't fan out
 *  into hundreds of simultaneous index queries. */
export async function matchTitlesAction(text: string): Promise<MatchRow[]> {
  await requireUserId();
  if (!text || text.length > 20000) return [];

  // Load the search index fully before matching. Without this the first lookups
  // race a cold instance's index and silently get an empty result — which read
  // as "spelled perfectly but not detected" for whatever titles came first.
  await ensureIndex();

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
    const settled = await Promise.all(batch.map(matchWithSlash));
    for (const r of settled) rows.push(...r);
  }
  return rows;
}

/** Match a candidate, and if it matches nothing AND holds a "/" — a compound
 *  like "Clannad/Clannad: After Story" — match each slash-part separately and
 *  emit them as their own rows. The whole line is tried first, so a slash that
 *  is PART of a title ("Fate/stay night") matches as one and is never split. */
async function matchWithSlash(input: string): Promise<MatchRow[]> {
  const whole = await matchOne(input);
  if (!input.includes("/")) return [whole];

  // If the WHOLE line matches a title exactly, the "/" is part of that title
  // ("Fate/stay night", "Fate/Zero") — keep it as one, don't split. Otherwise
  // the "/" is a separator between titles ("Clannad/Clannad: After Story"), and
  // a mere prefix match of the whole (e.g. just "Clannad") shouldn't suppress
  // the split — match each part on its own.
  const nLine = norm(input);
  const wholeIsExact =
    (whole.anime && norm(whole.anime.title) === nLine) ||
    (whole.manga && norm(whole.manga.title) === nLine);
  if (wholeIsExact) return [whole];

  const parts = input.split("/").map((p) => p.trim()).filter((p) => p.length >= 2);
  const matched: MatchRow[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const r = await matchOne(part);
    // de-dupe across parts (e.g. "Clannad/Clannad: After Story" — same base)
    const key = (r.anime?.id ?? "") + "|" + (r.manga?.id ?? "");
    if ((r.anime || r.manga) && !seen.has(key)) { seen.add(key); matched.push(r); }
  }
  return matched.length > 0 ? matched : [whole];
}

/** Pick the best anime + manga from a candidate pool, scored against the full
 *  line. Highest matched length wins; ties go to the shorter (canonical) title. */
function pickBest(pool: SearchResult[], nLine: string) {
  const scored = pool
    .map((h) => ({ h, s: hitScore(nLine, h) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || norm(a.h.title).length - norm(b.h.title).length);
  const anime = scored.find((x) => x.h.kind === "anime")?.h ?? null;
  const manga = scored.find((x) => x.h.kind === "manga")?.h ?? null;
  return { anime, manga };
}

async function matchOne(input: string): Promise<MatchRow> {
  const nLine = norm(input);
  // a known fan abbreviation searches (and scores against) its canonical title
  const query = ABBREV[nLine] ?? input;
  const nScore = norm(query);
  const words = nScore.split(" ").filter((w) => w.length > 0);

  // Build a candidate pool. Search the full line first; if that doesn't yield a
  // confident match, shrink to the leading word-prefixes ("Clannad After Story
  // finished" → "Clannad After Story" → … → "Clannad"), because the title
  // usually sits at the START and trailing words are tags/notes. Stop as soon
  // as a strict match appears.
  const pool: SearchResult[] = [];
  const seen = new Set<string>();
  const addHits = async (sub: string) => {
    if (sub.length < 2) return;
    try {
      for (const h of await searchCatalog(sub, 8)) {
        if (!seen.has(h.id)) { seen.add(h.id); pool.push(h); }
      }
    } catch { /* ignore a failed sub-search */ }
  };

  await addHits(words.join(" "));
  let { anime, manga } = pickBest(pool, nScore);
  for (let k = words.length - 1; k >= 1 && !(anime || manga); k--) {
    await addHits(words.slice(0, k).join(" "));
    ({ anime, manga } = pickBest(pool, nScore));
  }
  let strict = !!(anime || manga);
  let hits = pool;

  // Still nothing — try typo-tolerant fuzzy matching so a misspelling ("Fulmetal
  // Alchemist", "Cowboy Bebob") still resolves. Fuzzy matches are included but
  // marked non-strict so the board flags them "Check". Only a title that matches
  // nothing at all (not even fuzzily) is left out.
  if (!strict) {
    const fuzzy = await fuzzySearch(input, 8);
    if (fuzzy.length > 0) {
      anime = fuzzy.find((h) => h.kind === "anime") ?? null;
      manga = fuzzy.find((h) => h.kind === "manga") ?? null;
      if (anime || manga) hits = fuzzy;
    }
  }

  const chosen = new Set([anime?.id, manga?.id].filter(Boolean));
  const alternatives = hits.filter((h) => !chosen.has(h.id)).slice(0, 6);
  return { input, anime, manga, strict, alternatives };
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
