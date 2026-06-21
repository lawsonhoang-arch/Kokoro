"use client";

import { Glyph } from "@/features/watchlist/Glyph";
import { FEELINGS, SYMBOL_STYLES, GRADE_LETTERS, MOOD_EMOJI } from "@/features/watchlist/data";
import { BASE_AXES } from "@/features/watchlist/types";
import type { Feeling, GlyphSet, RateMode, SymbolStyle } from "@/features/watchlist/types";

// A self-contained "rate it your way" control offering all three systems the app
// supports — glyphs (feeling), axes (story/art/music/pacing pips), and symbols
// (stars / letter grades / mood). Fully controlled via value + onChange.
export type RatingValue = {
  rateMode: string;
  feeling: string | null;
  symbol: { style: string; value: number } | null;
  dims: Record<string, number>;
};

const FEELING_KEYS = Object.keys(FEELINGS) as Feeling[];
const MODES: { key: RateMode; label: string }[] = [
  { key: "glyphs", label: "Glyphs" },
  { key: "axes", label: "Axes" },
  { key: "symbols", label: "Symbols" },
];
const SYMBOL_KEYS = Object.keys(SYMBOL_STYLES) as SymbolStyle[];

export function RatingControl({
  value,
  onChange,
  glyphSet = "orbs",
}: {
  value: RatingValue;
  onChange: (patch: Partial<RatingValue>) => void;
  glyphSet?: GlyphSet;
}) {
  const rateMode = (value.rateMode || "glyphs") as RateMode;
  const symStyle = (value.symbol?.style ?? "stars") as SymbolStyle;
  const symValue = value.symbol?.value ?? 0;
  const dims = value.dims ?? {};
  const setSymValue = (v: number) =>
    onChange({ symbol: symValue === v ? null : { style: symStyle, value: v } });

  return (
    <div className="jrate">
      <div className="jrate__modes" role="tablist" aria-label="Rating method">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={rateMode === m.key}
            className={"jrate__mode" + (rateMode === m.key ? " on" : "")}
            onClick={() => onChange({ rateMode: m.key })}
          >
            {m.label}
          </button>
        ))}
      </div>

      {rateMode === "glyphs" && (
        <div className="jrate__feels">
          {FEELING_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              className={"jrate__feel" + (value.feeling === k ? " on" : "")}
              style={value.feeling === k ? { color: `var(--feel-${k})` } : undefined}
              onClick={() => onChange({ feeling: value.feeling === k ? null : k })}
            >
              <span style={{ color: `var(--feel-${k})` }}>
                <Glyph feeling={k} set={glyphSet} size={20} />
              </span>
              <span>{FEELINGS[k].label}</span>
            </button>
          ))}
        </div>
      )}

      {rateMode === "axes" && (
        <div className="jrate__dims">
          {BASE_AXES.map((d) => (
            <div className="jrate__dim" key={d}>
              <span className="jrate__dimname">{d}</span>
              <div className="jrate__pips">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={"jrate__pip" + ((dims[d] ?? 0) >= n ? " on" : "")}
                    aria-label={`${d} ${n} of 5`}
                    onClick={() => onChange({ dims: { ...dims, [d]: dims[d] === n ? 0 : n } })}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {rateMode === "symbols" && (
        <div className="jrate__symbols">
          <div className="jrate__symstyle" role="tablist" aria-label="Symbol style">
            {SYMBOL_KEYS.map((st) => (
              <button
                key={st}
                type="button"
                role="tab"
                aria-selected={symStyle === st}
                className={"jrate__symstyleopt" + (symStyle === st ? " on" : "")}
                onClick={() => onChange({ symbol: { style: st, value: symValue } })}
              >
                {SYMBOL_STYLES[st].label}
              </button>
            ))}
          </div>
          <div className={"jrate__symrate jrate__symrate--" + symStyle} role="radiogroup">
            {[1, 2, 3, 4, 5].map((n) => {
              const on = symStyle === "stars" ? symValue >= n : symValue === n;
              const glyph = symStyle === "stars" ? "★" : symStyle === "grades" ? GRADE_LETTERS[n] : MOOD_EMOJI[n];
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`${n} of 5`}
                  className={"jrate__sym" + (on ? " on" : "")}
                  onClick={() => setSymValue(n)}
                >
                  {glyph}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
