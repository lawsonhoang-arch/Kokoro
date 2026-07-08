import Link from "next/link";
import type { CSSProperties } from "react";
import { SectionHead } from "@/components/SectionHead";
import { getHomeNews, relativeTime } from "@/lib/news";

// hue (1–8) → a deterministic gradient, used as the card art when a story has
// no cover image (and as a fallback behind covers that fail to load)
function newsHue(hue: number): CSSProperties {
  const a = (((hue - 1) % 8) + 8) % 8 * 44;
  return { backgroundImage: `linear-gradient(135deg, oklch(0.52 0.14 ${a}), oklch(0.34 0.13 ${(a + 45) % 360}))` };
}

// A horizontally-scrolling carousel of news stories for the Home main column.
// Fetches its own feed so it can be streamed via <Suspense> — the (sometimes
// slow, RSS-backed) news never blocks the rest of the home page.
export async function NewsCarousel() {
  const news = await getHomeNews(12).catch(() => []);
  if (news.length === 0) return null;
  const now = new Date();
  return (
    <section className="section news-carousel" aria-label="News">
      <SectionHead
        title="In the news"
        sub="Announcements, adaptations & release dates from across the industry"
        moreLabel="All news →"
        moreHref="/news"
      />
      <div className="news-row" role="list">
        {news.map((n) => {
          const inner = (
            <>
              <span className="news-card__art" style={newsHue(n.hue)} aria-hidden="true">
                {n.cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="news-card__cover" src={n.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
                )}
                <span className="news-card__scrim" />
                <span className="news-card__cat">{n.category}</span>
              </span>
              <span className="news-card__body">
                <span className="news-card__title">{n.title}</span>
                <span className="news-card__meta">
                  {[n.source, relativeTime(n.publishedAt, now)].filter(Boolean).join(" · ")}
                </span>
              </span>
            </>
          );
          return n.href ? (
            <a key={n.id} className="news-card" href={n.href} target="_blank" rel="noreferrer" role="listitem">{inner}</a>
          ) : (
            <Link key={n.id} className="news-card" href="/news" role="listitem">{inner}</Link>
          );
        })}
      </div>
    </section>
  );
}
