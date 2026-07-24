import type { MetadataRoute } from "next";

// Web app manifest — makes Kokoro installable to the home screen (served at
// /manifest.webmanifest). Colors match the app's warm-dark theme.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Kokoro — anime & manga tracker",
    short_name: "Kokoro",
    description:
      "Track the anime and manga you love: sculpt your lists your way, rate by feeling, and keep a private journal.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#17110e",
    theme_color: "#17110e",
    categories: ["entertainment", "lifestyle", "books"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
