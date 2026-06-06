import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Keeps the CURRENT + UPCOMING season fresh between weekly full syncs.
// Source: Jikan /seasons/now and /seasons/upcoming. It refreshes score,
// popularity and cover on anime that already exist in the catalog (matched by
// mal_id) — it does NOT insert new rows, so it can never create duplicates of
// the offline-database's anilist-keyed entries. Brand-new titles enter the
// catalog through the weekly `npm run db:import` (the offline DB already
// includes upcoming/airing shows); this script just keeps their numbers current.
//   npm run db:import-season

const ENDPOINTS = [
  "https://api.jikan.moe/v4/seasons/now",
  "https://api.jikan.moe/v4/seasons/upcoming",
];
const MAX_PAGES = 10; // plenty for a single season (~25/page)

type JikanAnime = {
  mal_id: number;
  score?: number | null;
  members?: number | null;
  images?: { jpg?: { image_url?: string | null; large_image_url?: string | null } };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(url: string, page: number, attempt = 0): Promise<{ data: JikanAnime[]; hasNext: boolean }> {
  try {
    const res = await fetch(`${url}?page=${page}`, { headers: { accept: "application/json" } });
    if (res.status === 429) {
      if (attempt >= 5) return { data: [], hasNext: false };
      await sleep(1500 * (attempt + 1));
      return fetchPage(url, page, attempt + 1);
    }
    if (!res.ok) return { data: [], hasNext: false };
    const json = (await res.json()) as { data?: JikanAnime[]; pagination?: { has_next_page?: boolean } };
    return { data: json.data ?? [], hasNext: !!json.pagination?.has_next_page };
  } catch {
    if (attempt >= 3) return { data: [], hasNext: false };
    await sleep(1000 * (attempt + 1));
    return fetchPage(url, page, attempt + 1);
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set."); process.exit(1); }
  const client = postgres(url, { prepare: false });

  await client`alter table titles add column if not exists mal_id integer`;
  await client`alter table titles add column if not exists popularity integer`;
  await client`create index if not exists titles_mal_idx on titles(mal_id)`;

  // collect the season's titles (dedup by mal_id)
  const byId = new Map<number, JikanAnime>();
  for (const endpoint of ENDPOINTS) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data, hasNext } = await fetchPage(endpoint, page);
      if (data.length === 0) break;
      for (const a of data) if (a.mal_id) byId.set(a.mal_id, a);
      await sleep(700); // Jikan rate limit
      if (!hasNext) break;
    }
    console.log(`  ${endpoint.split("/").pop()}: ${byId.size} cumulative`);
  }

  console.log(`Refreshing ${byId.size} season titles by mal_id…`);
  let matched = 0;
  for (const a of byId.values()) {
    const score = a.score ? Math.round(a.score * 100) : null;
    const members = a.members ?? null;
    const cover = a.images?.jpg?.large_image_url ?? a.images?.jpg?.image_url ?? null;
    // only overwrite with non-null values (don't wipe existing data for shows
    // that haven't accrued a score yet)
    const res = await client`
      update titles set
        score = coalesce(${score}, score),
        popularity = coalesce(${members}, popularity),
        cover = coalesce(${cover}, cover)
      where mal_id = ${a.mal_id} and kind = 'anime'
    `;
    matched += res.count;
  }

  console.log(`✓ Refreshed ${matched} season anime (of ${byId.size} fetched).`);
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
