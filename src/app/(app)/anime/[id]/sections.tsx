import type { CSSProperties } from "react";
import Link from "next/link";
import { getTitleCast, getTitleStaff, getTitleStudios, getTitleSuggestions, getTitleTrailerId } from "@/lib/titleExtras";
import { followedEntitySet } from "@/lib/entities";
import { FollowEntityButton } from "@/features/entities/FollowEntityButton";
import { TrailerEmbed } from "./TrailerEmbed";

function gen(seed: string): CSSProperties {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  h = Math.abs(h);
  const a = h % 360;
  return { backgroundImage: `linear-gradient(135deg, oklch(0.5 0.13 ${a}), oklch(0.34 0.12 ${(a + 40) % 360}))` };
}

function initials(name: string): string {
  return name.split(/[\s,]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// ---- Characters & voice actors -----------------------------------------
export async function TitleCast({ kind, malId }: { kind: string; malId: number }) {
  const cast = await getTitleCast(kind, malId).catch(() => null);
  if (!cast || cast.length === 0) return null;
  const anime = kind !== "manga";
  return (
    <section className="anime-section ax">
      <h2 className="ax__head">{anime ? "Characters & voice actors" : "Characters"}</h2>
      <div className="ax-cast">
        {cast.map((c, i) => {
          const main = (
            <>
              <span className="ax-face" aria-hidden={c.image ? undefined : "true"}>
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt="" referrerPolicy="no-referrer" loading="lazy" />
                ) : (
                  <span className="ax-face__ph" style={gen(c.name)}>{initials(c.name)}</span>
                )}
              </span>
              <div className="ax-char__body">
                <span className="ax-char__name">{c.name}</span>
                <span className="ax-char__role">{c.role || "Character"}</span>
              </div>
            </>
          );
          return (
          <div key={i} className="ax-char">
            {c.charId ? (
              <Link className="ax-char__main ax-char__main--link" href={`/character/${c.charId}`} title={`${c.name} — view character`}>{main}</Link>
            ) : (
              <div className="ax-char__main">{main}</div>
            )}
            {anime && c.vaName && (
              c.vaId ? (
                <Link className="ax-char__va ax-char__va--link" href={`/person/${c.vaId}`} title={`${c.vaName} — voice actor`}>
                  <span className="ax-char__vaname">{c.vaName}</span>
                  <span className="ax-face ax-face--sm">
                    {c.vaImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.vaImage} alt="" referrerPolicy="no-referrer" loading="lazy" />
                    ) : (
                      <span className="ax-face__ph" style={gen(c.vaName)}>{initials(c.vaName)}</span>
                    )}
                  </span>
                </Link>
              ) : (
                <div className="ax-char__va">
                  <span className="ax-char__vaname">{c.vaName}</span>
                  <span className="ax-face ax-face--sm">
                    {c.vaImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.vaImage} alt="" referrerPolicy="no-referrer" loading="lazy" />
                    ) : (
                      <span className="ax-face__ph" style={gen(c.vaName)}>{initials(c.vaName)}</span>
                    )}
                  </span>
                </div>
              )
            )}
          </div>
          );
        })}
      </div>
    </section>
  );
}

// ---- Staff (anime only) -------------------------------------------------
export async function TitleStaff({ malId }: { malId: number }) {
  const staff = await getTitleStaff(malId).catch(() => null);
  if (!staff || staff.length === 0) return null;
  return (
    <section className="anime-section ax">
      <h2 className="ax__head">Staff</h2>
      <div className="ax-staff">
        {staff.map((s, i) => {
          const inner = (
            <>
              <span className="ax-face ax-face--sm">
                {s.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image} alt="" referrerPolicy="no-referrer" loading="lazy" />
                ) : (
                  <span className="ax-face__ph" style={gen(s.name)}>{initials(s.name)}</span>
                )}
              </span>
              <div className="ax-char__body">
                <span className="ax-char__name">{s.name}</span>
                {s.role && <span className="ax-char__role">{s.role}</span>}
              </div>
            </>
          );
          return s.id ? (
            <Link key={i} className="ax-person ax-person--link" href={`/person/${s.id}`}>{inner}</Link>
          ) : (
            <div key={i} className="ax-person">{inner}</div>
          );
        })}
      </div>
    </section>
  );
}

// ---- Studios (anime only) — followable ----------------------------------
export async function TitleStudios({ malId, viewerId }: { malId: number; viewerId?: string }) {
  const studios = await getTitleStudios(malId).catch(() => null);
  if (!studios || studios.length === 0) return null;
  const followed = await followedEntitySet(viewerId, studios.map((s) => ({ kind: "studio" as const, entityId: String(s.id) })));
  return (
    <section className="anime-section ax">
      <h2 className="ax__head">{studios.length > 1 ? "Studios" : "Studio"}</h2>
      <div className="ax-studios">
        {studios.map((s) => (
          <div key={s.id} className="ax-studio">
            <Link className="ax-studio__name" href={`/studio/${s.id}`}>{s.name}</Link>
            {viewerId && (
              <FollowEntityButton
                kind="studio"
                entityId={String(s.id)}
                name={s.name}
                image={null}
                subtitle="Studio"
                initialFollowing={followed.has("studio:" + s.id)}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- Suggestions --------------------------------------------------------
export async function TitleSuggestions({ kind, malId }: { kind: string; malId: number }) {
  const items = await getTitleSuggestions(kind, malId).catch(() => null);
  if (!items || items.length === 0) return null;
  return (
    <section className="anime-section ax">
      <h2 className="ax__head">You might also like</h2>
      <div className="ax-suggest">
        {items.map((s) => (
          <Link key={s.id} href={`/anime/${encodeURIComponent(s.id)}`} className="ax-sg">
            <span className="ax-sg__art">
              {s.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
              ) : (
                <span className="ax-sg__gen" style={gen(s.id)} aria-hidden="true" />
              )}
            </span>
            <span className="ax-sg__title">{s.title}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---- Trailer (anime only) — a click-to-play embed under the description --
export async function TitleTrailer({ malId }: { malId: number }) {
  const id = await getTitleTrailerId(malId).catch(() => null);
  if (!id) return null;
  return (
    <section className="anime-section ax">
      <h2 className="ax__head">Trailer</h2>
      <TrailerEmbed id={id} />
    </section>
  );
}
