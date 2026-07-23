"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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

// A place to jump to or an action to run — the command half of the palette.
type Cmd = { id: string; label: string; hint: string; href: string; keywords: string; icon: ReactNode; primary?: boolean };
const I = (d: ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const COMMANDS: Cmd[] = [
  { id: "home", label: "Home", hint: "Dashboard & feeds", href: "/home", keywords: "home dashboard", primary: true, icon: I(<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />) },
  { id: "lists", label: "My Lists", hint: "Your watchlists", href: "/watchlist", keywords: "lists watchlist library collection", primary: true, icon: I(<><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></>) },
  { id: "journal", label: "Journal", hint: "Your private diary", href: "/journal", keywords: "journal diary notes rewatch", primary: true, icon: I(<><path d="M6 4h12a1 1 0 0 1 1 1v15H7a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1z" /><path d="M9 4v16" /></>) },
  { id: "community", label: "Community", hint: "Discussions & the people you follow", href: "/community", keywords: "community discussions posts following feed reviews", primary: true, icon: I(<><circle cx="9" cy="8" r="3" /><path d="M3.5 19c0-3 2.8-4.5 5.5-4.5S14.5 16 14.5 19" /><path d="M16 6a3 3 0 0 1 0 6M20.5 19c0-2.2-1.4-3.6-3.5-4.2" /></>) },
  { id: "news", label: "News", hint: "Anime & industry", href: "/news", keywords: "news industry", primary: true, icon: I(<><path d="M4 5h13a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5z" /><path d="M18 8h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2" /><path d="M7 8h7M7 11h7M7 14h5" /></>) },
  { id: "calendar", label: "Calendar", hint: "Premieres & events", href: "/calendar", keywords: "calendar schedule premieres events airing", primary: true, icon: I(<><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v3M16 3v3" /></>) },
  { id: "profile", label: "Profile", hint: "Your profile & stats", href: "/profile", keywords: "profile stats me account you", primary: true, icon: I(<><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" /></>) },
  { id: "people", label: "Find people", hint: "Discover users with similar taste", href: "/people", keywords: "people find follow friends discover users similar taste match social invite add", primary: true, icon: I(<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c0-3 2.6-4.6 5.5-4.6s5.5 1.6 5.5 4.6" /><path d="M17 8.5h4M19 6.5v4" /></>) },
  { id: "browse-anime", label: "Browse anime", hint: "Top-rated anime", href: "/search?type=anime&sort=rated", keywords: "browse anime discover top rated explore", icon: I(<><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>) },
  { id: "browse-manga", label: "Browse manga", hint: "Top-rated manga", href: "/search?type=manga&sort=rated", keywords: "browse manga discover read top rated explore", icon: I(<><path d="M4 5a2 2 0 0 1 2-2h5v16H6a2 2 0 0 0-2 2zM20 5a2 2 0 0 0-2-2h-5v16h5a2 2 0 0 1 2 2z" /></>) },
  { id: "import", label: "Import your list", hint: "From AniList or MyAnimeList", href: "/watchlist?import=1", keywords: "import anilist mal myanimelist migrate move list sync", icon: I(<><path d="M12 3v12M8 11l4 4 4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>) },
  { id: "wrapped", label: "Kokoro Wrapped", hint: "Your taste, in one look", href: "/wrapped", keywords: "wrapped recap year in review rewind stats taste summary", icon: I(<><path d="M12 3v18M3 12h18" /><circle cx="12" cy="12" r="9" /></>) },
  { id: "mood", label: "Discover by mood", hint: "Something cozy? Something that'll wreck you?", href: "/mood", keywords: "mood vibe discover feeling cozy recommend what to watch", icon: I(<><circle cx="12" cy="12" r="9" /><path d="M8.5 14a4 4 0 0 0 7 0M9 9h.01M15 9h.01" /></>) },
];

export function NavSearch({ open, setOpen }: { open: boolean; setOpen: (b: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0); // highlighted row in the flat list
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  const term = q.trim().toLowerCase();
  // commands: filtered by query, else the primary quick-jumps
  const cmds = term
    ? COMMANDS.filter((c) => (c.label.toLowerCase() + " " + c.keywords).includes(term))
    : COMMANDS.filter((c) => c.primary);
  // flat, keyboard-navigable list: commands first, then title matches
  const flat: ({ kind: "cmd"; cmd: Cmd } | { kind: "title"; title: SearchResult })[] = [
    ...cmds.map((cmd) => ({ kind: "cmd" as const, cmd })),
    ...results.map((title) => ({ kind: "title" as const, title })),
  ];

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

  // focus on open; reset on close (sync internal state to the controlled prop)
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 130);
      return () => clearTimeout(t);
    }
    /* eslint-disable react-hooks/set-state-in-effect */
    setQ("");
    setResults([]);
    setActive(0);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open]);

  // clicking outside closes
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest?.(".navsrch__qamenu")) return; // portaled picker
      if (wrapRef.current && !wrapRef.current.contains(t)) setOpen(false);
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [open, setOpen]);

  // debounced live title results (only worth a query at 2+ chars)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      const res = await searchAnimeAction(term);
      if (id === reqId.current) {
        setResults(res.slice(0, 6));
        setLoading(false);
      }
    }, 110);
    return () => clearTimeout(t);
  }, [term]);

  // clamp the highlight to the current list at render (avoids a state-sync effect)
  const activeIdx = flat.length ? Math.min(active, flat.length - 1) : 0;
  // scroll the highlighted row into view as it moves
  useEffect(() => {
    dropRef.current?.querySelector(".is-active")?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const close = () => setOpen(false);
  const goCmd = (c: Cmd) => { router.push(c.href); close(); };
  const goTitle = (id: string) => { router.push(`/anime/${encodeURIComponent(id)}`); close(); };
  const submit = () => {
    if (!term) return;
    router.push(`/search?q=${encodeURIComponent(q.trim())}`);
    close();
  };
  const activate = (i: number) => {
    const it = flat[i];
    if (!it) return submit();
    if (it.kind === "cmd") goCmd(it.cmd);
    else goTitle(it.title.id);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (flat.length) activate(activeIdx); else submit(); }
  };

  // flat index bookkeeping so keyboard highlight lines up with render order
  const cmdCount = cmds.length;
  const showDrop = open && (cmds.length > 0 || term.length >= 2);

  return (
    <div className={"navsrch" + (open ? " navsrch--open" : "")} ref={wrapRef}>
      <button
        className="navsrch__icon"
        aria-label="Search & jump (⌘K)"
        title="Search & jump (⌘K)"
        onClick={() => (open ? submit() : setOpen(true))}
      >
        <MagSvg />
      </button>
      <input
        ref={inputRef}
        className="navsrch__input"
        type="text"
        value={q}
        placeholder="Search or jump to…"
        tabIndex={0}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); setActive(0); }}
        onKeyDown={onKeyDown}
      />

      {showDrop && (
        <div className="navsrch__drop" ref={dropRef}>
          {cmds.length > 0 && (
            <>
              <div className="navsrch__sec">{term ? "Pages & actions" : "Jump to"}</div>
              {cmds.map((c, i) => (
                <button
                  key={c.id}
                  className={"navsrch__cmd" + (activeIdx === i ? " is-active" : "")}
                  onMouseMove={() => setActive(i)}
                  onClick={() => goCmd(c)}
                >
                  <span className="navsrch__cmd-ico">{c.icon}</span>
                  <span className="navsrch__cmd-txt">
                    <span className="navsrch__cmd-label">{c.label}</span>
                    <span className="navsrch__cmd-hint">{c.hint}</span>
                  </span>
                  {activeIdx === i && <span className="navsrch__kbd">↵</span>}
                </button>
              ))}
            </>
          )}

          {term.length >= 2 && (
            <>
              <div className="navsrch__sec">Titles</div>
              {loading && results.length === 0 ? (
                <div className="navsrch__hint">Searching…</div>
              ) : results.length === 0 ? (
                <div className="navsrch__hint">No title matches.</div>
              ) : (
                results.map((r, i) => {
                  const idx = cmdCount + i;
                  return (
                    <div key={r.id} className={"navsrch__item" + (activeIdx === idx ? " is-active" : "")} onMouseMove={() => setActive(idx)}>
                      <button className="navsrch__go" onClick={() => goTitle(r.id)}>
                        {r.cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="navsrch__cover" src={r.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
                        ) : (
                          <span className="navsrch__cover" style={genPoster(r.id)} />
                        )}
                        <span className="navsrch__itxt">
                          <span className="navsrch__ititle">{r.title}</span>
                          <span className="navsrch__imeta">{[r.format, r.year].filter(Boolean).join(" · ")}</span>
                        </span>
                      </button>
                      <NavQuickAdd titleId={r.id} />
                    </div>
                  );
                })
              )}
              {results.length > 0 && (
                <button className="navsrch__all" onClick={submit}>
                  See all results for “{q.trim()}” →
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
