import "./calendar.css";

// Instant month-grid skeleton while the calendar's events + tracked shows load.
export default function Loading() {
  return (
    <main className="page page--wide" aria-busy="true" aria-label="Loading">
      <header className="page__head">
        <div>
          <div className="sk sk-eyebrow" />
          <div className="sk sk-title" />
          <div className="sk sk-lede" />
        </div>
      </header>
      <div className="cal-grid" style={{ marginTop: 22 }}>
        {Array.from({ length: 42 }, (_, i) => (
          <div key={i} className="sk" style={{ height: 108, borderRadius: 12 }} />
        ))}
      </div>
    </main>
  );
}
