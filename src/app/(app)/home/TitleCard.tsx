"use client";

import { useRef, type CSSProperties } from "react";
import Link from "next/link";
import type { SearchResult } from "@/features/search/types";
import { StatusTag } from "@/components/StatusTag";
import { coverVT } from "@/lib/vt";
import { QuickAdd } from "./QuickAdd";

function genPoster(seed: string): CSSProperties {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  h = Math.abs(h);
  const a = h % 360;
  const bg = (a + 35 + (h % 30)) % 360;
  const ang = (h % 6) * 30;
  return { backgroundImage: `linear-gradient(${ang}deg, oklch(0.55 0.13 ${a}) 0%, oklch(0.4 0.13 ${bg}) 100%)` };
}

// One poster card in a Home shelf — real cover (or generated gradient), links
// to the in-depth title page. `sub` overrides the default format · year · count.
//
// Shared-element morph: the same title can appear in several shelves at once, so
// we can't give every card a static view-transition-name (duplicates crash the
// View Transitions API). Instead we stamp the name onto ONLY the card being
// clicked, right before navigation — so exactly one element carries it in the
// outgoing snapshot, and the detail hero (same name) morphs in from it.
export function TitleCard({ item, sub, rank }: { item: SearchResult; sub?: string; rank?: number }) {
  const artRef = useRef<HTMLDivElement>(null);
  const genre = item.genres?.[0] ?? null;
  const score = item.score != null && item.score > 0 ? (item.score / 100).toFixed(1) : null;
  return (
    <div className="h-card-wrap">
    <Link
      className="h-card"
      href={`/anime/${encodeURIComponent(item.id)}`}
      onClick={() => {
        if (artRef.current) artRef.current.style.viewTransitionName = coverVT(item.id);
      }}
    >
      <div className="h-card__art" ref={artRef}>
        {item.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
        ) : (
          <div className="h-card__gen" style={genPoster(item.id)} aria-hidden="true" />
        )}
        {rank != null && <span className="h-card__rank">{rank}</span>}
        {item.kind === "manga" && <span className="h-card__badge">Manga</span>}
        <StatusTag kind={item.kind} status={item.status} overlay />
        {/* bottom gradient + info-bar overlaid on the art (refreshed card) */}
        <span className="h-card__scrim" aria-hidden="true" />
        <div className="h-card__info">
          <div className="h-card__title">{item.title}</div>
          {sub ? (
            <div className="h-card__sub"><span className="h-card__len">{sub}</span></div>
          ) : (genre || item.episodes || score) ? (
            <div className="h-card__sub">
              {genre && <span className="h-card__genre">{genre}</span>}
              {item.episodes ? (
                <span className="h-card__stat">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2.5" y="4.5" width="19" height="13" rx="2" />
                    <path d="M8 20.5h8" />
                  </svg>
                  {item.episodes}
                </span>
              ) : null}
              {score && (
                <span className="h-card__score">
                  <span className="h-card__star" aria-hidden="true">★</span>{score}
                </span>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
      <QuickAdd titleId={item.id} />
    </div>
  );
}
