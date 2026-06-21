import "./event-banner.css";
import { getActiveBanner } from "@/lib/banners";
import { EventBannerView } from "./EventBannerView";

// Full-bleed event banner at the top of Home (Steam-style). Renders nothing
// when there's no active banner within its schedule window.
export async function EventBanner() {
  const b = await getActiveBanner();
  if (!b) return null;
  return (
    <EventBannerView
      banner={{
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        ctaLabel: b.ctaLabel,
        ctaHref: b.ctaHref,
        image: b.image,
        accent: b.accent,
      }}
    />
  );
}
