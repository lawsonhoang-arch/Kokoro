import "server-only";

// A tiny last-good cache for streamed home rows. The news / community carousels
// fetch their own data inside <Suspense>; if a refresh fails or times out (a
// transient DB/RSS blip) the fetch returns empty and the row would collapse to
// null — which is why those rows "sometimes didn't load in at all". Wrapping the
// fetch keeps the last successful (non-empty) result per instance and serves it
// on a momentary failure, so the row stays put instead of vanishing.
//
// Lives in a lib module (not the component file) so this intentional per-request
// module state is out of the React render-purity lint's way, like our other
// caches (e.g. the search index).
export function makeStale<T>(isEmpty: (v: T) => boolean): (fresh: T) => T {
  let last: T | null = null;
  return (fresh: T): T => {
    if (!isEmpty(fresh)) {
      last = fresh;
      return fresh;
    }
    return last ?? fresh;
  };
}
