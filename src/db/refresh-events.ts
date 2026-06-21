import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Generates the "actual events" banners from real data:
//  - auto-premiere: a notable title from the CURRENT season (most anticipated),
//    featured with real wide artwork (AniList bannerImage) + a link into the app.
//  - auto-season:  "{Season} {Year} is here — N new titles now airing".
// Upserts by `source` (keeps the row id stable while the featured title is
// unchanged, so a user's dismissal sticks until the event actually changes).
// Manual banners outrank these (see getActiveBanner). Run daily.
//   npm run db:refresh-events

const SEASONS_NOW = "https://api.jikan.moe/v4/seasons/now";
const ANILIST = "https://graphql.anilist.co";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type JikanAnime = {
  mal_id: number;
  title: string;
  title_english?: string | null;
  members?: number | null;
  images?: { jpg?: { large_image_url?: string | null; image_url?: string | null } };
};

async function fetchSeason(): Promise<JikanAnime[]> {
  const out: JikanAnime[] = [];
  for (let page = 1; page <= 8; page++) {
    let res: Response;
    try {
      res = await fetch(`${SEASONS_NOW}?page=${page}`, { headers: { accept: "application/json" } });
    } catch { break; }
    if (res.status === 429) { await sleep(1500); page--; continue; }
    if (!res.ok) break;
    const json = (await res.json()) as { data?: JikanAnime[]; pagination?: { has_next_page?: boolean } };
    const data = json.data ?? [];
    out.push(...data);
    await sleep(700);
    if (!json.pagination?.has_next_page) break;
  }
  return out;
}

// wide banner art for a set of MAL ids, via AniList (one request)
async function anilistBanners(malIds: number[]): Promise<Map<number, string>> {
  const query = `query ($ids: [Int]) {
    Page(perPage: 50) { media(idMal_in: $ids, type: ANIME) { idMal bannerImage } }
  }`;
  const map = new Map<number, string>();
  try {
    const res = await fetch(ANILIST, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query, variables: { ids: malIds } }),
    });
    if (!res.ok) return map;
    const json = (await res.json()) as { data?: { Page?: { media?: { idMal: number; bannerImage: string | null }[] } } };
    for (const m of json.data?.Page?.media ?? []) {
      if (m.idMal && m.bannerImage) map.set(m.idMal, m.bannerImage);
    }
  } catch { /* ignore — fall back to MAL cover */ }
  return map;
}

function seasonName(d: Date): { season: string; year: number } {
  const m = d.getMonth(); // Winter Jan–Mar, Spring Apr–Jun, Summer Jul–Sep, Fall Oct–Dec
  const season = m <= 2 ? "Winter" : m <= 5 ? "Spring" : m <= 8 ? "Summer" : "Fall";
  return { season, year: d.getFullYear() };
}

type AutoRow = { title: string; subtitle: string; ctaLabel: string; ctaHref: string | null; image: string | null };

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set."); process.exit(1); }
  const sql = postgres(url, { prepare: false, max: 2 });

  await sql`alter table event_banners add column if not exists source text not null default 'manual'`;

  // upsert that keeps the row id stable while the featured title is unchanged
  async function upsert(source: string, row: AutoRow): Promise<void> {
    const existing = await sql`select id, title from event_banners where source = ${source} limit 1`;
    if (existing.length && existing[0].title === row.title) {
      await sql`update event_banners set
        subtitle = ${row.subtitle}, cta_label = ${row.ctaLabel}, cta_href = ${row.ctaHref},
        image = ${row.image}, active = true, updated_at = now()
        where id = ${existing[0].id}`;
    } else {
      await sql`delete from event_banners where source = ${source}`;
      await sql`insert into event_banners (source, title, subtitle, cta_label, cta_href, image, active)
        values (${source}, ${row.title}, ${row.subtitle}, ${row.ctaLabel}, ${row.ctaHref}, ${row.image}, true)`;
    }
  }

  console.log("Fetching current season from Jikan…");
  const season = await fetchSeason();
  if (season.length === 0) { console.warn("No season data — leaving banners as-is."); await sql.end(); return; }

  const { season: sName, year } = seasonName(new Date());

  // ---- auto-season banner ----
  await upsert("auto-season", {
    title: `${sName} ${year} is here`,
    subtitle: `${season.length} new anime now airing this season`,
    ctaLabel: "Browse the season",
    ctaHref: "/search?type=anime&sort=newest",
    image: null,
  });
  console.log(`  ✓ auto-season: ${sName} ${year} (${season.length} titles)`);

  // ---- auto-premiere banner ----
  const ranked = [...season].sort((a, b) => (b.members ?? 0) - (a.members ?? 0));
  const top = ranked.slice(0, 20);
  const banners = await anilistBanners(top.map((t) => t.mal_id));
  // prefer the most-anticipated title that has real wide art
  const featured = top.find((t) => banners.has(t.mal_id)) ?? top[0];
  if (featured) {
    const image = banners.get(featured.mal_id)
      ?? featured.images?.jpg?.large_image_url
      ?? featured.images?.jpg?.image_url
      ?? null;
    const [inCatalog] = await sql`select id from titles where mal_id = ${featured.mal_id} and kind = 'anime' limit 1`;
    const href = inCatalog
      ? `/anime/${encodeURIComponent(inCatalog.id)}`
      : `/search?q=${encodeURIComponent(featured.title)}`;
    await upsert("auto-premiere", {
      title: featured.title_english?.trim() || featured.title,
      subtitle: "New this season · now airing",
      ctaLabel: "View title",
      ctaHref: href,
      image,
    });
    console.log(`  ✓ auto-premiere: ${featured.title}${banners.has(featured.mal_id) ? " (AniList banner)" : " (cover)"}`);
  }

  console.log("✓ Event banners refreshed.");
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
