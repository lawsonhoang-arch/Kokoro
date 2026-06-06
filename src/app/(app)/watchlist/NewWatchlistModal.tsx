"use client";

import { useEffect, useRef, useState } from "react";
import { HUES } from "@/lib/palette";
import type { HueKey } from "@/lib/palette";
import { Icon } from "@/components/Icon";
import type { NewWatchlistInput } from "./useWatchlists";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (input: NewWatchlistInput) => void;
};

export function NewWatchlistModal({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [hue, setHue] = useState<HueKey>("warm");
  const nameRef = useRef<HTMLInputElement>(null);

  // reset to defaults + focus the name field each time it opens
  useEffect(() => {
    if (!open) return;
    setName("");
    setDesc("");
    setHue("warm");
    const t = setTimeout(() => nameRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  const submit = () => {
    const title = name.trim();
    if (!title) {
      nameRef.current?.focus();
      return;
    }
    onCreate({ title, desc: desc.trim(), hue });
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
        <h3 className="wl-modal__title" id="new-title">
          New list
        </h3>
        <p className="wl-modal__desc">
          Give it a name and pick its accent. The accent shapes how the list
          looks when you open it.
        </p>

        <div className="wl-field">
          <label className="wl-field__label" htmlFor="new-name">
            Name
          </label>
          <input
            id="new-name"
            ref={nameRef}
            type="text"
            placeholder="Comfort rewatches"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        </div>

        <div className="wl-field">
          <label className="wl-field__label" htmlFor="new-desc">
            Description{" "}
            <span style={{ textTransform: "none", color: "var(--ink-faint)" }}>
              — optional
            </span>
          </label>
          <textarea
            id="new-desc"
            rows={2}
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

        <div className="wl-modal__row">
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" type="button" onClick={submit}>
            <Icon name="plus" size={13} />
            Create list
          </button>
        </div>
      </div>
    </div>
  );
}
