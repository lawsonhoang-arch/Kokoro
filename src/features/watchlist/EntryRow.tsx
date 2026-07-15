"use client";

import type { PointerEvent as RPointerEvent } from "react";
import { colorFor, tagsFor } from "./rules";
import { EXTERNAL_SCORES, avgRatingStr } from "./helpers";
import { RatingMark, hasMark, markColor } from "./RatingMark";
import { AddToTabBtn, type Collection } from "./AddToTabBtn";
import { Ico } from "./Ico";
import type { Entry, GlyphSet, Mode } from "./types";

export type EntryCommon = {
  entry: Entry;
  colorKey: string | null;
  tagKeys: string[];
  glyphSet: GlyphSet;
  showScore: boolean;
  selected: boolean;
  onOpen: (id: string) => void;
  collections: Collection[];
  inGroupId: string | null;
  onAddTab: (entryId: string, gid: string) => void;
  onNewTab: (entryId: string) => void;
  onRemoveTab: (entryId: string) => void;
  onRemoveFromList: (entryId: string) => void;
  onBrowseGrab?: (e: RPointerEvent, id: string, fromGrip?: boolean) => void;
  onBumpEp?: (id: string) => void;
};

type Props = EntryCommon & {
  mode: Mode;
  onGrab: (e: RPointerEvent, id: string) => void;
};

export function EntryRow({
  entry,
  colorKey,
  tagKeys,
  glyphSet,
  showScore,
  mode,
  selected,
  onGrab,
  onBrowseGrab,
  collections,
  inGroupId,
  onAddTab,
  onNewTab,
  onRemoveTab,
  onRemoveFromList,
  onBumpEp,
}: Props) {
  const color = colorFor(entry, colorKey);
  const tags = tagsFor(entry, tagKeys);
  const ext = EXTERNAL_SCORES[entry.id];
  const rating = avgRatingStr(entry);
  const sculpt = mode === "sculpt";

  return (
    <div
      className={
        "k-entry" + (color ? " colored" : "") + (selected ? " selected" : "") + (!sculpt ? " clickable" : "")
      }
      data-entry-id={entry.id}
      data-drop="entry"
      onPointerDown={
        sculpt
          ? (e) => { if (e.pointerType !== "touch") onGrab(e, entry.id); }
          : (e) => onBrowseGrab && onBrowseGrab(e, entry.id)
      }
      style={{
        // Scope the transition name to the view mode so switching FORMAT
        // (list <-> cards <-> hybrid) cross-fades instead of morphing a row
        // into a card (that size stretch looked bad). Same-format changes
        // (tab / layout) keep the same name, so those still move smoothly.
        viewTransitionName: "entry-list-" + entry.id,
        ...(sculpt ? { cursor: "grab" } : null),
      }}
    >
      <span
        className="k-entry__grip"
        title="Drag to move"
        aria-label="Drag to move"
        onPointerDown={(e) => {
          e.stopPropagation();
          if (sculpt) onGrab(e, entry.id);
          else onBrowseGrab && onBrowseGrab(e, entry.id, true);
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Ico name="grip" s={15} />
      </span>
      <span className="k-entry__stripe" style={color ? { background: color, color } : undefined} />
      <span
        className="k-entry__glyph"
        style={{ color: hasMark(entry) ? markColor(entry) : "var(--ink-faint)" }}
      >
        <RatingMark entry={entry} glyphSet={glyphSet} size={20} />
      </span>
      <div className="k-entry__main">
        <div className="k-entry__title">{entry.title}</div>
        <div className="k-entry__sub">
          <span>{entry.year}</span>
          <span className="dot" />
          <span>{entry.genres.slice(0, 2).join(" · ")}</span>
          {entry.status === "watching" && entry.progress != null && (
            <>
              <span className="dot" />
              <span className="k-prog" onPointerDown={(e) => e.stopPropagation()}>
                <span className="k-prog__bar">
                  <span
                    className="k-prog__fill"
                    style={{ width: `${Math.round((entry.progress / entry.episodes) * 100)}%` }}
                  />
                </span>
                <span className="k-prog__num">
                  {entry.progress}/{entry.episodes}
                </span>
                {!sculpt && onBumpEp && entry.progress < entry.episodes && (
                  <button
                    className="k-prog__bump"
                    title="Log next episode"
                    onClick={(e) => {
                      e.stopPropagation();
                      onBumpEp(entry.id);
                    }}
                  >
                    +1
                  </button>
                )}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="k-tags">
        {rating && (
          <span className="k-rating" title={`Your rating: ${rating}/5`}>
            <span className="k-rating__star">★</span>
            {rating}
          </span>
        )}
        {showScore && ext != null && (
          <span className="k-extscore">
            ext <b>{ext.toFixed(1)}</b>
          </span>
        )}
        {tags.map((t, i) => (
          <span
            key={i}
            className={"k-tag" + (t.kind === "feel" ? " k-tag--feel" : "")}
            style={t.kind === "feel" && t.feeling ? { color: `var(--feel-${t.feeling})` } : undefined}
            title={t.text}
          >
            {t.text}
          </span>
        ))}
      </div>
      {!sculpt && onAddTab && (
        <span className="k-entry__add" onPointerDown={(e) => e.stopPropagation()}>
          <AddToTabBtn
            entryId={entry.id}
            collections={collections}
            inGroupId={inGroupId}
            onAdd={onAddTab}
            onNew={onNewTab}
            onRemove={onRemoveTab}
            onRemoveFromList={onRemoveFromList}
          />
        </span>
      )}
    </div>
  );
}
