import Link from "next/link";
import type { NewsFeedItem } from "@/lib/news";
import { relativeTime } from "@/lib/news";
import type { CommunityPost } from "@/lib/community";
import type { SearchResult } from "@/features/search/types";
import { timeAgo, initials } from "@/features/community/helpers";

// The home page's right rail: a glanceable digest of the latest news and the
// most-liked community posts, so they're surfaced alongside discovery instead
// of buried at the bottom. Server component — pure links, no interactivity.
export function HomeRail({
  news,
  posts,
  upcoming,
}: {
  news: NewsFeedItem[];
  posts: CommunityPost[];
  upcoming: SearchResult[];
}) {
  const now = new Date();
  return (
    <aside className="home-rail" aria-label="News and community">
      {news.length > 0 && (
        <section className="hrail-card card">
          <div className="hrail-card__head">
            <h2 className="hrail-card__title">In the news</h2>
            <Link className="hrail-card__more" href="/news">All news →</Link>
          </div>
          <ul className="hrail-list">
            {news.map((n) => {
              const inner = (
                <>
                  <span className="hrail-news__cat">{n.category}</span>
                  <span className="hrail-news__headline">{n.title}</span>
                  <span className="hrail-news__meta">
                    {[n.source, relativeTime(n.publishedAt, now)].filter(Boolean).join(" · ")}
                  </span>
                </>
              );
              return (
                <li key={n.id}>
                  {n.href ? (
                    <a className="hrail-news" href={n.href} target="_blank" rel="noreferrer">{inner}</a>
                  ) : (
                    <Link className="hrail-news" href="/news">{inner}</Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {posts.length > 0 && (
        <section className="hrail-card card">
          <div className="hrail-card__head">
            <h2 className="hrail-card__title">Popular in community</h2>
            <Link className="hrail-card__more" href="/community">All posts →</Link>
          </div>
          <ul className="hrail-list">
            {posts.map((p) => {
              const heading = p.heading || (p.kind === "review" ? "Review" : "Discussion");
              const href = p.title ? `/community/${encodeURIComponent(p.title.id)}` : "/community";
              return (
                <li key={p.id}>
                  <Link className="hrail-post" href={href}>
                    <span className="hrail-post__top">
                      <span className={`avatar avatar--h${p.author.avatarHue} hrail-post__avatar`} aria-hidden="true">
                        {initials(p.author.name)}
                      </span>
                      <span className="hrail-post__author">{p.author.name}</span>
                      <span className="hrail-post__time">{timeAgo(p.createdAt)}</span>
                    </span>
                    <span className="hrail-post__heading">{heading}</span>
                    <span className="hrail-post__foot">
                      {p.title && <span className="hrail-post__chip">{p.title.name}</span>}
                      <span className="hrail-post__stat" aria-label="likes">♥ {p.likeCount}</span>
                      <span className="hrail-post__stat" aria-label="replies">💬 {p.replyCount}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="hrail-card card">
          <div className="hrail-card__head">
            <h2 className="hrail-card__title">Upcoming</h2>
            <Link className="hrail-card__more" href="/search?type=anime&sort=newest">See all →</Link>
          </div>
          <ul className="hrail-list">
            {upcoming.map((u) => (
              <li key={u.id}>
                <Link className="hrail-up" href={`/anime/${encodeURIComponent(u.id)}`}>
                  {u.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="hrail-up__cover" src={u.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
                  ) : (
                    <span className="hrail-up__cover" />
                  )}
                  <span className="hrail-up__txt">
                    <span className="hrail-up__title">{u.title}</span>
                    <span className="hrail-up__meta">
                      {[u.format, u.year ? `${u.year}` : null].filter(Boolean).join(" · ") || "TBA"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
