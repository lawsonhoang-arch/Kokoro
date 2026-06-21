"use client";

import { useEffect, useState } from "react";
import { getTitleJournalAction, createJournalEntryAction } from "@/app/(app)/journal/actions";
import type { JournalEntry } from "@/lib/journal";

// Per-episode tracker for a title in the watchlist detail. Click a cell to mark
// that episode watched (drives progress / hours / episodes-watched). The small
// corner button opens per-episode notes (stored as journal entries, so they also
// show up in the Journal tab).
const epLabel = (n: number) => `EP ${n}`;
const epNum = (s: string): number | null => {
  const m = s.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
};
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const NoteIcon = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
);

export function EpisodeNotes({
  titleId,
  title,
  episodes,
  watched,
  onToggleWatched,
  onMarkAll,
  onClear,
}: {
  titleId: string;
  title: string;
  episodes: number;
  watched: number[];
  onToggleWatched: (ep: number) => void;
  onMarkAll: () => void;
  onClear: () => void;
}) {
  const [notes, setNotes] = useState<JournalEntry[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTitleJournalAction(titleId)
      .then((es) => { if (!cancelled) setNotes(es); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [titleId]);

  const countFor = (n: number) => notes.reduce((c, e) => c + (epNum(e.episode) === n ? 1 : 0), 0);
  const selNotes = sel == null ? [] : notes.filter((e) => epNum(e.episode) === sel);
  const watchedSet = new Set(watched);
  const watchedCount = watched.filter((n) => n >= 1 && n <= episodes).length;

  const add = async () => {
    if (sel == null || !draft.trim()) return;
    setBusy(true);
    try {
      const entry = await createJournalEntryAction({
        titleId,
        episode: epLabel(sel),
        heading: "",
        rateMode: "glyphs",
        feeling: null,
        symbol: null,
        dims: {},
        quote: "",
        body: draft.trim(),
      });
      setNotes((ns) => [entry, ...ns]);
      setDraft("");
    } finally {
      setBusy(false);
    }
  };

  const eps = Array.from({ length: episodes }, (_, i) => i + 1);
  const pct = episodes ? Math.round((watchedCount / episodes) * 100) : 0;

  return (
    <section className="k-eps">
      <div className="k-eps__top">
        <div className="k-eps__lead">
          <span className="k-impression__lbl">Episodes watched</span>
          <span className="k-eps__tally">{watchedCount}/{episodes}</span>
        </div>
        <div className="k-eps__bulk">
          <button type="button" onClick={onMarkAll} disabled={watchedCount === episodes}>Mark all</button>
          <button type="button" onClick={onClear} disabled={watchedCount === 0}>Clear</button>
        </div>
      </div>
      <div className="k-eps__meter"><span className="k-eps__meterfill" style={{ width: `${pct}%` }} /></div>

      <div className="k-eps__grid">
        {eps.map((n) => {
          const c = countFor(n);
          const w = watchedSet.has(n);
          return (
            <div key={n} className={"k-eps__cell" + (w ? " watched" : "") + (sel === n ? " on" : "") + (c ? " has" : "")}>
              <button
                type="button"
                className="k-eps__watch"
                aria-pressed={w}
                title={w ? `Episode ${n} watched — click to unmark` : `Mark episode ${n} watched`}
                onClick={() => onToggleWatched(n)}
              >
                {n}
              </button>
              <button
                type="button"
                className="k-eps__note"
                aria-label={`Notes for episode ${n}`}
                title={c ? `${c} note${c > 1 ? "s" : ""}` : "Add a note"}
                onClick={() => { setSel(sel === n ? null : n); setDraft(""); }}
              >
                {c > 0 ? c : <NoteIcon />}
              </button>
            </div>
          );
        })}
      </div>

      {sel != null && (
        <div className="k-eps__panel">
          <div className="k-eps__head">
            <span className="k-eps__badge">Episode {sel}</span>
            <span className="k-eps__of">of {episodes} · {title}</span>
            <button
              type="button"
              className={"k-eps__markbtn" + (watchedSet.has(sel) ? " on" : "")}
              onClick={() => onToggleWatched(sel)}
            >
              {watchedSet.has(sel) ? "✓ Watched" : "Mark watched"}
            </button>
          </div>

          <div className="k-eps__notes">
            {selNotes.length === 0 ? (
              <p className="k-eps__empty">No notes for episode {sel} yet — write the first one below.</p>
            ) : (
              selNotes.map((e) => (
                <div key={e.id} className="k-eps__note-row">
                  <span className="k-eps__note-date">{fmtDate(e.createdAt)}</span>
                  <span className="k-eps__note-body">{e.body || e.quote}</span>
                </div>
              ))
            )}
          </div>

          <textarea
            className="k-eps__compose"
            rows={3}
            value={draft}
            placeholder={`Add a note about episode ${sel}…`}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="k-eps__actions">
            <button className="btn btn--primary" disabled={busy || !draft.trim()} onClick={add}>
              {busy ? "Saving…" : `Add note to episode ${sel}`}
            </button>
            <span className="k-eps__hint">Also saved to your Journal</span>
          </div>
        </div>
      )}
    </section>
  );
}
