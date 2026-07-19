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

/** What the top of the tab needs: everything visible before you scroll. */
export type TitleAbout = {
  kind: string;
  year: number | null;
  synopsis: string | null;
  studios: Awaited<ReturnType<typeof getTitleStudios>>;
  cast: Awaited<ReturnType<typeof getTitleCast>>;
  /** null when the title isn't linked to MAL — nothing further will load */
  malId: number | null;
};

/** The rest, fetched once the top has painted. */
export type TitleAboutExtras = {
  staff: Awaited<ReturnType<typeof getTitleStaff>>;
  suggestions: Awaited<ReturnType<typeof getTitleSuggestions>>;
  trailerId: string | null;
};

async function resolve(titleId: string) {
  // These do not depend on each other — getTrackMeta keys off the id we were
  // given, so running them together removes a round trip before the first
  // Jikan call can start.
  const [t, meta] = await Promise.all([getTitle(titleId), getTrackMeta(titleId)]);
  if (!t) return null;
  // anime carry malId on the row; manga ids look like "mga:<malId>"
  const malId =
    meta?.malId ?? (t.kind === "manga" ? parseInt(t.id.replace(/^mga:/, ""), 10) || null : null);
  return { t, malId };
}

/** The "general browsing" info for a title, as plain data.
 *
 *  Split in two on purpose. Jikan allows ~3 req/sec, so titleExtras serialises
 *  every request 400ms apart — fetching all five at once meant roughly two
 *  seconds of pure gating before anything appeared. This half makes two calls
 *  and covers what is on screen when the tab opens; the rest follows in
 *  getTitleAboutExtrasAction, by which point there is something to read. */
export async function getTitleAboutAction(titleId: string): Promise<TitleAbout | null> {
  const r = await resolve(titleId);
  if (!r) return null;
  const { t, malId } = r;

  const base = {
    kind: t.kind,
    year: t.year ?? null,
    synopsis: (t as { synopsis?: string | null }).synopsis ?? null,
    malId,
  };
  if (!malId) return { ...base, studios: [], cast: [] };

  // one slow extra shouldn't blank the whole tab
  const [studios, cast] = await Promise.all([
    getTitleStudios(malId).catch(() => []),
    getTitleCast(t.kind, malId).catch(() => []),
  ]);
  return { ...base, studios, cast };
}

/** Staff, trailer and suggestions — the part below the fold. */
export async function getTitleAboutExtrasAction(
  titleId: string,
): Promise<TitleAboutExtras> {
  const r = await resolve(titleId);
  if (!r?.malId) return { staff: [], suggestions: [], trailerId: null };
  const { t, malId } = r;

  const [staff, suggestions, trailerId] = await Promise.all([
    getTitleStaff(malId).catch(() => []),
    getTitleSuggestions(t.kind, malId).catch(() => []),
    getTitleTrailerId(malId).catch(() => null),
  ]);
  return { staff, suggestions, trailerId };
}
