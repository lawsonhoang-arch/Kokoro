"use client";

import { colorFor, tagsFor } from "./rules";
import { EXTERNAL_SCORES, avgRatingStr, abbrev, posterStyleFor } from "./helpers";
import { Glyph } from "./Glyph";
import { AddToTabBtn } from "./AddToTabBtn";
import type { EntryCommon } from "./EntryRow";
import type { ViewMode } from "./types";

type Props = EntryCommon & { view: ViewMode };

export function EntryCard({
  entry,
  colorKey,
  tagKeys,
  glyphSet,
  showScore,
  selected,
  view,
  collections,
  inGroupId,
  onAddTab,
  onNewTab,
  onRemoveTab,
  onRemoveFromList,
  onBrowseGrab,
  onBumpEp,
}: Props) {
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
        style={{ viewTransitionName: "entry-" + entry.id }}
        onPointerDown={(e) => onBrowseGrab && onBrowseGrab(e, entry.id)}
      >
        {color && <span className="k-hybrid__stripe" style={{ background: color }} />}
        <div className="k-hybrid__art" style={poster}>
          {entry.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.cover}
              alt=""
              referrerPolicy="no-referrer"
              loading="lazy"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}
          {entry.feeling && (
            <span className="k-hybrid__feel" style={{ color: `var(--feel-${entry.feeling})` }}>
              <Glyph feeling={entry.feeling} set={glyphSet} size={14} />
            </span>
          )}
        </div>
        <div className="k-hybrid__body">
          <div className="k-hybrid__top">
            <div className="k-hybrid__title">{entry.title}</div>
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
      style={{ viewTransitionName: "entry-" + entry.id }}
      onPointerDown={(e) => onBrowseGrab && onBrowseGrab(e, entry.id)}
    >
      <div className="k-card__art" style={poster}>
        {entry.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.cover}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        {color && <span className="k-card__stripe" style={{ background: color }} />}
        {entry.feeling && (
          <span className="k-card__feel" style={{ color: `var(--feel-${entry.feeling})` }}>
            <Glyph feeling={entry.feeling} set={glyphSet} size={16} />
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
