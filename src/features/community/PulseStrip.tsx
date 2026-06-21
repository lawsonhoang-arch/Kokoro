import type { TitlePulse } from "@/lib/community";

const MOODS: { key: keyof TitlePulse["mood"]; label: string }[] = [
  { key: "loved", label: "Loved" },
  { key: "liked", label: "Liked" },
  { key: "mixed", label: "Mixed" },
  { key: "dropped", label: "Dropped" },
];

// "Community pulse" — turns the catalog's rating systems into a single sentiment
// readout: an average score and a mood breakdown across all reviews. Unique to
// Kokoro, since reviews can be rated by glyphs / axes / symbols.
export function PulseStrip({ pulse }: { pulse: TitlePulse }) {
  const moodTotal = MOODS.reduce((n, m) => n + pulse.mood[m.key], 0);

  return (
    <section className="cpulse" aria-label="Community pulse">
      <div className="cpulse__score">
        <div className="cpulse__num">
          {pulse.avgScore != null ? pulse.avgScore.toFixed(1) : "—"}
          <span className="cpulse__outof">/5</span>
        </div>
        <div className="cpulse__sub">
          {pulse.reviews} {pulse.reviews === 1 ? "review" : "reviews"} ·{" "}
          {pulse.discussions} {pulse.discussions === 1 ? "discussion" : "discussions"}
        </div>
      </div>

      <div className="cpulse__mood">
        <div className="cpulse__moodlbl">Community mood</div>
        {moodTotal === 0 ? (
          <div className="cpulse__empty">No rated reviews yet — be the first to weigh in.</div>
        ) : (
          <>
            <div className="cpulse__bar">
              {MOODS.map((m) =>
                pulse.mood[m.key] > 0 ? (
                  <span
                    key={m.key}
                    className="cpulse__seg"
                    style={{ width: `${(pulse.mood[m.key] / moodTotal) * 100}%`, background: `var(--feel-${m.key})` }}
                    title={`${m.label}: ${pulse.mood[m.key]}`}
                  />
                ) : null,
              )}
            </div>
            <div className="cpulse__legend">
              {MOODS.map((m) => (
                <span key={m.key} className="cpulse__leg">
                  <span className="cpulse__dot" style={{ background: `var(--feel-${m.key})` }} />
                  {m.label} <b>{pulse.mood[m.key]}</b>
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
