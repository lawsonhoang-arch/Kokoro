import "@/styles/entity.css";
import Link from "next/link";
import { auth } from "@/auth";
import { Page } from "@/shell/Page";
import { BackButton } from "@/components/BackButton";
import { getStudio, type StudioWork } from "@/lib/titleExtras";
import { isFollowingEntity } from "@/lib/entities";
import { FollowEntityButton } from "@/features/entities/FollowEntityButton";

function WorkCard({ w }: { w: StudioWork }) {
  const inner = (
    <>
      <span className="ework__art">
        {w.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={w.cover} alt="" referrerPolicy="no-referrer" loading="lazy" />
        )}
      </span>
      <span className="ework__title">{w.title}</span>
      {w.year != null && <span className="ework__sub">{w.year}</span>}
    </>
  );
  return w.titleId ? (
    <Link className="ework" href={`/anime/${encodeURIComponent(w.titleId)}`}>{inner}</Link>
  ) : (
    <div className="ework" style={{ cursor: "default" }}>{inner}</div>
  );
}

export default async function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const malId = parseInt(id, 10);
  const session = await auth();
  const viewerId = session?.user?.id;

  const studio = Number.isFinite(malId) ? await getStudio(malId).catch(() => null) : null;

  if (!studio) {
    return (
      <Page width="narrow">
        <p className="epage__empty">
          This studio couldn&apos;t be loaded right now — MyAnimeList may be unavailable. <Link href="/community">Back to community</Link>.
        </p>
      </Page>
    );
  }

  const following = await isFollowingEntity(viewerId, "studio", String(studio.id));

  return (
    <Page width="wide">
      <BackButton />
      <header className="epage__hero">
        {studio.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="epage__photo epage__photo--sq" src={studio.image} alt={studio.name} referrerPolicy="no-referrer" />
        ) : (
          <span className="epage__photo epage__photo--sq epage__photo--empty" aria-hidden="true">{studio.name.slice(0, 1)}</span>
        )}
        <div className="epage__meta">
          <div className="epage__eyebrow">Studio</div>
          <h1 className="epage__name">{studio.name}</h1>
          <div className="epage__stats">
            {studio.count > 0 && <span>{studio.count.toLocaleString()} titles</span>}
          </div>
          <div className="epage__actions">
            {viewerId && (
              <FollowEntityButton
                kind="studio"
                entityId={String(studio.id)}
                name={studio.name}
                image={studio.image}
                subtitle="Studio"
                initialFollowing={following}
                size="lg"
              />
            )}
          </div>
        </div>
      </header>

      {studio.about && <p className="epage__about epage__about--clamp">{studio.about.trim()}</p>}

      {studio.works.length > 0 && (
        <>
          <h2 className="epage__sectitle">Notable works</h2>
          <div className="ework-grid">
            {studio.works.map((w) => <WorkCard key={w.malId} w={w} />)}
          </div>
        </>
      )}
    </Page>
  );
}
