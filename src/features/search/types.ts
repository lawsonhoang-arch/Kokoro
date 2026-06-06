// A self-hosted search result — a row from your own catalog (titles table).
// Facts only: no synopsis (community-written), no cover art (generated posters),
// no external score. `id` IS the catalog title id.
export type SearchResult = {
  id: string;
  kind: "anime" | "manga";
  title: string;
  native: string | null;
  format: string | null;
  episodes: number | null;
  year: number | null;
  genres: string[];
  cover: string | null;
};
