"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { Badge } from "./badges";

const canPortal = () => typeof document !== "undefined";

// A quick, self-dismissing "Badge unlocked!" toast. Rendered via a portal to
// document.body so its position:fixed is viewport-relative (the profile's
// transformed ancestors would otherwise trap it). One badge at a time — the
// parent re-mounts this per badge (keyed) so each gets its own entrance.
export function BadgeCelebration({ badge, onDismiss }: { badge: Badge; onDismiss: () => void }) {
  const [leaving, setLeaving] = useState(false);

  // visible for ~4s, then play the exit and unmount
  useEffect(() => {
    const t = setTimeout(() => setLeaving(true), 4200);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(onDismiss, 420); // matches badgepop-out duration
    return () => clearTimeout(t);
  }, [leaving, onDismiss]);

  // The celebration is only ever mounted client-side (the parent queues it from
  // a localStorage effect after hydration), so guarding the portal is enough.
  if (!canPortal()) return null;

  return createPortal(
    <div className={"badgepop" + (leaving ? " badgepop--out" : "")} role="status" aria-live="polite">
      <button className="badgepop__card" onClick={() => setLeaving(true)} aria-label={`Dismiss — ${badge.label} unlocked`}>
        <span className="badgepop__iconwrap" aria-hidden="true">
          <span className="badgepop__burst" />
          <span className="badgepop__confetti">
            {Array.from({ length: 10 }).map((_, i) => (
              <i key={i} style={{ "--i": i } as CSSProperties} />
            ))}
          </span>
          <span className="badgepop__ico">{badge.icon}</span>
        </span>
        <span className="badgepop__meta">
          <span className="badgepop__kicker">Badge unlocked</span>
          <span className="badgepop__label">{badge.label}</span>
          <span className="badgepop__desc">{badge.desc}</span>
        </span>
      </button>
    </div>,
    document.body,
  );
}
