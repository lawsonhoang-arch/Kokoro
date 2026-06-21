import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Adds the per-episode `watched_eps` column to watchlist_entries if missing.
// Idempotent — mirrors the other db:setup-* scripts. Run: `npm run db:setup-watched`.
const sql = postgres((process.env.DIRECT_URL ?? process.env.DATABASE_URL)!, { prepare: false, max: 1 });

async function main() {
  await sql`alter table watchlist_entries add column if not exists watched_eps integer[] not null default '{}'`;
  console.log("watchlist_entries.watched_eps ready.");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
