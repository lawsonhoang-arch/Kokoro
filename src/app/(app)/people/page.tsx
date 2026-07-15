import "./people.css";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Page, PageHead } from "@/shell/Page";
import { UserCard } from "@/features/social/UserCard";
import { getSimilarPeople } from "@/lib/discover";
import { getSuggestedPeople } from "@/lib/onboarding";
import { getTasteAffinityBulk } from "@/lib/affinity";
import type { UserLite } from "@/lib/follows";
import { UserSearch } from "./UserSearch";
import { InviteCard } from "./InviteCard";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const username = session.user.username ?? "";

  const [similar, suggested] = await Promise.all([
    getSimilarPeople(userId, 12),
    getSuggestedPeople(userId, 16),
  ]);

  // "Popular" = suggested minus anyone already shown in the similar-taste row
  const shown = new Set(similar.list.map((u) => u.id));
  const popular: UserLite[] = suggested
    .filter((u) => !shown.has(u.id))
    .map((u) => ({ id: u.id, username: u.username, name: u.name, image: u.image, bio: u.bio, viewerFollows: false }));
  const popularMatches = await getTasteAffinityBulk(userId, popular.map((u) => u.id));

  return (
    <Page width="wide">
      <PageHead
        title="Find people"
        lede="Discover readers and watchers who share your taste — then follow along."
      />

      {username && <InviteCard username={username} />}

      <UserSearch viewerId={userId} />

      {similar.list.length > 0 && (
        <section className="ppl-sec">
          <header className="ppl-sec__head">
            <h2 className="ppl-sec__title">Similar taste</h2>
            <p className="ppl-sec__sub">Ranked by how closely your ratings agree</p>
          </header>
          <div className="usercard-list">
            {similar.list.map((u) => (
              <UserCard key={u.id} user={u} viewerId={userId} match={similar.matches.get(u.id)} />
            ))}
          </div>
        </section>
      )}

      {popular.length > 0 && (
        <section className="ppl-sec">
          <header className="ppl-sec__head">
            <h2 className="ppl-sec__title">{similar.list.length > 0 ? "More people" : "Popular on Kokoro"}</h2>
            <p className="ppl-sec__sub">Active members worth a follow</p>
          </header>
          <div className="usercard-list">
            {popular.map((u) => (
              <UserCard key={u.id} user={u} viewerId={userId} match={popularMatches.get(u.id)} />
            ))}
          </div>
        </section>
      )}

      {similar.list.length === 0 && popular.length === 0 && (
        <p className="usercard-empty">
          No suggestions yet — rate a few titles so we can match your taste, or search by name above.
        </p>
      )}
    </Page>
  );
}
