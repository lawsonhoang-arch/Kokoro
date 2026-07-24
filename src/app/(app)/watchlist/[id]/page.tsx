import "@/styles/watchlist.css";
import "@/features/watchlist/watchlist-page.css";
import "@/features/watchlist/list-table.css";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getWatchlist } from "@/lib/watchlists";
import { getWatchlistEntries } from "@/lib/entries";
import { getGroups } from "@/lib/groups";
import { getRules, getTabs } from "@/lib/list-sync";
import { WatchlistAppLoader } from "@/features/watchlist/WatchlistAppLoader";

// Server Component: auth-gates, verifies the signed-in user owns this list,
// then hands its title + hue to the client app (which applies the hue as
// --accent). 404 if the list doesn't exist or isn't theirs.
export default async function WatchlistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const list = await getWatchlist(session.user.id, id);
  if (!list) notFound();

  const [entries, loadedGroups, savedRules, savedTabs] = await Promise.all([
    getWatchlistEntries(session.user.id, list.id),
    getGroups(session.user.id, list.id),
    getRules(session.user.id, list.id),
    getTabs(session.user.id, list.id),
  ]);

  // fold each collection's saved scoped rules back onto it (getGroups returns
  // them empty — rules live in their own table so they can sync per-device)
  const initialGroups = loadedGroups.map((g) => ({
    ...g,
    scoped: savedRules.scoped[g.id] ?? g.scoped,
  }));

  return (
    <WatchlistAppLoader
      id={list.id}
      title={list.title}
      hue={list.hue}
      initialEntries={entries}
      initialCustomAxes={list.customAxes}
      initialGroups={initialGroups}
      initialGlobals={savedRules.globals}
      initialTabOrder={savedTabs.tabOrder}
      initialBoardName={savedTabs.boardName}
    />
  );
}
