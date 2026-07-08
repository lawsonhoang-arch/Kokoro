import "./mood.css";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Page, PageHead } from "@/shell/Page";
import { MOODS, getMood, getMoodTitles } from "@/lib/mood";
import { TitleCard } from "../home/TitleCard";

// Feeling-first discovery: pick a vibe, get the best-loved anime that deliver it.
export default async function MoodPage({ searchParams }: { searchParams: Promise<{ vibe?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { vibe } = await searchParams;
  const active = vibe ? getMood(vibe) : null;
  const results = active ? await getMoodTitles(active.key, 24) : [];

  return (
    <Page width="wide">
      <PageHead
        eyebrow="Discover"
        title="What are you in the mood for?"
        lede="Pick a feeling — we'll pull the best-loved anime that actually deliver it."
      />

      <div className="mood-picker">
        {MOODS.map((m) => (
          <Link key={m.key} href={`/mood?vibe=${m.key}`} className={"mood-card mood-card--h" + m.hue + (active?.key === m.key ? " on" : "")}>
            <span className="mood-card__emoji" aria-hidden="true">{m.emoji}</span>
            <span className="mood-card__label">{m.label}</span>
            <span className="mood-card__tag">{m.tagline}</span>
          </Link>
        ))}
      </div>

      {active && (
        <section className="section mood-results">
          <header className="section__head">
            <div>
              <h3 className="section__title">{active.emoji} {active.label}</h3>
              <div className="section__sub">{active.tagline}</div>
            </div>
          </header>
          {results.length === 0 ? (
            <p className="mood-empty">Nothing surfaced for this mood right now — try another.</p>
          ) : (
            <div className="mood-grid">
              {results.map((r) => <TitleCard key={r.id} item={r} />)}
            </div>
          )}
        </section>
      )}
    </Page>
  );
}
