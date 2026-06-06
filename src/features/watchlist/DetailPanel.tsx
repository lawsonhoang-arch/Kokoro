"use client";

import { useState } from "react";
import { FEELINGS } from "./data";
import { EXTERNAL_SCORES } from "./helpers";
import { Glyph } from "./Glyph";
import { Ico } from "./Ico";
import { DescriptionSection } from "@/features/submissions/DescriptionSection";
import type { Entry, Feeling, GlyphSet } from "./types";

const DIM_NAMES: (keyof Entry["dims"])[] = ["story", "art", "music", "pacing"];
const FEELING_KEYS = Object.keys(FEELINGS) as Feeling[];

type Props = {
  entry: Entry;
  glyphSet: GlyphSet;
  showScore: boolean;
  onClose: () => void;
  onSetFeeling: (id: string, f: Feeling | null) => void;
  onSetDim: (id: string, d: keyof Entry["dims"], v: number) => void;
  onSetTake: (id: string, v: string) => void;
  onRemove?: (id: string) => void;
};

export function DetailPanel({
  entry,
  glyphSet,
  showScore,
  onClose,
  onSetFeeling,
  onSetDim,
  onSetTake,
  onRemove,
}: Props) {
  const ext = EXTERNAL_SCORES[entry.id];
  const [confirmRemove, setConfirmRemove] = useState(false);
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

            <div className="k-impression__lbl">Your axes — optional, private</div>
            <div className="k-dims">
              {DIM_NAMES.map((d) => (
                <div className="k-dim" key={d}>
                  <span className="k-dim__name">{d}</span>
                  <div className="k-dim__pips">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span
                        key={n}
                        className={"k-dim__pip" + (entry.dims[d] >= n ? " on" : "")}
                        onClick={() => onSetDim(entry.id, d, entry.dims[d] === n ? 0 : n)}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <button className="k-dim__addaxis">+ add a personal axis</button>
            </div>
          </div>

          <div className="k-impression__col">
            <div className="k-impression__lbl">Your take — feeds recommendations</div>
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
              <span>Markdown · spoiler-flag with ||…||</span>
            </div>
          </div>
        </div>

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
