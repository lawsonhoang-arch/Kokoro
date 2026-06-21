"use client";

import { useEffect, useRef } from "react";

// "Load more" control: a manual button that also auto-loads when scrolled near.
// The parent's onLoad must no-op while already loading / out of pages.
export function LoadMore({ hasMore, loading, onLoad }: { hasMore: boolean; loading: boolean; onLoad: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || loading) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoad();
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, onLoad]);

  if (!hasMore) return null;
  return (
    <div ref={ref} className="cloadmore">
      <button className="cloadmore__btn" disabled={loading} onClick={onLoad}>
        {loading ? "Loading…" : "Load more"}
      </button>
    </div>
  );
}
