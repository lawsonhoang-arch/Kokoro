import "./editorial-admin.css";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Page, PageHead } from "@/shell/Page";
import { isModerator } from "@/lib/submissions";
import { getAllPicks } from "@/lib/editorial";
import { EditorialAdmin } from "./EditorialAdmin";

// In-app editor for the Home page's editorial picks. Moderators/admins only.
export default async function EditorialAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!isModerator(session.user.role)) redirect("/home");

  const picks = await getAllPicks();

  return (
    <Page width="wide">
      <PageHead
        eyebrow="Editorial · Admin"
        title="Edit the Home picks"
        lede="Add, edit, reorder, and publish the editorial cards on the Home page. Changes go live immediately — edit from any device."
      />
      <EditorialAdmin initialPicks={picks} />
    </Page>
  );
}
