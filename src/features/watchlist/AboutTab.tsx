"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DescriptionSection } from "@/features/submissions/DescriptionSection";
import {
  getTitleAboutAction,
  getTitleAboutExtrasAction,
  type TitleAbout,
  type TitleAboutExtras,
} from "./aboutActions";

/** The "About" half of a detail surface: the same catalog material the
 *  /anime/[id] page shows (description, cast, staff, studios, trailer,
 *  suggestions). Loaded lazily the first time the tab is opened. */
export function AboutTab({ titleId }: { titleId: string | null }) {
  const [data, setData] = useState<TitleAbout | null>(null);
  // Staff, trailer and suggestions arrive separately so the top of the tab is
  // not held hostage to three extra rate-limited requests.
  const [extras, setExtras] = useState<TitleAboutExtras | null>(null);
  // start in "loading" rather than flipping it inside the effect — the panel is
  // keyed per entry, so this mounts fresh for each title anyway
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    titleId ? "loading" : "idle",
  );

  useEffect(() => {
    if (!titleId) return;
    let alive = true;
    getTitleAboutAction(titleId)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setState("done");
        // only chase the rest when there is something to chase it with
        if (d?.malId) {
          getTitleAboutExtrasAction(titleId)
            .then((x) => { if (alive) setExtras(x); })
            .catch(() => {});
        }
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [titleId]);

  if (!titleId) {
    return <p className="k-about__empty">This title isn’t linked to the catalogue, so there’s nothing to show here yet.</p>;
  }

  return (
    <div className="k-about">
      <DescriptionSection titleId={titleId} />

      {state === "loading" && <p className="k-about__empty">Loading details…</p>}
      {state === "error" && <p className="k-about__empty">Couldn’t load the details just now.</p>}

      {state === "done" && data && (
        <>
          {data.synopsis && (
            <section className="k-about__sec">
              <h4 className="k-about__h">Synopsis</h4>
              <p className="k-about__body">{data.synopsis}</p>
            </section>
          )}

          {data.studios.length > 0 && (
            <section className="k-about__sec">
              <h4 className="k-about__h">Studios</h4>
              <div className="k-about__chips">
                {data.studios.map((s) => (
                  <span key={s.id} className="k-tag">{s.name}</span>
                ))}
              </div>
            </section>
          )}

          {data.cast.length > 0 && (
            <section className="k-about__sec">
              <h4 className="k-about__h">Cast</h4>
              <ul className="k-about__people">
                {data.cast.slice(0, 12).map((c, i) => (
                  <li key={c.charId ?? c.name + i} className="k-about__person">
                    {c.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
                    )}
                    <span className="k-about__pname">{c.name}</span>
                    {c.vaName ? (
                      <span className="k-about__prole">{c.role} · {c.vaName}</span>
                    ) : (
                      c.role && <span className="k-about__prole">{c.role}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {extras && extras.staff.length > 0 && (
            <section className="k-about__sec">
              <h4 className="k-about__h">Staff</h4>
              <ul className="k-about__people">
                {extras.staff.slice(0, 8).map((s, i) => (
                  <li key={s.id ?? s.name + i} className="k-about__person">
                    {s.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
                    )}
                    <span className="k-about__pname">{s.name}</span>
                    {s.role && <span className="k-about__prole">{s.role}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {extras?.trailerId && (
            <section className="k-about__sec">
              <h4 className="k-about__h">Trailer</h4>
              <a
                className="k-about__link"
                href={`https://www.youtube.com/watch?v=${extras.trailerId}`}
                target="_blank"
                rel="noreferrer"
              >
                Watch on YouTube ↗
              </a>
            </section>
          )}

          {extras && extras.suggestions.length > 0 && (
            <section className="k-about__sec">
              <h4 className="k-about__h">If you liked this</h4>
              <div className="k-about__chips">
                {extras.suggestions.slice(0, 10).map((s) => (
                  <Link key={s.id} href={`/anime/${s.id}`} className="k-tag k-about__sugg">
                    {s.title}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
