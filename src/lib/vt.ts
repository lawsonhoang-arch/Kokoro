// Shared helpers for cross-page view transitions.
//
// A `view-transition-name` must be a valid CSS custom-ident: no colons, dots, or
// other punctuation. Catalog ids carry a ':' (e.g. "anilist:457"), so sanitize
// before using one as a transition name. Card and detail-hero must derive the
// name identically so the browser can morph one into the other.
export function coverVT(id: string): string {
  return "cover-" + id.replace(/[^a-zA-Z0-9]+/g, "-");
}
