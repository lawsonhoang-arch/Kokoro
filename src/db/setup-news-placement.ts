import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Adds newsroom "placement" controls (idempotent):
//   news_stories.on_home / .layout        — where a mod-authored story appears
//   news_overrides.on_home / .layout      — same, for pulled (RSS) stories
// Safe to run repeatedly; also creates news_overrides if it doesn't exist yet.
const sql = postgres((process.env.DIRECT_URL ?? process.env.DATABASE_URL)!, { prepare: false, max: 1 });

async function main() {
  // news_overrides may not exist yet (normally created by db:setup-uploads)
  await sql`
    create table if not exists news_overrides (
      news_id text primary key,
      hidden boolean not null default false,
      cover text,
      updated_at timestamptz not null default now()
    )`;

  await sql`alter table news_stories add column if not exists on_home boolean not null default true`;
  await sql`alter table news_stories add column if not exists layout text not null default 'card'`;
  await sql`alter table news_overrides add column if not exists on_home boolean`;
  await sql`alter table news_overrides add column if not exists layout text`;
  // pulled stories must be verified by an admin before release
  await sql`alter table news_overrides add column if not exists approved boolean not null default false`;

  // wave state — the released snapshot readers see (incoming pulls replace it on
  // publish, or auto-release 2 days after they first appear)
  await sql`
    create table if not exists news_wave (
      id text primary key,
      live_items jsonb not null default '[]'::jsonb,
      live_at timestamptz not null default now(),
      pending_since timestamptz,
      updated_at timestamptz not null default now()
    )`;

  console.log("newsroom placement + approval + wave tables ready.");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
