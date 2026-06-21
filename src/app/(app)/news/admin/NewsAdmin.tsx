"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createNewsAction,
  updateNewsAction,
  deleteNewsAction,
  setNewsPublishedAction,
  moveNewsAction,
} from "./actions";

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
};
type Draft = Omit<Story, "id" | "published">;

const CATS = ["Industry", "Releases", "Adaptations", "Interviews"];
const EMPTY: Draft = { category: "Industry", title: "", excerpt: "", source: "", href: "", cover: "", hue: 1 };

function StoryFields({ v, set }: { v: Draft; set: (patch: Partial<Draft>) => void }) {
  return (
    <div className="nfields">
      <div className="nfields__row">
        <select className="ninput ninput--cat" value={v.category} onChange={(e) => set({ category: e.target.value })}>
          {CATS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <label className="ninput ninput--hue" title="Art hue (1–8)">
          hue
          <input type="number" min={1} max={8} value={v.hue} onChange={(e) => set({ hue: Number(e.target.value) })} />
        </label>
      </div>
      <input className="ninput" placeholder="Headline" value={v.title} onChange={(e) => set({ title: e.target.value })} />
      <textarea className="ninput ntext" placeholder="Summary" rows={2} value={v.excerpt} onChange={(e) => set({ excerpt: e.target.value })} />
      <div className="nfields__row">
        <input className="ninput" placeholder="Source — e.g. Anime Wire" value={v.source} onChange={(e) => set({ source: e.target.value })} />
        <input className="ninput" placeholder="Link (optional)" value={v.href} onChange={(e) => set({ href: e.target.value })} />
      </div>
      <div className="nfields__cover">
        {v.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="nfields__thumb" src={v.cover} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="nfields__thumb nfields__thumb--empty" aria-hidden="true" />
        )}
        <input className="ninput" placeholder="Cover image URL (optional — else a catalog cover is used)" value={v.cover} onChange={(e) => set({ cover: e.target.value })} />
      </div>
    </div>
  );
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const [v, setV] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Draft>) => setV((x) => ({ ...x, ...patch }));
  const submit = async () => {
    if (!v.title.trim()) return;
    setBusy(true);
    await createNewsAction({ ...v, published: true });
    setBusy(false);
    setV(EMPTY);
    onDone();
  };
  return (
    <section className="ncard ncard--new">
      <div className="ncard__head">
        <span className="ncard__cat">New story</span>
        <span className="ncard__hint">Added at the bottom — reorder with the arrows</span>
      </div>
      <StoryFields v={v} set={set} />
      <div className="ncard__actions">
        <button className="btn btn--primary" disabled={busy || !v.title.trim()} onClick={submit}>
          {busy ? "Adding…" : "Add story"}
        </button>
      </div>
    </section>
  );
}

function StoryEditor({
  story, first, last, onChange,
}: {
  story: Story;
  first: boolean;
  last: boolean;
  onChange: () => void;
}) {
  const [v, setV] = useState<Draft>({
    category: story.category, title: story.title, excerpt: story.excerpt,
    source: story.source, href: story.href, cover: story.cover, hue: story.hue,
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (patch: Partial<Draft>) => { setV((x) => ({ ...x, ...patch })); setSaved(false); };

  const save = async () => {
    setBusy(true);
    await updateNewsAction(story.id, { ...v, published: story.published });
    setBusy(false);
    setSaved(true);
    onChange();
  };

  return (
    <section className={"ncard" + (story.published ? "" : " ncard--off")}>
      <div className="ncard__head">
        <span className={"ncard__hue poster--h" + v.hue} aria-hidden="true" />
        <span className="ncard__cat">{story.category}</span>
        <span className={"ncard__status" + (story.published ? " on" : "")}>
          {story.published ? "Published" : "Draft"}
        </span>
        <div className="ncard__order">
          <button className="niconbtn" disabled={first} title="More prominent (up)" onClick={() => moveNewsAction(story.id, "up").then(onChange)}>↑</button>
          <button className="niconbtn" disabled={last} title="Less prominent (down)" onClick={() => moveNewsAction(story.id, "down").then(onChange)}>↓</button>
        </div>
      </div>
      <StoryFields v={v} set={set} />
      <div className="ncard__actions">
        <button className="btn btn--primary" disabled={busy} onClick={save}>
          {saved ? "Saved ✓" : busy ? "Saving…" : "Save"}
        </button>
        <button className="btn" onClick={() => setNewsPublishedAction(story.id, !story.published).then(onChange)}>
          {story.published ? "Unpublish" : "Publish"}
        </button>
        {confirmDel ? (
          <>
            <button className="btn ndanger" onClick={() => deleteNewsAction(story.id).then(onChange)}>Delete</button>
            <button className="btn" onClick={() => setConfirmDel(false)}>Cancel</button>
          </>
        ) : (
          <button className="btn ndanger-ghost" onClick={() => setConfirmDel(true)}>Delete</button>
        )}
      </div>
    </section>
  );
}

export function NewsAdmin({ stories }: { stories: Story[] }) {
  const router = useRouter();
  const refresh = () => router.refresh();
  return (
    <div className="nadmin">
      <CreateForm onDone={refresh} />
      <div className="nadmin__list">
        {stories.map((s, i) => (
          <StoryEditor key={s.id} story={s} first={i === 0} last={i === stories.length - 1} onChange={refresh} />
        ))}
        {stories.length === 0 && <p className="news-empty">No stories yet — add one above.</p>}
      </div>
    </div>
  );
}
