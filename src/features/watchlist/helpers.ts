import type { CSSProperties } from "react";
import type { Entry } from "./types";

// Presentational helpers — port of the top of components.jsx.

export const EXTERNAL_SCORES: Record<string, number> = {
  frieren: 9.3, vinland: 8.8, mushishi: 8.7, monster: 9.0, bebop: 8.7,
  lustrous: 8.4, antarctica: 8.4, march: 8.9, mob: 8.5, bocchi: 8.8,
  dungeon: 8.3, csm: 8.5, oshi: 8.3, apothecary: 8.6, bleach: 9.0,
};

// long-tag abbreviations so they don't blow the layout in narrow cards
const TAG_ABBREV: Record<string, string> = {
  "Slice of Life": "SoL",
  "Science Fiction": "Sci-Fi",
  "Coming of Age": "CoA",
  "Magical Girl": "Mahō",
  Psychological: "Psych.",
  Supernatural: "Supnat.",
  "Post-apocalyptic": "Post-apo.",
  "Romantic Comedy": "Rom-Com",
};

export function abbrev(text: string, max = 10): string {
  if (TAG_ABBREV[text]) return TAG_ABBREV[text];
  if (text && text.length > max + 2) return text.slice(0, max).trimEnd() + "…";
  return text;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < (s || "").length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

// deterministic poster background per entry — softer, varied warmth
export function posterStyleFor(entry: Entry): CSSProperties {
  const h = Math.abs(hashStr(entry.id || entry.title));
  const hueA = h % 360;
  const hueB = (hueA + 28 + (h % 18)) % 360;
  const angle = (h % 8) * 22; // 0..154
  return {
    backgroundImage: `linear-gradient(${angle}deg, oklch(0.58 0.10 ${hueA}) 0%, oklch(0.42 0.12 ${hueB}) 100%), repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0 10px, transparent 10px 22px)`,
    backgroundBlendMode: "multiply, normal",
  };
}

// average user rating from your dimensions, returns "x.y" or null
export function avgRatingStr(entry: Entry): string | null {
  const ds = entry.dims;
  if (!ds) return null;
  const vals = ["story", "art", "music", "pacing"]
    .map((k) => ds[k as keyof typeof ds])
    .filter((v) => v > 0);
  if (!vals.length) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return avg.toFixed(1);
}
