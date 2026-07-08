"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  TYPES, FORMATS, MANGA_FORMATS, GENRES, DECADES, SORTS,
  EPISODE_BUCKETS, CHAPTER_BUCKETS, SEASON_OPTS, AIRING, STATUSES, FEELINGS, DIMS,
} from "@/features/search/constants";

// A 0→max "minimum" slider that commits to the URL on release (not every tick).
function RangeFilter({
  label, value, min, max, step, fmt, onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
  onCommit: (v: number) => void;
}) {
  const [v, setV] = useState(value);
  // keep the slider in sync when the committed value changes (e.g. Clear)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setV(value), [value]);
  const on = v > min;
  return (
    <label className={"srch-range" + (on ? " srch-range--on" : "")}>
      <span className="srch-range__top">
        <span className="srch-range__label">{label}</span>
        <span className="srch-range__val">{on ? fmt(v) : "Any"}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => setV(Number(e.target.value))}
        onPointerUp={() => onCommit(v)}
        onKeyUp={() => onCommit(v)}
        aria-label={label}
      />
    </label>
  );
}

export function SearchFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const urlQ = sp.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // reflect the URL's q into the input (e.g. on back/forward or Clear)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setQ(urlQ), [urlQ]);

  const g = (k: string) => sp.get(k) ?? "";
  const update = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(sp.toString());
    for (const [k, val] of Object.entries(patch)) {
      if (val) params.set(k, val);
      else params.delete(k);
    }
    params.delete("page");
    router.push(`/search?${params.toString()}`);
  };

  const onQ = (val: string) => {
    setQ(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => update({ q: val.trim() || null }), 200);
  };

  const type = g("type");
  const format = g("format");
  const genre = g("genre");
  const sort = g("sort") || "relevance";
  const decade = g("decade");
  const airing = g("airing");
  const length = g("length");
  const seasons = g("seasons");
  const isManga = type === "manga";
  const formatOptions = isManga ? MANGA_FORMATS : FORMATS;
  const lengthOptions = isManga ? CHAPTER_BUCKETS : EPISODE_BUCKETS;
  // the "ongoing" label reads as Airing (anime) / Publishing (manga)
  const airingOptions = AIRING.map((a) =>
    a.v === "ongoing"
      ? { v: a.v, l: type === "anime" ? "Airing" : type === "manga" ? "Publishing" : "Airing / Publishing" }
      : a,
  );

  const num = (k: string) => Number(g(k) || 0);

  // which advanced filters are active (drives the "More" badge + auto-open)
  const advCount = [
    airing, decade, length, seasons, g("score"),
    g("status"), g("feeling"), g("rating"), g("story"), g("art"), g("music"), g("pacing"),
  ].filter(Boolean).length;
  const anyFilter = advCount > 0 || !!type || !!format || !!genre || sort !== "relevance";

  const [open, setOpen] = useState(false);
  useEffect(() => {
    // auto-open the advanced panel when an advanced filter is active
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (advCount > 0) setOpen(true);
  }, [advCount]);

  const clearAll = () =>
    update({
      type: null, format: null, genre: null, sort: null, decade: null,
      airing: null, length: null, seasons: null, score: null,
      status: null, feeling: null, rating: null, story: null, art: null, music: null, pacing: null,
    });

  return (
    <div className="srch-filters">
      <div className="srch-bar">
        <div className="srch-field">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <input
            value={q}
            onChange={(e) => onQ(e.target.value)}
            placeholder="Search anime &amp; manga…"
            aria-label="Search anime and manga"
          />
        </div>

        <select
          className={"srch-select" + (type ? " srch-select--on" : "")}
          value={type}
          onChange={(e) => update({ type: e.target.value || null, format: null, length: null })}
          aria-label="Type"
        >
          {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>

        <select
          className={"srch-select" + (format ? " srch-select--on" : "")}
          value={format}
          onChange={(e) => update({ format: e.target.value || null })}
          aria-label="Format"
        >
          <option value="">All formats</option>
          {formatOptions.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>

        <select
          className={"srch-select" + (genre ? " srch-select--on" : "")}
          value={genre}
          onChange={(e) => update({ genre: e.target.value || null })}
          aria-label="Genre"
        >
          <option value="">All genres</option>
          {GENRES.map((gg) => <option key={gg} value={gg}>{gg}</option>)}
        </select>

        <select
          className={"srch-select" + (sort !== "relevance" ? " srch-select--on" : "")}
          value={sort}
          onChange={(e) => update({ sort: e.target.value === "relevance" ? null : e.target.value })}
          aria-label="Sort"
        >
          {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>

        <button
          className={"srch-more" + (open ? " srch-more--open" : "") + (advCount ? " srch-more--on" : "")}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5h18M6 12h12M10 19h4" />
          </svg>
          Filters{advCount ? <span className="srch-more__badge">{advCount}</span> : null}
        </button>

        {anyFilter && (
          <button className="srch-clear" onClick={clearAll}>Clear</button>
        )}
      </div>

      {open && (
        <div className="srch-adv">
          <div className="srch-adv__group">
            <div className="srch-adv__head">Catalog</div>
            <div className="srch-adv__grid">
              <label className="srch-fld">
                <span className="srch-fld__label">Release status</span>
                <select className={"srch-select" + (airing ? " srch-select--on" : "")} value={airing}
                  onChange={(e) => update({ airing: e.target.value || null })}>
                  <option value="">Any status</option>
                  {airingOptions.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
                </select>
              </label>

              <label className="srch-fld">
                <span className="srch-fld__label">Year</span>
                <select className={"srch-select" + (decade ? " srch-select--on" : "")} value={decade}
                  onChange={(e) => update({ decade: e.target.value || null })}>
                  <option value="">Any decade</option>
                  {DECADES.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
                </select>
              </label>

              <label className="srch-fld">
                <span className="srch-fld__label">{isManga ? "Chapters" : "Episodes"}</span>
                <select className={"srch-select" + (length ? " srch-select--on" : "")} value={length}
                  onChange={(e) => update({ length: e.target.value || null })}>
                  <option value="">Any length</option>
                  {lengthOptions.map((bkt) => <option key={bkt.v} value={bkt.v}>{bkt.l}</option>)}
                </select>
              </label>

              <label className="srch-fld">
                <span className="srch-fld__label">{isManga ? "Volumes" : "Seasons"}</span>
                <select className={"srch-select" + (seasons ? " srch-select--on" : "")} value={seasons}
                  onChange={(e) => update({ seasons: e.target.value || null })}>
                  <option value="">Any</option>
                  {SEASON_OPTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </label>

              <RangeFilter
                label={isManga ? "Min score" : "Min score (manga)"}
                value={num("score")} min={0} max={10} step={0.5}
                fmt={(v) => `${v.toFixed(1)}+`}
                onCommit={(v) => update({ score: v > 0 ? String(v) : null })}
              />
            </div>
          </div>

          <div className="srch-adv__group">
            <div className="srch-adv__head">
              Your ratings <span className="srch-adv__note">— from titles in your lists</span>
            </div>
            <div className="srch-adv__grid">
              <label className="srch-fld">
                <span className="srch-fld__label">Status</span>
                <select className={"srch-select" + (g("status") ? " srch-select--on" : "")} value={g("status")}
                  onChange={(e) => update({ status: e.target.value || null })}>
                  <option value="">Any status</option>
                  {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </label>

              <label className="srch-fld">
                <span className="srch-fld__label">Feeling</span>
                <select className={"srch-select" + (g("feeling") ? " srch-select--on" : "")} value={g("feeling")}
                  onChange={(e) => update({ feeling: e.target.value || null })}>
                  <option value="">Any feeling</option>
                  {FEELINGS.map((fe) => <option key={fe.v} value={fe.v}>{fe.l}</option>)}
                </select>
              </label>

              <RangeFilter
                label="Overall rating"
                value={num("rating")} min={0} max={5} step={1}
                fmt={(v) => `★ ${v}+`}
                onCommit={(v) => update({ rating: v > 0 ? String(v) : null })}
              />

              {DIMS.map((d) => (
                <RangeFilter
                  key={d}
                  label={d[0].toUpperCase() + d.slice(1)}
                  value={num(d)} min={0} max={5} step={1}
                  fmt={(v) => `${v}+`}
                  onCommit={(v) => update({ [d]: v > 0 ? String(v) : null })}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
