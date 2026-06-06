"use client";

import { Fragment } from "react";
import { useRouter } from "next/navigation";
import { HUES, hueValue } from "@/lib/palette";
import { relTime } from "@/lib/format";
import type { Watchlist } from "@/lib/storage";
import type { HueKey } from "@/lib/palette";

type Props = {
  list: Watchlist;
  huePopOpen: boolean;
  removing: boolean;
  onTogglePin: (id: string) => void;
  onToggleHuePop: (id: string) => void;
  onSetHue: (id: string, hue: HueKey) => void;
  onAskDelete: (id: string, title: string) => void;
  /** called once the is-removing transition finishes, to commit the delete */
  onRemoved: (id: string) => void;
};

export function WatchlistCard({
  list,
  huePopOpen,
  removing,
  onTogglePin,
  onToggleHuePop,
  onSetHue,
  onAskDelete,
  onRemoved,
}: Props) {
  const router = useRouter();
  const href = `/watchlist/${encodeURIComponent(list.id)}`;
  const isPinned = !!list.pinned;
  const count = list.titleCount || 0;

  const fanCount = Math.min(6, Math.max(2, 2 + (count % 5)));
  const eyebrow = count ? `Active · ${count} titles` : "Empty · ready to fill";
  const stats = [
    `${count} title${count === 1 ? "" : "s"}`,
    list.watching ? `${list.watching} watching` : null,
    `edited ${relTime(list.lastEdited)}`,
  ].filter(Boolean) as string[];

  const open = () => router.push(href);

  return (
    <div
      className={
        "wl-card" + (isPinned ? " is-pinned" : "") + (removing ? " is-removing" : "")
      }
      style={{ "--wl-hue": hueValue(list.hue) } as React.CSSProperties}
      role="link"
      tabIndex={0}
      aria-label={list.title}
      data-id={list.id}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      onTransitionEnd={(e) => {
        // commit the delete only when the card's own transform settles
        if (removing && e.propertyName === "transform") onRemoved(list.id);
      }}
    >
      <div className="wl-card__hero" aria-hidden="true">
        <span className="wl-card__hero-eyebrow">{eyebrow}</span>
        <div className="wl-card__fan">
          {Array.from({ length: fanCount }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      </div>

      <div className="wl-card__body">
        <div className="wl-card__title-row">
          <h3 className="wl-card__title">{list.title}</h3>
          <span className="wl-card__pin" title="Pinned" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 17v5l-3-3 3-2zm5-15v6l3 3-3 1-2 5-5-5-5 1 3-3V2h9z" />
            </svg>
          </span>
        </div>
        <p className="wl-card__desc">{list.desc}</p>
        <div className="wl-card__stats">
          {stats.map((s, i) => (
            <Fragment key={i}>
              {i ? <span className="sep" /> : null}
              <span>{s}</span>
            </Fragment>
          ))}
        </div>
      </div>

      {/* hue picker popover */}
      <div className={"wl-card__hue-pop" + (huePopOpen ? " on" : "")} data-pop="hue">
        {HUES.map((h) => (
          <span
            key={h.key}
            className={"wl-card__hue-swatch" + (list.hue === h.key ? " on" : "")}
            data-hue={h.key}
            style={{ "--swatch": h.value } as React.CSSProperties}
            title={h.label}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSetHue(list.id, h.key);
            }}
          />
        ))}
      </div>

      <div className="wl-card__foot">
        <button
          className="wl-card__action"
          data-act="pin"
          type="button"
          aria-label={`${isPinned ? "Unpin" : "Pin"} ${list.title}`}
          title={isPinned ? "Unpin" : "Pin to top"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTogglePin(list.id);
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill={isPinned ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 17v5" />
            <path d="M5 13l7-11 7 11-3 1-2 5-2-5-7-1z" />
          </svg>
        </button>
        <button
          className="wl-card__action"
          data-act="hue"
          type="button"
          aria-label="Accent color"
          title="Pick accent color"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleHuePop(list.id);
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3a9 9 0 0 0 0 18M3 12h18" />
          </svg>
        </button>
        <button
          className="wl-card__action"
          data-act="del"
          type="button"
          aria-label={`Delete ${list.title}`}
          title="Delete list"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAskDelete(list.id, list.title);
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
        <span className="open">
          Open{" "}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </div>
  );
}
