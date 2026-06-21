"use client";

import { Glyph } from "@/features/watchlist/Glyph";
import { FEELINGS, GRADE_LETTERS, MOOD_EMOJI } from "@/features/watchlist/data";
import type { Feeling } from "@/features/watchlist/types";
import type { CommunityPost } from "@/lib/community";

const AXES = ["story", "art", "music", "pacing"] as const;

type R = Pick<CommunityPost, "rateMode" | "feeling" | "symbol" | "dims">;

// local axes average (kept off the server-only lib so this stays a client module)
function axesAvg(dims: Record<string, number>): number | null {
  const vals = AXES.map((a) => dims?.[a] ?? 0).filter((v) => v > 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** Compact display of a review's rating in whatever system the author chose. */
export function RatingBadge({ post }: { post: R }) {
  const { rateMode, feeling, symbol, dims } = post;

  if (rateMode === "symbols" && symbol && symbol.value > 0) {
    if (symbol.style === "grades")
      return <span className="crate crate--grade">{GRADE_LETTERS[symbol.value]}</span>;
    if (symbol.style === "emoji")
      return <span className="crate crate--emoji" title={`${symbol.value}/5`}>{MOOD_EMOJI[symbol.value]}</span>;
    return (
      <span className="crate crate--stars" title={`${symbol.value}/5`}>
        {"★".repeat(symbol.value)}
        <span className="crate__off">{"★".repeat(5 - symbol.value)}</span>
      </span>
    );
  }

  if (rateMode === "axes") {
    const avg = axesAvg(dims ?? {});
    if (avg == null) return null;
    const breakdown = AXES.map((a) => `${a[0].toUpperCase()}${a.slice(1)} ${dims?.[a] ?? 0}`).join(" · ");
    return (
      <span className="crate crate--axes" title={breakdown}>
        <b>{avg.toFixed(1)}</b> axes avg
      </span>
    );
  }

  // glyphs (feeling)
  if (feeling)
    return (
      <span className="crate crate--feel" style={{ color: `var(--feel-${feeling})` }}>
        <Glyph feeling={feeling as Feeling} set="orbs" size={13} />
        {FEELINGS[feeling as keyof typeof FEELINGS]?.label ?? feeling}
      </span>
    );

  return null;
}
