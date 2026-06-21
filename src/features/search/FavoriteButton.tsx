"use client";

import { useState } from "react";
import { toggleFavoriteAction } from "@/app/(app)/anime/actions";

const Star = ({ filled }: { filled: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
  </svg>
);

// Hand-pick a title as a favorite (shown on the profile), independent of lists.
export function FavoriteButton({ titleId, initialFavorite }: { titleId: string; initialFavorite: boolean }) {
  const [fav, setFav] = useState(initialFavorite);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setLimit(false);
    const next = !fav;
    setFav(next); // optimistic
    try {
      const r = await toggleFavoriteAction(titleId);
      setFav(r.favorite);
      if (r.atLimit) setLimit(true); // add was blocked by the 10-favorite cap
    } catch {
      setFav(!next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="favbtn-wrap">
      <button
        className={"favbtn" + (fav ? " favbtn--on" : "")}
        onClick={toggle}
        disabled={busy}
        aria-pressed={fav}
        title={fav ? "In your favorites — click to remove" : "Add to favorites"}
      >
        <Star filled={fav} />
        {fav ? "Favorited" : "Favorite"}
      </button>
      {limit && <span className="favbtn-limit">Max 10 favorites — remove one first.</span>}
    </span>
  );
}
