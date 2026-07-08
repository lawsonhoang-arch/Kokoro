"use client";

import { useState, type ReactNode } from "react";

export type FeedStory = {
  id: string;
  category: string;
  title: string;
  excerpt: string;
  source: string;
  href: string | null;
  time: string;
  cover?: string | null; // admin-set picture (RSS items have none)
  reason?: string; // present on "For you" picks — why it was surfaced
  layout?: "card" | "list" | "auto"; // moderator-set news-tab placement
};

// A story's picture — only rendered when a cover is set, so text-only stories
// (e.g. RSS articles) keep their clean look.
function NewsArt({ cover, className }: { cover: string | null | undefined; className: string }) {
  if (!cover) return null;
  return (
    <span className={className} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="news-art__img" src={cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
    </span>
  );
}

type Props = {
  stories: FeedStory[];
  curated: FeedStory[];
  trending: { title: string; href: string | null }[];
  releases: { title: string; tag: string }[];
};

const TABS = ["For you", "Top stories", "Industry", "Releases", "Adaptations", "Interviews"];

// A story shell is a link when it has an outbound href, otherwise a plain card.
function Shell({ href, className, children }: { href: string | null; className: string; children: ReactNode }) {
  return href ? (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <article className={className}>{children}</article>
  );
}

// The read-the-article button. The whole card is already the link, so this is a
// visual affordance (a span, not a nested anchor) — only shown when there's an
// outbound article to open.
const ReadCta = ({ href }: { href: string | null }) =>
  href ? <span className="news-cta">Read article<span aria-hidden="true"> ↗</span></span> : null;

// Category tabs filter the feed; the result is re-tiered every time so the
// biggest remaining story always leads, with smaller ones flowing down.
export function NewsFeed({ stories, curated, trending, releases }: Props) {
  const [active, setActive] = useState("For you");
  const forYou = active === "For you";
  const list = forYou
    ? curated
    : active === "Top stories"
      ? stories
      : stories.filter((s) => s.category === active);

  // Resolve each story to card or list. Explicit moderator placement wins;
  // otherwise fall back to position-based tiering (top stories lead as cards).
  // "For you" is per-user and not admin-shaped, so it always auto-tiers.
  const resolved = list.map((s, i) => {
    const explicit = !forYou && (s.layout === "card" || s.layout === "list");
    const lay = explicit ? (s.layout as "card" | "list") : i < 7 ? "card" : "list";
    return { s, lay };
  });
  const cards = resolved.filter((r) => r.lay === "card").map((r) => r.s);
  const listRows = resolved.filter((r) => r.lay === "list").map((r) => r.s);
  const lead = cards[0];
  const grid = cards.slice(1, 7);
  const rest = [...cards.slice(7), ...listRows];

  const meta = (s: FeedStory) => (
    <div className="news-meta">
      <span className="news-meta__source">{s.source}</span>
      <span className="news-meta__dot" />
      <span>{s.time}</span>
    </div>
  );

  return (
    <>
      <nav className="subtabs" aria-label="News sections">
        {TABS.map((t) => (
          <button
            key={t}
            className={"subtabs__tab" + (t === active ? " on" : "")}
            aria-pressed={t === active}
            onClick={() => setActive(t)}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="news">
        <section aria-label="Stories">
          {list.length === 0 ? (
            forYou ? (
              <p className="news-empty">
                No personalised stories yet — favourite or track some anime and we&apos;ll
                surface news about them and the genres you love here.
              </p>
            ) : (
              <p className="news-empty">No stories in this section yet.</p>
            )
          ) : (
            <>
              {lead && (
                <Shell href={lead.href} className="news-lead card">
                  <NewsArt cover={lead.cover} className="news-lead__art" />
                  <div className="news-lead__body">
                    <span className="news-cat-row">
                      <span className="news-cat">{lead.category}</span>
                      {lead.reason && <span className="news-reason">{lead.reason}</span>}
                    </span>
                    <h2 className="news-lead__title">{lead.title}</h2>
                    <p className="news-lead__excerpt">{lead.excerpt}</p>
                    {meta(lead)}
                    <ReadCta href={lead.href} />
                  </div>
                </Shell>
              )}

              {grid.length > 0 && (
                <div className="news-grid">
                  {grid.map((s) => (
                    <Shell key={s.id} href={s.href} className="news-card card">
                      <NewsArt cover={s.cover} className="news-card__art" />
                      <div className="news-card__body">
                        <span className="news-cat-row">
                          <span className="news-cat">{s.category}</span>
                          {s.reason && <span className="news-reason">{s.reason}</span>}
                        </span>
                        <h3 className="news-card__title">{s.title}</h3>
                        <p className="news-card__excerpt">{s.excerpt}</p>
                        {meta(s)}
                        <ReadCta href={s.href} />
                      </div>
                    </Shell>
                  ))}
                </div>
              )}

              {rest.length > 0 && (
                <div className="news-list">
                  {rest.map((s) => (
                    <Shell key={s.id} href={s.href} className="news-row">
                      <div className="news-row__body">
                        <div className="news-row__head">
                          <span className="news-cat">{s.category}</span>
                          {s.reason && <span className="news-reason">{s.reason}</span>}
                          <span className="news-row__time">{s.time}</span>
                        </div>
                        <h4 className="news-row__title">{s.title}</h4>
                        <span className="news-row__source">
                          {s.source}
                          {s.href && <span className="news-row__read"> · Read article ↗</span>}
                        </span>
                      </div>
                    </Shell>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <aside aria-label="Sidebar">
          <div className="raillet">
            <div className="raillet__head">
              <span className="label">Trending now</span>
              <span className="num">today</span>
            </div>
            <ol className="trend-list">
              {trending.map((t, i) => (
                <li key={i} className="trend-row">
                  <span className="trend-row__rank">{i + 1}</span>
                  <span className="trend-row__title">{t.title}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="raillet">
            <div className="raillet__head">
              <span className="label">Airing now</span>
              <span className="num">{releases.length} up</span>
            </div>
            <div className="cal-list">
              {releases.map((r, i) => (
                <div key={i} className="cal-row">
                  <span className="cal-row__title">{r.title}</span>
                  <span className="cal-row__tag">{r.tag}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
