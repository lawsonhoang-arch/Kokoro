import Link from "next/link";
import type { FollowedEntity } from "@/lib/entities";

function href(e: FollowedEntity): string {
  if (e.kind === "studio") return `/studio/${e.entityId}`;
  if (e.kind === "character") return `/character/${e.entityId}`;
  return `/person/${e.entityId}`;
}
function initials(name: string): string {
  return name.split(/[\s,]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// A grid of the studios / people a user follows, on their profile.
export function FollowedEntities({ items, title = "Following", sub }: { items: FollowedEntity[]; title?: string; sub?: string }) {
  if (items.length === 0) return null;
  return (
    <section className="section">
      <header className="section__head">
        <div>
          <h3 className="section__title">{title}</h3>
          <div className="section__sub">{sub ?? "Studios, characters, voice actors & staff you follow"}</div>
        </div>
      </header>
      <div className="entgrid">
        {items.map((e) => (
          <Link key={e.kind + ":" + e.entityId} className="entcard" href={href(e)} title={e.name}>
            <span className={"entcard__art" + (e.kind === "person" ? " entcard__art--round" : "")}>
              {e.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.image} alt="" referrerPolicy="no-referrer" loading="lazy" />
              ) : (
                <span className="entcard__ph" aria-hidden="true">{initials(e.name)}</span>
              )}
            </span>
            <span className="entcard__name">{e.name}</span>
            <span className="entcard__sub">{e.subtitle || (e.kind === "studio" ? "Studio" : e.kind === "character" ? "Character" : "Person")}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
