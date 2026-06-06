import type { Metadata } from "next";

// Auth pages get their own minimal root layout: the shared design tokens, but
// no SiteNav / app shell. Separate root layout = isolated from the (app) group.
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/shell.css";
import "./auth.css";

import { FontLinks } from "@/components/FontLinks";

export const metadata: Metadata = {
  title: "Sign in · Kokoro",
};

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <FontLinks />
        <main className="auth">{children}</main>
      </body>
    </html>
  );
}
