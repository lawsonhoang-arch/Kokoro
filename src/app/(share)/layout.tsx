import type { Metadata } from "next";

// Public share pages — a separate root layout (its own <html>/<body>), no auth
// gate and no app nav, but the app's dark palette so profiles look themselves.
import "@/styles/tokens.css";
import "@/styles/base.css";

import { FontLinks } from "@/components/FontLinks";

export const metadata: Metadata = {
  title: "Kokoro",
  description: "A flexible anime & manga tracker — rate by feeling, sculpt your lists, keep a private journal.",
};

export default function ShareLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-font="nunito">
      <body>
        <FontLinks />
        {children}
      </body>
    </html>
  );
}
