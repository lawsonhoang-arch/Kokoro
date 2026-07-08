// Filter options for the /search page (client-safe — no server-only imports).

// anime vs manga (the `kind` discriminator on titles)
export const TYPES = [
  { v: "", l: "All types" },
  { v: "anime", l: "Anime" },
  { v: "manga", l: "Manga" },
];

export const FORMATS = ["TV", "Movie", "OVA", "ONA", "Special", "TV Short", "Music"];

// manga publication formats (shown when Type = Manga)
export const MANGA_FORMATS = ["Manga", "Manhwa", "Manhua", "Novel", "Light Novel", "One-shot", "Doujinshi"];

export const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mystery",
  "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller",
  "Psychological", "Music", "Historical", "Mecha", "Ecchi", "Isekai",
  "Magical Girl", "Martial Arts", "School",
];

// value = decade-start year
export const DECADES = [
  { v: "2020", l: "2020s" },
  { v: "2010", l: "2010s" },
  { v: "2000", l: "2000s" },
  { v: "1990", l: "1990s" },
  { v: "1980", l: "1980s" },
  { v: "1970", l: "1970s" },
];

export const SORTS = [
  { v: "relevance", l: "Best match" },
  { v: "newest", l: "Newest" },
  { v: "oldest", l: "Oldest" },
  { v: "title", l: "A–Z" },
  { v: "rated", l: "Highest rated" },
];

// length buckets (episodes for anime, chapters for manga). Values encode the
// range so the server can parse them without importing this list.
export const EPISODE_BUCKETS = [
  { v: "1-1", l: "1 (Movie / Special)" },
  { v: "2-13", l: "2–13 eps" },
  { v: "14-26", l: "14–26 eps" },
  { v: "27-52", l: "27–52 eps" },
  { v: "53-100", l: "53–100 eps" },
  { v: "101-", l: "100+ eps" },
];
export const CHAPTER_BUCKETS = [
  { v: "1-25", l: "1–25 ch" },
  { v: "26-50", l: "26–50 ch" },
  { v: "51-100", l: "51–100 ch" },
  { v: "101-200", l: "101–200 ch" },
  { v: "201-500", l: "201–500 ch" },
  { v: "501-", l: "500+ ch" },
];

// season counts (volumes for manga). "4" means "4 or more".
export const SEASON_OPTS = [
  { v: "1", l: "1" },
  { v: "2", l: "2" },
  { v: "3", l: "3" },
  { v: "4", l: "4+" },
];

// personal rating fields (from the user's watchlist entries)
export const STATUSES = [
  { v: "watching", l: "Watching" },
  { v: "completed", l: "Completed" },
  { v: "planned", l: "Planned" },
];
export const FEELINGS = [
  { v: "loved", l: "★ Loved" },
  { v: "liked", l: "Liked" },
  { v: "mixed", l: "Mixed" },
  { v: "dropped", l: "Dropped" },
];
// the four 0–5 rating axes stored on each entry
export const DIMS = ["story", "art", "music", "pacing"] as const;

// catalog lifecycle (titles.status) — the anime/manga's own airing/publishing
// state, distinct from the personal watchlist `status` above.
export const AIRING = [
  { v: "ongoing", l: "Airing / Publishing" },
  { v: "finished", l: "Completed" },
  { v: "upcoming", l: "Upcoming" },
];

export type CatalogFilters = {
  type?: string; // "" | "anime" | "manga"
  format?: string;
  genre?: string;
  decade?: string;
  sort?: string;
  // catalog facts
  airing?: string; // lifecycle: ongoing | finished | upcoming
  length?: string; // episode/chapter bucket "min-max" (max omitted = open-ended)
  seasons?: string; // "1".."4" ("4" = 4+)
  score?: string; // minimum catalog score, 0–10
  // personal ratings (scope the search to the signed-in user's library)
  status?: string;
  feeling?: string;
  rating?: string; // minimum overall rating, 0–5 (avg of the axes)
  story?: string;
  art?: string;
  music?: string;
  pacing?: string;
};

// true when any personal-rating filter is set → search joins the user's entries
export function hasPersonalFilter(f: CatalogFilters): boolean {
  return !!(f.status || f.feeling || f.rating || f.story || f.art || f.music || f.pacing);
}
