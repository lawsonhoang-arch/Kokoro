"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createNewsAction,
  updateNewsAction,
  deleteNewsAction,
  setNewsPublishedAction,
  moveNewsAction,
  uploadNewsImageAction,
  hideLiveNewsAction,
  publishWaveAction,
  setLiveNewsCoverAction,
  setLiveHomeAction,
  setLiveLayoutAction,
} from "./actions";

type Layout = "card" | "list";
type FeedLayout = Layout | "auto";

type Story = {
  id: string;
  category: string;
  title: string;
  excerpt: string;
  source: string;
  href: string;
  cover: string;
  hue: number;
  published: boolean;
  onHome: boolean;
  layout: Layout;
};

const CATS = ["Industry", "Releases", "Adaptations", "Interviews"];

// A chevron that rotates when its card opens.
const Chevron = () => (
  <svg className="nae__chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

// ============================================================
// SHARED — placement controls, "where shown" markings, card preview, cover.
// These mirror what /news actually renders so a moderator sees the result.
// ============================================================

// Every surface a story appears on, for all users. The per-user "For you" tab is
// deliberately excluded — admins don't control it.
function WhereShown({ onHome, category, layout }: { onHome: boolean; category: string; layout: FeedLayout }) {
  const fmt = layout === "list" ? "List" : layout === "card" ? "Card" : "Auto";
  return (
    <div className="nwhere">
      <span className="nwhere__label">Shown in</span>
      {onHome && <span className="nwhere__badge nwhere__badge--home">Home page</span>}
      <span className="nwhere__badge">News · Top stories</span>
      <span className="nwhere__badge">News · {category}</span>
      <span className="nwhere__badge nwhere__badge--fmt">{fmt} format</span>
      {!onHome && <span className="nwhere__badge nwhere__badge--off">Not on home</span>}
    </div>
  );
}

// Home on/off toggle + a Card|List segmented control.
function PlacementBar({
  onHome, layout, onHomeToggle, onLayout, busy,
}: {
  onHome: boolean;
  layout: FeedLayout;
  onHomeToggle: (v: boolean) => void;
  onLayout: (l: Layout) => void;
  busy?: boolean;
}) {
  return (
    <div className="nplace">
      <button
        type="button"
        className={"nplace__home" + (onHome ? " on" : "")}
        onClick={() => onHomeToggle(!onHome)}
        disabled={busy}
        title={onHome ? "Remove from the Home page carousel" : "Show on the Home page carousel"}
      >
        <span className="nplace__dot" aria-hidden="true" />
        {onHome ? "On home page" : "Off home page"}
      </button>
      <div className="nseg" role="group" aria-label="News-tab format">
        <button type="button" className={"nseg__btn" + (layout === "card" ? " on" : "")} onClick={() => onLayout("card")} disabled={busy}>Card</button>
        <button type="button" className={"nseg__btn" + (layout === "list" ? " on" : "")} onClick={() => onLayout("list")} disabled={busy}>List</button>
      </div>
    </div>
  );
}

// A live preview of the story as it renders on /news — card, or list row —
// using the real news.css classes so it matches the page 1:1.
function CardPreview({
  category, title, excerpt, source, cover, layout, time,
}: {
  category: string;
  title: string;
  excerpt: string;
  source: string;
  cover: string;
  layout: FeedLayout;
  time?: string;
}) {
  const asList = layout === "list";
  const t = title.trim() || "Untitled story";
  return (
    <div className="npreview">
      <span className="npreview__tag">Preview · {asList ? "list row" : "card"}</span>
      {asList ? (
        <div className="news-row" aria-hidden="true">
          <div className="news-row__body">
            <div className="news-row__head">
              <span className="news-cat">{category}</span>
              {time && <span className="news-row__time">{time}</span>}
            </div>
            <h4 className="news-row__title">{t}</h4>
            <span className="news-row__source">{source || "Source"}</span>
          </div>
        </div>
      ) : (
        <div className="news-card card" aria-hidden="true">
          {cover && (
            <span className="news-card__art">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="news-art__img" src={cover} alt="" referrerPolicy="no-referrer" />
            </span>
          )}
          <div className="news-card__body">
            <span className="news-cat-row"><span className="news-cat">{category}</span></span>
            <h3 className="news-card__title">{t}</h3>
            {excerpt.trim() && <p className="news-card__excerpt">{excerpt}</p>}
            <div className="news-meta">
              <span className="news-meta__source">{source || "Source"}</span>
              {time && <><span className="news-meta__dot" /><span>{time}</span></>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// A cover field that accepts both a pasted URL and a file upload.
function CoverField({ cover, set }: { cover: string; set: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [upErr, setUpErr] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // let the same file be picked again after a clear
    if (!f) return;
    setUploading(true);
    setUpErr(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await uploadNewsImageAction(fd);
      if ("url" in r) set(r.url);
      else setUpErr(r.error);
    } catch {
      setUpErr("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="nfields__cover">
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="nfields__thumb" src={cover} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span className="nfields__thumb nfields__thumb--empty" aria-hidden="true" />
      )}
      <div className="nfields__coverfields">
        <input className="ninput" placeholder="Paste an image URL — or upload a file →" value={cover} onChange={(e) => set(e.target.value)} />
        <div className="nfields__coverbtns">
          <label className={"btn nupload" + (uploading ? " nupload--busy" : "")}>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" hidden onChange={onFile} disabled={uploading} />
            {uploading ? "Uploading…" : "Upload file"}
          </label>
          {cover && <button type="button" className="btn" onClick={() => set("")}>Clear</button>}
          {upErr && <span className="nupload__err">{upErr}</span>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// STORY CARD — a mod-authored story, collapsed to a one-line summary with quick
// publish / save / delete, expanding to the full editor.
// ============================================================
function StoryCard({
  story, patch, expanded, onToggle, onChange, first, last, pending,
}: {
  story: Story;
  patch: (field: keyof Story, value: unknown) => void;
  expanded: boolean;
  onToggle: () => void;
  onChange: (fn: () => Promise<void>) => void;
  first: boolean;
  last: boolean;
  pending: boolean;
}) {
  const [saved, setSaved] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const save = () =>
    onChange(async () => {
      await updateNewsAction(story.id, {
        category: story.category, title: story.title, excerpt: story.excerpt,
        source: story.source, href: story.href, cover: story.cover, hue: story.hue,
        published: story.published, onHome: story.onHome, layout: story.layout,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });

  const placeLabel = `${story.onHome ? "Home" : "Off home"} · ${story.layout === "list" ? "List" : "Card"}`;

  return (
    <article className={"nae__card" + (story.published ? "" : " nae__card--draft") + (expanded ? " nae__card--open" : "")}>
      <div className="nae__cardhead">
        <button className="nae__toggle" onClick={onToggle} aria-expanded={expanded} aria-label={expanded ? "Collapse" : "Expand"}>
          <Chevron />
        </button>
        <span className="nae__badge">{story.category}</span>
        <button className="nae__summary" onClick={onToggle} title={story.title}>
          <span className="nae__summary-title">{story.title || "Untitled story"}</span>
          <span className="nae__summary-sub">{placeLabel}</span>
        </button>

        {saved && <span className="nae__saved">Saved ✓</span>}
        <div className="nae__order">
          <button className="niconbtn" disabled={first || pending} title="More prominent" onClick={() => onChange(() => moveNewsAction(story.id, "up"))}>↑</button>
          <button className="niconbtn" disabled={last || pending} title="Less prominent" onClick={() => onChange(() => moveNewsAction(story.id, "down"))}>↓</button>
        </div>
        <div className="nae__quick">
          <button className="nae__pub" onClick={() => onChange(() => setNewsPublishedAction(story.id, !story.published))} disabled={pending}>
            {story.published ? "Published" : "Draft"}
          </button>
          <button className="btn btn--primary nae__qbtn" onClick={save} disabled={pending}>Save</button>
          {confirmDel ? (
            <>
              <button className="btn nae__danger nae__qbtn" onClick={() => onChange(() => deleteNewsAction(story.id))} disabled={pending}>Delete?</button>
              <button className="btn nae__qbtn" onClick={() => setConfirmDel(false)} disabled={pending} aria-label="Cancel delete">✕</button>
            </>
          ) : (
            <button className="btn nae__del nae__qbtn" onClick={() => setConfirmDel(true)} disabled={pending}>Delete</button>
          )}
        </div>
      </div>

      <div className="nae__collapse" data-open={expanded}>
        <div className="nae__collapse-inner">
          <div className="nae__body">
            <WhereShown onHome={story.onHome} category={story.category} layout={story.layout} />
            <PlacementBar
              onHome={story.onHome}
              layout={story.layout}
              onHomeToggle={(v) => patch("onHome", v)}
              onLayout={(l) => patch("layout", l)}
            />

            <div className="nfields">
              <div className="nfields__row">
                <select className="ninput ninput--cat" value={story.category} onChange={(e) => patch("category", e.target.value)}>
                  {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <label className="ninput ninput--hue" title="Art hue (1–8)">
                  hue
                  <input type="number" min={1} max={8} value={story.hue} onChange={(e) => patch("hue", Number(e.target.value))} />
                </label>
              </div>
              <input className="ninput" placeholder="Headline" value={story.title} onChange={(e) => patch("title", e.target.value)} />
              <textarea className="ninput ntext" placeholder="Summary" rows={2} value={story.excerpt} onChange={(e) => patch("excerpt", e.target.value)} />
              <div className="nfields__row">
                <input className="ninput" placeholder="Source — e.g. Anime Wire" value={story.source} onChange={(e) => patch("source", e.target.value)} />
                <input className="ninput" placeholder="Link (optional)" value={story.href} onChange={(e) => patch("href", e.target.value)} />
              </div>
              <CoverField cover={story.cover} set={(url) => patch("cover", url)} />
            </div>

            <CardPreview category={story.category} title={story.title} excerpt={story.excerpt} source={story.source} cover={story.cover} layout={story.layout} />
          </div>
        </div>
      </div>
    </article>
  );
}

// ============================================================
// LIVE CARD — a pulled (RSS) story. Text isn't editable, so its actions (hide,
// cover, placement) apply instantly. Same collapsible shell + tags.
// ============================================================
type LiveItem = {
  id: string;
  title: string;
  source: string;
  href: string | null;
  category: string;
  time: string;
  hidden: boolean;
  cover: string | null;
  onHome: boolean | null;
  layout: string | null;
};

// a live-updating "auto-releases in 1d 6h" style label
function fmtLeft(ms: number): string {
  if (ms <= 0) return "any moment";
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d}d ${h % 24}h`;
  if (h >= 1) return `${h}h ${m % 60}m`;
  return `${Math.max(1, m)}m`;
}
function Countdown({ target }: { target: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now()); // fill in the client clock after mount (SSR-safe)
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <>soon</>; // avoids an SSR/client time mismatch
  return <>{fmtLeft(new Date(target).getTime() - now)}</>;
}

function LiveCard({
  item, context, expanded, onToggle, onChange, pending,
}: {
  item: LiveItem;
  context: "incoming" | "live";
  expanded: boolean;
  onToggle: () => void;
  onChange: (fn: () => Promise<void>) => void;
  pending: boolean;
}) {
  const onHome = item.onHome !== false;
  const layout: FeedLayout = item.layout === "card" || item.layout === "list" ? item.layout : "auto";
  const placeLabel = `${onHome ? "Home" : "Off home"} · ${layout === "list" ? "List" : layout === "card" ? "Card" : "Auto"}`;
  const state = item.hidden ? "dismissed" : context === "live" ? "live" : "pending";
  const draft = context === "incoming" || item.hidden;

  return (
    <article className={"nae__card" + (draft ? " nae__card--draft" : "") + (expanded ? " nae__card--open" : "")}>
      <div className="nae__cardhead">
        <button className="nae__toggle" onClick={onToggle} aria-expanded={expanded} aria-label={expanded ? "Collapse" : "Expand"}>
          <Chevron />
        </button>
        <span className="nae__badge nae__badge--live">{item.category}</span>
        <button className="nae__summary" onClick={onToggle} title={item.title}>
          <span className="nae__summary-title">{item.title}</span>
          <span className="nae__summary-sub">{item.source}{item.hidden ? "" : ` · ${placeLabel}`}</span>
        </button>

        <span className={"nae__state nae__state--" + state}>
          {state === "live" ? "Live" : state === "pending" ? "Incoming" : "Dismissed"}
        </span>
        <div className="nae__quick">
          {item.href && (
            <a className="btn nae__qbtn" href={item.href} target="_blank" rel="noopener noreferrer">Open ↗</a>
          )}
          {item.hidden ? (
            <button className="btn nae__qbtn" onClick={() => onChange(() => hideLiveNewsAction(item.id, false))} disabled={pending}>Restore</button>
          ) : (
            <button className="btn nae__qbtn nae__del" onClick={() => onChange(() => hideLiveNewsAction(item.id, true))} disabled={pending} title="Exclude this story from the wave">Dismiss</button>
          )}
        </div>
      </div>

      <div className="nae__collapse" data-open={expanded}>
        <div className="nae__collapse-inner">
          <div className="nae__body">
            {!item.hidden && (
              <>
                <WhereShown onHome={onHome} category={item.category} layout={layout} />
                <PlacementBar
                  onHome={onHome}
                  layout={layout}
                  onHomeToggle={(v) => onChange(() => setLiveHomeAction(item.id, v))}
                  onLayout={(l) => onChange(() => setLiveLayoutAction(item.id, l))}
                  busy={pending}
                />
              </>
            )}
            <CoverField cover={item.cover ?? ""} set={(url) => onChange(() => setLiveNewsCoverAction(item.id, url || null))} />
            {!item.hidden && (
              <CardPreview category={item.category} title={item.title} excerpt="" source={item.source} cover={item.cover ?? ""} layout={layout} time={item.time} />
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

type WaveProps = {
  pending: LiveItem[];
  live: LiveItem[];
  autoReleaseAt: string | null;
  liveAt: string;
  liveAgo: string;
};

// ============================================================
export function NewsAdmin({ stories, wave }: { stories: Story[]; wave: WaveProps }) {
  const router = useRouter();
  const [items, setItems] = useState(stories);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<Set<string>>(new Set());

  // re-sync the editable copy whenever the server sends fresh data
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setItems(stories), [stories]);

  const isOpen = (id: string) => open.has(id);
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const patch = (id: string, field: keyof Story, value: unknown) =>
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));

  const run = (fn: () => Promise<void>) => start(async () => { await fn(); router.refresh(); });

  const addStory = () =>
    start(async () => {
      const id = await createNewsAction({
        category: "Industry", title: "New story", excerpt: "", source: "", href: "", cover: "",
        hue: 1, published: false, onHome: true, layout: "card",
      });
      setOpen((prev) => new Set(prev).add(id));
      router.refresh();
    });

  const liveCard = (l: LiveItem, context: "incoming" | "live") => (
    <LiveCard key={l.id} item={l} context={context} expanded={isOpen(l.id)} onToggle={() => toggle(l.id)} onChange={run} pending={pending} />
  );

  const hasPending = wave.pending.length > 0;
  const incoming = wave.pending.filter((l) => !l.hidden);
  const incomingDismissed = wave.pending.filter((l) => l.hidden);
  const liveShown = wave.live.filter((l) => !l.hidden);

  return (
    <div className={"nae" + (pending ? " nae--busy" : "")}>
      <div className="nae__toolbar">
        <button className="btn btn--primary" onClick={addStory} disabled={pending}>＋ New story</button>
        <span className="nae__hint">{items.length} stor{items.length === 1 ? "y" : "ies"} · published stories show on /news &amp; the home carousel</span>
      </div>

      <div className="nae__list">
        {items.map((s, i) => (
          <StoryCard
            key={s.id}
            story={s}
            patch={(field, value) => patch(s.id, field, value)}
            expanded={isOpen(s.id)}
            onToggle={() => toggle(s.id)}
            onChange={run}
            first={i === 0}
            last={i === items.length - 1}
            pending={pending}
          />
        ))}
        {items.length === 0 && <p className="nae__empty">No stories yet — add one with ＋ New story.</p>}
      </div>

      <section className="nae__live">
        <div className="nae__livehead">
          <h2>Pulled from sources · news waves</h2>
          <span className="nae__livesub">
            Pulled stories arrive as a wave you review here. <b>Publish</b> to replace the current news — or an incoming wave auto-releases 2 days after it appears if you don&apos;t.
          </span>
        </div>

        {hasPending ? (
          <div className="nae__wave">
            <div className="nae__wavebar">
              <div className="nae__wavebar-txt">
                <span className="nae__wavetitle">Incoming wave · {incoming.length} stor{incoming.length === 1 ? "y" : "ies"}</span>
                <span className="nae__wavesub">
                  {wave.autoReleaseAt ? <>Auto-releases in <Countdown target={wave.autoReleaseAt} /> · </> : null}
                  replaces the {liveShown.length} live now (published {wave.liveAgo})
                </span>
              </div>
              <button className="btn btn--primary" onClick={() => run(() => publishWaveAction())} disabled={pending}>
                Publish wave → replace news
              </button>
            </div>
            <div className="nae__list">{incoming.map((l) => liveCard(l, "incoming"))}</div>
            {incomingDismissed.length > 0 && (
              <div className="nae__queue nae__queue--muted">
                <div className="nae__queuehead">
                  <span className="nae__queuetitle">Dismissed from this wave</span>
                  <span className="nae__queuenum">{incomingDismissed.length}</span>
                </div>
                <div className="nae__list">{incomingDismissed.map((l) => liveCard(l, "incoming"))}</div>
              </div>
            )}
          </div>
        ) : (
          <>
            <p className="nae__caughtup">No new wave — readers are seeing the latest pulled stories (published {wave.liveAgo}).</p>
            <div className="nae__queue">
              <div className="nae__queuehead">
                <span className="nae__queuetitle">Currently live</span>
                <span className="nae__queuenum">{liveShown.length}</span>
              </div>
              {liveShown.length > 0 ? (
                <div className="nae__list">{liveShown.map((l) => liveCard(l, "live"))}</div>
              ) : (
                <p className="nae__empty">Nothing pulled yet.</p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
