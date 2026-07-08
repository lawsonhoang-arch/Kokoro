import "./import.css";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Page, PageHead } from "@/shell/Page";
import { ImportClient } from "./ImportClient";

// Bring an existing anime/manga list over from AniList or MyAnimeList so taste
// affinity, stats, and recommendations light up from day one.
export default async function ImportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <Page width="narrow">
      <PageHead
        eyebrow="Import"
        title="Bring your list with you"
        lede="Already track on AniList or MyAnimeList? Import it in one step — your statuses and scores come along, and everything you've built up starts working right away."
      />
      <ImportClient />
    </Page>
  );
}
