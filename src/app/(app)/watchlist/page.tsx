import "./gallery.css";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getWatchlists } from "@/lib/watchlists";
import { GalleryClient } from "./GalleryClient";

// The Watchlist tab's landing: a gallery of the signed-in user's watchlists,
// fetched from Supabase and persisted via Server Actions (see actions.ts).
export default async function GalleryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const initialLists = await getWatchlists(session.user.id);
  return <GalleryClient initialLists={initialLists} />;
}
