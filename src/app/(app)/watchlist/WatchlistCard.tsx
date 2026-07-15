"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HUES, hueValue } from "@/lib/palette";
import { relTime } from "@/lib/format";
import type { Watchlist } from "@/lib/storage";
import type { HueKey } from "@/lib/palette";

type Props = {
  list: Watchlist;
  removing: boolean;
  onTogglePin: (id: string) => void;
  onSetHue: (id: string, hue: HueKey) => void;
  onEdit: (list: Watchlist) => void;
  onAskDelete: (id: string, title: string) => void;
  onImport: () => void;
  /** called once the is-removing transition finishes, to commit the delete */
  onRemoved: (id: string) => void;
};

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function MenuIcon({ kind }: { kind: "edit" | "json" | "csv" | "import" | "trash" }) {
  if (kind === "edit")
    return <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
  if (kind === "json")
    return <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M12 12v6M9 15l3 3 3-3" /></svg>;
  if (kind === "csv")
    return <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16M15 4v16" /></svg>;
  if (kind === "import")
    return <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}><path d="M12 15V3M8 7l4-4 4 4" /><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></svg>;
  return <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>;
}

export function WatchlistCard({ list, removing, onTogglePin, onSetHue, onEdit, onAskDelete, onImport, onRemoved }: Props) {
  const router = useRouter();
  const href = `/watchlist/${encodeURIComponent(list.id)}`;
  const isPinned = !!list.pinned;
  const count = list.titleCount || 0;
  const covers = list.covers ?? [];
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const monogram = (list.title.trim()[0] || "?").toUpperCase();
  const open = () => router.push(href);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  // stop a control click from also triggering the card's open()
  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

  return (
    <div
      ref={rootRef}
      className={"wl-card" + (isPinned ? " is-pinned" : "") + (removing ? " is-removing" : "") + (menuOpen ? " is-menu" : "")}
      style={{ "--wl-hue": hueValue(list.hue) } as React.CSSProperties}
      role="link"
      tabIndex={0}
      aria-label={list.title}
      data-id={list.id}
      onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
      onTransitionEnd={(e) => { if (removing && e.propertyName === "transform") onRemoved(list.id); }}
    >
      <div className="wl-card__cover" aria-hidden="true">
        {covers.length >= 4 ? (
          <div className="wl-card__mosaic">
            {covers.slice(0, 4).map((c, i) => (
              <span key={i} className="wl-card__tile" style={{ backgroundImage: `url(${c})` }} />
            ))}
          </div>
        ) : covers.length > 0 ? (
          <span className="wl-card__single" style={{ backgroundImage: `url(${covers[0]})` }} />
        ) : (
          <span className="wl-card__mono">{monogram}</span>
        )}
      </div>

      <span className="wl-card__eyebrow">{count ? "Active" : "Empty"}</span>
      <button
        className="wl-card__pinbtn"
        type="button"
        title={isPinned ? "Unpin" : "Pin to top"}
        aria-label={isPinned ? `Unpin ${list.title}` : `Pin ${list.title}`}
        onClick={(e) => { stop(e); onTogglePin(list.id); }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill={isPinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3h12a1 1 0 0 1 1 1v16.2a.6.6 0 0 1-.9.52L12 18l-6.1 2.72A.6.6 0 0 1 5 20.2V4a1 1 0 0 1 1-1z" />
        </svg>
      </button>

      <div className="wl-card__panel">
        <div className="wl-card__head">
          <h3 className="wl-card__title">{list.title}</h3>
          <p className="wl-card__desc">{list.desc || "No description yet."}</p>
        </div>

        <div className="wl-card__reveal">
          <div className="wl-card__stats">
            <span className="wl-card__stat"><b>{count}</b>{count === 1 ? " title" : " titles"}</span>
            {list.watching ? <span className="wl-card__stat"><b>{list.watching}</b> watching</span> : null}
            <span className="wl-card__stat wl-card__stat--muted">{relTime(list.lastEdited)}</span>
          </div>
          <div className="wl-card__foot">
            <button
              className="wl-card__more"
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="List options"
              title="List options"
              onClick={(e) => { stop(e); setMenuOpen((v) => !v); }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="19" cy="12" r="1.9" /></svg>
            </button>
            <span className="wl-card__open">
              Open
              <svg width="13" height="13" viewBox="0 0 24 24" {...stroke} strokeWidth={2}><path d="M5 12h14M13 5l7 7-7 7" /></svg>
            </span>
          </div>
        </div>
      </div>

      <div className={"wl-card__menu" + (menuOpen ? " on" : "")} role="menu" onClick={(e) => e.stopPropagation()}>
        <div className="wl-card__menu-sec">Accent color</div>
        <div className="wl-card__hues">
          {HUES.map((h) => (
            <button
              key={h.key}
              type="button"
              className={"wl-card__swatch" + (list.hue === h.key ? " on" : "")}
              style={{ "--swatch": h.value } as React.CSSProperties}
              title={h.label}
              aria-label={h.label}
              onClick={(e) => { stop(e); onSetHue(list.id, h.key); }}
            />
          ))}
        </div>

        <div className="wl-card__menu-div" />
        <button role="menuitem" className="wl-card__menu-item" type="button" onClick={(e) => { stop(e); setMenuOpen(false); onEdit(list); }}>
          <MenuIcon kind="edit" /> Rename &amp; edit…
        </button>
        <a role="menuitem" className="wl-card__menu-item" href={`/export?format=json&list=${encodeURIComponent(list.id)}`} download onClick={(e) => e.stopPropagation()}>
          <MenuIcon kind="json" /> Export this list · JSON
        </a>
        <a role="menuitem" className="wl-card__menu-item" href={`/export?format=csv&list=${encodeURIComponent(list.id)}`} download onClick={(e) => e.stopPropagation()}>
          <MenuIcon kind="csv" /> Export this list · CSV
        </a>
        <button role="menuitem" className="wl-card__menu-item" type="button" onClick={(e) => { stop(e); setMenuOpen(false); onImport(); }}>
          <MenuIcon kind="import" /> Import a list…
        </button>

        <div className="wl-card__menu-div" />
        <button role="menuitem" className="wl-card__menu-item wl-card__menu-item--danger" type="button" onClick={(e) => { stop(e); setMenuOpen(false); onAskDelete(list.id, list.title); }}>
          <MenuIcon kind="trash" /> Delete list
        </button>
      </div>
    </div>
  );
}
