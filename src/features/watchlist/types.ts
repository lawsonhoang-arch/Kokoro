// Shared types for the watchlist app. Mirrors the prototype's data shapes
// (data.js / rules.js) with explicit TypeScript types.

export type Feeling = "loved" | "liked" | "mixed" | "dropped";
export type Status = "watching" | "completed" | "planned";

export type Dims = { story: number; art: number; music: number; pacing: number };

export type Entry = {
  id: string;
  /** the catalog title id (titles.id) — used for community descriptions */
  titleId?: string;
  /** cover image URL — shown only on the detail page (generated posters elsewhere) */
  cover?: string | null;
  title: string;
  year: number;
  genres: string[];
  episodes: number;
  seasons: number;
  status: Status;
  feeling: Feeling | null;
  watched: string | null;
  dims: Dims;
  take: string;
  air: { day: string; time: string };
  progress?: number;
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
