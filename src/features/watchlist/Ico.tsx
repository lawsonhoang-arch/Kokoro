import type { ReactNode } from "react";

// Watchlist-app icon set — port of the Ico component in components.jsx.
const PATHS: Record<string, ReactNode> = {
  browse: <><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="14" y2="17" /></>,
  sculpt: <><path d="M3 7h6v6H3z" /><path d="M13 11h8v8h-8z" /><path d="M9 7l4 4" /></>,
  x: <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>,
  grip: <><circle cx="9" cy="6" r="1.3" /><circle cx="9" cy="12" r="1.3" /><circle cx="9" cy="18" r="1.3" /><circle cx="15" cy="6" r="1.3" /><circle cx="15" cy="12" r="1.3" /><circle cx="15" cy="18" r="1.3" /></>,
  ungroup: <><path d="M8 3H4v4" /><path d="M16 3h4v4" /><path d="M8 21H4v-4" /><path d="M16 21h4v-4" /><line x1="9" y1="12" x2="15" y2="12" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  search: <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></>,
  brush: <><path d="M3 21c2-1 3-3 3-5l9-9 2 2-9 9c-2 0-4 1-5 3z" /><path d="M14 5l3-3 4 4-3 3" /></>,
  cal: <><rect x="4" y="5" width="16" height="16" rx="2" /><line x1="4" y1="9" x2="20" y2="9" /><line x1="9" y1="3" x2="9" y2="7" /><line x1="15" y1="3" x2="15" y2="7" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  stack: <><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></>,
  viewList: <><line x1="8" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="8" y1="18" x2="20" y2="18" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>,
  viewCards: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  viewHybrid: <><rect x="3" y="4" width="7" height="7" rx="1.5" /><line x1="13" y1="6" x2="21" y2="6" /><line x1="13" y1="10" x2="19" y2="10" /><rect x="3" y="14" width="7" height="6" rx="1.5" /><line x1="13" y1="16" x2="21" y2="16" /><line x1="13" y1="20" x2="19" y2="20" /></>,
  layoutStack: <><rect x="4" y="4" width="16" height="4.5" rx="1.2" /><rect x="4" y="10" width="16" height="4.5" rx="1.2" /><rect x="4" y="16" width="16" height="4.5" rx="1.2" /></>,
  layoutGrid: <><rect x="4" y="4" width="16" height="5" rx="1.2" /><rect x="4" y="11" width="7" height="9" rx="1.2" /><rect x="13" y="11" width="7" height="9" rx="1.2" /></>,
  move: <><path d="M12 3v18M3 12h18" /><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" /></>,
  reset: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4h4" /></>,
  edit: <><path d="M14.5 4.5l5 5" /><path d="M3 21l5.5-1L20 8.5l-4.5-4.5L4 15.5 3 21z" /></>,
  check: <><path d="M5 12.5l4.5 4.5L19 7" /></>,
  chev: <><path d="M6 9l6 6 6-6" /></>,
  trash: <><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></>,
  bookmark: <><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.2L5 21V4a1 1 0 0 1 1-1z" /></>,
  expand: <><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-8 8" /><path d="M3 21l8-8" /></>,
};

export function Ico({ name, s = 16 }: { name: string; s?: number }) {
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name] ?? null}
    </svg>
  );
}
