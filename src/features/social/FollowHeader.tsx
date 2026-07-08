"use client";

import { useState } from "react";
import Link from "next/link";
import { FollowButton } from "./FollowButton";

// Follower/following counts + the follow control for a profile header. Keeps the
// follower count live when you follow/unfollow. Renders counts only for your own
// profile (isSelf), and counts + button + "Follows you" for others.
export function FollowHeader({
  username,
  targetUserId,
  isSelf,
  initialFollowing,
  followsYou,
  followers,
  following,
}: {
  username: string;
  targetUserId: string;
  isSelf: boolean;
  initialFollowing: boolean;
  followsYou: boolean;
  followers: number;
  following: number;
}) {
  const [followerCount, setFollowerCount] = useState(followers);

  return (
    <div className="pf-follow">
      <div className="pf-follow__counts">
        <Link className="pf-follow__count" href={`/u/${encodeURIComponent(username)}/followers`}>
          <b>{followerCount.toLocaleString()}</b> {followerCount === 1 ? "follower" : "followers"}
        </Link>
        <Link className="pf-follow__count" href={`/u/${encodeURIComponent(username)}/following`}>
          <b>{following.toLocaleString()}</b> following
        </Link>
      </div>
      {!isSelf && (
        <div className="pf-follow__actions">
          <FollowButton
            targetUserId={targetUserId}
            initialFollowing={initialFollowing}
            followsYou={followsYou}
            onChange={(f) => setFollowerCount((c) => c + (f ? 1 : -1))}
          />
          {followsYou && <span className="pf-follow__badge">Follows you</span>}
        </div>
      )}
    </div>
  );
}
