import "./journal.css";
import "@/styles/rating-control.css";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Page, PageHead } from "@/shell/Page";
import { getJournalEntries } from "@/lib/journal";
import { JournalAppLoader } from "./JournalAppLoader";

// Private, per-user journal: a rail of titles you've written about and a timeline
// of notes for the selected one, with an in-place composer.
export default async function JournalPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const entries = await getJournalEntries(session.user.id);
  const now = Date.now();

  return (
    <Page width="wide">
      <PageHead
        eyebrow="Journal · Private notes"
        title="What you've been thinking about"
        lede="A private space for episode-by-episode notes, quotes worth keeping, and the feelings a show left you with. Only you can see this."
      />
      <JournalAppLoader entries={entries} now={now} />
    </Page>
  );
}
