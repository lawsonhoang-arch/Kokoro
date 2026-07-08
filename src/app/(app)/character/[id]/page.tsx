import "@/styles/entity.css";
import Link from "next/link";
import { auth } from "@/auth";
import { Page } from "@/shell/Page";
import { getCharacter, type CharacterAppearance, type CharacterVoice } from "@/lib/titleExtras";
import { isFollowingEntity } from "@/lib/entities";
import { FollowEntityButton } from "@/features/entities/FollowEntityButton";

function AppearanceCard({ r }: { r: CharacterAppearance }) {
  const inner = (
    <>
      <span className="ework__art">
        {r.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
        )}
      </span>
      <span className="ework__title">{r.title}</span>
      {r.role && <span className="ework__sub">{r.role}</span>}
    </>
  );
  return r.titleId ? (
    <Link className="ework" href={`/anime/${encodeURIComponent(r.titleId)}`}>{inner}</Link>
  ) : (
    <div className="ework" style={{ cursor: "default" }}>{inner}</div>
  );
}

function VoiceChip({ v }: { v: CharacterVoice }) {
  const inner = (
    <>
      <span className="evoice__face">
        {v.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.image} alt="" referrerPolicy="no-referrer" loading="lazy" />
        ) : (
          <span className="evoice__face-ph">{v.name.slice(0, 1)}</span>
        )}
      </span>
      <span className="evoice__txt">
        <span className="evoice__name">{v.name}</span>
        {v.language && <span className="evoice__lang">{v.language}</span>}
      </span>
    </>
  );
  return v.id ? (
    <Link className="evoice evoice--link" href={`/person/${v.id}`}>{inner}</Link>
  ) : (
    <div className="evoice">{inner}</div>
  );
}

export default async function CharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const malId = parseInt(id, 10);
  const session = await auth();
  const viewerId = session?.user?.id;

  const character = Number.isFinite(malId) ? await getCharacter(malId).catch(() => null) : null;

  if (!character) {
    return (
      <Page width="narrow">
        <p className="epage__empty">
          This character couldn&apos;t be loaded right now — MyAnimeList may be unavailable. <Link href="/community">Back to community</Link>.
        </p>
      </Page>
    );
  }

  const following = await isFollowingEntity(viewerId, "character", String(character.id));

  return (
    <Page width="wide">
      <header className="epage__hero">
        {character.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="epage__photo" src={character.image} alt={character.name} referrerPolicy="no-referrer" />
        ) : (
          <span className="epage__photo epage__photo--empty" aria-hidden="true">{character.name.slice(0, 1)}</span>
        )}
        <div className="epage__meta">
          <div className="epage__eyebrow">Character</div>
          <h1 className="epage__name">{character.name}</h1>
          <div className="epage__stats">
            {character.favorites > 0 && <span>♥ {character.favorites.toLocaleString()} favorites</span>}
            {character.appearances.length > 0 && <span>{character.appearances.length} appearances</span>}
          </div>
          <div className="epage__actions">
            {viewerId && (
              <FollowEntityButton
                kind="character"
                entityId={String(character.id)}
                name={character.name}
                image={character.image}
                subtitle="Character"
                initialFollowing={following}
                size="lg"
              />
            )}
          </div>
        </div>
      </header>

      {character.about && <p className="epage__about epage__about--clamp">{character.about.trim()}</p>}

      {character.voices.length > 0 && (
        <>
          <h2 className="epage__sectitle">Voiced by</h2>
          <div className="evoices">
            {character.voices.map((v, i) => <VoiceChip key={(v.id ?? "x") + ":" + i} v={v} />)}
          </div>
        </>
      )}

      {character.appearances.length > 0 && (
        <>
          <h2 className="epage__sectitle">Appears in</h2>
          <div className="ework-grid">
            {character.appearances.map((r) => <AppearanceCard key={r.malId} r={r} />)}
          </div>
        </>
      )}
    </Page>
  );
}
