import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { newsStories } from "@/db/schema";

export type NewsStory = typeof newsStories.$inferSelect;

// A normalised news item — from either the real wire (RSS) or the DB.
export type NewsFeedItem = {
  id: string;
  category: string;
  title: string;
  excerpt: string;
  source: string;
  href: string | null;
  cover: string | null;
  hue: number;
  publishedAt: Date;
};

// Real anime news, pulled from several public RSS feeds for source variety.
const NEWS_FEEDS: { source: string; url: string }[] = [
  { source: "Anime News Network", url: "https://www.animenewsnetwork.com/news/rss.xml" },
  { source: "Anime Corner", url: "https://animecorner.me/feed/" },
  { source: "CBR", url: "https://www.cbr.com/feed/category/anime/" },
];

function decodeEntities(s: string): string {
  let t = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  t = t.replace(/<[^>]+>/g, " "); // strip any stray HTML tags
  t = t.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
  t = t.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
  t = t
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
  return t.replace(/\s+/g, " ").trim();
}

function tagText(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? decodeEntities(m[1]) : "";
}

// Sort an article into one of the page's category buckets from keyword cues.
function bucket(title: string, cat: string): string {
  const t = `${title} ${cat}`.toLowerCase();
  if (/\binterview|talks about|roundtable|q&a\b/.test(t)) return "Interviews";
  if (/\bmanga|novel|adaptation|gets .*anime|anime adaptation|to publish|launches\b/.test(t)) return "Adaptations";
  if (/\btrailer|video|visual|\bpv\b|premiere|debut|release date|airs|film|movie|reveals .*(date|cast)\b/.test(t)) return "Releases";
  return "Industry";
}

// Parse one RSS feed's <item>s into normalised stories, tagged with its source.
function parseFeed(xml: string, source: string): NewsFeedItem[] {
  const blocks = xml.split("<item>").slice(1).map((s) => s.split("</item>")[0]);
  const items: NewsFeedItem[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const title = tagText(b, "title");
    const href = tagText(b, "link");
    if (!title || !href) continue;
    const pub = tagText(b, "pubDate");
    const when = pub ? new Date(pub) : new Date();
    let excerpt = tagText(b, "description");
    if (excerpt.length > 240) excerpt = `${excerpt.slice(0, 237).trimEnd()}…`;
    items.push({
      id: tagText(b, "guid") || href,
      category: bucket(title, tagText(b, "category")),
      title,
      excerpt,
      source,
      href,
      cover: null,
      hue: (i % 8) + 1,
      publishedAt: isNaN(when.getTime()) ? new Date() : when,
    });
  }
  return items;
}

async function fetchFeed(source: string, url: string): Promise<NewsFeedItem[]> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; KokoroNews/1.0)" },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    return parseFeed(await res.text(), source);
  } catch {
    return []; // one bad feed shouldn't sink the rest
  }
}

/** Real anime news, merged from several RSS feeds. Each feed cached 30 min;
 *  any that fail are skipped. De-duped by title, newest first, capped. */
async function getRealNews(): Promise<NewsFeedItem[]> {
  const lists = await Promise.all(NEWS_FEEDS.map((f) => fetchFeed(f.source, f.url)));
  const merged = lists
    .flat()
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  const seen = new Set<string>();
  const out: NewsFeedItem[] = [];
  for (const it of merged) {
    const key = it.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) continue; // same story across sources → keep newest
    seen.add(key);
    out.push(it);
    if (out.length >= 60) break;
  }
  return out;
}

/** The news feed: any mod-curated DB stories merged with the real wire, newest
 *  first. Real articles carry working `href`s to the source. */
export async function getNewsFeed(): Promise<NewsFeedItem[]> {
  const [dbRows, real] = await Promise.all([getPublishedNews(), getRealNews()]);
  const dbItems: NewsFeedItem[] = dbRows.map((r) => ({
    id: r.id, category: r.category, title: r.title, excerpt: r.excerpt,
    source: r.source, href: r.href, cover: r.cover, hue: r.hue, publishedAt: r.publishedAt,
  }));
  return [...dbItems, ...real].sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
  );
}

/** What a viewer is into — the title names + genres they favourite, track, or
 *  have completed. Used to personalise the "For you" news tab. */
export async function getUserInterests(
  userId: string,
): Promise<{ titles: string[]; genres: string[] }> {
  const res = await db.execute(sql`
    select coalesce(t.english_title, t.title) as name, t.genres as genres
    from titles t
    where t.id in (
      select title_id from favorites where user_id = ${userId}
      union
      select title_id from completions where user_id = ${userId}
      union
      select e.title_id from watchlist_entries e
        join watchlists w on e.watchlist_id = w.id
        where w.user_id = ${userId}
    )
  `);
  const rows = res as unknown as { name: string | null; genres: string[] | null }[];
  const titles: string[] = [];
  const genreCount = new Map<string, number>();
  for (const r of rows) {
    if (r.name) titles.push(r.name);
    for (const g of r.genres ?? []) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
  }
  // genres ranked by how often they show up across the viewer's titles
  const genres = [...genreCount.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
  return { titles, genres };
}

/** Rank stories by how well they match a viewer's interests, keeping only the
 *  ones that hit (a tracked title name scores higher than a genre). Each kept
 *  story carries a short `reason` explaining why it surfaced. Pure/testable. */
export function curateStories<T extends { title: string; excerpt: string }>(
  stories: T[],
  interests: { titles: string[]; genres: string[] },
): (T & { reason: string })[] {
  // short title names match too loosely, so require ≥4 chars
  const titleKeys = interests.titles.filter((t) => t.trim().length >= 4);
  const scored: { s: T; score: number; reason: string }[] = [];
  for (const s of stories) {
    const hay = `${s.title} ${s.excerpt}`.toLowerCase();
    let score = 0;
    let reason = "";
    for (const t of titleKeys) {
      if (hay.includes(t.toLowerCase())) {
        score += 3;
        if (!reason) reason = `About ${t}`;
      }
    }
    for (const g of interests.genres) {
      if (hay.includes(g.toLowerCase())) {
        score += 1;
        if (!reason) reason = `Because you like ${g}`;
      }
    }
    if (score > 0) scored.push({ s, score, reason });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map(({ s, reason }) => ({ ...s, reason }));
}

export const NEWS_CATEGORIES = ["Industry", "Releases", "Adaptations", "Interviews"] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export type NewsInput = {
  category: string;
  title: string;
  excerpt: string;
  source: string;
  href: string | null;
  cover: string | null;
  hue: number;
  published: boolean;
};

// Display order: most prominent first (lowest position), newest as the tiebreak.
const ORDER = [asc(newsStories.position), desc(newsStories.publishedAt)] as const;

/** Published stories, biggest first. */
export async function getPublishedNews(): Promise<NewsStory[]> {
  return db.select().from(newsStories).where(eq(newsStories.published, true)).orderBy(...ORDER);
}

/** Every story for the editor. */
export async function getAllNews(): Promise<NewsStory[]> {
  return db.select().from(newsStories).orderBy(...ORDER);
}

export async function createNews(authorId: string, input: NewsInput): Promise<void> {
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${newsStories.position}), -1) + 1` })
    .from(newsStories);
  await db.insert(newsStories).values({ ...input, authorId, position: Number(next) });
}

export async function updateNews(id: string, input: NewsInput): Promise<void> {
  await db.update(newsStories).set({ ...input, updatedAt: new Date() }).where(eq(newsStories.id, id));
}

export async function deleteNews(id: string): Promise<void> {
  await db.delete(newsStories).where(eq(newsStories.id, id));
}

export async function setNewsPublished(id: string, published: boolean): Promise<void> {
  await db.update(newsStories).set({ published, updatedAt: new Date() }).where(eq(newsStories.id, id));
}

/** Swap a story with its neighbour to reorder (top of list = most prominent). */
export async function moveNews(id: string, dir: "up" | "down"): Promise<void> {
  const all = await db.select().from(newsStories).orderBy(...ORDER);
  const i = all.findIndex((s) => s.id === id);
  if (i < 0) return;
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= all.length) return;
  // ascending order: earlier in the list should hold the lower `position`
  await db.update(newsStories).set({ position: j }).where(eq(newsStories.id, all[i].id));
  await db.update(newsStories).set({ position: i }).where(eq(newsStories.id, all[j].id));
}

/** A short "2h ago" style label relative to `now` (passed in so it's request-stable). */
export function relativeTime(d: Date, now: Date): string {
  const s = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  const w = Math.floor(days / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(days / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
