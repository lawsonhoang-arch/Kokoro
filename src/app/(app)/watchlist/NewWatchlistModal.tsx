"use client";

import { useEffect, useRef, useState } from "react";
import { HUES } from "@/lib/palette";
import type { HueKey } from "@/lib/palette";
import { Icon } from "@/components/Icon";
import type { NewWatchlistInput } from "./useWatchlists";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: { title: string; desc: string; hue: HueKey };
  onClose: () => void;
  onSubmit: (input: NewWatchlistInput) => void;
  /** create mode only — offer importing a list file instead */
  onImport?: () => void;
};

export function NewWatchlistModal({ open, mode, initial, onClose, onSubmit, onImport }: Props) {
  // Seeded from props at mount; the parent passes a changing `key` so the modal
  // remounts (and re-seeds) each time it opens — no reset effect needed.
  const [name, setName] = useState(initial?.title ?? "");
  const [desc, setDesc] = useState(initial?.desc ?? "");
  const [hue, setHue] = useState<HueKey>(initial?.hue ?? "warm");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => nameRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  if (!open) return null;

  const isEdit = mode === "edit";
  const submit = () => {
    const title = name.trim();
    if (!title) {
      nameRef.current?.focus();
      return;
    }
    onSubmit({ title, desc: desc.trim(), hue });
  };

  return (
    <div
      className="wl-modal on"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="wl-modal__box">
        <h3 className="wl-modal__title" id="new-title">{isEdit ? "Edit list" : "New list"}</h3>
        <p className="wl-modal__desc">
          {isEdit
            ? "Rename this list or update what it's for. The accent shapes how it looks when you open it."
            : "Give it a name and pick its accent. The accent shapes how the list looks when you open it."}
        </p>

        <div className="wl-field">
          <label className="wl-field__label" htmlFor="new-name">Name</label>
          <input
            id="new-name"
            ref={nameRef}
            type="text"
            placeholder="Comfort rewatches"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          />
        </div>

        <div className="wl-field">
          <label className="wl-field__label" htmlFor="new-desc">
            Description <span style={{ textTransform: "none", color: "var(--ink-faint)" }}>— optional</span>
          </label>
          <textarea
            id="new-desc"
            rows={2}
            maxLength={240}
            placeholder="One line about what this list is for."
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>

        <div className="wl-field">
          <label className="wl-field__label">Accent color</label>
          <div className="wl-hues">
            {HUES.map((h) => (
              <span
                key={h.key}
                className={"wl-hues__swatch" + (hue === h.key ? " on" : "")}
                data-hue={h.key}
                style={{ "--swatch": h.value } as React.CSSProperties}
                title={h.label}
                onClick={() => setHue(h.key)}
              />
            ))}
          </div>
        </div>

        {!isEdit && onImport && (
          <button className="wl-modal__alt" type="button" onClick={onImport}>
            <Icon name="upload" size={15} />
            <span><b>Import a list instead</b> — from AniList, MyAnimeList, or a Kokoro file.</span>
          </button>
        )}

        <div className="wl-modal__row">
          <button className="btn btn--ghost" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" type="button" onClick={submit}>
            {!isEdit && <Icon name="plus" size={13} />}
            {isEdit ? "Save changes" : "Create list"}
          </button>
        </div>
      </div>
    </div>
  );
}
