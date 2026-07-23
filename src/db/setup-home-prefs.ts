import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Adds users.home_focus (text[]) — the focus areas chosen in onboarding that
// order the Home shelves and pick which show on mobile. Idempotent. null/[] for
// existing users means "default order", so no backfill is needed.
const sql = postgres((process.env.DIRECT_URL ?? process.env.DATABASE_URL)!, { prepare: false, max: 1 });

async function main() {
  await sql`alter table users add column if not exists home_focus text[]`;
  console.log("home_focus ready.");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
