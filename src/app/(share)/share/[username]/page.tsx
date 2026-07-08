import "./share.css";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getUserIdByUsername, getProfileUser, getProfileSummary } from "@/lib/profile";
import { getFavorites } from "@/lib/favorites";

function hueOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 6) + 1;
}
function genPoster(seed: string): CSSProperties {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  h = Math.abs(h);
  const a = h % 360;
  return { backgroundImage: `linear-gradient(135deg, oklch(0.55 0.13 ${a}), oklch(0.4 0.13 ${(a + 40) % 360}))` };
}
const initials = (s: string) => s.split(/[\s@]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const num = (n: number) => n.toLocaleString();

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const userId = await getUserIdByUsername(decodeURIComponent(username));
  if (!userId) return { title: "Kokoro" };
  const user = await getProfileUser(userId);
  const name = user?.name || (user ? "@" + user.username : "A reader");
  return {
    title: `${name} on Kokoro`,
    description: `${name}'s anime & manga taste on Kokoro — favourites, stats and superlatives. Build your own.`,
  };
}

export default async function SharePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const userId = await getUserIdByUsername(decodeURIComponent(username));

  if (!userId) {
    return (
      <main className="sh">
        <BrandBar />
        <div className="sh-empty">
          <h1>No one here by that name</h1>
          <p>This profile doesn&apos;t exist (or was renamed). But you could start your own.</p>
          <Cta />
        </div>
      </main>
    );
  }

  const [user, summary, favorites] = await Promise.all([
    getProfileUser(userId),
    getProfileSummary(userId),
    getFavorites(userId),
  ]);
  if (!user) {
    return (
      <main className="sh">
        <BrandBar />
        <div className="sh-empty"><h1>Profile unavailable</h1><Cta /></div>
      </main>
    );
  }

  const displayName = user.name || "@" + user.username;
  const since = new Date(user.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const s = summary.stats;
  const watching = summary.watching.slice(0, 8);
  const favs = favorites.slice(0, 8);

  const stats = [
    { label: "Completed", value: num(s.completed) },
    { label: "Hours", value: num(s.hours) },
    { label: "Episodes", value: num(s.episodesWatched) },
    ...(s.chaptersRead > 0 ? [{ label: "Chapters", value: num(s.chaptersRead) }] : []),
    { label: "Reviews", value: num(s.reviews) },
    ...(s.topGenre ? [{ label: "Top genre", value: s.topGenre }] : []),
  ];

  return (
    <main className="sh">
      <BrandBar />

      {/* hero */}
      <section className={"sh-hero" + (user.bannerArt ? " sh-hero--art" : "")}
        style={user.bannerArt ? { backgroundImage: `linear-gradient(180deg, transparent, var(--page) 92%), url(${user.bannerArt})`, backgroundPosition: user.bannerPos ?? "center" } : undefined}>
        <div className={"sh-avatar sh-avatar--h" + hueOf(user.username)}>
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" referrerPolicy="no-referrer" />
          ) : initials(displayName)}
        </div>
        <div className="sh-hero__meta">
          <span className="sh-eyebrow">On Kokoro · since {since}</span>
          <h1 className="sh-name">{displayName}</h1>
          <span className="sh-handle">@{user.username}</span>
          {user.bio && <p className="sh-bio">{user.bio}</p>}
        </div>
      </section>

      {/* stats */}
      <section className="sh-stats">
        {stats.map((st) => (
          <div key={st.label} className="sh-stat">
            <span className="sh-stat__val">{st.value}</span>
            <span className="sh-stat__lbl">{st.label}</span>
          </div>
        ))}
      </section>

      {/* superlatives */}
      {summary.superlatives.length > 0 && (
        <section className="sh-block">
          <h2 className="sh-h2">Records</h2>
          <div className="sh-records">
            {summary.superlatives.map((r) => (
              <div key={r.key} className="sh-record">
                <span className="sh-record__art" style={r.cover ? undefined : genPoster(r.titleId)}>
                  {r.cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
                  )}
                </span>
                <span className="sh-record__txt">
                  <span className="sh-record__label">{r.label}</span>
                  <span className="sh-record__title">{r.title}</span>
                  <span className="sh-record__value">{r.value}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* currently watching */}
      {watching.length > 0 && (
        <section className="sh-block">
          <h2 className="sh-h2">Currently watching</h2>
          <div className="sh-posters">
            {watching.map((t) => <Poster key={t.id} id={t.id} title={t.title} cover={t.cover} sub={t.progress ? `EP ${t.progress}` : t.status} />)}
          </div>
        </section>
      )}

      {/* favorites */}
      {favs.length > 0 && (
        <section className="sh-block">
          <h2 className="sh-h2">All-time favourites</h2>
          <div className="sh-posters">
            {favs.map((t) => <Poster key={t.id} id={t.id} title={t.title} cover={t.cover} sub={t.score != null ? `★ ${t.score % 1 === 0 ? t.score : t.score.toFixed(1)}` : undefined} />)}
          </div>
        </section>
      )}

      <Cta name={displayName} />
      <footer className="sh-foot">Made with Kokoro — your list, your rules.</footer>
    </main>
  );
}

function Poster({ id, title, cover, sub }: { id: string; title: string; cover: string | null; sub?: string }) {
  return (
    <div className="sh-poster">
      <span className="sh-poster__art" style={cover ? undefined : genPoster(id)}>
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
        )}
        {sub && <span className="sh-poster__badge">{sub}</span>}
      </span>
      <span className="sh-poster__title">{title}</span>
    </div>
  );
}

function BrandBar() {
  return (
    <div className="sh-brand">
      <Link href="/" className="sh-brand__logo">Kokoro<span className="sh-brand__dot">.</span></Link>
      <Link href="/signup" className="sh-brand__cta">Join free</Link>
    </div>
  );
}

function Cta({ name }: { name?: string }) {
  return (
    <section className="sh-join">
      <h2 className="sh-join__title">{name ? `That's ${name}'s taste.` : "Your turn."}</h2>
      <p className="sh-join__sub">
        Kokoro is an anime &amp; manga tracker that works the way your head does — rate by feeling, sculpt your lists,
        keep a private diary, and find people who share your taste.
      </p>
      <div className="sh-join__btns">
        <Link href="/signup" className="sh-join__primary">Create your free account →</Link>
        <Link href="/" className="sh-join__secondary">Explore Kokoro</Link>
      </div>
    </section>
  );
}
