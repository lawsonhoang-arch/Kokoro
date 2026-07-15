import { FEELINGS } from "./data";
import type { Entry, RuleCat, Bucket, Tag } from "./types";

// Rule engine — port of rules.js. Pure helpers + the token catalog shown in the
// sculpt sidebar. Global rules apply to everything; scoped (per-collection)
// rules override.

export type Token = { key: string; label: string };

export const TOKENS: Record<RuleCat, Token[]> = {
  group: [
    { key: "status", label: "Watch status" },
    { key: "feeling", label: "Feeling" },
    { key: "genre", label: "Genre" },
    { key: "length", label: "Episode count" },
    { key: "seasons", label: "Season count" },
  ],
  sort: [
    { key: "az", label: "Title A–Z" },
    { key: "rating", label: "Your rating" },
    { key: "mal", label: "MAL rating" },
    { key: "popularity", label: "Most popular" },
    { key: "feeling", label: "Feeling" },
    { key: "axis-story", label: "Story" },
    { key: "axis-art", label: "Art" },
    { key: "axis-music", label: "Music" },
    { key: "axis-pacing", label: "Pacing" },
    { key: "unrated", label: "Unrated first" },
    { key: "year", label: "Release year" },
    { key: "watched", label: "Date finished" },
    { key: "added", label: "Recently added" },
    { key: "episodes", label: "Episodes" },
    { key: "seasons", label: "Seasons" },
    { key: "progress", label: "Progress" },
    { key: "genre", label: "Genre" },
    { key: "status", label: "Status" },
    { key: "kind", label: "Type" },
    { key: "random", label: "Shuffle" },
  ],
  color: [
    { key: "feeling", label: "Feeling" },
    { key: "genre", label: "Genre" },
    { key: "rating", label: "Rating" },
  ],
  tag: [
    { key: "episodes", label: "Episodes" },
    { key: "genre", label: "Genre" },
    { key: "seasons", label: "Seasons" },
    { key: "feeling", label: "Feeling" },
  ],
};

export const CAT_LABEL: Record<RuleCat, string> = {
  group: "Group",
  sort: "Sort",
  color: "Color",
  tag: "Tag",
};

const GENRE_HUE: Record<string, number> = {
  Action: 28, Fantasy: 300, Drama: 352, Comedy: 95, "Sci-Fi": 248,
  Supernatural: 278, Mystery: 212, Thriller: 18, Psychological: 322,
  "Slice of Life": 150, Adventure: 62, Music: 132, Horror: 12,
  Historical: 52, Sports: 185,
};

export function avgRating(e: Entry): number | null {
  const v = [e.dims.story, e.dims.art, e.dims.music, e.dims.pacing].filter((x) => x > 0);
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

export function ratingTier(e: Entry): number {
  const a = avgRating(e);
  if (a == null) return 3;
  if (a >= 4.5) return 0;
  if (a >= 3.7) return 1;
  if (a >= 2.8) return 2;
  return 3;
}

function genreColor(g: string): string {
  const h = GENRE_HUE[g] != null ? GENRE_HUE[g] : 60;
  return `oklch(0.66 0.105 ${h})`;
}

// ---- COLOR: returns a css color string (or null) ----
export function colorFor(e: Entry, key: string | null): string | null {
  if (!key) return null;
  if (key === "feeling") return e.feeling ? `var(--feel-${e.feeling})` : "var(--line-strong)";
  if (key === "genre") return genreColor(e.genres[0]);
  if (key === "rating") {
    const t = ratingTier(e);
    return ["oklch(0.66 0.13 65)", "oklch(0.66 0.09 120)", "oklch(0.64 0.06 250)", "var(--line-strong)"][t];
  }
  return null;
}

// ---- TAGS: returns array of {text, kind, feeling?} ----
export function tagsFor(e: Entry, keys: string[]): Tag[] {
  if (!keys || !keys.length) return [];
  const out: Tag[] = [];
  keys.forEach((k) => {
    if (k === "episodes") out.push({ text: `${e.episodes} ep`, kind: "ep" });
    else if (k === "seasons") out.push({ text: e.seasons === 1 ? "1 season" : `${e.seasons} seasons`, kind: "season" });
    else if (k === "genre") e.genres.slice(0, 2).forEach((g) => out.push({ text: g, kind: "genre" }));
    else if (k === "feeling") out.push({ text: e.feeling ? FEELINGS[e.feeling].label : "Unrated", kind: "feel", feeling: e.feeling });
  });
  return out;
}

// ---- GROUP: bucket an entry; returns {key, label, order} ----
export function bucketOf(e: Entry, key: string): Bucket {
  if (key === "status") {
    const m: Record<string, [string, string, number]> = {
      watching: ["watching", "Currently watching", 0],
      completed: ["completed", "Completed", 1],
      planned: ["planned", "Planned", 2],
    };
    const b = m[e.status];
    return { key: b[0], label: b[1], order: b[2] };
  }
  if (key === "feeling") {
    if (!e.feeling) return { key: "unrated", label: "Not yet rated", order: 9 };
    return { key: e.feeling, label: FEELINGS[e.feeling].label, order: FEELINGS[e.feeling].tier };
  }
  if (key === "genre") {
    const g = e.genres[0];
    return { key: g, label: g, order: 0 };
  }
  if (key === "length") {
    if (e.episodes <= 13) return { key: "short", label: "Short · ≤13 ep", order: 0 };
    if (e.episodes <= 26) return { key: "medium", label: "Medium · 14–26 ep", order: 1 };
    return { key: "long", label: "Long · 27+ ep", order: 2 };
  }
  if (key === "seasons") {
    if (e.seasons <= 1) return { key: "s1", label: "Single season", order: 0 };
    if (e.seasons === 2) return { key: "s2", label: "Two seasons", order: 1 };
    return { key: "s3", label: "Three+ seasons", order: 2 };
  }
  return { key: "all", label: "All", order: 0 };
}

// ---- SORT: comparator factory ----
type Cmp = (a: Entry, b: Entry) => number;

const STATUS_ORDER: Record<string, number> = { watching: 0, completed: 1, planned: 2 };
const az = (a: Entry, b: Entry) => a.title.localeCompare(b.title);
const n = (x: number | null | undefined, dflt: number) => (x == null ? dflt : x);
const progPct = (e: Entry) => (e.episodes > 0 ? (e.progress ?? 0) / e.episodes : 0);
const isRated = (e: Entry) => avgRating(e) != null || !!e.feeling;

// Sort keys may carry a ":rev" suffix to reverse their natural direction. Each
// field below is written in its NATURAL order (best/newest/most first, or A→Z);
// ":rev" flips it. A trailing az() keeps ties stable.
function baseCmp(key: string, seed: string): Cmp | null {
  switch (key) {
    case "az": return az;
    case "rating": return (a, b) => n(avgRating(b), -1) - n(avgRating(a), -1) || az(a, b);
    case "mal": return (a, b) => n(b.malScore, -1) - n(a.malScore, -1) || az(a, b);
    case "popularity": return (a, b) => n(b.popularity, -1) - n(a.popularity, -1) || az(a, b);
    case "feeling": return (a, b) => (a.feeling ? FEELINGS[a.feeling].tier : 8) - (b.feeling ? FEELINGS[b.feeling].tier : 8) || az(a, b);
    case "unrated": return (a, b) => (isRated(a) ? 1 : 0) - (isRated(b) ? 1 : 0) || az(a, b);
    case "year": return (a, b) => n(b.year, 0) - n(a.year, 0) || az(a, b);
    case "watched": return (a, b) => (b.watched || "").localeCompare(a.watched || "") || az(a, b);
    case "added": return (a, b) => n(b._order, 0) - n(a._order, 0);
    case "episodes": return (a, b) => n(b.episodes, 0) - n(a.episodes, 0) || az(a, b);
    case "seasons": return (a, b) => n(b.seasons, 0) - n(a.seasons, 0) || az(a, b);
    case "progress": return (a, b) => progPct(b) - progPct(a) || az(a, b);
    case "genre": return (a, b) => (a.genres[0] || "~").localeCompare(b.genres[0] || "~") || az(a, b);
    case "status": return (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || az(a, b);
    case "kind": return (a, b) => (a.kind || "").localeCompare(b.kind || "") || az(a, b);
    case "random": return (a, b) => hash(a.id + seed) - hash(b.id + seed);
  }
  if (key.startsWith("axis-")) {
    const dim = key.slice(5);
    return (a, b) => n(b.dims?.[dim], -1) - n(a.dims?.[dim], -1) || az(a, b);
  }
  return null;
}

function comparator(key: string, seed: string): Cmp | null {
  const rev = key.endsWith(":rev");
  const base = rev ? key.slice(0, -4) : key;
  const c = baseCmp(base, seed);
  if (!c) return null;
  return rev ? (a, b) => -c(a, b) : c;
}

// ---- SORT direction helpers (for the applied-rule chip's ↑/↓ toggle) ----
const ASC_NATURAL = new Set(["az", "genre"]); // A→Z by default; the rest are "big/newest first"
export function sortBaseKey(key: string): string {
  return key.endsWith(":rev") ? key.slice(0, -4) : key;
}
export function isSortReversible(key: string): boolean {
  return sortBaseKey(key) !== "random";
}
/** True when the applied sort reads ascending (A→Z / low / oldest first). */
export function sortIsAsc(key: string): boolean {
  const rev = key.endsWith(":rev");
  return ASC_NATURAL.has(sortBaseKey(key)) ? !rev : rev;
}
/** Flip a sort key's direction ("rating" ⇄ "rating:rev"). */
export function toggleSortRev(key: string): string {
  return key.endsWith(":rev") ? key.slice(0, -4) : key + ":rev";
}

export function chainedComparator(keys: string[], seed: string): Cmp | null {
  if (!keys || !keys.length) return null;
  const cmps = keys.map((k) => comparator(k, seed)).filter(Boolean) as Cmp[];
  if (!cmps.length) return null;
  if (cmps.length === 1) return cmps[0];
  return (a, b) => {
    for (const c of cmps) {
      const r = c(a, b);
      if (r !== 0) return r;
    }
    return 0;
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
