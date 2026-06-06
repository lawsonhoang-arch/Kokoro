"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Ico } from "./Ico";

export type Collection = { id: string; name: string };

type Props = {
  entryId: string;
  collections: Collection[];
  inGroupId: string | null;
  onAdd: (entryId: string, gid: string) => void;
  onNew: (entryId: string) => void;
  onRemove: (entryId: string) => void;
  onRemoveFromList?: (entryId: string) => void;
};

export function AddToTabBtn({
  entryId,
  collections,
  inGroupId,
  onAdd,
  onNew,
  onRemove,
  onRemoveFromList,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Position the menu in viewport coords (escapes overflow ancestors)
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const place = () => {
      const r = btnRef.current!.getBoundingClientRect();
      const W = 232;
      const left = Math.max(10, Math.min(window.innerWidth - W - 10, r.right - W));
      let top = r.bottom + 7;
      if (top + 280 > window.innerHeight) top = Math.max(10, r.top - 280 - 7);
      setPos({ top, left, width: W });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  // outside click / Esc closes
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current && btnRef.current.contains(t)) return;
      if (menuRef.current && menuRef.current.contains(t)) return;
      setOpen(false);
    };
    const esc = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", h);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", h);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const targets = collections.filter((c) => c.id !== inGroupId);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const menu =
    open && pos
      ? createPortal(
          <div
            ref={menuRef}
            className="k-addmenu"
            role="menu"
            style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
            onClick={stop}
            onPointerDown={stop}
          >
            <div className="k-addmenu__lbl">Add to collection</div>
            {targets.map((c) => (
              <button
                key={c.id}
                className="k-addmenu__item"
                onClick={(e) => {
                  stop(e);
                  onAdd(entryId, c.id);
                  setOpen(false);
                }}
              >
                <Ico name="stack" s={14} />
                <span>{c.name}</span>
              </button>
            ))}
            {targets.length === 0 && <div className="k-addmenu__empty">No other collections yet.</div>}
            <button
              className="k-addmenu__item k-addmenu__new"
              onClick={(e) => {
                stop(e);
                onNew(entryId);
                setOpen(false);
              }}
            >
              <Ico name="plus" s={14} />
              <span>New collection…</span>
            </button>
            {inGroupId && (
              <button
                className="k-addmenu__item k-addmenu__remove"
                onClick={(e) => {
                  stop(e);
                  onRemove(entryId);
                  setOpen(false);
                }}
              >
                <Ico name="x" s={13} />
                <span>Remove from this collection</span>
              </button>
            )}
            {onRemoveFromList && (
              <button
                className="k-addmenu__item k-addmenu__removeall"
                onClick={(e) => {
                  stop(e);
                  onRemoveFromList(entryId);
                  setOpen(false);
                }}
              >
                <Ico name="trash" s={13} />
                <span>Remove from list</span>
              </button>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <span className="k-addwrap" onClick={stop} onPointerDown={stop}>
      <button
        ref={btnRef}
        className={"k-addbtn" + (open ? " on" : "")}
        title="Add to a collection"
        aria-label="Add to a collection"
        aria-expanded={open}
        onClick={(e) => {
          stop(e);
          setOpen((o) => !o);
        }}
      >
        <Ico name="plus" s={16} />
      </button>
      {menu}
    </span>
  );
}
