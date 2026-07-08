import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Creates the entity_follows table (follow studios / people / characters from
// MAL). Idempotent.
const sql = postgres((process.env.DIRECT_URL ?? process.env.DATABASE_URL)!, { prepare: false, max: 1 });

async function main() {
  await sql`
    create table if not exists entity_follows (
      user_id uuid not null references users(id) on delete cascade,
      kind text not null,
      entity_id text not null,
      name text not null,
      image text,
      subtitle text not null default '',
      created_at timestamptz not null default now(),
      primary key (user_id, kind, entity_id)
    )`;
  await sql`create index if not exists entity_follows_user_idx on entity_follows(user_id)`;
  console.log("entity_follows table ready.");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
