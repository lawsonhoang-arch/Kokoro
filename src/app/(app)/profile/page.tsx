import "./profile.css";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Page } from "@/shell/Page";
import { Avatar } from "@/components/ui";
import {
  getProfileUser,
  getProfileSummary,
  getProfileReviews,
  getProfileActivity,
} from "@/lib/profile";
import { getFavorites } from "@/lib/favorites";
import { ProfileTabs } from "./ProfileTabs";

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

  const [user, summary, reviews, activity, favorites] = await Promise.all([
    getProfileUser(userId),
    getProfileSummary(userId),
    getProfileReviews(userId),
    getProfileActivity(userId),
    getFavorites(userId),
  ]);
  if (!user) redirect("/login");

  const displayName = user.name || "@" + user.username;
  const memberSince = new Date(user.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const s = summary.stats;

  return (
    <Page width="wide">
      <div className="pf-banner" aria-hidden="true"></div>

      <header className="pf-head">
        <Avatar size="xl" hue={hueOf(user.username)} />
        <div className="pf-meta">
          <h1 className="pf-name">
            {displayName}
            {user.role !== "user" && <span className="pf-rolebadge">{user.role}</span>}
          </h1>
          <span className="pf-handle">@{user.username} · joined {memberSince}</span>
          <p className={"pf-bio" + (user.bio ? "" : " pf-bio--empty")}>
            {user.bio || "No bio yet — add one in Settings."}
          </p>
        </div>
      </header>

      <section className="pf-stats" aria-label="Profile stats">
        <div className="pf-stat">
          <div className="pf-stat__label">Tracked</div>
          <div className="pf-stat__value">{s.tracked}</div>
          <div className="pf-stat__hint">titles, all lists</div>
        </div>
        <div className="pf-stat">
          <div className="pf-stat__label">Completed</div>
          <div className="pf-stat__value">{s.completed}</div>
          <div className="pf-stat__hint">{s.watching} watching · {s.planned} planned</div>
        </div>
        <div className="pf-stat">
          <div className="pf-stat__label">Episodes</div>
          <div className="pf-stat__value">{s.episodesWatched.toLocaleString()}</div>
          <div className="pf-stat__hint">episodes watched</div>
        </div>
        <div className="pf-stat">
          <div className="pf-stat__label">Hours</div>
          <div className="pf-stat__value">{s.hours.toLocaleString()}</div>
          <div className="pf-stat__hint">~{Math.max(1, Math.round(s.hours / 24))} days of watch time</div>
        </div>
        <div className="pf-stat">
          <div className="pf-stat__label">Reviews</div>
          <div className="pf-stat__value">{s.reviews}</div>
          <div className="pf-stat__hint">posted to community</div>
        </div>
      </section>

      <ProfileTabs user={user} summary={summary} reviews={reviews} activity={activity} favorites={favorites} />
    </Page>
  );
}
