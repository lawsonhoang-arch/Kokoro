import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables React's <ViewTransition> + Link transitions, used for the
  // cross-page crossfade in the (app) shell and the watchlist morphs.
  experimental: {
    viewTransition: true,
  },
  async headers() {
    return [
      {
        // the service worker must never be cached, so installs pick up updates
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
