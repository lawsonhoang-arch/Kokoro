import "../../../profile/profile.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Page, PageHead } from "@/shell/Page";
import { getUserIdByUsername, getProfileUser } from "@/lib/profile";
import { getFollowers } from "@/lib/follows";
import { getTasteAffinityBulk } from "@/lib/affinity";
import { UserCard } from "@/features/social/UserCard";

export default async function FollowersPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const session = await auth();
  const viewerId = session?.user?.id;
  const userId = await getUserIdByUsername(decodeURIComponent(username));
  if (!userId) notFound();
  const [user, list] = await Promise.all([getProfileUser(userId), getFollowers(userId, viewerId)]);
  if (!user) notFound();
  const matches = await getTasteAffinityBulk(viewerId, list.map((u) => u.id));

  return (
    <Page width="wide">
      <PageHead
        eyebrow={<Link href={`/u/${encodeURIComponent(user.username)}`}>← @{user.username}</Link>}
        title="Followers"
        lede={`People following ${user.name || "@" + user.username}`}
        actions={<Link className="pf-share" href="/people">Find people</Link>}
      />
      {list.length === 0 ? (
        <p className="usercard-empty">No followers yet.</p>
      ) : (
        <div className="usercard-list">
          {list.map((u) => <UserCard key={u.id} user={u} viewerId={viewerId} match={matches.get(u.id)} />)}
        </div>
      )}
    </Page>
  );
}
