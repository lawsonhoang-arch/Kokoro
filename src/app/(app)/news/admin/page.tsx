import "../news.css";
import "./admin.css";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { Page, PageHead } from "@/shell/Page";
import { isModerator } from "@/lib/submissions";
import { getAllNews, getNewsroomWave, relativeTime, type LiveNewsItem } from "@/lib/news";
import { NewsAdmin } from "./NewsAdmin";

// Moderator-only newsroom: create/edit the briefing stories, and review each
// incoming wave of pulled stories before it replaces the live news.
export default async function NewsAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!isModerator(session.user.role)) redirect("/news");

  const now = new Date();
  const [rows, wave] = await Promise.all([getAllNews(), getNewsroomWave()]);
  const stories = rows.map((r) => ({
    id: r.id,
    category: r.category,
    title: r.title,
    excerpt: r.excerpt,
    source: r.source,
    href: r.href ?? "",
    cover: r.cover ?? "",
    hue: r.hue,
    published: r.published,
    onHome: r.onHome,
    layout: (r.layout === "list" ? "list" : "card") as "card" | "list",
  }));
  const toItem = (l: LiveNewsItem) => ({
    id: l.id,
    title: l.title,
    source: l.source,
    href: l.href,
    category: l.category,
    time: relativeTime(l.publishedAt, now),
    hidden: l.hidden,
    cover: l.cover,
    onHome: l.onHome,
    layout: l.layout,
  });

  return (
    <Page width="wide">
      <PageHead
        eyebrow="News · Admin"
        title="Newsroom"
        lede="Write your own briefing stories, and review each incoming wave of pulled news before it replaces what readers see."
        actions={
          <Link className="btn" href="/news">
            View news →
          </Link>
        }
      />
      <NewsAdmin
        stories={stories}
        wave={{
          pending: wave.pending.map(toItem),
          live: wave.live.map(toItem),
          autoReleaseAt: wave.autoReleaseAt ? wave.autoReleaseAt.toISOString() : null,
          liveAt: wave.liveAt.toISOString(),
          liveAgo: relativeTime(wave.liveAt, now),
        }}
      />
    </Page>
  );
}
