"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { signOutAction } from "@/lib/auth-actions";
import { RatingBadge } from "@/features/community/RatingBadge";
import { timeAgo } from "@/features/community/helpers";
import { updateProfileAction, changeUsernameAction } from "./actions";
import { toggleFavoriteAction } from "@/app/(app)/anime/actions";
import { AddFavorites } from "./AddFavorites";
import { computeBadges, type Badge } from "./badges";
import { BadgeCelebration } from "./BadgeCelebration";
import { StatsExplorer, StatsEmpty } from "../stats/StatsExplorer";
import type { StatsData } from "@/lib/stats";
import type {
  ProfileUser,
  ProfileSummary,
  ProfileReview,
  Superlative,
  ProfileTitle,
} from "@/lib/profile";

type Tab = "overview" | "stats" | "reviews" | "settings";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "stats", label: "Stats" },
  { id: "reviews", label: "Reviews" },
  { id: "settings", label: "Settings" },
];

// generated poster gradient for titles without cover art (matches anime page)
function genPoster(seed: string): CSSProperties {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  h = Math.abs(h);
  const a = h % 360;
  const bg = (a + 35 + (h % 30)) % 360;
  return { backgroundImage: `linear-gradient(135deg, oklch(0.55 0.13 ${a}), oklch(0.4 0.13 ${bg}))` };
}

function Poster({ t, className }: { t: { id: string; title: string; cover: string | null }; className?: string }) {
  return (
    <span className={"pf-poster " + (className ?? "")} style={t.cover ? undefined : genPoster(t.id)}>
      {t.cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
      )}
    </span>
  );
}

function Superlatives({ items }: { items: Superlative[] }) {
  if (items.length === 0)
    return <div className="pf-empty">Rate a few titles and your superlatives will show up here.</div>;
  return (
    <div className="pf-supers">
      {items.map((s) => (
        <Link key={s.key} href={`/anime/${encodeURIComponent(s.titleId)}`} className="pf-super">
          <Poster t={{ id: s.titleId, title: s.title, cover: s.cover }} className="pf-super__art" />
          <div className="pf-super__body">
            <div className="pf-super__label">{s.label}</div>
            <div className="pf-super__title">{s.title}</div>
          </div>
          <div className="pf-super__value">{s.value}</div>
        </Link>
      ))}
    </div>
  );
}

function Milestones({ badges }: { badges: Badge[] }) {
  const earned = badges.filter((b) => b.earned).length;
  // Clicking a badge reveals a popover with the requirement + progress (the
  // hover title alone isn't discoverable and doesn't work on touch).
  const [openKey, setOpenKey] = useState<string | null>(null);
  useEffect(() => {
    if (!openKey) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".pf-badge")) setOpenKey(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenKey(null);
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [openKey]);

  return (
    <section className="section pf-badges">
      <header className="section__head">
        <div>
          <h3 className="section__title">Milestones</h3>
          <div className="section__sub">{earned} of {badges.length} badges earned · tap a badge for details</div>
        </div>
      </header>
      <div className="pf-badgegrid">
        {badges.map((b) => {
          const open = openKey === b.key;
          const pct = Math.round(b.progress * 100);
          return (
            <button
              key={b.key}
              type="button"
              className={"pf-badge" + (b.earned ? " on" : "") + (open ? " open" : "")}
              aria-expanded={open}
              onClick={() => setOpenKey((k) => (k === b.key ? null : b.key))}
            >
              <span className="pf-badge__ico" aria-hidden="true">{b.icon}</span>
              <span className="pf-badge__label">{b.label}</span>
              {b.earned ? (
                <span className="pf-badge__done">Earned</span>
              ) : (
                <>
                  <span className="pf-badge__bar"><span style={{ width: `${b.progress * 100}%` }} /></span>
                  <span className="pf-badge__num">{b.value.toLocaleString()}/{b.goal.toLocaleString()}</span>
                </>
              )}
              {open && (
                <span className="pf-badge__pop" role="tooltip" onClick={(e) => e.stopPropagation()}>
                  <span className="pf-badge__pop-req">{b.desc}</span>
                  {b.earned ? (
                    <span className="pf-badge__pop-status pf-badge__pop-status--done">Unlocked ✓</span>
                  ) : (
                    <>
                      <span className="pf-badge__pop-bar"><span style={{ width: `${b.progress * 100}%` }} /></span>
                      <span className="pf-badge__pop-status">
                        {b.value.toLocaleString()} / {b.goal.toLocaleString()} · {pct}% · {(b.goal - b.value).toLocaleString()} to go
                      </span>
                    </>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function FavCard({ t, onRemove }: { t: ProfileTitle; onRemove: (id: string) => void }) {
  return (
    <div className="pf-fav">
      <Link href={`/anime/${encodeURIComponent(t.id)}`} className="pf-fav__link">
        <Poster t={t} className="pf-fav__art" />
        {t.score != null && <span className="pf-fav__score">★ {t.score % 1 === 0 ? t.score : t.score.toFixed(1)}</span>}
        <span className="pf-fav__sub">{[t.year, t.genres[0]].filter(Boolean).join(" · ")}</span>
        <span className="pf-fav__title">{t.title}</span>
      </Link>
      <button className="pf-fav__remove" onClick={() => onRemove(t.id)} aria-label={`Remove ${t.title} from favorites`} title="Remove from favorites">
        ✕
      </button>
    </div>
  );
}

function Overview({
  summary,
  reviews,
  favorites,
  badges,
  onRemoveFavorite,
  onOpenPicker,
}: {
  summary: ProfileSummary;
  reviews: ProfileReview[];
  favorites: ProfileTitle[];
  badges: Badge[];
  onRemoveFavorite: (id: string) => void;
  onOpenPicker: () => void;
}) {
  // cards shrink as the count grows (bigger when few) but stay within a compact
  // footprint — never larger than the previous single-card size.
  const n = favorites.length;
  const favSize = n <= 2 ? 158 : n <= 4 ? 138 : n <= 6 ? 122 : 108;
  return (
    <>
    <section className="pf-grid" aria-label="Overview">
      <div>
        <section className="section" style={{ marginTop: 0 }}>
          <header className="section__head">
            <div>
              <h3 className="section__title">Favorites</h3>
              <div className="section__sub">Titles you&apos;ve hand-picked · friends can see these</div>
            </div>
            <button className="pf-addfav" onClick={onOpenPicker}>+ Add favorites</button>
          </header>
          {favorites.length === 0 ? (
            <button className="pf-empty pf-empty--cta" onClick={onOpenPicker}>
              No favorites yet — <b>search and add</b> the anime you want on your profile.
            </button>
          ) : (
            <div className="pf-favs" style={{ ["--fav-size"]: `${favSize}px` } as CSSProperties}>
              {favorites.map((t) => <FavCard key={t.id} t={t} onRemove={onRemoveFavorite} />)}
            </div>
          )}
        </section>

        <section className="section">
          <header className="section__head">
            <div>
              <h3 className="section__title">Recent reviews</h3>
              <div className="section__sub">Your public micro-reviews</div>
            </div>
            <Link href="/community" className="section__more">Community →</Link>
          </header>
          {reviews.length === 0 ? (
            <div className="pf-empty">No reviews yet — write one from any anime&apos;s community page.</div>
          ) : (
            reviews.slice(0, 3).map((r) => (
              <article key={r.id} className="pf-review">
                {r.titleId ? (
                  <Link href={`/community/${encodeURIComponent(r.titleId)}`}>
                    <Poster t={{ id: r.titleId, title: r.titleName ?? "", cover: r.cover }} className="pf-review__cover" />
                  </Link>
                ) : (
                  <span className="pf-poster pf-review__cover" style={genPoster(r.id)} />
                )}
                <div>
                  <div className="pf-review__head">
                    <span className="pf-review__title">{r.titleName ?? "Untitled"}</span>
                    <RatingBadge post={r} />
                  </div>
                  {r.heading && <div className="pf-review__heading">{r.heading}</div>}
                  {r.body && <p className="pf-review__text">{r.body}</p>}
                  <span className="pf-review__when">{timeAgo(r.createdAt)} · {r.likeCount} ♡</span>
                </div>
              </article>
            ))
          )}
        </section>
      </div>

      <aside>
        <section className="section" style={{ marginTop: 0 }}>
          <header className="section__head"><div><h3 className="section__title">Superlatives</h3><div className="section__sub">Records from your library</div></div></header>
          <Superlatives items={summary.superlatives} />
        </section>

        <section className="section">
          <header className="section__head">
            <div>
              <h3 className="section__title">Currently watching</h3>
              <div className="section__sub">{summary.stats.watching} in rotation</div>
            </div>
            <Link href="/watchlist" className="section__more">Lists →</Link>
          </header>
          {summary.watching.length === 0 ? (
            <div className="pf-empty">Nothing in progress right now.</div>
          ) : (
            <div className="pf-watching">
              {summary.watching.map((w) => (
                <Link key={w.id} href={`/anime/${encodeURIComponent(w.id)}`} className="pf-watch">
                  <Poster t={w} className="pf-watch__art" />
                  <div className="pf-watch__body">
                    <div className="pf-watch__title">{w.title}</div>
                    <div className="pf-watch__bar">
                      <span className="pf-watch__fill" style={{ width: `${w.episodes ? Math.round(((w.progress ?? 0) / w.episodes) * 100) : 0}%` }} />
                    </div>
                    <div className="pf-watch__num">{w.progress ?? 0}/{w.episodes || "?"}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </aside>
    </section>

    <Milestones badges={badges} />
    </>
  );
}

function Reviews({ reviews }: { reviews: ProfileReview[] }) {
  return (
    <section className="section" style={{ marginTop: 0 }} aria-label="Reviews">
      <header className="section__head"><div><h3 className="section__title">All reviews</h3><div className="section__sub">{reviews.length} {reviews.length === 1 ? "review" : "reviews"}</div></div></header>
      {reviews.length === 0 ? (
        <div className="pf-empty">No reviews yet — write one from any anime&apos;s community page.</div>
      ) : (
        reviews.map((r) => (
          <article key={r.id} className="pf-review">
            {r.titleId ? (
              <Link href={`/community/${encodeURIComponent(r.titleId)}`}>
                <Poster t={{ id: r.titleId, title: r.titleName ?? "", cover: r.cover }} className="pf-review__cover" />
              </Link>
            ) : (
              <span className="pf-poster pf-review__cover" style={genPoster(r.id)} />
            )}
            <div>
              <div className="pf-review__head">
                <span className="pf-review__title">{r.titleName ?? "Untitled"}</span>
                <RatingBadge post={r} />
              </div>
              {r.heading && <div className="pf-review__heading">{r.heading}</div>}
              {r.body && <p className="pf-review__text">{r.body}</p>}
              <span className="pf-review__when">{timeAgo(r.createdAt)} · {r.likeCount} ♡</span>
            </div>
          </article>
        ))
      )}
    </section>
  );
}

function Settings({ user }: { user: ProfileUser }) {
  const [name, setName] = useState(user.name ?? "");
  const [bio, setBio] = useState(user.bio);
  const [username, setUsername] = useState(user.username);
  const [savedId, setSavedId] = useState(false);
  const [busyId, setBusyId] = useState(false);
  const [uErr, setUErr] = useState<string | null>(null);
  const [uSaved, setUSaved] = useState(false);
  const [busyU, setBusyU] = useState(false);

  const saveIdentity = async () => {
    setBusyId(true);
    setSavedId(false);
    try {
      await updateProfileAction({ name, bio });
      setSavedId(true);
    } finally {
      setBusyId(false);
    }
  };
  const saveUsername = async () => {
    setBusyU(true);
    setUErr(null);
    setUSaved(false);
    try {
      const r = await changeUsernameAction(username);
      if (r.ok) setUSaved(true);
      else setUErr(r.error ?? "Couldn't update.");
    } finally {
      setBusyU(false);
    }
  };

  const memberSince = new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  return (
    <section className="pf-settings" aria-label="Settings">
      <div className="settings__group">
        <div className="settings__label">Identity</div>
        <div className="pf-field">
          <label htmlFor="pf-name">Display name</label>
          <input id="pf-name" className="pf-input" value={name} maxLength={60} placeholder="Your name" onChange={(e) => { setName(e.target.value); setSavedId(false); }} />
        </div>
        <div className="pf-field">
          <label htmlFor="pf-bio">Bio</label>
          <textarea id="pf-bio" className="pf-input pf-textarea" value={bio} maxLength={240} rows={3} placeholder="A line or two about your taste…" onChange={(e) => { setBio(e.target.value); setSavedId(false); }} />
          <span className="pf-counter">{bio.length}/240</span>
        </div>
        <div className="pf-saverow">
          <button className="btn btn--primary" disabled={busyId} onClick={saveIdentity}>{busyId ? "Saving…" : "Save"}</button>
          {savedId && <span className="pf-ok">Saved ✓</span>}
        </div>
      </div>

      <div className="settings__group">
        <div className="settings__label">Handle</div>
        <div className="pf-field">
          <label htmlFor="pf-username">Username</label>
          <div className="pf-handle-edit">
            <span className="pf-at">@</span>
            <input id="pf-username" className="pf-input" value={username} maxLength={20} onChange={(e) => { setUsername(e.target.value.toLowerCase()); setUErr(null); setUSaved(false); }} />
          </div>
          <span className="pf-counter">3–20 chars · letters, numbers, underscores</span>
        </div>
        <div className="pf-saverow">
          <button className="btn btn--primary" disabled={busyU || username === user.username} onClick={saveUsername}>{busyU ? "Saving…" : "Change username"}</button>
          {uSaved && <span className="pf-ok">Saved ✓</span>}
          {uErr && <span className="pf-err">{uErr}</span>}
        </div>
      </div>

      <div className="settings__group">
        <div className="settings__label">Account</div>
        <div className="setting-row">
          <div><div className="setting-row__title">Email</div><div className="setting-row__desc">Used to sign in. Private.</div></div>
          <span className="chip">{user.email}</span>
        </div>
        <div className="setting-row">
          <div><div className="setting-row__title">Member since</div><div className="setting-row__desc">When you joined Kokoro.</div></div>
          <span className="chip">{memberSince}</span>
        </div>
        <div className="setting-row">
          <div><div className="setting-row__title">Role</div><div className="setting-row__desc">Your permissions on Kokoro.</div></div>
          <span className="chip">{user.role}</span>
        </div>
        <div className="setting-row">
          <div><div className="setting-row__title">Session</div><div className="setting-row__desc">Sign out of this device.</div></div>
          <form action={signOutAction}><button className="btn" type="submit">Sign out</button></form>
        </div>
      </div>
    </section>
  );
}

export function ProfileTabs({
  user,
  summary,
  reviews,
  favorites: initialFavorites,
  stats,
}: {
  user: ProfileUser;
  summary: ProfileSummary;
  reviews: ProfileReview[];
  favorites: ProfileTitle[];
  stats: StatsData;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [favorites, setFavorites] = useState<ProfileTitle[]>(initialFavorites);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Badges recompute live off the (stateful) favorites count + summary stats,
  // so crossing a threshold while on the page (e.g. adding a 6th favorite)
  // updates them immediately.
  const badges = useMemo(() => computeBadges(summary.stats, favorites.length), [summary.stats, favorites.length]);

  // Celebrate newly-unlocked badges. We remember which badges the user has
  // already been congratulated for in localStorage (badges aren't persisted
  // server-side). First ever visit seeds a silent baseline so we don't fire a
  // toast for every badge already earned; after that, any freshly-earned badge
  // pops a one-at-a-time celebration queue.
  const [celebrations, setCelebrations] = useState<Badge[]>([]);
  useEffect(() => {
    const key = `kokoro:badges:${user.id}`;
    const earnedKeys = badges.filter((b) => b.earned).map((b) => b.key);
    let known: string[] | null = null;
    try {
      const raw = localStorage.getItem(key);
      known = raw ? (JSON.parse(raw) as string[]) : null;
    } catch {
      known = null;
    }
    if (known === null) {
      // no baseline yet → establish one without celebrating existing badges
      try { localStorage.setItem(key, JSON.stringify(earnedKeys)); } catch {}
      return;
    }
    const knownSet = new Set(known);
    const fresh = badges.filter((b) => b.earned && !knownSet.has(b.key));
    if (fresh.length) {
      // Reacting to an external system (persisted baseline + stat changes) by
      // enqueuing a toast — inherent to unlock detection, and only on the rare
      // render where a badge actually crosses its threshold.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCelebrations((q) => [...q, ...fresh.filter((f) => !q.some((x) => x.key === f.key))]);
      try { localStorage.setItem(key, JSON.stringify(earnedKeys)); } catch {}
    }
  }, [badges, user.id]);

  // pure local state updaters (the AddFavorites modal does its own server toggle)
  const addFavLocal = (t: ProfileTitle) => setFavorites((fs) => (fs.some((f) => f.id === t.id) ? fs : [t, ...fs]));
  const removeFavLocal = (id: string) => setFavorites((fs) => fs.filter((f) => f.id !== id));

  // removing from a profile card both updates state AND persists the un-favorite
  const removeFavorite = (id: string) => {
    removeFavLocal(id);
    toggleFavoriteAction(id).catch(() => {});
  };

  return (
    <>
      <nav className="pf-subtabs" aria-label="Profile sections">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "on" : undefined} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <Overview
          summary={summary}
          reviews={reviews}
          favorites={favorites}
          badges={badges}
          onRemoveFavorite={removeFavorite}
          onOpenPicker={() => setPickerOpen(true)}
        />
      )}
      {tab === "stats" && (stats.empty ? <StatsEmpty /> : <StatsExplorer data={stats} />)}
      {tab === "reviews" && <Reviews reviews={reviews} />}
      {tab === "settings" && <Settings user={user} />}

      {pickerOpen && (
        <AddFavorites
          onClose={() => setPickerOpen(false)}
          existingIds={new Set(favorites.map((f) => f.id))}
          onAdd={addFavLocal}
          onRemove={removeFavLocal}
        />
      )}

      {celebrations[0] && (
        <BadgeCelebration
          key={celebrations[0].key}
          badge={celebrations[0]}
          onDismiss={() => setCelebrations((q) => q.slice(1))}
        />
      )}
    </>
  );
}
