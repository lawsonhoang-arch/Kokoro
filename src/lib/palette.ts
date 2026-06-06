// The 8-color watchlist accent palette. Shared by the gallery (card hue +
// new-list picker) and the watchlist app (reads the chosen hue and applies it
// as --accent). Values are the canonical OKLCH strings from the design system.
export type HueKey =
  | "warm"
  | "coral"
  | "amber"
  | "sage"
  | "teal"
  | "indigo"
  | "violet"
  | "pink";

export type Hue = { key: HueKey; label: string; value: string };

export const HUES: Hue[] = [
  { key: "warm", label: "Warm orange", value: "oklch(0.72 0.13 52)" },
  { key: "coral", label: "Coral", value: "oklch(0.68 0.14 30)" },
  { key: "amber", label: "Amber", value: "oklch(0.78 0.13 75)" },
  { key: "sage", label: "Sage", value: "oklch(0.68 0.13 140)" },
  { key: "teal", label: "Teal", value: "oklch(0.62 0.13 200)" },
  { key: "indigo", label: "Indigo", value: "oklch(0.62 0.12 260)" },
  { key: "violet", label: "Violet", value: "oklch(0.66 0.12 290)" },
  { key: "pink", label: "Pink", value: "oklch(0.66 0.14 350)" },
];

export const hueValue = (key: string): string =>
  (HUES.find((h) => h.key === key) ?? HUES[0]).value;

export const hueLabel = (key: string): string =>
  (HUES.find((h) => h.key === key) ?? HUES[0]).label;
