"use client";

import { Icon } from "@/components/Icon";

type Props = {
  /** the list being confirmed for deletion, or null when closed */
  target: { id: string; title: string } | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteConfirmModal({ target, onCancel, onConfirm }: Props) {
  if (!target) return null;
  return (
    <div
      className="wl-modal on"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="wl-modal__box">
        <h3 className="wl-modal__title" id="confirm-title">
          Delete this list?
        </h3>
        <p className="wl-modal__desc">
          You&apos;re about to delete <strong>{target.title}</strong>. Its titles
          stay in your library — only the list, its layout, and its sculpt rules
          go away. This can&apos;t be undone.
        </p>
        <div className="wl-modal__row">
          <button className="btn btn--ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn--danger" type="button" onClick={onConfirm}>
            <Icon name="trash" size={13} />
            Delete list
          </button>
        </div>
      </div>
    </div>
  );
}
