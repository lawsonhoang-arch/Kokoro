"use client";

import { colorFor, tagsFor } from "./rules";
import { EXTERNAL_SCORES, avgRatingStr, abbrev, posterStyleFor } from "./helpers";
import { RatingMark, hasMark, markColor } from "./RatingMark";
import { AddToTabBtn } from "./AddToTabBtn";
import { Ico } from "./Ico";
import type { EntryCommon } from "./EntryRow";
import type { ViewMode, Mode } from "./types";
import type { PointerEvent as RPointerEvent } from "react";

type Props = EntryCommon & {
  view: ViewMode;
  size?: string;
  onResize?: () => void;
  mode?: Mode;
  onGrab?: (e: RPointerEvent, id: string) => void;
};

export function EntryCard({
  entry,
  colorKey,
  tagKeys,
  glyphSet,
  showScore,
  selected,
  view,
  size,
  onResize,
  mode,
  onGrab,
  collections,
  inGroupId,
  onAddTab,
  onNewTab,
  onRemoveTab,
  onRemoveFromList,
  onBrowseGrab,
  onBumpEp,
}: Props) {
  // In Shape mode a card is grabbed for the sculpt drag (move it between boxes /
  // reorder); in browse it's the browse-grab (open / reorder). On touch, drag is
  // reserved to the grip so the card body can scroll/tap — the row body only
  // starts a drag for mouse/pen (desktop) or, in browse, defers to the move guard.
  const onPointerDownCard = (e: RPointerEvent) => {
    if (mode === "sculpt") { if (e.pointerType !== "touch") onGrab?.(e, entry.id); }
    else onBrowseGrab?.(e, entry.id);
  };
  const grip = (
    <span
      className="k-card__grip"
      title="Drag to move"
      aria-label="Drag to move"
      onPointerDown={(e) => {
        e.stopPropagation();
        if (mode === "sculpt") onGrab?.(e, entry.id);
        else onBrowseGrab?.(e, entry.id, true);
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <Ico name="grip" s={14} />
    </span>
  );
  const resizeBtn = onResize ? (
    <button
      className="k-card__resize"
      title="Resize this card"
      aria-label="Resize this card"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onResize();
      }}
    >
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
      </svg>
    </button>
  ) : null;
  const color = colorFor(entry, colorKey);
  const tags = tagsFor(entry, tagKeys);
  const ext = EXTERNAL_SCORES[entry.id];
  const rating = avgRatingStr(entry);
  const watching = entry.status === "watching" && entry.progress != null;
  const poster = posterStyleFor(entry);

  const addBtn = (
    <AddToTabBtn
      entryId={entry.id}
      collections={collections}
      inGroupId={inGroupId}
      onAdd={onAddTab}
      onNew={onNewTab}
      onRemove={onRemoveTab}
      onRemoveFromList={onRemoveFromList}
    />
  );

  const tagRow = (
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
          {abbrev(t.text, 11)}
        </span>
      ))}
    </div>
  );

  const progBlock = watching && entry.progress != null && (
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
      {onBumpEp && entry.progress < entry.episodes && (
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
  );

  if (view === "hybrid") {
    return (
      <div
        className={"k-hybrid" + (color ? " colored" : "") + (selected ? " selected" : "")}
        style={{ viewTransitionName: "entry-" + view + "-" + entry.id }}
        data-entry-id={entry.id}
        data-drop="entry"
        data-size={size && size !== "reg" ? size : undefined}
        onPointerDown={onPointerDownCard}
        onDragStart={(e) => e.preventDefault()}
      >
        {color && <span className="k-hybrid__stripe" style={{ background: color }} />}
        {grip}
        <div className="k-hybrid__art" style={poster}>
          {entry.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.cover}
              alt=""
              referrerPolicy="no-referrer"
              loading="lazy"
              draggable={false}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}
          {hasMark(entry) && (
            <span className="k-hybrid__feel" style={{ color: markColor(entry) }}>
              <RatingMark entry={entry} glyphSet={glyphSet} size={14} />
            </span>
          )}
        </div>
        <div className="k-hybrid__body">
          <div className="k-hybrid__top">
            <div className="k-hybrid__title">{entry.title}</div>
            {resizeBtn}
            <span className="k-hybrid__add">{addBtn}</span>
          </div>
          <div className="k-entry__sub">
            <span>{entry.year}</span>
            <span className="dot" />
            <span>{entry.genres.slice(0, 3).join(" · ")}</span>
            {watching && (
              <>
                <span className="dot" />
                {progBlock}
              </>
            )}
          </div>
          {entry.take ? (
            <p className="k-hybrid__take">{entry.take}</p>
          ) : (
            <p className="k-hybrid__take k-hybrid__take--empty">No impression written yet.</p>
          )}
          {tagRow}
        </div>
      </div>
    );
  }

  return (
    <div
      className={"k-card" + (selected ? " selected" : "")}
      style={{ viewTransitionName: "entry-" + view + "-" + entry.id }}
      data-entry-id={entry.id}
      data-drop="entry"
      data-size={size && size !== "reg" ? size : undefined}
      onPointerDown={onPointerDownCard}
      onDragStart={(e) => e.preventDefault()}
    >
      {grip}
      <div className="k-card__art" style={poster}>
        {resizeBtn}
        {entry.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.cover}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            draggable={false}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        {color && <span className="k-card__stripe" style={{ background: color }} />}
        {hasMark(entry) && (
          <span className="k-card__feel" style={{ color: markColor(entry) }}>
            <RatingMark entry={entry} glyphSet={glyphSet} size={16} />
          </span>
        )}
        <span className="k-card__add">{addBtn}</span>
        <div className="k-card__glyph">
          <span>{entry.episodes} ep</span>
          {entry.genres[0] && (
            <>
              <span style={{ opacity: 0.5 }}>·</span>
              <span>{entry.genres[0]}</span>
            </>
          )}
        </div>
      </div>
      <div className="k-card__body">
        <div className="k-card__title">{entry.title}</div>
        {progBlock}
        {(showScore || tags.length > 0) && tagRow}
      </div>
    </div>
  );
}
