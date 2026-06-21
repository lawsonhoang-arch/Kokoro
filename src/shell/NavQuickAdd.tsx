"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  getMyWatchlistsAction,
  addAnimeToWatchlistAction,
} from "@/app/(app)/watchlist/actions";

type ListRef = { id: string; title: string };

const Plus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const Check = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="m20 6-11 11-5-5" />
  </svg>
);

/** Compact "add to list" control for a nav-search result, so a title can be
 *  filed straight from the dropdown without opening its detail page. Picks the
 *  list directly when the user has only one; otherwise pops a small picker. */
export function NavQuickAdd({ titleId }: { titleId: string }) {
  const [lists, setLists] = useState<ListRef[] | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [fb, setFb] = useState<{ name: string; dup: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const ensureLists = async (): Promise<ListRef[]> => {
    if (lists) return lists;
    const ls = await getMyWatchlistsAction();
    setLists(ls);
    return ls;
  };

  const add = async (l: ListRef) => {
    setBusy(true);
    const r = await addAnimeToWatchlistAction(l.id, titleId);
    setBusy(false);
    setOpen(false);
    setFb({ name: l.title, dup: !r.ok && r.reason === "duplicate" });
  };

  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (busy) return;
    const ls = await ensureLists();
    if (ls.length === 1) return add(ls[0]); // single list → file it immediately
    setOpen((o) => !o); // 0 or many → show the picker
  };

  // position the picker under the button (fixed; escapes the dropdown's scroll)
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const place = () => {
      const r = btnRef.current!.getBoundingClientRect();
      const W = 200;
      setPos({ top: r.bottom + 6, left: Math.max(10, r.right - W) });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  // outside click / Esc closes the picker
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const esc = (ev: KeyboardEvent) => ev.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", h, true);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", h, true);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (fb) {
    return (
      <span
        className={"navsrch__added" + (fb.dup ? " navsrch__added--dup" : "")}
        title={fb.dup ? `Already in ${fb.name}` : `Added to ${fb.name}`}
      >
        <Check /> {fb.dup ? "In list" : "Added"}
      </span>
    );
  }

  const menu =
    open && pos
      ? createPortal(
          <div
            ref={menuRef}
            className="navsrch__qamenu"
            role="menu"
            style={{ position: "fixed", top: pos.top, left: pos.left, width: 200 }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="navsrch__qamenu-lbl">Add to list</div>
            {lists === null ? (
              <div className="navsrch__qamenu-hint">Loading…</div>
            ) : lists.length === 0 ? (
              <Link className="navsrch__qamenu-hint" href="/watchlist">
                Create a list first →
              </Link>
            ) : (
              lists.map((l) => (
                <button key={l.id} className="navsrch__qamenu-item" disabled={busy} onClick={() => add(l)}>
                  {l.title}
                </button>
              ))
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={btnRef}
        className={"navsrch__add" + (open ? " on" : "")}
        title="Add to a list"
        aria-label="Add to a list"
        aria-expanded={open}
        disabled={busy}
        onClick={onClick}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Plus />
      </button>
      {menu}
    </>
  );
}
