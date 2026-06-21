"use client";

import { useCallback, useEffect, useState } from "react";
import { Page, PageHead } from "@/shell/Page";
import { Button } from "@/components/ui";
import { Icon } from "@/components/Icon";
import type { HueKey } from "@/lib/palette";
import type { Watchlist } from "@/lib/storage";
import { getLastList, clearLastList } from "@/lib/lastList";
import { useWatchlists } from "./useWatchlists";
import { WatchlistCard } from "./WatchlistCard";
import { NewWatchlistModal } from "./NewWatchlistModal";
import { DeleteConfirmModal } from "./DeleteConfirmModal";

export function GalleryClient({ initialLists }: { initialLists: Watchlist[] }) {
  const { lists, create, togglePin, setHue, remove } = useWatchlists(initialLists);

  const [openHueId, setOpenHueId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Esc closes the open modal or hue popover.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setNewOpen(false);
      setDeleteTarget(null);
      setOpenHueId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Click anywhere (outside the popover / hue button, which stop propagation)
  // closes an open hue popover.
  useEffect(() => {
    if (!openHueId) return;
    const close = () => setOpenHueId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openHueId]);

  const handleSetHue = useCallback(
    (id: string, hue: HueKey) => {
      setHue(id, hue);
      setOpenHueId(null);
    },
    [setHue],
  );

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    setRemovingId(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget]);

  const handleRemoved = useCallback(
    (id: string) => {
      setRemovingId((cur) => (cur === id ? null : cur));
      remove(id);
      if (getLastList() === id) clearLastList();
    },
    [remove],
  );

  // Forget a remembered list that no longer exists (deleted here or elsewhere),
  // so the Lists tab never tries to reopen a dead list.
  useEffect(() => {
    const last = getLastList();
    if (last && !lists.some((l) => l.id === last)) clearLastList();
  }, [lists]);

  // Safety net: if the is-removing transition never reports back (e.g. the
  // element gets detached first), commit the delete anyway.
  useEffect(() => {
    if (!removingId) return;
    const t = setTimeout(() => handleRemoved(removingId), 450);
    return () => clearTimeout(t);
  }, [removingId, handleRemoved]);

  const cardProps = {
    huePopOpenFor: openHueId,
    onTogglePin: togglePin,
    onToggleHuePop: (id: string) => setOpenHueId((cur) => (cur === id ? null : id)),
    onSetHue: handleSetHue,
    onAskDelete: (id: string, title: string) => setDeleteTarget({ id, title }),
    onRemoved: handleRemoved,
  };

  const pinned = lists.filter((l) => l.pinned);
  const others = lists.filter((l) => !l.pinned);
  const isEmpty = lists.length === 0;
  const hasLists = lists.length > 0;

  return (
    <Page width="wide">
      <PageHead
        eyebrow="Lists · Your collections"
        title="Your lists"
        lede="Different lists for different moods. Each list keeps its own rules, layout, and accent color — pick one to open it."
        actions={
          <Button variant="primary" onClick={() => setNewOpen(true)}>
            <Icon name="plus" size={14} />
            New list
          </Button>
        }
      />

      {/* Tools (search + sort) — only when lists exist */}
      {hasLists && (
        <div className="wl-tools">
          <div className="wl-tools__search">
            <Icon name="search" size={14} />
            <input type="text" placeholder="Search your lists…" />
          </div>
          <span className="wl-tools__sort">↓ Recently edited</span>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="wl-empty">
          <div className="wl-empty__art" aria-hidden="true" />
          <h2 className="wl-empty__title">No lists yet</h2>
          <p className="wl-empty__lede">
            A list is your own canvas — a private space with its own
            organizing rules, layout, and accent color. Make as many as you need:
            one for the main queue, one for comfort rewatches, one for a club.
          </p>
          <Button variant="primary" onClick={() => setNewOpen(true)}>
            <Icon name="plus" size={14} />
            Create your first list
          </Button>
        </div>
      )}

      {/* Pinned */}
      {hasLists && pinned.length > 0 && (
        <section>
          <div className="wl-section-head">
            <div className="wl-section-head__title">Pinned</div>
            <div className="wl-section-head__num">
              {pinned.length} {pinned.length === 1 ? "list" : "lists"}
            </div>
          </div>
          <div className="wl-grid">
            {pinned.map((l) => (
              <WatchlistCard
                key={l.id}
                list={l}
                huePopOpen={cardProps.huePopOpenFor === l.id}
                removing={removingId === l.id}
                onTogglePin={cardProps.onTogglePin}
                onToggleHuePop={cardProps.onToggleHuePop}
                onSetHue={cardProps.onSetHue}
                onAskDelete={cardProps.onAskDelete}
                onRemoved={cardProps.onRemoved}
              />
            ))}
          </div>
        </section>
      )}

      {/* All watchlists (also where + New lives) */}
      {hasLists && (
        <section>
          <div className="wl-section-head">
            <div className="wl-section-head__title">All lists</div>
            <div className="wl-section-head__num">
              {others.length} {others.length === 1 ? "list" : "lists"}
            </div>
          </div>
          <div className="wl-grid">
            {others.map((l) => (
              <WatchlistCard
                key={l.id}
                list={l}
                huePopOpen={cardProps.huePopOpenFor === l.id}
                removing={removingId === l.id}
                onTogglePin={cardProps.onTogglePin}
                onToggleHuePop={cardProps.onToggleHuePop}
                onSetHue={cardProps.onSetHue}
                onAskDelete={cardProps.onAskDelete}
                onRemoved={cardProps.onRemoved}
              />
            ))}
            <button className="wl-new" type="button" onClick={() => setNewOpen(true)}>
              <span className="wl-new__icon" aria-hidden="true">
                <Icon name="plus" size={22} />
              </span>
              <span className="wl-new__title">New list</span>
              <span className="wl-new__hint">
                Empty list with its own rules, layout, and accent color.
              </span>
            </button>
          </div>
        </section>
      )}

      <NewWatchlistModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreate={(input) => {
          create(input);
          setNewOpen(false);
        }}
      />
      <DeleteConfirmModal
        target={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </Page>
  );
}
