"use client";

import { useState } from "react";
import { setEntityFollowAction } from "./actions";
import type { EntityKind } from "@/lib/entities";

const Plus = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
);
const Check = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m20 6-11 11-5-5" /></svg>
);

// Follow / unfollow a studio, person, or character. Snapshots the entity's
// display fields so a followed page can render without another Jikan call.
export function FollowEntityButton({
  kind, entityId, name, image, subtitle, initialFollowing, size = "sm",
}: {
  kind: EntityKind;
  entityId: string;
  name: string;
  image: string | null;
  subtitle?: string;
  initialFollowing: boolean;
  size?: "sm" | "lg";
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);

  const toggle = async () => {
    if (busy) return;
    const next = !following;
    setBusy(true);
    setFollowing(next); // optimistic
    try {
      const r = await setEntityFollowAction({ kind, entityId, name, image, subtitle }, next);
      setFollowing(r.following);
    } catch {
      setFollowing(!next);
    } finally {
      setBusy(false);
    }
  };

  const label = following ? (hover ? "Unfollow" : "Following") : "Follow";
  return (
    <button
      type="button"
      className={"entfollow entfollow--" + size + (following ? " entfollow--on" : "")}
      onClick={toggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={busy}
      aria-pressed={following}
    >
      {following ? <Check /> : <Plus />}
      {label}
    </button>
  );
}
