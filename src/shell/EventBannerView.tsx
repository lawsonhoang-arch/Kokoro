import type { CSSProperties } from "react";

export type BannerVM = {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string | null;
  image: string | null;
  accent: string | null;
};

// A permanent event banner — always shown whenever there's an active one. There
// is no dismiss control; it's a fixed part of the Home UI.
export function EventBannerView({ banner }: { banner: BannerVM }) {
  const style = banner.accent
    ? ({ "--banner-accent": banner.accent } as CSSProperties)
    : undefined;

  return (
    <aside className="evb" style={style} aria-label="Event">
      {banner.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="evb__bg" src={banner.image} alt="" referrerPolicy="no-referrer" />
      ) : null}
      <div className="evb__scrim" aria-hidden="true" />

      <div className="evb__content">
        <div className="evb__text">
          <h2 className="evb__title">{banner.title}</h2>
          {banner.subtitle ? <p className="evb__sub">{banner.subtitle}</p> : null}
        </div>
        {banner.ctaLabel ? (
          banner.ctaHref ? (
            <a className="evb__cta" href={banner.ctaHref}>{banner.ctaLabel}</a>
          ) : (
            <span className="evb__cta evb__cta--static">{banner.ctaLabel}</span>
          )
        ) : null}
      </div>
    </aside>
  );
}
