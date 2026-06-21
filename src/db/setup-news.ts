import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Creates the news_stories table (if needed) and seeds a starter briefing so the
// /news page has real, tiered content. Idempotent: it only seeds an empty table.
const sql = postgres((process.env.DIRECT_URL ?? process.env.DATABASE_URL)!, { prepare: false, max: 1 });

type Seed = {
  category: string;
  title: string;
  excerpt: string;
  source: string;
  hue: number;
  hoursAgo: number;
};

// Ordered most-prominent first — index becomes `position` (0 = lead story).
const STORIES: Seed[] = [
  { category: "Industry", hue: 1, source: "Anime Wire", hoursAgo: 2,
    title: "Studio MAPPA announces a five-year original-works initiative",
    excerpt: "Following a record year, the studio says it will split capacity between adaptations and a slate of wholly original series — the first entering production this autumn under a director it has yet to name." },
  { category: "Adaptations", hue: 2, source: "Manga Desk", hoursAgo: 4,
    title: "Beloved quiet-fantasy manga gets a TV anime for next spring",
    excerpt: "The long-running slice-of-life series will be adapted by a first-time director, with the original author credited on series composition." },
  { category: "Releases", hue: 3, source: "Seasonal", hoursAgo: 6,
    title: "Spring season finale week: what's ending and what's renewed",
    excerpt: "Three of this season's break-out titles have already confirmed second cours, while two await word from their production committees." },
  { category: "Interviews", hue: 4, source: "In Frame", hoursAgo: 26,
    title: "“We storyboarded the silence first” — a director on pacing tenderness",
    excerpt: "In a wide-ranging conversation, the director breaks down how negative space and held shots became the show's signature." },
  { category: "Industry", hue: 5, source: "Stream Report", hoursAgo: 30,
    title: "Streaming platform expands simulcast slate to 40 new territories",
    excerpt: "Same-day subtitles roll out in twelve additional languages, with dubs following on a staggered schedule through the year." },
  { category: "Releases", hue: 6, source: "Box Office Now", hoursAgo: 50,
    title: "Anticipated film sets its theatrical date after a year of delays",
    excerpt: "The feature, years in the making, finally locks a release window — and an international run is confirmed alongside the domestic premiere." },
  { category: "Adaptations", hue: 7, source: "Anime Wire", hoursAgo: 74,
    title: "Sci-fi epic's second season teases a new key visual and staff shuffle",
    excerpt: "A returning core team is joined by fresh action-animation leads, hinting at a more kinetic register for the next arc." },
  { category: "Industry", hue: 8, source: "Sakuga Times", hoursAgo: 78,
    title: "Veteran key animator leaves to found an independent studio",
    excerpt: "The new outfit will focus on short-form original work and creator-owned projects, funded in part by a streaming first-look deal." },
  { category: "Interviews", hue: 2, source: "In Frame", hoursAgo: 96,
    title: "A composer on scoring a wordless finale",
    excerpt: "Building an episode of music with almost no dialogue meant treating the score as the script — every cue had to carry a beat of story." },
  { category: "Releases", hue: 3, source: "Seasonal", hoursAgo: 124,
    title: "Two summer premieres move up a week to dodge a crowded slate",
    excerpt: "Schedulers reshuffled after three heavyweight returns clustered on the same night, giving newcomers a clearer runway." },
  { category: "Adaptations", hue: 5, source: "Manga Desk", hoursAgo: 150,
    title: "Cult web-novel lands an anime greenlight after years of fan campaigns",
    excerpt: "The adaptation will cover the first two arcs, with the author joining the writers' room to expand on the novel's interludes." },
  { category: "Industry", hue: 6, source: "Stream Report", hoursAgo: 170,
    title: "Subtitle co-op wins an accessibility award for its caption standards",
    excerpt: "The volunteer group's open style guide for sound and song captioning is being adopted by two major distributors." },
  { category: "Releases", hue: 7, source: "Box Office Now", hoursAgo: 176,
    title: "Beloved 90s OVA gets a 4K restoration and a limited re-release",
    excerpt: "Scanned from the original negatives, the remaster keeps the grain intact — no AI upscaling, the distributor stresses." },
  { category: "Interviews", hue: 4, source: "In Frame", hoursAgo: 340,
    title: "Director roundtable: the colour palettes that defined the season",
    excerpt: "Four directors compare notes on how lighting and limited palettes did the emotional heavy lifting across very different shows." },
];

async function main() {
  await sql`
    create table if not exists news_stories (
      id uuid primary key default gen_random_uuid(),
      category text not null default 'Industry',
      title text not null,
      excerpt text not null default '',
      source text not null default '',
      href text,
      cover text,
      hue integer not null default 1,
      published_at timestamptz not null default now(),
      position integer not null default 0,
      published boolean not null default true,
      author_id uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`;
  await sql`create index if not exists news_position_idx on news_stories(position)`;

  // The /news page now pulls live articles from a real feed (Anime News Network),
  // so the old placeholder seed should not mix in. Remove exactly those demo rows
  // (matched on title + their fictional source) — real mod-curated stories stay.
  let removed = 0;
  for (const s of STORIES) {
    const res = await sql`delete from news_stories where title = ${s.title} and source = ${s.source}`;
    removed += res.count;
  }
  console.log(`news_stories table ready — removed ${removed} demo seed rows.`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
