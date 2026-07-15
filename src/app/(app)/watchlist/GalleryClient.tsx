"use client";

import { useCallback, useEffect, useState } from "react";
import { Page, PageHead } from "@/shell/Page";
import { Button } from "@/components/ui";
import { Icon } from "@/components/Icon";
import type { Watchlist } from "@/lib/storage";
import { getLastList, clearLastList } from "@/lib/lastList";
import { useWatchlists, type NewWatchlistInput } from "./useWatchlists";
import { WatchlistCard } from "./WatchlistCard";
import { NewWatchlistModal } from "./NewWatchlistModal";
import { ImportModal } from "./ImportModal";
import { DeleteConfirmModal } from "./DeleteConfirmModal";

type Editor = { mode: "create" } | { mode: "edit"; list: Watchlist };

export function GalleryClient({ initialLists }: { initialLists: Watchlist[] }) {
  const { lists, create, update, togglePin, setHue, remove } = useWatchlists(initialLists);

  const [editor, setEditor] = useState<Editor | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setEditor(null);
      setImportOpen(false);
      setDeleteTarget(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // deep-link: /watchlist?import=1 opens the import popup (from CTAs elsewhere)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("import")) {
      // one-time open from the URL param (an external system), then clean the URL
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setImportOpen(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

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

  useEffect(() => {
    const last = getLastList();
    if (last && !lists.some((l) => l.id === last)) clearLastList();
  }, [lists]);

  useEffect(() => {
    if (!removingId) return;
    const t = setTimeout(() => handleRemoved(removingId), 450);
    return () => clearTimeout(t);
  }, [removingId, handleRemoved]);

  // Import is a popup (AniList · MyAnimeList · Kokoro file).
  const goImport = useCallback(() => {
    setEditor(null);
    setImportOpen(true);
  }, []);

  const onEditorSubmit = useCallback(
    (input: NewWatchlistInput) => {
      if (editor?.mode === "edit") update(editor.list.id, { title: input.title, desc: input.desc });
      else create(input);
      setEditor(null);
    },
    [editor, create, update],
  );

  const pinned = lists.filter((l) => l.pinned);
  const others = lists.filter((l) => !l.pinned);
  const isEmpty = lists.length === 0;
  const hasLists = lists.length > 0;

  const renderCard = (l: Watchlist) => (
    <WatchlistCard
      key={l.id}
      list={l}
      removing={removingId === l.id}
      onTogglePin={togglePin}
      onSetHue={setHue}
      onEdit={(list) => setEditor({ mode: "edit", list })}
      onAskDelete={(id, title) => setDeleteTarget({ id, title })}
      onImport={goImport}
      onRemoved={handleRemoved}
    />
  );

  return (
    <Page width="wide">
      <PageHead
        eyebrow="Lists · Your collections"
        title="Your lists"
        lede="Different lists for different moods. Each list keeps its own rules, layout, and accent color — pick one to open it."
      />

      {hasLists && (
        <div className="wl-tools">
          <div className="wl-tools__search">
            <Icon name="search" size={14} />
            <input type="text" placeholder="Search your lists…" />
          </div>
          <span className="wl-tools__sort">↓ Recently edited</span>
        </div>
      )}

      {isEmpty && (
        <div className="wl-empty">
          <div className="wl-empty__art" aria-hidden="true" />
          <h2 className="wl-empty__title">No lists yet</h2>
          <p className="wl-empty__lede">
            A list is your own canvas — a private space with its own organizing rules, layout, and accent color. Make as many as you need:
            one for the main queue, one for comfort rewatches, one for a club.
          </p>
          <Button variant="primary" onClick={() => setEditor({ mode: "create" })}>
            <Icon name="plus" size={14} />
            Create your first list
          </Button>
        </div>
      )}

      {hasLists && pinned.length > 0 && (
        <section>
          <div className="wl-section-head">
            <div className="wl-section-head__title">Pinned</div>
            <div className="wl-section-head__num">{pinned.length} {pinned.length === 1 ? "list" : "lists"}</div>
          </div>
          <div className="wl-grid">{pinned.map(renderCard)}</div>
        </section>
      )}

      {hasLists && (
        <section>
          <div className="wl-section-head">
            <div className="wl-section-head__title">All lists</div>
            <div className="wl-section-head__num">{others.length} {others.length === 1 ? "list" : "lists"}</div>
          </div>
          <div className="wl-grid">
            {others.map(renderCard)}
            <button className="wl-new" type="button" onClick={() => setEditor({ mode: "create" })}>
              <span className="wl-new__icon" aria-hidden="true"><Icon name="plus" size={22} /></span>
              <span className="wl-new__title">New list</span>
              <span className="wl-new__hint">Start fresh, or import from AniList, MyAnimeList, or a Kokoro file.</span>
            </button>
          </div>
        </section>
      )}

      {editor && (
        <NewWatchlistModal
          open
          mode={editor.mode}
          initial={editor.mode === "edit" ? { title: editor.list.title, desc: editor.list.desc, hue: editor.list.hue } : undefined}
          onClose={() => setEditor(null)}
          onSubmit={onEditorSubmit}
          onImport={goImport}
        />
      )}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
      <DeleteConfirmModal target={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
    </Page>
  );
}
