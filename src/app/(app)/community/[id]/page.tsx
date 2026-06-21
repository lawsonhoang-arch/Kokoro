import "../community.css";
import "@/styles/rating-control.css";
import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getTitle, getTitleBanner } from "@/lib/catalog";
import { getTitleFeed, getEpisodeCounts, getTitlePulse } from "@/lib/community";
import { TitleCommunity } from "@/features/community/TitleCommunity";
import { PulseStrip } from "@/features/community/PulseStrip";

function genArt(seed: string): CSSProperties {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  h = Math.abs(h);
  const a = h % 360;
  const bg = (a + 40 + (h % 30)) % 360;
  return { backgroundImage: `linear-gradient(135deg, oklch(0.5 0.14 ${a}), oklch(0.34 0.13 ${bg}))` };
}

export default async function TitleCommunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  const [t, session, banner] = await Promise.all([getTitle(decoded), auth(), getTitleBanner(decoded)]);
  if (!t) notFound();

  // prefer wide AniList banner art; fall back to the (portrait) cover
  const heroArt = banner || t.cover;

  const [page, counts, pulse] = await Promise.all([
    getTitleFeed(t.id, { viewerId: session?.user?.id }),
    getEpisodeCounts(t.id),
    getTitlePulse(t.id),
  ]);

  const kindLabel = t.kind === "manga" ? "Manga" : "Anime";
  const unit = t.kind === "manga" ? "ch" : "ep";

  return (
    <main className="page page--wide cpage">
      {/* HERO — cover art that fades up into the large title */}
      <header className="chero">
        <div className="chero__art" style={heroArt ? undefined : genArt(t.id)}>
          {heroArt && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroArt} alt="" referrerPolicy="no-referrer" />
          )}
          <div className="chero__scrim" />
        </div>
        <div className="chero__inner">
          <Link className="chero__back" href="/community">
            ← Community
          </Link>
          <div className="chero__eyebrow">
            {kindLabel}
            {t.year ? ` · ${t.year}` : ""} · Community
          </div>
          <h1 className="chero__title">{t.title}</h1>
          <div className="chero__meta">
            {t.format && <span className="chero__tag">{t.format}</span>}
            {t.episodes != null && <span className="chero__tag">{t.episodes} {unit}</span>}
            {t.genres.slice(0, 4).map((g) => (
              <span key={g} className="chero__tag chero__tag--genre">{g}</span>
            ))}
          </div>
        </div>
      </header>

      <div className="cpage__body">
        <PulseStrip pulse={pulse} />
        <TitleCommunity
          titleId={t.id}
          titleName={t.title}
          episodes={t.episodes || 0}
          initialPosts={page.posts}
          initialCursor={page.nextCursor}
          initialCounts={counts}
        />
      </div>
    </main>
  );
}
