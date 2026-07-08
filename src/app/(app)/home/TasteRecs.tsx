import { SectionHead } from "@/components/SectionHead";
import { TitleCard } from "./TitleCard";
import { getForYou } from "@/lib/recommend";

// Personalised recommendations — titles loved by people whose taste matches
// yours, or (until you have taste-neighbours) acclaimed blind spots in your
// favourite genres. Streamed via <Suspense> so it never blocks the main Home.
export async function TasteRecs({ userId }: { userId: string }) {
  const fy = await getForYou(userId, 14);
  if (fy.recs.length === 0) return null;
  return (
    <section className="section">
      <SectionHead title={fy.heading} sub={fy.sub} />
      <div className={"shelf shelf--recs shelf--recs-" + fy.mode} role="list">
        {fy.recs.map((r) => (
          <TitleCard key={r.id} item={r} sub={r.reason} />
        ))}
      </div>
    </section>
  );
}
