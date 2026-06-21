"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isModerator } from "@/lib/submissions";
import {
  createPick, updatePick, deletePick, setPublished, movePick,
  type PickInput,
} from "@/lib/editorial";

async function requireModerator() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!isModerator(session.user.role)) throw new Error("Forbidden");
  return session.user;
}

// clamp + coerce whatever the form sends into a clean PickInput
function clean(input: Partial<PickInput>): PickInput {
  const hue = Math.min(3, Math.max(1, Number(input.hue) || 1));
  const avatarHue = Math.min(8, Math.max(1, Number(input.avatarHue) || 1));
  return {
    kicker: (input.kicker ?? "").trim().slice(0, 80),
    title: (input.title ?? "").trim().slice(0, 200) || "Untitled pick",
    excerpt: (input.excerpt ?? "").trim().slice(0, 600),
    hue,
    avatarHue,
    byline: (input.byline ?? "").trim().slice(0, 120),
    href: (input.href ?? "").trim() || null,
    cover: (input.cover ?? "").trim() || null,
    published: input.published !== false,
  };
}

function refresh() {
  revalidatePath("/home");
  revalidatePath("/editorial");
}

export async function createPickAction(input: Partial<PickInput>): Promise<void> {
  const mod = await requireModerator();
  await createPick(mod.id, clean(input));
  refresh();
}

export async function updatePickAction(id: string, input: Partial<PickInput>): Promise<void> {
  await requireModerator();
  await updatePick(id, clean(input));
  refresh();
}

export async function deletePickAction(id: string): Promise<void> {
  await requireModerator();
  await deletePick(id);
  refresh();
}

export async function togglePublishedAction(id: string, published: boolean): Promise<void> {
  await requireModerator();
  await setPublished(id, published);
  refresh();
}

export async function movePickAction(id: string, dir: "up" | "down"): Promise<void> {
  await requireModerator();
  await movePick(id, dir);
  refresh();
}
