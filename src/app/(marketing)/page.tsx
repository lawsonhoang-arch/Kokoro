// Marketing landing. The static markup plus all interactive behaviors
// (parallax, reveal-on-scroll, font picker, sculpt token tilt, smooth-scroll)
// live in the client island below — the page itself is a thin Server Component.
import { auth } from "@/auth";
import LandingClient from "./LandingClient";

export default async function LandingPage() {
  const session = await auth();
  return <LandingClient signedIn={!!session?.user} />;
}
