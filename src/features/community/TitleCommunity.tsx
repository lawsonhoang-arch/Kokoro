"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CommunityPost, PostKind, FeedSort } from "@/lib/community";
import { getTitleFeedAction } from "@/app/(app)/community/actions";
import { Composer } from "./Composer";
import { PostCard } from "./PostCard";
import { LoadMore } from "./LoadMore";

type Sort = "all" | "discussion" | "review" | "episodes";

const SORTS: { key: Sort; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "discussion", label: "Discussions only" },
  { key: "review", label: "Reviews only" },
  { key: "episodes", label: "By episode" },
];
const ORDERS: { key: FeedSort; label: string }[] = [
  { key: "latest", label: "Latest" },
  { key: "top", label: "Top" },
  { key: "discussed", label: "Discussed" },
];

const epLabel = (n: number) => `EP ${n}`;
const epNum = (s: string): number | null => {
  const m = s.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
};

type Medium = "all" | "anime" | "manga";
const MEDIA: { key: Medium; label: string }[] = [
  { key: "all", label: "All" },
  { key: "anime", label: "Anime" },
  { key: "manga", label: "Manga" },
];

export function TitleCommunity({
  titleId,
  titleName,
  episodes,
  initialPosts,
  initialCursor,
  initialCounts,
  crossMedium = false,
  canModerate = false,
}: {
  titleId: string;
  titleName: string;
  episodes: number;
  initialPosts: CommunityPost[];
  initialCursor: string | null;
  initialCounts: Record<string, number>;
  /** true when a manga + its anime share this community (show the medium filter) */
  crossMedium?: boolean;
  /** viewer is a moderator → can remove any post */
  canModerate?: boolean;
}) {
  const [posts, setPosts] = useState<CommunityPost[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  const [sort, setSort] = useState<Sort>("all");
  const [order, setOrder] = useState<FeedSort>("latest");
  const [medium, setMedium] = useState<Medium>("all");
  const [selEp, setSelEp] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paging, setPaging] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  // the {kind, episode} pair implied by the current sort/episode selection
  const currentFilter = (): { kind: PostKind | null; episode: string | null } => ({
    kind: sort === "discussion" || sort === "review" ? sort : null,
    episode: sort === "episodes" && selEp != null ? epLabel(selEp) : null,
  });

  // close the sort menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [menuOpen]);

  // re-fetch a fresh first page when the active filter changes
  const medArg = (m: Medium): "anime" | "manga" | null => (m === "all" ? null : m);

  const refetch = async (kind: PostKind | null, episode: string | null, ord: FeedSort = order, med: Medium = medium) => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const res = await getTitleFeedAction(titleId, kind, episode, ord, null, medArg(med));
      if (id === reqId.current) {
        setPosts(res.posts);
        setCursor(res.nextCursor);
      }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  };

  const pickSort = (s: Sort) => {
    setSort(s);
    setMenuOpen(false);
    if (s === "episodes") {
      // wait for an episode pick; clear any kind filter
      if (selEp != null) refetch(null, epLabel(selEp));
      else { setPosts(initialPosts); setCursor(initialCursor); }
    } else {
      setSelEp(null);
      refetch(s === "all" ? null : s, null);
    }
  };

  const loadMore = useCallback(async () => {
    if (paging || !cursor) return;
    setPaging(true);
    const id = reqId.current;
    try {
      const { kind, episode } = currentFilter();
      const res = await getTitleFeedAction(titleId, kind, episode, order, cursor, medArg(medium));
      if (id === reqId.current) {
        setPosts((ps) => {
          const seen = new Set(ps.map((p) => p.id));
          return [...ps, ...res.posts.filter((p) => !seen.has(p.id))];
        });
        setCursor(res.nextCursor);
      }
    } finally {
      setPaging(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paging, cursor, order, sort, selEp, titleId, medium]);

  const pickMedium = (m: Medium) => {
    if (m === medium) return;
    setMedium(m);
    const { kind, episode } = currentFilter();
    refetch(kind, episode, order, m);
  };

  const pickEpisode = (n: number) => {
    const next = selEp === n ? null : n;
    setSelEp(next);
    refetch(null, next != null ? epLabel(next) : null);
  };

  // change the ordering (latest/top/discussed) within the current filter
  const pickOrder = (o: FeedSort) => {
    setOrder(o);
    const kind: PostKind | null = sort === "discussion" || sort === "review" ? sort : null;
    const episode = sort === "episodes" && selEp != null ? epLabel(selEp) : null;
    refetch(kind, episode, o);
  };

  const onPosted = (p: CommunityPost) => {
    setPosts((ps) => [p, ...ps]);
    if (p.episode) setCounts((c) => ({ ...c, [p.episode]: (c[p.episode] || 0) + 1 }));
  };

  const sortLabel = SORTS.find((s) => s.key === sort)!.label;

  return (
    <div className="cfeed">
      <Composer fixedTitle={{ id: titleId, name: titleName }} onPosted={onPosted} />

      <div className="cfeed__bar">
        <span className="cfeed__count">{posts.length} {posts.length === 1 ? "post" : "posts"}</span>
        {crossMedium && (
          <div className="cseg-sort cseg-sort--sm cmedium" role="group" aria-label="Filter by medium">
            {MEDIA.map((m) => (
              <button
                key={m.key}
                className={"cseg-sort__opt" + (medium === m.key ? " on" : "")}
                onClick={() => pickMedium(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
        <div className="cseg-sort cseg-sort--sm">
          {ORDERS.map((o) => (
            <button key={o.key} className={"cseg-sort__opt" + (order === o.key ? " on" : "")} onClick={() => pickOrder(o.key)}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="csort" ref={menuRef}>
          <button className={"csort__btn" + (menuOpen ? " on" : "")} onClick={() => setMenuOpen((o) => !o)}>
            <span className="csort__lbl">{sortLabel}</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {menuOpen && (
            <div className="csort__menu">
              {SORTS.map((s) => (
                <button key={s.key} className={"csort__item" + (sort === s.key ? " on" : "")} onClick={() => pickSort(s.key)}>
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {sort === "episodes" && (
        <div className="cepgrid">
          <div className="cepgrid__head">
            {selEp != null ? `Showing posts for ${epLabel(selEp)}` : "Pick an episode to see its discussions & reviews"}
          </div>
          <div className="cepgrid__cells">
            {Array.from({ length: Math.max(1, episodes) }, (_, i) => i + 1).map((n) => {
              const c = counts[epLabel(n)] || 0;
              return (
                <button
                  key={n}
                  className={"cepcell" + (c > 0 ? " has" : "") + (selEp === n ? " on" : "")}
                  onClick={() => pickEpisode(n)}
                  title={`Episode ${n}${c ? ` — ${c} post${c > 1 ? "s" : ""}` : ""}`}
                >
                  {n}
                  {c > 0 && <span className="cepcell__count">{c}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={"cfeed__list" + (loading ? " loading" : "")}>
        {posts.length === 0 ? (
          <div className="cfeed__empty">
            {sort === "episodes" && selEp == null
              ? "Select an episode above."
              : "Nothing here yet — start the conversation."}
          </div>
        ) : (
          posts.map((p) => (
            <PostCard key={p.id} post={p} canModerate={canModerate} onDeleted={(id) => setPosts((ps) => ps.filter((x) => x.id !== id))} />
          ))
        )}
      </div>

      <LoadMore hasMore={!!cursor} loading={paging} onLoad={loadMore} />
    </div>
  );
}

// keep the helper exported in case other views need it
export { epNum };
