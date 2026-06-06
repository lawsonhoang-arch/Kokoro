import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";
import { sql } from "drizzle-orm";

// Attaches rankings (score + popularity) to EXISTING anime catalog rows by
// matching MyAnimeList id. Source: Jikan /top/anime — facts only, no synopses.
// Run AFTER `npm run db:import` (which backfills titles.mal_id).
//   npm run db:import-anime-rankings           (default 50 pages ≈ 1250 anime)
//   npm run db:import-anime-rankings -- 80

const PAGES = Math.max(1, parseInt(process.argv[2] || "50", 10) || 50);
const JIKAN = "https://api.jikan.moe/v4/top/anime";

type JikanAnime = { mal_id: number; score?: number | null; members?: number | null };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(page: number, attempt = 0): Promise<JikanAnime[]> {
  try {
    const res = await fetch(`${JIKAN}?page=${page}`, { headers: { accept: "application/json" } });
    if (res.status === 429) {
      if (attempt >= 5) return [];
      await sleep(1500 * (attempt + 1));
      return fetchPage(page, attempt + 1);
    }
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: JikanAnime[] };
    return json.data ?? [];
  } catch {
    if (attempt >= 3) return [];
    await sleep(1000 * (attempt + 1));
    return fetchPage(page, attempt + 1);
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set."); process.exit(1); }
  const client = postgres(url, { prepare: false });

  await client`alter table titles add column if not exists mal_id integer`;
  await client`alter table titles add column if not exists popularity integer`;
  await client`create index if not exists titles_mal_idx on titles(mal_id)`;

  console.log(`Fetching ${PAGES} pages of top anime from Jikan…`);
  const rows: { malId: number; score: number | null; members: number | null }[] = [];
  for (let page = 1; page <= PAGES; page++) {
    const data = await fetchPage(page);
    if (data.length === 0) { console.log(`  page ${page}: empty/failed — stopping.`); break; }
    for (const a of data) {
      rows.push({
        malId: a.mal_id,
        score: a.score ? Math.round(a.score * 100) : null,
        members: a.members ?? null,
      });
    }
    if (page % 5 === 0) console.log(`  …${rows.length} ranked (page ${page}/${PAGES})`);
    await sleep(700); // Jikan rate limit
  }

  console.log(`Updating ${rows.length} anime rows by mal_id…`);
  let matched = 0;
  for (const r of rows) {
    const res = await client`
      update titles set score = ${r.score}, popularity = ${r.members}
      where mal_id = ${r.malId} and kind = 'anime'
    `;
    matched += res.count;
  }

  console.log(`✓ Applied rankings to ${matched} anime rows (of ${rows.length} fetched).`);
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
