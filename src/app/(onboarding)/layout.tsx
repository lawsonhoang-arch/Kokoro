import type { Metadata } from "next";

// The first-run flow gets its own minimal root layout — design tokens, but no
// SiteNav / app shell — so it's a focused, full-screen experience. Separate root
// layout keeps it isolated from the (app) group.
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/shell.css";
import "./welcome/welcome.css";

import { FontLinks } from "@/components/FontLinks";

export const metadata: Metadata = {
  title: "Welcome · Kokoro",
};

export default function OnboardingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <FontLinks />
        {children}
      </body>
    </html>
  );
}
