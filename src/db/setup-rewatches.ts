import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Creates the rewatches table (one row per rewatch / reread pass). Idempotent.
const sql = postgres((process.env.DIRECT_URL ?? process.env.DATABASE_URL)!, { prepare: false, max: 1 });

async function main() {
  await sql`
    create table if not exists rewatches (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      title_id text not null references titles(id) on delete cascade,
      note text not null default '',
      created_at timestamptz not null default now()
    )`;
  await sql`create index if not exists rewatches_user_title_idx on rewatches(user_id, title_id)`;
  console.log("rewatches table ready.");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
