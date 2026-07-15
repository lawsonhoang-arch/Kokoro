import "server-only";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { watchlists, watchlistEntries, titles } from "@/db/schema";
import { entryScore } from "@/lib/profile";
import { hiResCover } from "@/lib/cover";

// Deep personal analytics — the interactive /stats lenses. One de-duped pass
// over the user's tracked titles builds distributions plus per-genre slices
// (axes + eras) so tapping a genre can re-shape the whole view.

export type Bar = { label: string; n: number };
export type AxisStat = { name: string; avg: number; n: number };
export type GenreRich = { genre: string; n: number; avg: number | null; color: string; axes: number[]; fingerprint: number[]; decades: number[] };
export type Superlative = { key: string; label: string; title: string; cover: string | null; value: string };

export type StatsData = {
  empty: boolean;
  headline: {
    rated: number; tracked: number; completed: number;
    completionRate: number; meanScore: number | null; hours: number; distinctGenres: number;
  };
  scoreDist: Bar[];
  axes: AxisStat[];                 // overall avg per rating axis
  genres: GenreRich[];              // top genres, each with per-axis + per-decade slices
  decades: Bar[];
  feelings: Bar[];
  vsCrowd: { sample: number; avgDelta: number; higher: number; lower: number } | null;
  superlatives: Superlative[];      // "your records"
  // Taste-shape radar mode. "aspects" = the real Story/Art/Music/Pacing radar
  // (needs enough per-title dim ratings); else "fingerprint" = a shape built
  // from signals every library has, so it still varies per genre.
  tasteMode: "aspects" | "fingerprint";
  fingerprintAxes: string[];        // axis names for fingerprint mode
  fingerprintOverall: number[];     // library-wide fingerprint (no genre selected)
};

const BASE_AXES = ["story", "art", "music", "pacing"];
const FEELING_META = [
  { key: "loved", label: "Loved" }, { key: "liked", label: "Liked" },
  { key: "mixed", label: "Mixed" }, { key: "dropped", label: "Dropped" },
];
// vibrant, warm-leaning palette; a genre keeps its colour via a name hash
const GENRE_COLORS = ["#ff7a4d", "#e86a94", "#f2b134", "#a77bf0", "#3fc4c4", "#7cc97f", "#6f8bf0", "#f78fb3", "#ff9a52", "#4fb0e0", "#d98ad6", "#8fd15a"];
const colorFor = (g: string) => { let h = 0; for (let i = 0; i < g.length; i++) h = (h * 31 + g.charCodeAt(i)) >>> 0; return GENRE_COLORS[h % GENRE_COLORS.length]; };
const round5 = (x: number) => Math.round(x * 2) / 2;
const cap = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);
const fmtS = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1));

export async function getStats(userId: string): Promise<StatsData> {
  const rows = await db
    .select({
      titleId: titles.id, title: titles.title, english: titles.englishTitle, cover: titles.cover,
      genres: titles.genres, year: titles.year, kind: titles.kind, episodes: titles.episodes,
      catalogScore: titles.score,
      status: watchlistEntries.status, progress: watchlistEntries.progress, watchedEps: watchlistEntries.watchedEps,
      feeling: watchlistEntries.feeling, rateMode: watchlistEntries.rateMode, symbol: watchlistEntries.symbol, dims: watchlistEntries.dims,
    })
    .from(watchlistEntries)
    .innerJoin(watchlists, eq(watchlistEntries.watchlistId, watchlists.id))
    .innerJoin(titles, eq(watchlistEntries.titleId, titles.id))
    .where(eq(watchlists.userId, userId));

  let tracked = 0, completed = 0, watching = 0, minutes = 0, rated = 0, scoreSum = 0;
  const scoreBuckets = new Map<number, number>();
  const axisSum: Record<string, number> = {}, axisN: Record<string, number> = {};
  const genreN: Record<string, number> = {}, genreScoreSum: Record<string, number> = {}, genreScoreN: Record<string, number> = {};
  const genreAxisSum: Record<string, Record<string, number>> = {}, genreAxisN: Record<string, Record<string, number>> = {};
  const genreDecade: Record<string, Record<number, number>> = {};
  // per-genre signals for the "fingerprint" radar (always available)
  const genreCompleted: Record<string, number> = {}, genreEpSum: Record<string, number> = {}, genreEpN: Record<string, number> = {};
  const genreYearSum: Record<string, number> = {}, genreYearN: Record<string, number> = {};
  let yrMin = Infinity, yrMax = -Infinity, dimsRated = 0;
  const decadeN = new Map<number, number>();
  const feelingN: Record<string, number> = {};
  let vsSample = 0, vsDeltaSum = 0, vsHigher = 0, vsLower = 0;

  // superlative record-holders
  type Rec = { titleId: string; title: string; cover: string | null; year: number | null; episodes: number; kind: string; score: number | null; catalog: number | null };
  let topRated: Rec | null = null, longest: Rec | null = null, deepest: Rec | null = null;
  let boldest: { rec: Rec; gap: number } | null = null;
  const consider = (r: Rec, isDone: boolean) => {
    if (isDone && r.episodes > 0 && (!longest || r.episodes > longest.episodes)) longest = r;
    if (r.score != null && (!topRated || r.score > topRated.score!)) topRated = r;
    if (r.score != null && r.score >= 4 && r.year && (!deepest || r.year < deepest.year!)) deepest = r;
    if (r.score != null && r.catalog != null) { const gap = r.score - r.catalog / 200; if (!boldest || Math.abs(gap) > Math.abs(boldest.gap)) boldest = { rec: r, gap }; }
  };

  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.titleId)) continue;
    seen.add(r.titleId);
    tracked++;
    const isDone = r.status === "completed";
    if (isDone) completed++; else if (r.status === "watching") watching++;

    const we = (r.watchedEps as number[] | null) ?? [];
    const watchedCount = Math.min(r.episodes || Infinity, we.length || (isDone ? r.episodes : r.progress ?? 0));
    if (r.kind !== "manga") minutes += watchedCount * 24;

    const score = entryScore(r);
    if (score != null) {
      rated++; scoreSum += score;
      scoreBuckets.set(Math.min(5, Math.max(1, round5(score))), (scoreBuckets.get(Math.min(5, Math.max(1, round5(score)))) ?? 0) + 1);
      if (r.catalogScore != null) { const d = score - r.catalogScore / 200; vsSample++; vsDeltaSum += d; if (d >= 0.25) vsHigher++; else if (d <= -0.25) vsLower++; }
    }
    consider({ titleId: r.titleId, title: r.english || r.title, cover: hiResCover(r.cover), year: r.year, episodes: r.episodes, kind: r.kind, score, catalog: r.catalogScore }, isDone);

    const dims = (r.dims as Record<string, number> | null) ?? {};
    let hasDims = false;
    for (const [k, v] of Object.entries(dims)) if (typeof v === "number" && v > 0) { axisSum[k] = (axisSum[k] ?? 0) + v; axisN[k] = (axisN[k] ?? 0) + 1; hasDims = true; }
    if (hasDims && score != null) dimsRated++;

    const dec = r.year ? Math.floor(r.year / 10) * 10 : null;
    if (dec != null) decadeN.set(dec, (decadeN.get(dec) ?? 0) + 1);
    if (r.year) { if (r.year < yrMin) yrMin = r.year; if (r.year > yrMax) yrMax = r.year; }
    if (r.feeling) feelingN[r.feeling] = (feelingN[r.feeling] ?? 0) + 1;

    for (const g of r.genres ?? []) {
      genreN[g] = (genreN[g] ?? 0) + 1;
      if (score != null) { genreScoreSum[g] = (genreScoreSum[g] ?? 0) + score; genreScoreN[g] = (genreScoreN[g] ?? 0) + 1; }
      if (dec != null) { (genreDecade[g] ??= {})[dec] = ((genreDecade[g] ??= {})[dec] ?? 0) + 1; }
      if (isDone) genreCompleted[g] = (genreCompleted[g] ?? 0) + 1;
      if (r.episodes) { genreEpSum[g] = (genreEpSum[g] ?? 0) + r.episodes; genreEpN[g] = (genreEpN[g] ?? 0) + 1; }
      if (r.year) { genreYearSum[g] = (genreYearSum[g] ?? 0) + r.year; genreYearN[g] = (genreYearN[g] ?? 0) + 1; }
      const gas = (genreAxisSum[g] ??= {}), gan = (genreAxisN[g] ??= {});
      for (const [k, v] of Object.entries(dims)) if (typeof v === "number" && v > 0) { gas[k] = (gas[k] ?? 0) + v; gan[k] = (gan[k] ?? 0) + 1; }
    }
  }

  const scoreDist: Bar[] = [];
  for (let s = 1; s <= 5; s += 0.5) scoreDist.push({ label: fmtS(s), n: scoreBuckets.get(s) ?? 0 });

  const axisKeys = [...BASE_AXES.filter((k) => axisN[k]), ...Object.keys(axisN).filter((k) => !BASE_AXES.includes(k)).sort()];
  const axes: AxisStat[] = axisKeys.map((k) => ({ name: cap(k), avg: axisSum[k] / axisN[k], n: axisN[k] }));
  const overallAxisAvg = axisKeys.map((k) => axisSum[k] / axisN[k]);

  const decadeList = [...decadeN.keys()].sort((a, b) => a - b);
  const decades: Bar[] = decadeList.map((d) => ({ label: `${String(d).slice(2)}s`, n: decadeN.get(d)! }));

  const topGenres = Object.entries(genreN)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12);

  // "Fingerprint" radar: 5 always-available signals, each normalised so the
  // shape varies per genre even without per-aspect ratings.
  const maxGenreN = Math.max(1, ...topGenres.map(([, n]) => n));
  const avgEpOf = (g: string) => (genreEpN[g] ? genreEpSum[g] / genreEpN[g] : 0);
  const maxAvgEp = Math.max(1, ...topGenres.map(([g]) => avgEpOf(g)));
  const recencyOf = (g: string) =>
    !genreYearN[g] || yrMax <= yrMin ? 2.5 : ((genreYearSum[g] / genreYearN[g] - yrMin) / (yrMax - yrMin)) * 5;
  const fingerprintOf = (g: string, n: number): number[] => [
    genreScoreN[g] ? genreScoreSum[g] / genreScoreN[g] : 0,   // Rating (1–5)
    (n / maxGenreN) * 5,                                       // Volume (share of library)
    recencyOf(g),                                              // Recency (how modern)
    ((genreCompleted[g] ?? 0) / n) * 5,                        // Finished (completion rate)
    (avgEpOf(g) / maxAvgEp) * 5,                               // Length (avg episodes/chapters)
  ];

  const genres: GenreRich[] = topGenres.map(([genre, n]) => ({
    genre, n,
    avg: genreScoreN[genre] ? genreScoreSum[genre] / genreScoreN[genre] : null,
    color: colorFor(genre),
    axes: axisKeys.map((k, i) => (genreAxisN[genre]?.[k] ? genreAxisSum[genre][k] / genreAxisN[genre][k] : overallAxisAvg[i])),
    fingerprint: fingerprintOf(genre, n),
    decades: decadeList.map((d) => genreDecade[genre]?.[d] ?? 0),
  }));

  const FP_AXES = ["Rating", "Volume", "Recency", "Finished", "Length"];
  const fingerprintOverall = FP_AXES.map((_, ax) => {
    const vals = genres.map((g) => g.fingerprint[ax]);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  });
  // Use the real aspect radar only when a meaningful share of rated titles have
  // per-aspect ("dims") scores; otherwise the fingerprint keeps it expressive.
  const tasteMode: "aspects" | "fingerprint" =
    dimsRated >= 6 && dimsRated / Math.max(1, rated) >= 0.4 ? "aspects" : "fingerprint";

  const feelings: Bar[] = FEELING_META.filter((f) => feelingN[f.key]).map((f) => ({ label: f.label, n: feelingN[f.key] }));

  const superlatives: Superlative[] = [];
  const card = (r: Rec, key: string, label: string, value: string): Superlative => ({ key, label, title: r.title, cover: r.cover, value });
  if (topRated) superlatives.push(card(topRated, "top", "Top rated", `★ ${fmtS((topRated as Rec).score!)}`));
  if (longest) { const r = longest as Rec; superlatives.push(card(r, "longest", r.kind === "manga" ? "Longest read" : "Longest finished", `${r.episodes.toLocaleString()} ${r.kind === "manga" ? "ch" : "eps"}`)); }
  if (deepest) superlatives.push(card(deepest, "deepest", "Deepest cut", `${(deepest as Rec).year}`));
  if (boldest && Math.abs((boldest as { gap: number }).gap) >= 0.75) { const b = boldest as { rec: Rec; gap: number }; superlatives.push(card(b.rec, "boldest", "Boldest take", `${b.gap > 0 ? "+" : "−"}${Math.abs(b.gap).toFixed(1)} vs crowd`)); }

  const started = completed + watching;
  return {
    empty: tracked === 0,
    headline: {
      rated, tracked, completed,
      completionRate: started > 0 ? completed / started : 0,
      meanScore: rated > 0 ? scoreSum / rated : null,
      hours: Math.round(minutes / 60),
      distinctGenres: Object.keys(genreN).length,
    },
    scoreDist, axes, genres, decades, feelings,
    vsCrowd: vsSample > 0 ? { sample: vsSample, avgDelta: vsDeltaSum / vsSample, higher: vsHigher, lower: vsLower } : null,
    superlatives,
    tasteMode, fingerprintAxes: FP_AXES, fingerprintOverall,
  };
}
