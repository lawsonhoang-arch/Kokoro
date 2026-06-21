import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

// Creates the community tables (posts + likes + replies) if they don't exist.
// Structural only — it does NOT seed any posts, so the feed starts empty and
// fills with real user activity. Mirrors the other db:setup-* scripts.
//
//   npm run db:setup-community            # ensure the tables exist
//   npm run db:setup-community -- --clear # also wipe every post/like/reply
const sql = postgres((process.env.DIRECT_URL ?? process.env.DATABASE_URL)!, { prepare: false, max: 1 });

async function main() {
  await sql`
    create table if not exists community_posts (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      title_id text references titles(id) on delete cascade,
      kind text not null default 'discussion',
      episode text not null default '',
      heading text not null default '',
      body text not null default '',
      rating integer,
      spoiler boolean not null default false,
      like_count integer not null default 0,
      reply_count integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`;
  await sql`create index if not exists community_posts_title_idx on community_posts(title_id)`;
  await sql`create index if not exists community_posts_created_idx on community_posts(created_at)`;

  // review rating fields (added after the table's first version) — mirror the journal model
  await sql`alter table community_posts add column if not exists rate_mode text not null default 'glyphs'`;
  await sql`alter table community_posts add column if not exists feeling text`;
  await sql`alter table community_posts add column if not exists symbol jsonb`;
  await sql`alter table community_posts add column if not exists dims jsonb not null default '{"story":0,"art":0,"music":0,"pacing":0}'::jsonb`;

  // scale indexes — back every WHERE/ORDER BY the feeds use so they stay
  // index scans (not full sorts) as the table grows into the millions.
  await sql`create index if not exists community_posts_title_created_idx on community_posts(title_id, created_at desc)`;
  await sql`create index if not exists community_posts_kind_created_idx on community_posts(kind, created_at desc)`;
  await sql`create index if not exists community_posts_like_idx on community_posts(like_count desc, created_at desc)`;
  await sql`create index if not exists community_posts_reply_idx on community_posts(reply_count desc, created_at desc)`;
  await sql`create index if not exists community_posts_user_created_idx on community_posts(user_id, created_at desc)`;
  await sql`create index if not exists community_replies_post_created_idx on community_replies(post_id, created_at)`;

  await sql`
    create table if not exists community_likes (
      post_id uuid not null references community_posts(id) on delete cascade,
      user_id uuid not null references users(id) on delete cascade,
      primary key (post_id, user_id)
    )`;

  await sql`
    create table if not exists community_replies (
      id uuid primary key default gen_random_uuid(),
      post_id uuid not null references community_posts(id) on delete cascade,
      user_id uuid not null references users(id) on delete cascade,
      body text not null default '',
      created_at timestamptz not null default now()
    )`;
  await sql`create index if not exists community_replies_post_idx on community_replies(post_id)`;

  console.log("community tables ready.");

  if (process.argv.includes("--clear")) {
    // replies/likes cascade from the post delete
    const deleted = await sql`delete from community_posts returning id`;
    console.log(`cleared ${deleted.length} community posts (and their likes/replies).`);
  }

  // dev/test only: seed N posts on the first "frieren" match to exercise feed
  // pagination (the rate limit blocks creating this many through the UI).
  const seedIdx = process.argv.indexOf("--seed-test");
  if (seedIdx !== -1) {
    const n = parseInt(process.argv[seedIdx + 1] ?? "25", 10) || 25;
    const [author] = await sql`select id from users order by created_at limit 1`;
    const [title] = await sql`
      select id from titles
      where lower(coalesce(english_title, title)) like '%frieren%' order by coalesce(popularity,0) desc nulls last limit 1`;
    if (author && title) {
      const now = Date.now();
      for (let i = 0; i < n; i++) {
        const at = new Date(now - i * 60000); // 1 min apart so ordering is stable
        await sql`
          insert into community_posts (user_id, title_id, kind, heading, body, created_at, updated_at)
          values (${author.id}, ${title.id}, 'discussion', ${"Seed post #" + (n - i)}, ${"pagination test body " + (n - i)}, ${at}, ${at})`;
      }
      console.log(`seeded ${n} test posts on title ${title.id}.`);
    } else {
      console.log("seed-test skipped (no user or no frieren title).");
    }
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
