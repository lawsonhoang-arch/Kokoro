import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Creates the event_banners table (idempotent). No seed — the banner area stays
// empty until you create one in the /events editor.
//   npm run db:setup-banners

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set."); process.exit(1); }
  const sql = postgres(url, { prepare: false });

  await sql`
    create table if not exists event_banners (
      id uuid primary key default gen_random_uuid(),
      title text not null,
      subtitle text not null default '',
      cta_label text not null default '',
      cta_href text,
      image text,
      accent text,
      active boolean not null default false,
      starts_at timestamp,
      ends_at timestamp,
      position integer not null default 0,
      author_id uuid references users(id) on delete set null,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now()
    )
  `;
  await sql`create index if not exists event_banners_active_idx on event_banners(active)`;
  // source discriminator (added later; idempotent for existing tables)
  await sql`alter table event_banners add column if not exists source text not null default 'manual'`;

  console.log("✓ event_banners table ready.");
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
