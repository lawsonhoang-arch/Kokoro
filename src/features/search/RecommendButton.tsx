"use client";

import { useEffect, useRef, useState } from "react";
import { getRecommendTargetsAction, recommendTitleAction, type RecommendFriend } from "@/app/(app)/anime/actions";

// Recommend a title to friends — lands in their notification bell (no DM).
export function RecommendButton({ titleId }: { titleId: string }) {
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<RecommendFriend[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(0);
  const wrapRef = useRef<HTMLSpanElement>(null);

  // load the friend list the first time the panel opens
  useEffect(() => {
    if (!open || friends !== null) return;
    getRecommendTargetsAction().then(setFriends).catch(() => setFriends([]));
  }, [open, friends]);

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const send = async () => {
    if (busy || picked.size === 0) return;
    setBusy(true);
    try {
      const r = await recommendTitleAction(titleId, [...picked], note);
      setSent(r.sent);
      setPicked(new Set());
      setNote("");
      setTimeout(() => setOpen(false), 900);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="rec-wrap" ref={wrapRef}>
      <button
        className={"anime-linkbtn" + (open ? " anime-linkbtn--on" : "")}
        onClick={() => {
          setSent(0);
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        title="Recommend to a friend"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 12v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8" />
          <path d="M12 3v13" />
          <path d="m7 8 5-5 5 5" />
        </svg>
        Recommend
      </button>

      {open && (
        <div className="rec-panel" role="dialog" aria-label="Recommend to friends">
          {friends === null ? (
            <div className="rec-empty">Loading friends…</div>
          ) : friends.length === 0 ? (
            <div className="rec-empty">Follow some people to recommend titles to them.</div>
          ) : sent > 0 ? (
            <div className="rec-empty rec-empty--ok">Sent to {sent} {sent === 1 ? "friend" : "friends"} ✓</div>
          ) : (
            <>
              <div className="rec-list">
                {friends.map((f) => {
                  const on = picked.has(f.id);
                  return (
                    <button key={f.id} type="button" className={"rec-item" + (on ? " rec-item--on" : "")} onClick={() => toggle(f.id)}>
                      {f.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="rec-ava" src={f.image} alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <span className={"rec-ava rec-ava--gen rec-hue-" + f.hue} aria-hidden="true">
                          {(f.name || f.username).charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="rec-item__name">{f.name || f.username}</span>
                      <span className="rec-check" aria-hidden="true">
                        {on && (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              <input
                className="rec-note"
                type="text"
                placeholder="Add a note (optional)"
                value={note}
                maxLength={200}
                onChange={(e) => setNote(e.target.value)}
              />
              <button className="rec-send" onClick={send} disabled={busy || picked.size === 0}>
                {busy ? "Sending…" : picked.size > 0 ? `Send to ${picked.size}` : "Pick friends"}
              </button>
            </>
          )}
        </div>
      )}
    </span>
  );
}
