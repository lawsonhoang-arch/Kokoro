"use client";

import { useEffect, useState } from "react";
import "./welcome.css";

function greeting(hour: number): string {
  if (hour < 5 || hour >= 22) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// Shown once after auth (the page renders this only when ?welcome=1).
//
// The OPAQUE backdrop is rendered from the very first paint (no mount gate), so
// Home is never visible behind it. Only the words animate in on top; at the end
// the whole overlay fades out to reveal Home. The time-based greeting is the one
// piece deferred to the client (starts blank, filled on mount) so server and
// client first render agree — everything else is deterministic.
//
// Lifecycle is timer-driven so it always advances (can't get stuck), even where
// CSS animation end-events are unreliable.
export function WelcomeOverlay({ username }: { username: string }) {
  const [greet, setGreet] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    // time-based greeting is client-only (deferred so SSR/first render agree)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGreet(greeting(new Date().getHours()));
    // strip ?welcome=1 so a refresh won't replay the greeting
    window.history.replaceState(null, "", "/home");

    const MIN_HOLD = 2600; // minimum on-screen time so the greeting fully plays
    const FADE = 950; // fade-out duration (matches CSS) before unmount
    const MAX_WAIT = 9000; // failsafe: reveal even if the ready signal never comes
    const start = Date.now();

    let holdT: ReturnType<typeof setTimeout>;
    let goneT: ReturnType<typeof setTimeout>;
    let left = false;

    const leave = () => {
      if (left) return; // guard: the failsafe may still fire after a normal leave
      left = true;
      setLeaving(true);
      goneT = setTimeout(() => setGone(true), FADE);
    };
    // Home has loaded — but still let the greeting finish its minimum hold, so a
    // fast load doesn't cut the animation short.
    const onReady = () => {
      holdT = setTimeout(leave, Math.max(0, MIN_HOLD - (Date.now() - start)));
    };

    const w = window as unknown as { __kokoroHomeReady?: boolean };
    if (w.__kokoroHomeReady) {
      onReady(); // Home streamed in before we subscribed
    } else {
      window.addEventListener("kokoro:home-ready", onReady, { once: true });
    }
    // never get stuck if the beacon never fires (e.g. Home errored)
    const failsafeT = setTimeout(leave, MAX_WAIT);

    return () => {
      window.removeEventListener("kokoro:home-ready", onReady);
      clearTimeout(holdT);
      clearTimeout(goneT);
      clearTimeout(failsafeT);
    };
  }, []);

  if (gone) return null;

  const chars = Array.from(username);
  const charStep = 0.045; // seconds between letters
  const charStart = 0.28; // when the first letter begins
  const barDelay = charStart + chars.length * charStep + 0.08;

  return (
    <div
      className={"welcome" + (leaving ? " welcome--leaving" : "")}
      role="status"
      aria-live="polite"
      aria-label={`${greet}, ${username}`}
    >
      <div className="welcome__glow" aria-hidden="true" />
      <div className="welcome__inner">
        {/* nbsp keeps the line height before the greeting fills in on mount */}
        <div className="welcome__greet">{greet ? `${greet},` : " "}</div>
        <div className="welcome__name" aria-hidden="true">
          {chars.map((ch, i) => (
            <span
              key={i}
              className="welcome__char"
              style={{ ["--d"]: `${charStart + i * charStep}s` } as React.CSSProperties}
            >
              {ch}
            </span>
          ))}
        </div>
        <span
          className="welcome__bar"
          aria-hidden="true"
          style={{ ["--d"]: `${barDelay}s` } as React.CSSProperties}
        />
      </div>
    </div>
  );
}
