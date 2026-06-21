"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isModerator } from "@/lib/submissions";
import {
  createBanner, updateBanner, deleteBanner, setBannerActive, moveBanner,
  type BannerInput,
} from "@/lib/banners";

async function requireModerator() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!isModerator(session.user.role)) throw new Error("Forbidden");
  return session.user;
}

// raw form values arrive as strings (dates as datetime-local); coerce + clamp
export type RawBanner = {
  title?: string; subtitle?: string; ctaLabel?: string; ctaHref?: string;
  image?: string; accent?: string; active?: boolean; startsAt?: string; endsAt?: string;
};

function parseDate(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function clean(input: RawBanner): BannerInput {
  return {
    title: (input.title ?? "").trim().slice(0, 120) || "Untitled event",
    subtitle: (input.subtitle ?? "").trim().slice(0, 200),
    ctaLabel: (input.ctaLabel ?? "").trim().slice(0, 40),
    ctaHref: (input.ctaHref ?? "").trim() || null,
    image: (input.image ?? "").trim() || null,
    accent: (input.accent ?? "").trim() || null,
    active: input.active === true,
    startsAt: parseDate(input.startsAt),
    endsAt: parseDate(input.endsAt),
  };
}

function refresh() {
  revalidatePath("/home");
  revalidatePath("/events");
}

export async function createBannerAction(input: RawBanner): Promise<void> {
  const mod = await requireModerator();
  await createBanner(mod.id, clean(input));
  refresh();
}

export async function updateBannerAction(id: string, input: RawBanner): Promise<void> {
  await requireModerator();
  await updateBanner(id, clean(input));
  refresh();
}

export async function deleteBannerAction(id: string): Promise<void> {
  await requireModerator();
  await deleteBanner(id);
  refresh();
}

export async function setBannerActiveAction(id: string, active: boolean): Promise<void> {
  await requireModerator();
  await setBannerActive(id, active);
  refresh();
}

export async function moveBannerAction(id: string, dir: "up" | "down"): Promise<void> {
  await requireModerator();
  await moveBanner(id, dir);
  refresh();
}
