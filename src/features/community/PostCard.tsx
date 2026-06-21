"use client";

import { useState } from "react";
import Link from "next/link";
import type { CommunityPost, CommunityReply } from "@/lib/community";
import {
  toggleLikeAction,
  getRepliesAction,
  addReplyAction,
  deletePostAction,
  deleteReplyAction,
} from "@/app/(app)/community/actions";
import { timeAgo, initials } from "./helpers";
import { RatingBadge } from "./RatingBadge";

const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.5 1-1a5.5 5.5 0 0 0 0-7.9z" />
  </svg>
);
const ReplyIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
  </svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
);

export function PostCard({
  post,
  showTitle,
  onDeleted,
}: {
  post: CommunityPost;
  showTitle?: boolean;
  onDeleted?: (id: string) => void;
}) {
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [replies, setReplies] = useState<CommunityReply[] | null>(null);
  const [replyCount, setReplyCount] = useState(post.replyCount);
  const [draft, setDraft] = useState("");
  const [replyErr, setReplyErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(!post.spoiler);
  const [removed, setRemoved] = useState(false);

  const like = async () => {
    setLiked((v) => !v);
    setLikeCount((c) => c + (liked ? -1 : 1));
    try {
      const r = await toggleLikeAction(post.id);
      setLiked(r.liked);
      setLikeCount(r.likeCount);
    } catch {
      setLiked(post.liked);
      setLikeCount(post.likeCount);
    }
  };

  const toggleReplies = async () => {
    const next = !repliesOpen;
    setRepliesOpen(next);
    if (next && replies === null) {
      try {
        setReplies(await getRepliesAction(post.id));
      } catch {
        setReplies([]);
      }
    }
  };

  const sendReply = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setReplyErr(null);
    try {
      const r = await addReplyAction(post.id, text);
      if (r.ok) {
        setReplies((rs) => [...(rs || []), r.reply]);
        setReplyCount((c) => c + 1);
        setDraft("");
      } else if (r.reason === "rate_limit") {
        setReplyErr("You're replying too fast — give it a moment.");
      }
    } catch {
      setReplyErr("Couldn't reply — please try again.");
    } finally {
      setBusy(false);
    }
  };

  const removeReply = async (id: string) => {
    setReplies((rs) => (rs || []).filter((r) => r.id !== id));
    setReplyCount((c) => Math.max(0, c - 1));
    try {
      await deleteReplyAction(id);
    } catch {
      /* best effort */
    }
  };

  const removePost = async () => {
    if (!confirm("Delete this post? This can't be undone.")) return;
    setRemoved(true);
    try {
      await deletePostAction(post.id);
      onDeleted?.(post.id);
    } catch {
      setRemoved(false);
    }
  };

  if (removed) return null;

  const headingText = post.heading || (post.kind === "review" ? "Review" : "Discussion");

  return (
    <article className={"cpost" + (post.kind === "review" ? " cpost--review" : "")}>
      <header className="cpost__head">
        <span className={`avatar avatar--h${post.author.avatarHue} cpost__avatar`} aria-hidden="true">
          {initials(post.author.name)}
        </span>
        <div className="cpost__who">
          <span className="cpost__name">{post.author.name}</span>
          <span className="cpost__meta">
            @{post.author.username} · {timeAgo(post.createdAt)}
          </span>
        </div>
        <span className={"cpost__kind cpost__kind--" + post.kind}>
          {post.kind === "review" ? "Review" : "Discussion"}
        </span>
        {post.mine && (
          <button className="cpost__del" onClick={removePost} aria-label="Delete post" title="Delete post">
            <TrashIcon />
          </button>
        )}
      </header>

      <div className="cpost__tags">
        {showTitle && post.title && (
          <Link className="cpost__title-chip" href={`/community/${encodeURIComponent(post.title.id)}`}>
            {post.title.cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.title.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
            )}
            {post.title.name}
          </Link>
        )}
        {post.episode && <span className="cpost__ep">{post.episode}</span>}
        {post.kind === "review" && <RatingBadge post={post} />}
        {post.spoiler && <span className="cpost__spoiler-tag">Spoiler</span>}
      </div>

      <h3 className="cpost__heading">{headingText}</h3>

      {post.body &&
        (revealed ? (
          <p className="cpost__body">{post.body}</p>
        ) : (
          <button className="cpost__spoiler-veil" onClick={() => setRevealed(true)}>
            Spoiler — tap to reveal
          </button>
        ))}

      <footer className="cpost__foot">
        <button className={"cpost__act" + (liked ? " on" : "")} onClick={like}>
          <HeartIcon filled={liked} /> {likeCount > 0 ? likeCount : ""}
          <span className="cpost__act-lbl">Like</span>
        </button>
        <button className={"cpost__act" + (repliesOpen ? " on" : "")} onClick={toggleReplies}>
          <ReplyIcon /> {replyCount > 0 ? replyCount : ""}
          <span className="cpost__act-lbl">Reply</span>
        </button>
      </footer>

      {repliesOpen && (
        <div className="cpost__replies">
          {replies === null ? (
            <div className="cpost__rhint">Loading…</div>
          ) : (
            replies.map((r) => (
              <div key={r.id} className="creply">
                <span className={`avatar avatar--h${r.author.avatarHue} creply__avatar`} aria-hidden="true">
                  {initials(r.author.name)}
                </span>
                <div className="creply__body">
                  <span className="creply__who">
                    <b>{r.author.name}</b> · {timeAgo(r.createdAt)}
                    {r.mine && (
                      <button className="creply__del" onClick={() => removeReply(r.id)} aria-label="Delete reply" title="Delete reply">
                        <TrashIcon />
                      </button>
                    )}
                  </span>
                  <p>{r.body}</p>
                </div>
              </div>
            ))
          )}
          <div className="cpost__replybox">
            <textarea
              className="cpost__replyinput"
              placeholder="Add a reply…"
              value={draft}
              rows={1}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendReply();
              }}
            />
            <button className="btn btn--primary cpost__replysend" disabled={!draft.trim() || busy} onClick={sendReply}>
              Reply
            </button>
          </div>
          {replyErr && <div className="cpost__replyerr">{replyErr}</div>}
        </div>
      )}
    </article>
  );
}
