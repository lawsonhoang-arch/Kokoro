"use client";

import { useEffect, useId, useRef, useState } from "react";

// The Kokoro logo mark: a "rating orb" — a circle filled past half with a
// smiling waterline and a glint, echoing the app's fill-from-bottom rating
// glyphs. Draws in currentColor, so callers set the hue (the brand accent).
//
// Hovering plays a ONE-SHOT slosh: the surface becomes moving waves that roll
// fast, decelerate with a little residual back-slosh (inertia), and settle back
// to the still meniscus — it is not a loop. The animation runs to completion and
// can't be re-triggered until it's done (re-hover after it ends to replay).
const WAVE =
  "M-40 50 Q-28.75 36 -17.5 50 T5 50 T27.5 50 T50 50 T72.5 50 T95 50 T117.5 50 T140 50 L140 100 L-40 100 Z";
const SLOSH_MS = 2200;

export function BrandMark({ className, title }: { className?: string; title?: string }) {
  const uid = useId();
  const clip = "bmw-" + uid.replace(/[^a-zA-Z0-9]/g, "");
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
      <defs>
        <clipPath id={clip}>
          <circle cx="50" cy="50" r="41" />
        </clipPath>
      </defs>
      {/* faint full disc — the unfilled "glass" above the waterline */}
      <circle cx="50" cy="50" r="41" fill="currentColor" opacity="0.15" />
      {/* resting liquid: the still smooth meniscus (keeps the mark unchanged at rest) */}
      <path className="brandmark__still" d="M9 50 Q50 62 91 50 A41 41 0 0 1 9 50 Z" fill="currentColor" />
      {/* wave surface, clipped to the orb, revealed during the slosh */}
      <g className="brandmark__waves" clipPath={`url(#${clip})`}>
        <path className="brandmark__wave brandmark__wave--back" d={WAVE} fill="currentColor" opacity="0.5" />
        <path className="brandmark__wave brandmark__wave--front" d={WAVE} fill="currentColor" />
      </g>
      {/* the rim */}
      <circle cx="50" cy="50" r="41" fill="none" stroke="currentColor" strokeWidth="9" />
      {/* glossy glint */}
      <ellipse cx="35" cy="33" rx="8.5" ry="5.5" fill="#fff" opacity="0.5" transform="rotate(-20 35 33)" />
    </svg>
  );
}
