"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { AvatarTitle, Character } from "@/lib/profile";
import { setAvatarAction, getTitleCharactersAction } from "./actions";

// Pick a profile avatar from catalog character art: choose one of your titles,
// then a character from it. Stores the character's image URL on the user.
export function AvatarPicker({ titles, current }: { titles: AvatarTitle[]; current: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<AvatarTitle | null>(null);
  const [chars, setChars] = useState<Character[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? titles.filter((t) => t.title.toLowerCase().includes(s)) : titles;
  }, [q, titles]);

  const reset = () => { setSel(null); setChars(null); setQ(""); };
  const close = () => { if (!busy) { setOpen(false); reset(); } };

  const pickTitle = async (t: AvatarTitle) => {
    setSel(t);
    setChars(null);
    setLoading(true);
    try {
      setChars(await getTitleCharactersAction(t.id));
    } finally {
      setLoading(false);
    }
  };

  const choose = async (image: string | null) => {
    if (busy) return;
    setBusy(true);
    try {
      await setAvatarAction(image);
      setOpen(false);
      reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const gen = (seed: string): React.CSSProperties => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    const a = Math.abs(h) % 360;
    return { background: `linear-gradient(135deg, oklch(0.5 0.13 ${a}), oklch(0.34 0.12 ${(a + 40) % 360}))` };
  };

  return (
    <>
      <button className="pf-avatar__edit" onClick={() => setOpen(true)} type="button" title="Change avatar" aria-label="Change avatar">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
      </button>

      {open && createPortal(
        <div className="pfbp" role="dialog" aria-modal="true" aria-label="Choose an avatar" onClick={close}>
          <div className={"pfbp__card" + (busy ? " pfbp__card--busy" : "")} onClick={(e) => e.stopPropagation()}>
            <div className="pfbp__head">
              <div className="pfbp__headleft">
                {sel && (
                  <button className="pfbp__back" onClick={reset} type="button" aria-label="Back to titles">←</button>
                )}
                <h2>{sel ? sel.title : "Choose an avatar"}</h2>
              </div>
              <button className="pfbp__x" onClick={close} aria-label="Close" type="button">✕</button>
            </div>

            {!sel ? (
              titles.length === 0 ? (
                <p className="pfbp__empty">Add anime or manga to your lists or favorites, then pick a character from one.</p>
              ) : (
                <>
                  <input className="pfbp__search" placeholder="Filter your titles…" value={q} onChange={(e) => setQ(e.target.value)} />
                  <div className="avp__grid">
                    <button className={"avp__tile avp__tile--default" + (current === null ? " on" : "")} onClick={() => choose(null)} disabled={busy} type="button">
                      <span className="avp__art avp__art--default" />
                      <span className="avp__cap">Default</span>
                    </button>
                    {filtered.map((t) => (
                      <button key={t.id} className="avp__tile" onClick={() => pickTitle(t)} disabled={busy} type="button" title={t.title}>
                        <span className="avp__art" style={t.cover ? { backgroundImage: `url(${t.cover})` } : gen(t.id)} />
                        <span className="avp__cap">{t.title}</span>
                      </button>
                    ))}
                  </div>
                </>
              )
            ) : loading ? (
              <p className="pfbp__empty">Loading characters…</p>
            ) : !chars || chars.length === 0 ? (
              <p className="pfbp__empty">No character art found for this title.</p>
            ) : (
              <div className="avp__grid avp__grid--chars">
                {chars.map((c) => (
                  <button key={c.image} className={"avp__tile" + (current === c.image ? " on" : "")} onClick={() => choose(c.image)} disabled={busy} type="button" title={c.name}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <span className="avp__art"><img src={c.image} alt="" referrerPolicy="no-referrer" loading="lazy" /></span>
                    <span className="avp__cap">{c.name}</span>
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
