"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { setLastList } from "@/lib/lastList";
import type { HueKey } from "@/lib/palette";
import type { Entry, Group, Rules } from "./types";

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
  initialCustomAxes,
  initialGroups,
  initialGlobals,
  initialTabOrder,
  initialBoardName,
}: {
  id: string;
  title: string;
  hue: HueKey;
  initialEntries: Entry[];
  initialCustomAxes: string[];
  initialGroups: Group[];
  initialGlobals: Rules;
  initialTabOrder: string[] | null;
  initialBoardName: string | null;
}) {
  // Remember this as the last-opened list so the Lists tab returns here.
  useEffect(() => {
    setLastList(id);
  }, [id]);

  return (
    <WatchlistApp
      id={id}
      title={title}
      hue={hue}
      initialEntries={initialEntries}
      initialCustomAxes={initialCustomAxes}
      initialGroups={initialGroups}
      initialGlobals={initialGlobals}
      initialTabOrder={initialTabOrder}
      initialBoardName={initialBoardName}
    />
  );
}
