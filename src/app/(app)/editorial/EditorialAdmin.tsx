"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DbEditorialPick } from "@/db/schema";
import {
  createPickAction, updatePickAction, deletePickAction,
  togglePublishedAction, movePickAction,
} from "./actions";

const HUES = [
  { v: 1, label: "Blue" },
  { v: 2, label: "Orange" },
  { v: 3, label: "Purple" },
];

export function EditorialAdmin({ initialPicks }: { initialPicks: DbEditorialPick[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialPicks);
  const [pending, start] = useTransition();
  const [savedId, setSavedId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // re-sync when the server sends fresh data (after add/delete/move/publish)
  useEffect(() => setItems(initialPicks), [initialPicks]);

  const patch = (id: string, field: keyof DbEditorialPick, value: unknown) =>
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));

  const fields = (p: DbEditorialPick) => ({
    kicker: p.kicker, title: p.title, excerpt: p.excerpt, hue: p.hue,
    avatarHue: p.avatarHue, byline: p.byline, href: p.href, cover: p.cover,
    published: p.published,
  });

  const save = (p: DbEditorialPick) =>
    start(async () => { await updatePickAction(p.id, fields(p)); setSavedId(p.id); setTimeout(() => setSavedId(null), 2500); router.refresh(); });
  const add = () =>
    start(async () => { await createPickAction({ title: "New pick", kicker: "Section · label", excerpt: "", hue: 1, avatarHue: 2, byline: "By the Editors", published: false }); router.refresh(); });
  const del = (id: string) =>
    start(async () => { await deletePickAction(id); setConfirmDel(null); router.refresh(); });
  const move = (id: string, dir: "up" | "down") =>
    start(async () => { await movePickAction(id, dir); router.refresh(); });
  const togglePub = (p: DbEditorialPick) =>
    start(async () => { await togglePublishedAction(p.id, !p.published); router.refresh(); });

  return (
    <div className={"eda" + (pending ? " eda--busy" : "")}>
      <div className="eda__toolbar">
        <button className="btn btn--primary" onClick={add} disabled={pending}>＋ New pick</button>
        <span className="eda__hint">{items.length} pick{items.length === 1 ? "" : "s"} · changes go live on Home when you save</span>
      </div>

      <div className="eda__list">
        {items.map((p, i) => (
          <article key={p.id} className={"eda__card" + (p.published ? "" : " eda__card--draft")}>
            {/* live preview */}
            <div className={`eda__preview editorial__card card editorial__card--h${p.hue}`} aria-hidden="true">
              <div className="editorial__art">
                {p.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="eda__preview-cover" src={p.cover} alt="" referrerPolicy="no-referrer" />
                ) : null}
              </div>
              <div className="editorial__body">
                <span className="editorial__kicker">{p.kicker || "—"}</span>
                <h4 className="editorial__title">{p.title || "Untitled"}</h4>
                <p className="editorial__excerpt">{p.excerpt}</p>
                <div className="editorial__byline">
                  <span className={`avatar avatar--h${p.avatarHue}`} style={{ width: 24, height: 24 }} />
                  <span>{p.byline}</span>
                </div>
              </div>
            </div>

            {/* form */}
            <div className="eda__form">
              <div className="eda__row">
                <label className="eda__fld eda__fld--grow">
                  <span>Kicker</span>
                  <input value={p.kicker} onChange={(e) => patch(p.id, "kicker", e.target.value)} placeholder="Genre · Fantasy" />
                </label>
                <label className="eda__fld">
                  <span>Color</span>
                  <select value={p.hue} onChange={(e) => patch(p.id, "hue", Number(e.target.value))}>
                    {HUES.map((h) => <option key={h.v} value={h.v}>{h.label}</option>)}
                  </select>
                </label>
                <label className="eda__fld">
                  <span>Avatar hue</span>
                  <select value={p.avatarHue} onChange={(e) => patch(p.id, "avatarHue", Number(e.target.value))}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              </div>

              <label className="eda__fld">
                <span>Title</span>
                <input value={p.title} onChange={(e) => patch(p.id, "title", e.target.value)} placeholder="Headline" />
              </label>

              <label className="eda__fld">
                <span>Excerpt</span>
                <textarea rows={2} value={p.excerpt} onChange={(e) => patch(p.id, "excerpt", e.target.value)} placeholder="A sentence or two…" />
              </label>

              <div className="eda__row">
                <label className="eda__fld eda__fld--grow">
                  <span>Byline</span>
                  <input value={p.byline} onChange={(e) => patch(p.id, "byline", e.target.value)} placeholder="By the Editors · 8 min read" />
                </label>
              </div>

              <div className="eda__row">
                <label className="eda__fld eda__fld--grow">
                  <span>Link (optional)</span>
                  <input value={p.href ?? ""} onChange={(e) => patch(p.id, "href", e.target.value)} placeholder="https://…  or  /search?genre=Fantasy" />
                </label>
                <label className="eda__fld eda__fld--grow">
                  <span>Cover image URL (optional)</span>
                  <input value={p.cover ?? ""} onChange={(e) => patch(p.id, "cover", e.target.value)} placeholder="https://…" />
                </label>
              </div>

              <div className="eda__actions">
                <button className="btn btn--primary" onClick={() => save(p)} disabled={pending}>
                  {savedId === p.id ? "Saved ✓" : "Save"}
                </button>
                <button className="btn" onClick={() => togglePub(p)} disabled={pending}>
                  {p.published ? "Unpublish" : "Publish"}
                </button>
                <button className="btn eda__icon" onClick={() => move(p.id, "up")} disabled={pending || i === 0} title="Move up">↑</button>
                <button className="btn eda__icon" onClick={() => move(p.id, "down")} disabled={pending || i === items.length - 1} title="Move down">↓</button>
                <span className="eda__spacer" />
                {confirmDel === p.id ? (
                  <>
                    <span className="eda__confirm">Delete?</span>
                    <button className="btn btn--danger" onClick={() => del(p.id)} disabled={pending}>Yes, delete</button>
                    <button className="btn" onClick={() => setConfirmDel(null)} disabled={pending}>Cancel</button>
                  </>
                ) : (
                  <button className="btn eda__del" onClick={() => setConfirmDel(p.id)} disabled={pending}>Delete</button>
                )}
              </div>
            </div>
          </article>
        ))}

        {items.length === 0 && (
          <div className="eda__empty">No picks yet. Click “＋ New pick” to add the first one.</div>
        )}
      </div>
    </div>
  );
}
