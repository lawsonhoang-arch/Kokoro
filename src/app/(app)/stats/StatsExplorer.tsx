"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { StatsData } from "@/lib/stats";

const s1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, "");
const fmt = (n: number) => n.toLocaleString();
const C = 110, R = 78;
// Aspect axes (Story/Art/Music/Pacing) cluster in the 3.5–4.5 band, so plotting
// from a 2→5 band (base 2) makes per-genre differences legible; the fingerprint
// axes are already normalised 0→5 so they plot linearly (base 0). Labels always
// show the true value; only the plotted radius is scaled. ptF = raw geometric
// fraction (rings/spokes/labels).
const frac = (v: number, base: number) => Math.max(0, Math.min(1, (v - base) / (5 - base)));
const ptF = (i: number, N: number, f: number) => {
  const a = (Math.PI * 2 * i) / N - Math.PI / 2;
  return [C + Math.cos(a) * R * f, C + Math.sin(a) * R * f] as const;
};
const ptV = (i: number, N: number, v: number, base: number) => ptF(i, N, frac(v, base));

/* ── Radar that tweens to `values` ───────────────────────────────────────── */
function Radar({ names, values, base = 2 }: { names: string[]; values: number[]; base?: number }) {
  const N = names.length;
  const poly = useRef<SVGPolygonElement>(null);
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const vals = useRef<(SVGTSpanElement | null)[]>([]);
  const cur = useRef<number[]>(values.slice());
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      let done = true;
      for (let i = 0; i < N; i++) {
        const c = cur.current[i] ?? values[i];
        const nv = c + (values[i] - c) * 0.16;
        cur.current[i] = Math.abs(values[i] - nv) < 0.004 ? values[i] : nv;
        if (cur.current[i] !== values[i]) done = false;
      }
      poly.current?.setAttribute("points", cur.current.map((v, i) => ptV(i, N, v, base).join(",")).join(" "));
      cur.current.forEach((v, i) => {
        const e = ptV(i, N, v, base);
        dots.current[i]?.setAttribute("cx", String(e[0])); dots.current[i]?.setAttribute("cy", String(e[1]));
        if (vals.current[i]) vals.current[i]!.textContent = s1(v);
      });
      if (!done) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [values, N, base]);

  const ring = (f: number) => Array.from({ length: N }, (_, i) => ptF(i, N, f).join(",")).join(" ");
  return (
    <svg className="sx-radar" viewBox="-46 0 312 220" role="img" aria-label="Taste-shape axes">
      {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} className={"sx-radar__ring" + (f === 1 ? " o" : "")} points={ring(f)} />)}
      {names.map((_, i) => { const e = ptF(i, N, 1); return <line key={i} className="sx-radar__spoke" x1={C} y1={C} x2={e[0]} y2={e[1]} />; })}
      <polygon ref={poly} className="sx-radar__data" points={values.map((v, i) => ptV(i, N, v, base).join(",")).join(" ")} />
      {names.map((_, i) => { const e = ptV(i, N, values[i], base); return <circle key={i} ref={(el) => { dots.current[i] = el; }} className="sx-radar__dot" r={3.6} cx={e[0]} cy={e[1]} />; })}
      {names.map((name, i) => {
        const e = ptF(i, N, 1.2); const anc = e[0] < C - 8 ? "end" : e[0] > C + 8 ? "start" : "middle";
        return <text key={i} className="sx-radar__lab" x={e[0]} y={e[1]} textAnchor={anc} dominantBaseline="middle">{name} <tspan ref={(el) => { vals.current[i] = el; }} className="sx-radar__labv">{s1(values[i])}</tspan></text>;
      })}
    </svg>
  );
}

/* count-up tween for a single number */
function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0; const t0 = performance.now(); const dur = 950;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      if (ref.current) ref.current.textContent = s1(value * ease(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span ref={ref} className={className}>{s1(value)}</span>;
}

function ScoreCurve({ dist, mean }: { dist: { label: string; n: number }[]; mean: number | null }) {
  const [hi, setHi] = useState<number | null>(null);
  const n = dist.length, max = Math.max(1, ...dist.map((d) => d.n));
  // headroom top (peak tops out at y≈12) + bottom so the stroke never clips
  const pts = dist.map((d, i) => [(i / (n - 1)) * 100, 100 - (d.n / max) * 80 - 8] as const);
  let path = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    path += ` C ${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(2)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(2)}, ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(2)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  const meanPct = mean != null ? ((Math.min(5, Math.max(1, mean)) - 1) / 4) * 100 : null;
  const act = hi != null ? dist[hi] : null;
  // keep edge labels inside the plot: anchor to a side near the ends instead of centering
  const anchorX = (x: number) => (x < 12 ? "0" : x > 88 ? "-100%" : "-50%");
  return (
    <div className="sx-curvewrap">
      <div className="sx-curve__plot">
        {meanPct != null && !act && <span className="sx-curve__mean" style={{ left: `${meanPct}%` }}><span className="sx-curve__pill" style={{ transform: `translateX(${anchorX(meanPct)})` }}>★{s1(mean!)}</span></span>}
        <svg className="sx-curve" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id="sxg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--focus)" stopOpacity="0.42" /><stop offset="1" stopColor="var(--focus)" stopOpacity="0.02" /></linearGradient></defs>
          <path className="sx-curve__area" d={`${path} L 100 100 L 0 100 Z`} fill="url(#sxg)" />
          <path className="sx-curve__ln" d={path} pathLength={1} vectorEffect="non-scaling-stroke" fill="none" />
        </svg>
        {act && (
          <>
            <span className="sx-curve__guide" style={{ left: `${pts[hi!][0]}%` }} />
            <span className="sx-curve__mk" style={{ left: `${pts[hi!][0]}%`, top: `${pts[hi!][1]}%` }} />
            <span className="sx-curve__tip" style={{ left: `${pts[hi!][0]}%`, transform: `translate(${anchorX(pts[hi!][0])}, -100%)` }}><b>{fmt(act.n)}</b> {act.n === 1 ? "rating" : "ratings"} at {act.label}</span>
          </>
        )}
        <div className="sx-curve__hits">
          {dist.map((d, i) => (
            <button key={d.label} type="button" className="sx-curve__hit"
              onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}
              onFocus={() => setHi(i)} onBlur={() => setHi(null)}
              aria-label={`${d.label}: ${d.n} ${d.n === 1 ? "rating" : "ratings"}`} />
          ))}
        </div>
      </div>
      <div className="sx-curve__ax">{dist.map((d, i) => <span key={d.label} className={(d.n ? "" : "f") + (hi === i ? " on" : "")}>{d.label}{d.n ? <b>{d.n}</b> : null}</span>)}</div>
    </div>
  );
}

const FEEL_COLOR: Record<string, string> = { Loved: "#e86a94", Liked: "#7cc97f", Mixed: "#f2b134", Dropped: "#8a7f78" };
const LENSES = ["overview", "genres", "ratings", "eras"] as const;
const LENS_LABEL: Record<string, string> = { overview: "Overview", genres: "Genres", ratings: "Ratings", eras: "Eras" };

export function StatsExplorer({ data }: { data: StatsData }) {
  const [lens, setLens] = useState<string>("overview");
  const [locked, setLocked] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [eraSel, setEraSel] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const focus = hover ?? locked;
  const fg = focus != null ? data.genres[focus] : null;
  const h = data.headline;
  const axisNames = data.axes.map((a) => a.name);
  const overallAx = data.axes.map((a) => a.avg);
  // Taste-shape radar mode: real aspect axes if the user rates by aspect, else a
  // "fingerprint" from always-available per-genre signals (so it varies).
  const aspectMode = data.tasteMode === "aspects";
  const radarNames = aspectMode ? axisNames : data.fingerprintAxes;
  const radarBase = aspectMode ? 2 : 0;
  const overallRadar = aspectMode ? overallAx : data.fingerprintOverall;
  const genreRadar = (g: (typeof data.genres)[number]) => (aspectMode ? g.axes : g.fingerprint);
  const feelTotal = data.feelings.reduce((s, f) => s + f.n, 0) || 1;
  const decMax = Math.max(1, ...data.decades.map((d) => d.n));

  useEffect(() => {
    // the colour-morph lives in the Genres lens; other lenses stay on-brand
    if (fg && lens === "genres") root.current?.style.setProperty("--focus", fg.color);
    else root.current?.style.removeProperty("--focus");
  }, [fg, lens]);

  const insights: string[] = [];
  if (data.axes.length >= 2) { const srt = [...data.axes].sort((a, b) => b.avg - a.avg); if (srt[0].avg - srt[srt.length - 1].avg >= 0.3) insights.push(`You prize ${srt[0].name.toLowerCase()} over ${srt[srt.length - 1].name.toLowerCase()} — ${s1(srt[0].avg)} vs ${s1(srt[srt.length - 1].avg)}.`); }
  if (data.genres[0]) insights.push(`${data.genres[0].genre} is your home ground — ${fmt(data.genres[0].n)} titles.`);
  if (data.vsCrowd) { const d = data.vsCrowd.avgDelta; insights.push(Math.abs(d) < 0.05 ? "You rate in line with the crowd." : `You rate ${Math.abs(d).toFixed(2)} ${d > 0 ? "higher" : "tougher"} than the crowd.`); }
  if (h.completionRate >= 0.8) insights.push(`You finish what you start — ${Math.round(h.completionRate * 100)}%.`);

  const metrics = [
    { v: fmt(h.tracked), l: "Tracked" }, { v: `${Math.round(h.completionRate * 100)}%`, l: "Finished" },
    { v: fmt(h.hours), l: "Hours" }, { v: fmt(h.rated), l: "Rated" }, { v: fmt(h.distinctGenres), l: "Genres" },
  ];

  const readout = fg
    ? <><b>{fg.genre} · ★{fg.avg != null ? s1(fg.avg) : "—"}</b><span>{fmt(fg.n)} titles · peaks in the {data.decades[fg.decades.indexOf(Math.max(...fg.decades))]?.label ?? "—"}</span></>
    : <><b>Your overall taste</b><span>tap a genre to focus</span></>;

  const genreBtn = (i: number, node: React.ReactNode, cls: string) => (
    <button
      key={data.genres[i].genre}
      className={cls + (locked === i ? " sel" : "")}
      style={{ ["--gc" as string]: data.genres[i].color }}
      onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
      onClick={() => setLocked(locked === i ? null : i)}
    >{node}</button>
  );

  const eraGenres = eraSel != null
    ? data.genres.map((g) => ({ genre: g.genre, color: g.color, n: g.decades[eraSel] ?? 0 })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 6)
    : [];

  return (
    <div className="sx" ref={root}>
      <div className="sx-lenses" role="tablist">
        {LENSES.map((L) => (
          <button key={L} role="tab" aria-selected={lens === L} className={"sx-tab" + (lens === L ? " on" : "")} onClick={() => setLens(L)}>{LENS_LABEL[L]}</button>
        ))}
      </div>

      {lens === "overview" && (
        <div className="sx-lens" key="overview">
          <div className="sx-grid">
            <div className="sx-card glow sx-scorecard">
              <div className="sx-lbl">Mean score</div>
              <div className="sx-score">
                {h.meanScore != null ? <CountUp value={h.meanScore} className="sx-score__num" /> : <span className="sx-score__num">—</span>}
                <span className="sx-score__of">out of 5</span>
              </div>
              {h.meanScore != null && (
                <div className="sx-score__track" style={{ ["--fill" as string]: `${(h.meanScore / 5) * 100}%` }}>
                  <span className="sx-score__fill" />
                  {[1, 2, 3, 4].map((t) => <span key={t} className="sx-score__tick" style={{ left: `${(t / 5) * 100}%` }} />)}
                  <span className="sx-score__knob" style={{ left: `${(h.meanScore / 5) * 100}%` }} />
                </div>
              )}
              <div className="sx-score__cap">across {fmt(h.rated)} rated titles</div>
              <ul className="sx-insights">{insights.slice(0, 3).map((t, i) => <li key={i} style={{ ["--d" as string]: `${i * 90}ms` }}>{t}</li>)}</ul>
            </div>
            <div className="sx-card">
              <div className="sx-lbl">Your taste shape</div>
              <Radar names={radarNames} values={overallRadar} base={radarBase} />
            </div>
          </div>
          <div className="sx-metrics">{metrics.map((m) => <div className="sx-metric" key={m.l}><b>{m.v}</b><span>{m.l}</span></div>)}</div>
        </div>
      )}

      {lens === "genres" && (
        <div className="sx-lens" key="genres">
          <div className="sx-grid sx-grid--genres">
            <div className="sx-card glow sx-card--taste">
              <div className="sx-lbl">{aspectMode ? "Taste shape" : "Genre fingerprint"}</div>
              <div className="sx-tastebody">
                <Radar names={radarNames} values={fg ? genreRadar(fg) : overallRadar} base={radarBase} />
                <div className="sx-readout">{readout}</div>
              </div>
            </div>
            <div className="sx-card">
              <div className="sx-lbl">Where your hours go — tap to explore</div>
              <div className={"sx-chips" + (fg ? " dim" : "")}>
                {data.genres.map((g, i) => genreBtn(i, <>{g.genre}<span className="sx-chip__n">{g.n}</span></>, "sx-chip"))}
              </div>
              <div className="sx-lbl" style={{ marginTop: 24 }}>{fg ? `${fg.genre} by era` : "By era"}</div>
              <div className="sx-era">
                {(fg ? fg.decades : data.decades.map((d) => d.n)).map((v, i) => {
                  const arr = fg ? fg.decades : data.decades.map((d) => d.n);
                  const hot = i === arr.indexOf(Math.max(...arr));
                  return <div className="sx-era__col" key={data.decades[i]?.label ?? i}><span className={"sx-era__bar" + (hot ? " hot" : "")} style={{ height: `${(v / Math.max(1, ...arr)) * 100}%` }} /><span className="sx-era__l">{data.decades[i]?.label}</span></div>;
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {lens === "ratings" && (
        <div className="sx-lens" key="ratings">
          <div className="sx-card glow">
            <div className="sx-cardhead"><h2>How you score</h2><p>{fmt(h.rated)} ratings across the scale</p></div>
            <ScoreCurve dist={data.scoreDist} mean={h.meanScore} />
            <div className="sx-split">
              {data.vsCrowd && (
                <div className="sx-vs">
                  <div className={"sx-vs__num " + (data.vsCrowd.avgDelta >= 0 ? "up" : "down")}>{data.vsCrowd.avgDelta >= 0 ? "+" : "−"}{Math.abs(data.vsCrowd.avgDelta).toFixed(2)}</div>
                  <p>You rate <b>{data.vsCrowd.avgDelta >= 0 ? "higher" : "tougher"}</b> than the crowd — {fmt(data.vsCrowd.higher)} above, {fmt(data.vsCrowd.lower)} below.</p>
                </div>
              )}
              {data.feelings.length > 0 && (
                <div className="sx-feel">
                  <div className="sx-lbl">Feelings</div>
                  <div className="sx-seg">{data.feelings.map((f) => <span key={f.label} className="sx-seg__p" style={{ flexGrow: f.n, background: FEEL_COLOR[f.label] ?? "var(--focus)" }} title={`${f.label} · ${f.n}`} />)}</div>
                  <div className="sx-seg__key">{data.feelings.map((f) => <span key={f.label}><i style={{ background: FEEL_COLOR[f.label] ?? "var(--focus)" }} />{f.label} {Math.round((f.n / feelTotal) * 100)}%</span>)}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {lens === "eras" && (
        <div className="sx-lens" key="eras">
          <div className="sx-card glow">
            <div className="sx-cardhead"><h2>Across the eras</h2><p>tap a decade to see its genre mix</p></div>
            <div className="sx-era sx-era--big">
              {data.decades.map((d, i) => (
                <div className={"sx-era__col sx-era__col--tall" + (eraSel === i ? " on" : "")} key={d.label}>
                  <span className="sx-era__v">{d.n || ""}</span>
                  <span className="sx-era__track">
                    <button className={"sx-era__bar sx-era__bar--btn" + (eraSel === i ? " hot" : "")} style={{ height: `${(d.n / decMax) * 100}%`, animationDelay: `${i * 55}ms` }} onClick={() => setEraSel(eraSel === i ? null : i)} aria-label={`${d.label}: ${d.n}`} />
                  </span>
                  <span className="sx-era__l">{d.label}</span>
                </div>
              ))}
            </div>
            <div className="sx-eraread" key={eraSel ?? -1}>
              {eraSel != null ? (
                <><b>{data.decades[eraSel].label} — {fmt(data.decades[eraSel].n)} titles</b>
                  <div className="sx-mix">{eraGenres.map((g, gi) => <span key={g.genre} className="sx-mixchip" style={{ ["--gc" as string]: g.color, ["--d" as string]: `${gi * 55}ms` }}>{g.genre}<b>{g.n}</b></span>)}</div></>
              ) : (
                <><b>{data.decades.length ? `The ${data.decades.reduce((a, b) => (b.n > a.n ? b : a)).label} are your home decade` : "No era data yet"}</b><span>tap any bar above to see its genre mix</span></>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function StatsEmpty() {
  return (
    <Link className="sx-empty" href="/watchlist?import=1">
      <span className="sx-empty__spark" aria-hidden="true">✦</span>
      <span><b>Nothing to chart yet.</b> Import a list from AniList or MyAnimeList — your scores come along and your stats light up instantly.</span>
      <span className="sx-empty__cta">Import →</span>
    </Link>
  );
}
