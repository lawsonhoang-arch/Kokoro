"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchCommunityAction } from "@/app/(app)/community/actions";
import type { SearchResult } from "@/features/search/types";

// Search the catalog to jump into a title's community ("subreddit").
export function CommunitySearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return; // dropdown is gated on length below; no need to clear
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      const r = await searchCommunityAction(term);
      if (id === reqId.current) setResults(r.slice(0, 7));
    }, 130);
    return () => clearTimeout(t);
  }, [q]);

  const go = (id: string) => {
    router.push(`/community/${encodeURIComponent(id)}`);
    setQ("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="csearch">
      <svg className="csearch__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
      <input
        className="csearch__input"
        placeholder="Find an anime's community…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && q.trim().length >= 2 && (
        <div className="csearch__drop">
          {results.length === 0 ? (
            <div className="csearch__hint">No matches.</div>
          ) : (
            results.map((r) => (
              <button key={r.id} className="csearch__item" onMouseDown={(e) => { e.preventDefault(); go(r.id); }}>
                {r.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="csearch__cover" src={r.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
                ) : (
                  <span className="csearch__cover" />
                )}
                <span className="csearch__itxt">
                  <span className="csearch__ititle">{r.title}</span>
                  <span className="csearch__imeta">{[r.format, r.year].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
