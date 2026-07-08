"use client";

import { useEffect, useState } from "react";
import { getTitleJournalAction, createJournalEntryAction } from "@/app/(app)/journal/actions";
import type { JournalEntry } from "@/lib/journal";

// Per-episode / per-chapter tracker for a title in the watchlist detail. Click a
// cell to mark it watched/read (drives progress / hours / episodes / chapters).
// Manga can toggle between individual chapters and a by-volume view (volume
// ranges are an even split of chapters over the volume count — the catalog
// stores counts, not per-volume chapter lists). The corner button opens
// per-episode notes (stored as journal entries).
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
  kind = "anime",
  volumes = 0,
  onToggleWatched,
  onMarkAll,
  onClear,
  onSetWatched,
}: {
  titleId: string;
  title: string;
  episodes: number; // chapters, for manga
  watched: number[];
  kind?: "anime" | "manga";
  volumes?: number; // manga volume count (for the by-volume view)
  onToggleWatched: (ep: number) => void;
  onMarkAll: () => void;
  onClear: () => void;
  onSetWatched: (eps: number[]) => void;
}) {
  const manga = kind === "manga";
  const Unit = manga ? "Chapter" : "Episode";
  const unitShort = manga ? "CH" : "EP";
  const canVolumes = manga && volumes > 1 && episodes > 0;

  const [notes, setNotes] = useState<JournalEntry[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"units" | "volumes">("units");

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

  // even-split volume → chapter range
  const volRange = (v: number): number[] => {
    const start = Math.floor(((v - 1) * episodes) / volumes) + 1;
    const end = Math.floor((v * episodes) / volumes);
    const out: number[] = [];
    for (let c = start; c <= end; c++) out.push(c);
    return out;
  };
  const vols = Array.from({ length: canVolumes ? volumes : 0 }, (_, i) => i + 1);
  const volRead = (v: number) => { const r = volRange(v); return r.length > 0 && r.every((c) => watchedSet.has(c)); };
  const volsReadCount = vols.filter(volRead).length;

  const toggleVolume = (v: number) => {
    const r = volRange(v);
    const next = new Set(watched.filter((n) => n >= 1 && n <= episodes));
    const allRead = r.every((c) => next.has(c));
    for (const c of r) { if (allRead) next.delete(c); else next.add(c); }
    onSetWatched([...next].sort((a, b) => a - b));
  };

  const add = async () => {
    if (sel == null || !draft.trim()) return;
    setBusy(true);
    try {
      const entry = await createJournalEntryAction({
        titleId,
        episode: `${unitShort} ${sel}`,
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
  const pct = view === "volumes"
    ? (volumes ? Math.round((volsReadCount / volumes) * 100) : 0)
    : (episodes ? Math.round((watchedCount / episodes) * 100) : 0);

  return (
    <section className="k-eps">
      <div className="k-eps__top">
        <div className="k-eps__lead">
          <span className="k-impression__lbl">{manga ? "Chapters read" : "Episodes watched"}</span>
          <span className="k-eps__tally">
            {view === "volumes" ? `${volsReadCount}/${volumes} vol` : `${watchedCount}/${episodes}`}
          </span>
        </div>
        <div className="k-eps__bulk">
          {canVolumes && (
            <div className="k-eps__seg" role="group" aria-label="View by">
              <button type="button" className={view === "units" ? "on" : ""} onClick={() => setView("units")}>Chapters</button>
              <button type="button" className={view === "volumes" ? "on" : ""} onClick={() => { setView("volumes"); setSel(null); }}>Volumes</button>
            </div>
          )}
          <button type="button" onClick={onMarkAll} disabled={watchedCount === episodes}>Mark all</button>
          <button type="button" onClick={onClear} disabled={watchedCount === 0}>Clear</button>
        </div>
      </div>
      <div className="k-eps__meter"><span className="k-eps__meterfill" style={{ width: `${pct}%` }} /></div>

      {view === "volumes" ? (
        <div className="k-eps__grid k-eps__grid--vol">
          {vols.map((v) => {
            const r = volRange(v);
            const read = volRead(v);
            const some = !read && r.some((c) => watchedSet.has(c));
            return (
              <button
                key={v}
                type="button"
                className={"k-eps__vol" + (read ? " watched" : "") + (some ? " partial" : "")}
                aria-pressed={read}
                title={`Volume ${v} · ch ${r[0]}–${r[r.length - 1]} — click to mark ${read ? "unread" : "read"}`}
                onClick={() => toggleVolume(v)}
              >
                <span className="k-eps__vol-num">Vol {v}</span>
                <span className="k-eps__vol-range">{r[0]}–{r[r.length - 1]}</span>
              </button>
            );
          })}
        </div>
      ) : (
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
                  title={w ? `${Unit} ${n} done — click to unmark` : `Mark ${Unit.toLowerCase()} ${n}`}
                  onClick={() => onToggleWatched(n)}
                >
                  {n}
                </button>
                <button
                  type="button"
                  className="k-eps__note"
                  aria-label={`Notes for ${Unit.toLowerCase()} ${n}`}
                  title={c ? `${c} note${c > 1 ? "s" : ""}` : "Add a note"}
                  onClick={() => { setSel(sel === n ? null : n); setDraft(""); }}
                >
                  {c > 0 ? c : <NoteIcon />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {sel != null && view === "units" && (
        <div className="k-eps__panel">
          <div className="k-eps__head">
            <span className="k-eps__badge">{Unit} {sel}</span>
            <span className="k-eps__of">of {episodes} · {title}</span>
            <button
              type="button"
              className={"k-eps__markbtn" + (watchedSet.has(sel) ? " on" : "")}
              onClick={() => onToggleWatched(sel)}
            >
              {watchedSet.has(sel) ? (manga ? "✓ Read" : "✓ Watched") : (manga ? "Mark read" : "Mark watched")}
            </button>
          </div>

          <div className="k-eps__notes">
            {selNotes.length === 0 ? (
              <p className="k-eps__empty">No notes for {Unit.toLowerCase()} {sel} yet — write the first one below.</p>
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
            placeholder={`Add a note about ${Unit.toLowerCase()} ${sel}…`}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="k-eps__actions">
            <button className="btn btn--primary" disabled={busy || !draft.trim()} onClick={add}>
              {busy ? "Saving…" : `Add note to ${Unit.toLowerCase()} ${sel}`}
            </button>
            <span className="k-eps__hint">Also saved to your Journal</span>
          </div>
        </div>
      )}
    </section>
  );
}
