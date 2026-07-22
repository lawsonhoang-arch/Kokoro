import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Page } from "@/shell/Page";
import { BuildClient } from "./BuildClient";
import "./build.css";

// "Build a list from notes" — paste a written list, we extract the titles and
// match them to the catalogue, then you verify the grid (and search-add any we
// missed) before it becomes a real list.
export default async function BuildPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/watchlist/build");
  return (
    <Page width="wide">
      <BuildClient />
    </Page>
  );
}
