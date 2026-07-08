import "server-only";
import { unstable_cache } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { titles } from "@/db/schema";
import { hiResCover } from "@/lib/cover";

// ============================================================
// Title extras for the detail page — cast/voice actors, staff, suggestions,
// and a trailer link — pulled from Jikan (MyAnimeList), each cached a week.
// On a transient failure the fetch throws (so the empty result is never
// cached) and the section component catches it and hides — next load retries.
// ============================================================

export type CastMember = {
  charId: number | null; // MAL character id (for their page / following)
  name: string;
  image: string | null;
  role: string; // Main | Supporting
  vaId: number | null; // MAL person id of the JP voice actor (for their page)
  vaName: string | null; // Japanese voice actor (anime only)
  vaImage: string | null;
};
export type StaffMember = { id: number | null; name: string; image: string | null; role: string };
export type Suggestion = { id: string; title: string; cover: string | null };
export type Studio = { id: number; name: string };

const JIKAN = "https://api.jikan.moe/v4";
const WEEK = 604800;
const placeholder = (u?: string | null) => !u || /questionmark|apple-touch|icon\/default/i.test(u);
const img = (u?: string | null) => (placeholder(u) ? null : u!.trim());
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The detail page fires several Jikan calls at once; Jikan allows only ~3/sec.
// Serialize every request through one queue with ≥400ms spacing so a burst
// never trips the rate limit. (Steady-state traffic is tiny — results cache a
// week — so this is never a real bottleneck.)
let jqueue: Promise<unknown> = Promise.resolve();
let lastCall = 0;
function jslot(): Promise<void> {
  const slot = jqueue.then(async () => {
    const wait = 400 - (Date.now() - lastCall);
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
  });
  jqueue = slot.catch(() => {});
  return slot;
}

// Fetch from Jikan. THROWS on failure (rate limit / network / bad status) so
// the caller's unstable_cache never caches an empty result from a transient
// error — only genuine successes (even empty ones) get cached. Retries 429s.
async function jget<T>(path: string): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await jslot();
    const res = await fetch(`${JIKAN}${path}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (res.ok) return (await res.json()) as T;
    // 429 = rate limit, 5xx = Jikan hiccup — both transient, worth a retry
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await sleep(900 * (attempt + 1));
      continue;
    }
    throw new Error(`jikan ${res.status} for ${path}`);
  }
  throw new Error(`jikan retries exhausted for ${path}`);
}

// ---- Characters + voice actors -----------------------------------------
type JChar = {
  character?: { mal_id?: number; name?: string; images?: { jpg?: { image_url?: string } } };
  role?: string;
  voice_actors?: { person?: { mal_id?: number; name?: string; images?: { jpg?: { image_url?: string } } }; language?: string }[];
};

async function fetchCast(kind: string, malId: number): Promise<CastMember[]> {
  const j = await jget<{ data?: JChar[] }>(`/${kind === "manga" ? "manga" : "anime"}/${malId}/characters`);
  if (!j.data) return [];
  const out: CastMember[] = [];
  for (const c of j.data) {
    const name = c.character?.name;
    if (!name) continue;
    const va = c.voice_actors?.find((v) => v.language === "Japanese") ?? c.voice_actors?.[0];
    out.push({
      charId: c.character?.mal_id ?? null,
      name,
      image: img(c.character?.images?.jpg?.image_url),
      role: c.role ?? "",
      vaId: va?.person?.mal_id ?? null,
      vaName: va?.person?.name ?? null,
      vaImage: img(va?.person?.images?.jpg?.image_url),
    });
  }
  out.sort((a, b) => (a.role === "Main" ? 0 : 1) - (b.role === "Main" ? 0 : 1)); // main cast first
  return out.slice(0, 12);
}

export function getTitleCast(kind: string, malId: number): Promise<CastMember[]> {
  return unstable_cache(() => fetchCast(kind, malId), ["title-cast", kind, String(malId)], { revalidate: WEEK })();
}

// ---- Staff (anime only) -------------------------------------------------
async function fetchStaff(malId: number): Promise<StaffMember[]> {
  const j = await jget<{ data?: { person?: { mal_id?: number; name?: string; images?: { jpg?: { image_url?: string } } }; positions?: string[] }[] }>(`/anime/${malId}/staff`);
  if (!j.data) return [];
  const out: StaffMember[] = [];
  for (const s of j.data) {
    const name = s.person?.name;
    if (!name) continue;
    out.push({ id: s.person?.mal_id ?? null, name, image: img(s.person?.images?.jpg?.image_url), role: (s.positions ?? []).slice(0, 2).join(", ") });
  }
  return out.slice(0, 8);
}

export function getTitleStaff(malId: number): Promise<StaffMember[]> {
  return unstable_cache(() => fetchStaff(malId), ["title-staff", String(malId)], { revalidate: WEEK })();
}

// ---- Studios (anime only) — from the title's full record ----------------
async function fetchStudios(malId: number): Promise<Studio[]> {
  const j = await jget<{ data?: { studios?: { mal_id?: number; name?: string }[] } }>(`/anime/${malId}`);
  const out: Studio[] = [];
  for (const s of j.data?.studios ?? []) {
    if (typeof s.mal_id === "number" && s.name) out.push({ id: s.mal_id, name: s.name });
  }
  return out;
}

export function getTitleStudios(malId: number): Promise<Studio[]> {
  return unstable_cache(() => fetchStudios(malId), ["title-studios", String(malId)], { revalidate: WEEK })();
}

// ---- Suggestions (mapped to our catalog so links stay in-app) ----------
async function fetchSuggestions(kind: string, malId: number): Promise<Suggestion[]> {
  const manga = kind === "manga";
  const j = await jget<{ data?: { entry?: { mal_id?: number } }[] }>(`/${manga ? "manga" : "anime"}/${malId}/recommendations`);
  if (!j.data) return [];
  const recIds = j.data.map((r) => r.entry?.mal_id).filter((x): x is number => typeof x === "number").slice(0, 24);
  if (recIds.length === 0) return [];

  // keep only titles we actually have, so every suggestion links to a real page
  const found = new Map<number, Suggestion>();
  if (manga) {
    const rows = await db
      .select({ id: titles.id, title: titles.title, english: titles.englishTitle, cover: titles.cover })
      .from(titles)
      .where(inArray(titles.id, recIds.map((n) => `mga:${n}`)));
    for (const r of rows) {
      const n = parseInt(r.id.replace(/^mga:/, ""), 10);
      if (!Number.isNaN(n)) found.set(n, { id: r.id, title: r.english || r.title, cover: hiResCover(r.cover) });
    }
  } else {
    const rows = await db
      .select({ id: titles.id, title: titles.title, english: titles.englishTitle, cover: titles.cover, malId: titles.malId })
      .from(titles)
      .where(and(eq(titles.kind, "anime"), inArray(titles.malId, recIds)));
    for (const r of rows) if (r.malId != null) found.set(r.malId, { id: r.id, title: r.english || r.title, cover: hiResCover(r.cover) });
  }

  // preserve Jikan's (most-recommended-first) order
  const out: Suggestion[] = [];
  for (const n of recIds) {
    const s = found.get(n);
    if (s) out.push(s);
    if (out.length >= 12) break;
  }
  return out;
}

export function getTitleSuggestions(kind: string, malId: number): Promise<Suggestion[]> {
  return unstable_cache(() => fetchSuggestions(kind, malId), ["title-suggestions", kind, String(malId)], { revalidate: WEEK })();
}

// ---- Trailer (anime only) — returns the YouTube video id ---------------
async function fetchTrailerId(malId: number): Promise<string | null> {
  const j = await jget<{ data?: { trailer?: { url?: string | null; youtube_id?: string | null; embed_url?: string | null } } }>(`/anime/${malId}`);
  const tr = j.data?.trailer;
  if (!tr) return null;
  // youtube_id/url are often null even when a trailer exists — fall back to the
  // id embedded in embed_url (…/embed/<id>) or url (…?v=<id>)
  return (
    tr.youtube_id ||
    tr.embed_url?.match(/\/embed\/([\w-]+)/)?.[1] ||
    tr.url?.match(/[?&]v=([\w-]+)/)?.[1] ||
    null
  );
}

export function getTitleTrailerId(malId: number): Promise<string | null> {
  return unstable_cache(() => fetchTrailerId(malId), ["title-trailer-id", String(malId)], { revalidate: WEEK })();
}

// ============================================================
// ENTITY PAGES — a person (voice actor / staff) or a studio, with their works,
// mapped into our catalog where possible so links stay in-app.
// ============================================================
async function mapAnimeByMal(malIds: number[]): Promise<Map<number, { id: string; cover: string | null }>> {
  const out = new Map<number, { id: string; cover: string | null }>();
  const ids = [...new Set(malIds)].filter((n) => Number.isFinite(n));
  if (ids.length === 0) return out;
  try {
    const rows = await db
      .select({ id: titles.id, cover: titles.cover, malId: titles.malId })
      .from(titles)
      .where(and(eq(titles.kind, "anime"), inArray(titles.malId, ids)));
    for (const r of rows) if (r.malId != null) out.set(r.malId, { id: r.id, cover: hiResCover(r.cover) });
  } catch {
    // a slow/timed-out lookup must not sink the whole entity page — the works
    // just fall back to their external images with no in-app link
  }
  return out;
}

export type PersonRole = {
  titleId: string | null; // our catalog id, when we have the title
  malId: number;
  title: string;
  cover: string | null;
  character: string | null;
  role: string; // Main | Supporting
};
export type PersonInfo = {
  id: number;
  name: string;
  image: string | null;
  about: string | null;
  favorites: number;
  roles: PersonRole[];
};

type JVoice = { role?: string; anime?: { mal_id?: number; title?: string; images?: { jpg?: { image_url?: string } } }; character?: { name?: string } };

async function fetchPerson(id: number): Promise<PersonInfo | null> {
  const j = await jget<{ data?: { mal_id?: number; name?: string; images?: { jpg?: { image_url?: string } }; about?: string; favorites?: number; voices?: JVoice[] } }>(`/people/${id}/full`);
  const d = j.data;
  if (!d?.name) return null;
  const voices = d.voices ?? [];
  const map = await mapAnimeByMal(voices.map((v) => v.anime?.mal_id).filter((n): n is number => typeof n === "number"));
  const seen = new Set<number>(); // a VA can voice several chars in one show — one card per title
  const roles: PersonRole[] = [];
  for (const v of voices) {
    const mal = v.anime?.mal_id;
    if (typeof mal !== "number" || seen.has(mal)) continue;
    seen.add(mal);
    const hit = map.get(mal);
    roles.push({
      titleId: hit?.id ?? null,
      malId: mal,
      title: v.anime?.title ?? "Untitled",
      cover: hit?.cover ?? img(v.anime?.images?.jpg?.image_url),
      character: v.character?.name ?? null,
      role: v.role ?? "",
    });
    if (roles.length >= 36) break;
  }
  return { id: d.mal_id ?? id, name: d.name, image: img(d.images?.jpg?.image_url), about: d.about ?? null, favorites: d.favorites ?? 0, roles };
}

export function getPerson(id: number): Promise<PersonInfo | null> {
  return unstable_cache(() => fetchPerson(id), ["person", String(id)], { revalidate: WEEK })();
}

// ---- Characters (their own page + following) ---------------------------
export type CharacterAppearance = {
  titleId: string | null; // our catalog id, when we have the title
  malId: number;
  title: string;
  cover: string | null;
  role: string; // Main | Supporting
};
export type CharacterVoice = { id: number | null; name: string; language: string; image: string | null };
export type CharacterInfo = {
  id: number;
  name: string;
  image: string | null;
  about: string | null;
  favorites: number;
  appearances: CharacterAppearance[];
  voices: CharacterVoice[]; // voice actors across languages
};

type JCharFull = {
  mal_id?: number;
  name?: string;
  images?: { jpg?: { image_url?: string } };
  about?: string;
  favorites?: number;
  anime?: { role?: string; anime?: { mal_id?: number; title?: string; images?: { jpg?: { image_url?: string } } } }[];
  voices?: { language?: string; person?: { mal_id?: number; name?: string; images?: { jpg?: { image_url?: string } } } }[];
};

async function fetchCharacter(id: number): Promise<CharacterInfo | null> {
  const j = await jget<{ data?: JCharFull }>(`/characters/${id}/full`);
  const d = j.data;
  if (!d?.name) return null;
  const anime = d.anime ?? [];
  const map = await mapAnimeByMal(anime.map((a) => a.anime?.mal_id).filter((n): n is number => typeof n === "number"));
  const appearances: CharacterAppearance[] = [];
  const seen = new Set<number>();
  for (const a of anime) {
    const mal = a.anime?.mal_id;
    if (typeof mal !== "number" || seen.has(mal)) continue;
    seen.add(mal);
    const hit = map.get(mal);
    appearances.push({
      titleId: hit?.id ?? null,
      malId: mal,
      title: a.anime?.title ?? "Untitled",
      cover: hit?.cover ?? img(a.anime?.images?.jpg?.image_url),
      role: a.role ?? "",
    });
    if (appearances.length >= 36) break;
  }
  appearances.sort((a, b) => (a.role === "Main" ? 0 : 1) - (b.role === "Main" ? 0 : 1));
  const voices: CharacterVoice[] = [];
  const vSeen = new Set<string>();
  for (const v of d.voices ?? []) {
    const name = v.person?.name;
    if (!name || vSeen.has(name)) continue;
    vSeen.add(name);
    voices.push({ id: v.person?.mal_id ?? null, name, language: v.language ?? "", image: img(v.person?.images?.jpg?.image_url) });
    if (voices.length >= 12) break;
  }
  return { id: d.mal_id ?? id, name: d.name, image: img(d.images?.jpg?.image_url), about: d.about ?? null, favorites: d.favorites ?? 0, appearances, voices };
}

export function getCharacter(id: number): Promise<CharacterInfo | null> {
  return unstable_cache(() => fetchCharacter(id), ["character", String(id)], { revalidate: WEEK })();
}

export type StudioWork = { titleId: string | null; malId: number; title: string; cover: string | null; year: number | null };
export type StudioInfo = {
  id: number;
  name: string;
  image: string | null;
  about: string | null;
  count: number;
  works: StudioWork[];
};

async function fetchStudio(id: number): Promise<StudioInfo | null> {
  const meta = await jget<{ data?: { mal_id?: number; titles?: { title?: string }[]; images?: { jpg?: { image_url?: string } }; about?: string; count?: number } }>(`/producers/${id}`);
  const d = meta.data;
  if (!d) return null;
  const name = d.titles?.[0]?.title ?? "Studio";
  const w = await jget<{ data?: { mal_id?: number; title?: string; year?: number | null; images?: { jpg?: { image_url?: string } } }[] }>(`/anime?producers=${id}&order_by=favorites&sort=desc&limit=24`);
  const list = w.data ?? [];
  const map = await mapAnimeByMal(list.map((a) => a.mal_id).filter((n): n is number => typeof n === "number"));
  const works: StudioWork[] = [];
  for (const a of list) {
    if (typeof a.mal_id !== "number") continue;
    const hit = map.get(a.mal_id);
    works.push({ titleId: hit?.id ?? null, malId: a.mal_id, title: a.title ?? "Untitled", cover: hit?.cover ?? img(a.images?.jpg?.image_url), year: a.year ?? null });
  }
  return { id: d.mal_id ?? id, name, image: img(d.images?.jpg?.image_url), about: d.about ?? null, count: d.count ?? works.length, works };
}

export function getStudio(id: number): Promise<StudioInfo | null> {
  return unstable_cache(() => fetchStudio(id), ["studio", String(id)], { revalidate: WEEK })();
}
