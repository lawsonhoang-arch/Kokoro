import type { ReactNode } from "react";

// `.poster` — the 2:3 placeholder art used wherever a cover would go. `hue`
// 1–8 selects one of the deterministic poster--hN gradients in shell.css.
type PosterProps = {
  hue?: number;
  title?: ReactNode;
  sub?: ReactNode;
  className?: string;
  children?: ReactNode;
};

export function Poster({ hue, title, sub, className, children }: PosterProps) {
  return (
    <div
      className={"poster" + (hue ? ` poster--h${hue}` : "") + (className ? " " + className : "")}
    >
      {sub ? <div className="poster__sub">{sub}</div> : null}
      {title ? <div className="poster__title">{title}</div> : null}
      {children}
    </div>
  );
}
