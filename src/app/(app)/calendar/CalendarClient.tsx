"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { TrackedTitle } from "@/lib/calendar";

export type EventLite = {
  id: string;
  kind: string; // event | premiere
  title: string;
  subtitle: string;
  startsOn: string; // YYYY-MM-DD
  endsOn: string | null;
  location: string;
  url: string | null;
  cover: string | null;
  accent: string | null;
  hue: number;
  titleId: string | null;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

type Cell = { y: number; m: number; day: number; iso: string; dow: number; inMonth: boolean };
type DayItem =
  | { type: "event" | "premiere"; label: string; ev: EventLite }
  | { type: "release"; label: string; tr: TrackedTitle };

// 42-cell (6x7) Monday-start matrix for the given month, with spillover days.
function monthMatrix(year: number, month: number): Cell[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Mon=0 … Sun=6
  const start = new Date(year, month, 1 - lead);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return {
      y: d.getFullYear(), m: d.getMonth(), day: d.getDate(),
      iso: isoOf(d.getFullYear(), d.getMonth(), d.getDate()),
      dow: d.getDay(), // 0=Sun … 6=Sat
      inMonth: d.getMonth() === month,
    };
  });
}

export function CalendarClient({ events, tracked }: { events: EventLite[]; tracked: TrackedTitle[] }) {
  const today = new Date();
  const todayIso = isoOf(today.getFullYear(), today.getMonth(), today.getDate());
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [sel, setSel] = useState(todayIso);
  // direction of the last month change (-1 back, +1 forward, 0 = jump) — drives
  // which way the grid slides in.
  const [dir, setDir] = useState(0);

  const cells = useMemo(() => monthMatrix(cursor.y, cursor.m), [cursor]);

  const itemsFor = useMemo(() => {
    const withWeekday = tracked.filter((t) => t.weekday != null);
    return (iso: string, dow: number): DayItem[] => {
      const evs: DayItem[] = events
        .filter((e) => iso >= e.startsOn && iso <= (e.endsOn ?? e.startsOn))
        .map((e) => ({ type: e.kind === "premiere" ? "premiere" : "event", label: e.title, ev: e }));
      const rel: DayItem[] = withWeekday
        .filter((t) => t.weekday === dow)
        .map((t) => ({ type: "release", label: t.title, tr: t }));
      return [...evs, ...rel];
    };
  }, [events, tracked]);

  const selItems = useMemo(() => {
    const d = new Date(sel + "T12:00:00");
    return itemsFor(sel, d.getDay());
  }, [sel, itemsFor]);

  const trackedCount = tracked.length;
  const withDay = tracked.filter((t) => t.weekday != null).length;
  const go = (delta: number) => {
    setDir(delta);
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };
  const selDate = new Date(sel + "T12:00:00");

  // Mobile shows a horizontal day strip (this month's days) instead of the
  // cramped month grid. Keep the selected/today cell scrolled into view.
  const monthDays = useMemo(() => cells.filter((c) => c.inMonth), [cells]);
  const stripRef = useRef<HTMLDivElement>(null);
  const selCellRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = selCellRef.current;
    const box = stripRef.current;
    if (!el || !box || box.clientWidth === 0) return; // hidden on desktop → no-op
    box.scrollLeft +=
      el.getBoundingClientRect().left - box.getBoundingClientRect().left - box.clientWidth / 2 + el.clientWidth / 2;
  }, [sel, cursor]);

  return (
    <div className="cal">
      <div className="cal-toolbar">
        <div className="cal-title">
          <span className="cal-month-name">{MONTHS[cursor.m]}</span>
          <span className="cal-year">{cursor.y}</span>
        </div>
        <div className="cal-nav">
          <button className="cal-navbtn" onClick={() => go(-1)} aria-label="Previous month">‹</button>
          <button className="cal-today" onClick={() => { setDir(0); setCursor({ y: today.getFullYear(), m: today.getMonth() }); setSel(todayIso); }}>Today</button>
          <button className="cal-navbtn" onClick={() => go(1)} aria-label="Next month">›</button>
        </div>
      </div>

      <div className="cal-legend">
        <span className="cal-key"><i className="cal-dot cal-dot--event" />Event</span>
        <span className="cal-key"><i className="cal-dot cal-dot--premiere" />Premiere</span>
        <span className="cal-key"><i className="cal-dot cal-dot--release" />Weekly release</span>
        <span className="cal-legend__spacer" />
        <span className="cal-tracking">
          {trackedCount > 0
            ? `Tracking ${trackedCount} show${trackedCount === 1 ? "" : "s"}`
            : "Not tracking anything yet"}
        </span>
      </div>

      {/* MOBILE week strip — swipeable days with colour pips (replaces the
          cramped month grid on a phone; the month grid is hidden ≤520px) */}
      <div className="cal-weekstrip" ref={stripRef}>
        {monthDays.map((c) => {
          const items = itemsFor(c.iso, c.dow);
          const isSel = c.iso === sel;
          return (
            <button
              key={c.iso}
              ref={isSel ? selCellRef : undefined}
              type="button"
              onClick={() => setSel(c.iso)}
              className={
                "cal-wday" +
                (c.iso < todayIso ? " cal-wday--past" : "") +
                (c.iso === todayIso ? " cal-wday--today" : "") +
                (isSel ? " cal-wday--sel" : "")
              }
            >
              <span className="cal-wday__dow">{WEEKDAYS[(c.dow + 6) % 7]}</span>
              <span className="cal-wday__num">{c.day}</span>
              <span className="cal-wday__pips">
                {items.slice(0, 3).map((it, i) => (
                  <i key={i} className={"cal-pip cal-pip--" + it.type} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="cal-layout">
        <div className="cal-grid" role="grid" key={`${cursor.y}-${cursor.m}`} data-dir={dir}>
          {WEEKDAYS.map((d) => (
            <div className="cal-dow" key={d}>{d}</div>
          ))}
          {cells.map((c) => {
            const items = itemsFor(c.iso, c.dow);
            const isSel = c.iso === sel;
            // Collapsed cells are a fixed height, so cap the visible chips to a
            // bounded number of lines (2 + a "more" tag when there are extras).
            // The selected cell expands and shows every item with its full name.
            const visible = isSel ? items : items.length > 3 ? items.slice(0, 2) : items.slice(0, 3);
            const hidden = items.length - visible.length;
            return (
              <button
                key={c.iso}
                type="button"
                onClick={() => setSel(c.iso)}
                className={
                  "cal-cell" +
                  (c.inMonth ? "" : " cal-cell--muted") +
                  (c.iso < todayIso ? " cal-cell--past" : "") +
                  (c.iso === todayIso ? " cal-cell--today" : "") +
                  (isSel ? " cal-cell--sel" : "")
                }
              >
                <span className="cal-cell__num">{c.day}</span>
                <span className="cal-cell__chips">
                  {visible.map((it, i) => (
                    <span key={i} className={"cal-chip cal-chip--" + it.type}>
                      {it.label}
                    </span>
                  ))}
                  {!isSel && hidden > 0 && <span className="cal-more">+{hidden} more</span>}
                </span>
              </button>
            );
          })}
        </div>

        {/* selected-day detail panel */}
        <aside className="cal-day">
          <div className="cal-day__inner" key={sel}>
          <div className="cal-day__head">
            <span className="cal-day__dow">{WEEKDAYS[(selDate.getDay() + 6) % 7]}</span>
            <span className="cal-day__date">{MONTHS[selDate.getMonth()]} {selDate.getDate()}</span>
          </div>

          {selItems.length === 0 ? (
            <p className="cal-day__empty">Nothing scheduled on this day.</p>
          ) : (
            <ul className="cal-day__list">
              {selItems.map((it, i) => {
                if (it.type === "release") {
                  return (
                    <li key={i} className="cal-item cal-item--release">
                      <span className="cal-item__bar" />
                      <div className="cal-item__body">
                        <span className="cal-item__kind">New episode</span>
                        <Link className="cal-item__title" href={`/anime/${encodeURIComponent(it.tr.titleId)}`}>
                          {it.tr.title}
                        </Link>
                        {it.tr.time && <span className="cal-item__meta">Airs {it.tr.time} JST</span>}
                      </div>
                    </li>
                  );
                }
                const e = it.ev;
                const span = e.endsOn && e.endsOn !== e.startsOn ? `${e.startsOn} → ${e.endsOn}` : null;
                const inner = (
                  <>
                    <span className={"cal-item__bar cal-item__bar--" + it.type} />
                    <div className="cal-item__body">
                      <span className="cal-item__kind">{it.type === "premiere" ? "Premiere" : "Event"}</span>
                      <span className="cal-item__title">{e.title}</span>
                      {e.subtitle && <span className="cal-item__sub">{e.subtitle}</span>}
                      <span className="cal-item__meta">
                        {[e.location || null, span].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  </>
                );
                return (
                  <li key={i} className={"cal-item cal-item--" + it.type}>
                    {e.titleId ? (
                      <Link className="cal-item__link" href={`/anime/${encodeURIComponent(e.titleId)}`}>{inner}</Link>
                    ) : e.url ? (
                      <a className="cal-item__link" href={e.url} target="_blank" rel="noopener noreferrer">{inner}</a>
                    ) : (
                      <div className="cal-item__link">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          </div>

          {trackedCount === 0 && (
            <div className="cal-day__hint">
              Mark an airing anime as <strong>tracking</strong> from its page and its weekly
              releases will appear here. <Link href="/search?type=anime&sort=popular">Find something airing →</Link>
            </div>
          )}
          {trackedCount > 0 && withDay < trackedCount && (
            <p className="cal-day__note">
              {trackedCount - withDay} tracked show{trackedCount - withDay === 1 ? "" : "s"} had no known broadcast day.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
