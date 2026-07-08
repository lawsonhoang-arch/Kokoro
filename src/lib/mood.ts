import "server-only";
import { getByMood, type MoodCriteria } from "@/lib/search-index";
import type { SearchResult } from "@/features/search/types";

export type Mood = {
  key: string;
  label: string; // the pitch, phrased as the ask
  tagline: string;
  emoji: string;
  hue: number; // 1–6, drives the card tint
  criteria: MoodCriteria;
};

// Scores in the index are ×100 (MAL). The floors below keep each mood to titles
// that genuinely deliver the feeling.
export const MOODS: Mood[] = [
  { key: "cozy", label: "Something cozy", tagline: "Warm, low-stakes, easy to sink into", emoji: "☕", hue: 1,
    criteria: { allGenres: ["Slice of Life"], notGenres: ["Action", "Adventure", "Horror", "Thriller"], minScore: 720 } },
  { key: "wreck", label: "Wreck me", tagline: "Bring tissues — it earns every tear", emoji: "🥲", hue: 6,
    criteria: { allGenres: ["Drama"], notGenres: ["Comedy", "Ecchi"], minScore: 800 } },
  { key: "short", label: "Short & perfect", tagline: "A whole story in a weekend", emoji: "⏳", hue: 3,
    criteria: { minEpisodes: 1, maxEpisodes: 13, minScore: 780 } },
  { key: "hype", label: "Pure adrenaline", tagline: "Fights, stakes, momentum", emoji: "⚡", hue: 4,
    criteria: { anyGenres: ["Action", "Sports"], notGenres: ["Slice of Life"], minScore: 790 } },
  { key: "mind", label: "Mind-bending", tagline: "Puzzles that linger for days", emoji: "🌀", hue: 5,
    criteria: { anyGenres: ["Psychological", "Mystery", "Thriller"], minScore: 780 } },
  { key: "romance", label: "All the feels", tagline: "Longing, butterflies, heartbreak", emoji: "💗", hue: 6,
    criteria: { allGenres: ["Romance"], notGenres: ["Ecchi"], minScore: 740 } },
  { key: "dark", label: "Dark & heavy", tagline: "Not for the faint-hearted", emoji: "🌑", hue: 2,
    criteria: { anyGenres: ["Horror", "Thriller", "Psychological"], notGenres: ["Comedy"], minScore: 750 } },
  { key: "epic", label: "Epic journey", tagline: "Settle in for the long haul", emoji: "🗺️", hue: 4,
    criteria: { anyGenres: ["Adventure", "Fantasy"], minEpisodes: 40, minScore: 780 } },
  { key: "funny", label: "Make me laugh", tagline: "Guaranteed to lift the mood", emoji: "😂", hue: 3,
    criteria: { allGenres: ["Comedy"], notGenres: ["Drama", "Horror", "Psychological"], minScore: 770 } },
];

export function getMood(key: string): Mood | null {
  return MOODS.find((m) => m.key === key) ?? null;
}

export function getMoodTitles(key: string, limit = 24): Promise<SearchResult[]> {
  const m = getMood(key);
  return m ? getByMood(m.criteria, limit) : Promise.resolve([]);
}
