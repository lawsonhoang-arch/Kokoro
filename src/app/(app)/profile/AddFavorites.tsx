"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { searchAnimeAction } from "@/features/search/actions";
import { toggleFavoriteAction } from "@/app/(app)/anime/actions";
import type { SearchResult } from "@/features/search/types";
import type { ProfileTitle } from "@/lib/profile";

const MAX_FAVORITES = 10; // mirrors the server cap (lib/favorites is server-only)

function toProfileTitle(r: SearchResult): ProfileTitle {
  return {
    id: r.id,
    title: r.title,
    cover: r.cover,
    year: r.year,
    genres: r.genres ?? [],
    episodes: r.episodes ?? 0,
    status: "",
    progress: null,
    score: null,
  };
}

// Search the catalog and add titles straight to your profile favorites — no need
// to open each anime's page.
// Rendered only while open (mounted fresh each time), so its search state starts
// empty without a reset effect.
export function AddFavorites({
  onClose,
  existingIds,
  onAdd,
  onRemove,
}: {
  onClose: () => void;
  existingIds: Set<string>;
  onAdd: (t: ProfileTitle) => void;
  onRemove: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return; // results gated on length below
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      const r = await searchAnimeAction(term);
      if (id === reqId.current) setResults(r.slice(0, 12));
    }, 140);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const atLimit = existingIds.size >= MAX_FAVORITES;

  const toggle = async (r: SearchResult) => {
    if (busy) return;
    const wasAdded = existingIds.has(r.id);
    if (!wasAdded && atLimit) return; // can't add beyond the cap (button is disabled too)
    setBusy(r.id);
    // optimistic: reflect the change immediately, reconcile/revert with the server
    if (wasAdded) onRemove(r.id);
    else onAdd(toProfileTitle(r));
    try {
      const res = await toggleFavoriteAction(r.id);
      if (res.atLimit && !wasAdded) onRemove(r.id); // server blocked the add → revert
      else if (res.favorite && wasAdded) onAdd(toProfileTitle(r));
      else if (!res.favorite && !wasAdded) onRemove(r.id);
    } catch {
      if (wasAdded) onAdd(toProfileTitle(r));
      else onRemove(r.id);
    } finally {
      setBusy(null);
    }
  };

  return createPortal(
    <>
      <div className="pf-modal__scrim" onClick={onClose} />
      <div className="pf-modal" role="dialog" aria-modal="true" aria-label="Add favorites">
        <div className="pf-modal__head">
          <h3 className="pf-modal__title">Add favorites</h3>
          <button className="pf-modal__x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="pf-modal__lede">
          Search and pick the anime you want on your profile.{" "}
          <span className={atLimit ? "pf-modal__count pf-modal__count--full" : "pf-modal__count"}>
            {existingIds.size}/{MAX_FAVORITES}
          </span>
        </p>
        {atLimit && (
          <div className="pf-modal__limit">You&apos;ve reached the max of {MAX_FAVORITES} favorites — remove one to add another.</div>
        )}
        <input
          className="pf-modal__search"
          autoFocus
          placeholder="Search anime…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="pf-modal__results">
          {q.trim().length < 2 ? (
            <div className="pf-modal__hint">Type at least two letters to search.</div>
          ) : results.length === 0 ? (
            <div className="pf-modal__hint">No matches.</div>
          ) : (
            results.map((r) => {
              const added = existingIds.has(r.id);
              return (
                <div key={r.id} className="pf-fres">
                  {r.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="pf-fres__cover" src={r.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
                  ) : (
                    <span className="pf-fres__cover" />
                  )}
                  <span className="pf-fres__txt">
                    <span className="pf-fres__title">{r.title}</span>
                    <span className="pf-fres__meta">{[r.format, r.year].filter(Boolean).join(" · ")}</span>
                  </span>
                  <button
                    className={"pf-fres__add" + (added ? " added" : "")}
                    disabled={busy === r.id || (!added && atLimit)}
                    onClick={() => toggle(r)}
                  >
                    {added ? "✓ Added" : "Add"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
