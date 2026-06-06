import "./home.css";
import type { CSSProperties } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { Page, PageHead } from "@/shell/Page";
import { Avatar } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { SectionHead } from "@/components/SectionHead";
import {
  getHero, getContinueWatching, getRecommendations, searchCatalogFull,
} from "@/lib/catalog";
import type { SearchResult } from "@/features/search/types";
import { AddToWatchlist } from "@/features/search/AddToWatchlist";
import { WelcomeOverlay } from "./WelcomeOverlay";
import { TitleCard } from "./TitleCard";

const GENRE_CHIPS = [
  "Action", "Fantasy", "Romance", "Sci-Fi", "Slice of Life", "Comedy",
  "Drama", "Mystery", "Horror", "Adventure", "Supernatural", "Sports",
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

const EDITORIAL = [
  {
    h: 1, kicker: "Genre · Fantasy", avatar: 2, byline: "By the Editors · 8 min read",
    title: "Quiet magic — the new wave of low-stakes fantasy.",
    excerpt: "What happens when the stakes get smaller, the worlds get warmer, and the conflicts move inward. Six titles to start.",
  },
  {
    h: 2, kicker: "Spotlight · Studio", avatar: 4, byline: "By the Editors · 12 min read",
    title: "Where the studio's quiet experiments became their loudest hits.",
    excerpt: "Ten years of small wagers and the shape of a house style — from one-shot OVAs to last year's prestige projects.",
  },
  {
    h: 3, kicker: "Watch club · This month", avatar: 5, byline: "Curated by Mio · 412 members",
    title: "Watching it again, slowly, together.",
    excerpt: "Our community pick is a quiet 2003 series most people watched alone. We're rewatching one episode a week, with notes.",
  },
];

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

  // Discovery + personalization, fetched in parallel.
  const [hero, topAnime, trending, newAnime, topManga, continueW, recs] = await Promise.all([
    getHero(),
    searchCatalogFull("", { type: "anime", sort: "rated" }, 1, 14),
    searchCatalogFull("", { type: "anime", sort: "popular" }, 1, 14),
    searchCatalogFull("", { type: "anime", sort: "newest" }, 1, 14),
    searchCatalogFull("", { type: "manga", sort: "rated" }, 1, 14),
    userId ? getContinueWatching(userId, 14) : Promise.resolve([]),
    userId ? getRecommendations(userId, 14) : Promise.resolve({ seedGenre: null, seedTitle: null, results: [] }),
  ]);

  const heroMeta = hero
    ? [hero.year || null, hero.genres.slice(0, 2).join(" · ") || null,
       hero.episodes ? `${hero.episodes} episodes` : null,
       hero.score ? `★ ${(hero.score / 100).toFixed(1)}` : null].filter(Boolean)
    : [];

  return (
    <>
      {welcomeName && <WelcomeOverlay username={welcomeName} />}
      <Page width="wide">
        <PageHead
          eyebrow="Discover"
          title="What's on tonight"
          lede="Top-rated and trending anime & manga, new arrivals, and picks shaped by what you watch."
          actions={
            <Link className="btn btn--primary" href="/search">
              <Icon name="plus" size={14} />
              Add a title
            </Link>
          }
        />

        {/* HERO — the top-rated title in the catalog */}
        {hero && (
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero__art" style={heroPoster(hero.id)} aria-hidden="true">
              {hero.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="hero__cover" src={hero.cover} alt="" referrerPolicy="no-referrer" />
              ) : null}
              <span className="hero__art-mark">#1 by rating</span>
            </div>
            <div className="hero__body">
              <span className="hero__eyebrow">Top of the catalog · Highest rated</span>
              <h2 className="hero__title" id="hero-title">{hero.title}</h2>
              <p className="hero__desc">
                {hero.description ||
                  "The catalog's highest-rated series right now. Open it for details, or add it to one of your lists to start tracking."}
              </p>
              <div className="hero__meta">
                {heroMeta.map((m, i) => (
                  <span key={i}>
                    {i > 0 && <span className="sep" />}
                    {m}
                  </span>
                ))}
              </div>
              <div className="hero__actions">
                <AddToWatchlist titleId={hero.id} />
                <Link className="btn" href={`/anime/${encodeURIComponent(hero.id)}`}>
                  View details
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* GENRE chips → catalog search */}
        <div className="mood-row" role="group" aria-label="Browse by genre">
          {GENRE_CHIPS.map((g) => (
            <Link key={g} className="chip" href={`/search?genre=${encodeURIComponent(g)}&sort=rated`}>
              {g}
            </Link>
          ))}
        </div>

        {/* DISCOVERY */}
        <Shelf title="Top rated" sub="The highest-scored anime in the catalog"
          moreHref="/search?type=anime&sort=rated" items={topAnime.results} ranked />
        <Shelf title="Trending now" sub="What people are watching most"
          moreHref="/search?type=anime&sort=popular" items={trending.results} />
        <Shelf title="New & notable" sub="Recent arrivals"
          moreHref="/search?type=anime&sort=newest" items={newAnime.results} />
        <Shelf title="Top manga" sub="Acclaimed series to read"
          moreHref="/search?type=manga&sort=rated" items={topManga.results} />

        {/* RECOMMENDATIONS */}
        <Shelf title="Continue watching" sub="Pick up where you left off"
          moreHref="/watchlist" items={continueW} />
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

        {/* SPOTLIGHTS */}
        <section className="section">
          <SectionHead title="Editorial picks" sub="Curated essays from the Kokoro team" moreLabel="See all →" />
          <div className="editorial">
            {EDITORIAL.map((e) => (
              <article key={e.title} className={`editorial__card card editorial__card--h${e.h}`}>
                <div className="editorial__art" aria-hidden="true" />
                <div className="editorial__body">
                  <span className="editorial__kicker">{e.kicker}</span>
                  <h4 className="editorial__title">{e.title}</h4>
                  <p className="editorial__excerpt">{e.excerpt}</p>
                  <div className="editorial__byline">
                    <Avatar hue={e.avatar} style={{ width: 24, height: 24 }} />
                    <span>{e.byline}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </Page>
    </>
  );
}
