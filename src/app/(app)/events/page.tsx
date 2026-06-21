import "./events-admin.css";
import "@/shell/event-banner.css";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Page, PageHead } from "@/shell/Page";
import { isModerator } from "@/lib/submissions";
import { getAllBanners } from "@/lib/banners";
import { EventsAdmin } from "./EventsAdmin";

// In-app editor for the Home event banner. Moderators/admins only.
export default async function EventsAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!isModerator(session.user.role)) redirect("/home");

  const banners = await getAllBanners();
  // serialize dates to ISO for the client editor
  const initial = banners.map((b) => ({
    ...b,
    startsAt: b.startsAt ? b.startsAt.toISOString() : null,
    endsAt: b.endsAt ? b.endsAt.toISOString() : null,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }));

  return (
    <Page width="wide">
      <PageHead
        eyebrow="Events · Admin"
        title="Home event banner"
        lede="The big banner at the top of Home. Set it active (and an optional start/end window) to show it during an event. Only the top active banner shows. Edit from any device."
      />
      <EventsAdmin initialBanners={initial} />
    </Page>
  );
}
