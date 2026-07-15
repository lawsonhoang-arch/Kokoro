import "./wrapped.css";
import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Page } from "@/shell/Page";
import { getWrapped, type WrappedScope, type WrappedMood } from "@/lib/wrapped";

function genPoster(seed: string): CSSProperties {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  h = Math.abs(h);
  const a = h % 360;
  return { backgroundImage: `linear-gradient(135deg, oklch(0.55 0.13 ${a}), oklch(0.4 0.13 ${(a + 40) % 360}))` };
}

const MOODS: { key: keyof WrappedMood; label: string }[] = [
  { key: "loved", label: "Loved" },
  { key: "liked", label: "Liked" },
  { key: "mixed", label: "Mixed" },
  { key: "dropped", label: "Dropped" },
];

export default async function WrappedPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { year } = await searchParams;

  const scope: WrappedScope = year && /^\d{4}$/.test(year) ? Number(year) : "all";
  const w = await getWrapped(session.user.id, scope);
  const scopeLabel = w.scope === "all" ? "All time" : String(w.scope);

  if (!w.hasData) {
    return (
      <Page width="narrow">
        <div className="wr wr--empty">
          <span className="wr__eyebrow">Kokoro Wrapped</span>
          <h1 className="wr__emptytitle">Nothing to wrap yet</h1>
          <p className="wr__emptytext">
            Track and rate a few titles — or <Link href="/watchlist?import=1">import your list</Link> — and your recap will fill in
            with your hours, genres, moods and the shows you couldn&apos;t stop thinking about.
          </p>
        </div>
      </Page>
    );
  }

  const days = Math.max(1, Math.round(w.hours / 24));
  const dom = MOODS.reduce((a, b) => (w.mood[b.key] > w.mood[a.key] ? b : a), MOODS[0]);
  const domPct = w.moodTotal ? Math.round((w.mood[dom.key] / w.moodTotal) * 100) : 0;
  const genreMax = w.topGenres[0]?.n || 1;
  const totalMedia = w.animeCompleted + w.mangaCompleted;
  const animePct = totalMedia ? Math.round((w.animeCompleted / totalMedia) * 100) : 0;

  return (
    <Page width="default">
      <div className="wr">
        {/* hero */}
        <header className="wr__hero">
          <span className="wr__eyebrow">Kokoro Wrapped · {scopeLabel}</span>
          <h1 className="wr__title">Your taste, in one look</h1>
          <p className="wr__taste">{w.tasteLine}</p>
          {(w.years.length > 0) && (
            <nav className="wr__scope" aria-label="Period">
              <Link className={"wr__scopebtn" + (w.scope === "all" ? " on" : "")} href="/wrapped">All time</Link>
              {w.years.map((y) => (
                <Link key={y} className={"wr__scopebtn" + (w.scope === y ? " on" : "")} href={`/wrapped?year=${y}`}>{y}</Link>
              ))}
            </nav>
          )}
        </header>

        {/* headline numbers */}
        <section className="wr__big">
          <div className="wr__stat wr__stat--hero">
            <span className="wr__stat-num">{w.hours.toLocaleString()}</span>
            <span className="wr__stat-lbl">hours watched</span>
            <span className="wr__stat-sub">≈ {days} day{days === 1 ? "" : "s"} of your life, well spent</span>
          </div>
          <div className="wr__stat">
            <span className="wr__stat-num">{w.completed.toLocaleString()}</span>
            <span className="wr__stat-lbl">titles completed</span>
          </div>
          <div className="wr__stat">
            <span className="wr__stat-num">{w.episodes.toLocaleString()}</span>
            <span className="wr__stat-lbl">episodes</span>
          </div>
          {w.chapters > 0 && (
            <div className="wr__stat">
              <span className="wr__stat-num">{w.chapters.toLocaleString()}</span>
              <span className="wr__stat-lbl">chapters read</span>
            </div>
          )}
        </section>

        {/* mood */}
        {w.moodTotal > 0 && (
          <section className="wr__card wr__mood">
            <div className="wr__card-head">
              <h2 className="wr__card-title">How it felt</h2>
              <span className="wr__card-note"><b className={"wr__dom wr__dom--" + dom.key}>{domPct}% {dom.label.toLowerCase()}</b> · {w.moodTotal.toLocaleString()} rated</span>
            </div>
            <div className="wr__moodbar" role="img" aria-label="Mood breakdown">
              {MOODS.map((m) => {
                const pct = (w.mood[m.key] / w.moodTotal) * 100;
                if (pct <= 0) return null;
                return <span key={m.key} className={"wr__moodseg wr__moodseg--" + m.key} style={{ width: pct + "%" }} title={`${m.label}: ${w.mood[m.key]}`} />;
              })}
            </div>
            <div className="wr__moodkey">
              {MOODS.map((m) => w.mood[m.key] > 0 && (
                <span key={m.key} className="wr__moodkeyitem">
                  <span className={"wr__dot wr__dot--" + m.key} /> {m.label} <b>{w.mood[m.key]}</b>
                </span>
              ))}
            </div>
          </section>
        )}

        <div className="wr__grid">
          {/* top genres */}
          {w.topGenres.length > 0 && (
            <section className="wr__card">
              <h2 className="wr__card-title">Your genres</h2>
              <div className="wr__genres">
                {w.topGenres.map((g, i) => (
                  <div key={g.genre} className="wr__genre">
                    <span className="wr__genre-rank">{i + 1}</span>
                    <span className="wr__genre-name">{g.genre}</span>
                    <span className="wr__genre-bar"><span style={{ width: Math.round((g.n / genreMax) * 100) + "%" }} /></span>
                    <span className="wr__genre-n">{g.n}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* anime vs manga + rewatch champion */}
          <section className="wr__card wr__side">
            {totalMedia > 0 && (
              <div className="wr__split">
                <h2 className="wr__card-title">Anime vs manga</h2>
                <div className="wr__splitbar">
                  <span className="wr__splitseg wr__splitseg--a" style={{ width: animePct + "%" }} />
                  <span className="wr__splitseg wr__splitseg--m" style={{ width: 100 - animePct + "%" }} />
                </div>
                <div className="wr__splitkey">
                  <span><span className="wr__dot wr__dot--a" /> {w.animeCompleted} anime</span>
                  <span><span className="wr__dot wr__dot--m" /> {w.mangaCompleted} manga</span>
                </div>
              </div>
            )}
            {w.rewatchChampion && (
              <div className="wr__champ">
                <h2 className="wr__card-title">You kept coming back</h2>
                <div className="wr__champ-row">
                  <span className="wr__champ-art" style={w.rewatchChampion.cover ? undefined : genPoster(w.rewatchChampion.title)}>
                    {w.rewatchChampion.cover && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={w.rewatchChampion.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
                    )}
                  </span>
                  <span className="wr__champ-txt">
                    <b className="wr__champ-title">{w.rewatchChampion.title}</b>
                    <span className="wr__champ-sub">rewatched {w.rewatchChampion.count}×</span>
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* showcase — the titles that define you */}
        {w.showcase.length > 0 && (
          <section className="wr__card">
            <h2 className="wr__card-title">Titles that define you</h2>
            <div className="wr__showcase">
              {w.showcase.map((t) => (
                <Link key={t.id} className="wr__show" href={`/anime/${encodeURIComponent(t.id)}`} title={t.title}>
                  <span className="wr__show-art" style={t.cover ? undefined : genPoster(t.id)}>
                    {t.cover && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
                    )}
                    <span className="wr__show-badge">{t.value}</span>
                  </span>
                  <span className="wr__show-title">{t.title}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* period highlights */}
        {w.scope !== "all" && (
          <section className="wr__card wr__period">
            <h2 className="wr__card-title">In {w.scope}</h2>
            <div className="wr__periodgrid">
              <div className="wr__pstat"><b>{w.periodFinished}</b><span>finished</span></div>
              <div className="wr__pstat"><b>{w.periodHours}</b><span>hours</span></div>
              <div className="wr__pstat"><b>{w.periodNotes}</b><span>notes written</span></div>
              <div className="wr__pstat"><b>{w.periodRewatches}</b><span>rewatches</span></div>
              <div className="wr__pstat"><b>{w.periodFavorites}</b><span>favourited</span></div>
            </div>
          </section>
        )}

        <p className="wr__foot">Kokoro · {scopeLabel}</p>
      </div>
    </Page>
  );
}
