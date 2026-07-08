// Instant loading skeletons shown as Suspense fallbacks (via each route's
// loading.tsx) the moment a tab is clicked. The app's pages are dynamic (they
// read the session), so navigation blocks on a server render + DB round-trips;
// without a fallback the old page just freezes, which reads as "slow". These
// give immediate feedback shaped like the page that's arriving. Uses the shared
// `.page` / `.page__head` shell so width, padding and the enter animation match.

type Variant = "shelves" | "grid" | "feed" | "journal" | "brief";
type Width = "default" | "narrow" | "wide";

function Head() {
  return (
    <header className="page__head">
      <div>
        <div className="sk sk-eyebrow" />
        <div className="sk sk-title" />
        <div className="sk sk-lede" />
      </div>
    </header>
  );
}

const many = (n: number, fn: (i: number) => React.ReactNode) =>
  Array.from({ length: n }, (_, i) => fn(i));

function Row() {
  return <div className="sk-row">{many(7, (i) => <div className="sk sk-poster" key={i} />)}</div>;
}

export function PageSkeleton({ variant = "grid", width = "wide" }: { variant?: Variant; width?: Width }) {
  const widthClass = width === "narrow" ? " page--narrow" : width === "wide" ? " page--wide" : "";
  return (
    <main className={"page" + widthClass} aria-busy="true" aria-label="Loading">
      <Head />

      {variant === "shelves" &&
        many(3, (i) => (
          <section className="sk-shelf" key={i}>
            <div className="sk sk-shelf__label" />
            <Row />
          </section>
        ))}

      {variant === "grid" && (
        <div className="sk-grid">{many(14, (i) => <div className="sk sk-poster" key={i} />)}</div>
      )}

      {variant === "feed" && (
        <div className="sk-two">
          <div>{many(4, (i) => <div className="sk sk-post" key={i} />)}</div>
          <div className="sk sk-rail" />
        </div>
      )}

      {variant === "journal" && (
        <div className="sk-two sk-two--rail">
          <div>{many(6, (i) => <div className="sk sk-chip" key={i} />)}</div>
          <div>{many(3, (i) => <div className="sk sk-note" key={i} />)}</div>
        </div>
      )}

      {variant === "brief" && (
        <div className="sk-brief">{many(6, (i) => <div className="sk sk-story" key={i} />)}</div>
      )}
    </main>
  );
}
