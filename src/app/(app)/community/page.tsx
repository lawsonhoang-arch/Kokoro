import "./community.css";
import "@/styles/rating-control.css";
import Link from "next/link";
import { auth } from "@/auth";
import { Page, PageHead } from "@/shell/Page";
import { getHomeFeed, getTrending } from "@/lib/community";
import { getFollowingFeed } from "@/lib/activity";
import { isModerator } from "@/lib/submissions";
import { HomeFeed } from "@/features/community/HomeFeed";
import { CommunitySearch } from "@/features/community/CommunitySearch";
import { ActivityFeed } from "@/features/social/ActivityFeed";
import { CommunityTabs } from "./CommunityTabs";

export default async function CommunityPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const [page, trending, following] = await Promise.all([
    getHomeFeed(userId).catch(() => ({ posts: [], nextCursor: null })),
    getTrending(8).catch(() => []),
    getFollowingFeed(userId, 60), // already graceful
  ]);
  const canModerate = isModerator(session?.user?.role);

  const discussions = (
    <>
      <CommunitySearch />
      <div className="community">
        {/* MAIN COLUMN: feed */}
        <section aria-label="Feed">
          <HomeFeed initial={page.posts} initialCursor={page.nextCursor} canModerate={canModerate} />
        </section>

        {/* RIGHT RAIL: trending */}
        <aside aria-label="Trending">
          <div className="craillet">
            <div className="craillet__head">
              <span className="label">Trending communities</span>
            </div>
            {trending.length === 0 ? (
              <div className="craillet__empty">Once people start posting, the busiest anime show up here.</div>
            ) : (
              <ol className="ctrend">
                {trending.map((t, i) => (
                  <li key={t.id}>
                    <Link className="ctrend__row" href={`/community/${encodeURIComponent(t.id)}`}>
                      <span className="ctrend__rank">{i + 1}</span>
                      {t.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="ctrend__cover" src={t.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
                      ) : (
                        <span className="ctrend__cover" />
                      )}
                      <span className="ctrend__txt">
                        <span className="ctrend__name">{t.name}</span>
                        <span className="ctrend__sub">{t.postCount} {t.postCount === 1 ? "post" : "posts"}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </>
  );

  const followingTab = (
    <>
      <ActivityFeed events={following} empty="No activity from people you follow yet." />
      {following.length === 0 && (
        <p className="act-empty-cta">
          Follow people from a post or their profile and what they watch &amp; rate shows up here.
        </p>
      )}
    </>
  );

  return (
    <Page width="wide">
      <PageHead title="Community" />
      <CommunityTabs discussions={discussions} following={followingTab} followingCount={following.length} />
    </Page>
  );
}
