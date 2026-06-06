import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

// Imports manga FACTS into the same `titles` catalog with kind='manga', so the
// existing search / filters / ratings / watchlists all work for manga too.
// Source: Jikan (MAL) /top/manga — facts + cover only, never synopses (those
// stay community-written). Re-runnable: upserts on id.
//   npm run db:import-manga            (default 40 pages ≈ 1000 manga)
//   npm run db:import-manga -- 60      (custom page count)

const PAGES = Math.max(1, parseInt(process.argv[2] || "40", 10) || 40);
const PER_PAGE = 25;
const JIKAN = "https://api.jikan.moe/v4/top/manga";

// Jikan manga "type" → our format label (used by the search Format filter)
const FORMAT: Record<string, string> = {
  Manga: "Manga", Manhwa: "Manhwa", Manhua: "Manhua", Novel: "Novel",
  "Light Novel": "Light Novel", Lightnovel: "Light Novel", "One-shot": "One-shot",
  Oneshot: "One-shot", Doujinshi: "Doujinshi",
};

// crowd genres/themes → clean labels (shares the anime taxonomy where it overlaps)
const GENRE_MAP: Record<string, string> = {
  action: "Action", adventure: "Adventure", comedy: "Comedy", drama: "Drama",
  fantasy: "Fantasy", horror: "Horror", mystery: "Mystery", romance: "Romance",
  "sci-fi": "Sci-Fi", "science fiction": "Sci-Fi", "slice of life": "Slice of Life",
  sports: "Sports", supernatural: "Supernatural", suspense: "Thriller",
  thriller: "Thriller", psychological: "Psychological", music: "Music",
  historical: "Historical", mecha: "Mecha", ecchi: "Ecchi", isekai: "Isekai",
  "magical girl": "Magical Girl", "martial arts": "Martial Arts", school: "School",
  gourmet: "Gourmet", "boys love": "Boys Love", "girls love": "Girls Love",
};

type JikanManga = {
  mal_id: number;
  title: string;
  title_english?: string | null;
  title_synonyms?: string[];
  type?: string | null;
  chapters?: number | null;
  volumes?: number | null;
  score?: number | null;
  published?: { prop?: { from?: { year?: number | null } } };
  images?: { jpg?: { image_url?: string | null; large_image_url?: string | null } };
  genres?: { name: string }[];
  themes?: { name: string }[];
  demographics?: { name: string }[];
};

type TitleRow = {
  id: string;
  kind: string;
  title: string;
  year: number;
  episodes: number;
  seasons: number;
  format: string | null;
  genres: string[];
  cover: string | null;
  score: number | null;
  searchText: string;
};

function mapGenres(m: JikanManga): string[] {
  const tags = [
    ...(m.genres ?? []),
    ...(m.themes ?? []),
    ...(m.demographics ?? []),
  ].map((t) => t.name);
  const out: string[] = [];
  for (const t of tags) {
    const g = GENRE_MAP[t.toLowerCase()];
    if (g && !out.includes(g)) out.push(g);
    if (out.length >= 4) break;
  }
  return out;
}

function toRow(m: JikanManga): TitleRow {
  const synonyms = [m.title_english, ...(m.title_synonyms ?? [])].filter(Boolean) as string[];
  const searchText = [m.title, ...synonyms].join(" ").toLowerCase().slice(0, 2000);
  const rawType = (m.type ?? "").trim();
  return {
    id: "mga:" + m.mal_id,
    kind: "manga",
    title: m.title,
    year: m.published?.prop?.from?.year ?? 0,
    episodes: m.chapters ?? 0, // chapters
    seasons: m.volumes ?? 1, // volumes
    format: rawType ? (FORMAT[rawType] ?? rawType) : "Manga",
    genres: mapGenres(m),
    cover: m.images?.jpg?.large_image_url ?? m.images?.jpg?.image_url ?? null,
    // MAL score ×100 as an int (9.12 → 912) — used to surface acclaimed manga
    score: m.score ? Math.round(m.score * 100) : null,
    searchText,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(page: number, attempt = 0): Promise<JikanManga[]> {
  try {
    const res = await fetch(`${JIKAN}?page=${page}`, { headers: { accept: "application/json" } });
    if (res.status === 429) {
      if (attempt >= 5) return [];
      await sleep(1500 * (attempt + 1));
      return fetchPage(page, attempt + 1);
    }
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: JikanManga[] };
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

  console.log(`Fetching ${PAGES} pages (≈${PAGES * PER_PAGE} manga) from Jikan…`);
  const byId = new Map<string, TitleRow>();
  for (let page = 1; page <= PAGES; page++) {
    const data = await fetchPage(page);
    if (data.length === 0) {
      console.log(`  page ${page}: empty/failed — stopping early.`);
      break;
    }
    for (const m of data) {
      const row = toRow(m);
      byId.set(row.id, row);
    }
    if (page % 5 === 0) console.log(`  …${byId.size} manga so far (page ${page}/${PAGES})`);
    await sleep(700); // stay under Jikan's rate limit
  }

  let rows = [...byId.values()];
  if (rows.length === 0) {
    console.warn("No manga fetched from Jikan — seeding the curated fallback list.");
    rows = FALLBACK.map((f, i) => ({
      id: "mga:seed-" + (i + 1),
      kind: "manga",
      title: f.title,
      year: f.year,
      episodes: f.chapters,
      seasons: 1,
      format: f.format,
      genres: f.genres,
      cover: null,
      score: null,
      searchText: f.title.toLowerCase(),
    }));
  }

  const client = postgres(url, { prepare: false });
  const db = drizzle(client, { schema, casing: "snake_case" });

  // make sure the discriminator column + helpful index exist (idempotent)
  await db.execute(sql`alter table titles add column if not exists kind text not null default 'anime'`);
  await db.execute(sql`create index if not exists titles_kind_idx on titles(kind)`);

  const BATCH = 500;
  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await db
      .insert(schema.titles)
      .values(batch)
      .onConflictDoUpdate({
        target: schema.titles.id,
        set: {
          kind: sql`excluded.kind`,
          title: sql`excluded.title`,
          year: sql`excluded.year`,
          episodes: sql`excluded.episodes`,
          seasons: sql`excluded.seasons`,
          format: sql`excluded.format`,
          genres: sql`excluded.genres`,
          cover: sql`excluded.cover`,
          score: sql`excluded.score`,
          searchText: sql`excluded.search_text`,
        },
      });
    done += batch.length;
    console.log(`  …inserted ${done}/${rows.length}`);
  }

  console.log(`✓ Imported ${rows.length} manga into the catalog (kind='manga').`);
  await client.end();
}

// Small curated fallback so the import always produces something usable even if
// Jikan is unreachable. Facts only.
const FALLBACK: { title: string; year: number; chapters: number; format: string; genres: string[] }[] = [
  { title: "Berserk", year: 1989, chapters: 374, format: "Manga", genres: ["Action", "Fantasy", "Horror", "Drama"] },
  { title: "Vagabond", year: 1998, chapters: 327, format: "Manga", genres: ["Action", "Historical", "Drama"] },
  { title: "Vinland Saga", year: 2005, chapters: 210, format: "Manga", genres: ["Action", "Adventure", "Historical", "Drama"] },
  { title: "One Piece", year: 1997, chapters: 1100, format: "Manga", genres: ["Action", "Adventure", "Comedy", "Fantasy"] },
  { title: "Monster", year: 1994, chapters: 162, format: "Manga", genres: ["Mystery", "Drama", "Psychological", "Thriller"] },
  { title: "20th Century Boys", year: 1999, chapters: 249, format: "Manga", genres: ["Mystery", "Drama", "Sci-Fi", "Thriller"] },
  { title: "Oyasumi Punpun", year: 2007, chapters: 147, format: "Manga", genres: ["Drama", "Slice of Life", "Psychological"] },
  { title: "Mushishi", year: 1999, chapters: 50, format: "Manga", genres: ["Supernatural", "Slice of Life", "Mystery"] },
  { title: "Witch Hat Atelier", year: 2016, chapters: 78, format: "Manga", genres: ["Fantasy", "Adventure"] },
  { title: "Blame!", year: 1998, chapters: 65, format: "Manga", genres: ["Sci-Fi", "Action", "Mystery"] },
  { title: "Dorohedoro", year: 2000, chapters: 167, format: "Manga", genres: ["Action", "Comedy", "Fantasy", "Horror"] },
  { title: "Land of the Lustrous", year: 2012, chapters: 108, format: "Manga", genres: ["Fantasy", "Action", "Drama"] },
  { title: "A Silent Voice", year: 2013, chapters: 62, format: "Manga", genres: ["Drama", "Romance", "School"] },
  { title: "Solo Leveling", year: 2018, chapters: 179, format: "Manhwa", genres: ["Action", "Fantasy", "Adventure"] },
  { title: "Chainsaw Man", year: 2018, chapters: 180, format: "Manga", genres: ["Action", "Horror", "Supernatural"] },
  { title: "Jujutsu Kaisen", year: 2018, chapters: 270, format: "Manga", genres: ["Action", "Supernatural", "Horror"] },
];

main().catch((e) => { console.error(e); process.exit(1); });
