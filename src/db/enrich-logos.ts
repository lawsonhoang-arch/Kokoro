import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Backfills `titles.logo` with a transparent title-logo PNG from Fanart.tv.
//
// Pipeline:  titles.mal_id / anilist id  ->  Fribb/anime-lists (anilist/mal ->
// thetvdb + themoviedb id)  ->  Fanart.tv (/tv/{tvdb} logos, or /movies/{tmdb}).
// Needs a free Fanart.tv personal API key in FANART_API_KEY (.env.local).
//
// Resumable: only touches rows where logo is null, and writes '' when there is
// no logo so re-runs skip them. Ordered by popularity (hero/featured first).
// Scoped by default to the top ~800 titles (hero-eligible); pass a number to
// change the cap:  npm run db:enrich-logos -- 1500
const FRIBB = "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json";
const FANART = "https://webservice.fanart.tv/v3";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Row = { id: string; malId: number | null };
type Map2 = { tvdb?: number; tmdb?: number; type?: string };
type Logo = { url?: string; lang?: string; likes?: string };

// best logo: prefer HD, English, most-liked; falls back across groups/langs.
function pickLogo(j: Record<string, unknown>, isMovie: boolean): string | null {
  const names = isMovie ? ["hdmovielogo", "movielogo", "clearlogo"] : ["hdtvlogo", "clearlogo"];
  for (const n of names) {
    const g = j[n] as Logo[] | undefined;
    if (!Array.isArray(g) || g.length === 0) continue;
    const en = g.filter((x) => x.lang === "en");
    const pool = (en.length ? en : g).slice().sort((a, b) => (Number(b.likes) || 0) - (Number(a.likes) || 0));
    if (pool[0]?.url) return pool[0].url;
  }
  return null;
}

async function fanartLogo(map: Map2, key: string): Promise<string | null> {
  const isMovie = /movie/i.test(map.type ?? "");
  let url: string | null = null;
  if (map.tvdb) url = `${FANART}/tv/${map.tvdb}?api_key=${key}`;
  else if (isMovie && map.tmdb) url = `${FANART}/movies/${map.tmdb}?api_key=${key}`;
  if (!url) return null; // no usable id for Fanart

  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (res.status === 404) return null; // Fanart has nothing for this id
    if (res.status === 429) { await sleep(5000); continue; }
    if (!res.ok) return null;
    return pickLogo((await res.json()) as Record<string, unknown>, isMovie);
  }
  return null;
}

async function main() {
  const key = process.env.FANART_API_KEY;
  if (!key) { console.error("FANART_API_KEY not set in .env.local — get a free personal key at fanart.tv."); process.exit(1); }
  const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) { console.error("DATABASE_URL not set."); process.exit(1); }
  const limit = Number(process.argv[2] ?? "800");
  const sql = postgres(dbUrl, { prepare: false, max: 1 });

  // 1) mapping: anilist/mal id -> { tvdb, tmdb, type }
  console.log("fetching Fribb/anime-lists mapping…");
  const list = (await (await fetch(FRIBB)).json()) as Record<string, unknown>[];
  const byMal = new Map<number, Map2>();
  const byAnilist = new Map<number, Map2>();
  for (const e of list) {
    const m: Map2 = { tvdb: e.tvdb_id as number, tmdb: e.themoviedb_id as number, type: e.type as string };
    if (e.mal_id) byMal.set(e.mal_id as number, m);
    if (e.anilist_id) byAnilist.set(e.anilist_id as number, m);
  }
  console.log(`  mapping ready (${byMal.size} mal, ${byAnilist.size} anilist).`);

  // 2) target titles — anime, most popular first, not yet enriched
  const rows = (await sql<Row[]>`
    select id, mal_id as "malId"
    from titles
    where kind = 'anime' and logo is null
    order by popularity desc nulls last, score desc nulls last
    limit ${limit}
  `) as unknown as Row[];
  console.log(`enriching ${rows.length} anime…`);

  const anilistOf = (id: string) => { const m = id.match(/anilist:(\d+)/i); return m ? Number(m[1]) : null; };

  let done = 0, logos = 0;
  for (const r of rows) {
    const al = anilistOf(r.id);
    const map = (r.malId && byMal.get(r.malId)) || (al != null && byAnilist.get(al)) || null;
    let logo = "";
    if (map && (map.tvdb || map.tmdb)) {
      try { logo = (await fanartLogo(map, key)) ?? ""; } catch { logo = ""; }
      await sleep(260); // be polite to Fanart.tv
    }
    if (logo) logos++;
    await sql`update titles set logo = ${logo} where id = ${r.id}`;
    if (++done % 50 === 0 || done === rows.length) console.log(`  ${done}/${rows.length} (logos: ${logos})`);
  }

  console.log(`done — ${done} processed, ${logos} logos found.`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
