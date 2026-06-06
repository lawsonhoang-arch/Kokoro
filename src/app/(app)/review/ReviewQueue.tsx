"use client";

import { useState } from "react";
import {
  approveSubmissionAction,
  rejectSubmissionAction,
} from "@/features/submissions/actions";
import type { PendingItem } from "@/lib/submissions";

function rel(ts: number): string {
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return Math.round(d / 60) + "m ago";
  if (d < 86400) return Math.round(d / 3600) + "h ago";
  return Math.round(d / 86400) + "d ago";
}

export function ReviewQueue({ initial }: { initial: PendingItem[] }) {
  const [items, setItems] = useState<PendingItem[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);

  const drop = (id: string) => setItems((xs) => xs.filter((x) => x.id !== id));

  const approve = async (id: string) => {
    setBusy(id);
    await approveSubmissionAction(id);
    setBusy(null);
    drop(id);
  };

  const reject = async (id: string) => {
    const note = window.prompt("Reason for rejecting (optional):") ?? undefined;
    setBusy(id);
    await rejectSubmissionAction(id, note);
    setBusy(null);
    drop(id);
  };

  if (items.length === 0) {
    return <div className="rev-empty">Nothing to review right now. 🎉</div>;
  }

  return (
    <div className="rev-list">
      {items.map((s) => (
        <article key={s.id} className="rev-card">
          <div className="rev-card__head">
            <span className="rev-card__title">{s.title}</span>
            <span className="rev-card__meta">
              by <b>@{s.authorUsername}</b> · {rel(s.createdAt)}
            </span>
          </div>
          <div className="rev-card__body">{s.body}</div>
          <div className="rev-card__actions">
            <button
              className="rev-btn rev-btn--approve"
              onClick={() => approve(s.id)}
              disabled={busy === s.id}
            >
              {busy === s.id ? "…" : "Approve & publish"}
            </button>
            <button
              className="rev-btn rev-btn--reject"
              onClick={() => reject(s.id)}
              disabled={busy === s.id}
            >
              Reject
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
