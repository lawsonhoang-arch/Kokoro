import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables React's <ViewTransition> + Link transitions, used for the
  // cross-page crossfade in the (app) shell and the watchlist morphs.
  experimental: {
    viewTransition: true,
  },
};

export default nextConfig;
