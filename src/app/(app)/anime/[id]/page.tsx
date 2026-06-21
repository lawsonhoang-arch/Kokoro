import "../anime.css";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Page } from "@/shell/Page";
import { getTitle } from "@/lib/catalog";
import { isCompleted } from "@/lib/completions";
import { isFavorite } from "@/lib/favorites";
import { DescriptionSection } from "@/features/submissions/DescriptionSection";
import { AddToWatchlist } from "@/features/search/AddToWatchlist";
import { MarkWatched } from "@/features/search/MarkWatched";
import { FavoriteButton } from "@/features/search/FavoriteButton";

// Deterministic generated poster (matches the search overlay) — used when a
// title has no cover image.
function genPoster(seed: string): CSSProperties {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  h = Math.abs(h);
  const a = h % 360;
  const bg = (a + 35 + (h % 30)) % 360;
  const ang = (h % 6) * 30;
  return {
    backgroundImage: `linear-gradient(${ang}deg, oklch(0.55 0.13 ${a}) 0%, oklch(0.4 0.13 ${bg}) 100%)`,
  };
}

export default async function AnimePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // ids contain a ':' (e.g. "anilist:457") which arrives percent-encoded
  const [t, session] = await Promise.all([getTitle(decodeURIComponent(id)), auth()]);
  if (!t) notFound();
  const uid = session?.user?.id;
  const [done, fav] = uid
    ? await Promise.all([isCompleted(uid, t.id), isFavorite(uid, t.id)])
    : [false, false];

  return (
    <Page>
      <div className="anime-hero">
        <div className="anime-cover">
          {t.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.cover} alt={`${t.title} cover art`} referrerPolicy="no-referrer" />
          ) : (
            <div className="anime-cover__gen" style={genPoster(t.id)} aria-hidden="true" />
          )}
        </div>

        <div className="anime-info">
          <div className="anime-eyebrow">
            {t.kind === "manga" ? "Manga" : "Anime"}{t.year ? ` · ${t.year}` : ""}
          </div>
          <h1 className="anime-title">{t.title}</h1>
          {t.native && t.native !== t.title && <div className="anime-native">{t.native}</div>}

          <div className="anime-meta">
            {t.format && <span className="anime-tag">{t.format}</span>}
            {t.episodes != null && (
              <span className="anime-tag">
                {t.episodes} {t.kind === "manga" ? "ch" : "ep"}
              </span>
            )}
            {t.genres.map((g) => (
              <span key={g} className="anime-tag anime-tag--genre">
                {g}
              </span>
            ))}
          </div>

          <div className="anime-actions">
            <AddToWatchlist titleId={t.id} />
            <MarkWatched titleId={t.id} initialDone={done} />
            <FavoriteButton titleId={t.id} initialFavorite={fav} />
          </div>

          {t.cover && <div className="anime-credit">Cover art © respective owners</div>}
        </div>
      </div>

      <div className="anime-section">
        <DescriptionSection titleId={t.id} />
      </div>
    </Page>
  );
}
