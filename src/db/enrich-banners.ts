import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Backfills `titles.banner` (wide hero/banner art) and upgrades `titles.cover`
// to AniList's sharp extraLarge variant — fixing the pixelated heroes/banners
// that came from stretching MAL's ~450px cover across a wide area.
//
// Keyed by MyAnimeList id (anime only). Resumable: only touches rows where
// banner is still null, and writes '' when AniList has no banner so re-runs skip
// them. Ordered by popularity so the most-seen titles (hero, busy communities)
// are sharpened first. Run: `npm run db:enrich-banners`.
const ANILIST = "https://graphql.anilist.co";
const sql = postgres((process.env.DIRECT_URL ?? process.env.DATABASE_URL)!, { prepare: false, max: 1 });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Row = { id: string; malId: number };
type Media = {
  idMal: number;
  bannerImage: string | null;
  coverImage: { extraLarge: string | null } | null;
};

// One AniList page (≤50 ids) → idMal -> { banner, cover }. Handles 429 backoff.
async function fetchBatch(malIds: number[]): Promise<Map<number, { banner: string; cover: string | null }>> {
  const query = `query ($ids: [Int]) {
    Page(perPage: 50) {
      media(idMal_in: $ids, type: ANIME) {
        idMal bannerImage coverImage { extraLarge }
      }
    }
  }`;
  const map = new Map<number, { banner: string; cover: string | null }>();
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(ANILIST, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query, variables: { ids: malIds } }),
    });
    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after") ?? "60");
      console.log(`  rate-limited; waiting ${wait}s…`);
      await sleep((wait + 1) * 1000);
      continue;
    }
    if (!res.ok) {
      console.log(`  AniList ${res.status}; skipping batch`);
      return map;
    }
    const json = (await res.json()) as { data?: { Page?: { media?: Media[] } } };
    for (const m of json.data?.Page?.media ?? []) {
      if (!m.idMal) continue;
      map.set(m.idMal, { banner: m.bannerImage ?? "", cover: m.coverImage?.extraLarge ?? null });
    }
    return map;
  }
  return map;
}

async function main() {
  const limit = Number(process.argv[2] ?? "100000"); // optional cap for a bounded run
  const rows = (await sql<Row[]>`
    select id, mal_id as "malId"
    from titles
    where kind = 'anime' and mal_id is not null and banner is null
    order by popularity desc nulls last, score desc nulls last
    limit ${limit}
  `) as unknown as Row[];

  console.log(`enriching ${rows.length} anime…`);
  let done = 0, banners = 0, covers = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const byMal = new Map(batch.map((r) => [r.malId, r.id]));
    const got = await fetchBatch(batch.map((r) => r.malId));

    // Apply per row. Rows AniList didn't return get banner='' so they aren't retried.
    for (const r of batch) {
      const hit = got.get(r.malId);
      const banner = hit?.banner ?? "";
      const cover = hit?.cover ?? null;
      if (banner) banners++;
      if (cover) {
        covers++;
        await sql`update titles set banner = ${banner}, cover = ${cover} where id = ${r.id}`;
      } else {
        await sql`update titles set banner = ${banner} where id = ${r.id}`;
      }
    }
    void byMal;
    done += batch.length;
    if (done % 200 === 0 || done === rows.length) {
      console.log(`  ${done}/${rows.length} (banners: ${banners}, covers upgraded: ${covers})`);
    }
    await sleep(750); // stay under AniList's rate limit
  }

  console.log(`done — ${done} processed, ${banners} banners, ${covers} covers upgraded.`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
