"use client";

import dynamic from "next/dynamic";
import type { JournalEntry } from "@/lib/journal";

// Client-only (like the watchlist app): date formatting + the composer are all
// client concerns, and rendering only on the client avoids hydration drift.
const JournalApp = dynamic(() => import("./JournalApp").then((m) => m.JournalApp), {
  ssr: false,
  loading: () => <div className="journal" aria-hidden="true" />,
});

export function JournalAppLoader({ entries, now }: { entries: JournalEntry[]; now: number }) {
  return <JournalApp entries={entries} now={now} />;
}
