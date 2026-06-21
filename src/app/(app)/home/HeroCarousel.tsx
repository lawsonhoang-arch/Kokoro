"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import type { HeroSlide } from "@/lib/catalog";
import { AddToWatchlist } from "@/features/search/AddToWatchlist";

function heroPoster(seed: string): CSSProperties {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  h = Math.abs(h);
  const a = h % 360;
  return {
    backgroundImage: `linear-gradient(135deg, oklch(0.5 0.14 ${a}) 0%, oklch(0.32 0.1 ${(a + 40) % 360}) 100%)`,
  };
}

// Push channels away from their mean so a muddy average reads as a real hue.
function boostSat(r: number, g: number, b: number, f: number): [number, number, number] {
  const avg = (r + g + b) / 3;
  const adj = (c: number) => Math.max(0, Math.min(255, Math.round(avg + (c - avg) * f)));
  return [adj(r), adj(g), adj(b)];
}

// The cover's representative colour: average of pixels weighted by saturation
// (so vivid mid-tones dominate over near-black/near-white backgrounds).
function dominantColor(data: Uint8ClampedArray): string | null {
  let r = 0, g = 0, b = 0, wsum = 0;
  let fr = 0, fg = 0, fb = 0, fn = 0; // plain-average fallback
  for (let i = 0; i < data.length; i += 4) {
    const R = data[i], G = data[i + 1], B = data[i + 2], A = data[i + 3];
    if (A < 128) continue;
    fr += R; fg += G; fb += B; fn++;
    const max = Math.max(R, G, B), min = Math.min(R, G, B);
    const v = max / 255;
    const s = max === 0 ? 0 : (max - min) / max;
    const w = s * (v > 0.12 && v < 0.97 ? 1 : 0.15);
    r += R * w; g += G * w; b += B * w; wsum += w;
  }
  if (wsum > 0.5) {
    r = Math.round(r / wsum); g = Math.round(g / wsum); b = Math.round(b / wsum);
  } else if (fn > 0) {
    r = Math.round(fr / fn); g = Math.round(fg / fn); b = Math.round(fb / fn);
  } else {
    return null;
  }
  const [br, bg, bb] = boostSat(r, g, b, 1.45);
  return `rgb(${br}, ${bg}, ${bb})`;
}

function parseRgb(s: string): [number, number, number] | null {
  const m = s.match(/rgb\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  return m ? [+m[1], +m[2], +m[3]] : null;
}

// The top-glow gradient with a concrete colour baked in. We set this straight on
// the element's backgroundImage each frame (rather than animating a CSS variable
// read through color-mix) because that's the only way the browser reliably
// repaints the gradient on every frame instead of snapping.
function glowGradient(r: number, g: number, b: number): string {
  // Peak is pushed down to ~14% so it clears the sticky top nav and stays
  // visible; alphas are strong so the fade out/in is clearly apparent.
  return (
    `radial-gradient(135% 80% at 50% 14%, ` +
    `rgba(${r}, ${g}, ${b}, 0.78) 0%, ` +
    `rgba(${r}, ${g}, ${b}, 0.46) 22%, ` +
    `rgba(${r}, ${g}, ${b}, 0.18) 45%, ` +
    `transparent 68%)`
  );
}

// Load a cover (via a CORS image, so the canvas isn't tainted) and resolve its
// dominant colour. Resolves null on any failure so callers can fall back.
function sampleColor(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    // A distinct query param keeps this CORS request in its own cache slot, so it
    // never collides with the plain (non-CORS) <img> that displays the same art —
    // which would otherwise taint the canvas or break the display image.
    const corsUrl = url + (url.includes("?") ? "&" : "?") + "glowcors=1";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = 24; c.height = 24;
        const cx = c.getContext("2d", { willReadFrequently: true });
        if (!cx) return resolve(null);
        cx.drawImage(img, 0, 0, 24, 24);
        resolve(dominantColor(cx.getImageData(0, 0, 24, 24).data));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = corsUrl;
  });
}

// Sliding featured-anime carousel for the Home hero — auto-advances, pauses on
// hover, with dots + arrows for manual control.
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const n = slides.length;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || n <= 1) return;
    const t = setInterval(() => setActive((a) => (a + 1) % n), 7000);
    return () => clearInterval(t);
  }, [paused, n]);

  // Pre-sample every cover's main colour once on mount, so switching slides
  // applies a cached colour instantly and the page glow cross-fades to it
  // (no per-switch image fetch to lag behind the slide).
  const [colors, setColors] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    // sample the artwork that's actually shown (banner, else cover) so the glow
    // matches the slide. The same URL is displayed with crossOrigin below, so
    // its cached response carries CORS headers and the canvas isn't tainted.
    const covers = [...new Set(slides.map((s) => s.banner || s.cover).filter((c): c is string => !!c))];
    Promise.all(covers.map((url) => sampleColor(url).then((c) => [url, c] as const))).then(
      (pairs) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const [url, c] of pairs) if (c) map[url] = c;
        setColors(map);
      },
    );
    return () => { cancelled = true; };
  }, [slides]);

  // Crossfade the page glow when the slide changes: the current colour fades out,
  // then the next one fades in. Driven frame-by-frame in JS (writing the gradient
  // + opacity straight onto the element) so the repaint is reliable.
  const glowElRef = useRef<HTMLElement | null>(null);
  const colorRef = useRef<[number, number, number] | null>(null);
  const opacityRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const genRef = useRef(0);
  useEffect(() => {
    const cover = slides[active]?.banner || slides[active]?.cover;
    const target = cover ? colors[cover] : null;
    const to = target ? parseRgb(target) : null;
    if (!to) return;
    const el = (glowElRef.current ??= document.querySelector<HTMLElement>(".feature-glow"));
    if (!el) return;
    const gen = ++genRef.current; // invalidate any tween still in flight
    const apply = (rgb: [number, number, number], op: number) => {
      colorRef.current = rgb;
      opacityRef.current = op;
      el.style.backgroundImage = glowGradient(rgb[0], rgb[1], rgb[2]);
      el.style.opacity = op.toFixed(3);
    };
    const fromColor = colorRef.current;
    if (!fromColor) { apply(to, 1); return; } // first paint: appear instantly

    const smooth = (x: number) => x * x * (3 - 2 * x); // smoothstep
    const startOp = opacityRef.current;
    const outDur = 560; // fade the current glow out as the slide transitions away
    const inDur = 900; // then fade the next one in, slower so it's clearly visible
    const start = performance.now();
    const step = (now: number) => {
      if (gen !== genRef.current) return; // a newer tween has taken over
      const t = now - start;
      if (t < outDur) {
        apply(fromColor, startOp * (1 - smooth(t / outDur)));
      } else if (t < outDur + inDur) {
        apply(to, smooth((t - outDur) / inDur));
      } else {
        apply(to, 1);
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active, colors, slides]);

  if (n === 0) return null;
  const go = (i: number) => setActive(((i % n) + n) % n);

  return (
    <div
      className="hero-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      <div className="hero-track" style={{ transform: `translateX(-${active * 100}%)` }}>
        {slides.map((s, i) => {
          const meta = [
            s.year || null,
            s.genres.slice(0, 2).join(" · ") || null,
            s.episodes ? `${s.episodes} ${s.kind === "manga" ? "chapters" : "episodes"}` : null,
            s.score ? `★ ${(s.score / 100).toFixed(1)}` : null,
          ].filter(Boolean);
          return (
            <section className="hero hero-slide" key={s.id} aria-hidden={i !== active}>
              <div className="hero__art" style={heroPoster(s.id)} aria-hidden="true">
                {s.banner ? (
                  // wide banner art fills the frame edge-to-edge
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="hero__cover" src={s.banner} alt="" referrerPolicy="no-referrer" />
                ) : s.cover ? (
                  // no banner: a softly blurred, zoomed cover stands in as a
                  // full-bleed backdrop so the centered text still reads.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="hero__cover hero__cover--blur" src={s.cover} alt="" referrerPolicy="no-referrer" />
                ) : null}
              </div>
              <div className="hero__body">
                <span className="hero__eyebrow">{s.eyebrow}</span>
                <h2 className="hero__title">{s.title}</h2>
                <p className="hero__desc">
                  {s.description ||
                    "Open it for details, or add it to one of your lists to start tracking."}
                </p>
                <div className="hero__meta">
                  {meta.map((m, j) => (
                    <span key={j}>
                      {j > 0 && <span className="sep" />}
                      {m}
                    </span>
                  ))}
                </div>
                <div className="hero__actions">
                  {/* only the visible slide's controls are interactive */}
                  {i === active ? (
                    <>
                      <AddToWatchlist titleId={s.id} />
                      <Link className="btn" href={`/anime/${encodeURIComponent(s.id)}`}>
                        View details
                      </Link>
                    </>
                  ) : null}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {n > 1 && (
        <>
          <button className="hero-nav hero-nav--prev" aria-label="Previous slide" onClick={() => go(active - 1)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button className="hero-nav hero-nav--next" aria-label="Next slide" onClick={() => go(active + 1)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </button>
          <div className="hero-dots" role="tablist" aria-label="Featured slides">
            {slides.map((_, i) => (
              <button
                key={i}
                role="tab"
                className={"hero-dot" + (i === active ? " on" : "")}
                aria-label={`Go to slide ${i + 1}`}
                aria-selected={i === active}
                onClick={() => go(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
