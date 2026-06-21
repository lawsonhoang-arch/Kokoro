import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Creates the `favorites` table (hand-picked profile favorites). Idempotent —
// mirrors the other db:setup-* scripts. Run: `npm run db:setup-favorites`.
const sql = postgres((process.env.DIRECT_URL ?? process.env.DATABASE_URL)!, { prepare: false, max: 1 });

async function main() {
  await sql`
    create table if not exists favorites (
      user_id uuid not null references users(id) on delete cascade,
      title_id text not null references titles(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (user_id, title_id)
    )`;
  console.log("favorites table ready.");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
