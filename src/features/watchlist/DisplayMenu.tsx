"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ViewMode, LayoutMode } from "./types";

// One compact control that replaces the row of display + layout pills. Shows the
// current display; opens a small menu to switch display (and layout, when it
// applies).
const I = (d: ReactNode) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const ICONS: Record<ViewMode, ReactNode> = {
  cards: I(<><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>),
  list: I(<path d="M4 6h16M4 12h16M4 18h16" />),
  hybrid: I(<><rect x="3" y="4" width="18" height="7" rx="1.5" /><path d="M4 15h16M4 19h10" /></>),
};
const DISPLAYS: { v: ViewMode; label: string; hint: string }[] = [
  { v: "cards", label: "Cards", hint: "Poster tiles" },
  { v: "list", label: "Rows", hint: "Compact rows" },
  { v: "hybrid", label: "Hybrid", hint: "Row + excerpt" },
];

export function DisplayMenu({
  display,
  layout,
  showLayout,
  onDisplay,
  onLayout,
  cardMin,
  cardMinLo,
  cardMinHi,
  onCardMin,
}: {
  display: ViewMode;
  layout: LayoutMode;
  showLayout: boolean;
  onDisplay: (v: ViewMode) => void;
  onLayout: (l: LayoutMode) => void;
  cardMin: number;
  cardMinLo: number;
  cardMinHi: number;
  onCardMin: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const current = DISPLAYS.find((d) => d.v === display) ?? DISPLAYS[0];

  return (
    <div className="dm" ref={ref}>
      <button type="button" className={"dm__btn" + (open ? " on" : "")} onClick={() => setOpen((o) => !o)} aria-expanded={open} title="Change how titles are shown">
        {ICONS[display]}
        <span className="dm__cur">{current.label}</span>
        <span className="dm__car">▾</span>
      </button>
      {open && (
        <div className="dm__menu" role="menu">
          <div className="dm__sec">Display</div>
          {DISPLAYS.map((d) => (
            <button
              key={d.v}
              type="button"
              className={"dm__item" + (display === d.v ? " on" : "")}
              onClick={() => {
                onDisplay(d.v);
                setOpen(false);
              }}
            >
              <span className="dm__ico">{ICONS[d.v]}</span>
              <span className="dm__txt">
                <span className="dm__lbl">{d.label}</span>
                <span className="dm__hint">{d.hint}</span>
              </span>
              {display === d.v && <span className="dm__check">✓</span>}
            </button>
          ))}
          {/* Overall scale. Lives in this menu (not the toolbar) to keep the
              bar uncluttered — it's already the "how titles are shown" control. */}
          <div className="dm__sec dm__sec--div">Size</div>
          <div className="dm__size">
            <span className="dm__sizeg dm__sizeg--sm" aria-hidden="true" />
            <input
              className="dm__range"
              type="range"
              min={cardMinLo}
              max={cardMinHi}
              step={2}
              value={cardMin}
              onChange={(e) => onCardMin(Number(e.target.value))}
              aria-label="Card size — smaller fits more per row"
            />
            <span className="dm__sizeg dm__sizeg--lg" aria-hidden="true" />
          </div>
          <div className="dm__note">Smaller fits more per row</div>
          {showLayout && (
            <>
              <div className="dm__sec dm__sec--div">Arrangement</div>
              {([["stack", "Stacked"], ["grid", "Free-form"]] as [LayoutMode, string][]).map(([l, lbl]) => (
                <button
                  key={l}
                  type="button"
                  className={"dm__item" + (layout === l ? " on" : "")}
                  onClick={() => {
                    onLayout(l);
                    setOpen(false);
                  }}
                >
                  <span className="dm__ico">{l === "stack" ? I(<><rect x="4" y="5" width="16" height="4" rx="1" /><rect x="4" y="11" width="16" height="4" rx="1" /></>) : I(<><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="5" rx="1" /><rect x="4" y="14" width="7" height="5" rx="1" /><rect x="13" y="11" width="7" height="8" rx="1" /></>)}</span>
                  <span className="dm__txt"><span className="dm__lbl">{lbl}</span></span>
                  {layout === l && <span className="dm__check">✓</span>}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
