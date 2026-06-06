import type { ReactNode } from "react";
import { Poster } from "./Poster";

// `.shelf` — horizontal scroll-snap row of poster cards (Home, Profile).
export function Shelf({ children }: { children: ReactNode }) {
  return (
    <div className="shelf" role="list">
      {children}
    </div>
  );
}

type ShelfCardProps = {
  hue?: number;
  /** title shown inside the poster art */
  posterTitle: ReactNode;
  /** small mono line inside the poster (year · ep, EP 1 · date, …) */
  posterSub?: ReactNode;
  /** title under the poster */
  title: ReactNode;
  /** sub line under the poster (genre · ep, % match, …) */
  sub?: ReactNode;
};

export function ShelfCard({ hue, posterTitle, posterSub, title, sub }: ShelfCardProps) {
  return (
    <article className="shelf-card" role="listitem">
      <Poster hue={hue} title={posterTitle} sub={posterSub} />
      <div className="shelf-card__title">{title}</div>
      {sub ? <div className="shelf-card__sub">{sub}</div> : null}
    </article>
  );
}
