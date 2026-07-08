"use client";

import { useCallback, useRef, useState } from "react";
import type { CommunityPost, PostKind, FeedSort } from "@/lib/community";
import { getHomeFeedAction } from "@/app/(app)/community/actions";
import { Composer } from "./Composer";
import { PostCard } from "./PostCard";
import { LoadMore } from "./LoadMore";

type Filter = "all" | PostKind;
const SORTS: { key: FeedSort; label: string }[] = [
  { key: "latest", label: "Latest" },
  { key: "top", label: "Top" },
  { key: "discussed", label: "Most discussed" },
];

export function HomeFeed({ initial, initialCursor, canModerate = false }: { initial: CommunityPost[]; initialCursor: string | null; canModerate?: boolean }) {
  const [posts, setPosts] = useState<CommunityPost[]>(initial);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<FeedSort>("latest");
  const [loading, setLoading] = useState(false);
  const [paging, setPaging] = useState(false);
  const reqId = useRef(0);

  // change filter/sort → fetch a fresh first page
  const reset = async (f: Filter, s: FeedSort) => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const res = await getHomeFeedAction(s, f === "all" ? null : f, null);
      if (id === reqId.current) {
        setPosts(res.posts);
        setCursor(res.nextCursor);
      }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  };

  const pickFilter = (f: Filter) => { setFilter(f); reset(f, sort); };
  const pickSort = (s: FeedSort) => { setSort(s); reset(filter, s); };

  const loadMore = useCallback(async () => {
    if (paging || !cursor) return;
    setPaging(true);
    const id = reqId.current;
    try {
      const res = await getHomeFeedAction(sort, filter === "all" ? null : filter, cursor);
      if (id === reqId.current) {
        // de-dupe defensively (a like/new post could shift the keyset)
        setPosts((ps) => {
          const seen = new Set(ps.map((p) => p.id));
          return [...ps, ...res.posts.filter((p) => !seen.has(p.id))];
        });
        setCursor(res.nextCursor);
      }
    } finally {
      setPaging(false);
    }
  }, [paging, cursor, sort, filter]);

  return (
    <div className="cfeed">
      <Composer onPosted={(p) => setPosts((ps) => [p, ...ps])} />

      <div className="cfeed__controls">
        <div className="cfeed__filters" role="tablist" aria-label="Filter feed">
          {(["all", "discussion", "review"] as Filter[]).map((f) => (
            <button key={f} className={"cfilter" + (filter === f ? " on" : "")} onClick={() => pickFilter(f)}>
              {f === "all" ? "Everything" : f === "discussion" ? "Discussions" : "Reviews"}
            </button>
          ))}
        </div>
        <div className="cseg-sort">
          {SORTS.map((s) => (
            <button key={s.key} className={"cseg-sort__opt" + (sort === s.key ? " on" : "")} onClick={() => pickSort(s.key)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className={"cfeed__list" + (loading ? " loading" : "")}>
        {posts.length === 0 ? (
          <div className="cfeed__empty">
            No posts yet — be the first to start a discussion or drop a review.
          </div>
        ) : (
          posts.map((p) => (
            <PostCard key={p.id} post={p} showTitle canModerate={canModerate} onDeleted={(id) => setPosts((ps) => ps.filter((x) => x.id !== id))} />
          ))
        )}
      </div>

      <LoadMore hasMore={!!cursor} loading={paging} onLoad={loadMore} />
    </div>
  );
}
