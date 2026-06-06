"use client";

import { useCallback, useState, useTransition } from "react";
import type { HueKey } from "@/lib/palette";
import type { Watchlist } from "@/lib/storage";
import {
  createWatchlistAction,
  togglePinAction,
  setHueAction,
  deleteWatchlistAction,
} from "./actions";

export type NewWatchlistInput = {
  title: string;
  desc: string;
  hue: HueKey;
};

// Seeded with the server-fetched list, then kept in sync optimistically: each
// mutation updates local state immediately (snappy UX + the delete animation)
// and persists via a Server Action against Supabase. `pending` is exposed for
// callers that want to reflect in-flight writes.
export function useWatchlists(initial: Watchlist[]) {
  const [lists, setLists] = useState<Watchlist[]>(initial);
  const [pending, startTransition] = useTransition();

  const create = useCallback((input: NewWatchlistInput) => {
    // create needs the real DB id back before we can render the card, so we
    // append once the action resolves rather than guessing an id.
    startTransition(async () => {
      const created = await createWatchlistAction(input);
      setLists((prev) => [...prev, created]);
    });
  }, []);

  const togglePin = useCallback((id: string) => {
    setLists((prev) =>
      prev.map((l) => (l.id === id ? { ...l, pinned: !l.pinned, lastEdited: Date.now() } : l)),
    );
    startTransition(() => togglePinAction(id));
  }, []);

  const setHue = useCallback((id: string, hue: HueKey) => {
    setLists((prev) =>
      prev.map((l) => (l.id === id ? { ...l, hue, lastEdited: Date.now() } : l)),
    );
    startTransition(() => setHueAction(id, hue));
  }, []);

  const remove = useCallback((id: string) => {
    setLists((prev) => prev.filter((l) => l.id !== id));
    startTransition(() => deleteWatchlistAction(id));
  }, []);

  return { lists, create, togglePin, setHue, remove, pending };
}
