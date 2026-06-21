"use client";

import { Glyph } from "./Glyph";
import { GRADE_LETTERS, MOOD_EMOJI } from "./data";
import { avgRatingStr } from "./helpers";
import type { Entry, GlyphSet } from "./types";

// The corner rating mark reflects the method the user chose for this title:
//   glyphs  → the feeling glyph
//   symbols → a star+value / letter grade / mood emoji
//   axes    → the average of the rated axes
// Unrated titles fall back to the glyph's dashed "not rated" ring.

/** True when the entry's chosen method actually has a value to show. */
export function hasMark(entry: Entry): boolean {
  const mode = entry.rateMode ?? "glyphs";
  if (mode === "symbols") return !!entry.symbol && entry.symbol.value > 0;
  if (mode === "axes") return avgRatingStr(entry) != null;
  return entry.feeling != null;
}

/** Colour for the mark wrapper (drives currentColor of text/glyph marks). */
export function markColor(entry: Entry): string {
  const mode = entry.rateMode ?? "glyphs";
  if (mode === "glyphs" && entry.feeling) return `var(--feel-${entry.feeling})`;
  return "var(--accent)";
}

export function RatingMark({
  entry,
  glyphSet,
  size,
}: {
  entry: Entry;
  glyphSet: GlyphSet;
  size: number;
}) {
  const mode = entry.rateMode ?? "glyphs";

  if (mode === "symbols" && entry.symbol && entry.symbol.value > 0) {
    const { style, value } = entry.symbol;
    if (style === "grades") return <span className="k-mark k-mark--grade">{GRADE_LETTERS[value]}</span>;
    if (style === "emoji") return <span className="k-mark k-mark--emoji">{MOOD_EMOJI[value]}</span>;
    return (
      <span className="k-mark k-mark--stars">
        ★<b className="k-mark__n">{value}</b>
      </span>
    );
  }

  if (mode === "axes") {
    const avg = avgRatingStr(entry);
    if (avg) return <span className="k-mark k-mark--axes">{avg}</span>;
  }

  // glyphs, or a method with no value yet → feeling glyph / dashed "not rated" ring
  return <Glyph feeling={mode === "glyphs" ? entry.feeling : null} set={glyphSet} size={size} />;
}
