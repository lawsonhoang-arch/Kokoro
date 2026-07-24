"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { BackButton } from "@/components/BackButton";
import { Glyph } from "@/features/watchlist/Glyph";
import { FEELINGS as WL_FEELINGS, GRADE_LETTERS, MOOD_EMOJI } from "@/features/watchlist/data";
import type { Feeling } from "@/features/watchlist/types";
import type { JournalEntry } from "@/lib/journal";
import { RatingControl } from "./RatingControl";
import {
  createJournalEntryAction,
  updateJournalEntryAction,
  deleteJournalEntryAction,
  searchJournalTitlesAction,
} from "./actions";

const FREE_KEY = "__free__";
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Compact rating badge shown on a saved entry — reflects whichever system the
// note was rated with.
function RatingBadge({ e }: { e: JournalEntry }) {
  const mode = e.rateMode || "glyphs";
  if (mode === "symbols" && e.symbol && e.symbol.value > 0) {
    const { style, value } = e.symbol;
    return (
      <span className="entry__feel entry__rate">
        {style === "grades" ? GRADE_LETTERS[value] : style === "emoji" ? MOOD_EMOJI[value] : `★ ${value}`}
      </span>
    );
  }
  if (mode === "axes") {
    const vals = ["story", "art", "music", "pacing"].map((k) => e.dims?.[k] ?? 0).filter((v) => v > 0);
    if (!vals.length) return null;
    const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
    return <span className="entry__feel entry__rate">axes · {avg}</span>;
  }
  const fl = e.feeling ? (WL_FEELINGS as Record<string, { label: string }>)[e.feeling] : null;
  if (!fl) return null;
  return (
    <span className={"entry__feel entry__feel--" + e.feeling}>
      <span style={{ display: "inline-flex" }}>
        <Glyph feeling={e.feeling as Feeling} set="orbs" size={14} />
      </span>
      {fl.label}
    </span>
  );
}

function fmtDay(iso: string) {
  const d = new Date(iso);
  return `${WD[d.getDay()]} · ${MO[d.getMonth()]} ${d.getDate()}`;
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}
function relative(iso: string, now: number): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  const w = Math.floor(days / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(days / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function Paragraphs({ text }: { text: string }) {
  const parts = text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => (
        <p key={i}>
          {p.split("\n").map((line, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {line}
            </Fragment>
          ))}
        </p>
      ))}
    </>
  );
}

type Group = {
  key: string; titleId: string | null; title: string; cover: string | null;
  year: number | null; episodes: number | null; count: number; last: string;
};
type Target = { id: string | null; title: string; episodes?: number | null };

// A non-note diary event woven into the timeline — a title you marked watched or
// favourited. Read-only (edited from the title/watchlist, not here).
export type DiaryEvent = {
  id: string;
  kind: "completed" | "favorited" | "rewatched";
  at: string; // ISO
  titleId: string;
  title: string;
  cover: string | null;
  ordinal?: number; // rewatched: which time through
};

// pull the episode number out of a free-text marker ("EP 17" → 17, "" → null)
const epNum = (s: string): number | null => {
  const m = s.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
};
type Draft = {
  heading: string; episode: string; quote: string; body: string; showQuote: boolean;
  rateMode: string; feeling: string | null; symbol: { style: string; value: number } | null; dims: Record<string, number>;
};
const EMPTY: Draft = {
  heading: "", episode: "", quote: "", body: "", showQuote: false,
  rateMode: "glyphs", feeling: null, symbol: null, dims: {},
};

// The title shown for a note: the user's heading, or an auto one built from the
// anime title + episode, with a #n suffix when several notes share that pairing.
function autoHeading(e: JournalEntry, ordinal: number, siblings: number): string {
  const base = e.title || "Free note";
  const ep = e.episode.trim() ? ` · ${e.episode.trim()}` : "";
  const num = siblings > 1 ? ` #${ordinal}` : "";
  return `${base}${ep}${num}`;
}

// ---- shared note fields (used by the composer and inline edit) --------------
function NoteFields({
  d, set, titleLabel, episodes, titleNotes,
}: {
  d: Draft;
  set: (p: Partial<Draft>) => void;
  titleLabel: string | null;
  episodes: number;
  titleNotes: JournalEntry[];
}) {
  const hasGrid = episodes > 0;
  const [epMode, setEpMode] = useState<"num" | "grid">("num");
  const selEp = epNum(d.episode);
  // notes already written per episode for this title (for the grid badges)
  const counts: Record<number, number> = {};
  for (const e of titleNotes) {
    const n = epNum(e.episode);
    if (n) counts[n] = (counts[n] ?? 0) + 1;
  }

  return (
    <div className="jform">
      <input
        className="jform__title"
        placeholder={titleLabel ? `Title (optional) — defaults to “${titleLabel}…”` : "Title (optional)"}
        value={d.heading}
        maxLength={120}
        onChange={(e) => set({ heading: e.target.value })}
      />
      <textarea
        className={"jform__body" + (d.episode.trim() ? " jform__body--ep" : "")}
        rows={4}
        placeholder={
          selEp
            ? `Write a note about episode ${selEp}…`
            : titleLabel
              ? `Write a note about ${titleLabel}…`
              : "Write your note…"
        }
        value={d.body}
        onChange={(e) => set({ body: e.target.value })}
      />
      {(d.showQuote || d.quote) && (
        <input
          className="jform__quote"
          placeholder="A line worth keeping (optional)"
          value={d.quote}
          onChange={(e) => set({ quote: e.target.value })}
        />
      )}
      <RatingControl
        value={{ rateMode: d.rateMode, feeling: d.feeling, symbol: d.symbol, dims: d.dims }}
        onChange={(patch) => set(patch)}
      />
      <div className="jform__tools">
        {hasGrid && (
          <div className="jform__epmode" role="tablist" aria-label="Episode input">
            <button type="button" role="tab" aria-selected={epMode === "num"}
              className={"jform__epmodeopt" + (epMode === "num" ? " on" : "")} onClick={() => setEpMode("num")}>
              Type
            </button>
            <button type="button" role="tab" aria-selected={epMode === "grid"}
              className={"jform__epmodeopt" + (epMode === "grid" ? " on" : "")} onClick={() => setEpMode("grid")}>
              Grid
            </button>
          </div>
        )}
        {(!hasGrid || epMode === "num") && (
          <input
            className="jform__ep"
            placeholder="EP / part — e.g. EP 17"
            value={d.episode}
            onChange={(e) => set({ episode: e.target.value })}
          />
        )}
        {!d.showQuote && !d.quote && (
          <button type="button" className="jform__addquote" onClick={() => set({ showQuote: true })}>
            + quote
          </button>
        )}
      </div>

      {hasGrid && epMode === "grid" && (
        <div className="jform__epgrid">
          {Array.from({ length: episodes }, (_, i) => i + 1).map((n) => {
            const c = counts[n] ?? 0;
            return (
              <button
                key={n}
                type="button"
                className={"jform__epcell" + (selEp === n ? " on" : "") + (c ? " has" : "")}
                aria-pressed={selEp === n}
                title={c ? `Episode ${n} · ${c} note${c > 1 ? "s" : ""}` : `Episode ${n}`}
                onClick={() => set({ episode: selEp === n ? "" : `EP ${n}` })}
              >
                {n}
                {c > 0 && <span className="jform__epcount" aria-hidden="true">{c}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- composer (new note, with title picker) ---------------------------------
function Composer({
  open, setOpen, defaultTarget, onCreate, allEntries,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  defaultTarget: Target | null;
  onCreate: (e: JournalEntry) => void;
  allEntries: JournalEntry[];
}) {
  const [target, setTarget] = useState<Target | null>(defaultTarget);
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; title: string; year: number | null; episodes: number | null }[]>([]);
  const [d, setD] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // target is seeded from the selected group; the parent remounts this component
  // (via key) when the selection changes, so no syncing effect is needed.

  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const runSearch = (val: string) => {
    setQ(val);
    if (timer.current) clearTimeout(timer.current);
    if (val.trim().length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      const r = await searchJournalTitlesAction(val);
      setResults(r.map((x) => ({ id: x.id, title: x.title, year: x.year, episodes: x.episodes })));
    }, 250);
  };
  const reset = () => { setD(EMPTY); setPicking(false); setQ(""); setResults([]); };
  const save = async () => {
    setBusy(true);
    const entry = await createJournalEntryAction({
      titleId: target?.id ?? null, episode: d.episode, heading: d.heading,
      rateMode: d.rateMode, feeling: d.feeling, symbol: d.symbol, dims: d.dims,
      quote: d.quote, body: d.body,
    });
    setBusy(false);
    onCreate(entry);
    reset();
    setOpen(false);
  };

  const todayWd = WD[new Date().getDay()];
  const stamp = <div className="compose__avatar">today · {todayWd}</div>;

  if (!open) {
    return (
      <div className="compose">
        {stamp}
        <button type="button" className="compose__box compose__box--btn" onClick={() => setOpen(true)}>
          <span className="compose__placeholder">
            {defaultTarget?.id ? `Write a note about ${defaultTarget.title}…` : "Write a journal note…"}
          </span>
          <div className="compose__tools">
            <span className="compose__tool">＋ note</span>
          </div>
        </button>
      </div>
    );
  }

  const needPick = !target || picking;
  return (
    <div className="compose compose--open">
      {stamp}
      <div className="jcompose">
        {needPick ? (
          <div className="jpick">
            <div className="jpick__label">What are you writing about?</div>
            <div className="jpick__search">
              <Icon name="search" size={13} />
              <input autoFocus placeholder="Search a title…" value={q} onChange={(e) => runSearch(e.target.value)} />
            </div>
            {results.length > 0 && (
              <ul className="jpick__results" role="list">
                {results.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => { setTarget({ id: r.id, title: r.title, episodes: r.episodes }); setPicking(false); }}>
                      <span className="jpick__title">{r.title}</span>
                      {r.year ? <span className="jpick__year">{r.year}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="jpick__row">
              <button type="button" className="jlink" onClick={() => { setTarget({ id: null, title: "Free notes" }); setPicking(false); }}>
                No specific title — just a note
              </button>
              <button type="button" className="jlink" onClick={() => { reset(); setOpen(false); }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="jcompose__target">
              About <b>{target!.title}</b>
              <button type="button" className="jlink" onClick={() => setPicking(true)}>change</button>
            </div>
            <NoteFields
              d={d}
              set={set}
              titleLabel={target!.id ? target!.title : null}
              episodes={target!.id ? (target!.episodes ?? 0) : 0}
              titleNotes={allEntries.filter((e) => e.titleId === target!.id && !e.isTake)}
            />
            <div className="jform__actions">
              <button className="btn btn--primary" disabled={busy || (!d.body.trim() && !d.quote.trim())} onClick={save}>
                {busy ? "Saving…" : "Add note"}
              </button>
              <button className="btn" onClick={() => { reset(); setOpen(false); }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---- a single entry (view / inline edit / delete) ---------------------------
function EntryView({
  entry, heading, now, allEntries, onUpdate, onDelete,
}: {
  entry: JournalEntry;
  heading: string;
  now: number;
  allEntries: JournalEntry[];
  onUpdate: (e: JournalEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [d, setD] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);

  const startEdit = () => {
    setD({
      heading: entry.heading, episode: entry.episode, quote: entry.quote, body: entry.body, showQuote: !!entry.quote,
      rateMode: entry.rateMode || "glyphs", feeling: entry.feeling, symbol: entry.symbol, dims: entry.dims ?? {},
    });
    setEditing(true);
  };
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const save = async () => {
    setBusy(true);
    await updateJournalEntryAction(entry.id, {
      titleId: entry.titleId, episode: d.episode, heading: d.heading,
      rateMode: d.rateMode, feeling: d.feeling, symbol: d.symbol, dims: d.dims,
      quote: d.quote, body: d.body,
    });
    setBusy(false);
    setEditing(false);
    onUpdate({
      ...entry,
      episode: d.episode.trim(),
      heading: d.heading.trim(),
      rateMode: d.rateMode,
      feeling: d.feeling,
      symbol: d.symbol,
      dims: d.dims,
      quote: d.quote.trim(),
      body: d.body.trim(),
    });
  };

  const dateRail = (
    <div className="entry__rail">
      <span className="entry__dot" aria-hidden="true" />
      <div className="entry__date">
        <span className="entry__date-day">{fmtDay(entry.createdAt)}</span>
        <span>{fmtTime(entry.createdAt)}</span>
      </div>
    </div>
  );

  if (editing) {
    return (
      <article className="entry entry--editing">
        {dateRail}
        <div className="entry__body">
          <NoteFields
            d={d}
            set={set}
            titleLabel={entry.title}
            episodes={entry.titleId ? (entry.episodes ?? 0) : 0}
            titleNotes={allEntries.filter((e) => e.titleId === entry.titleId && !e.isTake)}
          />
          <div className="jform__actions">
            <button className="btn btn--primary" disabled={busy || (!d.body.trim() && !d.quote.trim())} onClick={save}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="entry">
      {dateRail}
      <div className="entry__body">
        <div className="entry__title">{heading}</div>
        <div className="entry__head">
          {entry.isTake ? (
            <span className="entry__ep entry__ep--take">Overall take</span>
          ) : entry.episode ? (
            <span className="entry__ep">{entry.episode}</span>
          ) : null}
          <RatingBadge e={entry} />
          <span className="entry__time">{relative(entry.createdAt, now)}</span>
        </div>
        {entry.quote ? <div className="entry__quote">{entry.quote}</div> : null}
        {entry.body ? <div className="entry__text"><Paragraphs text={entry.body} /></div> : null}
        <div className="entry__foot">
          <button type="button" onClick={startEdit}>✎ Edit</button>
          {confirm ? (
            <>
              <button type="button" className="jdanger" onClick={() => onDelete(entry.id)}>Delete</button>
              <button type="button" onClick={() => setConfirm(false)}>Cancel</button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirm(true)}>🗑 Delete</button>
          )}
          <span style={{ marginLeft: "auto" }}>Private · only you</span>
        </div>
      </div>
    </article>
  );
}

// n → "2nd", "3rd" …
function nth(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ---- a woven-in diary event (marked watched / favourited / rewatched) --------
function ActivityRow({ ev, now, onPick }: { ev: DiaryEvent; now: number; onPick?: (key: string) => void }) {
  const label =
    ev.kind === "completed"
      ? "✓ Marked watched"
      : ev.kind === "favorited"
        ? "♥ Added to favourites"
        : `↻ Rewatched${ev.ordinal ? ` · ${nth(ev.ordinal)} time` : ""}`;
  const href = `/anime/${encodeURIComponent(ev.titleId)}`;
  const cover = ev.cover ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={ev.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
  ) : null;
  const rail = (
    <div className="entry__rail">
      <span className={"entry__dot entry__dot--" + ev.kind} aria-hidden="true" />
      <div className="entry__date">
        <span className="entry__date-day">{fmtDay(ev.at)}</span>
        <span>{fmtTime(ev.at)}</span>
      </div>
    </div>
  );

  // Desktop (original): the event links out to the title's detail page.
  if (!onPick) {
    return (
      <article className="entry entry--act">
        {rail}
        <div className="entry__body entry__body--act">
          <Link href={href} className="entry__actcover" aria-hidden="true">{cover}</Link>
          <div className="entry__actmain">
            <span className={"entry__actverb entry__actverb--" + ev.kind}>{label}</span>
            <Link href={href} className="entry__acttitle">{ev.title}</Link>
          </div>
          <span className="entry__time">{relative(ev.at, now)}</span>
        </div>
      </article>
    );
  }

  // Mobile: clicking focuses that title's diary (and opens the composer for it)
  // rather than leaving the journal — the detail page is a tap away via
  // "View title →" once focused.
  return (
    <article
      className="entry entry--act entry--pick"
      role="button"
      tabIndex={0}
      onClick={() => onPick(ev.titleId)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(ev.titleId); } }}
    >
      {rail}
      <div className="entry__body entry__body--act">
        <span className="entry__actcover" aria-hidden="true">{cover}</span>
        <div className="entry__actmain">
          <span className={"entry__actverb entry__actverb--" + ev.kind}>{label}</span>
          <span className="entry__acttitle">{ev.title}</span>
        </div>
        <span className="entry__time">{relative(ev.at, now)}</span>
      </div>
    </article>
  );
}

// A unified timeline item: a written note or a diary event.
type TLItem = { at: string; note?: JournalEntry; act?: DiaryEvent };

// ---- the app ----------------------------------------------------------------
export function JournalApp({ entries: initial, activity, now }: { entries: JournalEntry[]; activity: DiaryEvent[]; now: number }) {
  const [entries, setEntries] = useState<JournalEntry[]>(initial);
  const [railQuery, setRailQuery] = useState("");
  // open on the full diary timeline (notes + marked-watched + favourited woven
  // together); the rail narrows to a single title on demand
  const [selected, setSelected] = useState<string>("all");
  const [composerOpen, setComposerOpen] = useState(false);
  // Phones get the redesigned single-column journal; everything wider keeps the
  // original two-column rail + timeline. This component is client-only
  // (JournalAppLoader uses ssr:false), so reading matchMedia up front is safe —
  // the first render already knows the viewport, so there's no layout flash.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 520px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 520px)");
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  // filters (applied to the selected group's notes)
  const [fQuery, setFQuery] = useState(""); // desktop: free-text search of the diary
  const [fDate, setFDate] = useState("all"); // all | today | 7d | 30d
  const [fRate, setFRate] = useState("any"); // any | glyphs | axes | symbols
  const [fSort, setFSort] = useState("new"); // new | old

  // Display title per entry: the user's heading, else an auto one numbered within
  // its (title + episode) group.
  const headings = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>();
    const buckets = new Map<string, JournalEntry[]>();
    for (const e of entries) {
      if (e.isTake) {
        map.set(e.id, e.heading.trim() || `${e.title ?? "This title"} — overall take`);
        continue;
      }
      const k = (e.titleId ?? "free") + "|" + e.episode.trim().toLowerCase();
      const arr = buckets.get(k);
      if (arr) arr.push(e);
      else buckets.set(k, [e]);
    }
    for (const list of buckets.values()) {
      const chrono = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      chrono.forEach((e, i) => {
        map.set(e.id, e.heading.trim() || autoHeading(e, i + 1, chrono.length));
      });
    }
    return map;
  }, [entries]);

  const groups = useMemo<Group[]>(() => {
    const m = new Map<string, Group>();
    for (const e of entries) {
      const key = e.titleId ?? FREE_KEY;
      let g = m.get(key);
      if (!g) {
        g = { key, titleId: e.titleId, title: e.title ?? "Free notes", cover: e.cover, year: e.year, episodes: e.episodes, count: 0, last: e.createdAt };
        m.set(key, g);
      }
      g.count++;
      if (e.createdAt > g.last) g.last = e.createdAt;
    }
    // titles you marked watched / favourited join the rail too, so the journal is
    // a complete diary — not only the titles you wrote about
    for (const a of activity) {
      let g = m.get(a.titleId);
      if (!g) {
        g = { key: a.titleId, titleId: a.titleId, title: a.title, cover: a.cover, year: null, episodes: null, count: 0, last: a.at };
        m.set(a.titleId, g);
      } else if (!g.cover && a.cover) g.cover = a.cover;
      g.count++;
      if (a.at > g.last) g.last = a.at;
    }
    return [...m.values()].sort((a, b) => b.last.localeCompare(a.last));
  }, [entries, activity]);

  // Resolve the selection at render: if the chosen group was deleted, fall back
  // to "all" (no effect needed).
  const effSelected = selected !== "all" && groups.some((g) => g.key === selected) ? selected : "all";
  const selGroup = effSelected === "all" ? null : groups.find((g) => g.key === effSelected) ?? null;

  // Does the current scope hold anything at all (before filters)?
  const scopeHasItems =
    effSelected === "all"
      ? entries.length + activity.length > 0
      : entries.some((e) => (e.titleId ?? FREE_KEY) === effSelected) || activity.some((a) => a.titleId === effSelected);

  // The merged, filtered, sorted timeline for the selected scope — written notes
  // and diary events (marked-watched / favourited) woven together by date.
  const timeline = useMemo<TLItem[]>(() => {
    const scopedNotes = effSelected === "all" ? entries : entries.filter((e) => (e.titleId ?? FREE_KEY) === effSelected);
    const scopedActs = effSelected === "all" ? activity : activity.filter((a) => a.titleId === effSelected);
    // Mobile has one search bar and it narrows the history by TITLE. Desktop
    // keeps the original free-text search of the diary in its filter row.
    const q = (isMobile ? railQuery : fQuery).trim().toLowerCase();
    const noteMatches = (e: JournalEntry) =>
      !q ||
      (isMobile
        ? (e.title ?? "").toLowerCase().includes(q)
        : `${headings.get(e.id) ?? ""} ${e.title ?? ""} ${e.episode} ${e.body} ${e.quote}`
            .toLowerCase()
            .includes(q));
    const day = 86400000;
    const cutoff = fDate === "today" ? now - day : fDate === "7d" ? now - 7 * day : fDate === "30d" ? now - 30 * day : 0;
    const items: TLItem[] = [];
    for (const e of scopedNotes) {
      if (!noteMatches(e)) continue;
      if (cutoff && new Date(e.createdAt).getTime() < cutoff) continue;
      if (fRate !== "any" && (e.rateMode || "glyphs") !== fRate) continue;
      items.push({ at: e.createdAt, note: e });
    }
    // diary events have no rating system, so they drop out when filtering by one
    if (fRate === "any") {
      for (const a of scopedActs) {
        if (q && !a.title.toLowerCase().includes(q)) continue;
        if (cutoff && new Date(a.at).getTime() < cutoff) continue;
        items.push({ at: a.at, act: a });
      }
    }
    items.sort((x, y) => (fSort === "old" ? x.at.localeCompare(y.at) : y.at.localeCompare(x.at)));
    return items;
  }, [entries, activity, effSelected, isMobile, railQuery, fQuery, headings, fDate, fRate, fSort, now]);
  const filtersActive = (isMobile ? railQuery : fQuery).trim() !== "" || fDate !== "all" || fRate !== "any";

  // the rail's own title filter (desktop)
  const railGroups = railQuery.trim()
    ? groups.filter((g) => g.title.toLowerCase().includes(railQuery.trim().toLowerCase()))
    : groups;

  const defaultTarget: Target | null = selGroup
    ? { id: selGroup.titleId, title: selGroup.title, episodes: selGroup.episodes }
    : null;

  const onCreate = (entry: JournalEntry) => {
    setEntries((es) => [entry, ...es]);
    setSelected(entry.titleId ?? FREE_KEY);
  };
  const onUpdate = (entry: JournalEntry) => setEntries((es) => es.map((e) => (e.id === entry.id ? entry : e)));
  const onDelete = (id: string) => {
    void deleteJournalEntryAction(id);
    setEntries((es) => es.filter((e) => e.id !== id));
  };

  const totalItems = entries.length + activity.length; // whole diary (notes + events)

  // The searchable history sits BELOW the reading area, so picking a title from
  // it scrolls back to the top where that title's diary is now shown. Picking a
  // specific title also opens the composer targeted to it — so the top switches
  // from "All entries" into making an entry for that title (the Composer seeds
  // its target from the selected group). "All entries" just returns to browsing.
  const pickScope = (key: string) => {
    setSelected(key);
    setComposerOpen(key !== "all");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---- pieces shared by both layouts --------------------------------------
  const composer = (
    <Composer key={effSelected} open={composerOpen} setOpen={setComposerOpen} defaultTarget={defaultTarget} onCreate={onCreate} allEntries={entries} />
  );

  const filterRow = scopeHasItems ? (
    <div className="jfilters">
      {/* desktop keeps the original free-text diary search in the filter row; on
          a phone the single "Search titles…" bar below covers searching */}
      {!isMobile && (
        <div className="jfilters__search">
          <Icon name="search" size={13} />
          <input
            placeholder="Search your diary…"
            value={fQuery}
            onChange={(e) => setFQuery(e.target.value)}
          />
        </div>
      )}
      <select className="jfilters__sel" value={fDate} onChange={(e) => setFDate(e.target.value)} aria-label="Date range">
        <option value="all">Any time</option>
        <option value="today">Today</option>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
      </select>
      <select className="jfilters__sel" value={fRate} onChange={(e) => setFRate(e.target.value)} aria-label="Rating system">
        <option value="any">Any rating</option>
        <option value="glyphs">Glyphs</option>
        <option value="axes">Axes</option>
        <option value="symbols">Symbols</option>
      </select>
      <select className="jfilters__sel jfilters__sort" value={fSort} onChange={(e) => setFSort(e.target.value)} aria-label="Sort order">
        <option value="new">Newest first</option>
        <option value="old">Oldest first</option>
      </select>
    </div>
  ) : null;

  const entryList = timeline.length === 0 ? (
    <p className="journal-empty">
      {totalItems === 0
        ? "Your diary is empty. Write a note above, or mark titles watched and rate them — it all shows up here."
        : filtersActive
          ? "Nothing matches your filters."
          : "Nothing here yet."}
    </p>
  ) : (
    timeline.map((it) =>
      it.note ? (
        <EntryView key={it.note.id} entry={it.note} heading={headings.get(it.note.id) ?? ""} now={now} allEntries={entries} onUpdate={onUpdate} onDelete={onDelete} />
      ) : (
        // mobile focuses that title in place; desktop links out to it (original)
        <ActivityRow key={it.act!.id} ev={it.act!} now={now} onPick={isMobile ? pickScope : undefined} />
      ),
    )
  );

  const scopeCover = (
    <div className="timeline__cover" aria-hidden="true">
      {selGroup?.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="jcover" src={selGroup.cover} alt="" referrerPolicy="no-referrer" />
      ) : null}
    </div>
  );

  const scopeMeta = selGroup ? (
    <>
      {selGroup.year ? (<><span>{selGroup.year}</span><span className="sep" /></>) : null}
      {selGroup.episodes ? (<><span>{selGroup.episodes} episodes</span><span className="sep" /></>) : null}
      <span>{selGroup.count} entr{selGroup.count === 1 ? "y" : "ies"}</span>
    </>
  ) : (
    <span>{totalItems} entr{totalItems === 1 ? "y" : "ies"} across {groups.length} title{groups.length === 1 ? "" : "s"}</span>
  );

  const scopeTitle = (
    <div>
      <h2 className="timeline__title" id="tl-title">{selGroup ? selGroup.title : "All entries"}</h2>
      <div className="timeline__meta">{scopeMeta}</div>
    </div>
  );

  // ---- MOBILE (≤520px): the redesigned single-column journal ---------------
  if (isMobile) {
    return (
      <div className="journal journal--mobile">
        <section className="timeline" aria-labelledby="tl-title">
          {/* keyed on the scope so switching titles remounts this block and
              replays the smooth fade-in (see .timeline__view in journal.css) */}
          <div className="timeline__view" key={effSelected}>
            <header className="timeline__head">
              {scopeCover}
              {scopeTitle}
              {selGroup ? (
                <div className="actions">
                  <BackButton label="Back" onBack={() => pickScope("all")} className="backbtn--inline" />
                  {selGroup.titleId ? (
                    <Link className="btn" href={`/anime/${encodeURIComponent(selGroup.titleId)}`}>
                      View title →
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </header>

            {composer}
            {filterRow}

            {/* one search bar — narrows the diary history below by title */}
            {effSelected === "all" && totalItems > 0 && (
              <div className="jsearch">
                <Icon name="search" size={14} />
                <input
                  type="text"
                  placeholder="Search titles…"
                  value={railQuery}
                  onChange={(e) => setRailQuery(e.target.value)}
                />
              </div>
            )}

            {entryList}
          </div>
        </section>
      </div>
    );
  }

  // ---- DESKTOP: the original rail + timeline -------------------------------
  return (
    <div className="journal">
      <aside className="rail" aria-label="Your journaled titles">
        <div className="rail__head">
          <div className="rail__search">
            <Icon name="search" size={13} />
            <input
              type="text"
              placeholder="Search your titles…"
              value={railQuery}
              onChange={(e) => setRailQuery(e.target.value)}
            />
          </div>
          <button
            className="rail__new"
            title="Write a new note"
            onClick={() => { setSelected("all"); setComposerOpen(true); }}
          >
            <Icon name="plus" size={14} />
          </button>
        </div>
        <ul className="rail__list" role="list">
          <li
            className={"anime-row jrail-all" + (effSelected === "all" ? " on" : "")}
            onClick={() => setSelected("all")}
          >
            <span className="anime-row__thumb jrail-all__thumb" aria-hidden="true" />
            <div>
              <div className="anime-row__title">All entries</div>
              <div className="anime-row__sub">{totalItems} entr{totalItems === 1 ? "y" : "ies"}</div>
            </div>
            <span className="anime-row__count">{totalItems}</span>
          </li>
          {railGroups.map((g, i) => (
            <li
              key={g.key}
              className={`anime-row anime-row--h${(i % 6) + 1}` + (effSelected === g.key ? " on" : "")}
              onClick={() => setSelected(g.key)}
            >
              <span className="anime-row__thumb" aria-hidden="true">
                {g.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.cover} alt="" referrerPolicy="no-referrer" />
                ) : null}
              </span>
              <div>
                <div className="anime-row__title">{g.title}</div>
                <div className="anime-row__sub">last activity {relative(g.last, now)}</div>
              </div>
              <span className="anime-row__count">{g.count}</span>
            </li>
          ))}
          {groups.length === 0 && (
            <li className="rail__empty">No titles yet — start a note with ＋.</li>
          )}
        </ul>
        <div className="rail__footer">
          <span>{groups.length} title{groups.length === 1 ? "" : "s"} · {totalItems} entr{totalItems === 1 ? "y" : "ies"}</span>
        </div>
      </aside>

      <section className="timeline" aria-labelledby="tl-title">
        <header className="timeline__head">
          {scopeCover}
          {scopeTitle}
          {selGroup?.titleId ? (
            <div className="actions">
              <Link className="btn" href={`/anime/${encodeURIComponent(selGroup.titleId)}`}>
                View title →
              </Link>
            </div>
          ) : null}
        </header>

        {composer}
        {filterRow}
        {entryList}
      </section>
    </div>
  );
}