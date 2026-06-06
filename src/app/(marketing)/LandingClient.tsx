"use client";

import { useEffect, useId, useRef, useState } from "react";

/* ---------------------------------------------------------------------------
 * Feeling glyph — a circle "filled" from the bottom by a fraction, ported from
 * landing.js `glyphSVG`. The original generated a random clip-path id at runtime
 * (fine for a static page, but it would cause SSR/CSR hydration mismatches here),
 * so we derive a stable id via React's useId instead.
 * ------------------------------------------------------------------------- */
const FRAC: Record<string, number> = {
  loved: 1,
  liked: 0.68,
  mixed: 0.5,
  dropped: 0.16,
};

function Glyph({
  feeling,
  size = 24,
}: {
  feeling: "loved" | "liked" | "mixed" | "dropped";
  size?: number;
}) {
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
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      fill="none"
      role="img"
      aria-label={feeling}
    >
      <clipPath id={clipId}>
        <rect x={cx - r} y={top} width={2 * r} height={2 * r} />
      </clipPath>
      <circle cx={cx} cy={cy} r={r} stroke="currentColor" strokeWidth={sw} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="currentColor"
        clipPath={`url(#${clipId})`}
        opacity={op}
      />
    </svg>
  );
}

/* ---------------------------------------------------------------------------
 * Sculpt-point icons — rendered directly instead of post-mount injection
 * (the prototype's inline <script> P object: merge / token / brush).
 * ------------------------------------------------------------------------- */
function PointIcon({ ico }: { ico: "merge" | "token" | "brush" }) {
  const common = {
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (ico === "merge") {
    return (
      <svg {...common}>
        <rect x="3" y="4" width="9" height="6" rx="1.5" />
        <rect x="9" y="13" width="12" height="7" rx="1.5" />
      </svg>
    );
  }
  if (ico === "token") {
    return (
      <svg {...common}>
        <rect x="3" y="8" width="18" height="8" rx="4" />
        <circle cx="8" cy="12" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M3 21c2-1 3-3 3-5l9-9 2 2-9 9c-2 0-4 1-5 3z" />
      <path d="M14 5l3-3 4 4-3 3" />
    </svg>
  );
}

/* ---------------------------------------------------------------------------
 * Typed data models for the repeated items.
 * ------------------------------------------------------------------------- */
type Feeling = "loved" | "liked" | "mixed" | "dropped";

type Poster = {
  art: string;
  feel: Feeling;
  feelVar: string;
  title: string;
  meta: string;
};

const POSTERS: Poster[] = [
  {
    art: "linear-gradient(160deg,oklch(0.42 0.06 250),oklch(0.21 0.04 250))",
    feel: "loved",
    feelVar: "var(--feel-loved)",
    title: "Monster",
    meta: "2004 · Thriller",
  },
  {
    art: "linear-gradient(160deg,oklch(0.40 0.07 30),oklch(0.22 0.04 25))",
    feel: "loved",
    feelVar: "var(--feel-loved)",
    title: "Vinland Saga",
    meta: "2019 · Drama",
  },
  {
    art: "linear-gradient(160deg,oklch(0.44 0.09 70),oklch(0.23 0.05 58))",
    feel: "loved",
    feelVar: "var(--feel-loved)",
    title: "Frieren",
    meta: "2023 · Fantasy",
  },
  {
    art: "linear-gradient(160deg,oklch(0.40 0.06 160),oklch(0.22 0.04 150))",
    feel: "loved",
    feelVar: "var(--feel-loved)",
    title: "Mushishi",
    meta: "2005 · Supernatural",
  },
  {
    art: "linear-gradient(160deg,oklch(0.44 0.09 320),oklch(0.23 0.05 320))",
    feel: "liked",
    feelVar: "var(--feel-liked)",
    title: "Bocchi the Rock!",
    meta: "2022 · Music",
  },
];

type FeelCard =
  | { kind: "glyph"; d: string; feeling: Feeling; name: string; desc: string }
  | {
      kind: "mark";
      d: string;
      mark: string;
      color: string;
      fontSize: number;
      name: string;
      desc: string;
    };

const FEEL_CARDS: FeelCard[] = [
  {
    kind: "glyph",
    d: "1",
    feeling: "loved",
    name: "Feelings",
    desc: "Loved, liked, mixed, dropped. One tap for the shape of how it hit you.",
  },
  {
    kind: "mark",
    d: "2",
    mark: "9.2",
    color: "oklch(0.62 0.13 250)",
    fontSize: 30,
    name: "Numbers",
    desc: "Out of 10, 100, or 5. Decimals if you're precise — whatever scale you think in.",
  },
  {
    kind: "mark",
    d: "3",
    mark: "S",
    color: "oklch(0.60 0.14 45)",
    fontSize: 34,
    name: "Symbols",
    desc: "Letter tiers, stars, marks. Borrow a system or invent your own shorthand.",
  },
  {
    kind: "mark",
    d: "4",
    mark: "✶",
    color: "oklch(0.58 0.13 320)",
    fontSize: 34,
    name: "Anything else",
    desc: "Mix scales across your list, or build a rating axis that's entirely yours.",
  },
];

type Layer = { d: string; num: string; title: string; body: string; tag: string };

const LAYERS: Layer[] = [
  {
    d: "1",
    num: "01 — your scale",
    title: "Pick the language you think in",
    body: "A feeling glyph, a 9.2, an S-tier or a star — choose per title, mix freely across the list. Just one mark is all that's ever required.",
    tag: "feelings · numbers · symbols · custom",
  },
  {
    d: "2",
    num: "02 — your axes",
    title: "Rate what you care about",
    body: "Story, art, music, pacing — or invent your own axes. Fully personal, never aggregated publicly.",
    tag: "private by default",
  },
  {
    d: "3",
    num: "03 — your take",
    title: "Say it in your words",
    body: "A line or a long note. This is what the recommendation engine reads — your language, not a score.",
    tag: "feeds your taste profile",
  },
];

type SculptPoint = {
  d: string;
  ico: "merge" | "token" | "brush";
  title: string;
  body: string;
};

const SCULPT_POINTS: SculptPoint[] = [
  {
    d: "1",
    ico: "merge",
    title: "Stack to group",
    body: "Drag one title onto another and they merge into a group — like stacking cards on a table.",
  },
  {
    d: "2",
    ico: "token",
    title: "Drop rules where you want them",
    body: "Sort, colour, group and tag tokens drag onto your whole list, or onto a single group to scope them.",
  },
  {
    d: "3",
    ico: "brush",
    title: "Paint rules by hand",
    body: "Hold a token and sweep it across entries to apply it one by one. Small changes, instant feedback.",
  },
];

type FooterCol = { heading: string; links: { label: string; href: string }[] };

const FOOTER_COLS: FooterCol[] = [
  {
    heading: "Product",
    links: [
      { label: "Your list", href: "/home" },
      { label: "Sculpt mode", href: "/home" },
      { label: "Schedule", href: "#impression" },
      { label: "Journal", href: "#impression" },
    ],
  },
  {
    heading: "Taste",
    links: [
      { label: "The Impression model", href: "#impression" },
      { label: "Recommendations", href: "#sculpt" },
      { label: "Trusted circles", href: "#sculpt" },
      { label: "Anti-hype filter", href: "#impression" },
    ],
  },
  {
    heading: "Kokoro",
    links: [
      { label: "Kokoro+", href: "#top" },
      { label: "About", href: "#top" },
      { label: "Privacy", href: "#top" },
      { label: "Contact", href: "#top" },
    ],
  },
];

const FONT_OPTIONS: { key: string; label: string }[] = [
  { key: "onest", label: "Onest" },
  { key: "nunito", label: "Nunito" },
  { key: "figtree", label: "Figtree" },
  { key: "quicksand", label: "Quicksand" },
  { key: "bricolage", label: "Bricolage" },
  { key: "serif", label: "Serif" },
];

const FONT_STORAGE_KEY = "kuroku-landing-font";

export default function LandingClient() {
  const [font, setFont] = useState<string>("nunito");

  /* ---- font picker: read saved choice, reflect onto <html data-font> ---- */
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(FONT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    if (saved) {
      document.documentElement.setAttribute("data-font", saved);
      setFont(saved);
    } else {
      setFont(document.documentElement.getAttribute("data-font") || "nunito");
    }
  }, []);

  function pickFont(key: string) {
    document.documentElement.setAttribute("data-font", key);
    try {
      localStorage.setItem(FONT_STORAGE_KEY, key);
    } catch {
      /* ignore */
    }
    setFont(key);
  }

  /* ---- nav scroll state + parallax + reveal-on-scroll ---- */
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nav = navRef.current;

    const onScrollNav = () => {
      if (nav) nav.classList.toggle("scrolled", window.scrollY > 24);
    };
    onScrollNav();

    // parallax
    type Item = { el: HTMLElement; speed: number; center: number };
    const items: Item[] = Array.from(
      document.querySelectorAll<HTMLElement>("[data-parallax]"),
    ).map((el) => ({
      el,
      speed: parseFloat(el.getAttribute("data-parallax") || "0") || 0,
      center: 0,
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

    // reveal on scroll
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
    const target =
      href === "#top"
        ? document.body
        : document.querySelector(href);
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
          <a href="#impression" onClick={onAnchorClick}>
            The idea
          </a>
          <a href="#sculpt" onClick={onAnchorClick}>
            Lists
          </a>
          <a href="#sculpt" onClick={onAnchorClick}>
            Schedule
          </a>
          <a href="#impression" onClick={onAnchorClick}>
            Journal
          </a>
        </div>
        <div className="lp-nav__spacer"></div>
        <div className="lp-nav__auth">
          <a className="lp-signin" href="/login">
            Sign in
          </a>
          <a className="btn btn--accent" href="/signup">
            Create account
          </a>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <header className="lp-hero" id="top">
        <div className="lp-hero__bg" data-parallax="0.18"></div>
        <div className="lp-hero__vignette"></div>
        <div className="lp-grain"></div>

        <div className="lp-hero__inner">
          <span className="eyebrow lp-hero__eyebrow">Your list, your rules</span>
          <h1>
            Run your lists <em>your way.</em>
          </h1>
          <p className="lp-hero__sub">
            Stack, sort, tag and colour every title until the list works exactly
            how your head does. The most customisable way to manage what you
            watch.
          </p>
          <div className="lp-hero__cta">
            <div className="lp-hero__ctarow">
              <a className="btn btn--accent btn--lg" href="/signup">
                Start your list — it&apos;s free
              </a>
              <a
                className="btn btn--ghost btn--lg"
                href="#sculpt"
                onClick={onAnchorClick}
              >
                See how it works
              </a>
            </div>
            <span className="lp-hero__fineprint">
              Free forever · Kokoro+ unlocks the power tools
            </span>
          </div>
        </div>

        {/* poster fan */}
        <div className="lp-strip" data-parallax="-0.05">
          {POSTERS.map((p) => (
            <div className="lp-fan" key={p.title}>
              <article className="lp-poster">
                <div
                  className="lp-poster__art"
                  style={{ background: p.art }}
                ></div>
                <div className="lp-poster__scrim"></div>
                <span className="lp-poster__ph">key art</span>
                <span className="lp-poster__feel" style={{ color: p.feelVar }}>
                  <Glyph feeling={p.feel} size={16} />
                </span>
                <div className="lp-poster__label">
                  <div className="lp-poster__title">{p.title}</div>
                  <div className="lp-poster__meta">{p.meta}</div>
                </div>
              </article>
            </div>
          ))}
        </div>

        <div className="lp-scrollcue">
          <div className="lp-scrollcue__line"></div>
          <span>Scroll</span>
        </div>
      </header>

      {/* ============ IMPRESSION ============ */}
      <section className="lp-section lp-section--cream" id="impression">
        <div className="lp-wrap">
          <div className="lp-sec-head reveal">
            <span className="eyebrow">Rate your way</span>
            <h2>Rate it however you think.</h2>
            <p>
              Some titles are a feeling. Some are a clean 9.2. Some are an
              S-tier, a star, or a system only you understand. Kokoro lets every
              entry carry whatever mark fits — then sort, group and filter your
              list by any of them.
            </p>
          </div>

          <div className="lp-feelings">
            {FEEL_CARDS.map((c) => (
              <div className="lp-feel reveal" data-d={c.d} key={c.name}>
                {c.kind === "glyph" ? (
                  <span
                    className="lp-feel__glyph"
                    style={{ color: "var(--feel-loved)" }}
                  >
                    <Glyph feeling={c.feeling} size={46} />
                  </span>
                ) : (
                  <span
                    className="lp-feel__mark"
                    style={{ color: c.color, fontSize: `${c.fontSize}px` }}
                  >
                    {c.mark}
                  </span>
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

      {/* ============ SCULPT ============ */}
      <section className="lp-section lp-section--sculpt" id="sculpt">
        <div className="lp-wrap">
          <div className="lp-sculpt-grid">
            <div>
              <div className="reveal">
                <span className="eyebrow">Sculpt mode</span>
                <h2 className="lp-sec-head" style={{ margin: 0 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-title)",
                      fontWeight: 500,
                      fontSize: "clamp(30px,4.4vw,54px)",
                      lineHeight: 1.06,
                      letterSpacing: "-0.02em",
                      color: "var(--on-dark)",
                      display: "block",
                    }}
                  >
                    The best list isn&apos;t designed. It emerges.
                  </span>
                </h2>
              </div>
              <div className="lp-sculpt-points">
                {SCULPT_POINTS.map((pt) => (
                  <div className="lp-point reveal" data-d={pt.d} key={pt.title}>
                    <span className="lp-point__mark" data-ico={pt.ico}>
                      <PointIcon ico={pt.ico} />
                    </span>
                    <div>
                      <h4>{pt.title}</h4>
                      <p>{pt.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* mock list */}
            <div
              className="lp-mock reveal"
              data-d="2"
              data-parallax="0.04"
              ref={mockRef}
            >
              <div className="lp-mock__frame">
                <div className="lp-mock__bar">
                  <span className="lp-mock__chip">
                    <span
                      className="sw"
                      style={{ background: "oklch(0.62 0.10 265)" }}
                    ></span>
                    Group · feeling
                  </span>
                  <span className="lp-mock__chip">
                    <span
                      className="sw"
                      style={{ background: "oklch(0.66 0.13 45)" }}
                    ></span>
                    Colour · genre
                  </span>
                  <span className="lp-mock__chip">
                    <span
                      className="sw"
                      style={{ background: "oklch(0.62 0.09 320)" }}
                    ></span>
                    Tag · episodes
                  </span>
                </div>

                <div className="lp-mock__group">
                  <div className="lp-mock__ghead">
                    <span className="lp-mock__gname">Comfort rewatches</span>
                    <span className="lp-mock__gbadge">scoped</span>
                  </div>
                  <div className="lp-mock__rows">
                    <div className="lp-row">
                      <span
                        className="lp-row__stripe"
                        style={{ background: "oklch(0.66 0.105 248)" }}
                      ></span>
                      <span
                        className="lp-row__glyph"
                        style={{ color: "var(--feel-loved)" }}
                      >
                        <Glyph feeling="loved" size={18} />
                      </span>
                      <span className="lp-row__title">Cowboy Bebop</span>
                      <span className="lp-row__tag">26 ep</span>
                    </div>
                    <div className="lp-row">
                      <span
                        className="lp-row__stripe"
                        style={{ background: "oklch(0.66 0.105 278)" }}
                      ></span>
                      <span
                        className="lp-row__mark"
                        style={{ color: "oklch(0.72 0.13 250)" }}
                      >
                        9.4
                      </span>
                      <span className="lp-row__title">Mushishi</span>
                      <span className="lp-row__tag">26 ep</span>
                    </div>
                  </div>
                </div>

                <div className="lp-mock__rows" style={{ padding: 0 }}>
                  <div className="lp-row">
                    <span
                      className="lp-row__stripe"
                      style={{ background: "oklch(0.66 0.105 300)" }}
                    ></span>
                    <span
                      className="lp-row__glyph"
                      style={{ color: "var(--feel-loved)" }}
                    >
                      <Glyph feeling="loved" size={18} />
                    </span>
                    <span className="lp-row__title">Frieren</span>
                    <span className="lp-row__tag">28 ep</span>
                  </div>
                  <div className="lp-row">
                    <span
                      className="lp-row__stripe"
                      style={{ background: "oklch(0.66 0.105 30)" }}
                    ></span>
                    <span
                      className="lp-row__mark"
                      style={{ color: "oklch(0.74 0.14 45)" }}
                    >
                      A
                    </span>
                    <span className="lp-row__title">Mob Psycho 100</span>
                    <span className="lp-row__tag">25 ep</span>
                  </div>
                  <div className="lp-row">
                    <span
                      className="lp-row__stripe"
                      style={{ background: "oklch(0.66 0.105 12)" }}
                    ></span>
                    <span
                      className="lp-row__mark"
                      style={{ color: "oklch(0.72 0.13 320)" }}
                    >
                      ☆
                    </span>
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
        </div>
      </section>

      {/* ============ CLOSING CTA ============ */}
      <section className="lp-cta">
        <div className="lp-cta__bg" data-parallax="0.12"></div>
        <div className="lp-cta__glyphs reveal">
          <span className="g" style={{ color: "var(--feel-loved)" }}>
            <Glyph feeling="loved" size={26} />
          </span>
          <span className="g" style={{ color: "var(--feel-liked)" }}>
            <Glyph feeling="liked" size={26} />
          </span>
          <span className="g" style={{ color: "var(--feel-mixed)" }}>
            <Glyph feeling="mixed" size={26} />
          </span>
          <span className="g" style={{ color: "var(--feel-dropped)" }}>
            <Glyph feeling="dropped" size={26} />
          </span>
        </div>
        <h2 className="reveal" data-d="1">
          Start the list that&apos;s actually yours.
        </h2>
        <p className="lp-cta__sub reveal" data-d="2">
          No scores to chase. No averages to argue with. Just what you watched,
          how it felt, and where it belongs.
        </p>
        <div className="lp-cta__btn reveal" data-d="3">
          <a className="btn btn--accent btn--lg" href="/signup">
            Create your account
          </a>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="lp-footer">
        <div className="lp-footer__top">
          <div className="lp-footer__brand">
            <a className="lp-brand" href="#top" onClick={onAnchorClick}>
              Kokoro<span className="dot">.</span>
            </a>
            <p>
              A personal anime tracker for people who&apos;d rather trust their
              own taste than a crowd&apos;s average.
            </p>
          </div>
          {FOOTER_COLS.map((col) => (
            <div className="lp-footcol" key={col.heading}>
              <h5>{col.heading}</h5>
              {col.links.map((link, i) =>
                link.href.startsWith("#") ? (
                  <a key={i} href={link.href} onClick={onAnchorClick}>
                    {link.label}
                  </a>
                ) : (
                  <a key={i} href={link.href}>
                    {link.label}
                  </a>
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

      {/* ============ TYPE SWITCHER ============ */}
      <div className="lp-fontpicker" id="fontpicker">
        <span className="lp-fontpicker__lbl">Type</span>
        {FONT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            data-font-opt={opt.key}
            aria-pressed={font === opt.key ? "true" : "false"}
            onClick={() => pickFont(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </>
  );
}
