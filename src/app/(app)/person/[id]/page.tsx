import "@/styles/entity.css";
import Link from "next/link";
import { auth } from "@/auth";
import { Page } from "@/shell/Page";
import { BackButton } from "@/components/BackButton";
import { getPerson, type PersonRole } from "@/lib/titleExtras";
import { isFollowingEntity } from "@/lib/entities";
import { FollowEntityButton } from "@/features/entities/FollowEntityButton";

function WorkCard({ r }: { r: PersonRole }) {
  const inner = (
    <>
      <span className="ework__art">
        {r.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
        )}
      </span>
      <span className="ework__title">{r.title}</span>
      <span className="ework__sub">
        {r.character ? <span className="ework__char">{r.character}</span> : null}
        {r.character && r.role ? " · " : ""}
        {r.role}
      </span>
    </>
  );
  return r.titleId ? (
    <Link className="ework" href={`/anime/${encodeURIComponent(r.titleId)}`}>{inner}</Link>
  ) : (
    <div className="ework" style={{ cursor: "default" }}>{inner}</div>
  );
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const malId = parseInt(id, 10);
  const session = await auth();
  const viewerId = session?.user?.id;

  const person = Number.isFinite(malId) ? await getPerson(malId).catch(() => null) : null;

  if (!person) {
    return (
      <Page width="narrow">
        <p className="epage__empty">
          This person couldn&apos;t be loaded right now — MyAnimeList may be unavailable. <Link href="/community">Back to community</Link>.
        </p>
      </Page>
    );
  }

  const following = await isFollowingEntity(viewerId, "person", String(person.id));
  const kindLabel = person.roles.length > 0 ? "Voice actor" : "Staff";

  return (
    <Page width="wide">
      <BackButton />
      <header className="epage__hero">
        {person.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="epage__photo" src={person.image} alt={person.name} referrerPolicy="no-referrer" />
        ) : (
          <span className="epage__photo epage__photo--empty" aria-hidden="true">{person.name.slice(0, 1)}</span>
        )}
        <div className="epage__meta">
          <div className="epage__eyebrow">{kindLabel}</div>
          <h1 className="epage__name">{person.name}</h1>
          <div className="epage__stats">
            {person.favorites > 0 && <span>♥ {person.favorites.toLocaleString()} favorites</span>}
            {person.roles.length > 0 && <span>{person.roles.length} roles</span>}
          </div>
          <div className="epage__actions">
            {viewerId && (
              <FollowEntityButton
                kind="person"
                entityId={String(person.id)}
                name={person.name}
                image={person.image}
                subtitle={kindLabel}
                initialFollowing={following}
                size="lg"
              />
            )}
          </div>
        </div>
      </header>

      {person.about && <p className="epage__about epage__about--clamp">{person.about.trim()}</p>}

      {person.roles.length > 0 && (
        <>
          <h2 className="epage__sectitle">Roles</h2>
          <div className="ework-grid">
            {person.roles.map((r) => <WorkCard key={r.malId + ":" + (r.character ?? "")} r={r} />)}
          </div>
        </>
      )}
    </Page>
  );
}
