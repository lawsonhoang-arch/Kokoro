import "./community.css";
import { Page, PageHead } from "@/shell/Page";
import { Button } from "@/components/ui";
import { Icon } from "@/components/Icon";

// ---- sub-tabs ---------------------------------------------------------------
type SubTab = { label: string; num: number; on?: boolean };
const SUBTABS: SubTab[] = [
  { label: "Feed", num: 128, on: true },
  { label: "Discussions", num: 42 },
  { label: "Clubs", num: 9 },
  { label: "Friends", num: 31 },
];

// ---- composer pills ---------------------------------------------------------
const COMPOSER_PILLS = ["+ link a title", "+ rating", "spoiler tag"];

// ---- feed posts -------------------------------------------------------------
type FootAction = { glyph: string; label: string };

type ReviewPost = {
  kind: "review";
  avatarHue: number;
  name: string;
  badge?: string;
  handle: string;
  time: string;
  coverHue: number;
  title: string;
  year?: string;
  stars?: string;
  text: string;
  foot: FootAction[];
  footNote: string;
};

type ThoughtPost = {
  kind: "thought";
  avatarHue: number;
  name: string;
  handle: string;
  time: string;
  foot: FootAction[];
  footNote: string;
};

type DiscussionPost = {
  kind: "discussion";
  avatarHue: number;
  name: string;
  badge?: string;
  handle: string;
  time: string;
  topic: string;
  threadTitle: string;
  foot: FootAction[];
  footNote: string;
};

type Post = ReviewPost | ThoughtPost | DiscussionPost;

const POSTS: Post[] = [
  {
    kind: "review",
    avatarHue: 1,
    name: "Mio Tanaka",
    badge: "Editor",
    handle: "@mio · finished a series",
    time: "2h ago",
    coverHue: 1,
    title: "Frieren: Beyond Journey's End",
    year: "· 2023",
    stars: "★★★★★",
    text: "Twenty-eight episodes of a show choosing tenderness over spectacle every single time it had the option. I'm not over it. The closing shot of Himmel's statue is the kind of image that gets quoted for a decade.",
    foot: [
      { glyph: "♡", label: "128" },
      { glyph: "↺", label: "14" },
      { glyph: "💬", label: "32" },
    ],
    footNote: "Public · everyone",
  },
  {
    kind: "review",
    avatarHue: 4,
    name: "Kenta R.",
    handle: "@kenta · started watching",
    time: "5h ago",
    coverHue: 4,
    title: "A Place Further Than the Universe",
    year: "· 2018",
    text: "Three episodes in. Why has nobody made me watch this until now? Already crying about teenage girls and Antarctica and I'm only on the boat.",
    foot: [
      { glyph: "♡", label: "41" },
      { glyph: "↺", label: "3" },
      { glyph: "💬", label: "12" },
    ],
    footNote: "Public · everyone",
  },
  {
    kind: "discussion",
    avatarHue: 2,
    name: "Alex Pham",
    badge: "Hot",
    handle: "@alex · opened a discussion",
    time: "yesterday",
    topic: "Discussion · Vinland Saga S2 · Ep 12",
    threadTitle:
      "Is the farmland arc a betrayal of the source material, or is it the whole point?",
    foot: [
      { glyph: "♡", label: "86" },
      { glyph: "💬", label: "42 replies" },
      { glyph: "↗", label: "Share" },
    ],
    footNote: "r/discussions · ep-tagged",
  },
  {
    kind: "thought",
    avatarHue: 5,
    name: "Hana Iwasaki",
    handle: "@hana",
    time: "2d ago",
    foot: [
      { glyph: "♡", label: "64" },
      { glyph: "↺", label: "8" },
      { glyph: "💬", label: "22" },
    ],
    footNote: "Public",
  },
  {
    kind: "discussion",
    avatarHue: 6,
    name: "Late Night Mushishi",
    badge: "Club",
    handle: "@lnm · weekly watch club",
    time: "3d ago",
    topic: "Watch club · Episode 4 · Sunday 9pm",
    threadTitle:
      'This week: "The Travelling Swamp" — synced viewing + chat at 9pm',
    foot: [
      { glyph: "+", label: "Join (412 members)" },
      { glyph: "📅", label: "Add to calendar" },
    ],
    footNote: "Sundays · 9:00 PM your time",
  },
];

// ---- right rail -------------------------------------------------------------
type Friend = { hue: number; name: string; now: string; time: string };
const FRIENDS: Friend[] = [
  { hue: 1, name: "Mio Tanaka", now: "Frieren · ep 18", time: "now" },
  { hue: 2, name: "Alex Pham", now: "Vinland Saga · ep 12", time: "5m" },
  { hue: 3, name: "Hana Iwasaki", now: "Mushishi · ep 4", time: "12m" },
  { hue: 4, name: "Kenta R.", now: "A Place Further · ep 3", time: "25m" },
  { hue: 5, name: "Toma S.", now: "March Comes In · ep 24", time: "1h" },
];

type Discussion = { title: string; sub: string };
const DISCUSSIONS: Discussion[] = [
  {
    title: "Is the farmland arc a betrayal — or the whole point?",
    sub: "Vinland Saga · 42 replies",
  },
  {
    title: "Mob Psycho 100 vs One Punch Man — which holds up?",
    sub: "General · 28 replies",
  },
  {
    title: "Underrated 2024 titles you'd put in someone's hands",
    sub: "Recommend · 24 replies",
  },
  { title: "Spring 26 power rankings — week 6", sub: "Seasonal · 19 replies" },
];

type Club = { hue: number; name: string; sub: string };
const CLUBS: Club[] = [
  { hue: 1, name: "Late Night Mushishi", sub: "412 members · Sundays 9pm" },
  { hue: 2, name: "Quiet Fantasy", sub: "228 members · biweekly" },
  { hue: 3, name: "Sunday Rewatchers", sub: "156 members · open thread" },
];

export default function CommunityPage() {
  return (
    <Page width="wide">
      <PageHead
        eyebrow="Community · Public"
        title="What everyone's watching"
        lede="A slow, thoughtful feed of micro-reviews, discussions, and watch clubs from people whose taste you trust."
        actions={
          <>
            <Button variant="ghost">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 11V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h6" />
                <path d="m16 19 2 2 4-4" />
              </svg>
              Following
            </Button>
            <Button variant="primary">
              <Icon name="plus" size={14} />
              Post a review
            </Button>
          </>
        }
      />

      <nav className="subtabs" aria-label="Community sections">
        {SUBTABS.map((t) => (
          <button
            key={t.label}
            className={"subtabs__tab" + (t.on ? " on" : "")}
          >
            {t.label} <span className="num">{t.num}</span>
          </button>
        ))}
      </nav>

      <div className="community">
        {/* MAIN COLUMN: feed */}
        <section aria-label="Feed">
          {/* COMPOSER */}
          <div className="composer card">
            <span
              className="avatar avatar--h3 composer__avatar"
              aria-hidden="true"
            />
            <div className="composer__input">
              <div className="composer__field">
                Share a micro-review, a thought from tonight&apos;s episode…
              </div>
              <div className="composer__tools">
                {COMPOSER_PILLS.map((p) => (
                  <span key={p} className="composer__pill">
                    {p}
                  </span>
                ))}
                <Button variant="primary" className="composer__post">
                  Post
                </Button>
              </div>
            </div>
          </div>

          {POSTS.map((post, i) => {
            if (post.kind === "review") {
              return (
                <article key={i} className="post card">
                  <header className="post__head">
                    <span
                      className={`avatar avatar--h${post.avatarHue}`}
                      style={{ width: 40, height: 40 }}
                    />
                    <div className="post__who">
                      <span className="post__name">
                        {post.name}
                        {post.badge ? (
                          <span className="post__badge">{post.badge}</span>
                        ) : null}
                      </span>
                      <span className="post__handle">{post.handle}</span>
                    </div>
                    <span className="post__time">{post.time}</span>
                  </header>

                  <div className="review">
                    <div
                      className={`poster poster--h${post.coverHue} review__cover`}
                      style={{ aspectRatio: "auto", height: 124 }}
                    />
                    <div>
                      <div className="review__meta-head">
                        <span className="review__title">{post.title}</span>
                        {post.year ? (
                          <span className="review__year">{post.year}</span>
                        ) : null}
                        {post.stars ? (
                          <span className="review__stars">{post.stars}</span>
                        ) : null}
                      </div>
                      <p className="review__text">{post.text}</p>
                    </div>
                  </div>

                  <footer className="post__foot">
                    {post.foot.map((f, j) => (
                      <button key={j}>
                        {f.glyph} {f.label}
                      </button>
                    ))}
                    <span style={{ marginLeft: "auto" }}>{post.footNote}</span>
                  </footer>
                </article>
              );
            }

            if (post.kind === "discussion") {
              return (
                <article key={i} className="post card post--discussion">
                  <header className="post__head">
                    <span
                      className={`avatar avatar--h${post.avatarHue}`}
                      style={{ width: 40, height: 40 }}
                    />
                    <div className="post__who">
                      <span className="post__name">
                        {post.name}
                        {post.badge ? (
                          <span className="post__badge">{post.badge}</span>
                        ) : null}
                      </span>
                      <span className="post__handle">{post.handle}</span>
                    </div>
                    <span className="post__time">{post.time}</span>
                  </header>
                  <div className="post__body">
                    <span className="post__topic">{post.topic}</span>
                    <h3 className="post__thread-title">{post.threadTitle}</h3>
                    {post.name === "Alex Pham" ? (
                      <p className="post__excerpt">
                        Going to put this out there for anyone who&apos;s watched
                        up through episode 12.{" "}
                        <span className="spoiler">
                          Thorfinn&apos;s choice in the orchard
                        </span>{" "}
                        reads completely differently if you came into this from
                        the manga vs. fresh — and I don&apos;t think either
                        reading is wrong. Curious how the rewatch crowd sees it.{" "}
                        <em>
                          (Spoilers through ep 12 only — please tag below.)
                        </em>
                      </p>
                    ) : (
                      <p className="post__excerpt">
                        412 of us. One episode a week. No spoilers from the manga
                        or future episodes — that&apos;s the only rule. Drop your
                        screenshots after the credits roll.
                      </p>
                    )}
                  </div>

                  <footer className="post__foot">
                    {post.foot.map((f, j) => (
                      <button key={j}>
                        {f.glyph} {f.label}
                      </button>
                    ))}
                    <span style={{ marginLeft: "auto" }}>{post.footNote}</span>
                  </footer>
                </article>
              );
            }

            // thought
            return (
              <article key={i} className="post card">
                <header className="post__head">
                  <span
                    className={`avatar avatar--h${post.avatarHue}`}
                    style={{ width: 40, height: 40 }}
                  />
                  <div className="post__who">
                    <span className="post__name">{post.name}</span>
                    <span className="post__handle">{post.handle}</span>
                  </div>
                  <span className="post__time">{post.time}</span>
                </header>

                <p
                  className="review__text"
                  style={{
                    margin: "0 0 4px",
                    color: "var(--ink)",
                    fontSize: 15,
                    lineHeight: 1.55,
                  }}
                >
                  unpopular: the Studio Bones miniseries from spring is the most
                  quietly accomplished thing they&apos;ve done since{" "}
                  <em style={{ color: "var(--accent)", fontStyle: "normal" }}>
                    Mob Psycho
                  </em>
                  . nobody is talking about it.
                </p>

                <footer className="post__foot" style={{ marginTop: 10 }}>
                  {post.foot.map((f, j) => (
                    <button key={j}>
                      {f.glyph} {f.label}
                    </button>
                  ))}
                  <span style={{ marginLeft: "auto" }}>{post.footNote}</span>
                </footer>
              </article>
            );
          })}

          {/* "see more" stub */}
          <Button
            variant="ghost"
            style={{ margin: "8px auto 0", display: "flex" }}
          >
            Load older posts
          </Button>
        </section>

        {/* RIGHT RAIL */}
        <aside aria-label="Sidebar">
          <div className="raillet">
            <div className="raillet__head">
              <span className="label">Friends watching now</span>
              <span className="num">9 online</span>
            </div>
            <div className="raillet__list">
              {FRIENDS.map((f) => (
                <div key={f.name} className="friend">
                  <span
                    className={`avatar avatar--h${f.hue}`}
                    aria-hidden="true"
                  />
                  <div>
                    <div className="friend__name">
                      {f.name} <span className="friend__dot" />
                    </div>
                    <div className="friend__now">{f.now}</div>
                  </div>
                  <span className="friend__time">{f.time}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="raillet">
            <div className="raillet__head">
              <span className="label">Hot discussions</span>
              <span className="num">42 active</span>
            </div>
            <div className="raillet__list">
              {DISCUSSIONS.map((d) => (
                <div key={d.title} className="discuss-row">
                  <div className="discuss-row__title">{d.title}</div>
                  <div className="discuss-row__sub">{d.sub}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="raillet">
            <div className="raillet__head">
              <span className="label">Suggested clubs</span>
              <span className="num">3 picks</span>
            </div>
            <div className="raillet__list">
              {CLUBS.map((c) => (
                <div key={c.name} className={`club club--h${c.hue}`}>
                  <div className="club__art" aria-hidden="true" />
                  <div>
                    <div className="club__name">{c.name}</div>
                    <div className="club__sub">{c.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </Page>
  );
}
