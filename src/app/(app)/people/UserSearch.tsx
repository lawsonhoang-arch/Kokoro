"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { UserCard } from "@/features/social/UserCard";
import type { UserLite } from "@/lib/follows";
import type { MatchLite } from "@/lib/affinity";
import { searchUsersAction } from "./actions";

// Debounced free-text search over users, rendering the shared UserCard rows.
export function UserSearch({ viewerId }: { viewerId: string }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<UserLite[]>([]);
  const [matches, setMatches] = useState<Record<string, MatchLite>>({});
  const [resultQuery, setResultQuery] = useState(""); // the query `list` belongs to
  const [pending, startTransition] = useTransition();
  const seq = useRef(0);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return; // stale results stay in state but are hidden by the render guard
    const id = ++seq.current;
    const t = setTimeout(() => {
      startTransition(async () => {
        const res = await searchUsersAction(query);
        if (id !== seq.current) return; // a newer keystroke won
        setList(res.list);
        setMatches(res.matches);
        setResultQuery(query);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const query = q.trim();
  const settled = resultQuery === query && !pending; // results (or emptiness) are for the current query

  return (
    <div className="ppl-search">
      <div className="ppl-search__box">
        <svg className="ppl-search__icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />
        </svg>
        <input
          className="ppl-search__input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search people by name or @handle"
          aria-label="Search people"
        />
        {pending && <span className="ppl-search__spin" aria-hidden="true" />}
      </div>

      {query.length >= 2 && (
        list.length > 0 ? (
          <div className="usercard-list">
            {list.map((u) => <UserCard key={u.id} user={u} viewerId={viewerId} match={matches[u.id]} />)}
          </div>
        ) : settled ? (
          <p className="usercard-empty">No one matches “{query}”.</p>
        ) : null
      )}
    </div>
  );
}
