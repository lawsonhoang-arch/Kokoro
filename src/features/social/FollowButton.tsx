"use client";

import { useState } from "react";
import { setFollowAction } from "./actions";

// Optimistic follow toggle. Shows "Follow" / "Follow back" (if they follow you)
// when off, and "Following" → "Unfollow" on hover when on. `onChange` lets a
// parent keep a follower count in sync.
export function FollowButton({
  targetUserId,
  initialFollowing,
  followsYou = false,
  onChange,
  className,
}: {
  targetUserId: string;
  initialFollowing: boolean;
  followsYou?: boolean;
  onChange?: (following: boolean) => void;
  className?: string;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);

  const toggle = async () => {
    if (busy) return;
    const next = !following;
    setBusy(true);
    setFollowing(next);
    onChange?.(next);
    try {
      await setFollowAction(targetUserId, next);
    } catch {
      setFollowing(!next); // revert
      onChange?.(!next);
    } finally {
      setBusy(false);
    }
  };

  const label = following ? (hover ? "Unfollow" : "Following") : followsYou ? "Follow back" : "Follow";

  return (
    <button
      className={"followbtn" + (following ? " followbtn--on" : "") + (className ? " " + className : "")}
      onClick={toggle}
      disabled={busy}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-pressed={following}
    >
      {label}
    </button>
  );
}
