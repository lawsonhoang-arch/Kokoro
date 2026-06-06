import "./news.css";
import { Page, PageHead } from "@/shell/Page";
import { Button } from "@/components/ui";

// ---- sub-tabs ---------------------------------------------------------------
type Cat = { label: string; on?: boolean };
const CATS: Cat[] = [
  { label: "Top stories", on: true },
  { label: "Industry" },
  { label: "Releases" },
  { label: "Adaptations" },
  { label: "Interviews" },
];

// ---- lead story -------------------------------------------------------------
const LEAD = {
  hue: 1,
  category: "Industry",
  title: "Studio MAPPA announces a five-year original-works initiative",
  excerpt:
    "Following a record year, the studio says it will split capacity between adaptations and a slate of wholly original series — the first of which enters production this autumn under a director the studio has yet to name.",
  source: "Anime Wire",
  time: "2h ago",
};

// ---- secondary stories ------------------------------------------------------
type Story = {
  hue: number;
  category: string;
  title: string;
  excerpt: string;
  source: string;
  time: string;
};

const STORIES: Story[] = [
  {
    hue: 2,
    category: "Adaptations",
    title: "Beloved quiet-fantasy manga gets a TV anime for next spring",
    excerpt:
      "The long-running slice-of-life series will be adapted by a first-time director, with the original author credited on series composition.",
    source: "Manga Desk",
    time: "4h ago",
  },
  {
    hue: 3,
    category: "Releases",
    title: "Spring season finale week: what's ending and what's renewed",
    excerpt:
      "Three of this season's break-out titles have already confirmed second cours, while two await word from their production committees.",
    source: "Seasonal",
    time: "6h ago",
  },
  {
    hue: 4,
    category: "Interviews",
    title: "“We storyboarded the silence first” — a director on pacing tenderness",
    excerpt:
      "In a wide-ranging conversation, the director breaks down how negative space and held shots became the show's signature.",
    source: "In Frame",
    time: "yesterday",
  },
  {
    hue: 5,
    category: "Industry",
    title: "Streaming platform expands simulcast slate to 40 new territories",
    excerpt:
      "Same-day subtitles will roll out in twelve additional languages, with dubs following on a staggered schedule through the year.",
    source: "Stream Report",
    time: "yesterday",
  },
  {
    hue: 6,
    category: "Releases",
    title: "Anticipated film sets its theatrical date after a year of delays",
    excerpt:
      "The feature, years in the making, finally locks a release window — and an international run is confirmed alongside the domestic premiere.",
    source: "Box Office Now",
    time: "2d ago",
  },
  {
    hue: 7,
    category: "Adaptations",
    title: "Sci-fi epic's second season teases a new key visual and staff shuffle",
    excerpt:
      "A returning core team is joined by fresh action-animation leads, hinting at a more kinetic register for the next arc.",
    source: "Anime Wire",
    time: "3d ago",
  },
];

// ---- right rail -------------------------------------------------------------
const TRENDING = [
  "Spring 26 power rankings — week 6",
  "Every studio original announced this year, ranked",
  "The quiet revival of hand-drawn backgrounds",
  "Why second cours keep slipping to winter",
  "Five adaptations that finally got the staff they deserved",
];

type Release = { day: string; title: string; tag: string };
const CALENDAR: Release[] = [
  { day: "Mon", title: "Quiet Fantasy · Ep 7", tag: "Simulcast" },
  { day: "Wed", title: "Sci-Fi Epic S2 · Ep 5", tag: "Simulcast" },
  { day: "Fri", title: "Slice of Life · Ep 8", tag: "Dub" },
  { day: "Sat", title: "The Awaited Film", tag: "Theatrical" },
  { day: "Sun", title: "Late Night Mushishi · Ep 4", tag: "Club" },
];

export default function NewsPage() {
  return (
    <Page width="wide">
      <PageHead
        eyebrow="News · Anime & industry"
        title="What's happening in anime"
        lede="A calm daily briefing — announcements, adaptations, release dates, and interviews, gathered from across the industry and summarised for you."
        actions={
          <>
            <Button variant="ghost">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 4h16v4H4zM4 12h10v8H4zM16 12h4v8h-4z" />
              </svg>
              Customise feed
            </Button>
            <Button variant="primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
                <circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none" />
              </svg>
              Subscribe
            </Button>
          </>
        }
      />

      <nav className="subtabs" aria-label="News sections">
        {CATS.map((c) => (
          <button key={c.label} className={"subtabs__tab" + (c.on ? " on" : "")}>
            {c.label}
          </button>
        ))}
      </nav>

      <div className="news">
        {/* MAIN COLUMN */}
        <section aria-label="Stories">
          {/* LEAD STORY */}
          <article className={`news-lead card poster--h${LEAD.hue}`}>
            <div className="news-lead__art" aria-hidden="true" />
            <div className="news-lead__body">
              <span className="news-cat">{LEAD.category}</span>
              <h2 className="news-lead__title">{LEAD.title}</h2>
              <p className="news-lead__excerpt">{LEAD.excerpt}</p>
              <div className="news-meta">
                <span className="news-meta__source">{LEAD.source}</span>
                <span className="news-meta__dot" />
                <span>{LEAD.time}</span>
              </div>
            </div>
          </article>

          {/* SECONDARY GRID */}
          <div className="news-grid">
            {STORIES.map((s, i) => (
              <article key={i} className={`news-card card poster--h${s.hue}`}>
                <div className="news-card__art" aria-hidden="true" />
                <div className="news-card__body">
                  <span className="news-cat">{s.category}</span>
                  <h3 className="news-card__title">{s.title}</h3>
                  <p className="news-card__excerpt">{s.excerpt}</p>
                  <div className="news-meta">
                    <span className="news-meta__source">{s.source}</span>
                    <span className="news-meta__dot" />
                    <span>{s.time}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <Button variant="ghost" style={{ margin: "8px auto 0", display: "flex" }}>
            Load older stories
          </Button>
        </section>

        {/* RIGHT RAIL */}
        <aside aria-label="Sidebar">
          <div className="raillet">
            <div className="raillet__head">
              <span className="label">Trending now</span>
              <span className="num">today</span>
            </div>
            <ol className="trend-list">
              {TRENDING.map((t, i) => (
                <li key={i} className="trend-row">
                  <span className="trend-row__rank">{i + 1}</span>
                  <span className="trend-row__title">{t}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="raillet">
            <div className="raillet__head">
              <span className="label">This week's releases</span>
              <span className="num">5 up next</span>
            </div>
            <div className="cal-list">
              {CALENDAR.map((r, i) => (
                <div key={i} className="cal-row">
                  <span className="cal-row__day">{r.day}</span>
                  <span className="cal-row__title">{r.title}</span>
                  <span className="cal-row__tag">{r.tag}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </Page>
  );
}
