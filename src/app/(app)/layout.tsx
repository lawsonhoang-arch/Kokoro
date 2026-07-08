import type { Metadata } from "next";

// Shared design system, imported in this route group's ROOT layout (Next 16
// recommends global CSS only at the root). The (marketing) group is a separate
// root and loads its own landing.css, so the two never clash.
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/transitions.css";
import "@/styles/shell.css";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { FontLinks } from "@/components/FontLinks";
import { SiteNav } from "@/shell/SiteNav";
import { getUserAvatar } from "@/lib/profile";

export const metadata: Metadata = {
  title: {
    default: "Kokoro",
    template: "%s · Kokoro",
  },
  description:
    "A warm-dark anime & manga tracker + community app. Rate by feeling, sculpt your lists with rule tokens, and keep a private journal.",
};

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  // The whole app sits behind auth: the public landing (/) is the only way in
  // when signed out. Unauthenticated visitors to any (app) route go to /login.
  if (!session?.user) redirect("/login");

  // the chosen character avatar isn't in the JWT, so fetch it for the nav
  const avatar = session.user.id ? await getUserAvatar(session.user.id) : null;

  return (
    <html lang="en">
      <body>
        <FontLinks />
        {/* Nav lives in the persistent layout (not the template) so it stays
            anchored and never re-animates across navigations. */}
        <SiteNav user={{ ...session.user, image: avatar }} />
        {children}
      </body>
    </html>
  );
}
