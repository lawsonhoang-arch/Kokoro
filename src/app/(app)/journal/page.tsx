import "./journal.css";
import type { ReactNode } from "react";
import Link from "next/link";
import { Page, PageHead } from "@/shell/Page";
import { Button } from "@/components/ui";
import { Icon } from "@/components/Icon";

type RailRow = {
  hue: number;
  title: string;
  sub: string;
  count: number;
  on?: boolean;
};

const RAIL: RailRow[] = [
  { hue: 1, title: "Frieren: Beyond Journey's End", sub: "Fantasy · last note 3d ago", count: 14, on: true },
  { hue: 2, title: "Vinland Saga · S2", sub: "Historical · last note 1w ago", count: 9 },
  { hue: 3, title: "Mushishi", sub: "Slice of Life · last note 2w ago", count: 22 },
  { hue: 4, title: "A Place Further Than the Universe", sub: "Adventure · last note 3w ago", count: 7 },
  { hue: 5, title: "March Comes In Like a Lion", sub: "Drama · last note 1mo ago", count: 31 },
  { hue: 6, title: "Land of the Lustrous", sub: "Fantasy · last note 2mo ago", count: 5 },
  { hue: 1, title: "Cowboy Bebop", sub: "Sci-Fi · last note 3mo ago", count: 11 },
  { hue: 3, title: "Monster", sub: "Psychological · last note 4mo ago", count: 18 },
];

type Entry = {
  day: string;
  time: string;
  ep: string;
  feel: ReactNode;
  feelClass?: string;
  watched?: string;
  quote?: string;
  body: ReactNode;
  likes: number;
  shareLabel: string;
};

const ENTRIES: Entry[] = [
  {
    day: "Sat · May 31",
    time: "9:42 PM",
    ep: "EP 17 · Aufruhr",
    feel: "★ loved",
    feelClass: " entry__feel--loved",
    watched: "23 min watched",
    likes: 0,
    shareLabel: "↗ Share to community",
    body: (
      <>
        <p>
          I keep returning to the way this show treats memory as something you can be in two minds about — Frieren{" "}
          <em>wants</em> to remember Himmel, but the act of remembering is also the thing that finally lets the loss in.
          Tonight&apos;s reunion with Heiter&apos;s old apprentice felt like a quieter version of that same thread.
        </p>
        <p>
          The fight choreography in the second half is the best the show has done. Less about spectacle, more about the
          rhythm of two people who actually know each other.
        </p>
      </>
    ),
  },
  {
    day: "Thu · May 29",
    time: "10:18 PM",
    ep: "EP 16 · Quote saved",
    feel: "— from Frieren",
    watched: "timestamp 14:32",
    quote: "We don't really have time. So we should at least leave behind things to be remembered by.",
    likes: 0,
    shareLabel: "↗ Share",
    body: (
      <p>Wanted to keep this one. Came back to it again this week after the conversation with Stark about his old village.</p>
    ),
  },
  {
    day: "Mon · May 26",
    time: "11:04 PM",
    ep: "EP 15 · The Goddess's Staff",
    feel: "○ liked",
    feelClass: " entry__feel--liked",
    watched: "24 min watched",
    likes: 1,
    shareLabel: "↗ Share",
    body: (
      <p>
        The first half felt a little procedural — I think this is the only episode that&apos;s leaned on the dungeon-arc
        template — but the closing scene paid for it. Fern&apos;s quiet competence is becoming my favourite part of this
        show.
      </p>
    ),
  },
  {
    day: "Sun · May 25",
    time: "3:11 PM",
    ep: "Session · EP 12–14",
    feel: "~ mixed",
    feelClass: " entry__feel--mixed",
    watched: "72 min watched",
    likes: 0,
    shareLabel: "↗ Share",
    body: (
      <>
        <p>
          Three-episode binge on a quiet Sunday. The pacing dipped in episode 13 — felt like it was setting up something
          it didn&apos;t have time to deliver on — but the bookending of the arc landed.
        </p>
        <p>
          Note for later: the show keeps drawing parallels between the demon king arc and the present-day rituals.
          I&apos;d like to come back to this when I&apos;m done and see if it&apos;s intentional or just my own
          pattern-matching.
        </p>
      </>
    ),
  },
  {
    day: "Fri · May 23",
    time: "10:51 PM",
    ep: "EP 11",
    feel: "∙ neutral",
    watched: "24 min watched",
    likes: 0,
    shareLabel: "↗ Share",
    body: <p>Setting up the next arc. Not much to write down tonight.</p>,
  },
];

export default function JournalPage() {
  return (
    <Page width="wide">
      <PageHead
        eyebrow="Journal · Private notes"
        title="What you've been thinking about"
        lede="A private space for episode-by-episode notes, quotes worth keeping, and the feelings a show left you with. Only you can see this."
        actions={
          <>
            <Button variant="ghost">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M5 6h14M5 18h10" />
              </svg>
              Sort &amp; filter
            </Button>
            <Button variant="primary">
              <Icon name="plus" size={14} />
              New entry
            </Button>
          </>
        }
      />

      <div className="journal">
        {/* LEFT RAIL: anime you've journaled about */}
        <aside className="rail" aria-label="Your journaled titles">
          <div className="rail__head">
            <div className="rail__search">
              <Icon name="search" size={13} />
              <input type="text" placeholder="Search your titles…" />
            </div>
          </div>
          <ul className="rail__list" role="list">
            {RAIL.map((row, i) => (
              <li key={i} className={`anime-row${row.on ? " on" : ""} anime-row--h${row.hue}`}>
                <div className="anime-row__thumb" aria-hidden="true" />
                <div>
                  <div className="anime-row__title">{row.title}</div>
                  <div className="anime-row__sub">{row.sub}</div>
                </div>
                <span className="anime-row__count">{row.count}</span>
              </li>
            ))}
          </ul>
          <div className="rail__footer">
            <span>8 titles · 117 entries</span>
            <a href="#" style={{ color: "var(--accent)" }}>All →</a>
          </div>
        </aside>

        {/* RIGHT: selected anime's notes timeline */}
        <section className="timeline" aria-labelledby="tl-title">
          <header className="timeline__head">
            <div className="timeline__cover" aria-hidden="true" />
            <div>
              <h2 className="timeline__title" id="tl-title">Frieren: Beyond Journey&apos;s End</h2>
              <div className="timeline__meta">
                <span>2023</span><span className="sep" />
                <span>28 episodes</span><span className="sep" />
                <span>Watching · ep 18/28</span><span className="sep" />
                <span>★ 5.0 — your rating</span>
              </div>
            </div>
            <div className="actions">
              <Button variant="ghost" title="Export your notes">
                <Icon name="download" size={14} />
                Export
              </Button>
              <Link className="btn" href="/watchlist">
                Lists →
              </Link>
            </div>
          </header>

          <div className="filters" role="group" aria-label="Filter entries">
            <span className="chip on">All · 14</span>
            <span className="chip">Quotes · 3</span>
            <span className="chip">Per-episode · 9</span>
            <span className="chip">Sessions · 2</span>
            <span className="sortby">↓ Newest first</span>
          </div>

          {/* COMPOSE */}
          <div className="compose">
            <div className="compose__avatar">
              today<br /><span style={{ color: "var(--ink-faint)" }}>— Tue</span>
            </div>
            <div>
              <div className="compose__box">
                <span className="compose__placeholder">Write a note about Frieren…</span>
                <div className="compose__tools">
                  <span className="compose__tool">EP 18</span>
                  <span className="compose__tool">feeling: liked</span>
                  <span className="compose__tool" style={{ marginLeft: "auto" }}>+ quote</span>
                  <span className="compose__tool">+ screenshot</span>
                </div>
              </div>
            </div>
          </div>

          {/* ENTRIES */}
          {ENTRIES.map((e, i) => (
            <article key={i} className="entry">
              <div className="entry__rail">
                <span className="entry__dot" aria-hidden="true" />
                <div className="entry__date">
                  <span className="entry__date-day">{e.day}</span>
                  <span>{e.time}</span>
                </div>
              </div>
              <div className="entry__body">
                <div className="entry__head">
                  <span className="entry__ep">{e.ep}</span>
                  <span className={`entry__feel${e.feelClass ?? ""}`}>{e.feel}</span>
                  <span className="entry__time">{e.watched}</span>
                </div>
                {e.quote ? <div className="entry__quote">{e.quote}</div> : null}
                <div className="entry__text">{e.body}</div>
                <div className="entry__foot">
                  <button type="button">♡ {e.likes}</button>
                  <button type="button">{e.shareLabel}</button>
                  <span style={{ marginLeft: "auto" }}>Private · only you</span>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </Page>
  );
}
