"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isModerator } from "@/lib/submissions";
import {
  createNews, updateNews, deleteNews, setNewsPublished, moveNews,
  NEWS_CATEGORIES, type NewsInput,
} from "@/lib/news";

async function requireModerator() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!isModerator(session.user.role)) throw new Error("Forbidden");
  return session.user;
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
  };
}

function refresh() {
  revalidatePath("/news");
  revalidatePath("/news/admin");
}

export async function createNewsAction(input: RawNews): Promise<void> {
  const mod = await requireModerator();
  await createNews(mod.id, clean(input));
  refresh();
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
