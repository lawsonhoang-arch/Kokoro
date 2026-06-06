import type { CSSProperties } from "react";
import Link from "next/link";
import type { SearchResult } from "@/features/search/types";

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
export function TitleCard({ item, sub, rank }: { item: SearchResult; sub?: string; rank?: number }) {
  const unit = item.episodes ? `${item.episodes} ${item.kind === "manga" ? "ch" : "ep"}` : null;
  const meta = sub ?? [item.format, item.year || null, unit].filter(Boolean).join(" · ");
  return (
    <Link className="h-card" href={`/anime/${encodeURIComponent(item.id)}`}>
      <div className="h-card__art">
        {item.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
        ) : (
          <div className="h-card__gen" style={genPoster(item.id)} aria-hidden="true" />
        )}
        {rank != null && <span className="h-card__rank">{rank}</span>}
        {item.kind === "manga" && <span className="h-card__badge">Manga</span>}
      </div>
      <div className="h-card__title">{item.title}</div>
      {meta && <div className="h-card__sub">{meta}</div>}
    </Link>
  );
}
