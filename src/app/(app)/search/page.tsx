import "./search.css";
import type { CSSProperties } from "react";
import Link from "next/link";
import { Page, PageHead } from "@/shell/Page";
import { auth } from "@/auth";
import { searchCatalogFull } from "@/lib/catalog";
import type { CatalogFilters } from "@/features/search/constants";
import { SearchFilters } from "./SearchFilters";
import { StatusTag } from "@/components/StatusTag";

const PER_PAGE = 30;

function genPoster(seed: string): CSSProperties {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  h = Math.abs(h);
  const a = h % 360;
  const bg = (a + 35 + (h % 30)) % 360;
  const ang = (h % 6) * 30;
  return {
    backgroundImage: `linear-gradient(${ang}deg, oklch(0.55 0.13 ${a}) 0%, oklch(0.4 0.13 ${bg}) 100%)`,
  };
}

const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const userId = session?.user?.id;
  const q = str(sp.q);
  // every filter param, in one place (also drives the pager's query string)
  const FILTER_KEYS = [
    "type", "format", "genre", "decade", "sort",
    "airing", "length", "seasons", "score",
    "status", "feeling", "rating", "story", "art", "music", "pacing",
  ] as const satisfies readonly (keyof CatalogFilters)[];
  const filters: CatalogFilters = {};
  for (const k of FILTER_KEYS) filters[k] = str(sp[k]) || undefined;
  const page = Math.max(1, parseInt(str(sp.page) || "1", 10) || 1);

  const { results, total } = await searchCatalogFull(q, filters, page, PER_PAGE, userId);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    for (const k of FILTER_KEYS) if (filters[k]) params.set(k, filters[k]!);
    params.set("page", String(p));
    return params.toString();
  };

  return (
    <Page width="wide">
      <PageHead eyebrow="Search" title={q ? `Results for “${q}”` : "Browse the catalog"} />

      <SearchFilters />

      <div className="srch-count">
        {total.toLocaleString()} {total === 1 ? "result" : "results"}
        {q ? " · closest match first" : " · refine with the filters"}
      </div>

      {results.length === 0 ? (
        <div className="srch-empty">
          No titles match{q ? ` “${q}”` : ""} with those filters. Try a different term or clear the
          filters.
        </div>
      ) : (
        <div className="srch-grid">
          {results.map((r) => {
            const unit = r.episodes ? `${r.episodes} ${r.kind === "manga" ? "ch" : "ep"}` : null;
            return (
              <Link key={r.id} className="srch-card" href={`/anime/${encodeURIComponent(r.id)}`}>
                <div className="srch-card__art">
                  {r.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
                  ) : (
                    <div className="srch-card__gen" style={genPoster(r.id)} aria-hidden="true" />
                  )}
                  {r.kind === "manga" && <span className="srch-card__kind">Manga</span>}
                  <StatusTag kind={r.kind} status={r.status} overlay />
                </div>
                <div className="srch-card__title">{r.title}</div>
                <div className="srch-card__meta">
                  {[r.format, r.year, unit].filter(Boolean).join(" · ")}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="srch-pager">
          <Link
            className="srch-pager__btn"
            href={`/search?${qs(page - 1)}`}
            aria-disabled={page <= 1}
          >
            ← Prev
          </Link>
          <span className="srch-pager__pos">
            Page {page} of {totalPages}
          </span>
          <Link
            className="srch-pager__btn"
            href={`/search?${qs(page + 1)}`}
            aria-disabled={page >= totalPages}
          >
            Next →
          </Link>
        </div>
      )}
    </Page>
  );
}
