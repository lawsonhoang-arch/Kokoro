// Maps a catalog title's lifecycle (titles.status) to a display tag. Pure — safe
// to import in server or client components.
export type StatusTone = "live" | "done" | "soon";

export function titleStatus(
  kind: string,
  status: string | null | undefined,
): { label: string; tone: StatusTone } | null {
  const manga = kind === "manga";
  switch (status) {
    case "ongoing":
      return { label: manga ? "Publishing" : "Airing", tone: "live" };
    case "finished":
      return { label: "Complete", tone: "done" };
    case "upcoming":
      return { label: "Upcoming", tone: "soon" };
    default:
      return null; // unknown lifecycle — no tag rather than a misleading one
  }
}
