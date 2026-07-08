import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Creates the calendar tables (curated events/premieres + per-user tracking).
// Idempotent — mirrors the other db:setup-* scripts. Run: `npm run db:setup-calendar`.
const sql = postgres((process.env.DIRECT_URL ?? process.env.DATABASE_URL)!, { prepare: false, max: 1 });

async function main() {
  await sql`
    create table if not exists calendar_events (
      id uuid primary key default gen_random_uuid(),
      kind text not null default 'event',
      title text not null,
      subtitle text not null default '',
      starts_on text not null,
      ends_on text,
      location text not null default '',
      url text,
      cover text,
      accent text,
      title_id text references titles(id) on delete set null,
      hue integer not null default 1,
      position integer not null default 0,
      published boolean not null default true,
      author_id uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`;
  await sql`create index if not exists calendar_events_start_idx on calendar_events(starts_on)`;

  await sql`
    create table if not exists calendar_tracks (
      user_id uuid not null references users(id) on delete cascade,
      title_id text not null references titles(id) on delete cascade,
      mal_id integer,
      weekday integer,
      time text,
      created_at timestamptz not null default now(),
      primary key (user_id, title_id)
    )`;

  console.log("calendar tables ready.");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
