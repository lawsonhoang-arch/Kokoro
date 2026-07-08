"use server";

import { gunzipSync } from "node:zlib";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { fetchAniList, parseMalExport, applyImport, type ImportSummary } from "@/lib/importList";

type Result = { ok: true; summary: ImportSummary } | { ok: false; error: string };

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

/** Import a public AniList user's anime + manga lists by username. */
export async function importAniListAction(usernameRaw: string): Promise<Result> {
  const userId = await requireUserId();
  const username = usernameRaw.trim().replace(/^@/, "");
  if (!username || !/^[\w.-]{2,40}$/.test(username)) return { ok: false, error: "Enter a valid AniList username." };
  let entries;
  try {
    entries = await fetchAniList(username);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NOT_FOUND") return { ok: false, error: `No public AniList user “${username}” — check the spelling, and that the profile isn't private.` };
    return { ok: false, error: "Couldn't reach AniList right now. Please try again in a moment." };
  }
  if (entries.length === 0) return { ok: false, error: "That AniList list looks empty — nothing to import." };
  const summary = await applyImport(userId, "anilist", entries);
  revalidatePath("/watchlist");
  revalidatePath("/profile");
  return { ok: true, summary };
}

const MAX_XML = 12 * 1024 * 1024; // 12 MB (generous for a big export)

/** Import a MyAnimeList list from its exported XML file (gzipped or plain). */
export async function importMalAction(formData: FormData): Promise<Result> {
  const userId = await requireUserId();
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose your MAL export file first." };
  if (file.size > MAX_XML) return { ok: false, error: "That file is too large (max 12 MB)." };

  let xml: string;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const isGzip = buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b; // MAL exports .xml.gz
    xml = (isGzip ? gunzipSync(buf) : buf).toString("utf8");
  } catch {
    return { ok: false, error: "Couldn't read that file — upload the .xml (or .xml.gz) MAL gives you." };
  }
  if (!/<myanimelist|<anime>|<manga>/i.test(xml)) {
    return { ok: false, error: "That doesn't look like a MAL export. In MAL: Profile → List → Export." };
  }
  const entries = parseMalExport(xml);
  if (entries.length === 0) return { ok: false, error: "No entries found in that export." };
  const summary = await applyImport(userId, "mal", entries);
  revalidatePath("/watchlist");
  revalidatePath("/profile");
  return { ok: true, summary };
}
