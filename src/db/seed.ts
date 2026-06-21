import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { LIBRARY } from "../features/watchlist/data";

// Seeds the shared anime catalog (titles) from the mock LIBRARY.
// Run with:  npm run db:seed   (after db:push / db:migrate)
async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set — add it to .env.local first.");
    process.exit(1);
  }
  const client = postgres(url, { prepare: false });
  const db = drizzle(client, { schema, casing: "snake_case" });

  const rows = LIBRARY.map((e) => ({
    id: e.id,
    title: e.title,
    year: e.year,
    genres: e.genres,
    episodes: e.episodes,
    seasons: e.seasons,
  }));

  await db.insert(schema.titles).values(rows).onConflictDoNothing();
  console.log(`✓ Seeded ${rows.length} titles.`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
