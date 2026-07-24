import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { newsStories, newsOverrides, newsWave } from "@/db/schema";

export type NewsStory = typeof newsStories.$inferSelect;

// News-tab placement of a story. "auto" = fall back to position-based tiering
// (the historical behaviour); "card"/"list" are explicit moderator overrides.
export type NewsLayout = "card" | "list";
export type FeedLayout = NewsLayout | "auto";

function asLayout(v: string | null | undefined): FeedLayout {
  return v === "card" || v === "list" ? v : "auto";
}

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
  onHome: boolean; // appears in the Home news carousel
  layout: FeedLayout; // news-tab placement (card | list | auto)
};

// Real anime news, pulled from several public RSS feeds for source variety.
const NEWS_FEEDS: { source: string; url: string }[] = [
  { source: "Anime News Network", url: "https://www.animenewsnetwork.com/news/rss.xml" },
  { source: "Anime Corner", url: "https://animecorner.me/feed/" },
  { source: "CBR", url: "https://www.cbr.com/feed/category/anime/" },
];

function decodeEntities(s: string): string {
  let t = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // Decode entities FIRST, then strip tags. Feeds often escape their own markup
  // (e.g. "&lt;cite&gt;Title&lt;/cite&gt;"); decoding first turns those back into
  // real tags so the strip below removes them — otherwise they'd survive as
  // literal "<cite>" text in the card. (&amp; is decoded last so a double-encoded
  // "&amp;lt;" isn't over-decoded into "<".)
  t = t.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
  t = t.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
  t = t
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
  t = t.replace(/<[^>]+>/g, " "); // strip HTML tags (real, or freshly decoded)
  return t.replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
}

// Defensive display-time cleanup: strips any HTML tags left in stored text so
// items pulled before the decode fix (with literal "<cite>…</cite>" in them)
// render clean without waiting for the wave to refresh. No-op on clean text.
function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
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
      onHome: true, // real defaults; moderator overrides applied in getNewsFeed
      layout: "auto",
    });
  }
  return items;
}

async function fetchFeed(source: string, url: string): Promise<NewsFeedItem[]> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; KokoroNews/1.0)" },
      next: { revalidate: 1800 },
      // a slow/hanging source must never stall the page waiting on it
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return [];
    return parseFeed(await res.text(), source);
  } catch {
    return []; // one bad (or slow) feed shouldn't sink the rest
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

/** The news feed: any mod-curated DB stories merged with the released wave of
 *  pulled stories, newest first. Real articles carry working `href`s. */
export async function getNewsFeed(): Promise<NewsFeedItem[]> {
  const [dbRows, wave, overrides] = await Promise.all([getPublishedNews(), resolveWave(), getNewsOverrides()]);
  const dbItems: NewsFeedItem[] = dbRows.map((r) => ({
    id: r.id, category: r.category, title: stripTags(r.title), excerpt: stripTags(r.excerpt),
    source: r.source, href: r.href, cover: r.cover, hue: r.hue, publishedAt: r.publishedAt,
    onHome: r.onHome, layout: asLayout(r.layout),
  }));
  // pulled (RSS) stories: only the currently-released wave reaches readers, minus
  // any story a moderator dismissed. Each carries the cover / home / layout the
  // moderator set for it.
  const realItems: NewsFeedItem[] = wave.live
    .filter((w) => !overrides.get(w.id)?.hidden)
    .map((w) => {
      const o = overrides.get(w.id);
      return {
        id: w.id, category: w.category, title: stripTags(w.title), excerpt: stripTags(w.excerpt),
        source: w.source, href: w.href, hue: w.hue, publishedAt: w.publishedAt,
        cover: o?.cover ?? w.cover,
        onHome: o?.onHome ?? true,
        layout: asLayout(o?.layout),
      };
    });
  return [...dbItems, ...realItems].sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
  );
}

/** The stories that should appear in the Home news carousel — the merged feed,
 *  minus anything a moderator pulled from Home (onHome = false). Newest first. */
export async function getHomeNews(limit = 12): Promise<NewsFeedItem[]> {
  const feed = await getNewsFeed();
  return feed.filter((s) => s.onHome).slice(0, limit);
}

// ============================================================
// NEWS WAVES — pulled stories arrive as a "wave" a moderator reviews and
// publishes to replace the live set wholesale. An unreleased wave auto-releases
// AUTO_RELEASE_MS after it first appears, so news never goes stale waiting.
// ============================================================
const AUTO_RELEASE_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

export type WaveItem = {
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
type StoredWaveItem = Omit<WaveItem, "publishedAt"> & { publishedAt: string };

const toWaveItem = (n: NewsFeedItem): WaveItem => ({
  id: n.id, category: n.category, title: n.title, excerpt: n.excerpt,
  source: n.source, href: n.href, cover: n.cover, hue: n.hue, publishedAt: n.publishedAt,
});
const toStored = (w: WaveItem): StoredWaveItem => ({ ...w, publishedAt: w.publishedAt.toISOString() });
const fromStored = (s: StoredWaveItem): WaveItem => ({ ...s, publishedAt: new Date(s.publishedAt) });

async function writeWave(patch: { liveItems?: WaveItem[]; pendingSince?: Date | null }): Promise<void> {
  const now = new Date();
  const common: Record<string, unknown> = { updatedAt: now };
  if (patch.liveItems !== undefined) { common.liveItems = patch.liveItems.map(toStored); common.liveAt = now; }
  if (patch.pendingSince !== undefined) common.pendingSince = patch.pendingSince;
  try {
    await db
      .insert(newsWave)
      .values({ id: "singleton", ...(common as object) })
      .onConflictDoUpdate({ target: newsWave.id, set: common });
  } catch {
    /* wave table not set up yet — non-fatal, feed falls back to the raw pull */
  }
}

export type WaveState = {
  live: WaveItem[]; // released stories readers currently see
  pending: WaveItem[]; // an incoming wave awaiting review (empty if none)
  autoReleaseAt: Date | null; // when the pending wave auto-releases
  liveAt: Date; // when the live wave was published
};

/** Work out what readers should see: the released wave, plus (for the admin) any
 *  incoming wave under review. Advances the wave lazily — starts the 2-day clock
 *  when new stories first appear, and auto-releases once it elapses. */
export async function resolveWave(): Promise<WaveState> {
  const pullRaw = await getRealNews();
  const pull = pullRaw.map(toWaveItem);

  let row: typeof newsWave.$inferSelect | null = null;
  try {
    [row = null] = await db.select().from(newsWave).where(eq(newsWave.id, "singleton")).limit(1);
  } catch {
    // wave table missing → show the raw pull (pre-wave behaviour)
    return { live: pull, pending: [], autoReleaseAt: null, liveAt: new Date() };
  }

  // first run ever: publish the current pull immediately (nothing to replace).
  // But if the feeds happened to be down on this first load, don't lock an empty
  // wave in — show nothing this time and try again next request.
  if (!row) {
    if (pull.length > 0) await writeWave({ liveItems: pull, pendingSince: null });
    return { live: pull, pending: [], autoReleaseAt: null, liveAt: new Date() };
  }

  const liveItems = (row.liveItems as StoredWaveItem[]).map(fromStored);

  // Recovery: if the live wave is empty (e.g. it was seeded during a feed outage)
  // but we now have stories, publish them immediately instead of parking them in
  // the 2-day pending queue — otherwise every reader keeps seeing an empty tab.
  if (liveItems.length === 0 && pull.length > 0) {
    await writeWave({ liveItems: pull, pendingSince: null });
    return { live: pull, pending: [], autoReleaseAt: null, liveAt: new Date() };
  }

  const liveIds = new Set(liveItems.map((i) => i.id));
  const hasNew = pull.some((p) => !liveIds.has(p.id));

  if (!hasNew) {
    // pull matches what's live — no wave pending
    if (row.pendingSince) await writeWave({ pendingSince: null });
    return { live: liveItems, pending: [], autoReleaseAt: null, liveAt: row.liveAt };
  }

  // an incoming wave exists — start / read its 2-day clock
  let since = row.pendingSince ?? null;
  if (!since) { since = new Date(); await writeWave({ pendingSince: since }); }
  const autoReleaseAt = new Date(since.getTime() + AUTO_RELEASE_MS);

  if (Date.now() >= autoReleaseAt.getTime()) {
    // clock elapsed → auto-release the incoming wave
    await writeWave({ liveItems: pull, pendingSince: null });
    return { live: pull, pending: [], autoReleaseAt: null, liveAt: new Date() };
  }

  // within the window — readers keep the old wave; admin reviews the incoming one
  return { live: liveItems, pending: pull, autoReleaseAt, liveAt: row.liveAt };
}

/** Publish the incoming wave now — the current pull replaces the live set. */
export async function publishWave(): Promise<void> {
  const pull = (await getRealNews()).map(toWaveItem);
  await writeWave({ liveItems: pull, pendingSince: null });
}

// ============================================================
// LIVE-FEED OVERRIDES — moderators can hide a pulled RSS story or give it a
// cover, keyed by the article's stable id.
// ============================================================
export type NewsOverride = {
  hidden: boolean; // dismissed from the review queue
  approved: boolean; // verified & released to readers
  cover: string | null;
  onHome: boolean | null; // null = auto (shown on Home); false = pulled
  layout: string | null; // null = auto tiering; card | list
};

/** All overrides as a map by news id. Resilient to an un-migrated DB: if the
 *  newer columns aren't there yet it falls back to the original columns (and
 *  treats non-hidden stories as approved, preserving pre-review behaviour) so
 *  the public feed never blanks out. Empty if the table itself is absent. */
export async function getNewsOverrides(): Promise<Map<string, NewsOverride>> {
  try {
    const rows = await db.select().from(newsOverrides);
    return new Map(rows.map((r) => [r.newsId, { hidden: r.hidden, approved: r.approved, cover: r.cover, onHome: r.onHome, layout: r.layout }]));
  } catch {
    try {
      const res = await db.execute(sql`select news_id, hidden, cover from news_overrides`);
      const rows = res as unknown as { news_id: string; hidden: boolean; cover: string | null }[];
      return new Map(rows.map((r) => [r.news_id, { hidden: r.hidden, approved: !r.hidden, cover: r.cover, onHome: null, layout: null }]));
    } catch {
      return new Map();
    }
  }
}

/** Approve/dismiss, set the cover, or set the Home/news-tab placement of a live
 *  news item (upsert). */
export async function upsertNewsOverride(
  newsId: string,
  patch: { hidden?: boolean; approved?: boolean; cover?: string | null; onHome?: boolean | null; layout?: string | null },
): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.hidden !== undefined) set.hidden = patch.hidden;
  if (patch.approved !== undefined) set.approved = patch.approved;
  if (patch.cover !== undefined) set.cover = patch.cover;
  if (patch.onHome !== undefined) set.onHome = patch.onHome;
  if (patch.layout !== undefined) set.layout = patch.layout;
  await db
    .insert(newsOverrides)
    .values({
      newsId,
      hidden: patch.hidden ?? false,
      approved: patch.approved ?? false,
      cover: patch.cover ?? null,
      onHome: patch.onHome ?? null,
      layout: patch.layout ?? null,
    })
    .onConflictDoUpdate({ target: newsOverrides.newsId, set });
}

export type LiveNewsItem = {
  id: string;
  title: string;
  source: string;
  href: string | null;
  category: string;
  publishedAt: Date;
  hidden: boolean; // dismissed — excluded from the wave
  cover: string | null;
  onHome: boolean | null; // null = auto (shown); false = pulled from Home
  layout: string | null; // null = auto; card | list
};

export type NewsroomWave = {
  pending: LiveNewsItem[]; // incoming wave awaiting review (empty if none)
  live: LiveNewsItem[]; // stories readers currently see
  autoReleaseAt: Date | null; // when the incoming wave auto-releases
  liveAt: Date; // when the live wave was published
};

/** The newsroom's view of the wave: the incoming (pending) stories to review and
 *  the currently-live ones, each with its moderator override applied. */
export async function getNewsroomWave(): Promise<NewsroomWave> {
  const [wave, overrides] = await Promise.all([resolveWave(), getNewsOverrides()]);
  const enrich = (w: WaveItem): LiveNewsItem => {
    const o = overrides.get(w.id);
    return {
      id: w.id, title: w.title, source: w.source, href: w.href,
      category: w.category, publishedAt: w.publishedAt,
      hidden: o?.hidden ?? false, cover: o?.cover ?? w.cover,
      onHome: o?.onHome ?? null, layout: o?.layout ?? null,
    };
  };
  return {
    pending: wave.pending.map(enrich),
    live: wave.live.map(enrich),
    autoReleaseAt: wave.autoReleaseAt,
    liveAt: wave.liveAt,
  };
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
  onHome: boolean;
  layout: NewsLayout;
};

// Display order: most prominent first (lowest position), newest as the tiebreak.
const ORDER = [asc(newsStories.position), desc(newsStories.publishedAt)] as const;

/** Fallback read for before `db:setup-news-placement` has added the on_home /
 *  layout columns — selects the original columns and synthesises the defaults so
 *  /news and Home keep working regardless of deploy/migration ordering. */
async function legacyNews(publishedOnly: boolean): Promise<NewsStory[]> {
  const res = await db.execute(sql`
    select id, category, title, excerpt, source, href, cover, hue,
           published_at, position, published, author_id, created_at, updated_at
    from news_stories
    ${publishedOnly ? sql`where published = true` : sql``}
    order by position asc, published_at desc
  `);
  const rows = res as unknown as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    category: r.category as string,
    title: r.title as string,
    excerpt: r.excerpt as string,
    source: r.source as string,
    href: (r.href as string | null) ?? null,
    cover: (r.cover as string | null) ?? null,
    hue: r.hue as number,
    publishedAt: new Date(r.published_at as string),
    position: r.position as number,
    published: r.published as boolean,
    onHome: true,
    layout: "card",
    authorId: (r.author_id as string | null) ?? null,
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string),
  }));
}

/** Published stories, biggest first. */
export async function getPublishedNews(): Promise<NewsStory[]> {
  try {
    return await db.select().from(newsStories).where(eq(newsStories.published, true)).orderBy(...ORDER);
  } catch {
    return legacyNews(true); // placement columns not migrated yet
  }
}

/** Every story for the editor. */
export async function getAllNews(): Promise<NewsStory[]> {
  try {
    return await db.select().from(newsStories).orderBy(...ORDER);
  } catch {
    return legacyNews(false);
  }
}

export async function createNews(authorId: string, input: NewsInput): Promise<string> {
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${newsStories.position}), -1) + 1` })
    .from(newsStories);
  const [row] = await db
    .insert(newsStories)
    .values({ ...input, authorId, position: Number(next) })
    .returning({ id: newsStories.id });
  return row.id;
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

/** Update a story's placement (Home carousel and/or news-tab card|list). */
export async function setNewsPlacement(
  id: string,
  patch: { onHome?: boolean; layout?: NewsLayout },
): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.onHome !== undefined) set.onHome = patch.onHome;
  if (patch.layout !== undefined) set.layout = patch.layout;
  await db.update(newsStories).set(set).where(eq(newsStories.id, id));
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
