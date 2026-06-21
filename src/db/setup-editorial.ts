import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Creates the editorial_picks table (idempotent) and seeds the three default
// Home-page picks if the table is empty. Safe to re-run.
//   npm run db:setup-editorial

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL not set."); process.exit(1); }
  const sql = postgres(url, { prepare: false });

  await sql`
    create table if not exists editorial_picks (
      id uuid primary key default gen_random_uuid(),
      kicker text not null default '',
      title text not null,
      excerpt text not null default '',
      hue integer not null default 1,
      avatar_hue integer not null default 2,
      byline text not null default '',
      href text,
      cover text,
      position integer not null default 0,
      published boolean not null default true,
      author_id uuid references users(id) on delete set null,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now()
    )
  `;
  await sql`create index if not exists editorial_position_idx on editorial_picks(position)`;

  const [{ count }] = await sql`select count(*)::int as count from editorial_picks`;
  if (count > 0) {
    console.log(`✓ editorial_picks ready (${count} existing rows; left untouched).`);
    await sql.end();
    return;
  }

  const seed = [
    {
      hue: 1, kicker: "Genre · Fantasy", avatar_hue: 2, byline: "By the Editors · 8 min read",
      title: "Quiet magic — the new wave of low-stakes fantasy.",
      excerpt: "What happens when the stakes get smaller, the worlds get warmer, and the conflicts move inward. Six titles to start.",
    },
    {
      hue: 2, kicker: "Spotlight · Studio", avatar_hue: 4, byline: "By the Editors · 12 min read",
      title: "Where the studio's quiet experiments became their loudest hits.",
      excerpt: "Ten years of small wagers and the shape of a house style — from one-shot OVAs to last year's prestige projects.",
    },
    {
      hue: 3, kicker: "Watch club · This month", avatar_hue: 5, byline: "Curated by Mio · 412 members",
      title: "Watching it again, slowly, together.",
      excerpt: "Our community pick is a quiet 2003 series most people watched alone. We're rewatching one episode a week, with notes.",
    },
  ];

  for (let i = 0; i < seed.length; i++) {
    const s = seed[i];
    await sql`
      insert into editorial_picks (kicker, title, excerpt, hue, avatar_hue, byline, position)
      values (${s.kicker}, ${s.title}, ${s.excerpt}, ${s.hue}, ${s.avatar_hue}, ${s.byline}, ${i})
    `;
  }

  console.log(`✓ Created editorial_picks and seeded ${seed.length} default picks.`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
