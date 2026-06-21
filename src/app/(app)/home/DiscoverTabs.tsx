"use client";

import { useState } from "react";
import Link from "next/link";
import type { SearchResult } from "@/features/search/types";
import { TitleCard } from "./TitleCard";

export type DiscoverTab = {
  key: string;
  label: string;
  sub?: string;
  moreHref: string;
  items: SearchResult[];
  ranked?: boolean;
};

// One consolidated discovery section: tabs swap the shelf in place, so six
// near-identical rows become a single clean, switchable block.
export function DiscoverTabs({ tabs }: { tabs: DiscoverTab[] }) {
  const available = tabs.filter((t) => t.items.length > 0);
  const [active, setActive] = useState(0);
  if (available.length === 0) return null;
  const cur = available[Math.min(active, available.length - 1)];

  return (
    <section className="section discover" aria-label="Discover">
      <div className="discover__bar">
        <div className="discover__tabs" role="tablist">
          {available.map((t, i) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={i === active}
              className={"discover__tab" + (i === active ? " on" : "")}
              onClick={() => setActive(i)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Link className="discover__more" href={cur.moreHref}>See all →</Link>
      </div>
      {cur.sub ? <div className="discover__sub">{cur.sub}</div> : null}
      <div className="shelf" role="list">
        {cur.items.map((it, i) => (
          <TitleCard key={it.id} item={it} rank={cur.ranked ? i + 1 : undefined} />
        ))}
      </div>
    </section>
  );
}
