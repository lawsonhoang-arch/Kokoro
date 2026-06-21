"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchAnimeAction } from "@/features/search/actions";
import type { SearchResult } from "@/features/search/types";
import { NavQuickAdd } from "./NavQuickAdd";

function genPoster(seed: string): React.CSSProperties {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  h = Math.abs(h);
  const a = h % 360;
  const bg = (a + 35 + (h % 30)) % 360;
  return { backgroundImage: `linear-gradient(135deg, oklch(0.55 0.13 ${a}), oklch(0.4 0.13 ${bg}))` };
}

const MagSvg = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </svg>
);

export function NavSearch({ open, setOpen }: { open: boolean; setOpen: (b: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  // ⌘K / Ctrl+K toggles open; Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  // focus on open; reset on close
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 130);
      return () => clearTimeout(t);
    }
    setQ("");
    setResults([]);
  }, [open]);

  // clicking outside closes
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      // the quick-add picker is portaled outside the search wrap — don't treat
      // clicks inside it as "outside".
      if (t.closest?.(".navsrch__qamenu")) return;
      if (wrapRef.current && !wrapRef.current.contains(t)) setOpen(false);
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [open, setOpen]);

  // debounced live results (top matches)
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      const res = await searchAnimeAction(term);
      if (id === reqId.current) {
        setResults(res.slice(0, 6));
        setLoading(false);
      }
    }, 110);
    return () => clearTimeout(t);
  }, [q]);

  const submit = () => {
    const term = q.trim();
    if (!term) return;
    router.push(`/search?q=${encodeURIComponent(term)}`);
    setOpen(false);
  };
  const goTitle = (id: string) => {
    router.push(`/anime/${encodeURIComponent(id)}`);
    setOpen(false);
  };

  return (
    <div className={"navsrch" + (open ? " navsrch--open" : "")} ref={wrapRef}>
      <button
        className="navsrch__icon"
        aria-label="Search anime (⌘K)"
        title="Search anime (⌘K)"
        onClick={() => (open ? submit() : setOpen(true))}
      >
        <MagSvg />
      </button>
      <input
        ref={inputRef}
        className="navsrch__input"
        type="text"
        value={q}
        placeholder="Search anime…"
        tabIndex={open ? 0 : -1}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
      />

      {open && q.trim().length >= 2 && (
        <div className="navsrch__drop">
          {loading && results.length === 0 ? (
            <div className="navsrch__hint">Searching…</div>
          ) : results.length === 0 ? (
            <div className="navsrch__hint">No matches.</div>
          ) : (
            <>
              {results.map((r) => (
                <div key={r.id} className="navsrch__item">
                  <button className="navsrch__go" onClick={() => goTitle(r.id)}>
                    {r.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="navsrch__cover" src={r.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
                    ) : (
                      <span className="navsrch__cover" style={genPoster(r.id)} />
                    )}
                    <span className="navsrch__itxt">
                      <span className="navsrch__ititle">{r.title}</span>
                      <span className="navsrch__imeta">
                        {[r.format, r.year].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                  <NavQuickAdd titleId={r.id} />
                </div>
              ))}
              <button className="navsrch__all" onClick={submit}>
                See all results for “{q.trim()}” →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
