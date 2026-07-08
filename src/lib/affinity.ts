import "server-only";
import { eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { watchlists, watchlistEntries } from "@/db/schema";
import { entryScore } from "@/lib/profile";

// One title both users have rated, with each side's 0–5 score.
export type TitleMatch = {
  id: string;
  title: string;
  cover: string | null;
  you: number;
  them: number;
};

export type TasteAffinity = {
  score: number | null; // 0–100 agreement; null until there's enough overlap
  shared: number; // how many titles both have rated
  agreements: TitleMatch[]; // titles you both scored highly
  disagreements: TitleMatch[]; // the biggest gaps
};

// Below this, a single lucky match would swing the number wildly — so we show
// the shared count but hold back the score.
const MIN_SHARED = 3;

type RatedRow = {
  title_id: string;
  feeling: string | null;
  rate_mode: string | null;
  symbol: unknown;
  dims: unknown;
  name: string;
  cover: string | null;
};

/** Every title a user has given a rating, normalised to a 0–5 score (deduped —
 *  first rated entry wins if a title sits in more than one of their lists). */
export async function ratedByUser(userId: string): Promise<Map<string, { score: number; name: string; cover: string | null }>> {
  const res = await db.execute(sql`
    select we.title_id, we.feeling, we.rate_mode, we.symbol, we.dims,
           coalesce(t.english_title, t.title) as name, t.cover
    from watchlist_entries we
    join watchlists w on w.id = we.watchlist_id
    join titles t on t.id = we.title_id
    where w.user_id = ${userId}
  `);
  const rows = res as unknown as RatedRow[];
  const map = new Map<string, { score: number; name: string; cover: string | null }>();
  for (const r of rows) {
    const s = entryScore({ rateMode: r.rate_mode, feeling: r.feeling, symbol: r.symbol, dims: r.dims });
    if (s == null) continue;
    if (!map.has(r.title_id)) map.set(r.title_id, { score: s, name: r.name, cover: r.cover });
  }
  return map;
}

/** How closely two users' ratings agree, over the titles they've both rated.
 *  Returns null when there's no viewer, or it's the viewer's own profile.
 *  Never throws — the profile page must render regardless. */
export async function getTasteAffinity(viewerId: string | undefined, userId: string): Promise<TasteAffinity | null> {
  if (!viewerId || viewerId === userId) return null;
  try {
    const [mine, theirs] = await Promise.all([ratedByUser(viewerId), ratedByUser(userId)]);
    const matches: TitleMatch[] = [];
    let agreementSum = 0;
    for (const [id, a] of mine) {
      const b = theirs.get(id);
      if (!b) continue;
      // scores are 1–5; a full 4-point gap = total disagreement (0), same = 1
      const agree = 1 - Math.min(1, Math.abs(a.score - b.score) / 4);
      agreementSum += agree;
      matches.push({ id, title: a.name, cover: a.cover, you: a.score, them: b.score });
    }
    const shared = matches.length;
    const score = shared >= MIN_SHARED ? Math.round((agreementSum / shared) * 100) : null;
    const agreements = matches
      .filter((m) => m.you >= 4 && m.them >= 4)
      .sort((x, y) => y.you + y.them - (x.you + x.them))
      .slice(0, 4);
    const disagreements = matches
      .filter((m) => Math.abs(m.you - m.them) >= 2)
      .sort((x, y) => Math.abs(y.you - y.them) - Math.abs(x.you - x.them))
      .slice(0, 3);
    return { score, shared, agreements, disagreements };
  } catch {
    return null; // never break the profile page
  }
}

// Just the headline number, for follower/following list rows.
export type MatchLite = { score: number | null; shared: number };

/** Taste match between the viewer and many users at once — two queries total,
 *  so a whole follower list stays cheap. Users with no shared ratings are
 *  omitted from the map. Never throws. */
export async function getTasteAffinityBulk(
  viewerId: string | undefined,
  userIds: string[],
): Promise<Map<string, MatchLite>> {
  const out = new Map<string, MatchLite>();
  const targets = viewerId ? userIds.filter((id) => id !== viewerId) : [];
  if (targets.length === 0) return out;
  try {
    const mine = await ratedByUser(viewerId!);
    if (mine.size === 0) return out;

    const rows = await db
      .select({
        userId: watchlists.userId,
        titleId: watchlistEntries.titleId,
        feeling: watchlistEntries.feeling,
        rateMode: watchlistEntries.rateMode,
        symbol: watchlistEntries.symbol,
        dims: watchlistEntries.dims,
      })
      .from(watchlistEntries)
      .innerJoin(watchlists, eq(watchlists.id, watchlistEntries.watchlistId))
      .where(inArray(watchlists.userId, targets));

    const acc = new Map<string, { agree: number; shared: number }>();
    const seen = new Set<string>(); // dedupe a title that sits in two of a user's lists
    for (const r of rows) {
      const mineHit = mine.get(r.titleId);
      if (!mineHit) continue;
      const s = entryScore({ rateMode: r.rateMode, feeling: r.feeling, symbol: r.symbol, dims: r.dims });
      if (s == null) continue;
      const key = r.userId + ":" + r.titleId;
      if (seen.has(key)) continue;
      seen.add(key);
      const agree = 1 - Math.min(1, Math.abs(mineHit.score - s) / 4);
      const a = acc.get(r.userId) ?? { agree: 0, shared: 0 };
      a.agree += agree;
      a.shared += 1;
      acc.set(r.userId, a);
    }
    for (const [uid, a] of acc) {
      out.set(uid, { score: a.shared >= MIN_SHARED ? Math.round((a.agree / a.shared) * 100) : null, shared: a.shared });
    }
    return out;
  } catch {
    return out;
  }
}
