import "server-only";
import { and, asc, eq, notInArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { groups, watchlists, watchlistEntries } from "@/db/schema";
import { emptyRules, type Group } from "@/features/watchlist/types";

async function ownsWatchlist(userId: string, watchlistId: string): Promise<boolean> {
  const r = await db
    .select({ id: watchlists.id })
    .from(watchlists)
    .where(and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId)))
    .limit(1);
  return r.length > 0;
}

/** All collections (tabs) in a watchlist the user owns, each with its member
 *  entry ids. Scoped rules aren't persisted, so they come back empty. */
export async function getGroups(userId: string, watchlistId: string): Promise<Group[]> {
  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      parentId: groups.parentId,
      position: groups.position,
    })
    .from(groups)
    .innerJoin(watchlists, eq(groups.watchlistId, watchlists.id))
    .where(and(eq(groups.watchlistId, watchlistId), eq(watchlists.userId, userId)))
    .orderBy(asc(groups.position));
  if (!rows.length) return [];

  // member entries, in their list order, grouped by group_id
  const members = await db
    .select({ id: watchlistEntries.id, groupId: watchlistEntries.groupId })
    .from(watchlistEntries)
    .where(eq(watchlistEntries.watchlistId, watchlistId))
    .orderBy(asc(watchlistEntries.position));
  const byGroup: Record<string, string[]> = {};
  for (const m of members) if (m.groupId) (byGroup[m.groupId] ||= []).push(m.id);

  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    parentId: g.parentId,
    entryIds: byGroup[g.id] || [],
    scoped: emptyRules(),
  }));
}

export type GroupInput = {
  id: string;
  name: string;
  parentId: string | null;
  position: number;
  entryIds: string[];
};

/** Reconcile the persisted collections of a watchlist to the given client state:
 *  upsert the listed groups, drop any others, and rewrite entry membership.
 *  Local state is the source of truth (mirrors the rest of the watchlist app). */
export async function syncGroups(
  userId: string,
  watchlistId: string,
  input: GroupInput[],
): Promise<void> {
  if (!(await ownsWatchlist(userId, watchlistId))) return;

  const ids = input.map((g) => g.id);

  // 1. drop groups that no longer exist client-side (entries' group_id is set
  //    null by the FK, then re-assigned below).
  await db
    .delete(groups)
    .where(
      ids.length
        ? and(eq(groups.watchlistId, watchlistId), notInArray(groups.id, ids))
        : eq(groups.watchlistId, watchlistId),
    );

  // 2. upsert in two passes so a child never references a not-yet-inserted
  //    parent: first the rows (parent_id null), then the parent links.
  for (const g of input) {
    await db
      .insert(groups)
      .values({ id: g.id, watchlistId, name: g.name, parentId: null, position: g.position })
      .onConflictDoUpdate({ target: groups.id, set: { name: g.name, position: g.position, parentId: null } });
  }
  for (const g of input) {
    if (g.parentId) {
      await db.update(groups).set({ parentId: g.parentId }).where(eq(groups.id, g.id));
    }
  }

  // 3. rewrite membership: clear every entry's group, then assign the listed
  //    ones from a single jsonb mapping (a JS array would expand to a tuple).
  await db
    .update(watchlistEntries)
    .set({ groupId: null })
    .where(eq(watchlistEntries.watchlistId, watchlistId));

  const pairs = input.flatMap((g) => g.entryIds.map((eid) => ({ eid, gid: g.id })));
  if (pairs.length) {
    await db.execute(sql`
      update watchlist_entries as w
      set group_id = m.gid::uuid
      from (
        select e->>'eid' as eid, e->>'gid' as gid
        from jsonb_array_elements(${JSON.stringify(pairs)}::jsonb) as e
      ) as m
      where w.id = m.eid::uuid and w.watchlist_id = ${watchlistId}::uuid
    `);
  }
}
