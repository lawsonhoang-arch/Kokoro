"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DbCalendarEvent } from "@/db/schema";
import {
  createEventAction, updateEventAction, deleteEventAction, toggleEventPublishedAction,
} from "./actions";

const today = () => new Date().toISOString().slice(0, 10);

export function CalendarAdmin({ initialEvents }: { initialEvents: DbCalendarEvent[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialEvents);
  const [pending, start] = useTransition();
  const [savedId, setSavedId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  // which cards are expanded — collapsed by default so the list reads as an
  // at-a-glance overview; a card opens to reveal its full edit form.
  const [open, setOpen] = useState<Set<string>>(new Set());

  // re-sync the editable copy whenever the server sends fresh data (after a
  // create/save/delete → router.refresh)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setItems(initialEvents), [initialEvents]);

  const isOpen = (id: string) => open.has(id);
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const patch = (id: string, field: keyof DbCalendarEvent, value: unknown) =>
    setItems((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));

  const fields = (e: DbCalendarEvent) => ({
    kind: e.kind, title: e.title, subtitle: e.subtitle,
    startsOn: e.startsOn, endsOn: e.endsOn, location: e.location,
    url: e.url, cover: e.cover, accent: e.accent, titleId: e.titleId,
    hue: e.hue, published: e.published,
  });

  const save = (e: DbCalendarEvent) =>
    start(async () => {
      await updateEventAction(e.id, fields(e));
      setSavedId(e.id);
      setTimeout(() => setSavedId(null), 2500);
      router.refresh();
    });
  const add = (kind: "event" | "premiere") =>
    start(async () => {
      const id = await createEventAction({
        kind,
        title: kind === "premiere" ? "New premiere" : "New event",
        subtitle: "",
        startsOn: today(),
        published: false,
        hue: kind === "premiere" ? 3 : 1,
      });
      // open the new card straight away so it's ready to edit
      setOpen((prev) => new Set(prev).add(id));
      router.refresh();
    });
  const del = (id: string) =>
    start(async () => { await deleteEventAction(id); setConfirmDel(null); router.refresh(); });
  const togglePub = (e: DbCalendarEvent) =>
    start(async () => { await toggleEventPublishedAction(e.id, !e.published); router.refresh(); });

  return (
    <div className={"cae" + (pending ? " cae--busy" : "")}>
      <div className="cae__toolbar">
        <button className="btn btn--primary" onClick={() => add("event")} disabled={pending}>＋ New event</button>
        <button className="btn" onClick={() => add("premiere")} disabled={pending}>＋ New premiere</button>
        <span className="cae__hint">{items.length} entr{items.length === 1 ? "y" : "ies"} · published entries show on the calendar</span>
      </div>

      <div className="cae__list">
        {items.map((e) => {
          const expanded = isOpen(e.id);
          return (
            <article
              key={e.id}
              className={
                "cae__card" +
                (e.published ? "" : " cae__card--draft") +
                (e.kind === "premiere" ? " cae__card--premiere" : "") +
                (expanded ? " cae__card--open" : "")
              }
            >
              <div className="cae__cardhead">
                <button
                  className="cae__toggle"
                  onClick={() => toggle(e.id)}
                  aria-expanded={expanded}
                  aria-label={expanded ? "Collapse" : "Expand"}
                >
                  <svg className="cae__chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
                <span className={"cae__badge cae__badge--" + e.kind}>{e.kind === "premiere" ? "Premiere" : "Event"}</span>
                <button className="cae__summary" onClick={() => toggle(e.id)} title={e.title}>
                  <span className="cae__summary-title">{e.title || "Untitled"}</span>
                  <span className="cae__summary-when">{e.startsOn}{e.endsOn && e.endsOn !== e.startsOn ? ` → ${e.endsOn}` : ""}</span>
                </button>

                {savedId === e.id && <span className="cae__saved">Saved ✓</span>}
                <div className="cae__quick">
                  <button className="cae__pub" onClick={() => togglePub(e)} disabled={pending}>
                    {e.published ? "Published" : "Draft"}
                  </button>
                  <button className="btn btn--primary cae__qbtn" onClick={() => save(e)} disabled={pending}>Save</button>
                  {confirmDel === e.id ? (
                    <>
                      <button className="btn cae__danger cae__qbtn" onClick={() => del(e.id)} disabled={pending}>Delete?</button>
                      <button className="btn cae__qbtn" onClick={() => setConfirmDel(null)} disabled={pending} aria-label="Cancel delete">✕</button>
                    </>
                  ) : (
                    <button className="btn cae__del cae__qbtn" onClick={() => setConfirmDel(e.id)} disabled={pending}>Delete</button>
                  )}
                </div>
              </div>

              <div className="cae__collapse" data-open={expanded}>
                <div className="cae__collapse-inner">
                  <div className="cae__form">
                    <div className="cae__row">
                      <label className="cae__fld cae__fld--sm">
                        <span>Type</span>
                        <select value={e.kind} onChange={(ev) => patch(e.id, "kind", ev.target.value)}>
                          <option value="event">Event</option>
                          <option value="premiere">Premiere</option>
                        </select>
                      </label>
                      <label className="cae__fld cae__fld--grow">
                        <span>Title</span>
                        <input value={e.title} onChange={(ev) => patch(e.id, "title", ev.target.value)} placeholder="Anime Expo 2026" />
                      </label>
                      <label className="cae__fld cae__fld--sm">
                        <span>Colour</span>
                        <select value={e.hue} onChange={(ev) => patch(e.id, "hue", Number(ev.target.value))}>
                          {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </label>
                    </div>

                    <label className="cae__fld">
                      <span>Subtitle</span>
                      <input value={e.subtitle} onChange={(ev) => patch(e.id, "subtitle", ev.target.value)} placeholder="Industry panels, premieres, exhibitors…" />
                    </label>

                    <div className="cae__row">
                      <label className="cae__fld">
                        <span>Starts</span>
                        <input type="date" value={e.startsOn} onChange={(ev) => patch(e.id, "startsOn", ev.target.value)} />
                      </label>
                      <label className="cae__fld">
                        <span>Ends (optional)</span>
                        <input type="date" value={e.endsOn ?? ""} onChange={(ev) => patch(e.id, "endsOn", ev.target.value || null)} />
                      </label>
                      <label className="cae__fld cae__fld--grow">
                        <span>Location (optional)</span>
                        <input value={e.location} onChange={(ev) => patch(e.id, "location", ev.target.value)} placeholder="Los Angeles Convention Center" />
                      </label>
                    </div>

                    <div className="cae__row">
                      <label className="cae__fld cae__fld--grow">
                        <span>Link (optional)</span>
                        <input value={e.url ?? ""} onChange={(ev) => patch(e.id, "url", ev.target.value)} placeholder="https://…" />
                      </label>
                      <label className="cae__fld cae__fld--grow">
                        <span>Catalog title id (optional — premieres)</span>
                        <input value={e.titleId ?? ""} onChange={(ev) => patch(e.id, "titleId", ev.target.value)} placeholder="anilist:12345" />
                      </label>
                    </div>

                    <div className="cae__row">
                      <label className="cae__fld cae__fld--grow">
                        <span>Cover image URL (optional)</span>
                        <input value={e.cover ?? ""} onChange={(ev) => patch(e.id, "cover", ev.target.value)} placeholder="https://…" />
                      </label>
                      <label className="cae__fld cae__fld--grow">
                        <span>Accent colour (optional CSS)</span>
                        <input value={e.accent ?? ""} onChange={(ev) => patch(e.id, "accent", ev.target.value)} placeholder="oklch(0.7 0.15 300)" />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}

        {items.length === 0 && (
          <p className="cae__empty">No events yet. Add a convention or a premiere to get started.</p>
        )}
      </div>
    </div>
  );
}
