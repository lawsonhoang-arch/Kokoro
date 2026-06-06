"use client";

import dynamic from "next/dynamic";
import type { HueKey } from "@/lib/palette";
import type { Entry } from "./types";

// Render the watchlist app client-only: its view/layout prefs and pointer/
// startViewTransition interactions are all client concerns, so SSR adds nothing
// but hydration risk. Title + hue + entries come from the server.
const WatchlistApp = dynamic(() => import("./WatchlistApp"), {
  ssr: false,
  loading: () => <div className="k-app" aria-hidden="true" />,
});

export function WatchlistAppLoader({
  id,
  title,
  hue,
  initialEntries,
}: {
  id: string;
  title: string;
  hue: HueKey;
  initialEntries: Entry[];
}) {
  return <WatchlistApp id={id} title={title} hue={hue} initialEntries={initialEntries} />;
}
