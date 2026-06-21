"use client";

import { useState } from "react";
import { FEELINGS, SYMBOL_STYLES, GRADE_LETTERS, MOOD_EMOJI } from "./data";
import { EXTERNAL_SCORES } from "./helpers";
import { Glyph } from "./Glyph";
import { Ico } from "./Ico";
import { EpisodeNotes } from "./EpisodeNotes";
import { TakeNotes } from "./TakeNotes";
import { DescriptionSection } from "@/features/submissions/DescriptionSection";
import { BASE_AXES } from "./types";
import type { Entry, Feeling, GlyphSet, RateMode, SymbolStyle } from "./types";

const FEELING_KEYS = Object.keys(FEELINGS) as Feeling[];
const RATE_MODES: { key: RateMode; label: string }[] = [
  { key: "glyphs", label: "Glyphs" },
  { key: "axes", label: "Axes" },
  { key: "symbols", label: "Symbols" },
];
const SYMBOL_KEYS = Object.keys(SYMBOL_STYLES) as SymbolStyle[];

type Props = {
  entry: Entry;
  glyphSet: GlyphSet;
  showScore: boolean;
  customAxes: string[];
  onClose: () => void;
  onSetFeeling: (id: string, f: Feeling | null) => void;
  onSetRateMode: (id: string, m: RateMode) => void;
  onSetSymbol: (id: string, s: { style: SymbolStyle; value: number } | null) => void;
  onSetDim: (id: string, d: string, v: number) => void;
  onAddAxis: (name: string) => void;
  onRemoveAxis: (name: string) => void;
  onSetTake: (id: string, v: string) => void;
  onRemove?: (id: string) => void;
  watched: number[];
  onToggleWatched: (id: string, ep: number) => void;
  onMarkAllWatched: (id: string) => void;
  onClearWatched: (id: string) => void;
};

export function DetailPanel({
  entry,
  glyphSet,
  showScore,
  customAxes,
  onClose,
  onSetFeeling,
  onSetRateMode,
  onSetSymbol,
  onSetDim,
  onAddAxis,
  onRemoveAxis,
  onSetTake,
  onRemove,
  watched,
  onToggleWatched,
  onMarkAllWatched,
  onClearWatched,
}: Props) {
  const ext = EXTERNAL_SCORES[entry.id];
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [axisDraft, setAxisDraft] = useState<string | null>(null);

  const rateMode: RateMode = entry.rateMode ?? "glyphs";
  const symStyle: SymbolStyle = entry.symbol?.style ?? "stars";
  const symValue = entry.symbol?.value ?? 0;
  const setSymValue = (v: number) =>
    onSetSymbol(entry.id, symValue === v ? null : { style: symStyle, value: v });
  return (
    <aside className="k-detail" role="dialog" aria-modal="true">
      <div className="k-detail__scroll">
        <button className="k-icon-btn k-detail__close" onClick={onClose} title="Close (Esc)">
          <Ico name="x" s={17} />
        </button>

        <header className="k-detail__hero">
          <div className="k-detail__poster" style={{ position: "relative" }}>
            {entry.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={entry.cover}
                alt={`${entry.title} cover art`}
                referrerPolicy="no-referrer"
                loading="lazy"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: "inherit",
                }}
              />
            ) : (
              <span>key art · {entry.title}</span>
            )}
          </div>
          <div className="k-detail__heroinfo">
            <div className="k-detail__eyebrow">Anime · {entry.year}</div>
            <div className="k-detail__title">{entry.title}</div>
            <div className="k-detail__meta">
              <span className="k-tag">{entry.episodes} ep</span>
              <span className="k-tag">{entry.seasons === 1 ? "1 season" : entry.seasons + " seasons"}</span>
              {entry.genres.map((g) => (
                <span key={g} className="k-tag">
                  {g}
                </span>
              ))}
            </div>
            {showScore && ext != null && (
              <div style={{ marginTop: 14 }}>
                <span className="k-extscore">
                  external avg <b>{ext.toFixed(1)}</b> · resets when you leave
                </span>
              </div>
            )}
            {entry.cover && (
              <div
                style={{
                  marginTop: 12,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--ink-faint)",
                }}
              >
                Cover art © respective owners
              </div>
            )}
          </div>
        </header>

        {entry.titleId && <DescriptionSection titleId={entry.titleId} />}

        <div className="k-impression">
          <div className="k-impression__col">
            <div className="k-impression__lbl">How you rate this — your choice</div>
            <div className="k-ratemode" role="tablist" aria-label="Rating method">
              {RATE_MODES.map((m) => (
                <button
                  key={m.key}
                  role="tab"
                  aria-selected={rateMode === m.key}
                  className={"k-ratemode__opt" + (rateMode === m.key ? " on" : "")}
                  onClick={() => onSetRateMode(entry.id, m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {rateMode === "glyphs" && (
              <>
                <div className="k-impression__lbl">Feeling — a glyph, never a number</div>
                <div className="k-feelpick">
                  {FEELING_KEYS.map((k) => (
                    <button
                      key={k}
                      className={entry.feeling === k ? "on" : ""}
                      style={entry.feeling === k ? { color: `var(--feel-${k})` } : undefined}
                      onClick={() => onSetFeeling(entry.id, entry.feeling === k ? null : k)}
                    >
                      <span style={{ color: `var(--feel-${k})` }}>
                        <Glyph feeling={k} set={glyphSet} size={22} />
                      </span>
                      <span>{FEELINGS[k].label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {rateMode === "axes" && (
              <>
                <div className="k-impression__lbl">Axes — facet by facet, kept private</div>
                <div className="k-dims">
                  {BASE_AXES.map((d) => (
                    <div className="k-dim" key={d}>
                      <span className="k-dim__name">{d}</span>
                      <div className="k-dim__pips">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span
                            key={n}
                            className={"k-dim__pip" + ((entry.dims[d] ?? 0) >= n ? " on" : "")}
                            onClick={() => onSetDim(entry.id, d, entry.dims[d] === n ? 0 : n)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  {customAxes.map((name) => (
                    <div className="k-dim k-dim--custom" key={name}>
                      <span className="k-dim__name">{name}</span>
                      <div className="k-dim__pips">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span
                            key={n}
                            className={"k-dim__pip" + ((entry.dims[name] ?? 0) >= n ? " on" : "")}
                            onClick={() => onSetDim(entry.id, name, (entry.dims[name] ?? 0) === n ? 0 : n)}
                          />
                        ))}
                      </div>
                      <button
                        className="k-dim__del"
                        title={`Remove “${name}” axis`}
                        aria-label={`Remove ${name} axis`}
                        onClick={() => onRemoveAxis(name)}
                      >
                        <Ico name="x" s={12} />
                      </button>
                    </div>
                  ))}
                  {axisDraft === null ? (
                    <button className="k-dim__addaxis" onClick={() => setAxisDraft("")}>
                      + add a personal axis
                    </button>
                  ) : (
                    <form
                      className="k-axisadd"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const n = axisDraft.trim();
                        if (n) onAddAxis(n);
                        setAxisDraft(null);
                      }}
                    >
                      <input
                        className="k-axisadd__input"
                        autoFocus
                        maxLength={24}
                        value={axisDraft}
                        placeholder="axis name — e.g. animation"
                        onChange={(e) => setAxisDraft(e.target.value)}
                        onKeyDown={(e) => e.key === "Escape" && setAxisDraft(null)}
                      />
                      <button type="submit" className="k-axisadd__ok">
                        Add
                      </button>
                      <button
                        type="button"
                        className="k-axisadd__cancel"
                        onClick={() => setAxisDraft(null)}
                      >
                        Cancel
                      </button>
                    </form>
                  )}
                </div>
              </>
            )}

            {rateMode === "symbols" && (
              <>
                <div className="k-impression__lbl">Symbols — stars, grades or moods, your pick</div>
                <div className="k-symstyle" role="tablist" aria-label="Symbol style">
                  {SYMBOL_KEYS.map((st) => (
                    <button
                      key={st}
                      role="tab"
                      aria-selected={symStyle === st}
                      className={"k-symstyle__opt" + (symStyle === st ? " on" : "")}
                      onClick={() => onSetSymbol(entry.id, { style: st, value: symValue })}
                    >
                      {SYMBOL_STYLES[st].label}
                    </button>
                  ))}
                </div>
                <div className={"k-symrate k-symrate--" + symStyle} role="radiogroup">
                  {[1, 2, 3, 4, 5].map((n) => {
                    const on = symStyle === "stars" ? symValue >= n : symValue === n;
                    const glyph =
                      symStyle === "stars" ? "★" : symStyle === "grades" ? GRADE_LETTERS[n] : MOOD_EMOJI[n];
                    return (
                      <button
                        key={n}
                        role="radio"
                        aria-checked={on}
                        aria-label={`${n} of 5`}
                        className={"k-sym" + (on ? " on" : "")}
                        onClick={() => setSymValue(n)}
                      >
                        {glyph}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="k-impression__col">
            <div className="k-impression__lbl">Your take — your overall notes, kept in your Journal</div>
            {entry.titleId ? (
              <TakeNotes
                key={entry.id}
                titleId={entry.titleId}
                initialTake={entry.take}
                onMirror={(body) => onSetTake(entry.id, body)}
              />
            ) : (
              <>
                <textarea
                  className="k-take"
                  value={entry.take}
                  placeholder="What did it make you feel? Write as much or as little as you like…"
                  onChange={(e) => onSetTake(entry.id, e.target.value)}
                />
                <div className="k-take-foot">
                  <span className="k-privacy">
                    <Ico name="lock" s={11} /> Private
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {entry.titleId && entry.episodes > 0 && (
          <EpisodeNotes
            titleId={entry.titleId}
            title={entry.title}
            episodes={entry.episodes}
            watched={watched}
            onToggleWatched={(ep) => onToggleWatched(entry.id, ep)}
            onMarkAll={() => onMarkAllWatched(entry.id)}
            onClear={() => onClearWatched(entry.id)}
          />
        )}

        {onRemove && (
          <div className="k-detail__danger">
            {confirmRemove ? (
              <>
                <span className="k-detail__danger-q">
                  Remove “{entry.title}” and your notes for it?
                </span>
                <button className="k-detail__danger-btn" onClick={() => onRemove(entry.id)}>
                  <Ico name="trash" s={13} /> Remove
                </button>
                <button
                  className="k-detail__danger-cancel"
                  onClick={() => setConfirmRemove(false)}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button className="k-detail__danger-btn" onClick={() => setConfirmRemove(true)}>
                <Ico name="trash" s={13} /> Remove from list
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
