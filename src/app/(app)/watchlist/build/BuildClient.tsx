"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HUES } from "@/lib/palette";
import type { HueKey } from "@/lib/palette";
import type { SearchResult } from "@/features/search/types";
import { searchAnimeAction } from "@/features/search/actions";
import { matchTitlesAction, buildListFromTitlesAction, type MatchRow } from "./actions";

// A card on the verification board. `input` is the original line (kept so the
// user can see what a wrong/empty match came from); `match` is the catalogue
// title currently chosen; `alts` are quick-swap runners-up.
type Card = {
  key: string;
  input: string | null;
  match: SearchResult | null;
  alts: SearchResult[];
  /** a loose (fuzzy fallback) match the user should double-check */
  flagged: boolean;
};

let seq = 0;
const mkKey = () => `c${seq++}`;

function poster(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  const a = Math.abs(h) % 360;
  return `linear-gradient(150deg, oklch(0.5 0.13 ${a}), oklch(0.33 0.11 ${(a + 40) % 360}))`;
}

export function BuildClient() {
  const router = useRouter();
  const [step, setStep] = useState<"paste" | "verify">("paste");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [listName, setListName] = useState("");
  const [hue, setHue] = useState<HueKey>("warm");
  const [error, setError] = useState<string | null>(null);

  const extract = useCallback(async () => {
    if (busy || !text.trim()) return;
    setBusy(true); setError(null);
    try {
      const rows: MatchRow[] = await matchTitlesAction(text);
      const next: Card[] = [];
      for (const r of rows) {
        // a title can match both an anime and a manga — both go on the board
        if (r.anime) next.push({ key: mkKey(), input: r.input, match: r.anime, alts: r.alternatives, flagged: !r.strict });
        if (r.manga) next.push({ key: mkKey(), input: r.input, match: r.manga, alts: r.alternatives, flagged: !r.strict });
        if (!r.anime && !r.manga) next.push({ key: mkKey(), input: r.input, match: null, alts: r.alternatives, flagged: true });
      }
      setCards(next);
      setStep("verify");
    } catch {
      setError("Couldn't read that just now — please try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, text]);

  const animeCards = cards.filter((c) => c.match?.kind === "anime");
  const mangaCards = cards.filter((c) => c.match?.kind === "manga");
  const needCards = cards.filter((c) => !c.match);
  const matched = animeCards.length + mangaCards.length;

  const removeCard = (key: string) => setCards((cs) => cs.filter((c) => c.key !== key));
  const swap = (key: string, to: SearchResult) =>
    setCards((cs) =>
      cs.map((c) =>
        c.key === key
          ? { ...c, match: to, flagged: false, alts: [c.match, ...c.alts].filter((x): x is SearchResult => !!x && x.id !== to.id).slice(0, 3) }
          : c,
      ),
    );

  const addTitle = (t: SearchResult) => {
    setCards((cs) => {
      if (cs.some((c) => c.match?.id === t.id)) return cs; // no dupes
      return [...cs, { key: mkKey(), input: null, match: t, alts: [], flagged: false }];
    });
  };

  const create = useCallback(async () => {
    const ids = cards.map((c) => c.match?.id).filter((x): x is string => !!x);
    if (busy || ids.length === 0) return;
    setBusy(true);
    try {
      const r = await buildListFromTitlesAction({ name: listName, hue, titleIds: ids });
      if (r.ok) router.push(`/watchlist/${encodeURIComponent(r.listId)}`);
    } finally {
      setBusy(false);
    }
  }, [busy, cards, listName, hue, router]);

  if (step === "paste") {
    return (
      <div className="build">
        <header className="build__head">
          <span className="build__eyebrow">Import</span>
          <h1 className="build__title">Build a list from your notes</h1>
          <p className="build__lede">
            Paste a written list — one title per line, however you jotted it down. We&rsquo;ll pull out
            the titles and match them to the catalogue, then you check the grid before it becomes a list.
          </p>
        </header>
        <textarea
          className="build__paste"
          placeholder={"Attack on Titan\nFrieren - 9/10\n1. Cowboy Bebop\n• Monster (rewatching)\n..."}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          autoFocus
        />
        <div className="build__actions">
          <span className="build__hint">{text.trim() ? `${text.trim().split(/\r?\n/).filter((l) => l.trim()).length} lines` : "Paste from your notes app, a doc, anywhere"}</span>
          <button className="build__btn build__btn--go" onClick={extract} disabled={busy || !text.trim()}>
            {busy ? "Reading…" : "Extract titles →"}
          </button>
        </div>
        {error && <p className="build__err">{error}</p>}
      </div>
    );
  }

  return (
    <div className="build">
      <header className="build__head build__head--verify">
        <div>
          <span className="build__eyebrow">Verify</span>
          <h1 className="build__title">Check the titles we found</h1>
          <p className="build__lede">
            {animeCards.length} anime · {mangaCards.length} manga{needCards.length > 0 ? ` · ${needCards.length} need a match` : ""}.
            Remove anything wrong, fix a flagged guess, or search to add what we missed.
          </p>
        </div>
        <button className="build__btn build__btn--ghost" onClick={() => setStep("paste")}>← Edit notes</button>
      </header>

      <AddBar onAdd={addTitle} existing={cards} />

      {cards.length === 0 ? (
        <p className="build__empty">Nothing on the board yet — search above to add titles.</p>
      ) : (
        <>
          <Section title="Anime" cards={animeCards} onRemove={removeCard} onSwap={swap} />
          <Section title="Manga" cards={mangaCards} onRemove={removeCard} onSwap={swap} />
          <Section title="Needs a match" cards={needCards} onRemove={removeCard} onSwap={swap} muted />
        </>
      )}

      <footer className="build__foot">
        <div className="build__foot-fields">
          <input
            className="build__name"
            placeholder="Name this list"
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            maxLength={60}
          />
          <div className="build__hues" role="radiogroup" aria-label="List colour">
            {HUES.map((h) => (
              <button
                key={h.key}
                className={"build__hue" + (hue === h.key ? " on" : "")}
                style={{ background: h.value }}
                onClick={() => setHue(h.key)}
                aria-label={h.label}
                aria-checked={hue === h.key}
                role="radio"
                type="button"
              />
            ))}
          </div>
        </div>
        <button className="build__btn build__btn--go" onClick={create} disabled={busy || matched === 0}>
          {busy ? "Creating…" : `Create list · ${matched} title${matched === 1 ? "" : "s"}`}
        </button>
        {error && <p className="build__err">{error}</p>}
      </footer>
    </div>
  );
}

/* ---------------- a titled section of the board ---------------- */
function Section({
  title, cards, onRemove, onSwap, muted,
}: {
  title: string;
  cards: Card[];
  onRemove: (key: string) => void;
  onSwap: (key: string, t: SearchResult) => void;
  muted?: boolean;
}) {
  if (cards.length === 0) return null;
  return (
    <section className={"build-sec" + (muted ? " build-sec--muted" : "")}>
      <h2 className="build-sec__head">
        {title} <span className="build-sec__count">{cards.length}</span>
      </h2>
      <div className="build-grid" role="list">
        {cards.map((c) => (
          <BuildCard key={c.key} card={c} onRemove={() => onRemove(c.key)} onSwap={(t) => onSwap(c.key, t)} />
        ))}
      </div>
    </section>
  );
}

/* ---------------- a single verification card ---------------- */
function BuildCard({ card, onRemove, onSwap }: { card: Card; onRemove: () => void; onSwap: (t: SearchResult) => void }) {
  const [swapOpen, setSwapOpen] = useState(false);
  const m = card.match;
  return (
    <div className={"bcard" + (m ? "" : " bcard--unmatched") + (card.flagged && m ? " bcard--flagged" : "")} role="listitem">
      <div className="bcard__art" style={m?.cover ? undefined : { backgroundImage: poster(card.input ?? m?.id ?? "x") }}>
        {m?.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="bcard__cover" src={m.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
        )}
        <span className="bcard__kind">{m ? m.kind : ""}</span>
        <button className="bcard__x" onClick={onRemove} title="Remove" aria-label="Remove">×</button>
        {!m && <span className="bcard__flag">No match</span>}
        {m && card.flagged && <span className="bcard__flag bcard__flag--check">Check</span>}
      </div>
      <div className="bcard__body">
        <span className="bcard__title">{m ? m.title : card.input}</span>
        <span className="bcard__meta">
          {m ? [m.format, m.year].filter(Boolean).join(" · ") || m.kind : `from “${card.input}”`}
        </span>
        {card.input && m && card.input.toLowerCase() !== m.title.toLowerCase() && (
          <span className="bcard__from">you wrote “{card.input}”</span>
        )}
        {(card.alts.length > 0 || !m) && (
          <button className="bcard__swap" onClick={() => setSwapOpen((v) => !v)}>
            {m ? "Not right? Change" : "Find a match"}
          </button>
        )}
      </div>
      {swapOpen && (
        <SwapPanel card={card} onPick={(t) => { onSwap(t); setSwapOpen(false); }} onClose={() => setSwapOpen(false)} />
      )}
    </div>
  );
}

/* alternatives + live search for correcting a card's match */
function SwapPanel({ card, onPick, onClose }: { card: Card; onPick: (t: SearchResult) => void; onClose: () => void }) {
  const [q, setQ] = useState(card.match ? "" : card.input ?? "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    let alive = true;
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await searchAnimeAction(query);
      if (alive) { setResults(r.slice(0, 8)); setSearching(false); }
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const list = results.length ? results : card.alts;
  return (
    <div className="bswap">
      <input
        className="bswap__input"
        placeholder="Search the catalogue…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      <div className="bswap__results">
        {searching && <span className="bswap__note">Searching…</span>}
        {!searching && list.length === 0 && <span className="bswap__note">No results.</span>}
        {list.map((r) => (
          <button key={r.id} className="bswap__opt" onClick={() => onPick(r)}>
            <span className="bswap__thumb" style={r.cover ? undefined : { backgroundImage: poster(r.id) }}>
              {r.cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
              )}
            </span>
            <span className="bswap__txt">
              <span className="bswap__t">{r.title}</span>
              <span className="bswap__m">{[r.format, r.year].filter(Boolean).join(" · ")}</span>
            </span>
          </button>
        ))}
      </div>
      <button className="bswap__close" onClick={onClose}>Cancel</button>
    </div>
  );
}

/* the always-on "search and add directly" bar above the grid */
function AddBar({ onAdd, existing }: { onAdd: (t: SearchResult) => void; existing: Card[] }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      const r = await searchAnimeAction(query);
      if (alive) { setResults(r.slice(0, 8)); setOpen(true); }
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, []);

  const have = new Set(existing.map((c) => c.match?.id).filter(Boolean));
  return (
    <div className="build-add" ref={boxRef}>
      <svg className="build-add__ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
      </svg>
      <input
        className="build-add__input"
        placeholder="Search the catalogue to add a title…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
      />
      {open && results.length > 0 && (
        <div className="build-add__drop">
          {results.map((r) => {
            const dup = have.has(r.id);
            return (
              <button
                key={r.id}
                className="build-add__opt"
                disabled={dup}
                onClick={() => { onAdd(r); setQ(""); setResults([]); setOpen(false); }}
              >
                <span className="build-add__thumb" style={r.cover ? undefined : { backgroundImage: poster(r.id) }}>
                  {r.cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
                  )}
                </span>
                <span className="build-add__txt">
                  <span className="build-add__t">{r.title}</span>
                  <span className="build-add__m">{[r.format, r.year].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="build-add__cta">{dup ? "Added" : "+ Add"}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
