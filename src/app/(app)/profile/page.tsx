import "./profile.css";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Page } from "@/shell/Page";
import { Avatar } from "@/components/ui";
import {
  getProfileUser,
  getProfileSummary,
  getProfileReviews,
  getBannerCandidates,
  getAvatarTitles,
} from "@/lib/profile";
import { getFavorites } from "@/lib/favorites";
import { getFollowCounts } from "@/lib/follows";
import { getFollowedEntities } from "@/lib/entities";
import { ProfileTabs } from "./ProfileTabs";
import { ProfileStatsPanel } from "./ProfileStatsPanel";
import { ProfileBanner } from "./ProfileBanner";
import { AvatarPicker } from "./AvatarPicker";
import { FollowHeader } from "@/features/social/FollowHeader";
import { ShareProfileButton } from "@/features/social/ShareProfileButton";
import { FollowedEntities } from "@/features/entities/FollowedEntities";

// stable 1–6 avatar hue from the username
function hueOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 6) + 1;
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [user, summary, reviews, favorites, bannerCandidates, avatarTitles, followCounts, entities] = await Promise.all([
    getProfileUser(userId),
    getProfileSummary(userId),
    getProfileReviews(userId),
    getFavorites(userId),
    getBannerCandidates(userId),
    getAvatarTitles(userId),
    getFollowCounts(userId),
    getFollowedEntities(userId),
  ]);
  if (!user) redirect("/login");

  const displayName = user.name || "@" + user.username;
  const memberSince = new Date(user.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const s = summary.stats;

  return (
    <Page width="wide">
      <ProfileBanner
        art={user.bannerArt}
        titleId={user.bannerTitleId}
        pos={user.bannerPos}
        candidates={bannerCandidates}
      />

      <header className="pf-head">
        <div className="pf-avatar-wrap">
          <Avatar size="xl" hue={hueOf(user.username)} src={user.image} />
          <AvatarPicker titles={avatarTitles} current={user.image} />
        </div>
        <div className="pf-meta">
          <h1 className="pf-name">
            {displayName}
            {user.role !== "user" && <span className="pf-rolebadge">{user.role}</span>}
          </h1>
          <span className="pf-handle">@{user.username} · joined {memberSince}</span>
          <p className={"pf-bio" + (user.bio ? "" : " pf-bio--empty")}>
            {user.bio || "No bio yet — add one in Settings."}
          </p>
          <FollowHeader
            username={user.username}
            targetUserId={userId}
            isSelf
            initialFollowing={false}
            followsYou={false}
            followers={followCounts.followers}
            following={followCounts.following}
          />
        </div>
        <div className="pf-head__actions">
          <ShareProfileButton username={user.username} />
        </div>
      </header>

      {s.tracked === 0 && (
        <Link className="pf-import" href="/import">
          <span className="pf-import__txt">
            <b>New here?</b> Import your list from AniList or MyAnimeList — your statuses &amp; scores come along, and your stats light up instantly.
          </span>
          <span className="pf-import__cta">Import →</span>
        </Link>
      )}

      <ProfileStatsPanel stats={s} />

      {s.tracked > 0 && (
        <Link className="pf-wrapped" href="/wrapped">
          <span className="pf-wrapped__spark" aria-hidden="true">✦</span>
          <span className="pf-wrapped__txt"><b>Kokoro Wrapped</b> — your hours, genres, moods and defining titles, in one look.</span>
          <span className="pf-wrapped__cta">View →</span>
        </Link>
      )}

      <FollowedEntities items={entities} />

      <ProfileTabs user={user} summary={summary} reviews={reviews} favorites={favorites} />
    </Page>
  );
}
