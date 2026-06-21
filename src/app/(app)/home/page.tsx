import "./home.css";
import type { CSSProperties } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { Page, PageHead } from "@/shell/Page";
import { Avatar } from "@/components/ui";
import { SectionHead } from "@/components/SectionHead";
import {
  getHeroSlides, getRecommendations, searchCatalogFull,
} from "@/lib/catalog";
import { getGenreFeatureTiles, getSeasonal, getLatestUpdated, getUnderratedGems, getUpcoming } from "@/lib/search-index";
import { HeroCarousel } from "./HeroCarousel";
import { getPublishedPicks } from "@/lib/editorial";
import { isModerator } from "@/lib/submissions";
import { getHomeFeed } from "@/lib/community";
import { getNewsFeed } from "@/lib/news";
import type { SearchResult } from "@/features/search/types";
import { WelcomeOverlay } from "./WelcomeOverlay";
import { TitleCard } from "./TitleCard";
import { HomeRail } from "./HomeRail";

// Browse-by-genre tiles, each backed by a hand-picked title's cover.
const GENRE_FEATURES = [
  { genre: "Action", query: "Dragon Ball Z" },
  { genre: "Fantasy", query: "Re:Zero -Starting Life" },
  { genre: "Romance", query: "Love Is War" },
  { genre: "Sci-Fi", query: "Cowboy Bebop" },
  { genre: "Slice of Life", query: "Sound! Euphonium" },
  { genre: "Comedy", query: "Gintama" },
  { genre: "Drama", query: "Your Lie in April" },
  { genre: "Mystery", query: "Mononoke" },
  { genre: "Horror", query: "Perfect Blue" },
  { genre: "Adventure", query: "One Piece" },
  { genre: "Supernatural", query: "Dan Da Dan" },
  { genre: "Sports", query: "Haikyu" },
];

function heroPoster(seed: string): CSSProperties {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  h = Math.abs(h);
  const a = h % 360;
  return {
    backgroundImage: `linear-gradient(135deg, oklch(0.5 0.14 ${a}) 0%, oklch(0.32 0.1 ${(a + 40) % 360}) 100%)`,
  };
}

// A discovery shelf: section head + horizontal poster row (hidden if empty).
function Shelf({
  title, sub, moreHref, items, ranked,
}: {
  title: React.ReactNode;
  sub?: string;
  moreHref: string;
  items: SearchResult[];
  ranked?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className="section">
      <SectionHead title={title} sub={sub} moreLabel="See all →" moreHref={moreHref} />
      <div className="shelf" role="list">
        {items.map((it, i) => (
          <TitleCard key={it.id} item={it} rank={ranked ? i + 1 : undefined} />
        ))}
      </div>
    </section>
  );
}


export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const session = await auth();
  const userId = session?.user?.id;

  let welcomeName: string | null = null;
  if (welcome === "1") {
    welcomeName =
      session?.user?.username || session?.user?.name ||
      session?.user?.email?.split("@")[0] || "friend";
  }

  const isMod = isModerator(session?.user?.role);

  // Discovery + personalization + editorial, fetched in parallel.
  const [heroSlides, latestUpdated, seasonal, topAnime, trending, gems, topManga, recs, picks, genreTiles, news, topFeed, upcoming] = await Promise.all([
    getHeroSlides(userId, 6),
    getLatestUpdated(14),
    getSeasonal(14),
    searchCatalogFull("", { type: "anime", sort: "rated" }, 1, 14, undefined, true),
    searchCatalogFull("", { type: "anime", sort: "popular" }, 1, 14, undefined, true),
    getUnderratedGems(14),
    searchCatalogFull("", { type: "manga", sort: "rated" }, 1, 14, undefined, true),
    userId ? getRecommendations(userId, 14) : Promise.resolve({ seedGenre: null, seedTitle: null, results: [] }),
    getPublishedPicks(),
    getGenreFeatureTiles(GENRE_FEATURES),
    getNewsFeed(),
    getHomeFeed(userId, { sort: "top" }),
    getUpcoming(6),
  ]);

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <>
      {welcomeName && <WelcomeOverlay username={welcomeName} />}
      {/* ambient top glow, tinted to the featured carousel cover by HeroCarousel */}
      <div className="feature-glow" aria-hidden="true" />
      <Page width="wide">
        <PageHead
          eyebrow="Discover"
          title="What's on tonight"
          lede="Top-rated and trending anime & manga, new arrivals, and picks shaped by what you watch."
        />

        {/* Two-column body: hero + discovery shelves on the left, a sticky rail
            of news + popular community posts on the right. The hero lives in the
            left column so it aligns with the shelves and the rail fills the
            space beside it (the whole grid stacks on narrow screens). */}
        <div className="home-grid">
          <div className="home-main">

        {/* HERO — a sliding carousel of the catalog's top-rated titles */}
        <HeroCarousel slides={heroSlides} />

        {/* DISCOVERY — stacked shelves, one after another */}
        <Shelf title={`${cap(seasonal.season)} ${seasonal.year}`} sub="This season's most popular anime"
          moreHref="/search?type=anime&sort=popular" items={seasonal.results} />
        <Shelf title="Latest updated" sub="Currently airing — new episodes & seasons"
          moreHref="/search?type=anime&sort=popular" items={latestUpdated} />
        <Shelf title="Trending" sub="What people are watching most"
          moreHref="/search?type=anime&sort=popular" items={trending.results} />
        <Shelf title="Top rated" sub="The highest-scored anime in the catalog"
          moreHref="/search?type=anime&sort=rated" items={topAnime.results} ranked />
        <Shelf title="Top manga" sub="Acclaimed series to read"
          moreHref="/search?type=manga&sort=rated" items={topManga.results} />
        <Shelf title="Underrated gems" sub="Highly rated, under the radar"
          moreHref="/search?type=anime&sort=rated" items={gems} />

        {/* RECOMMENDATIONS */}
        {recs.results.length > 0 && (
          <Shelf
            title={
              <>
                Because you added{" "}
                <em style={{ color: "var(--accent)", fontStyle: "normal" }}>
                  {recs.seedTitle ?? recs.seedGenre}
                </em>
              </>
            }
            sub={recs.seedGenre ? `More ${recs.seedGenre} · matched to your lists` : undefined}
            moreHref={`/search?genre=${encodeURIComponent(recs.seedGenre ?? "")}&sort=rated`}
            items={recs.results}
          />
        )}

        {/* BROWSE BY GENRE — each tile backed by that genre's most popular anime */}
        <section className="section" aria-label="Browse by genre">
          <SectionHead title="Browse by genre" sub="Jump into a vibe" moreLabel="All genres →" moreHref="/search?type=anime&sort=popular" />
          <div className="genre-grid">
            {genreTiles.map(({ genre, cover }) => (
              <Link
                key={genre}
                className="genre-tile"
                href={`/search?genre=${encodeURIComponent(genre)}&sort=rated`}
              >
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="genre-tile__bg" src={cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
                ) : (
                  <span className="genre-tile__bg genre-tile__bg--gen" style={heroPoster(genre)} aria-hidden="true" />
                )}
                <span className="genre-tile__name">{genre}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* SPOTLIGHTS — editable from /editorial (moderators) */}
        {(picks.length > 0 || isMod) && (
          <section className="section">
            <SectionHead
              title="Editorial picks"
              sub="Curated essays from the Kokoro team"
              moreLabel={isMod ? "Edit picks →" : undefined}
              moreHref={isMod ? "/editorial" : undefined}
            />
            <div className="editorial">
              {picks.map((e) => {
                const body = (
                  <>
                    <div className="editorial__art" aria-hidden="true">
                      {e.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="editorial__cover" src={e.cover} alt="" referrerPolicy="no-referrer" />
                      ) : null}
                    </div>
                    <div className="editorial__body">
                      <span className="editorial__kicker">{e.kicker}</span>
                      <h4 className="editorial__title">{e.title}</h4>
                      <p className="editorial__excerpt">{e.excerpt}</p>
                      <div className="editorial__byline">
                        <Avatar hue={e.avatarHue} style={{ width: 24, height: 24 }} />
                        <span>{e.byline}</span>
                      </div>
                    </div>
                  </>
                );
                const cls = `editorial__card card editorial__card--h${e.hue}`;
                return e.href ? (
                  <a key={e.id} className={cls} href={e.href}>{body}</a>
                ) : (
                  <article key={e.id} className={cls}>{body}</article>
                );
              })}
              {picks.length === 0 && isMod && (
                <Link className="editorial__empty" href="/editorial">
                  No published picks yet — click to add some →
                </Link>
              )}
            </div>
          </section>
        )}
          </div>

          <HomeRail news={news.slice(0, 6)} posts={topFeed.posts.slice(0, 6)} upcoming={upcoming} />
        </div>
      </Page>
    </>
  );
}
