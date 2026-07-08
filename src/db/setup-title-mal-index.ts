import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Indexes titles.mal_id so the entity pages (studio / person / character) can map
// Jikan works back to our catalog without seq-scanning ~43k rows. Idempotent.
// Built CONCURRENTLY so it doesn't lock the table on a live DB.
const sql = postgres((process.env.DIRECT_URL ?? process.env.DATABASE_URL)!, { prepare: false, max: 1 });

async function main() {
  await sql`create index concurrently if not exists titles_mal_idx on titles(mal_id)`;
  console.log("titles_mal_idx ready.");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
