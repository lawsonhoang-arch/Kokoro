import Link from "next/link";
import type { ActivityEvent, ActivityKind } from "@/lib/activity";
import { timeAgo, initials } from "@/features/community/helpers";

function hueOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 6) + 1;
}

const fmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1));

// the verb for each kind, sentence-cased when it leads (the "You" diary omits
// the actor, so the verb starts the line)
function verb(kind: ActivityKind, lead: boolean): string {
  const v: Record<ActivityKind, string> = {
    completed: "completed",
    favorited: "favourited",
    rated: "rated",
    take: "shared a take on",
    note: "wrote about",
    rewatched: "rewatched",
  };
  const w = v[kind];
  return lead ? w[0].toUpperCase() + w.slice(1) : w;
}

// 2 → "2nd", 3 → "3rd", etc.
function nth(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const FEELING_LABEL: Record<string, string> = { loved: "Loved", liked: "Liked", mixed: "Mixed", dropped: "Dropped" };

function Row({ e, self }: { e: ActivityEvent; self: boolean }) {
  const name = e.user.name || "@" + e.user.username;
  const snippet = (e.heading || e.body || "").trim();
  const showRating = e.score != null || (e.feeling && FEELING_LABEL[e.feeling]);

  return (
    <article className="act">
      {self ? (
        <span className="act__dot" aria-hidden="true" />
      ) : (
        <Link href={`/u/${encodeURIComponent(e.user.username)}`} className={`avatar avatar--h${hueOf(e.user.username)} act__avatar`} title={name}>
          {e.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.user.image} alt="" referrerPolicy="no-referrer" />
          ) : (
            initials(name)
          )}
        </Link>
      )}

      <div className="act__body">
        <div className="act__line">
          {!self && <Link href={`/u/${encodeURIComponent(e.user.username)}`} className="act__user">{name}</Link>}
          <span className="act__verb">{verb(e.kind, self)}</span>
          {e.title && (
            <Link href={`/anime/${encodeURIComponent(e.title.id)}`} className="act__title">{e.title.name}</Link>
          )}
          {e.episode && <span className="act__ep">{e.episode}</span>}
          {e.kind === "rewatched" && e.ordinal && <span className="act__nth">{nth(e.ordinal)} time</span>}
          {showRating && (
            <span className={"act__rating" + (e.feeling ? " act__rating--" + e.feeling : "")}>
              {e.score != null ? `★ ${fmt(e.score)}` : FEELING_LABEL[e.feeling!]}
            </span>
          )}
          <span className="act__time">{timeAgo(e.at.toISOString())}</span>
        </div>
        {snippet && (e.kind === "note" || e.kind === "take" || e.kind === "rated") && (
          <p className="act__note">{snippet}</p>
        )}
      </div>

      {e.title?.cover && (
        <Link href={`/anime/${encodeURIComponent(e.title.id)}`} className="act__cover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={e.title.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
        </Link>
      )}
    </article>
  );
}

/** A newest-first timeline of activity. `self` omits the actor (your own diary
 *  reads verb-first: "Completed X", "Rated Y ★4"). */
export function ActivityFeed({ events, self = false, empty }: { events: ActivityEvent[]; self?: boolean; empty: string }) {
  if (events.length === 0) return <p className="act-empty">{empty}</p>;
  return (
    <div className="act-list">
      {events.map((e) => <Row key={e.id} e={e} self={self} />)}
    </div>
  );
}
