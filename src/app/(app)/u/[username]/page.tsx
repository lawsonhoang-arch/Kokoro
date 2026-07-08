import "../../profile/profile.css";
import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { Page } from "@/shell/Page";
import { Avatar } from "@/components/ui";
import { RatingBadge } from "@/features/community/RatingBadge";
import { timeAgo } from "@/features/community/helpers";
import { getUserIdByUsername, getProfileUser, getProfileSummary, getProfileReviews } from "@/lib/profile";
import { getFavorites } from "@/lib/favorites";
import { getFollowCounts, getFollowRelationship } from "@/lib/follows";
import { getTasteAffinity } from "@/lib/affinity";
import { ProfileStatsPanel } from "../../profile/ProfileStatsPanel";
import { FollowHeader } from "@/features/social/FollowHeader";
import { TasteMatch } from "@/features/social/TasteMatch";

function hueOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 6) + 1;
}
function genPoster(seed: string): CSSProperties {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  h = Math.abs(h);
  const a = h % 360;
  return { backgroundImage: `linear-gradient(135deg, oklch(0.55 0.13 ${a}), oklch(0.4 0.13 ${(a + 40) % 360}))` };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const session = await auth();
  const viewerId = session?.user?.id;
  const userId = await getUserIdByUsername(decodeURIComponent(username));
  if (!userId) notFound();
  if (userId === viewerId) redirect("/profile"); // your own → the editable version

  const [user, summary, reviews, favorites, counts, rel, affinity] = await Promise.all([
    getProfileUser(userId),
    getProfileSummary(userId),
    getProfileReviews(userId, 6),
    getFavorites(userId),
    getFollowCounts(userId),
    getFollowRelationship(viewerId, userId),
    getTasteAffinity(viewerId, userId),
  ]);
  if (!user) notFound();

  const displayName = user.name || "@" + user.username;
  const memberSince = new Date(user.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const favSize = favorites.length <= 4 ? 138 : 122;

  return (
    <Page width="wide">
      <div
        className={"pf-banner" + (user.bannerArt ? " pf-banner--art" : "")}
        style={user.bannerArt ? { backgroundImage: `url(${user.bannerArt})`, backgroundPosition: user.bannerPos ?? "center" } : undefined}
      />

      <header className="pf-head">
        <div className="pf-avatar-wrap">
          <Avatar size="xl" hue={hueOf(user.username)} src={user.image} />
        </div>
        <div className="pf-meta">
          <h1 className="pf-name">
            {displayName}
            {user.role !== "user" && <span className="pf-rolebadge">{user.role}</span>}
          </h1>
          <span className="pf-handle">@{user.username} · joined {memberSince}</span>
          <p className={"pf-bio" + (user.bio ? "" : " pf-bio--empty")}>{user.bio || "No bio yet."}</p>
          <FollowHeader
            username={user.username}
            targetUserId={userId}
            isSelf={false}
            initialFollowing={rel.following}
            followsYou={rel.followsYou}
            followers={counts.followers}
            following={counts.following}
          />
        </div>
      </header>

      {affinity && <TasteMatch affinity={affinity} name={displayName} />}

      <ProfileStatsPanel stats={summary.stats} />

      {favorites.length > 0 && (
        <section className="section" style={{ marginTop: 0 }}>
          <header className="section__head">
            <div>
              <h3 className="section__title">Favorites</h3>
              <div className="section__sub">Titles {displayName} hand-picked</div>
            </div>
          </header>
          <div className="pf-favs" style={{ ["--fav-size"]: `${favSize}px` } as CSSProperties}>
            {favorites.map((t) => (
              <div key={t.id} className="pf-fav">
                <Link href={`/anime/${encodeURIComponent(t.id)}`} className="pf-fav__link">
                  <span className="pf-poster pf-fav__art" style={t.cover ? undefined : genPoster(t.id)}>
                    {t.cover && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
                    )}
                  </span>
                  {t.score != null && <span className="pf-fav__score">★ {t.score % 1 === 0 ? t.score : t.score.toFixed(1)}</span>}
                  <span className="pf-fav__sub">{[t.year, t.genres[0]].filter(Boolean).join(" · ")}</span>
                  <span className="pf-fav__title">{t.title}</span>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {reviews.length > 0 && (
        <section className="section">
          <header className="section__head"><div><h3 className="section__title">Recent reviews</h3></div></header>
          {reviews.map((r) => (
            <article key={r.id} className="pf-review">
              {r.titleId ? (
                <Link href={`/community/${encodeURIComponent(r.titleId)}`}>
                  <span className="pf-poster pf-review__cover" style={r.cover ? undefined : genPoster(r.id)}>
                    {r.cover && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
                    )}
                  </span>
                </Link>
              ) : (
                <span className="pf-poster pf-review__cover" style={genPoster(r.id)} />
              )}
              <div>
                <div className="pf-review__head">
                  <span className="pf-review__title">{r.titleName ?? "Untitled"}</span>
                  <RatingBadge post={r} />
                </div>
                {r.heading && <div className="pf-review__heading">{r.heading}</div>}
                {r.body && <p className="pf-review__text">{r.body}</p>}
                <span className="pf-review__when">{timeAgo(r.createdAt)} · {r.likeCount} ♡</span>
              </div>
            </article>
          ))}
        </section>
      )}
    </Page>
  );
}
