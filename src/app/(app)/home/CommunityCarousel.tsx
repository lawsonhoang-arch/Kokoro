import Link from "next/link";
import type { CSSProperties } from "react";
import { SectionHead } from "@/components/SectionHead";
import { timeAgo, initials } from "@/features/community/helpers";
import { getHomeFeed } from "@/lib/community";
import { makeStale } from "@/lib/stale";

// generated gradient for a post whose title has no cover (or a general post)
function gen(seed: string): CSSProperties {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  h = Math.abs(h);
  const a = h % 360;
  return { backgroundImage: `linear-gradient(135deg, oklch(0.5 0.13 ${a}), oklch(0.34 0.12 ${(a + 40) % 360}))` };
}

// Keep the last good feed so a transient failure doesn't collapse the row.
// "Popular in the community" is public top posts, so a shared stale copy is a
// fine momentary fallback across users.
const keepPosts = makeStale<Awaited<ReturnType<typeof getHomeFeed>>["posts"]>((p) => p.length === 0);

// The most-liked reviews & discussions as a horizontal carousel in the Home
// main column. Fetches its own feed so it can be streamed via <Suspense>,
// keeping it off the home critical path.
export async function CommunityCarousel({ userId }: { userId: string | undefined }) {
  const feed = await getHomeFeed(userId, { sort: "top" }).catch(() => ({ posts: [] }));
  const posts = keepPosts(feed.posts.slice(0, 12));
  if (posts.length === 0) return null;
  return (
    <section className="section" aria-label="Community">
      <SectionHead
        title="Popular in the community"
        sub="Top reviews and discussions from readers & viewers"
        moreLabel="All posts →"
        moreHref="/community"
      />
      <div className="comm-row" role="list">
        {posts.map((p) => {
          const heading = p.heading || (p.kind === "review" ? "Review" : "Discussion");
          const href = p.title ? `/community/${encodeURIComponent(p.title.id)}` : "/community";
          return (
            <Link key={p.id} className="comm-card" href={href} role="listitem">
              <span className="comm-card__art" style={p.title?.cover ? undefined : gen(p.id)} aria-hidden="true">
                {p.title?.cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="comm-card__cover" src={p.title.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
                )}
                <span className="comm-card__scrim" />
                <span className="comm-card__kind">{p.kind === "review" ? "Review" : "Discussion"}</span>
                {p.title && <span className="comm-card__on">{p.title.name}</span>}
              </span>
              <span className="comm-card__body">
                <span className="comm-card__top">
                  <span className={`avatar avatar--h${p.author.avatarHue} comm-card__avatar`} aria-hidden="true">{initials(p.author.name)}</span>
                  <span className="comm-card__author">{p.author.name}</span>
                  <span className="comm-card__time">{timeAgo(p.createdAt)}</span>
                </span>
                <span className="comm-card__heading">{heading}</span>
                {p.spoiler ? (
                  <span className="comm-card__spoiler">⚠ Contains spoilers</span>
                ) : (
                  p.body && <span className="comm-card__excerpt">{p.body}</span>
                )}
                <span className="comm-card__stats">
                  <span>♥ {p.likeCount}</span>
                  <span>💬 {p.replyCount}</span>
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
