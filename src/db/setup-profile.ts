import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Adds the profile `bio` column to users if it doesn't exist. Idempotent —
// mirrors the other db:setup-* scripts. Run: `npm run db:setup-profile`.
const sql = postgres((process.env.DIRECT_URL ?? process.env.DATABASE_URL)!, { prepare: false, max: 1 });

async function main() {
  await sql`alter table users add column if not exists bio text not null default ''`;
  await sql`alter table users add column if not exists banner_title_id text`;
  await sql`alter table users add column if not exists banner_pos text`;
  console.log("users.bio + users.banner_title_id + users.banner_pos ready.");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
