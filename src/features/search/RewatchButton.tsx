"use client";

import { useState } from "react";
import { logRewatchAction, undoRewatchAction } from "@/app/(app)/anime/actions";

const Loop = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 2.1 21 6l-4 3.9" />
    <path d="M3 12.5V11a4 4 0 0 1 4-4h14" />
    <path d="M7 21.9 3 18l4-3.9" />
    <path d="M21 11.5V13a4 4 0 0 1-4 4H3" />
  </svg>
);

// Log a rewatch (anime) / reread (manga) pass for a title. Each click adds one;
// the count shows how many times you've been back. Optimistic.
export function RewatchButton({ titleId, initialCount, kind }: { titleId: string; initialCount: number; kind: string }) {
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const isManga = kind === "manga";
  const doneLabel = isManga ? "Reread" : "Rewatched";
  const addLabel = isManga ? "Log a reread" : "Log a rewatch";

  const log = async () => {
    if (busy) return;
    setBusy(true);
    setCount((c) => c + 1); // optimistic
    try {
      const r = await logRewatchAction(titleId);
      setCount(r.count);
    } catch {
      setCount((c) => Math.max(0, c - 1));
    } finally {
      setBusy(false);
    }
  };
  const undo = async () => {
    if (busy || count <= 0) return;
    setBusy(true);
    setCount((c) => Math.max(0, c - 1)); // optimistic
    try {
      const r = await undoRewatchAction(titleId);
      setCount(r.count);
    } catch {
      setCount((c) => c + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="rewatch">
      <button
        className={"rewatch__btn" + (count > 0 ? " rewatch__btn--on" : "")}
        onClick={log}
        disabled={busy}
        title={count > 0 ? `${doneLabel} ${count}× — click to add another` : addLabel}
      >
        <Loop />
        {count > 0 ? `${doneLabel} ${count}×` : addLabel}
      </button>
      {count > 0 && (
        <button className="rewatch__undo" onClick={undo} disabled={busy} title="Remove the last one" aria-label="Remove last rewatch">
          −
        </button>
      )}
    </span>
  );
}
