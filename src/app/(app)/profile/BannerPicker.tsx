"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { BannerCandidate } from "@/lib/profile";
import { setProfileBannerAction } from "./actions";

// Owner-only control on the profile banner: pick which anime/manga's art fills
// the banner, from the titles the user tracks / favorites / has finished.
export function BannerPicker({ candidates, currentId }: { candidates: BannerCandidate[]; currentId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? candidates.filter((c) => c.title.toLowerCase().includes(s)) : candidates;
  }, [q, candidates]);

  const choose = async (id: string | null) => {
    if (busy) return;
    setBusy(true);
    try {
      await setProfileBannerAction(id);
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="pf-banner__edit" onClick={() => setOpen(true)} type="button">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="10" r="1.6" />
          <path d="m21 16-5-5L5 19" />
        </svg>
        Change banner
      </button>

      {open && createPortal(
        <div className="pfbp" role="dialog" aria-modal="true" aria-label="Choose a banner" onClick={() => !busy && setOpen(false)}>
          <div className={"pfbp__card" + (busy ? " pfbp__card--busy" : "")} onClick={(e) => e.stopPropagation()}>
            <div className="pfbp__head">
              <h2>Choose a banner</h2>
              <button className="pfbp__x" onClick={() => setOpen(false)} aria-label="Close" type="button">✕</button>
            </div>
            <input
              className="pfbp__search"
              placeholder="Filter your titles…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            {candidates.length === 0 ? (
              <p className="pfbp__empty">
                Add anime or manga to your lists or favorites, then pick a banner from their art.
              </p>
            ) : (
              <div className="pfbp__grid">
                <button
                  type="button"
                  className={"pfbp__tile pfbp__tile--default" + (currentId === null ? " on" : "")}
                  onClick={() => choose(null)}
                  disabled={busy}
                >
                  <span className="pfbp__art pfbp__art--default" />
                  <span className="pfbp__cap">Default gradient</span>
                </button>
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={"pfbp__tile" + (currentId === c.id ? " on" : "")}
                    onClick={() => choose(c.id)}
                    disabled={busy}
                    title={c.title}
                  >
                    <span className="pfbp__art" style={{ backgroundImage: `url(${c.art})` }} />
                    <span className="pfbp__cap">{c.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
