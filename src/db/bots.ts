import { config } from "dotenv";
config({ path: ".env.local" });
config();

import postgres from "postgres";

/**
 * Bot-account triage.
 *
 * READ-ONLY by default: prints every account with its activity signals so you
 * can eyeball which ones are bots BEFORE anything is removed.
 *
 *   npm run db:bots -- --shapes                      # START HERE: every handle
 *                                                    # family + counts, so no
 *                                                    # bot pattern is missed
 *   npm run db:bots                                  # report, newest first
 *   npm run db:bots -- --auto-handles                # the signup-bot handle pattern
 *   npm run db:bots -- --auto-handles --delete --yes # remove them (IRREVERSIBLE)
 *   npm run db:bots -- --empty                       # only zero-activity accounts
 *   npm run db:bots -- --pattern='^[a-z]{2}\d{12}$'  # custom handle regex
 *   npm run db:bots -- --since=2026-07-01            # created on/after a date
 *   npm run db:bots -- --ids=<uuid>,<uuid> --delete --yes
 *
 * Filters combine (AND), so `--auto-handles --empty` is the safest sweep: bot
 * handles that also have zero activity.
 *
 * Deleting a user cascades their personal rows (lists, entries, notes, posts,
 * replies, follows, favourites, notifications…) and nulls the author on things
 * kept for everyone (description submissions, editorial picks, news stories).
 * Accounts whose role isn't "user" (moderator/admin) are never deleted.
 */
const sql = postgres((process.env.DIRECT_URL ?? process.env.DATABASE_URL)!, { prepare: false, max: 1 });

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const valOf = (f: string) => {
  const a = args.find((x) => x.startsWith(f + "="));
  return a ? a.slice(f.length + 1) : null;
};

const onlyEmpty = has("--empty");
const doDelete = has("--delete");
const confirmed = has("--yes");
const since = valOf("--since");
const idsCsv = valOf("--ids");
const ids = idsCsv ? idsCsv.split(",").map((s) => s.trim()).filter(Boolean) : null;

/**
 * The observed signup-bot signature: the handle is derived from the email's
 * local part (see generateUniqueUsername), and these all arrived as two
 * lowercase letters + a 12-digit timestamp — e.g. ld178127304878,
 * ml178127116640, pm178123373500. Real handles don't look like that.
 * `--auto-handles` selects exactly those; `--pattern=<regex>` overrides it.
 */
const AUTO_HANDLE_RE = /^[a-z]{1,4}\d{8,}$/;
const patternRaw = valOf("--pattern");
const pattern = patternRaw ? new RegExp(patternRaw) : has("--auto-handles") ? AUTO_HANDLE_RE : null;
const showShapes = has("--shapes");

/** Collapse a handle to its shape: letters → a, digits → #. Makes generated
 *  families obvious (e.g. every bot below is "aa############"). */
const shapeOf = (s: string) => s.replace(/[a-z]/gi, "a").replace(/\d/g, "#");

type Row = {
  id: string;
  username: string;
  email: string;
  role: string;
  created_at: Date;
  verified: boolean;
  lists: number;
  titles: number;
  notes: number;
  posts: number;
  replies: number;
  following: number;
  favorites: number;
};

const activityOf = (r: Row) =>
  r.lists + r.titles + r.notes + r.posts + r.replies + r.following + r.favorites;

async function main() {
  const rows = (await sql`
    select u.id, u.username, u.email, u.role, u.created_at,
           (u.email_verified is not null) as verified,
           (select count(*) from watchlists w where w.user_id = u.id)::int as lists,
           (select count(*) from watchlist_entries e
              join watchlists w on w.id = e.watchlist_id
            where w.user_id = u.id)::int as titles,
           (select count(*) from journal_entries j where j.user_id = u.id)::int as notes,
           (select count(*) from community_posts p where p.user_id = u.id)::int as posts,
           (select count(*) from community_replies r where r.user_id = u.id)::int as replies,
           (select count(*) from follows f where f.follower_id = u.id)::int as following,
           (select count(*) from favorites fa where fa.user_id = u.id)::int as favorites
    from users u
    order by u.created_at desc
  `) as unknown as Row[];

  // Discovery mode: group every handle by its shape so all generated families
  // show up at once (then target them with --pattern / --auto-handles).
  if (showShapes) {
    const byShape = new Map<string, Row[]>();
    for (const r of rows) {
      const k = shapeOf(r.username);
      (byShape.get(k) ?? byShape.set(k, []).get(k)!).push(r);
    }
    const sorted = [...byShape.entries()].sort((a, b) => b[1].length - a[1].length);
    console.log(`\n${rows.length} account(s) · ${sorted.length} distinct handle shape(s)\n`);
    console.log(["count", "zero-activity", "shape", "examples"].join("\t"));
    for (const [shape, list] of sorted) {
      const dead = list.filter((r) => activityOf(r) === 0).length;
      console.log(
        [list.length, dead, shape, list.slice(0, 3).map((r) => r.username).join(", ")].join("\t"),
      );
    }
    console.log("\npick a family with:  --pattern='^[a-z]{2}\\d{12}$'   (or --auto-handles)\n");
    await sql.end();
    return;
  }

  let picked = rows;
  if (ids) picked = picked.filter((r) => ids.includes(r.id));
  if (pattern) picked = picked.filter((r) => pattern.test(r.username));
  if (onlyEmpty) picked = picked.filter((r) => activityOf(r) === 0);
  if (since) picked = picked.filter((r) => r.created_at >= new Date(since));

  // staff accounts are never removal candidates
  const staff = picked.filter((r) => r.role !== "user");
  picked = picked.filter((r) => r.role === "user");

  console.log(`\n${rows.length} account(s) total · ${picked.length} selected\n`);
  const cols = ["created", "username", "email", "vfd", "lists", "titles", "notes", "posts", "repl", "foll", "favs", "id"];
  console.log(cols.join("\t"));
  for (const r of picked) {
    console.log(
      [
        r.created_at.toISOString().slice(0, 16).replace("T", " "),
        r.username,
        r.email,
        r.verified ? "y" : "n",
        r.lists, r.titles, r.notes, r.posts, r.replies, r.following, r.favorites,
        r.id,
      ].join("\t"),
    );
  }
  if (staff.length) {
    console.log(`\nskipped ${staff.length} staff account(s): ${staff.map((r) => r.username).join(", ")}`);
  }

  if (!doDelete) {
    console.log("\n(read-only report — nothing was deleted)");
    console.log("to remove exactly the accounts listed above, re-run the same command with:  --delete --yes\n");
    await sql.end();
    return;
  }
  if (!confirmed) {
    console.log("\nrefusing to delete without --yes — this is irreversible. Add --yes to confirm.\n");
    await sql.end();
    return;
  }
  if (picked.length === 0) {
    console.log("\nnothing to delete\n");
    await sql.end();
    return;
  }

  const res = await sql`delete from users where id in ${sql(picked.map((r) => r.id))}`;
  console.log(`\ndeleted ${res.count} account(s)\n`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
