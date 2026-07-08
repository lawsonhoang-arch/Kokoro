import "./calendar-admin.css";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Page, PageHead } from "@/shell/Page";
import { isModerator } from "@/lib/submissions";
import { getAllEvents } from "@/lib/calendar";
import { CalendarAdmin } from "./CalendarAdmin";

// In-app editor for calendar events + premieres. Moderators/admins only.
export default async function CalendarAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!isModerator(session.user.role)) redirect("/calendar");

  const events = await getAllEvents();

  return (
    <Page width="wide">
      <PageHead
        eyebrow="Calendar · Admin"
        title="Manage events & premieres"
        lede="Add conventions, festivals, and hand-picked premieres. Published entries show on everyone's calendar. Edit from any device."
      />
      <CalendarAdmin initialEvents={events} />
    </Page>
  );
}
