import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

/**
 * Makes the parts of a list that should follow you between devices durable:
 *
 *   - rules            → the `rules` table (global rules have group_id null,
 *                        scoped rules carry the group they belong to)
 *   - bookmarked tabs  → watchlists.tab_order (the ordered tab keys, e.g.
 *                        ["all", "g:<uuid>", …]) + watchlists.board_name
 *
 * Card sizing / layout / display stay in localStorage on purpose — those are
 * per-device. Idempotent.
 */
const sql = postgres((process.env.DIRECT_URL ?? process.env.DATABASE_URL)!, { prepare: false, max: 1 });

async function main() {
  // rules: may already exist from an early migration; create if it doesn't.
  await sql`
    create table if not exists rules (
      id uuid primary key default gen_random_uuid(),
      watchlist_id uuid not null references watchlists(id) on delete cascade,
      group_id uuid references groups(id) on delete cascade,
      category text not null,
      rule_key text not null,
      position integer not null default 0
    )
  `;
  await sql`create index if not exists rules_watchlist_idx on rules (watchlist_id)`;

  // bookmarked tab strip + the board tab's name
  await sql`alter table watchlists add column if not exists tab_order text[]`;
  await sql`alter table watchlists add column if not exists board_name text`;

  console.log("list sync ready — rules table + watchlists.tab_order/board_name.");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
