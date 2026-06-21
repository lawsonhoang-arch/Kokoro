import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Backfills English titles for the whole anime catalog from AniList (bulk, 50
// per request). Fills only rows that are still missing one, most-popular first,
// so it's safe to interrupt/re-run and the visible titles get done first.
//   npm run db:backfill-english            (anilist-id rows, then mal-id rows)
//   npm run db:backfill-english -- 2000    (cap how many to process this run)

const ANILIST = "https://graphql.anilist.co";
const BATCH = 50;
const CAP = parseInt(process.argv[2] || "0", 10) || Infinity; // 0 = no cap
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Media = { id: number; idMal: number | null; title: { english: string | null } };

async function anilistBatch(field: "id_in" | "idMal_in", ids: number[], attempt = 0): Promise<Media[]> {
  const idField = field === "id_in" ? "id" : "idMal";
  const query = `query ($ids: [Int]) {
    Page(perPage: ${BATCH}) { media(${field}: $ids, type: ANIME) { id idMal title { english } } }
  }`;
  try {
    const res = await fetch(ANILIST, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query, variables: { ids } }),
    });
    if (res.status === 429) {
      const retry = parseInt(res.headers.get("retry-after") || "60", 10);
      if (attempt >= 6) return [];
      console.log(`    rate-limited, waiting ${retry}s…`);
      await sleep((retry + 1) * 1000);
      return anilistBatch(field, ids, attempt + 1);
    }
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: { Page?: { media?: Media[] } } };
    void idField;
    return json.data?.Page?.media ?? [];
  } catch {
    if (attempt >= 3) return [];
    await sleep(2000 * (attempt + 1));
    return anilistBatch(field, ids, attempt + 1);
  }
}

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set."); process.exit(1); }
  const sql = postgres(url, { prepare: false, max: 2 });
  await sql`alter table titles add column if not exists english_title text`;

  let filled = 0;
  let processed = 0;

  // phase: rows whose catalog id encodes a numeric provider id (anilist:/mal:)
  async function phase(prefix: "anilist:" | "mal:", field: "id_in" | "idMal_in") {
    const rows = (await sql`
      select id, split_part(id, ':', 2)::int as num
      from titles
      where kind = 'anime' and english_title is null and id like ${prefix + "%"}
        and split_part(id, ':', 2) ~ '^[0-9]+$'
      order by score desc nulls last, popularity desc nulls last
    `) as unknown as { id: string; num: number }[];
    console.log(`${prefix} rows missing English: ${rows.length}`);
    for (let i = 0; i < rows.length; i += BATCH) {
      if (processed >= CAP) return;
      const slice = rows.slice(i, i + BATCH);
      const byNum = new Map(slice.map((r) => [r.num, r.id]));
      const media = await anilistBatch(field, slice.map((r) => r.num));
      for (const m of media) {
        const key = field === "id_in" ? m.id : m.idMal;
        const dbId = key != null ? byNum.get(key) : undefined;
        const eng = m.title?.english?.trim();
        if (dbId && eng) {
          await sql`update titles set english_title = ${eng} where id = ${dbId} and english_title is null`;
          filled += 1;
        }
      }
      processed += slice.length;
      if ((i / BATCH) % 10 === 0) console.log(`  …${processed} processed, ${filled} filled`);
      await sleep(2200); // ~27 req/min, under AniList's limit
    }
  }

  await phase("anilist:", "id_in");
  await phase("mal:", "idMal_in");

  console.log(`✓ Backfilled ${filled} English titles.`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
