import type { ReactNode } from "react";

// `.page` container + `.page__head` from the shared shell. The `.page` class
// carries the kk-page-fade-in animation; its direct-child sections inherit the
// staggered kk-rise (see transitions.css), so keep major sections as direct
// children of <Page>.
type PageProps = {
  children: ReactNode;
  /** width variant: default 1280px · narrow 960px · wide 1440px */
  width?: "default" | "narrow" | "wide";
  className?: string;
};

export function Page({ children, width = "default", className }: PageProps) {
  const widthClass =
    width === "narrow" ? " page--narrow" : width === "wide" ? " page--wide" : "";
  return (
    <main className={"page" + widthClass + (className ? " " + className : "")}>
      {children}
    </main>
  );
}

type PageHeadProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
};

/** `.page__head` — eyebrow + title + lede on the left, optional actions right. */
export function PageHead({ eyebrow, title, lede, actions }: PageHeadProps) {
  return (
    <header className="page__head">
      <div>
        {eyebrow ? <div className="page__eyebrow">{eyebrow}</div> : null}
        <h1 className="page__title">{title}</h1>
        {lede ? <p className="page__lede">{lede}</p> : null}
      </div>
      {actions ? <div className="actions">{actions}</div> : null}
    </header>
  );
}
