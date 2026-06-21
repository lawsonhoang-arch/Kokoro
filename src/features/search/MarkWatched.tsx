"use client";

import { useState } from "react";
import { toggleCompletionAction } from "@/app/(app)/anime/actions";

const Check = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="m20 6-11 11-5-5" />
  </svg>
);
const Eye = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// Mark a title watched/done without adding it to a list — the completion is
// stored on the user and counts toward their profile stats.
export function MarkWatched({ titleId, initialDone }: { titleId: string; initialDone: boolean }) {
  const [done, setDone] = useState(initialDone);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const next = !done;
    setDone(next); // optimistic
    try {
      const r = await toggleCompletionAction(titleId);
      setDone(r.completed);
    } catch {
      setDone(!next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      className={"markwatched" + (done ? " markwatched--on" : "")}
      onClick={toggle}
      disabled={busy}
      aria-pressed={done}
      title={done ? "Marked as watched — click to undo" : "Mark as watched (no list needed)"}
    >
      {done ? <Check /> : <Eye />}
      {done ? "Watched" : "Mark as watched"}
    </button>
  );
}
