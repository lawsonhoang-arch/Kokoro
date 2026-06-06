import "@/styles/watchlist.css";
import "@/features/watchlist/watchlist-page.css";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getWatchlist } from "@/lib/watchlists";
import { getWatchlistEntries } from "@/lib/entries";
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

  const entries = await getWatchlistEntries(session.user.id, list.id);

  return (
    <WatchlistAppLoader id={list.id} title={list.title} hue={list.hue} initialEntries={entries} />
  );
}
