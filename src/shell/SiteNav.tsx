"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/lib/auth-actions";
import { getLastList } from "@/lib/lastList";
import { NavSearch } from "./NavSearch";

type NavUser = {
  name?: string | null;
  email?: string | null;
  username?: string | null;
  role?: string | null;
} | null;

const TABS = [
  { id: "home", label: "Home", href: "/home" },
  { id: "watchlist", label: "Lists", href: "/watchlist" },
  { id: "journal", label: "Journal", href: "/journal" },
  { id: "community", label: "Community", href: "/community" },
  { id: "news", label: "News", href: "/news" },
  { id: "manga", label: "Manga", href: "/manga" },
] as const;

// Compact glyphs the tabs collapse to while the search bar is expanded.
const TAB_ICONS: Record<string, ReactNode> = {
  home: <path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />,
  watchlist: (
    <>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  journal: (
    <>
      <path d="M6 4h12a1 1 0 0 1 1 1v15H7a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1z" />
      <path d="M9 4v16" />
    </>
  ),
  community: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c0-3 2.8-4.5 5.5-4.5S14.5 16 14.5 19" />
      <path d="M16 6a3 3 0 0 1 0 6M20.5 19c0-2.2-1.4-3.6-3.5-4.2" />
    </>
  ),
  news: (
    <>
      <path d="M4 5h13a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5z" />
      <path d="M18 8h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2" />
      <path d="M7 8h7M7 11h7M7 14h5" />
    </>
  ),
  manga: (
    <>
      <path d="M12 6c-1.6-1-4-1.5-6-1.5S2.6 5 2 5.5v13c.6-.5 2.4-1 4-1s4.4.5 6 1.5" />
      <path d="M12 6c1.6-1 4-1.5 6-1.5s3.4.5 4 1v13c-.6-.5-2.4-1-4-1s-4.4.5-6 1.5" />
      <path d="M12 6v13.5" />
    </>
  ),
};

function activeFromPath(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean)[0] ?? "home";
  // the catalog/anime pages belong under the Watchlist tab visually
  if (seg === "search" || seg === "anime") return "watchlist";
  return seg;
}

export function SiteNav({ user }: { user: NavUser }) {
  const pathname = usePathname();
  const active = activeFromPath(pathname);
  // The Lists tab returns to the list the user last had open (if any), so they
  // don't have to re-pick one each visit. Read after mount + on every nav so it
  // stays fresh; null on the server keeps SSR markup matching (no hydration gap).
  const [lastListId, setLastListId] = useState<string | null>(null);
  useEffect(() => {
    setLastListId(getLastList());
  }, [pathname]);
  // Search collapses to a circle inside the centered tab group; clicking it
  // expands the bar inline and pushes the tabs aside. Labels fold to icons only
  // when the expanded bar wouldn't otherwise fit — measured, not assumed.
  const [searchOpen, setSearchOpen] = useState(false);
  const [cramped, setCramped] = useState(false);
  const isMod = user && (user.role === "moderator" || user.role === "admin");

  const navRef = useRef<HTMLElement>(null);
  const brandRef = useRef<HTMLAnchorElement>(null);
  const tabsRef = useRef<HTMLOListElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // cached intrinsic widths (stable across renders; refreshed when measurable)
  const labelsW = useRef(0); // tab row width with labels shown (gaps incl.)
  const brandW = useRef(0);
  const endW = useRef(0); // right-hand controls (avatar / sign-out / review)
  const crampedRef = useRef(false);
  const searchOpenRef = useRef(false);

  const recompute = useCallback(() => {
    const nav = navRef.current;
    const tabs = tabsRef.current;
    const brand = brandRef.current;
    const end = endRef.current;
    if (!nav || !tabs || !brand || !end) return;

    // Refresh cached widths only while labels are visible, so a collapsed
    // state never feeds back on itself (no oscillation). The tab row is a
    // natural-width flex item, so its own width already includes the gaps.
    if (!crampedRef.current) {
      const tw = tabs.getBoundingClientRect().width;
      if (tw > 0) labelsW.current = tw;
      // endRef holds the fixed right cluster (avatar / sign-out / review).
      endW.current = end.getBoundingClientRect().width || endW.current;
    }
    brandW.current = brand.getBoundingClientRect().width || brandW.current;

    // Centered group [tabs + search]. The left/right sections are equal width,
    // so each must clear the wider of {brand, controls, 150px floor}. When the
    // search is collapsed it's just a circle; when open it expands, so only then
    // might the labels need to fold to icons to make room.
    // padding(56) + nav gaps(36) + groupGap(22) + tabs + search + 2·sideMax + safety
    const sideMax = Math.max(150, brandW.current, endW.current); // 150 = CSS side min-width
    const searchW = searchOpenRef.current ? 380 : 44; // expanded bar vs circle
    const needed =
      56 + 36 + 22 + labelsW.current + searchW + 2 * sideMax + 24;
    const next = needed > nav.clientWidth;
    if (next !== crampedRef.current) {
      crampedRef.current = next;
      setCramped(next);
    }
  }, []);

  // Opening/closing the search changes how much room the group needs.
  useEffect(() => {
    searchOpenRef.current = searchOpen;
    recompute();
  }, [searchOpen, recompute]);

  // Re-evaluate on viewport changes (and once after mount/fonts settle).
  useEffect(() => {
    const ro = new ResizeObserver(() => recompute());
    if (navRef.current) ro.observe(navRef.current);
    window.addEventListener("resize", recompute);
    const t = setTimeout(recompute, 60); // after web fonts swap in
    recompute();
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
      clearTimeout(t);
    };
  }, [recompute]);

  return (
    <nav
      ref={navRef}
      className={"site-nav" + (cramped ? " site-nav--searching" : "") + (searchOpen ? " site-nav--search-open" : "")}
      aria-label="Primary"
    >
      {/* left section — equal width to the right section keeps the tabs centered */}
      <div className="site-nav__side site-nav__side--left">
        <Link ref={brandRef} className="site-nav__brand" href="/home" title="Kokoro home">
          <span className="site-nav__mark" aria-hidden="true" />
          <span className="site-nav__name">kokoro</span>
        </Link>
      </div>

      {/* centered group: tabs + search travel together, centered in the bar */}
      <div className="site-nav__center">
        <ol ref={tabsRef} className="site-nav__tabs" role="tablist">
        {TABS.map((t) => {
          const on = active === t.id;
          const href =
            t.id === "watchlist" && lastListId
              ? `/watchlist/${encodeURIComponent(lastListId)}`
              : t.href;
          return (
            <li key={t.id}>
              <Link
                className={"site-nav__tab" + (on ? " on" : "")}
                href={href}
                aria-current={on ? "page" : "false"}
                title={t.label}
              >
                <span className="site-nav__tab-ico" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    {TAB_ICONS[t.id]}
                  </svg>
                </span>
                <span className="site-nav__tab-label">{t.label}</span>
              </Link>
            </li>
          );
        })}
        </ol>

        {/* search circle sits next to the tabs as part of the centered group;
            clicking it expands the bar inline and pushes the tabs aside */}
        <NavSearch open={searchOpen} setOpen={setSearchOpen} />
      </div>

      {/* right section — controls only; mirrors the left width to keep the group centered */}
      <div className="site-nav__side site-nav__side--right">
        <div ref={endRef} className="site-nav__end">
        {isMod && (
          <Link
            className={"site-nav__tab site-nav__review" + (active === "review" ? " on" : "")}
            href="/review"
            title="Description review queue"
          >
            Review
          </Link>
        )}
        {isMod && (
          <Link
            className={"site-nav__tab site-nav__review" + (active === "editorial" ? " on" : "")}
            href="/editorial"
            title="Edit Home editorial picks"
          >
            Editorial
          </Link>
        )}
        {isMod && (
          <Link
            className={"site-nav__tab site-nav__review" + (active === "events" ? " on" : "")}
            href="/events"
            title="Edit the Home event banner"
          >
            Events
          </Link>
        )}
        {isMod && (
          <Link
            className={"site-nav__tab site-nav__review" + (pathname.startsWith("/news/admin") ? " on" : "")}
            href="/news/admin"
            title="Edit the news briefing"
          >
            Newsroom
          </Link>
        )}

        {user ? (
          <>
            <Link
              className="site-nav__avatar"
              href="/profile"
              title={user.username || user.name || user.email || "Your profile"}
              aria-label="Profile"
            />
            <form action={signOutAction}>
              <button className="site-nav__icon" type="submit" title="Sign out" aria-label="Sign out">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="m16 17 5-5-5-5M21 12H9" />
                </svg>
              </button>
            </form>
          </>
        ) : (
          <Link className="site-nav__tab on" href="/login" style={{ marginLeft: 4 }}>
            Sign in
          </Link>
        )}
        </div>
      </div>
    </nav>
  );
}
