"use client";

import { useEffect, useState } from "react";
import "./submissions.css";
import {
  getTitleDescriptionAction,
  submitDescriptionAction,
  type TitleDescState,
} from "./actions";

const MIN_LEN = 40;
const MAX_LEN = 4000;

export function DescriptionSection({ titleId }: { titleId: string }) {
  const [state, setState] = useState<TitleDescState | null>(null);
  const [composing, setComposing] = useState(false);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getTitleDescriptionAction(titleId)
      .then((s) => {
        if (live) setState(s);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [titleId]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const res = await submitDescriptionAction(titleId, body);
    setSubmitting(false);
    if (res.ok) {
      setComposing(false);
      setBody("");
      setState((s) => (s ? { ...s, pending: true } : s));
    } else {
      setError(res.error);
    }
  };

  if (!state) return null;

  const hasDesc = !!state.description;

  return (
    <div className="cdesc">
      <div className="cdesc__lbl">
        <span>Description · community-written</span>
        {!composing && !state.pending && (
          <button className="cdesc__btn" onClick={() => setComposing(true)}>
            {hasDesc ? "Suggest an edit" : "Write the first one"}
          </button>
        )}
      </div>

      {hasDesc ? (
        <>
          <div className="cdesc__body">{state.description}</div>
          {state.authorUsername && (
            <div className="cdesc__credit">
              contributed by <b>@{state.authorUsername}</b>
            </div>
          )}
        </>
      ) : (
        !composing && (
          <div className="cdesc__empty">
            No description yet — be the first to write one. It&apos;ll go live once a moderator
            approves it.
          </div>
        )
      )}

      {state.pending && (
        <div className="cdesc__pending">⏳ Your suggestion is awaiting review</div>
      )}

      {composing && (
        <div className="cdesc__compose">
          <p className="cdesc__hint">
            Write an original, spoiler-free overview in your own words (don&apos;t paste from other
            sites). A moderator reviews it before it goes live.
          </p>
          <textarea
            className="cdesc__ta"
            value={body}
            maxLength={MAX_LEN}
            placeholder="What is this show about, and what makes it worth watching…"
            onChange={(e) => setBody(e.target.value)}
            autoFocus
          />
          {error && <div className="cdesc__error">{error}</div>}
          <div className="cdesc__row">
            <span className="cdesc__count">
              {body.trim().length}/{MAX_LEN} · min {MIN_LEN}
            </span>
            <button
              className="cdesc__cancel"
              onClick={() => {
                setComposing(false);
                setError(null);
              }}
            >
              Cancel
            </button>
            <button
              className="cdesc__submit"
              onClick={submit}
              disabled={submitting || body.trim().length < MIN_LEN}
            >
              {submitting ? "Submitting…" : "Submit for review"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
