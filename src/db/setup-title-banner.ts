import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Adds the `banner` column to titles (wide hero/banner art from AniList).
// Idempotent — mirrors the other db:setup-* scripts. Run: `npm run db:setup-banner`.
const sql = postgres((process.env.DIRECT_URL ?? process.env.DATABASE_URL)!, { prepare: false, max: 1 });

async function main() {
  await sql`alter table titles add column if not exists banner text`;
  console.log("titles.banner column ready.");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
