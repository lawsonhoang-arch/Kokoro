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
    { key: "feeling", label: "Feeling tier" },
    { key: "az", label: "A–Z" },
    { key: "watched", label: "Date watched" },
    { key: "rating", label: "Rating" },
    { key: "random", label: "Random" },
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

function comparator(key: string, seed: string): Cmp | null {
  if (key === "az") return (a, b) => a.title.localeCompare(b.title);
  if (key === "feeling")
    return (a, b) =>
      (a.feeling ? FEELINGS[a.feeling].tier : 8) - (b.feeling ? FEELINGS[b.feeling].tier : 8) ||
      a.title.localeCompare(b.title);
  if (key === "watched") return (a, b) => (b.watched || "").localeCompare(a.watched || "");
  if (key === "rating") return (a, b) => (avgRating(b) ?? -1) - (avgRating(a) ?? -1);
  if (key === "random") return (a, b) => hash(a.id + seed) - hash(b.id + seed);
  return null;
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
