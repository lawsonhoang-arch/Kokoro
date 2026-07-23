import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { needsOnboarding, getSuggestedPeople, getStarterTitles, ONBOARD_GENRES, HOME_FOCUS } from "@/lib/onboarding";
import { WelcomeClient } from "./WelcomeClient";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  // returning / already-onboarded users don't belong here
  if (!(await needsOnboarding(userId))) redirect("/home");

  const [people, starters] = await Promise.all([
    getSuggestedPeople(userId, 12),
    getStarterTitles([], 24), // default broad set; refined once they pick genres
  ]);

  const displayName = session.user.name || session.user.username || "";

  return (
    <WelcomeClient
      genres={[...ONBOARD_GENRES]}
      focusOptions={HOME_FOCUS.map((f) => ({ key: f.key, label: f.label, hint: f.hint }))}
      initialName={displayName}
      people={people}
      initialTitles={starters}
    />
  );
}
