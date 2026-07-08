import "./calendar.css";
import Link from "next/link";
import { auth } from "@/auth";
import { Page, PageHead } from "@/shell/Page";
import { isModerator } from "@/lib/submissions";
import { getEventsInRange, getTrackedTitles, getSeasonalPremieres } from "@/lib/calendar";
import { CalendarClient, type EventLite } from "./CalendarClient";

// local YYYY-MM-DD for a given year/month/day
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export default async function CalendarPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const isMod = isModerator(session?.user?.role);

  // Fetch a wide window (last month → next ~12 months) so month navigation on
  // the client rarely needs a refetch.
  const now = new Date();
  const from = iso(now.getFullYear(), now.getMonth() - 1, 1);
  const to = iso(now.getFullYear(), now.getMonth() + 12, 28);

  const [events, tracked, seasonalPremieres] = await Promise.all([
    getEventsInRange(from, to),
    userId ? getTrackedTitles(userId) : Promise.resolve([]),
    getSeasonalPremieres(),
  ]);

  const lite: EventLite[] = events.map((e) => ({
    id: e.id,
    kind: e.kind,
    title: e.title,
    subtitle: e.subtitle,
    startsOn: e.startsOn,
    endsOn: e.endsOn,
    location: e.location,
    url: e.url,
    cover: e.cover,
    accent: e.accent,
    hue: e.hue,
    titleId: e.titleId,
  }));

  // Fold in the current season's premieres, skipping any title an admin already
  // placed and any that fall outside the visible window.
  const curatedTitleIds = new Set(events.map((e) => e.titleId).filter(Boolean));
  for (const p of seasonalPremieres) {
    if (p.startsOn < from || p.startsOn > to) continue;
    if (curatedTitleIds.has(p.titleId)) continue;
    lite.push(p);
  }

  return (
    <Page width="wide">
      <PageHead
        eyebrow="Calendar"
        title="Release calendar"
        lede="Major anime events, premieres of anticipated titles, and the weekly releases of every show you're tracking."
        actions={
          isMod ? (
            <Link className="btn btn--primary" href="/calendar/admin">
              Manage events
            </Link>
          ) : undefined
        }
      />
      <CalendarClient events={lite} tracked={tracked} />
    </Page>
  );
}
