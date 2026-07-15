import "./stats.css";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Page, PageHead } from "@/shell/Page";
import { getStats } from "@/lib/stats";
import { StatsExplorer, StatsEmpty } from "./StatsExplorer";

export const metadata = { title: "Your stats · Kokoro" };

export default async function StatsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const data = await getStats(session.user.id);

  return (
    <Page width="wide">
      <PageHead
        eyebrow="You"
        title="Your stats"
        lede="Distributions and breakdowns across everything you track."
        actions={<Link className="st-back" href="/profile">← Profile</Link>}
      />
      {data.empty ? <StatsEmpty /> : <StatsExplorer data={data} />}
    </Page>
  );
}
