"use client";

import { useId } from "react";

// The Kokoro logo mark: a "rating orb" — a circle filled past half with a
// smiling waterline and a glint, echoing the app's fill-from-bottom rating
// glyphs. Draws in currentColor, so callers set the hue (the brand accent).
//
// At rest it's the still smooth meniscus. On hover the surface becomes real
// moving waves: two sine-wave layers (wider than the orb, clipped to it) scroll
// across in opposite directions so the liquid visibly sloshes like it's being
// shaken. One period of the wave is 45 user units, so translating by exactly 45
// loops seamlessly.
const WAVE =
  "M-40 50 Q-28.75 36 -17.5 50 T5 50 T27.5 50 T50 50 T72.5 50 T95 50 T117.5 50 T140 50 L140 100 L-40 100 Z";

export function BrandMark({ className, title }: { className?: string; title?: string }) {
  const uid = useId();
  const clip = "bmw-" + uid.replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg
      className={"brandmark" + (className ? " " + className : "")}
      viewBox="0 0 100 100"
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
      {/* animated wave surface, clipped to the orb, revealed on hover */}
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
