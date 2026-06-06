"use client";

import { useId } from "react";
import { FEELINGS } from "./data";
import type { Feeling, GlyphSet } from "./types";

// Feeling glyph sets — port of glyphs.jsx. Uses currentColor so the surrounding
// skin/theme controls hue.

function GlyphOrbs({ feeling, s, sw, clipId }: { feeling: Feeling; s: number; sw: number; clipId: string }) {
  const r = s / 2 - sw;
  const cx = s / 2;
  const cy = s / 2;
  const frac = feeling === "loved" ? 1 : feeling === "liked" ? 0.68 : feeling === "mixed" ? 0.5 : 0.16;
  const top = cy + r - 2 * r * frac;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={sw} />
      <clipPath id={clipId}>
        <rect x={cx - r} y={top} width={2 * r} height={2 * r} />
      </clipPath>
      <circle cx={cx} cy={cy} r={r} fill="currentColor" clipPath={`url(#${clipId})`} opacity={feeling === "dropped" ? 0.5 : 1} />
    </g>
  );
}

function GlyphBars({ feeling, s, sw }: { feeling: Feeling; s: number; sw: number }) {
  const w = s * 0.22;
  const gap = s * 0.13;
  const base = s * 0.9;
  const x0 = s * 0.12;
  const bar = (i: number, h: number) => (
    <rect key={i} x={x0 + i * (w + gap)} y={base - h} width={w} height={h} rx={w * 0.35} fill="currentColor" />
  );
  const dim = (i: number, h: number) => (
    <rect key={"d" + i} x={x0 + i * (w + gap)} y={base - h} width={w} height={h} rx={w * 0.35} fill="currentColor" opacity="0.22" />
  );
  if (feeling === "loved") return <g>{bar(0, s * 0.42)}{bar(1, s * 0.62)}{bar(2, s * 0.78)}</g>;
  if (feeling === "liked") return <g>{bar(0, s * 0.34)}{bar(1, s * 0.52)}{dim(2, s * 0.78)}</g>;
  if (feeling === "mixed") return <g>{bar(0, s * 0.5)}{dim(1, s * 0.52)}{dim(2, s * 0.78)}</g>;
  return <g><rect x={x0} y={base - sw} width={w * 3 + gap * 2} height={sw} rx={sw / 2} fill="currentColor" opacity="0.5" /></g>;
}

function GlyphForms({ feeling, s, sw }: { feeling: Feeling; s: number; sw: number }) {
  const cx = s / 2;
  const cy = s / 2;
  const r = s / 2 - sw;
  if (feeling === "loved") return <circle cx={cx} cy={cy} r={r} fill="currentColor" />;
  if (feeling === "liked") {
    const d = r * 0.96;
    return <rect x={cx - d} y={cy - d} width={2 * d} height={2 * d} rx={d * 0.32} fill="currentColor" transform={`rotate(45 ${cx} ${cy})`} />;
  }
  if (feeling === "mixed")
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={sw} />
        <path d={`M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} Z`} fill="currentColor" />
      </g>
    );
  // dropped — open ring with a strike
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={sw} opacity="0.6" />
      <line x1={cx - r * 0.7} y1={cy + r * 0.7} x2={cx + r * 0.7} y2={cy - r * 0.7} stroke="currentColor" strokeWidth={sw} opacity="0.6" strokeLinecap="round" />
    </g>
  );
}

type GlyphProps = {
  feeling: Feeling | null;
  set?: GlyphSet;
  size?: number;
  className?: string;
  title?: string;
};

export function Glyph({ feeling, set = "orbs", size = 18, className = "", title }: GlyphProps) {
  const clipId = useId();
  if (!feeling) {
    const r = size / 2 - size * 0.1;
    return (
      <svg className={"k-glyph " + className} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="not rated">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={Math.max(1, size * 0.07)} strokeDasharray={`${size * 0.12} ${size * 0.14}`} opacity="0.4" />
      </svg>
    );
  }
  const sw = Math.max(1.2, size * 0.085);
  const inner =
    set === "bars" ? <GlyphBars feeling={feeling} s={size} sw={sw} />
    : set === "forms" ? <GlyphForms feeling={feeling} s={size} sw={sw} />
    : <GlyphOrbs feeling={feeling} s={size} sw={sw} clipId={clipId} />;
  const fl = FEELINGS[feeling]?.label || feeling;
  return (
    <svg className={"k-glyph k-glyph--" + feeling + " " + className} width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title || fl}>
      {inner}
    </svg>
  );
}
