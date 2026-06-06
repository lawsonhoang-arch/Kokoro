import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

// Imports the CC0 anime-offline-database (manami-project) into `titles` as the
// self-hosted search catalog. Stores ONLY facts (title/year/episodes/type/
// genres) — never synopses or cover art — so the data is fully unencumbered.
// Re-runnable: upserts on id, and never touches community descriptions.
//   npm run db:import

const SOURCE =
  "https://github.com/manami-project/anime-offline-database/releases/latest/download/anime-offline-database-minified.json";

const FORMAT: Record<string, string> = {
  TV: "TV", MOVIE: "Movie", OVA: "OVA", ONA: "ONA", SPECIAL: "Special", TV_SHORT: "TV Short",
};

// curated genre taxonomy: map offline-db crowd tags → clean genre labels
const GENRE_MAP: Record<string, string> = {
  action: "Action", adventure: "Adventure", comedy: "Comedy", drama: "Drama",
  fantasy: "Fantasy", horror: "Horror", mystery: "Mystery", romance: "Romance",
  "sci-fi": "Sci-Fi", "science fiction": "Sci-Fi", "slice of life": "Slice of Life",
  sports: "Sports", supernatural: "Supernatural", thriller: "Thriller",
  psychological: "Psychological", music: "Music", historical: "Historical",
  mecha: "Mecha", ecchi: "Ecchi", isekai: "Isekai", "magical girl": "Magical Girl",
  "mahou shoujo": "Magical Girl", "martial arts": "Martial Arts", "school": "School",
};

type RawAnime = {
  sources: string[];
  title: string;
  type?: string;
  episodes?: number;
  animeSeason?: { year?: number | null };
  picture?: string;
  synonyms?: string[];
  tags?: string[];
};

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function deriveId(sources: string[], title: string): string {
  for (const s of sources) {
    const m = s.match(/anilist\.co\/anime\/(\d+)/);
    if (m) return "anilist:" + m[1];
  }
  for (const s of sources) {
    const m = s.match(/myanimelist\.net\/anime\/(\d+)/);
    if (m) return "mal:" + m[1];
  }
  return "cat:" + hash(sources[0] || title);
}

// the MAL id (if any) — kept on every row so Jikan rankings can be matched back
function deriveMalId(sources: string[]): number | null {
  for (const s of sources) {
    const m = s.match(/myanimelist\.net\/anime\/(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

function mapGenres(tags: string[] = []): string[] {
  const out: string[] = [];
  for (const t of tags) {
    const g = GENRE_MAP[t.toLowerCase()];
    if (g && !out.includes(g)) out.push(g);
    if (out.length >= 4) break;
  }
  return out;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set."); process.exit(1); }

  console.log("Downloading CC0 anime-offline-database…");
  const res = await fetch(SOURCE);
  if (!res.ok) { console.error("Download failed:", res.status); process.exit(1); }
  const json = (await res.json()) as { data: RawAnime[] };
  const entries = json.data;
  console.log(`Got ${entries.length} titles. Mapping + importing…`);

  const rows = entries.map((e) => {
    const id = deriveId(e.sources, e.title);
    const searchText = [e.title, ...(e.synonyms ?? [])].join(" ").toLowerCase().slice(0, 2000);
    return {
      id,
      kind: "anime",
      title: e.title,
      year: e.animeSeason?.year ?? 0,
      episodes: e.episodes ?? 0,
      seasons: 1,
      format: e.type && e.type !== "UNKNOWN" ? (FORMAT[e.type] ?? e.type) : null,
      genres: mapGenres(e.tags),
      // cover URL from the dataset — shown only on a title's detail page
      cover: e.picture ?? null,
      malId: deriveMalId(e.sources),
      searchText,
    };
  });

  // de-dup by id (the dataset can have a couple of colliding source ids)
  const byId = new Map<string, (typeof rows)[number]>();
  for (const r of rows) byId.set(r.id, r);
  const unique = [...byId.values()];

  const client = postgres(url, { prepare: false });
  const db = drizzle(client, { schema, casing: "snake_case" });

  // make sure the ranking columns exist (idempotent)
  await db.execute(sql`alter table titles add column if not exists kind text not null default 'anime'`);
  await db.execute(sql`alter table titles add column if not exists mal_id integer`);
  await db.execute(sql`alter table titles add column if not exists popularity integer`);

  const BATCH = 1000;
  let done = 0;
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    await db
      .insert(schema.titles)
      .values(batch)
      .onConflictDoUpdate({
        target: schema.titles.id,
        set: {
          title: sql`excluded.title`,
          year: sql`excluded.year`,
          episodes: sql`excluded.episodes`,
          format: sql`excluded.format`,
          genres: sql`excluded.genres`,
          cover: sql`excluded.cover`,
          malId: sql`excluded.mal_id`,
          searchText: sql`excluded.search_text`,
        },
      });
    done += batch.length;
    if (done % 5000 < BATCH) console.log(`  …${done}/${unique.length}`);
  }

  console.log(`✓ Imported ${unique.length} titles into the catalog.`);
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
