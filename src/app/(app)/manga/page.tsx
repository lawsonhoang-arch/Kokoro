import "./manga.css";
import type { CSSProperties } from "react";
import Link from "next/link";
import { Page, PageHead } from "@/shell/Page";
import { Button } from "@/components/ui";
import { browseManga, searchCatalogFull } from "@/lib/catalog";
import { MANGA_FORMATS } from "@/features/search/constants";

// Generated gradient poster fallback (matches the rest of the catalog) when a
// manga has no cover image.
function genPoster(seed: string): CSSProperties {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  h = Math.abs(h);
  const a = h % 360;
  const bg = (a + 35 + (h % 30)) % 360;
  const ang = (h % 6) * 30;
  return { backgroundImage: `linear-gradient(${ang}deg, oklch(0.55 0.13 ${a}) 0%, oklch(0.4 0.13 ${bg}) 100%)` };
}

export default async function MangaPage() {
  // Real manga straight from the shared catalog (kind = 'manga').
  const results = await browseManga(30);
  const { total } = await searchCatalogFull("", { type: "manga" }, 1, 1);

  return (
    <Page width="wide">
      <PageHead
        eyebrow="Manga · Catalog"
        title="Browse manga"
        lede="The same catalog, search, ratings, and lists you use for anime — now for manga too. Add a title to a list to start tracking it."
        actions={
          <Link className="btn btn--primary" href="/search?type=manga">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
            Search all manga
          </Link>
        }
      />

      {/* format quick-filters → the search page, scoped to manga */}
      <nav className="subtabs" aria-label="Manga formats">
        <Link className="subtabs__tab on" href="/search?type=manga">
          All <span className="num">{total.toLocaleString()}</span>
        </Link>
        {MANGA_FORMATS.map((f) => (
          <Link key={f} className="subtabs__tab" href={`/search?type=manga&format=${encodeURIComponent(f)}`}>
            {f}
          </Link>
        ))}
      </nav>

      <section aria-label="Manga">
        <h2 className="mg-section-title">Top rated</h2>
        <div className="mg-grid">
          {results.map((m) => (
            <Link key={m.id} className="mg-card" href={`/anime/${encodeURIComponent(m.id)}`}>
              <div className="poster mg-card__poster">
                {m.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="mg-card__cover" src={m.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
                ) : (
                  <div className="mg-card__gen" style={genPoster(m.id)} aria-hidden="true" />
                )}
              </div>
              <div className="mg-card__meta-row">
                <span className="mg-card__name">{m.title}</span>
              </div>
              <div className="mg-card__sub">
                {[m.format, m.year || null, m.episodes ? `${m.episodes} ch` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </Page>
  );
}
