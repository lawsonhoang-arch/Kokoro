"use client";

import { useState } from "react";
import Link from "next/link";
import type { ProfileStats } from "@/lib/profile";

type Mode = "both" | "anime" | "manga";
type Tile = { label: string; value: string; hint: string };

const days = (hours: number) => `~${Math.max(1, Math.round(hours / 24))} days of watch time`;
const num = (n: number) => n.toLocaleString();

export function ProfileStatsPanel({ stats: s }: { stats: ProfileStats }) {
  const [mode, setMode] = useState<Mode>("both");

  const tiles: Tile[] =
    mode === "anime"
      ? [
          { label: "Tracked", value: num(s.anime.tracked), hint: "anime, all lists" },
          { label: "Completed", value: num(s.anime.completed), hint: `${s.anime.watching} watching · ${s.anime.planned} planned` },
          { label: "Episodes", value: num(s.anime.units), hint: "episodes watched" },
          { label: "Hours", value: num(s.anime.hours), hint: days(s.anime.hours) },
        ]
      : mode === "manga"
        ? [
            { label: "Tracked", value: num(s.manga.tracked), hint: "manga, all lists" },
            { label: "Completed", value: num(s.manga.completed), hint: `${s.manga.watching} reading · ${s.manga.planned} planned` },
            { label: "Chapters", value: num(s.manga.units), hint: "chapters read" },
          ]
        : [
            { label: "Tracked", value: num(s.tracked), hint: "titles, all lists" },
            { label: "Completed", value: num(s.completed), hint: `${s.watching} watching · ${s.planned} planned` },
            { label: "Episodes", value: num(s.episodesWatched), hint: "episodes watched" },
            { label: "Chapters", value: num(s.chaptersRead), hint: "chapters read" },
            { label: "Hours", value: num(s.hours), hint: days(s.hours) },
            { label: "Reviews", value: num(s.reviews), hint: "posted to community" },
            ...(s.rewatches > 0 ? [{ label: "Rewatches", value: num(s.rewatches), hint: "times back for more" }] : []),
          ];

  const MODES: { key: Mode; label: string }[] = [
    { key: "both", label: "Both" },
    { key: "anime", label: "Anime" },
    { key: "manga", label: "Manga" },
  ];

  return (
    <section aria-label="Profile stats">
      <div className="pf-stats-head">
        <span className="pf-stats-head__lbl">Stats</span>
        <Link
          href="/stats"
          style={{ marginRight: "auto", marginLeft: 12, fontSize: 12.5, color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}
        >
          Full stats →
        </Link>
        <div className="pf-stats-toggle" role="group" aria-label="Breakdown">
          {MODES.map((m) => (
            <button
              key={m.key}
              className={"pf-stats-toggle__opt" + (mode === m.key ? " on" : "")}
              onClick={() => setMode(m.key)}
              aria-pressed={mode === m.key}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="pf-stats">
        {tiles.map((t) => (
          <div className="pf-stat" key={t.label}>
            <div className="pf-stat__label">{t.label}</div>
            <div className="pf-stat__value">{t.value}</div>
            <div className="pf-stat__hint">{t.hint}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
