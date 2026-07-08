import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { entityFollows } from "@/db/schema";

export type EntityKind = "studio" | "person" | "character";

export type EntityRef = {
  kind: EntityKind;
  entityId: string;
  name: string;
  image: string | null;
  subtitle?: string;
};

export type FollowedEntity = EntityRef & { subtitle: string; createdAt: string };

const key = (kind: string, id: string) => `${kind}:${id}`;

/** Follow / unfollow an external entity. Snapshots its display fields so it can
 *  render without another Jikan call. Degrades without throwing if the table
 *  isn't set up yet (run `db:setup-entity-follows`). */
export async function setEntityFollow(userId: string, ref: EntityRef, follow: boolean): Promise<void> {
  try {
    if (follow) {
      await db
        .insert(entityFollows)
        .values({
          userId,
          kind: ref.kind,
          entityId: ref.entityId,
          name: ref.name.slice(0, 200),
          image: ref.image,
          subtitle: (ref.subtitle ?? "").slice(0, 120),
        })
        .onConflictDoUpdate({
          target: [entityFollows.userId, entityFollows.kind, entityFollows.entityId],
          set: { name: ref.name.slice(0, 200), image: ref.image, subtitle: (ref.subtitle ?? "").slice(0, 120) },
        });
    } else {
      await db
        .delete(entityFollows)
        .where(and(eq(entityFollows.userId, userId), eq(entityFollows.kind, ref.kind), eq(entityFollows.entityId, ref.entityId)));
    }
  } catch {
    /* table absent — no-op until the migration is run */
  }
}

/** Whether the viewer follows one entity. False (never throws) if the table is
 *  absent or there's no viewer. */
export async function isFollowingEntity(userId: string | undefined, kind: EntityKind, entityId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const r = await db
      .select({ id: entityFollows.entityId })
      .from(entityFollows)
      .where(and(eq(entityFollows.userId, userId), eq(entityFollows.kind, kind), eq(entityFollows.entityId, entityId)))
      .limit(1);
    return r.length > 0;
  } catch {
    return false;
  }
}

/** Which of the given (kind:id) refs the viewer already follows — one query, for
 *  a page full of cast/staff cards. Returns a Set of "kind:id". */
export async function followedEntitySet(userId: string | undefined, refs: { kind: EntityKind; entityId: string }[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!userId || refs.length === 0) return out;
  try {
    const ids = [...new Set(refs.map((r) => r.entityId))];
    const rows = await db
      .select({ kind: entityFollows.kind, entityId: entityFollows.entityId })
      .from(entityFollows)
      .where(and(eq(entityFollows.userId, userId), inArray(entityFollows.entityId, ids)));
    for (const r of rows) out.add(key(r.kind, r.entityId));
    return out;
  } catch {
    return out;
  }
}

/** Everything a user follows, newest first. Empty if the table is absent. */
export async function getFollowedEntities(userId: string): Promise<FollowedEntity[]> {
  try {
    const rows = await db
      .select()
      .from(entityFollows)
      .where(eq(entityFollows.userId, userId))
      .orderBy(desc(entityFollows.createdAt));
    return rows.map((r) => ({
      kind: r.kind as EntityKind,
      entityId: r.entityId,
      name: r.name,
      image: r.image,
      subtitle: r.subtitle,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch {
    return [];
  }
}
