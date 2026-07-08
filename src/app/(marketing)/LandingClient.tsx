"use client";

import { useEffect, useId, useRef } from "react";

/* ---------------------------------------------------------------------------
 * Feeling glyph — a circle "filled" from the bottom by a fraction. A stable id
 * is derived via React's useId to avoid SSR/CSR hydration mismatches.
 * ------------------------------------------------------------------------- */
const FRAC: Record<string, number> = { loved: 1, liked: 0.68, mixed: 0.5, dropped: 0.16 };

function Glyph({ feeling, size = 24 }: { feeling: "loved" | "liked" | "mixed" | "dropped"; size?: number }) {
  const reactId = useId();
  const clipId = `gly${reactId.replace(/[:]/g, "")}`;
  const s = size;
  const sw = Math.max(1.4, s * 0.085);
  const r = s / 2 - sw;
  const cx = s / 2;
  const cy = s / 2;
  const frac = FRAC[feeling] != null ? FRAC[feeling] : 0;
  const top = cy + r - 2 * r * frac;
  const op = feeling === "dropped" ? 0.5 : 1;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none" role="img" aria-label={feeling}>
      <clipPath id={clipId}>
        <rect x={cx - r} y={top} width={2 * r} height={2 * r} />
      </clipPath>
      <circle cx={cx} cy={cy} r={r} stroke="currentColor" strokeWidth={sw} />
      <circle cx={cx} cy={cy} r={r} fill="currentColor" clipPath={`url(#${clipId})`} opacity={op} />
    </svg>
  );
}

/* ---------------------------------------------------------------------------
 * Small stroke-icon set. This codebase hand-rolls its inline SVGs (see
 * SiteNav / the sculpt points) and ships no icon library, so new glyphs follow
 * the same 24-box, 1.8 stroke convention for consistency.
 * ------------------------------------------------------------------------- */
type IcoName = "merge" | "token" | "brush" | "journal" | "community" | "news" | "compass" | "manga";
function Ico({ name, size = 17 }: { name: IcoName; size?: number }) {
  const common = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "merge":
      return (<svg {...common}><rect x="3" y="4" width="9" height="6" rx="1.5" /><rect x="9" y="13" width="12" height="7" rx="1.5" /></svg>);
    case "token":
      return (<svg {...common}><rect x="3" y="8" width="18" height="8" rx="4" /><circle cx="8" cy="12" r="1.6" fill="currentColor" stroke="none" /></svg>);
    case "brush":
      return (<svg {...common}><path d="M3 21c2-1 3-3 3-5l9-9 2 2-9 9c-2 0-4 1-5 3z" /><path d="M14 5l3-3 4 4-3 3" /></svg>);
    case "journal":
      return (<svg {...common}><path d="M6 4h12a1 1 0 0 1 1 1v15H7a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1z" /><path d="M9 4v16" /></svg>);
    case "community":
      return (<svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3.5 19c0-3 2.8-4.5 5.5-4.5S14.5 16 14.5 19" /><path d="M16 6a3 3 0 0 1 0 6M20.5 19c0-2.2-1.4-3.6-3.5-4.2" /></svg>);
    case "news":
      return (<svg {...common}><path d="M4 5h13a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5z" /><path d="M18 8h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2" /><path d="M7 8h7M7 11h7M7 14h5" /></svg>);
    case "compass":
      return (<svg {...common}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" /></svg>);
    case "manga":
      return (<svg {...common}><path d="M12 6c-1.6-1-4-1.5-6-1.5S2.6 5 2 5.5v13c.6-.5 2.4-1 4-1s4.4.5 6 1.5" /><path d="M12 6c1.6-1 4-1.5 6-1.5s3.4.5 4 1v13c-.6-.5-2.4-1-4-1s-4.4.5-6 1.5" /><path d="M12 6v13.5" /></svg>);
  }
}

/* ---------------------------------------------------------------------------
 * Data models
 * ------------------------------------------------------------------------- */
type Feeling = "loved" | "liked" | "mixed" | "dropped";
type StatusKey = "watching" | "finished" | "rewatching" | "backlog";
type Poster = {
  cover: string; feel: Feeling; feelVar: string; title: string; meta: string;
  status: string; statusKey: StatusKey; progress: number | null; progressText?: string;
};

const POSTERS: Poster[] = [
  { cover: "/covers/naruto.jpg", feel: "loved", feelVar: "var(--feel-loved)", title: "Naruto", meta: "2002 · Action", status: "Watching", statusKey: "watching", progress: 142 / 220, progressText: "142 / 220" },
  { cover: "/covers/one-piece.jpg", feel: "loved", feelVar: "var(--feel-loved)", title: "One Piece", meta: "1999 · Adventure", status: "Watching", statusKey: "watching", progress: 1096 / 1122, progressText: "1096 / 1122" },
  { cover: "/covers/bleach.jpg", feel: "liked", feelVar: "var(--feel-liked)", title: "Bleach", meta: "2004 · Action", status: "Finished", statusKey: "finished", progress: 1, progressText: "366 / 366" },
  { cover: "/covers/dragon-ball-z.jpg", feel: "loved", feelVar: "var(--feel-loved)", title: "Dragon Ball Z", meta: "1989 · Action", status: "Rewatching", statusKey: "rewatching", progress: 74 / 291, progressText: "74 / 291" },
  { cover: "/covers/doraemon.jpg", feel: "liked", feelVar: "var(--feel-liked)", title: "Doraemon", meta: "1979 · Comedy", status: "Backlog", statusKey: "backlog", progress: null },
];

/* ACT I — TRACK */
type SculptPoint = { d: string; ico: IcoName; title: string; body: string };
const SCULPT_POINTS: SculptPoint[] = [
  { d: "1", ico: "merge", title: "Stack to group", body: "Drag one title onto another and they merge into a group, like stacking cards on a table." },
  { d: "2", ico: "token", title: "Drop rules where you want them", body: "Sort, colour, group and tag tokens drag onto the whole list, or onto a single group to scope them." },
  { d: "3", ico: "brush", title: "Paint rules by hand", body: "Hold a token and sweep it across entries to apply it one by one. Small changes, instant feedback." },
];

const JOURNAL_NOTES = [
  { when: "Tue", ep: "Ep 28", body: "The mirror-lotus arc. Himmel's reason finally lands, and it quietly wrecks me." },
  { when: "Sun", ep: "Ep 26", body: "Kept the line about kindness being a spell you cast forward. Rewound it twice." },
];

const MANGA_SHELF = [
  { cover: "/covers/berserk-manga.jpg", title: "Berserk" },
  { cover: "/covers/vagabond-manga.jpg", title: "Vagabond" },
  { cover: "/covers/oyasumi-punpun.jpg", title: "Oyasumi Punpun" },
  { cover: "/covers/chainsaw-man-manga.jpg", title: "Chainsaw Man" },
  { cover: "/covers/one-punch-man-manga.jpg", title: "One Punch-Man" },
];

/* ACT II — RATE */
type FeelCard =
  | { kind: "glyph"; feeling: Feeling; name: string; desc: string }
  | { kind: "mark"; mark: string; color: string; fontSize: number; name: string; desc: string };
const FEEL_CARDS: FeelCard[] = [
  { kind: "glyph", feeling: "loved", name: "Feelings", desc: "Loved, liked, mixed, dropped. One tap for the shape of how it hit you." },
  { kind: "mark", mark: "9.2", color: "oklch(0.72 0.13 250)", fontSize: 30, name: "Numbers", desc: "Out of 10, 100, or 5. Decimals if you're precise, whatever scale you think in." },
  { kind: "mark", mark: "S", color: "oklch(0.74 0.14 45)", fontSize: 34, name: "Symbols", desc: "Letter tiers, stars, marks. Borrow a system or invent your own shorthand." },
  { kind: "mark", mark: "✶", color: "oklch(0.70 0.13 320)", fontSize: 34, name: "Anything else", desc: "Mix scales across your list, or build a rating axis that is entirely yours." },
];
type Layer = { d: string; num: string; title: string; body: string; tag: string };
const LAYERS: Layer[] = [
  { d: "1", num: "Your scale", title: "Pick the language you think in", body: "A feeling glyph, a 9.2, an S-tier or a star. Choose per title, mix freely across the list. Just one mark is ever required.", tag: "feelings · numbers · symbols" },
  { d: "2", num: "Your axes", title: "Rate what you care about", body: "Story, art, music, pacing, or invent your own axes. Fully personal, never aggregated into a public average.", tag: "private by default" },
  { d: "3", num: "Your take", title: "Say it in your words", body: "A line or a long note. This is what the recommendations read: your language, not a number.", tag: "feeds your taste profile" },
];

/* ACT III — CONNECT */
const FEED = [
  { init: "K", who: "kaen", title: "Chainsaw Man", tag: "Ep 12", body: "that final shot did something to me. no spoilers, but oof.", up: 214, feel: "loved" as Feeling },
  { init: "M", who: "mizuchi", title: "Frieren", tag: "Discussion", body: "quietly the most devastating shonen of the decade, or am I just getting old", up: 512, feel: "liked" as Feeling },
];
const TREND = [
  { cover: "/covers/frieren.jpg", name: "Frieren", note: "busy today" },
  { cover: "/covers/jujutsu-kaisen.jpg", name: "Jujutsu Kaisen", note: "new episode" },
  { cover: "/covers/dandadan.jpg", name: "Dandadan", note: "trending" },
];
const NEWS = [
  { cat: "Adaptation", src: "Kokoro Wire", time: "2h", title: "A long-running seinen finally gets its animation studio confirmed." },
  { cat: "Release", src: "Season Desk", time: "5h", title: "Two anticipated sequels lock in their autumn premiere windows." },
  { cat: "Interview", src: "The Cut", time: "1d", title: "A director on why silence does the heavy lifting in slow arcs." },
];

/* ACT IV — DISCOVER */
const RECS = [
  { cover: "/covers/mushishi.jpg", title: "Mushishi", reason: "For the quiet you loved in Frieren" },
  { cover: "/covers/monster.jpg", title: "Monster", reason: "You rate slow-burn thrillers highly" },
  { cover: "/covers/cowboy-bebop.jpg", title: "Cowboy Bebop", reason: "Matches your mood-over-hype profile" },
  { cover: "/covers/steins-gate.jpg", title: "Steins;Gate", reason: "People with your taste finish this one" },
  { cover: "/covers/vinland-saga.jpg", title: "Vinland Saga", reason: "Because you finished Vagabond" },
];

type FooterCol = { heading: string; links: { label: string; href: string }[] };
function footerCols(signedIn: boolean): FooterCol[] {
  return [
    { heading: "Explore", links: [
      { label: "Track", href: "#track" }, { label: "Rate", href: "#rate" },
      { label: "Connect", href: "#connect" }, { label: "Discover", href: "#discover" },
    ] },
    { heading: "Get started", links: signedIn
      ? [{ label: "Open Kokoro", href: "/home" }]
      : [{ label: "Create account", href: "/signup" }, { label: "Sign in", href: "/login" }],
    },
  ];
}

export default function LandingClient({ signedIn = false }: { signedIn?: boolean }) {
  const FOOTER_COLS = footerCols(signedIn);
  /* ---- smooth "inertia" wheel scrolling (desktop + motion-ok only) ---- */
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (reduce || !fine) return; // never hijack touch / reduced-motion

    // CSS `html { scroll-behavior: smooth }` would re-animate every scrollTo we
    // issue below, fighting this loop into a sluggish crawl. Force instant
    // scrolling while we drive it ourselves; explicit `behavior:"smooth"` calls
    // (anchor nav) still override this inline value, so those stay smooth.
    const html = document.documentElement;
    const prevBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";

    let target = window.scrollY;
    let current = window.scrollY;
    let raf = 0;
    let animating = false;
    let last = 0;
    // Time-normalized smoothing: `current` covers half the gap to `target`
    // every HALF_LIFE ms, independent of frame rate. Short half-life = the
    // scroll tracks the wheel closely and just adds a subtle glide tail.
    const HALF_LIFE = 110;
    const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    const tick = (now: number) => {
      const dt = last ? now - last : 16;
      last = now;
      const f = 1 - Math.pow(2, -dt / HALF_LIFE);
      current += (target - current) * f;
      if (Math.abs(target - current) < 0.4) {
        current = target;
        animating = false;
        last = 0;
        window.scrollTo(0, current);
        return;
      }
      window.scrollTo(0, current);
      raf = requestAnimationFrame(tick);
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      e.preventDefault();
      target = Math.max(0, Math.min(maxScroll(), target + e.deltaY * unit));
      if (!animating) {
        animating = true;
        current = window.scrollY;
        last = 0;
        raf = requestAnimationFrame(tick);
      }
    };

    const onScroll = () => {
      if (!animating) {
        target = window.scrollY;
        current = window.scrollY;
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      html.style.scrollBehavior = prevBehavior;
    };
  }, []);

  /* ---- nav scroll state + parallax + reveal-on-scroll ---- */
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nav = navRef.current;

    const onScrollNav = () => {
      if (nav) nav.classList.toggle("scrolled", window.scrollY > 24);
    };
    onScrollNav();

    type Item = { el: HTMLElement; speed: number; center: number };
    const items: Item[] = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]")).map((el) => ({
      el, speed: parseFloat(el.getAttribute("data-parallax") || "0") || 0, center: 0,
    }));

    const measure = () => {
      items.forEach((it) => {
        const r = it.el.getBoundingClientRect();
        it.center = r.top + window.scrollY + r.height / 2;
      });
    };

    let ticking = false;
    const frame = () => {
      const vy = window.scrollY;
      const vh = window.innerHeight;
      items.forEach((it) => {
        const delta = it.center - (vy + vh / 2);
        const y = -delta * it.speed;
        it.el.style.transform = `translate3d(0,${y.toFixed(2)}px,0)`;
      });
      ticking = false;
    };

    const onScroll = () => {
      onScrollNav();
      if (!reduce && !ticking) {
        ticking = true;
        requestAnimationFrame(frame);
      }
    };
    const onResize = () => {
      measure();
      if (!reduce) requestAnimationFrame(frame);
    };

    if (!reduce) {
      measure();
      requestAnimationFrame(frame);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      io.disconnect();
    };
  }, []);

  /* ---- gentle token tilt follows cursor (sculpt mock) ---- */
  const mockRef = useRef<HTMLDivElement | null>(null);
  const tokenRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mock = mockRef.current;
    const token = tokenRef.current;
    if (!mock || !token || reduce) return;

    const onMove = (e: PointerEvent) => {
      const r = mock.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      token.style.transform = `rotate(-3deg) translate(${(dx * 10).toFixed(1)}px,0)`;
    };
    const onLeave = () => {
      token.style.transform = "rotate(-3deg)";
    };
    mock.addEventListener("pointermove", onMove);
    mock.addEventListener("pointerleave", onLeave);
    return () => {
      mock.removeEventListener("pointermove", onMove);
      mock.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  /* ---- smooth-scroll for in-page anchor links ---- */
  function onAnchorClick(e: React.MouseEvent<HTMLAnchorElement>) {
    const href = e.currentTarget.getAttribute("href");
    if (!href || !href.startsWith("#")) return;
    const target = href === "#top" ? document.body : document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    if (href === "#top") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      {/* ============ NAV ============ */}
      <nav className="lp-nav" ref={navRef}>
        <a className="lp-brand" href="#top" onClick={onAnchorClick}>
          Kokoro<span className="dot">.</span>
        </a>
        <div className="lp-nav__links">
          <a href="#track" onClick={onAnchorClick}>Track</a>
          <a href="#rate" onClick={onAnchorClick}>Rate</a>
          <a href="#connect" onClick={onAnchorClick}>Connect</a>
          <a href="#discover" onClick={onAnchorClick}>Discover</a>
        </div>
        <div className="lp-nav__spacer"></div>
        <div className="lp-nav__auth">
          {signedIn ? (
            <a className="btn btn--accent" href="/home">Open Kokoro</a>
          ) : (
            <>
              <a className="lp-signin" href="/login">Sign in</a>
              <a className="btn btn--accent" href="/signup">Create account</a>
            </>
          )}
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <header className="lp-hero" id="top">
        <div className="lp-hero__bg" data-parallax="0.18"></div>
        <div className="lp-hero__vignette"></div>
        <div className="lp-grain"></div>

        <div className="lp-hero__inner">
          <span className="eyebrow lp-hero__eyebrow">Your list, your rules</span>
          <h1>Run your lists <em>your way.</em></h1>
          <p className="lp-hero__sub">
            Track, rate and organise every anime and manga you touch, shaped exactly the way your head works.
          </p>
          <div className="lp-hero__cta">
            <div className="lp-hero__ctarow">
              {signedIn ? (
                <a className="btn btn--accent btn--lg" href="/home">Open Kokoro</a>
              ) : (
                <a className="btn btn--accent btn--lg" href="/signup">Start your list, it&apos;s free</a>
              )}
              <a className="btn btn--ghost btn--lg" href="#track" onClick={onAnchorClick}>See how it works</a>
            </div>
          </div>
        </div>

        {/* cover fan — the titles you're tracking, each with its watch status */}
        <div className="lp-strip" data-parallax="-0.05">
          {POSTERS.map((p) => (
            <div className="lp-fan" key={p.title}>
              <article className="lp-poster" data-status={p.statusKey}>
                <div className="lp-poster__art" style={{ backgroundImage: `url(${p.cover})` }}></div>
                <div className="lp-poster__scrim"></div>
                <span className="lp-poster__status">
                  <i className="lp-poster__dot"></i>
                  {p.status}
                </span>
                <span className="lp-poster__feel" style={{ color: p.feelVar }}>
                  <Glyph feeling={p.feel} size={16} />
                </span>
                <div className="lp-poster__label">
                  <div className="lp-poster__title">{p.title}</div>
                  <div className="lp-poster__meta">{p.meta}</div>
                  {p.progress !== null ? (
                    <div className="lp-poster__prog" aria-hidden="true">
                      <div className="lp-poster__progbar">
                        <span style={{ width: `${Math.round(p.progress * 100)}%` }}></span>
                      </div>
                      <span className="lp-poster__progtext">{p.progressText}</span>
                    </div>
                  ) : (
                    <div className="lp-poster__prog lp-poster__prog--empty" aria-hidden="true">
                      <span className="lp-poster__progtext">Not started</span>
                    </div>
                  )}
                </div>
              </article>
            </div>
          ))}
        </div>
      </header>

      {/* ============ ACT I — TRACK (cream) ============ */}
      <section className="lp-section lp-section--cream" id="track">
        <div className="lp-wrap">
          <div className="lp-act reveal">
            <span className="lp-act__num" aria-hidden="true">1</span>
            <div className="lp-act__head">
              <span className="lp-act__kicker">Track</span>
              <h2>Everything you watch and read, in one place you actually shaped.</h2>
              <p>Anime and manga share the same catalog, the same lists, and the same tools. The layout is yours to sculpt.</p>
            </div>
          </div>

          {/* lead: Sculpt / Lists — text + live list mock */}
          <div className="lp-split">
            <div className="lp-split__text">
              <h3 className="reveal">The best list isn&apos;t designed. It emerges.</h3>
              <div className="lp-sculpt-points">
                {SCULPT_POINTS.map((pt) => (
                  <div className="lp-point reveal" data-d={pt.d} key={pt.title}>
                    <span className="lp-point__mark"><Ico name={pt.ico} /></span>
                    <div>
                      <h4>{pt.title}</h4>
                      <p>{pt.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* mock list visual (dark product panel sitting on cream) */}
            <div className="lp-mock reveal" data-d="2" data-parallax="0.04" ref={mockRef}>
              <div className="lp-mock__frame">
                <div className="lp-mock__bar">
                  <span className="lp-mock__chip"><span className="sw" style={{ background: "oklch(0.62 0.10 265)" }}></span>Group · feeling</span>
                  <span className="lp-mock__chip"><span className="sw" style={{ background: "oklch(0.66 0.13 45)" }}></span>Colour · genre</span>
                  <span className="lp-mock__chip"><span className="sw" style={{ background: "oklch(0.62 0.09 320)" }}></span>Tag · episodes</span>
                </div>
                <div className="lp-mock__group">
                  <div className="lp-mock__ghead">
                    <span className="lp-mock__gname">Comfort rewatches</span>
                    <span className="lp-mock__gbadge">scoped</span>
                  </div>
                  <div className="lp-mock__rows">
                    <div className="lp-row">
                      <span className="lp-row__stripe" style={{ background: "oklch(0.66 0.105 248)" }}></span>
                      <span className="lp-row__glyph" style={{ color: "var(--feel-loved)" }}><Glyph feeling="loved" size={18} /></span>
                      <span className="lp-row__title">Cowboy Bebop</span>
                      <span className="lp-row__tag">26 ep</span>
                    </div>
                    <div className="lp-row">
                      <span className="lp-row__stripe" style={{ background: "oklch(0.66 0.105 278)" }}></span>
                      <span className="lp-row__mark" style={{ color: "oklch(0.72 0.13 250)" }}>9.4</span>
                      <span className="lp-row__title">Mushishi</span>
                      <span className="lp-row__tag">26 ep</span>
                    </div>
                  </div>
                </div>
                <div className="lp-mock__rows" style={{ padding: 0 }}>
                  <div className="lp-row">
                    <span className="lp-row__stripe" style={{ background: "oklch(0.66 0.105 300)" }}></span>
                    <span className="lp-row__glyph" style={{ color: "var(--feel-loved)" }}><Glyph feeling="loved" size={18} /></span>
                    <span className="lp-row__title">Frieren</span>
                    <span className="lp-row__tag">28 ep</span>
                  </div>
                  <div className="lp-row">
                    <span className="lp-row__stripe" style={{ background: "oklch(0.66 0.105 30)" }}></span>
                    <span className="lp-row__mark" style={{ color: "oklch(0.74 0.14 45)" }}>A</span>
                    <span className="lp-row__title">Mob Psycho 100</span>
                    <span className="lp-row__tag">25 ep</span>
                  </div>
                  <div className="lp-row">
                    <span className="lp-row__stripe" style={{ background: "oklch(0.66 0.105 12)" }}></span>
                    <span className="lp-row__mark" style={{ color: "oklch(0.72 0.13 320)" }}>☆</span>
                    <span className="lp-row__title">Chainsaw Man</span>
                    <span className="lp-row__tag">12 ep</span>
                  </div>
                </div>
                <div className="lp-mock__token" ref={tokenRef}>
                  <span className="sw"></span> Colour · feeling
                </div>
              </div>
            </div>
          </div>

          {/* sub-row: Journal + Manga (two-card bento) */}
          <div className="lp-duo">
            <div className="lp-card reveal">
              <div className="lp-card__head">
                <span className="lp-card__ico"><Ico name="journal" size={18} /></span>
                <div>
                  <h3>A private journal per title</h3>
                  <p>Episode notes, quotes worth keeping, and how a show left you. Only you can see it.</p>
                </div>
              </div>
              <div className="lp-journal">
                <div className="lp-journal__title">
                  <span className="lp-journal__cover" style={{ backgroundImage: "url(/covers/frieren.jpg)" }}></span>
                  <span>Frieren</span>
                  <span className="lp-journal__count">2 notes this week</span>
                </div>
                {JOURNAL_NOTES.map((n) => (
                  <div className="lp-jnote" key={n.ep}>
                    <span className="lp-jnote__when">{n.when}</span>
                    <div>
                      <span className="lp-jnote__ep">{n.ep}</span>
                      <p>{n.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lp-card reveal" data-d="1">
              <div className="lp-card__head">
                <span className="lp-card__ico"><Ico name="manga" size={18} /></span>
                <div>
                  <h3>Manga, same everything</h3>
                  <p>The same catalog, ratings and lists you use for anime. Add a title and start tracking chapters.</p>
                </div>
              </div>
              <div className="lp-shelf">
                {MANGA_SHELF.map((m) => (
                  <figure className="lp-shelf__item" key={m.title}>
                    <span className="lp-shelf__cover" style={{ backgroundImage: `url(${m.cover})` }}></span>
                    <figcaption>{m.title}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ ACT II — RATE (dark) ============ */}
      <section className="lp-section lp-section--rate" id="rate">
        <div className="lp-wrap">
          <div className="lp-act reveal">
            <span className="lp-act__num" aria-hidden="true">2</span>
            <div className="lp-act__head">
              <span className="lp-act__kicker">Rate</span>
              <h2>Rate it however you actually think.</h2>
              <p>Some titles are a feeling. Some are a clean 9.2. Some are an S-tier, a star, or a system only you understand. Every entry can carry whatever mark fits, then you sort and filter by any of them.</p>
            </div>
          </div>

          <div className="lp-feelings">
            {FEEL_CARDS.map((c) => (
              <div className="lp-feel reveal" key={c.name}>
                {c.kind === "glyph" ? (
                  <span className="lp-feel__glyph" style={{ color: "var(--feel-loved)" }}><Glyph feeling={c.feeling} size={44} /></span>
                ) : (
                  <span className="lp-feel__mark" style={{ color: c.color, fontSize: `${c.fontSize}px` }}>{c.mark}</span>
                )}
                <div className="lp-feel__name">{c.name}</div>
                <div className="lp-feel__desc">{c.desc}</div>
              </div>
            ))}
          </div>

          <div className="lp-layers">
            {LAYERS.map((l) => (
              <div className="lp-layer reveal" data-d={l.d} key={l.num}>
                <div className="lp-layer__num">{l.num}</div>
                <h3>{l.title}</h3>
                <p>{l.body}</p>
                <span className="lp-layer__tag">{l.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ ACT III — CONNECT (cream) ============ */}
      <section className="lp-section lp-section--cream" id="connect">
        <div className="lp-wrap">
          <div className="lp-act reveal">
            <span className="lp-act__num" aria-hidden="true">3</span>
            <div className="lp-act__head">
              <span className="lp-act__kicker">Connect</span>
              <h2>Talk about it. Keep up with it.</h2>
              <p>Every title has a community, and the whole industry gets summarised into a calm daily briefing tuned to what you follow.</p>
            </div>
          </div>

          <div className="lp-connect">
            {/* community panel */}
            <div className="lp-panel reveal">
              <div className="lp-panel__head">
                <span className="lp-card__ico"><Ico name="community" size={18} /></span>
                <div>
                  <h3>A community per anime</h3>
                  <p>Reviews, hot takes, and episode threads. Jump into any title to go deeper.</p>
                </div>
              </div>
              <div className="lp-feed">
                {FEED.map((f) => (
                  <div className="lp-post" key={f.who}>
                    <span className="lp-post__av" aria-hidden="true">{f.init}</span>
                    <div className="lp-post__body">
                      <div className="lp-post__meta">
                        <span className="lp-post__who">{f.who}</span>
                        <span className="lp-post__tag">{f.title} · {f.tag}</span>
                      </div>
                      <p>{f.body}</p>
                      <div className="lp-post__foot">
                        <span className="lp-post__up"><Ico name="community" size={13} />{f.up}</span>
                        <span className="lp-post__feel" style={{ color: `var(--feel-${f.feel})` }}><Glyph feeling={f.feel} size={13} /></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="lp-trend">
                <span className="lp-trend__label">Trending now</span>
                <div className="lp-trend__row">
                  {TREND.map((t) => (
                    <span className="lp-trend__chip" key={t.name}>
                      <span className="lp-trend__cover" style={{ backgroundImage: `url(${t.cover})` }}></span>
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* news panel */}
            <div className="lp-panel reveal" data-d="1">
              <div className="lp-panel__head">
                <span className="lp-card__ico"><Ico name="news" size={18} /></span>
                <div>
                  <h3>A calm daily briefing</h3>
                  <p>Announcements, adaptations and release dates, gathered and summarised. Weighted to your titles.</p>
                </div>
              </div>
              <div className="lp-brief">
                {NEWS.map((n) => (
                  <div className="lp-story" key={n.title}>
                    <span className="lp-story__cat" data-cat={n.cat.toLowerCase()}>{n.cat}</span>
                    <p>{n.title}</p>
                    <span className="lp-story__src">{n.src} · {n.time}</span>
                  </div>
                ))}
              </div>
              <div className="lp-brief__note">
                <Glyph feeling="liked" size={14} />
                <span>Picked for you because you follow slow-burn drama and seinen.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ ACT IV — DISCOVER (dark) ============ */}
      <section className="lp-section lp-section--discover" id="discover">
        <div className="lp-wrap">
          <div className="lp-act reveal">
            <span className="lp-act__num" aria-hidden="true">4</span>
            <div className="lp-act__head">
              <span className="lp-act__kicker">Discover</span>
              <h2>Recommendations that read your words, not a crowd&apos;s average.</h2>
              <p>Kokoro learns from how you actually rate and what you write, then finds the next thing quietly, with a reason attached. No hype, no chasing scores.</p>
            </div>
          </div>

          <div className="lp-recs reveal">
            {RECS.map((r) => (
              <figure className="lp-rec" key={r.title}>
                <span className="lp-rec__cover" style={{ backgroundImage: `url(${r.cover})` }}>
                  <span className="lp-rec__scrim"></span>
                </span>
                <figcaption>
                  <span className="lp-rec__title">{r.title}</span>
                  <span className="lp-rec__reason">{r.reason}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CLOSING CTA ============ */}
      <section className="lp-cta">
        <div className="lp-cta__bg" data-parallax="0.12"></div>
        <div className="lp-cta__glyphs reveal">
          <span className="g" style={{ color: "var(--feel-loved)" }}><Glyph feeling="loved" size={26} /></span>
          <span className="g" style={{ color: "var(--feel-liked)" }}><Glyph feeling="liked" size={26} /></span>
          <span className="g" style={{ color: "var(--feel-mixed)" }}><Glyph feeling="mixed" size={26} /></span>
          <span className="g" style={{ color: "var(--feel-dropped)" }}><Glyph feeling="dropped" size={26} /></span>
        </div>
        <h2 className="reveal" data-d="1">Start the list that&apos;s actually yours.</h2>
        <p className="lp-cta__sub reveal" data-d="2">
          No scores to chase. No averages to argue with. Just what you watched, how it felt, and where it belongs.
        </p>
        <div className="lp-cta__btn reveal" data-d="3">
          {signedIn ? (
            <a className="btn btn--accent btn--lg" href="/home">Open Kokoro</a>
          ) : (
            <a className="btn btn--accent btn--lg" href="/signup">Create your account</a>
          )}
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="lp-footer">
        <div className="lp-footer__top">
          <div className="lp-footer__brand">
            <a className="lp-brand" href="#top" onClick={onAnchorClick}>
              Kokoro<span className="dot">.</span>
            </a>
            <p>A personal anime and manga tracker for people who&apos;d rather trust their own taste than a crowd&apos;s average.</p>
          </div>
          {FOOTER_COLS.map((col) => (
            <div className="lp-footcol" key={col.heading}>
              <h5>{col.heading}</h5>
              {col.links.map((link, i) =>
                link.href.startsWith("#") ? (
                  <a key={i} href={link.href} onClick={onAnchorClick}>{link.label}</a>
                ) : (
                  <a key={i} href={link.href}>{link.label}</a>
                ),
              )}
            </div>
          ))}
        </div>
        <div className="lp-footer__base">
          <span>© 2026 Kokoro · Taste over consensus</span>
          <span>Made for people who finish the season</span>
        </div>
      </footer>
    </>
  );
}
