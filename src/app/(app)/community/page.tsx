import "./community.css";
import "@/styles/rating-control.css";
import Link from "next/link";
import { auth } from "@/auth";
import { Page, PageHead } from "@/shell/Page";
import { getHomeFeed, getTrending } from "@/lib/community";
import { HomeFeed } from "@/features/community/HomeFeed";
import { CommunitySearch } from "@/features/community/CommunitySearch";

export default async function CommunityPage() {
  const session = await auth();
  const [page, trending] = await Promise.all([getHomeFeed(session?.user?.id), getTrending(8)]);

  return (
    <Page width="wide">
      <PageHead
        eyebrow="Community · Public"
        title="What everyone's watching"
        lede="Discussions, reviews, and hot takes from across the catalog — jump into any anime's community to go deeper."
      />

      <CommunitySearch />

      <div className="community">
        {/* MAIN COLUMN: feed */}
        <section aria-label="Feed">
          <HomeFeed initial={page.posts} initialCursor={page.nextCursor} />
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
    </Page>
  );
}
