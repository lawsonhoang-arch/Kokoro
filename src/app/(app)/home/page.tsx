import "./home.css";
import { Suspense, type CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Page, PageHead } from "@/shell/Page";
import { Avatar } from "@/components/ui";
import { SectionHead } from "@/components/SectionHead";
import {
  getHeroSlides, getRecommendations, searchCatalogFull, getUserTopGenres,
} from "@/lib/catalog";
import { getGenreFeatureTiles, getSeasonal, getLatestUpdated, getUnderratedGems, getUpcoming } from "@/lib/search-index";
import { getWatchlists } from "@/lib/watchlists";
import { getTrackedTitles } from "@/lib/calendar";
import { getHomeFocus } from "@/lib/onboarding";
import { HeroCarousel } from "./HeroCarousel";
import { getPublishedPicks } from "@/lib/editorial";
import { isModerator } from "@/lib/submissions";
import type { SearchResult } from "@/features/search/types";
import { WelcomeOverlay } from "./WelcomeOverlay";
import { HomeReadyBeacon } from "./HomeReadyBeacon";
import { NewsCarousel } from "./NewsCarousel";
import { CommunityCarousel } from "./CommunityCarousel";
import { TasteRecs } from "./TasteRecs";
import { TitleCard } from "./TitleCard";
import { HomeRail } from "./HomeRail";

// Resolve to a fallback if a fetch rejects OR takes too long. Bounds Home's
// worst case so a slow-DB window can't hang the page (which would pile up failed
// RSC prefetches and starve the small connection pool). The query keeps running
// server-side, but the page renders promptly with a partial.
function withTimeout<T>(p: Promise<T>, fallback: T, ms = 7000): Promise<T> {
  return Promise.race([
    p.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

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
  title, sub, moreHref, items, ranked, className,
}: {
  title: React.ReactNode;
  sub?: string;
  moreHref: string;
  items: SearchResult[];
  ranked?: boolean;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className={"section" + (className ? " " + className : "")}>
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
  // Home is auth-gated (the layout redirects too, but bail here BEFORE the heavy
  // Promise.all so an unauth request doesn't waste 14 catalog queries on work
  // that's about to be redirected away.
  if (!userId) redirect("/login");
  const isMod = isModerator(session?.user?.role);

  let welcomeName: string | null = null;
  if (welcome === "1") {
    welcomeName =
      session?.user?.username || session?.user?.name ||
      session?.user?.email?.split("@")[0] || "friend";
  }

  // After sign-in: paint the welcome overlay immediately and stream Home in
  // behind it via <Suspense>, so the greeting animation plays WHILE Home's
  // (slow, parallel) data loads. The overlay waits for HomeReadyBeacon before
  // fading, so the reveal always lands on a fully-loaded page. The fallback is
  // null because the opaque overlay covers it anyway.
  if (welcomeName) {
    return (
      <>
        <WelcomeOverlay username={welcomeName} />
        <Suspense fallback={null}>
          <HomeContent userId={userId} isMod={isMod} withBeacon />
        </Suspense>
      </>
    );
  }

  // Normal visit: render Home directly (blocking) — no skeleton flash, matching
  // the prior behavior.
  return <HomeContent userId={userId} isMod={isMod} />;
}

async function HomeContent({
  userId,
  isMod,
  withBeacon,
}: {
  userId: string | undefined;
  isMod: boolean;
  withBeacon?: boolean;
}) {
  // Discovery + personalization + editorial + the user's own library, in
  // parallel. News (live RSS) and community are NOT here — they stream in their
  // own <Suspense> boundaries so they never block the main page.
  // Each fetch degrades to a safe fallback on failure, so a single slow/timed-out
  // query renders a partial Home rather than 500-ing or hanging the whole page.
  const noRecs = { seedGenre: null, seedTitle: null, results: [] };
  const [heroSlides, latestUpdated, seasonal, topAnime, trending, gems, topManga, newManga, recs, picks, userTopGenres, upcoming, lists, tracked, homeFocus] = await Promise.all([
    withTimeout(getHeroSlides(userId, 6), []),
    getLatestUpdated(14),
    getSeasonal(14),
    searchCatalogFull("", { type: "anime", sort: "rated" }, 1, 14, undefined, true),
    searchCatalogFull("", { type: "anime", sort: "popular" }, 1, 14, undefined, true),
    getUnderratedGems(14),
    searchCatalogFull("", { type: "manga", sort: "rated" }, 1, 14, undefined, true),
    // extra headroom so "New manga" stays full after de-duping against "Top manga"
    searchCatalogFull("", { type: "manga", sort: "newest" }, 1, 28, undefined, true),
    userId ? withTimeout(getRecommendations(userId, 14), noRecs) : Promise.resolve(noRecs),
    withTimeout(getPublishedPicks(), []),
    userId ? withTimeout(getUserTopGenres(userId, 6), [] as string[]) : Promise.resolve([] as string[]),
    getUpcoming(6),
    userId ? withTimeout(getWatchlists(userId), []) : Promise.resolve([]),
    userId ? withTimeout(getTrackedTitles(userId), []) : Promise.resolve([]),
    userId ? withTimeout(getHomeFocus(userId), [] as string[]) : Promise.resolve([] as string[]),
  ]);

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // Keep "New manga" distinct from "Top manga" (no repeated titles across shelves).
  const topMangaItems = topManga.results;
  const seenManga = new Set(topMangaItems.map((m) => m.id));
  const newMangaItems = newManga.results.filter((m) => !seenManga.has(m.id)).slice(0, 14);

  // Browse-by-genre is personalised: the user's top three library genres, plus
  // one deliberately DIFFERENT genre for range. New/empty libraries fall back to
  // the broad default set so the row is never empty.
  // Browse-by-genre shows ALL the featured genres, each with its own hand-picked
  // representative cover (distinct per genre — no duplicate covers), ordered so
  // the user's most-tracked genres lead. On a phone only the first few tiles show
  // (see home.css). New/empty libraries get the featured set in its default order.
  const topRank = userTopGenres.filter(Boolean).map((g) => g.toLowerCase());
  const rankOf = (g: string) => {
    const i = topRank.indexOf(g.toLowerCase());
    return i === -1 ? 999 : i;
  };
  const featured = [...GENRE_FEATURES].sort((a, b) => rankOf(a.genre) - rankOf(b.genre));
  const genreTiles = await getGenreFeatureTiles(featured);

  // Personalised shelf order (from onboarding "what do you want to track most?").
  // Focus keys map 1:1 to these shelves; picked areas lead in the order the user
  // chose, the rest follow in the default order. On mobile, only picked shelves
  // show (un-picked get `section--deskonly`, hidden below 640px) — unless nothing
  // was picked, when the default order shows in full on both.
  const SHELF_KEYS = ["seasonal", "updates", "trending", "manga", "gems", "recs"] as const;
  const picked = homeFocus.filter((k): k is (typeof SHELF_KEYS)[number] => (SHELF_KEYS as readonly string[]).includes(k));
  const focusSet = new Set<string>(picked);
  const shelfOrder = picked.length
    ? [...picked, ...SHELF_KEYS.filter((k) => !focusSet.has(k))]
    : [...SHELF_KEYS];
  const deskOnly = (k: string) => (focusSet.size > 0 && !focusSet.has(k) ? "section--deskonly" : undefined);
  const shelfNodes: Record<(typeof SHELF_KEYS)[number], React.ReactNode> = {
    seasonal: (
      <Shelf key="seasonal" title={`${cap(seasonal.season)} ${seasonal.year}`} sub="This season's most popular anime"
        moreHref="/search?type=anime&sort=popular" items={seasonal.results} className={deskOnly("seasonal")} />
    ),
    updates: (
      <Shelf key="updates" title="Latest updated" sub="Currently airing — new episodes & seasons"
        moreHref="/search?type=anime&sort=popular" items={latestUpdated} className={deskOnly("updates")} />
    ),
    trending: (
      <Shelf key="trending" title="Trending" sub="What people are watching most"
        moreHref="/search?type=anime&sort=popular" items={trending.results} className={deskOnly("trending")} />
    ),
    manga: (
      <Shelf key="manga" title="New manga" sub="Recently added to the catalog"
        moreHref="/search?type=manga&sort=newest" items={newMangaItems} className={deskOnly("manga")} />
    ),
    gems: (
      <Shelf key="gems" title="Underrated gems" sub="Highly rated, under the radar"
        moreHref="/search?type=anime&sort=rated" items={gems} className={deskOnly("gems")} />
    ),
    recs: (
      <Shelf
        key="recs"
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
        className={deskOnly("recs")}
      />
    ),
  };

  return (
    <>
      {/* ambient top glow, tinted to the featured carousel cover by HeroCarousel */}
      <div className="feature-glow" aria-hidden="true" />
      <Page width="wide">
        <PageHead
          eyebrow="Discover"
          title="What's on tonight"
          lede="Top-rated and trending anime & manga, new arrivals, and picks shaped by what you watch."
        />

        {/* Two-column body: hero + discovery shelves on the left, a sticky rail
            on the right that leads with the user's own library (up next + their
            lists) and continues into news + popular community posts. The whole
            grid stacks on narrow screens. */}
        <div className="home-grid">
          <div className="home-main">

        {/* HERO — a sliding carousel of the catalog's top-rated titles */}
        <HeroCarousel slides={heroSlides} />

        {/* NEWS + COMMUNITY — headline carousels, streamed so they never block
            the main page (news is live RSS; community is a DB feed) */}
        <Suspense fallback={<div className="carousel-skeleton" aria-hidden="true" />}>
          <NewsCarousel />
        </Suspense>
        <Suspense fallback={<div className="carousel-skeleton" aria-hidden="true" />}>
          <CommunityCarousel userId={userId} />
        </Suspense>

        {/* FOR YOU — recs from your taste-neighbours (streamed; personalised) */}
        {userId && (
          <Suspense fallback={<div className="carousel-skeleton" aria-hidden="true" />}>
            <TasteRecs userId={userId} />
          </Suspense>
        )}

        {/* DISCOVERY + RECOMMENDATIONS — stacked shelves, ordered by the user's
            onboarding focus (picked shelves lead; un-picked are desktop-only) */}
        {shelfOrder.map((k) => shelfNodes[k])}

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
              {picks.slice(0, 3).map((e) => {
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

          </div>

          <HomeRail upcoming={upcoming} lists={lists} tracked={tracked} topAnime={topAnime.results.slice(0, 6)} topManga={topMangaItems.slice(0, 6)} />
        </div>
      </Page>
      {/* signals the waiting WelcomeOverlay that Home has finished loading */}
      {withBeacon && <HomeReadyBeacon />}
    </>
  );
}
