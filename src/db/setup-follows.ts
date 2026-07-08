import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Creates the `follows` table (directed social graph — who follows whom).
// Idempotent — mirrors the other db:setup-* scripts. Run: `npm run db:setup-follows`.
const sql = postgres((process.env.DIRECT_URL ?? process.env.DATABASE_URL)!, { prepare: false, max: 1 });

async function main() {
  await sql`
    create table if not exists follows (
      follower_id uuid not null references users(id) on delete cascade,
      following_id uuid not null references users(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (follower_id, following_id)
    )`;
  await sql`create index if not exists follows_following_idx on follows (following_id)`;
  console.log("follows table ready.");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
