// The Kokoro logo mark: a "rating orb" — a circle filled past half with a
// smiling waterline and a glint, echoing the app's fill-from-bottom rating
// glyphs. Draws in currentColor, so callers set the hue (the brand accent).
// The fill is one path (lower disc + meniscus top), so no clip-path / id is
// needed and it's safe to render anywhere, at any size.
export function BrandMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* faint full disc — the unfilled "glass" above the waterline */}
      <circle cx="50" cy="50" r="41" fill="currentColor" opacity="0.15" />
      {/* the liquid: bottom of the disc, capped by the smiling meniscus */}
      <path d="M9 50 Q50 62 91 50 A41 41 0 0 1 9 50 Z" fill="currentColor" />
      {/* the rim */}
      <circle cx="50" cy="50" r="41" fill="none" stroke="currentColor" strokeWidth="9" />
      {/* glossy glint */}
      <ellipse cx="35" cy="33" rx="8.5" ry="5.5" fill="#fff" opacity="0.5" transform="rotate(-20 35 33)" />
    </svg>
  );
}
