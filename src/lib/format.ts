// Relative-time label ("3d ago"). Client-only — the gallery loads watchlists
// after mount, so this never runs during SSR (avoids a server/client time skew).
export function relTime(ts?: number): string {
  if (!ts) return "just now";
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return Math.round(d / 60) + "m ago";
  if (d < 86400) return Math.round(d / 3600) + "h ago";
  if (d < 604800) return Math.round(d / 86400) + "d ago";
  return Math.round(d / 604800) + "w ago";
}
