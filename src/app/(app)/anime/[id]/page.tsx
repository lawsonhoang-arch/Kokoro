import "../anime.css";
import { Suspense, ViewTransition, type CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { coverVT } from "@/lib/vt";
import { Page } from "@/shell/Page";
import { BackButton } from "@/components/BackButton";
import { getTitle } from "@/lib/catalog";
import { isCompleted } from "@/lib/completions";
import { isFavorite } from "@/lib/favorites";
import { getRewatchCount } from "@/lib/rewatches";
import { DescriptionSection } from "@/features/submissions/DescriptionSection";
import { AddToWatchlist } from "@/features/search/AddToWatchlist";
import { MarkWatched } from "@/features/search/MarkWatched";
import { RewatchButton } from "@/features/search/RewatchButton";
import { FavoriteButton } from "@/features/search/FavoriteButton";
import { RecommendButton } from "@/features/search/RecommendButton";
import { TrackButton } from "@/features/search/TrackButton";
import { getTrackMeta, isTracking } from "@/lib/calendar";
import { StatusTag } from "@/components/StatusTag";
import { TitleCast, TitleStaff, TitleStudios, TitleSuggestions, TitleTrailer } from "./sections";

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
  const [done, fav, tracking, meta, rewatchCount] = await Promise.all([
    uid ? isCompleted(uid, t.id) : Promise.resolve(false),
    uid ? isFavorite(uid, t.id) : Promise.resolve(false),
    uid ? isTracking(uid, t.id) : Promise.resolve(false),
    getTrackMeta(t.id),
    uid ? getRewatchCount(uid, t.id) : Promise.resolve(0),
  ]);
  // weekly-release tracking makes sense for anime that are airing now or coming
  // up (an upcoming show's schedule lands on the calendar once it's known)
  const trackable = meta?.kind === "anime" && (meta.status === "ongoing" || meta.status === "upcoming");
  // MAL id powers the Jikan extras (cast / staff / suggestions / trailer). Anime
  // carry it on the row; manga ids look like "mga:<malId>".
  const malId = meta?.malId ?? (t.kind === "manga" ? parseInt(t.id.replace(/^mga:/, ""), 10) || null : null);
  const isAnime = t.kind !== "manga";

  return (
    <Page>
      <BackButton />
      <div className="anime-hero">
        {/* the cover morphs in from whichever poster card was clicked (shared
            view-transition name), landing continuity across the navigation */}
        <ViewTransition name={coverVT(t.id)} share="morph">
          <div className="anime-cover">
            {t.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.cover} alt={`${t.title} cover art`} referrerPolicy="no-referrer" />
            ) : (
              <div className="anime-cover__gen" style={genPoster(t.id)} aria-hidden="true" />
            )}
          </div>
        </ViewTransition>

        <div className="anime-info">
          <div className="anime-eyebrow">
            {t.kind === "manga" ? "Manga" : "Anime"}{t.year ? ` · ${t.year}` : ""}
          </div>
          <h1 className="anime-title">{t.title}</h1>
          {t.native && t.native !== t.title && <div className="anime-native">{t.native}</div>}

          <div className="anime-meta">
            <StatusTag kind={t.kind} status={t.status} />
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
            {uid && <RewatchButton titleId={t.id} initialCount={rewatchCount} kind={t.kind} />}
            <FavoriteButton titleId={t.id} initialFavorite={fav} />
            {uid && <RecommendButton titleId={t.id} />}
            {trackable && <TrackButton titleId={t.id} initialTracking={tracking} status={meta!.status} />}
            <Link className="anime-linkbtn" href={`/community/${encodeURIComponent(t.id)}`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Discussion
            </Link>
          </div>

          {t.cover && <div className="anime-credit">Cover art © respective owners</div>}
        </div>
      </div>

      <div className="anime-section">
        <DescriptionSection titleId={t.id} />
      </div>

      {malId != null && (
        <>
          {isAnime && <Suspense fallback={null}><TitleTrailer malId={malId} /></Suspense>}
          {isAnime && <Suspense fallback={null}><TitleStudios malId={malId} viewerId={uid} /></Suspense>}
          <Suspense fallback={null}><TitleCast kind={t.kind} malId={malId} /></Suspense>
          {isAnime && <Suspense fallback={null}><TitleStaff malId={malId} /></Suspense>}
          <Suspense fallback={null}><TitleSuggestions kind={t.kind} malId={malId} /></Suspense>
        </>
      )}
    </Page>
  );
}
