import "./review.css";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Page, PageHead } from "@/shell/Page";
import { isModerator, getPendingSubmissions } from "@/lib/submissions";
import { ReviewQueue } from "./ReviewQueue";

// Moderator-gated description review queue.
export default async function ReviewPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isModerator(session.user.role)) redirect("/home");

  const pending = await getPendingSubmissions();

  return (
    <Page width="narrow">
      <PageHead
        eyebrow="Moderation"
        title="Description review"
        lede="Approve community-written descriptions to publish them, or reject them. Approved text becomes the title's official description, credited to its author."
      />
      <ReviewQueue initial={pending} />
    </Page>
  );
}
