"use client";

import { useEffect, useRef, useState } from "react";

// The Kokoro logo mark: a "rating orb" — a circle filled past half with a
// smiling waterline and a glint, echoing the app's fill-from-bottom rating
// glyphs. Draws in currentColor, so callers set the hue (the brand accent).
//
// Hovering plays a ONE-SHOT slosh: the surface ripples in place and the waves
// damp down (flatten), settling back to the still smooth meniscus — they don't
// scroll off to the side. Runs to completion and can't be re-triggered until it
// finishes (re-hover after it ends to replay). The wave fill is bounded by the
// circle's own arc, so it never leaves the orb (no clip needed).
const REST_WAVE = "M9 50 Q19.25 50 29.5 50 T50 50 T70.5 50 T91 50 A41 41 0 0 1 9 50 Z";
const SLOSH_MS = 2200;

export function BrandMark({ className, title }: { className?: string; title?: string }) {
  const [slosh, setSlosh] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const trigger = () => {
    if (slosh) return; // ignore re-trigger until the current slosh finishes
    setSlosh(true);
    timer.current = setTimeout(() => setSlosh(false), SLOSH_MS);
  };

  return (
    <svg
      className={"brandmark" + (slosh ? " brandmark--slosh" : "") + (className ? " " + className : "")}
      viewBox="0 0 100 100"
      onMouseEnter={trigger}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* faint full disc — the unfilled "glass" above the waterline */}
      <circle cx="50" cy="50" r="41" fill="currentColor" opacity="0.15" />
      {/* resting liquid: the still smooth meniscus (the basic logo) */}
      <path className="brandmark__still" d="M9 50 Q50 62 91 50 A41 41 0 0 1 9 50 Z" fill="currentColor" />
      {/* rippling liquid: shown during the slosh; its waterline shape damps to flat */}
      <path className="brandmark__wave" d={REST_WAVE} fill="currentColor" />
      {/* the rim */}
      <circle cx="50" cy="50" r="41" fill="none" stroke="currentColor" strokeWidth="9" />
      {/* glossy glint */}
      <ellipse cx="35" cy="33" rx="8.5" ry="5.5" fill="#fff" opacity="0.5" transform="rotate(-20 35 33)" />
    </svg>
  );
}
