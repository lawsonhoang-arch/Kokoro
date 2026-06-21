import "../news.css";
import "./admin.css";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { Page, PageHead } from "@/shell/Page";
import { isModerator } from "@/lib/submissions";
import { getAllNews } from "@/lib/news";
import { NewsAdmin } from "./NewsAdmin";

// Moderator-only newsroom: create, edit, reorder (prominence) and publish the
// briefing stories that appear on /news.
export default async function NewsAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!isModerator(session.user.role)) redirect("/news");

  const rows = await getAllNews();
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
  }));

  return (
    <Page width="wide">
      <PageHead
        eyebrow="News · Admin"
        title="Newsroom"
        lede="Curate the briefing. The top story is the lead; everything below flows down by prominence — drag order with the arrows."
        actions={
          <Link className="btn" href="/news">
            View news →
          </Link>
        }
      />
      <NewsAdmin stories={stories} />
    </Page>
  );
}
