"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// A horizontally-scrolling shelf row with side arrows (like the hero) instead of
// a scrollbar. Arrows fade in on hover and hide at the start/end of the row.
export function ShelfRow({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  };

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const scroll = (dir: number) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div className="shelf-wrap">
      <button
        type="button"
        className="shelf-arrow shelf-arrow--prev"
        onClick={() => scroll(-1)}
        aria-label="Scroll left"
        hidden={atStart}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <div className="shelf" role="list" ref={ref} onScroll={update}>
        {children}
      </div>
      <button
        type="button"
        className="shelf-arrow shelf-arrow--next"
        onClick={() => scroll(1)}
        aria-label="Scroll right"
        hidden={atEnd}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
      </button>
    </div>
  );
}
