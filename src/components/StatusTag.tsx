import { titleStatus } from "@/lib/titleStatus";

// A small "Airing / Publishing / Complete / Upcoming" tag for a catalog title.
// `overlay` positions it over cover art (dark scrim); otherwise it's inline.
export function StatusTag({
  kind,
  status,
  overlay = false,
  className,
}: {
  kind: string;
  status: string | null | undefined;
  overlay?: boolean;
  className?: string;
}) {
  const s = titleStatus(kind, status);
  if (!s) return null;
  return (
    <span
      className={
        "status-tag status-tag--" + s.tone +
        (overlay ? " status-tag--overlay" : "") +
        (className ? " " + className : "")
      }
    >
      {s.tone === "live" && <i className="status-tag__dot" aria-hidden="true" />}
      {s.label}
    </span>
  );
}
