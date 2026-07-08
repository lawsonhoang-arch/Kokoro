import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { rewatches } from "@/db/schema";

/** How many times a user has logged a rewatch/reread of a title. 0 if the table
 *  isn't set up yet (before `db:setup-rewatches`). */
export async function getRewatchCount(userId: string, titleId: string): Promise<number> {
  try {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(rewatches)
      .where(and(eq(rewatches.userId, userId), eq(rewatches.titleId, titleId)));
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

/** Log one more rewatch/reread pass. Returns the new count. Degrades without
 *  throwing if the table isn't set up yet (run `db:setup-rewatches`) — the count
 *  simply won't advance. */
export async function logRewatch(userId: string, titleId: string, note = ""): Promise<number> {
  try {
    await db.insert(rewatches).values({ userId, titleId, note: note.slice(0, 280) });
  } catch {
    /* table absent / FK — no-op, count stays put */
  }
  return getRewatchCount(userId, titleId);
}

/** Remove the most recent rewatch pass (undo). Returns the new count. Never throws. */
export async function undoRewatch(userId: string, titleId: string): Promise<number> {
  try {
    const [last] = await db
      .select({ id: rewatches.id })
      .from(rewatches)
      .where(and(eq(rewatches.userId, userId), eq(rewatches.titleId, titleId)))
      .orderBy(desc(rewatches.createdAt))
      .limit(1);
    if (last) await db.delete(rewatches).where(eq(rewatches.id, last.id));
  } catch {
    /* table absent — no-op */
  }
  return getRewatchCount(userId, titleId);
}

/** Total rewatch passes a user has logged across every title (for profile stats).
 *  0 if the table is absent. */
export async function getRewatchTotal(userId: string): Promise<number> {
  try {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(rewatches)
      .where(eq(rewatches.userId, userId));
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}
