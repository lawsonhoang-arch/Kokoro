"use client";

import { useEffect } from "react";

// Rendered at the end of the streamed Home content. When it mounts, the Home
// data has resolved and the DOM is in place, so it signals the WelcomeOverlay
// (which is waiting) that it's safe to fade out and reveal a fully-loaded page.
// Sets a window flag too, in case the overlay subscribes after this fires.
export function HomeReadyBeacon() {
  useEffect(() => {
    (window as unknown as { __kokoroHomeReady?: boolean }).__kokoroHomeReady = true;
    window.dispatchEvent(new Event("kokoro:home-ready"));
  }, []);
  return null;
}
