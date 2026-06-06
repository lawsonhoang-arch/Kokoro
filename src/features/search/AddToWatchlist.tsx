"use client";

import { useState } from "react";
import Link from "next/link";
import {
  getMyWatchlistsAction,
  addAnimeToWatchlistAction,
} from "@/app/(app)/watchlist/actions";

type ListRef = { id: string; title: string };

// Add-to-watchlist button + list picker, used on the standalone /anime/[id] page.
export function AddToWatchlist({ titleId }: { titleId: string }) {
  const [lists, setLists] = useState<ListRef[] | null>(null);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [fb, setFb] = useState<{ title: string; dup: boolean } | null>(null);

  const toggle = async () => {
    setOpen((o) => !o);
    if (lists === null) setLists(await getMyWatchlistsAction());
  };

  const add = async (l: ListRef) => {
    setAdding(true);
    const r = await addAnimeToWatchlistAction(l.id, titleId);
    setAdding(false);
    setOpen(false);
    setFb({ title: l.title, dup: !r.ok && r.reason === "duplicate" });
  };

  if (fb) {
    return (
      <span className={"adw__fb" + (fb.dup ? " adw__fb--dup" : "")}>
        {fb.dup ? `Already in ${fb.title}` : `Added to ${fb.title} ✓`}
      </span>
    );
  }

  return (
    <div className="adw">
      <button className="adw__btn" onClick={toggle} disabled={adding}>
        {adding ? "Adding…" : "＋ Add to list"}
      </button>
      {open && (
        <div className="adw__picker">
          {lists === null ? (
            <div className="adw__hint">Loading lists…</div>
          ) : lists.length === 0 ? (
            <Link className="adw__hint" href="/watchlist">
              Create a list first →
            </Link>
          ) : (
            lists.map((l) => (
              <button key={l.id} className="adw__item" onClick={() => add(l)}>
                {l.title}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
