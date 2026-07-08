import "./news.css";
import Link from "next/link";
import { auth } from "@/auth";
import { Page, PageHead } from "@/shell/Page";
import { isModerator } from "@/lib/submissions";
import { getNewsFeed, getUserInterests, curateStories, relativeTime } from "@/lib/news";
import { getLatestUpdated } from "@/lib/search-index";
import { NewsFeed } from "./NewsFeed";

// Server component: pulls the live news feed (real articles from several anime
// sources) plus a real "airing now" rail from the catalog, then hands it to the
// client feed, which renders the tiers and runs the category tabs.
export default async function NewsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const isMod = isModerator(session?.user?.role);
  const now = new Date();

  const emptyInterests = { titles: [], genres: [] };
  const [rows, airing, interests] = await Promise.all([
    getNewsFeed().catch(() => []),
    getLatestUpdated(6),
    userId ? getUserInterests(userId).catch(() => emptyInterests) : Promise.resolve(emptyInterests),
  ]);

  const stories = rows.map((r) => ({
    id: r.id,
    category: r.category,
    title: r.title,
    excerpt: r.excerpt,
    source: r.source,
    href: r.href,
    time: relativeTime(r.publishedAt, now),
    cover: r.cover,
    layout: r.layout,
  }));
  const trending = stories.slice(0, 5).map((s) => ({ title: s.title, href: s.href }));
  const releases = airing.map((a) => ({ title: a.title, tag: a.format || "Airing" }));
  // personalised picks — stories matching the viewer's titles/genres, with a reason
  const curated = curateStories(stories, interests);

  return (
    <Page width="wide">
      <PageHead
        eyebrow="News · Anime & industry"
        title="What's happening in anime"
        lede="A calm daily briefing — announcements, adaptations, release dates, and interviews, gathered from across the industry and summarised for you."
        actions={
          isMod ? (
            <Link className="btn btn--primary" href="/news/admin">
              Manage news
            </Link>
          ) : undefined
        }
      />
      <NewsFeed stories={stories} curated={curated} trending={trending} releases={releases} />
    </Page>
  );
}
