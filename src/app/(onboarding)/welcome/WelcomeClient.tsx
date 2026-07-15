"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { SearchResult } from "@/features/search/types";
import type { SuggestedPerson } from "@/lib/onboarding";
import { starterTitlesAction, finishOnboardingAction } from "./actions";

const MAX_FAVS = 10;

function genPoster(seed: string): CSSProperties {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  h = Math.abs(h);
  const a = h % 360;
  return { backgroundImage: `linear-gradient(${(h % 6) * 30}deg, oklch(0.55 0.13 ${a}) 0%, oklch(0.4 0.13 ${(a + 40) % 360}) 100%)` };
}

function hueOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 6) + 1;
}

type Props = {
  genres: string[];
  initialName: string;
  people: SuggestedPerson[];
  initialTitles: SearchResult[];
};

const STEPS = ["Hello", "Tastes", "Favorites", "People"];

export function WelcomeClient({ genres, initialName, people, initialTitles }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName);
  const [pickedGenres, setPickedGenres] = useState<Set<string>>(new Set());
  const [titles, setTitles] = useState<SearchResult[]>(initialTitles);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [follows, setFollows] = useState<Set<string>>(new Set());
  const [loadingTitles, startTitles] = useTransition();
  const [finishing, setFinishing] = useState(false);

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void, cap?: number) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else {
      if (cap && next.size >= cap) return;
      next.add(id);
    }
    setter(next);
  };

  // moving off the taste step refreshes the favorites grid to the chosen genres
  const goFromGenres = () => {
    if (pickedGenres.size > 0) {
      startTitles(async () => {
        const t = await starterTitlesAction([...pickedGenres]);
        if (t.length) setTitles(t);
      });
    }
    setStep(2);
  };

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      await finishOnboardingAction({ name, favoriteIds: [...favs], followIds: [...follows] });
      router.push("/home?welcome=1");
    } catch {
      setFinishing(false);
    }
  };

  return (
    <main className="wl">
      <div className="wl__card">
        <header className="wl__top">
          <div className="wl__brand">kokoro</div>
          <ol className="wl__dots" aria-hidden="true">
            {STEPS.map((_, i) => (
              <li key={i} className={"wl__dot" + (i === step ? " is-on" : i < step ? " is-done" : "")} />
            ))}
          </ol>
        </header>

        {/* ---- step 0: greeting + name ---- */}
        {step === 0 && (
          <section className="wl__step">
            <h1 className="wl__h">Welcome to Kokoro</h1>
            <p className="wl__p">A cozy home for the anime & manga you love. Let&apos;s set things up — it takes a minute, and you can skip anything.</p>
            <label className="wl__label" htmlFor="wl-name">What should we call you?</label>
            <input
              id="wl-name"
              className="wl__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your display name"
              maxLength={60}
              autoFocus
            />
            <div className="wl__actions">
              <span />
              <button className="wl__next" onClick={() => setStep(1)}>Continue</button>
            </div>
          </section>
        )}

        {/* ---- step 1: taste genres ---- */}
        {step === 1 && (
          <section className="wl__step">
            <h1 className="wl__h">What are you into?</h1>
            <p className="wl__p">Pick a few genres so we can line up recommendations. Optional — choose as many as you like.</p>
            <div className="wl__chips">
              {genres.map((g) => {
                const on = pickedGenres.has(g);
                return (
                  <button
                    key={g}
                    type="button"
                    className={"wl__chip" + (on ? " is-on" : "")}
                    aria-pressed={on}
                    onClick={() => toggle(pickedGenres, g, setPickedGenres)}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
            <div className="wl__actions">
              <button className="wl__back" onClick={() => setStep(0)}>Back</button>
              <button className="wl__next" onClick={goFromGenres}>
                {pickedGenres.size ? "Continue" : "Skip"}
              </button>
            </div>
          </section>
        )}

        {/* ---- step 2: favorites ---- */}
        {step === 2 && (
          <section className="wl__step">
            <h1 className="wl__h">Pick some favorites</h1>
            <p className="wl__p">
              Tap a few you love — they&apos;ll shape your recs and show on your profile.{" "}
              <span className="wl__count">{favs.size}/{MAX_FAVS}</span>
            </p>
            {loadingTitles ? (
              <div className="wl__loading">Finding titles…</div>
            ) : (
              <div className="wl__grid">
                {titles.map((t) => {
                  const on = favs.has(t.id);
                  const atCap = !on && favs.size >= MAX_FAVS;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={"wl__poster" + (on ? " is-on" : "") + (atCap ? " is-dim" : "")}
                      aria-pressed={on}
                      onClick={() => toggle(favs, t.id, setFavs, MAX_FAVS)}
                      title={t.title}
                    >
                      <div className="wl__poster-art">
                        {t.cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
                        ) : (
                          <div className="wl__poster-gen" style={genPoster(t.id)} aria-hidden="true" />
                        )}
                        {on && (
                          <span className="wl__poster-check" aria-hidden="true">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                          </span>
                        )}
                      </div>
                      <span className="wl__poster-title">{t.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="wl__actions">
              <button className="wl__back" onClick={() => setStep(1)}>Back</button>
              <button className="wl__next" onClick={() => setStep(3)}>
                {favs.size ? "Continue" : "Skip"}
              </button>
            </div>
          </section>
        )}

        {/* ---- step 3: people ---- */}
        {step === 3 && (
          <section className="wl__step">
            <h1 className="wl__h">Follow a few people</h1>
            <p className="wl__p">Their reviews and activity fill your feed. You can always find more later.</p>
            {people.length === 0 ? (
              <div className="wl__loading">You&apos;re early — no one to suggest yet. That&apos;s okay!</div>
            ) : (
              <ul className="wl__people">
                {people.map((u) => {
                  const on = follows.has(u.id);
                  return (
                    <li key={u.id} className="wl__person">
                      {u.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="wl__pava" src={u.image} alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <span className={"wl__pava wl__pava--gen rec-hue-" + hueOf(u.username)} aria-hidden="true">
                          {(u.name || u.username).charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="wl__pbody">
                        <span className="wl__pname">{u.name || u.username}</span>
                        <span className="wl__pmeta">@{u.username}{u.followers ? ` · ${u.followers} follower${u.followers === 1 ? "" : "s"}` : ""}</span>
                      </span>
                      <button
                        type="button"
                        className={"wl__followbtn" + (on ? " is-on" : "")}
                        aria-pressed={on}
                        onClick={() => toggle(follows, u.id, setFollows)}
                      >
                        {on ? "Following" : "Follow"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="wl__actions">
              <button className="wl__back" onClick={() => setStep(2)}>Back</button>
              <button className="wl__next" onClick={finish} disabled={finishing}>
                {finishing ? "Setting up…" : "Enter Kokoro"}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
