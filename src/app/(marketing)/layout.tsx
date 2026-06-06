import type { Metadata } from "next";

// The marketing landing is a SEPARATE root layout: it ships its own palette,
// body styles, and font-switcher (landing.css redefines :root and body), so it
// must stay isolated from the app shell. Crossing this boundary triggers a full
// reload, which is the right behavior at the landing → app seam.
import "@/styles/landing.css";

import { FontLinks } from "@/components/FontLinks";

export const metadata: Metadata = {
  title: "Kokoro — organize your lists your way",
  description:
    "A flexible anime & manga tracker. Rate by feeling, sculpt your lists however helps you, and keep a private journal.",
};

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-font="nunito">
      <body>
        <FontLinks />
        {children}
      </body>
    </html>
  );
}
