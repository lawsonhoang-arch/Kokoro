import Link from "next/link";
import { Avatar } from "@/components/ui";
import type { UserLite } from "@/lib/follows";
import type { MatchLite } from "@/lib/affinity";
import { FollowButton } from "./FollowButton";

// stable 1–6 avatar hue from the username (matches the profile pages)
function hueOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 6) + 1;
}
function matchTier(score: number): string {
  if (score >= 70) return "hi";
  if (score >= 45) return "mid";
  return "lo";
}

// A user row for follower/following lists — avatar, name, bio, an optional taste
// match, and a follow toggle (hidden for the viewer's own row).
export function UserCard({ user, viewerId, match }: { user: UserLite; viewerId?: string; match?: MatchLite }) {
  const isSelf = user.id === viewerId;
  const showMatch = match && match.score != null;
  return (
    <div className="usercard">
      <Link className="usercard__main" href={`/u/${encodeURIComponent(user.username)}`}>
        <Avatar size="lg" hue={hueOf(user.username)} src={user.image} />
        <span className="usercard__txt">
          <span className="usercard__name">{user.name || "@" + user.username}</span>
          <span className="usercard__handle">@{user.username}</span>
          {user.bio && <span className="usercard__bio">{user.bio}</span>}
        </span>
      </Link>
      {showMatch && (
        <span
          className={"usercard__match usercard__match--" + matchTier(match!.score!)}
          title={`Taste match · ${match!.shared} shared ratings`}
        >
          {match!.score}<i>%</i>
        </span>
      )}
      {viewerId && !isSelf && (
        <FollowButton targetUserId={user.id} initialFollowing={user.viewerFollows} className="usercard__follow" />
      )}
    </div>
  );
}
