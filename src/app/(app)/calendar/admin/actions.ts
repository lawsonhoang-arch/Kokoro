"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isModerator } from "@/lib/submissions";
import {
  createEvent, updateEvent, deleteEvent, setEventPublished,
  type EventInput,
} from "@/lib/calendar";

async function requireModerator() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!isModerator(session.user.role)) throw new Error("Forbidden");
  return session.user;
}

// normalize YYYY-MM-DD (or empty) — the <input type="date"> gives this shape
function cleanDate(d: string | null | undefined): string | null {
  const s = (d ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function clean(input: Partial<EventInput>): EventInput {
  const kind = input.kind === "premiere" ? "premiere" : "event";
  const start = cleanDate(input.startsOn) ?? new Date().toISOString().slice(0, 10);
  const end = cleanDate(input.endsOn);
  return {
    kind,
    title: (input.title ?? "").trim().slice(0, 200) || "Untitled event",
    subtitle: (input.subtitle ?? "").trim().slice(0, 300),
    startsOn: start,
    // drop an end date that's before the start
    endsOn: end && end >= start ? end : null,
    location: (input.location ?? "").trim().slice(0, 200),
    url: (input.url ?? "").trim() || null,
    cover: (input.cover ?? "").trim() || null,
    accent: (input.accent ?? "").trim() || null,
    titleId: (input.titleId ?? "").trim() || null,
    hue: Math.min(6, Math.max(1, Number(input.hue) || 1)),
    published: input.published !== false,
  };
}

function refresh() {
  revalidatePath("/calendar");
  revalidatePath("/calendar/admin");
}

export async function createEventAction(input: Partial<EventInput>): Promise<string> {
  const mod = await requireModerator();
  const id = await createEvent(mod.id, clean(input));
  refresh();
  return id;
}

export async function updateEventAction(id: string, input: Partial<EventInput>): Promise<void> {
  await requireModerator();
  await updateEvent(id, clean(input));
  refresh();
}

export async function deleteEventAction(id: string): Promise<void> {
  await requireModerator();
  await deleteEvent(id);
  refresh();
}

export async function toggleEventPublishedAction(id: string, published: boolean): Promise<void> {
  await requireModerator();
  await setEventPublished(id, published);
  refresh();
}
