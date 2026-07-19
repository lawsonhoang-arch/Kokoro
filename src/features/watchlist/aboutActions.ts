"use server";

import { getTitle } from "@/lib/catalog";
import { getTrackMeta } from "@/lib/calendar";
import {
  getTitleCast,
  getTitleStaff,
  getTitleStudios,
  getTitleSuggestions,
  getTitleTrailerId,
} from "@/lib/titleExtras";

export type TitleAbout = {
  kind: string;
  year: number | null;
  synopsis: string | null;
  cast: Awaited<ReturnType<typeof getTitleCast>>;
  staff: Awaited<ReturnType<typeof getTitleStaff>>;
  studios: Awaited<ReturnType<typeof getTitleStudios>>;
  suggestions: Awaited<ReturnType<typeof getTitleSuggestions>>;
  trailerId: string | null;
};

/** The "general browsing" info for a title, as plain data.
 *  The /anime/[id] page renders these as async server components, which a client
 *  surface (the list's detail modal) can't mount — so this returns the same
 *  material serialised, letting both places show one set of facts. */
export async function getTitleAboutAction(titleId: string): Promise<TitleAbout | null> {
  // These were sequential, so every open paid two round trips before the first
  // Jikan request could even start. getTrackMeta keys off the same id we were
  // given, so it never needed to wait for getTitle.
  const [t, meta] = await Promise.all([getTitle(titleId), getTrackMeta(titleId)]);
  if (!t) return null;
  // anime carry malId on the row; manga ids look like "mga:<malId>"
  const malId =
    meta?.malId ?? (t.kind === "manga" ? parseInt(t.id.replace(/^mga:/, ""), 10) || null : null);

  const base = {
    kind: t.kind,
    year: t.year ?? null,
    synopsis: (t as { synopsis?: string | null }).synopsis ?? null,
  };
  if (!malId) {
    return { ...base, cast: [], staff: [], studios: [], suggestions: [], trailerId: null };
  }

  // one slow extra shouldn't blank the whole tab
  const [cast, staff, studios, suggestions, trailerId] = await Promise.all([
    getTitleCast(t.kind, malId).catch(() => []),
    getTitleStaff(malId).catch(() => []),
    getTitleStudios(malId).catch(() => []),
    getTitleSuggestions(t.kind, malId).catch(() => []),
    getTitleTrailerId(malId).catch(() => null),
  ]);
  return { ...base, cast, staff, studios, suggestions, trailerId };
}
