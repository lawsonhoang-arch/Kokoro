"use client";

import { useEffect, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  createBannerAction, updateBannerAction, deleteBannerAction,
  setBannerActiveAction, moveBannerAction, type RawBanner,
} from "./actions";

type InitBanner = {
  id: string; source: string; title: string; subtitle: string; ctaLabel: string;
  ctaHref: string | null; image: string | null; accent: string | null;
  active: boolean; startsAt: string | null; endsAt: string | null; position: number;
};

type Item = {
  id: string; source: string; title: string; subtitle: string; ctaLabel: string;
  ctaHref: string; image: string; accent: string;
  active: boolean; startsAt: string; endsAt: string;
};

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual",
  "auto-premiere": "Auto · featured premiere",
  "auto-season": "Auto · new season",
};

function isoToLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function localToIso(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}
const toItem = (b: InitBanner): Item => ({
  id: b.id, source: b.source, title: b.title, subtitle: b.subtitle, ctaLabel: b.ctaLabel,
  ctaHref: b.ctaHref ?? "", image: b.image ?? "", accent: b.accent ?? "",
  active: b.active, startsAt: isoToLocal(b.startsAt), endsAt: isoToLocal(b.endsAt),
});

// is the banner live right now, given active + schedule?
function liveNow(it: Item): boolean {
  if (!it.active) return false;
  const now = Date.now();
  if (it.startsAt && new Date(it.startsAt).getTime() > now) return false;
  if (it.endsAt && new Date(it.endsAt).getTime() < now) return false;
  return true;
}

export function EventsAdmin({ initialBanners }: { initialBanners: InitBanner[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(initialBanners.map(toItem));
  const [pending, start] = useTransition();
  const [savedId, setSavedId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  useEffect(() => setItems(initialBanners.map(toItem)), [initialBanners]);

  const patch = (id: string, field: keyof Item, value: unknown) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));

  const raw = (it: Item): RawBanner => ({
    title: it.title, subtitle: it.subtitle, ctaLabel: it.ctaLabel,
    ctaHref: it.ctaHref, image: it.image, accent: it.accent, active: it.active,
    startsAt: localToIso(it.startsAt), endsAt: localToIso(it.endsAt),
  });

  const save = (it: Item) =>
    start(async () => { await updateBannerAction(it.id, raw(it)); setSavedId(it.id); setTimeout(() => setSavedId(null), 2500); router.refresh(); });
  const add = () =>
    start(async () => { await createBannerAction({ title: "New event", subtitle: "", ctaLabel: "Learn more", active: false }); router.refresh(); });
  const del = (id: string) =>
    start(async () => { await deleteBannerAction(id); setConfirmDel(null); router.refresh(); });
  const move = (id: string, dir: "up" | "down") =>
    start(async () => { await moveBannerAction(id, dir); router.refresh(); });
  const toggle = (it: Item) =>
    start(async () => { await setBannerActiveAction(it.id, !it.active); router.refresh(); });

  return (
    <div className={"eva" + (pending ? " eva--busy" : "")}>
      <div className="eva__toolbar">
        <button className="btn btn--primary" onClick={add} disabled={pending}>＋ New banner</button>
        <span className="eva__hint">Only the top <b>active</b> banner (within its schedule) shows on Home.</span>
      </div>

      <div className="eva__list">
        {items.map((it, i) => {
          const style = it.accent ? ({ "--banner-accent": it.accent } as CSSProperties) : undefined;
          const live = liveNow(it);
          return (
            <article key={it.id} className={"eva__card" + (it.active ? "" : " eva__card--off")}>
              {/* live preview */}
              <div className="evb eva__preview" style={style} aria-hidden="true">
                {it.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="evb__bg" src={it.image} alt="" referrerPolicy="no-referrer" />
                ) : null}
                <div className="evb__scrim" />
                <div className="evb__content">
                  <div className="evb__text">
                    <h2 className="evb__title">{it.title || "Event title"}</h2>
                    {it.subtitle ? <p className="evb__sub">{it.subtitle}</p> : null}
                  </div>
                  {it.ctaLabel ? <span className="evb__cta evb__cta--static">{it.ctaLabel}</span> : null}
                </div>
                <span className="eva__src">{SOURCE_LABEL[it.source] ?? it.source}</span>
                <span className={"eva__status" + (live ? " eva__status--live" : "")}>
                  {live ? "● Live now" : it.active ? "Scheduled / not in window" : "Draft"}
                </span>
              </div>

              {/* form */}
              <div className="eva__form">
                {it.source !== "manual" && (
                  <p className="eva__automsg">
                    Auto-managed — refreshed daily from real season data. Edits here are
                    overwritten on the next refresh; create a <b>Manual</b> banner to override it.
                  </p>
                )}
                <label className="eva__fld">
                  <span>Title</span>
                  <input value={it.title} onChange={(e) => patch(it.id, "title", e.target.value)} placeholder="STREET FIGHTER 6 — M. BISON" />
                </label>
                <label className="eva__fld">
                  <span>Subtitle</span>
                  <input value={it.subtitle} onChange={(e) => patch(it.id, "subtitle", e.target.value)} placeholder="Now available" />
                </label>

                <div className="eva__row">
                  <label className="eva__fld eva__fld--grow">
                    <span>CTA label</span>
                    <input value={it.ctaLabel} onChange={(e) => patch(it.id, "ctaLabel", e.target.value)} placeholder="Now available" />
                  </label>
                  <label className="eva__fld eva__fld--grow">
                    <span>CTA link</span>
                    <input value={it.ctaHref} onChange={(e) => patch(it.id, "ctaHref", e.target.value)} placeholder="https://…  or  /search?q=…" />
                  </label>
                </div>

                <label className="eva__fld">
                  <span>Background image URL</span>
                  <input value={it.image} onChange={(e) => patch(it.id, "image", e.target.value)} placeholder="https://… (wide artwork)" />
                </label>

                <div className="eva__row">
                  <label className="eva__fld">
                    <span>Accent color</span>
                    <input value={it.accent} onChange={(e) => patch(it.id, "accent", e.target.value)} placeholder="#e23 / crimson (optional)" />
                  </label>
                  <label className="eva__fld">
                    <span>Starts (optional)</span>
                    <input type="datetime-local" value={it.startsAt} onChange={(e) => patch(it.id, "startsAt", e.target.value)} />
                  </label>
                  <label className="eva__fld">
                    <span>Ends (optional)</span>
                    <input type="datetime-local" value={it.endsAt} onChange={(e) => patch(it.id, "endsAt", e.target.value)} />
                  </label>
                </div>

                <div className="eva__actions">
                  <button className="btn btn--primary" onClick={() => save(it)} disabled={pending}>
                    {savedId === it.id ? "Saved ✓" : "Save"}
                  </button>
                  <button className={"btn" + (it.active ? " eva__on" : "")} onClick={() => toggle(it)} disabled={pending}>
                    {it.active ? "Active" : "Set active"}
                  </button>
                  <button className="btn eva__icon" onClick={() => move(it.id, "up")} disabled={pending || i === 0} title="Higher priority">↑</button>
                  <button className="btn eva__icon" onClick={() => move(it.id, "down")} disabled={pending || i === items.length - 1} title="Lower priority">↓</button>
                  <span className="eva__spacer" />
                  {confirmDel === it.id ? (
                    <>
                      <span className="eva__confirm">Delete?</span>
                      <button className="btn btn--danger" onClick={() => del(it.id)} disabled={pending}>Yes</button>
                      <button className="btn" onClick={() => setConfirmDel(null)} disabled={pending}>Cancel</button>
                    </>
                  ) : (
                    <button className="btn eva__del" onClick={() => setConfirmDel(it.id)} disabled={pending}>Delete</button>
                  )}
                </div>
              </div>
            </article>
          );
        })}

        {items.length === 0 && (
          <div className="eva__empty">No banners yet. Click “＋ New banner”, fill it in, then set it active.</div>
        )}
      </div>
    </div>
  );
}
