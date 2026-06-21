"use client";

import { useEffect, useRef, useState } from "react";
import type { CommunityPost, PostKind } from "@/lib/community";
import { createPostAction, searchCommunityAction } from "@/app/(app)/community/actions";
import type { SearchResult } from "@/features/search/types";
import { RatingControl, type RatingValue } from "@/app/(app)/journal/RatingControl";

const emptyRating = (): RatingValue => ({ rateMode: "glyphs", feeling: null, symbol: null, dims: {} });

type PickedTitle = { id: string; name: string };

export function Composer({
  fixedTitle,
  onPosted,
}: {
  // when set, the composer is locked to one title's community (the anime page)
  fixedTitle?: PickedTitle;
  onPosted: (post: CommunityPost) => void;
}) {
  const [kind, setKind] = useState<PostKind>("discussion");
  const [heading, setHeading] = useState("");
  const [body, setBody] = useState("");
  const [episode, setEpisode] = useState("");
  const [rating, setRating] = useState<RatingValue>(emptyRating);
  const [spoiler, setSpoiler] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // collapsed by default — a pill the user clicks to open the full composer
  const [open, setOpen] = useState(false);

  // title picker (home composer only)
  const [picked, setPicked] = useState<PickedTitle | null>(fixedTitle ?? null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pickOpen, setPickOpen] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    if (fixedTitle) return;
    const term = q.trim();
    if (term.length < 2) return; // pickdrop is gated on length below
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      const r = await searchCommunityAction(term);
      if (id === reqId.current) setResults(r.slice(0, 6));
    }, 140);
    return () => clearTimeout(t);
  }, [q, fixedTitle]);

  const title = fixedTitle ?? picked;
  // a review must be about a specific anime
  const needsTitle = kind === "review" && !title;
  const canPost = (heading.trim().length > 0 || body.trim().length > 0) && !needsTitle;

  const reset = () => {
    setHeading("");
    setBody("");
    setEpisode("");
    setRating(emptyRating());
    setSpoiler(false);
    setKind("discussion");
    if (!fixedTitle) setPicked(null);
  };
  const collapse = () => {
    reset();
    setOpen(false);
  };

  const post = async () => {
    if (busy || !canPost) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await createPostAction({
        titleId: title?.id ?? null,
        kind,
        episode: title ? episode : "",
        heading,
        body,
        rateMode: rating.rateMode,
        feeling: rating.feeling,
        symbol: rating.symbol,
        dims: rating.dims,
        spoiler,
      });
      if (res.ok) {
        onPosted(res.post);
        reset();
        setOpen(false);
      } else if (res.reason === "rate_limit") {
        setErr("You're posting too fast — give it a moment.");
      } else if (res.reason === "needs_title") {
        setErr("Reviews need an anime — link one above.");
      }
    } catch {
      setErr("Couldn't post — please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button className="ccomposer__pill" onClick={() => setOpen(true)}>
        <span className="ccomposer__pill-plus" aria-hidden="true">+</span>
        {fixedTitle ? `Post in the ${fixedTitle.name} community…` : "Start a discussion or write a review…"}
      </button>
    );
  }

  return (
    <div className="ccomposer">
      <div className="ccomposer__row ccomposer__kinds">
        <button className={"cseg" + (kind === "discussion" ? " on" : "")} onClick={() => setKind("discussion")}>
          Discussion
        </button>
        <button className={"cseg" + (kind === "review" ? " on" : "")} onClick={() => setKind("review")}>
          Review
        </button>

        {/* title attachment */}
        {fixedTitle ? (
          <span className="ccomposer__title-chip">{fixedTitle.name}</span>
        ) : picked ? (
          <span className="ccomposer__title-chip">
            {picked.name}
            <button className="ccomposer__title-x" onClick={() => setPicked(null)} aria-label="Remove title">
              ✕
            </button>
          </span>
        ) : (
          <div className="ccomposer__pick">
            <input
              className={"ccomposer__pickinput" + (needsTitle ? " needs" : "")}
              placeholder={kind === "review" ? "+ link the anime you're reviewing" : "+ link an anime (optional)"}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPickOpen(true);
              }}
              onFocus={() => setPickOpen(true)}
              onBlur={() => setTimeout(() => setPickOpen(false), 150)}
            />
            {pickOpen && q.trim().length >= 2 && results.length > 0 && (
              <div className="ccomposer__pickdrop">
                {results.map((r) => (
                  <button
                    key={r.id}
                    className="ccomposer__pickitem"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setPicked({ id: r.id, name: r.title });
                      setQ("");
                      setResults([]);
                      setPickOpen(false);
                    }}
                  >
                    {r.title}
                    <span className="ccomposer__pickmeta">{[r.format, r.year].filter(Boolean).join(" · ")}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button className="ccomposer__close" onClick={collapse} aria-label="Cancel" title="Cancel">
          ✕
        </button>
      </div>

      <input
        className="ccomposer__heading"
        placeholder={kind === "review" ? "Your review in a line…" : "Start a discussion…"}
        value={heading}
        maxLength={160}
        onChange={(e) => setHeading(e.target.value)}
      />
      <textarea
        className="ccomposer__body"
        placeholder={kind === "review" ? "What worked, what didn't…" : "Add your thoughts…"}
        value={body}
        rows={3}
        onChange={(e) => setBody(e.target.value)}
      />

      {kind === "review" && (
        <div className="ccomposer__rating">
          <span className="ccomposer__rating-lbl">Your rating</span>
          <RatingControl value={rating} onChange={(patch) => setRating((r) => ({ ...r, ...patch }))} />
        </div>
      )}

      <div className="ccomposer__row ccomposer__tools">
        {title && (
          <input
            className="ccomposer__ep"
            placeholder="Episode # (optional)"
            value={episode}
            onChange={(e) => setEpisode(e.target.value)}
          />
        )}
        <label className="ccomposer__spoiler">
          <input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} /> Spoiler
        </label>
        {needsTitle && <span className="ccomposer__needs">Reviews need an anime — link one above.</span>}
        {err && <span className="ccomposer__needs">{err}</span>}
        <button className="btn btn--primary ccomposer__post" disabled={busy || !canPost} onClick={post}>
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}
