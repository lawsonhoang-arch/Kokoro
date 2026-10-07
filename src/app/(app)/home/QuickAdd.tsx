"use client";

import { useState } from "react";
import { getMyWatchlistsAction, addAnimeToWatchlistAction } from "@/app/(app)/watchlist/actions";

// Compact hover "+" on a poster card: one click adds the title to the viewer's
// first list (a true quick-add; the full list picker lives on the detail page).
// It's a sibling of the card <Link> — never nested inside the anchor — and stops
// propagation so clicking it doesn't navigate.
type State = "idle" | "adding" | "done" | "dup" | "nolist";

export function QuickAdd({ titleId }: { titleId: string }) {
  const [state, setState] = useState<State>("idle");

  const click = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (state === "adding" || state === "done" || state === "dup") return;
    setState("adding");
    try {
      const lists = await getMyWatchlistsAction();
      if (!lists.length) return setState("nolist");
      const r = await addAnimeToWatchlistAction(lists[0].id, titleId);
      setState(r.ok ? "done" : r.reason === "duplicate" ? "dup" : "idle");
    } catch {
      setState("idle");
    }
  };

  const added = state === "done" || state === "dup";
  const label = added ? "✓" : state === "adding" ? "·" : "+";
  const title =
    state === "done" ? "Added to your list"
    : state === "dup" ? "Already in your list"
    : state === "nolist" ? "Create a list first"
    : "Quick add to your list";

  return (
    <button
      type="button"
      className={"h-qa" + (added ? " h-qa--done" : "")}
      onClick={click}
      aria-label={title}
      title={title}
    >
      {label}
    </button>
  );
}
