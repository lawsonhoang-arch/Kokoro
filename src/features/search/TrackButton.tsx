"use client";

import { useState } from "react";
import { toggleTrackAction } from "@/app/(app)/calendar/actions";

const CalIcon = ({ on }: { on: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 3v3M16 3v3" />
    {on && <path d="m9 14 2 2 4-4" />}
  </svg>
);

// Mark an anime as "tracking" so its weekly releases appear on the user's
// calendar. The broadcast day is looked up server-side on the first add. Works
// for currently-airing and upcoming shows (an upcoming show's schedule lands on
// the calendar once its broadcast day is known).
export function TrackButton({
  titleId,
  initialTracking,
  status,
}: {
  titleId: string;
  initialTracking: boolean;
  status?: string | null;
}) {
  const [tracking, setTracking] = useState(initialTracking);
  const [busy, setBusy] = useState(false);
  const upcoming = status === "upcoming";

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const next = !tracking;
    setTracking(next); // optimistic
    try {
      const r = await toggleTrackAction(titleId);
      setTracking(r.tracking);
    } catch {
      setTracking(!next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      className={"trackbtn" + (tracking ? " trackbtn--on" : "")}
      onClick={toggle}
      disabled={busy}
      aria-pressed={tracking}
      title={
        tracking
          ? upcoming
            ? "Tracking — its releases land on your calendar once it airs"
            : "Tracking weekly releases — click to stop"
          : upcoming
            ? "Track this upcoming anime — its schedule appears on your calendar once it airs"
            : "Track weekly releases on your calendar"
      }
    >
      <CalIcon on={tracking} />
      {tracking ? "Tracking" : upcoming ? "Track on calendar" : "Track releases"}
    </button>
  );
}
