import type { CSSProperties } from "react";
import Link from "next/link";
import type { TasteAffinity, TitleMatch } from "@/lib/affinity";

// a short verdict for the score, so the number has a voice
function verdict(score: number): string {
  if (score >= 85) return "Kindred taste";
  if (score >= 70) return "Strong overlap";
  if (score >= 50) return "Some common ground";
  if (score >= 30) return "Different wavelengths";
  return "Opposite taste";
}

function tier(score: number): string {
  if (score >= 70) return "hi";
  if (score >= 45) return "mid";
  return "lo";
}

const fmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1));

function Chip({ m, showScores }: { m: TitleMatch; showScores?: boolean }) {
  return (
    <Link className="pf-match__chip" href={`/anime/${encodeURIComponent(m.id)}`} title={m.title}>
      <span className="pf-match__chipart">
        {m.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
        )}
      </span>
      <span className="pf-match__chiptxt">
        <span className="pf-match__chipname">{m.title}</span>
        {showScores && (
          <span className="pf-match__chipscore">★ {fmt(m.you)} vs {fmt(m.them)}</span>
        )}
      </span>
    </Link>
  );
}

/** The "taste match" panel on someone's profile — a headline agreement score
 *  plus what you both loved and where you split. Renders nothing until there's
 *  something worth showing. */
export function TasteMatch({ affinity, name }: { affinity: TasteAffinity; name: string }) {
  const { score, shared, agreements, disagreements } = affinity;

  // no overlap at all — nothing meaningful to say yet
  if (shared === 0) return null;

  return (
    <section className="pf-match">
      <div className="pf-match__head">
        {score != null ? (
          <div className={"pf-match__badge pf-match__badge--" + tier(score)} style={{ ["--pct"]: score } as CSSProperties}>
            <span className="pf-match__pct">{score}<i>%</i></span>
          </div>
        ) : (
          <div className="pf-match__badge pf-match__badge--none">
            <span className="pf-match__pct pf-match__pct--dash">—</span>
          </div>
        )}
        <div className="pf-match__label">
          <span className="pf-match__title">
            {score != null ? verdict(score) : "Taste match"}
          </span>
          <span className="pf-match__sub">
            {score != null
              ? `You and ${name} agree on ${shared} title${shared === 1 ? "" : "s"} you've both rated`
              : `Only ${shared} shared rating${shared === 1 ? "" : "s"} so far — rate a few more titles ${name} has to unlock your match`}
          </span>
        </div>
      </div>

      {agreements.length > 0 && (
        <div className="pf-match__row">
          <span className="pf-match__rowlabel">You both loved</span>
          <div className="pf-match__chips">
            {agreements.map((m) => <Chip key={m.id} m={m} />)}
          </div>
        </div>
      )}

      {disagreements.length > 0 && (
        <div className="pf-match__row">
          <span className="pf-match__rowlabel">You split on</span>
          <div className="pf-match__chips">
            {disagreements.map((m) => <Chip key={m.id} m={m} showScores />)}
          </div>
        </div>
      )}
    </section>
  );
}
