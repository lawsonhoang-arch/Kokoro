// Shared types for the watchlist app. Mirrors the prototype's data shapes
// (data.js / rules.js) with explicit TypeScript types.

export type Feeling = "loved" | "liked" | "mixed" | "dropped";
export type Status = "watching" | "completed" | "planned";

/** How the user rates a title — they can pick per title. */
export type RateMode = "glyphs" | "axes" | "symbols";

/** Visual style for the "symbols" rating mode. */
export type SymbolStyle = "stars" | "grades" | "emoji";
/** A symbols rating: a 1–5 value (5 = best) rendered in the chosen style. */
export type SymbolRating = { style: SymbolStyle; value: number };

/** The four fixed axes; custom axes live alongside these as extra string keys. */
export type Dims = { story: number; art: number; music: number; pacing: number } & Record<string, number>;
/** The always-present axes, in display order. */
export const BASE_AXES = ["story", "art", "music", "pacing"] as const;

export type Entry = {
  id: string;
  /** the catalog title id (titles.id) — used for community descriptions */
  titleId?: string;
  /** cover image URL — shown only on the detail page (generated posters elsewhere) */
  cover?: string | null;
  title: string;
  year: number;
  genres: string[];
  /** episodes (anime) or chapters (manga) */
  episodes: number;
  /** seasons (anime) or volumes (manga) */
  seasons: number;
  /** "anime" | "manga" — drives episodes-vs-chapters/volumes labelling */
  kind?: "anime" | "manga";
  status: Status;
  feeling: Feeling | null;
  /** preferred rating method for this title (defaults to "glyphs") */
  rateMode?: RateMode;
  /** the symbols rating, when rateMode = "symbols" */
  symbol?: SymbolRating | null;
  watched: string | null;
  dims: Dims;
  take: string;
  air: { day: string; time: string };
  /** number of episodes watched (= watchedEps.length) */
  progress?: number;
  /** the specific episode numbers the user marked watched */
  watchedEps?: number[];
};

export type RuleCat = "group" | "sort" | "color" | "tag";
export type Rules = Record<RuleCat, string[]>;

export type Group = {
  id: string;
  name: string;
  entryIds: string[];
  parentId: string | null;
  scoped: Rules;
};

export type GlyphSet = "orbs" | "bars" | "forms";
export type ViewMode = "list" | "cards" | "hybrid";
export type LayoutMode = "stack" | "grid";
export type Mode = "browse" | "sculpt";

export type Rect = { x: number; y: number; w: number; h: number; z: number };
export type PanelCfg = Record<string, Rect>;

export type PaintState = { cat: RuleCat; key: string } | null;

/** A computed tag for an entry (rules.tagsFor). */
export type Tag = { text: string; kind: string; feeling?: Feeling | null };

/** A status/group bucket (rules.bucketOf). */
export type Bucket = { key: string; label: string | null; order: number };

export const emptyRules = (): Rules => ({ group: [], sort: [], color: [], tag: [] });
