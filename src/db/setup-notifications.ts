import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Creates the notifications table (bell). Idempotent.
const sql = postgres((process.env.DIRECT_URL ?? process.env.DATABASE_URL)!, { prepare: false, max: 1 });

async function main() {
  await sql`
    create table if not exists notifications (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      actor_id uuid not null references users(id) on delete cascade,
      type text not null,
      key text not null,
      post_id uuid references community_posts(id) on delete cascade,
      title_id text references titles(id) on delete cascade,
      note text not null default '',
      read boolean not null default false,
      created_at timestamptz not null default now()
    )`;
  await sql`create index if not exists notifications_user_idx on notifications(user_id, created_at)`;
  await sql`create unique index if not exists notifications_dedup_idx on notifications(user_id, actor_id, type, key)`;
  console.log("notifications table ready.");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
