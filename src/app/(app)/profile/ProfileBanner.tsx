"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BannerCandidate } from "@/lib/profile";
import { setProfileBannerPosAction } from "./actions";
import { BannerPicker } from "./BannerPicker";

const DEFAULT_POS = "50% 32%";

// Owns the profile banner: renders the art with a saved framing, and the
// owner controls — "Customize" (drag to reposition the art so its key area is
// framed) and "Change banner" (the picker).
export function ProfileBanner({
  art,
  titleId,
  pos,
  candidates,
}: {
  art: string | null;
  titleId: string | null;
  pos: string | null;
  candidates: BannerCandidate[];
}) {
  const router = useRouter();
  const [moving, setMoving] = useState(false);
  // `open` = the menu's intent; `mounted` keeps the options in the DOM through
  // their exit animation so closing animates out too.
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [curPos, setCurPos] = useState(pos || DEFAULT_POS);
  const [savedPos, setSavedPos] = useState(pos || DEFAULT_POS);
  const [busy, setBusy] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const openMenu = () => { clearTimeout(closeTimer.current); setMounted(true); setOpen(true); };
  const closeMenu = () => {
    setOpen(false);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMounted(false), 220); // after the exit anim
  };
  const toggleMenu = () => (open ? closeMenu() : openMenu());

  // collapse the menu when clicking outside the controls
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (controlsRef.current?.contains(t as Node)) return;
      // the banner picker is portaled to <body>, so its clicks look "outside"
      // the controls — don't let interacting with it collapse the menu (which
      // would unmount the picker mid-search).
      if (t?.closest?.(".pfbp")) return;
      closeMenu();
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [open]);

  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const parse = (p: string): [number, number] => {
    const m = p.match(/(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/);
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : [50, 32];
  };

  const onDown = (e: React.PointerEvent) => {
    if (!moving) return;
    e.preventDefault(); // don't start a text selection while dragging the art
    const [px, py] = parse(curPos);
    drag.current = { x: e.clientX, y: e.clientY, px, py };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!moving || !drag.current || !bannerRef.current) return;
    const r = bannerRef.current.getBoundingClientRect();
    // dragging the art moves the visible window the opposite way (grab & pan)
    const nx = clamp(drag.current.px - ((e.clientX - drag.current.x) / r.width) * 100);
    const ny = clamp(drag.current.py - ((e.clientY - drag.current.y) / r.height) * 100);
    setCurPos(`${nx.toFixed(1)}% ${ny.toFixed(1)}%`);
  };
  const onUp = () => { drag.current = null; };

  const save = async () => {
    setBusy(true);
    try {
      await setProfileBannerPosAction(curPos);
      setSavedPos(curPos);
      setMoving(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };
  const cancel = () => { setCurPos(savedPos); setMoving(false); };

  return (
    <div
      ref={bannerRef}
      className={"pf-banner" + (art ? " pf-banner--art" : "") + (moving ? " pf-banner--moving" : "")}
      style={art ? { backgroundImage: `url(${art})`, backgroundPosition: curPos } : undefined}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {moving ? (
        <>
          <span className="pf-banner__movehint" aria-hidden="true">Drag the banner to reposition it</span>
          <div className="pf-banner__controls" onPointerDown={(e) => e.stopPropagation()}>
            <button className="pf-banner__edit" onClick={cancel} disabled={busy} type="button">Cancel</button>
            <button className="pf-banner__edit pf-banner__edit--primary" onClick={save} disabled={busy} type="button">
              {busy ? "Saving…" : "Save position"}
            </button>
          </div>
        </>
      ) : !art ? (
        // nothing to reposition yet — just offer the picker
        <div className="pf-banner__controls">
          <BannerPicker candidates={candidates} currentId={titleId} />
        </div>
      ) : (
        <div className="pf-banner__controls" ref={controlsRef}>
          {mounted && (
            <div className={"pf-banner__reveal" + (open ? "" : " pf-banner__reveal--closing")}>
              <BannerPicker candidates={candidates} currentId={titleId} />
              <button className="pf-banner__edit" onClick={() => { setMoving(true); setOpen(false); setMounted(false); }} type="button">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
                </svg>
                Reposition
              </button>
            </div>
          )}
          <button
            className={"pf-banner__edit" + (open ? " pf-banner__edit--on" : "")}
            onClick={toggleMenu}
            aria-expanded={open}
            type="button"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
            </svg>
            Customize
          </button>
        </div>
      )}
    </div>
  );
}
