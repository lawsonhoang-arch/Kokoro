import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Creates the newsroom-admin tables — `uploads` (admin-uploaded images, e.g.
// news covers, stored inline as bytea and served at /api/uploads/[id]) and
// `news_overrides` (hide / cover overrides for the live RSS feed). Idempotent —
// mirrors the other db:setup-* scripts. Run: `npm run db:setup-uploads`.
const sql = postgres((process.env.DIRECT_URL ?? process.env.DATABASE_URL)!, { prepare: false, max: 1 });

async function main() {
  await sql`
    create table if not exists uploads (
      id uuid primary key default gen_random_uuid(),
      mime text not null,
      bytes bytea not null,
      size integer not null,
      author_id uuid references users(id) on delete set null,
      created_at timestamptz not null default now()
    )`;
  await sql`
    create table if not exists news_overrides (
      news_id text primary key,
      hidden boolean not null default false,
      cover text,
      updated_at timestamptz not null default now()
    )`;
  console.log("uploads + news_overrides tables ready.");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
