import "server-only";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { groups, rules, watchlists } from "@/db/schema";

/**
 * The parts of a list that follow you between devices: RULES (global + scoped)
 * and BOOKMARKED TABS. Card sizing / layout / display deliberately stay in
 * localStorage — those are per-device.
 *
 * Everything here degrades to a no-op / empty result if the columns aren't
 * migrated in yet, so the list keeps working before `db:setup-list-sync` runs.
 */

export type RuleCat = "group" | "sort" | "color" | "tag";
export type Rules = Record<RuleCat, string[]>;

const CATS: RuleCat[] = ["group", "sort", "color", "tag"];
const empty = (): Rules => ({ group: [], sort: [], color: [], tag: [] });

async function owns(userId: string, watchlistId: string): Promise<boolean> {
  const [w] = await db
    .select({ id: watchlists.id })
    .from(watchlists)
    .where(and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId)))
    .limit(1);
  return !!w;
}

/** Global rules (group_id null) + per-collection scoped rules. */
export async function getRules(
  userId: string,
  watchlistId: string,
): Promise<{ globals: Rules; scoped: Record<string, Rules> }> {
  try {
    if (!(await owns(userId, watchlistId))) return { globals: empty(), scoped: {} };
    const rows = await db
      .select()
      .from(rules)
      .where(eq(rules.watchlistId, watchlistId))
      .orderBy(rules.position);
    const globals = empty();
    const scoped: Record<string, Rules> = {};
    for (const r of rows) {
      const cat = r.category as RuleCat;
      if (!CATS.includes(cat)) continue;
      if (r.groupId) {
        (scoped[r.groupId] ??= empty())[cat].push(r.ruleKey);
      } else {
        globals[cat].push(r.ruleKey);
      }
    }
    return { globals, scoped };
  } catch {
    return { globals: empty(), scoped: {} };
  }
}

/** Replace every rule for the list with the client's current state. Scoped rules
 *  for collections that no longer exist are dropped (their FK would fail). */
export async function syncRules(
  userId: string,
  watchlistId: string,
  globals: Rules,
  scoped: Record<string, Rules>,
): Promise<void> {
  try {
    if (!(await owns(userId, watchlistId))) return;

    const scopedIds = Object.keys(scoped);
    const liveIds = new Set<string>();
    if (scopedIds.length) {
      const live = await db
        .select({ id: groups.id })
        .from(groups)
        .where(and(eq(groups.watchlistId, watchlistId), inArray(groups.id, scopedIds)));
      for (const g of live) liveIds.add(g.id);
    }

    const values: {
      watchlistId: string;
      groupId: string | null;
      category: string;
      ruleKey: string;
      position: number;
    }[] = [];
    for (const cat of CATS) {
      (globals?.[cat] ?? []).forEach((k, i) =>
        values.push({ watchlistId, groupId: null, category: cat, ruleKey: k, position: i }),
      );
    }
    for (const [gid, r] of Object.entries(scoped)) {
      if (!liveIds.has(gid)) continue;
      for (const cat of CATS) {
        (r?.[cat] ?? []).forEach((k, i) =>
          values.push({ watchlistId, groupId: gid, category: cat, ruleKey: k, position: i }),
        );
      }
    }

    await db.delete(rules).where(eq(rules.watchlistId, watchlistId));
    if (values.length) await db.insert(rules).values(values);
  } catch {
    /* pre-migration — keep the UI working, just don't persist */
  }
}

/** The bookmarked tab strip (ordered tab keys) + the Board tab's label. */
export async function getTabs(
  userId: string,
  watchlistId: string,
): Promise<{ tabOrder: string[] | null; boardName: string | null }> {
  try {
    const [w] = await db
      .select({ tabOrder: watchlists.tabOrder, boardName: watchlists.boardName })
      .from(watchlists)
      .where(and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId)))
      .limit(1);
    return { tabOrder: w?.tabOrder ?? null, boardName: w?.boardName ?? null };
  } catch {
    return { tabOrder: null, boardName: null };
  }
}

export async function syncTabs(
  userId: string,
  watchlistId: string,
  tabOrder: string[],
  boardName: string,
): Promise<void> {
  try {
    await db
      .update(watchlists)
      .set({ tabOrder, boardName })
      .where(and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId)));
  } catch {
    /* pre-migration */
  }
}
