import "server-only";
import { and, asc, eq, gte, lte, or, isNull, isNotNull, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { db } from "@/db";
import { calendarEvents, calendarTracks, titles } from "@/db/schema";
import { currentSeason } from "@/lib/search-index";
import { hiResCover } from "@/lib/cover";

export type CalendarEvent = typeof calendarEvents.$inferSelect;

export type EventInput = {
  kind: string; // event | premiere
  title: string;
  subtitle: string;
  startsOn: string; // YYYY-MM-DD
  endsOn: string | null;
  location: string;
  url: string | null;
  cover: string | null;
  accent: string | null;
  titleId: string | null;
  hue: number;
  published: boolean;
};

const ORDER = [asc(calendarEvents.startsOn), asc(calendarEvents.position)] as const;

/** Published events whose span overlaps [from, to] (inclusive), for the calendar.
 *  Date strings sort lexically = chronologically, so plain comparisons work. */
export async function getEventsInRange(from: string, to: string): Promise<CalendarEvent[]> {
  return db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.published, true),
        lte(calendarEvents.startsOn, to),
        // ends on/after `from`; single-day events have endsOn null -> use startsOn
        or(
          and(isNull(calendarEvents.endsOn), gte(calendarEvents.startsOn, from)),
          gte(calendarEvents.endsOn, from),
        ),
      ),
    )
    .orderBy(...ORDER);
}

/** Every event (published or not) for the admin editor. */
export async function getAllEvents(): Promise<CalendarEvent[]> {
  return db.select().from(calendarEvents).orderBy(...ORDER);
}

export async function createEvent(authorId: string, input: EventInput): Promise<string> {
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${calendarEvents.position}), -1) + 1` })
    .from(calendarEvents);
  const [row] = await db
    .insert(calendarEvents)
    .values({ ...input, authorId, position: Number(next) })
    .returning({ id: calendarEvents.id });
  return row.id;
}

export async function updateEvent(id: string, input: EventInput): Promise<void> {
  await db.update(calendarEvents).set({ ...input, updatedAt: new Date() }).where(eq(calendarEvents.id, id));
}

export async function deleteEvent(id: string): Promise<void> {
  await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
}

export async function setEventPublished(id: string, published: boolean): Promise<void> {
  await db.update(calendarEvents).set({ published, updatedAt: new Date() }).where(eq(calendarEvents.id, id));
}

// ============================================================
// TRACKING — a user's ongoing anime whose weekly releases show on the calendar
// ============================================================

export type TrackedTitle = {
  titleId: string;
  title: string;
  cover: string | null;
  weekday: number | null; // 0=Sun … 6=Sat
  time: string | null;
  episodes: number | null;
};

const WEEKDAY: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

/** Jikan broadcast.day is e.g. "Saturdays" — map to a JS weekday (0=Sun…6=Sat). */
function parseWeekday(day: string | null | undefined): number | null {
  if (!day) return null;
  const key = day.trim().toLowerCase().replace(/s$/, "");
  return key in WEEKDAY ? WEEKDAY[key] : null;
}

/** One-time broadcast lookup used when a user starts tracking. Best-effort:
 *  returns nulls on any failure so tracking still succeeds (just without a day). */
async function fetchBroadcast(malId: number): Promise<{ weekday: number | null; time: string | null }> {
  try {
    const res = await fetch(`https://api.jikan.moe/v4/anime/${malId}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { weekday: null, time: null };
    const json = (await res.json()) as { data?: { broadcast?: { day?: string | null; time?: string | null } } };
    const b = json.data?.broadcast;
    return { weekday: parseWeekday(b?.day), time: b?.time?.trim() || null };
  } catch {
    return { weekday: null, time: null };
  }
}

/** Catalog facts the anime page needs to decide whether "Track" applies. */
export async function getTrackMeta(
  titleId: string,
): Promise<{ kind: string; status: string | null; malId: number | null } | null> {
  const r = await db
    .select({ kind: titles.kind, status: titles.status, malId: titles.malId })
    .from(titles)
    .where(eq(titles.id, titleId))
    .limit(1);
  return r[0] ?? null;
}

export async function isTracking(userId: string, titleId: string): Promise<boolean> {
  const r = await db
    .select({ t: calendarTracks.titleId })
    .from(calendarTracks)
    .where(and(eq(calendarTracks.userId, userId), eq(calendarTracks.titleId, titleId)))
    .limit(1);
  return r.length > 0;
}

/** Toggle tracking. On add, looks up the broadcast day once from Jikan (if the
 *  title has a MAL id) so weekly releases can be placed on the calendar. */
export async function toggleTrack(userId: string, titleId: string): Promise<{ tracking: boolean }> {
  if (await isTracking(userId, titleId)) {
    await db.delete(calendarTracks).where(and(eq(calendarTracks.userId, userId), eq(calendarTracks.titleId, titleId)));
    return { tracking: false };
  }
  const meta = await getTrackMeta(titleId);
  const malId = meta?.malId ?? null;
  const { weekday, time } = malId ? await fetchBroadcast(malId) : { weekday: null, time: null };
  await db
    .insert(calendarTracks)
    .values({ userId, titleId, malId, weekday, time })
    .onConflictDoNothing();
  return { tracking: true };
}

// ============================================================
// SEASONAL PREMIERES — the current season's popular anime (the same set as the
// Home "Summer 2026" shelf) auto-placed on the calendar as premiere markers.
// Global (a show premieres for everyone) and synthetic (not stored): computed
// on the fly and merged into the calendar, so no admin work is needed.
// ============================================================

/** A synthetic premiere entry — shaped to match the calendar's EventLite. */
export type SeasonalPremiere = {
  id: string;
  kind: "premiere";
  title: string;
  subtitle: string;
  startsOn: string; // YYYY-MM-DD
  endsOn: null;
  location: string;
  url: null;
  cover: string | null;
  accent: null;
  hue: number;
  titleId: string;
};

/** mal_id → premiere date (YYYY-MM-DD) for the current season, from Jikan's
 *  season endpoint. One cheap (few-page) fetch, cached a week; empty on any
 *  failure so the calendar simply shows no auto-premieres. */
const seasonPremiereDates = unstable_cache(
  async (season: string, year: number): Promise<Record<number, string>> => {
    const map: Record<number, string> = {};
    try {
      for (let page = 1; page <= 4; page++) {
        const res = await fetch(`https://api.jikan.moe/v4/seasons/${year}/${season}?page=${page}`, {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) break;
        const json = (await res.json()) as {
          data?: { mal_id?: number; aired?: { from?: string | null } }[];
          pagination?: { has_next_page?: boolean };
        };
        for (const a of json.data ?? []) {
          const from = a.aired?.from;
          if (a.mal_id && from) map[a.mal_id] = from.slice(0, 10); // ISO → YYYY-MM-DD
        }
        if (!json.pagination?.has_next_page) break;
        await new Promise((r) => setTimeout(r, 400)); // be polite to Jikan
      }
    } catch {
      // network/rate-limit — return whatever we gathered (possibly empty)
    }
    return map;
  },
  ["seasonal-premiere-dates"],
  { revalidate: 604800 }, // one week
);

/** Premiere markers for the current season's most popular anime — the same
 *  titles as the Home seasonal shelf, dated from Jikan and linked to our pages. */
export async function getSeasonalPremieres(limit = 24): Promise<SeasonalPremiere[]> {
  const { season, year } = currentSeason();
  const rows = await db
    .select({ id: titles.id, title: titles.title, english: titles.englishTitle, cover: titles.cover, malId: titles.malId })
    .from(titles)
    .where(
      and(
        eq(titles.kind, "anime"),
        eq(titles.nsfw, false),
        isNotNull(titles.cover),
        isNotNull(titles.malId),
        eq(titles.season, season),
        eq(titles.year, year),
      ),
    )
    .orderBy(sql`${titles.popularity} desc nulls last`)
    .limit(limit);
  if (rows.length === 0) return [];

  const dates = await seasonPremiereDates(season, year);
  const out: SeasonalPremiere[] = [];
  for (const r of rows) {
    const startsOn = r.malId != null ? dates[r.malId] : undefined;
    if (!startsOn) continue; // no known premiere date → skip
    out.push({
      id: "seas:" + r.id,
      kind: "premiere",
      title: r.english || r.title,
      subtitle: "New this season",
      startsOn,
      endsOn: null,
      location: "",
      url: null,
      cover: hiResCover(r.cover),
      accent: null,
      hue: 1,
      titleId: r.id,
    });
  }
  return out;
}

/** The user's tracked titles, with broadcast day + cover, for weekly placement.
 *  Returns [] (never throws) so a slow/timed-out DB degrades the calendar widget
 *  instead of crashing the whole page with an unhandled rejection. */
export async function getTrackedTitles(userId: string): Promise<TrackedTitle[]> {
  try {
    const rows = await db
      .select({
        titleId: calendarTracks.titleId,
        title: titles.title,
        english: titles.englishTitle,
        cover: titles.cover,
        episodes: titles.episodes,
        weekday: calendarTracks.weekday,
        time: calendarTracks.time,
      })
      .from(calendarTracks)
      .innerJoin(titles, eq(titles.id, calendarTracks.titleId))
      .where(eq(calendarTracks.userId, userId))
      .orderBy(asc(titles.title));
    return rows.map((r) => ({
      titleId: r.titleId,
      title: r.english || r.title,
      cover: r.cover,
      weekday: r.weekday,
      time: r.time,
      episodes: r.episodes,
    }));
  } catch {
    return [];
  }
}
