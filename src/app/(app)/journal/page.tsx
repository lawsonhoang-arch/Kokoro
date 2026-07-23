import "./journal.css";
import "@/styles/rating-control.css";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Page, PageHead } from "@/shell/Page";
import { getJournalEntries } from "@/lib/journal";
import { getUserActivity } from "@/lib/activity";
import { JournalAppLoader } from "./JournalAppLoader";

// Private, per-user diary: a rail of titles you've engaged with and a timeline of
// notes woven together with what you marked watched and favourited.
export default async function JournalPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [entries, activityAll] = await Promise.all([
    getJournalEntries(session.user.id),
    getUserActivity(session.user.id, 300),
  ]);
  // journal notes already arrive via `entries`; weave in only the non-note events
  const activity = activityAll
    .filter((e) => (e.kind === "completed" || e.kind === "favorited" || e.kind === "rewatched") && e.title)
    .map((e) => ({
      id: e.id,
      kind: e.kind as "completed" | "favorited" | "rewatched",
      at: e.at.toISOString(),
      titleId: e.title!.id,
      title: e.title!.name,
      cover: e.title!.cover,
      ordinal: e.ordinal,
    }));
  // eslint-disable-next-line react-hooks/purity -- server render, once per request
  const now = Date.now();

  return (
    <Page width="wide">
      <PageHead title="Your journal" />
      <JournalAppLoader entries={entries} activity={activity} now={now} />
    </Page>
  );
}
