import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Adds users.onboarded_at (first-run onboarding flag). Idempotent. Existing
// accounts are backfilled to now() so only brand-new sign-ups see the flow.
const sql = postgres((process.env.DIRECT_URL ?? process.env.DATABASE_URL)!, { prepare: false, max: 1 });

async function main() {
  await sql`alter table users add column if not exists onboarded_at timestamptz`;
  const res = await sql`update users set onboarded_at = now() where onboarded_at is null`;
  console.log(`onboarded_at ready — backfilled ${res.count} existing user(s).`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
