"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isModerator } from "@/lib/submissions";
import { db } from "@/db";
import { uploads } from "@/db/schema";
import {
  createNews, updateNews, deleteNews, setNewsPublished, moveNews, setNewsPlacement,
  upsertNewsOverride, publishWave,
  NEWS_CATEGORIES, type NewsInput,
} from "@/lib/news";

async function requireModerator() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!isModerator(session.user.role)) throw new Error("Forbidden");
  return session.user;
}

const MAX_IMAGE = 3 * 1024 * 1024; // 3 MB
const OK_IMAGE = /^image\/(png|jpe?g|webp|gif|avif)$/;

/** Upload an image file for a news cover; stores it and returns its served URL. */
export async function uploadNewsImageAction(formData: FormData): Promise<{ url: string } | { error: string }> {
  const mod = await requireModerator();
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No file provided." };
  if (!OK_IMAGE.test(file.type)) return { error: "Choose a PNG, JPG, WebP, GIF, or AVIF image." };
  if (file.size > MAX_IMAGE) return { error: "Image is too large (max 3 MB)." };
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const [row] = await db
      .insert(uploads)
      .values({ mime: file.type, bytes, size: file.size, authorId: mod.id })
      .returning({ id: uploads.id });
    return { url: `/api/uploads/${row.id}` };
  } catch {
    // most likely the uploads table hasn't been created yet
    return { error: "Upload failed — run `npm run db:setup-uploads` once, then retry." };
  }
}

export type RawNews = {
  category?: string;
  title?: string;
  excerpt?: string;
  source?: string;
  href?: string;
  cover?: string;
  hue?: number;
  published?: boolean;
  onHome?: boolean;
  layout?: string;
};

function clean(input: RawNews): NewsInput {
  const category = (input.category ?? "").trim();
  const hue = Math.min(8, Math.max(1, Math.round(Number(input.hue) || 1)));
  return {
    category: (NEWS_CATEGORIES as readonly string[]).includes(category) ? category : "Industry",
    title: (input.title ?? "").trim().slice(0, 160) || "Untitled story",
    excerpt: (input.excerpt ?? "").trim().slice(0, 600),
    source: (input.source ?? "").trim().slice(0, 60),
    href: (input.href ?? "").trim() || null,
    cover: (input.cover ?? "").trim() || null,
    hue,
    published: input.published === true,
    onHome: input.onHome !== false, // default on
    layout: input.layout === "list" ? "list" : "card",
  };
}

function refresh() {
  revalidatePath("/news");
  revalidatePath("/news/admin");
}

export async function createNewsAction(input: RawNews): Promise<string> {
  const mod = await requireModerator();
  const id = await createNews(mod.id, clean(input));
  refresh();
  return id;
}

export async function updateNewsAction(id: string, input: RawNews): Promise<void> {
  await requireModerator();
  await updateNews(id, clean(input));
  refresh();
}

export async function deleteNewsAction(id: string): Promise<void> {
  await requireModerator();
  await deleteNews(id);
  refresh();
}

export async function setNewsPublishedAction(id: string, published: boolean): Promise<void> {
  await requireModerator();
  await setNewsPublished(id, published);
  refresh();
}

export async function moveNewsAction(id: string, dir: "up" | "down"): Promise<void> {
  await requireModerator();
  await moveNews(id, dir);
  refresh();
}

// ---- DB story placement (quick toggles, no full re-save) ----------------
export async function setNewsHomeAction(id: string, onHome: boolean): Promise<void> {
  await requireModerator();
  await setNewsPlacement(id, { onHome });
  refresh();
}

export async function setNewsLayoutAction(id: string, layout: "card" | "list"): Promise<void> {
  await requireModerator();
  await setNewsPlacement(id, { layout });
  refresh();
}

// ---- live (RSS) wave management ----------------------------------------

/** Publish the incoming wave now — the current pull replaces the live news. */
export async function publishWaveAction(): Promise<void> {
  await requireModerator();
  await publishWave();
  refresh();
}

/** Dismiss a story from the wave (or restore it). */
export async function hideLiveNewsAction(id: string, hidden: boolean): Promise<void> {
  await requireModerator();
  await upsertNewsOverride(id, { hidden });
  refresh();
}

export async function setLiveNewsCoverAction(id: string, cover: string | null): Promise<void> {
  await requireModerator();
  await upsertNewsOverride(id, { cover });
  refresh();
}

/** Show/pull a pulled (RSS) story from the Home carousel. `null` restores auto. */
export async function setLiveHomeAction(id: string, onHome: boolean | null): Promise<void> {
  await requireModerator();
  await upsertNewsOverride(id, { onHome });
  refresh();
}

/** Force a pulled (RSS) story into card/list in the news tab. `null` = auto. */
export async function setLiveLayoutAction(id: string, layout: "card" | "list" | null): Promise<void> {
  await requireModerator();
  await upsertNewsOverride(id, { layout });
  refresh();
}
