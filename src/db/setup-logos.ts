import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Adds titles.logo (transparent title-logo PNG, shown as the hero title).
// Idempotent.  Run:  npm run db:setup-logos
async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set."); process.exit(1); }
  const sql = postgres(url, { prepare: false });

  await sql`alter table titles add column if not exists logo text`;

  console.log("✓ titles.logo column ready. Now run: npm run db:enrich-logos");
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
