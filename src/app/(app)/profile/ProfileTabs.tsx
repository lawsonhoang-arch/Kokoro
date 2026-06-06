"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";

// ---- Tab model -------------------------------------------------------------
type Tab = "overview" | "stats" | "reviews" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "stats", label: "Stats" },
  { id: "reviews", label: "Reviews" },
  { id: "settings", label: "Settings" },
];

// ---- Overview data ---------------------------------------------------------
type Fav = { hue: number; sub: string; title: string };
const FAVS: Fav[] = [
  { hue: 3, sub: "2023 · drama", title: "Frieren: Beyond Journey’s End" },
  { hue: 1, sub: "2005 · slice of life", title: "Mushishi" },
  { hue: 2, sub: "1998 · sci-fi", title: "Cowboy Bebop" },
  { hue: 5, sub: "2016 · drama", title: "March Comes In Like a Lion" },
];

type Review = { hue: number; title: string; stars: string; text: string; when: string };
const REVIEWS: Review[] = [
  {
    hue: 1,
    title: "Frieren: Beyond Journey’s End",
    stars: "★★★★★",
    text: "Twenty-eight episodes of a show choosing tenderness over spectacle every single time it had the option.",
    when: "2h ago · 128 ♡",
  },
  {
    hue: 2,
    title: "Vinland Saga · S2",
    stars: "★★★★☆",
    text: "Slow first half is the point. If you stop at episode 4 you’ve missed the whole thesis of the show.",
    when: "4d ago · 64 ♡",
  },
  {
    hue: 4,
    title: "A Place Further Than the Universe",
    stars: "★★★★★",
    text: "A teenage-girl Antarctica show that earned every single one of its tears honestly. Restored my faith in a genre I’d written off.",
    when: "1w ago · 92 ♡",
  },
];

type Activity = { icon: "star" | "play" | "message" | "plus"; title: string; sub: string; when: string };
const ACTIVITY: Activity[] = [
  { icon: "star", title: "Rated Frieren 5/5", sub: "added to favorites", when: "2h" },
  { icon: "play", title: "Logged Frieren · ep 18", sub: "Watching · 18/28", when: "2h" },
  { icon: "message", title: "Posted a discussion", sub: "Late Night Mushishi · ep 4", when: "3d" },
  { icon: "plus", title: "Added “Quiet Fantasy” to clubs", sub: "228 members", when: "1w" },
];

type Watching = { hue: number; title: string; progress: string; note: string };
const WATCHING: Watching[] = [
  { hue: 1, title: "Frieren", progress: "18/28", note: "Three weeks in. One per Sunday." },
  { hue: 2, title: "Vinland Saga · S2", progress: "12/24", note: "Slow-burn re-engagement." },
];

// ---- Settings data ---------------------------------------------------------
const SETTINGS_RAIL = [
  "Account",
  "Privacy",
  "Notifications",
  "Appearance",
  "List defaults",
  "Integrations",
  "Data & export",
];

function ActIcon({ name }: { name: Activity["icon"] }) {
  switch (name) {
    case "star":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      );
    case "play":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 5v14l11-7z" />
        </svg>
      );
    case "message":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "plus":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
  }
}

function Overview() {
  return (
    <section id="pf-overview" className="pf-grid" aria-label="Overview">
      {/* LEFT: favorites + reviews */}
      <div>
        <section className="section" style={{ marginTop: 0 }}>
          <header className="section__head">
            <div>
              <h3 className="section__title">Favorites</h3>
              <div className="section__sub">The four titles Riley wants you to watch</div>
            </div>
            <a href="#" className="section__more">Full list →</a>
          </header>
          <div className="favs">
            {FAVS.map((f) => (
              <div key={f.title} className={`poster poster--h${f.hue}`}>
                <span className="fav-mark" aria-hidden="true">★</span>
                <div className="poster__sub">{f.sub}</div>
                <div className="poster__title">{f.title}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <header className="section__head">
            <div>
              <h3 className="section__title">Recent reviews</h3>
              <div className="section__sub">Public micro-reviews from Riley</div>
            </div>
            <a href="#" className="section__more">All reviews →</a>
          </header>
          <div>
            {REVIEWS.map((r) => (
              <article key={r.title} className="pf-review">
                <div className={`poster poster--h${r.hue} pf-review__cover`} style={{ aspectRatio: "auto", height: 84 }} />
                <div>
                  <div className="pf-review__head">
                    <span className="pf-review__title">{r.title}</span>
                    <span className="pf-review__stars">{r.stars}</span>
                  </div>
                  <p className="pf-review__text">{r.text}</p>
                  <span className="pf-review__when">{r.when}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {/* RIGHT: activity + clubs */}
      <aside>
        <section className="section" style={{ marginTop: 0 }}>
          <header className="section__head">
            <div>
              <h3 className="section__title">Recent activity</h3>
            </div>
          </header>
          <div className="activity">
            {ACTIVITY.map((a) => (
              <div key={a.title} className="act">
                <span className="act__icon" aria-hidden="true">
                  <ActIcon name={a.icon} />
                </span>
                <div>
                  <div className="act__title">{a.title}</div>
                  <div className="act__sub">{a.sub}</div>
                </div>
                <span className="act__when">{a.when}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <header className="section__head">
            <div>
              <h3 className="section__title">Currently watching</h3>
              <div className="section__sub">3 titles in rotation</div>
            </div>
            <Link href="/watchlist" className="section__more">Lists →</Link>
          </header>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {WATCHING.map((w) => (
              <div key={w.title} className="pf-review" style={{ gridTemplateColumns: "48px 1fr" }}>
                <div className={`poster poster--h${w.hue} pf-review__cover`} style={{ aspectRatio: "auto", height: 66 }} />
                <div>
                  <div className="pf-review__head">
                    <span className="pf-review__title">{w.title}</span>
                    <span style={{ color: "var(--ink-faint)", fontFamily: "var(--font-mono)", fontSize: "10.5px" }}>{w.progress}</span>
                  </div>
                  <p className="pf-review__text" style={{ fontSize: "12.5px" }}>{w.note}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </section>
  );
}

function Settings({ active }: { active: boolean }) {
  return (
    <section id="pf-settings" className={"settings" + (active ? " on" : "")} aria-label="Account settings">
      <div className="settings__grid">
        <aside className="settings__rail">
          {SETTINGS_RAIL.map((label, i) => (
            <button key={label} className={i === 0 ? "on" : undefined}>
              {label}
            </button>
          ))}
        </aside>
        <div className="settings__body">
          <div className="settings__group">
            <div className="settings__label">Profile</div>
            <div className="setting-row">
              <div>
                <div className="setting-row__title">Display name</div>
                <div className="setting-row__desc">How your name appears across Kokoro. Public.</div>
              </div>
              <button className="btn">Edit · Riley Okabe</button>
            </div>
            <div className="setting-row">
              <div>
                <div className="setting-row__title">Handle</div>
                <div className="setting-row__desc">Your unique mention name. Used in URLs and tags.</div>
              </div>
              <button className="btn">Change · @riley</button>
            </div>
            <div className="setting-row">
              <div>
                <div className="setting-row__title">Bio</div>
                <div className="setting-row__desc">Up to 240 characters. Markdown is supported.</div>
              </div>
              <button className="btn">Edit</button>
            </div>
          </div>

          <div className="settings__group">
            <div className="settings__label">Visibility</div>
            <div className="setting-row">
              <div>
                <div className="setting-row__title">Public profile</div>
                <div className="setting-row__desc">When off, only people you follow can see your activity and lists.</div>
              </div>
              <div className="toggle on" role="switch" aria-checked="true"></div>
            </div>
            <div className="setting-row">
              <div>
                <div className="setting-row__title">Show on community feed</div>
                <div className="setting-row__desc">Your micro-reviews and ratings appear in the public Feed tab.</div>
              </div>
              <div className="toggle on" role="switch" aria-checked="true"></div>
            </div>
            <div className="setting-row">
              <div>
                <div className="setting-row__title">Journal visibility</div>
                <div className="setting-row__desc">Notes you write in the Journal tab are always private.</div>
              </div>
              <span className="chip">Locked · private</span>
            </div>
          </div>

          <div className="settings__group">
            <div className="settings__label">Appearance</div>
            <div className="setting-row">
              <div>
                <div className="setting-row__title">Theme</div>
                <div className="setting-row__desc">Pick the palette that matches your room&apos;s lighting.</div>
              </div>
              <div className="pill-select">
                <button className="on">Warm dark</button>
                <button>Paper</button>
                <button>Clay</button>
              </div>
            </div>
            <div className="setting-row">
              <div>
                <div className="setting-row__title">Reduce motion</div>
                <div className="setting-row__desc">Disable morph transitions and animated background glows.</div>
              </div>
              <div className="toggle" role="switch" aria-checked="false"></div>
            </div>
          </div>

          <div className="settings__group">
            <div className="settings__label">Danger zone</div>
            <div className="setting-row">
              <div>
                <div className="setting-row__title danger">Delete account</div>
                <div className="setting-row__desc">Removes your profile, lists, and all journal entries. Cannot be undone.</div>
              </div>
              <button className="danger-btn">Delete account</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProfileTabs() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <>
      {/* SUB-TABS */}
      <nav className="pf-subtabs" aria-label="Profile sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "on" : undefined}
            data-tab={t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Overview is the default content; stats/reviews fall back to it.
          Settings swaps in via the .on class on #pf-settings. */}
      {tab !== "settings" ? <Overview /> : null}
      <Settings active={tab === "settings"} />
    </>
  );
}
