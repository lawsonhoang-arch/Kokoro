import type { ReactNode } from "react";

// `.section__head` — title + optional sub on the left, optional "more" link
// on the right. Used by every shelf/section on the static pages.
type SectionHeadProps = {
  title: ReactNode;
  sub?: ReactNode;
  moreLabel?: ReactNode;
  moreHref?: string;
  /** heading level for the title (default h3, matching the shelves) */
  as?: "h2" | "h3" | "h4";
};

export function SectionHead({ title, sub, moreLabel, moreHref, as: Tag = "h3" }: SectionHeadProps) {
  return (
    <header className="section__head">
      <div>
        <Tag className="section__title">{title}</Tag>
        {sub ? <div className="section__sub">{sub}</div> : null}
      </div>
      {moreLabel ? (
        <a href={moreHref ?? "#"} className="section__more">
          {moreLabel}
        </a>
      ) : null}
    </header>
  );
}
