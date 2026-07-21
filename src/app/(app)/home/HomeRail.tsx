import Link from "next/link";
import type { CSSProperties } from "react";
import type { SearchResult } from "@/features/search/types";
import { hueValue } from "@/lib/palette";
import type { Watchlist } from "@/lib/storage";
import type { TrackedTitle } from "@/lib/calendar";

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// generated poster gradient for a title without cover art
function gen(seed: string): CSSProperties {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  h = Math.abs(h);
  const a = h % 360;
  return { backgroundImage: `linear-gradient(135deg, oklch(0.5 0.13 ${a}), oklch(0.34 0.12 ${(a + 40) % 360}))` };
}

// A compact ranked "top rated" panel (1 · cover · title) for the rail.
function RankedPanel({ title, items, moreHref }: { title: string; items: SearchResult[]; moreHref: string }) {
  if (items.length === 0) return null;
  return (
    <section className="hrail-card card">
      <div className="hrail-card__head">
        <h2 className="hrail-card__title">{title}</h2>
        <Link className="hrail-card__more" href={moreHref}>See all →</Link>
      </div>
      <ol className="hrail-list hrail-top">
        {items.slice(0, 6).map((it, i) => (
          <li key={it.id}>
            <Link className="hrail-toprow" href={`/anime/${encodeURIComponent(it.id)}`}>
              <span className="hrail-toprow__rank">{i + 1}</span>
              <span className="hrail-toprow__cover" style={it.cover ? undefined : gen(it.id)}>
                {it.cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
                )}
              </span>
              <span className="hrail-toprow__body">
                <span className="hrail-toprow__title">{it.title}</span>
                <span className="hrail-toprow__meta">{[it.format, it.year].filter(Boolean).join(" · ")}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

// The home page's right rail. Leads with the signed-in user's own library —
// what airs next + their lists — then the catalog's top-rated anime & manga
// and upcoming titles. Server component.
export function HomeRail({
  upcoming,
  lists,
  tracked,
  topAnime,
  topManga,
}: {
  upcoming: SearchResult[];
  lists: Watchlist[];
  tracked: TrackedTitle[];
  topAnime: SearchResult[];
  topManga: SearchResult[];
}) {
  const now = new Date();

  // "up next this week": tracked shows with a known broadcast day, soonest first
  const todayDow = now.getDay();
  const upnext = tracked
    .filter((t) => t.weekday != null)
    .map((t) => ({ t, delta: ((t.weekday! - todayDow) + 7) % 7 }))
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 5);
  const dayLabel = (delta: number, wd: number) =>
    delta === 0 ? "Today" : delta === 1 ? "Tomorrow" : WD[wd];

  return (
    <aside className="home-rail" aria-label="Your library, news and community">
      {/* LEAD — the signed-in user's own library. On phones this group is
          lifted to sit right after the hero (see home.css), so a returning user
          reaches their up-next and lists without scrolling past every
          discovery shelf. */}
      <div className="home-rail__lead">
      {upnext.length > 0 && (
        <section className="hrail-card card">
          <div className="hrail-card__head">
            <h2 className="hrail-card__title">Up next this week</h2>
            <Link className="hrail-card__more" href="/calendar">Calendar →</Link>
          </div>
          <ul className="hrail-list">
            {upnext.map(({ t, delta }) => (
              <li key={t.titleId}>
                <Link className="hrail-next" href={`/anime/${encodeURIComponent(t.titleId)}`}>
                  <span className="hrail-next__meta">
                    <span className="hrail-next__day">{dayLabel(delta, t.weekday!)}</span>
                    {t.time && <span className="hrail-next__time">{t.time} JST</span>}
                  </span>
                  <span className="hrail-next__title">{t.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lists.length > 0 && (
        <section className="hrail-card card">
          <div className="hrail-card__head">
            <h2 className="hrail-card__title">Your lists</h2>
            <Link className="hrail-card__more" href="/watchlist">Manage →</Link>
          </div>
          <ul className="hrail-list">
            {lists.slice(0, 5).map((l) => (
              <li key={l.id}>
                <Link className="hrail-mylist" href={`/watchlist/${encodeURIComponent(l.id)}`} style={{ ["--h"]: hueValue(l.hue) } as CSSProperties}>
                  <span className="hrail-mylist__title">{l.title}</span>
                  <span className="hrail-mylist__meta">
                    {l.titleCount} {l.titleCount === 1 ? "title" : "titles"}
                    {l.watching > 0 ? ` · ${l.watching} watching` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      </div>

      {/* REST — catalogue discovery. Trails the shelves on phones. */}
      <div className="home-rail__rest">
      <RankedPanel title="Top rated anime" items={topAnime} moreHref="/search?type=anime&sort=rated" />
      <RankedPanel title="Top rated manga" items={topManga} moreHref="/search?type=manga&sort=rated" />

      {upcoming.length > 0 && (
        <section className="hrail-card card">
          <div className="hrail-card__head">
            <h2 className="hrail-card__title">Upcoming</h2>
            <Link className="hrail-card__more" href="/search?type=anime&sort=newest">See all →</Link>
          </div>
          <ul className="hrail-list">
            {upcoming.map((u) => (
              <li key={u.id}>
                <Link className="hrail-up" href={`/anime/${encodeURIComponent(u.id)}`}>
                  {u.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="hrail-up__cover" src={u.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
                  ) : (
                    <span className="hrail-up__cover" />
                  )}
                  <span className="hrail-up__txt">
                    <span className="hrail-up__title">{u.title}</span>
                    <span className="hrail-up__meta">
                      {[u.format, u.year ? `${u.year}` : null].filter(Boolean).join(" · ") || "TBA"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>
    </aside>
  );
}
