/* Kokoro service worker — installability + a graceful offline screen.
 *
 * Deliberately conservative: it does NOT cache pages, API responses, or any
 * personalised/auth data (that would risk showing one user another's data or a
 * stale library). It only precaches a static offline fallback + the app icons,
 * and serves the fallback when a navigation fails because the device is offline.
 */
const VERSION = "kokoro-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only handle top-level page navigations; everything else (API, RSC, assets)
  // goes straight to the network so nothing dynamic is ever cached.
  if (req.mode !== "navigate") return;
  event.respondWith(
    fetch(req).catch(() => caches.match(OFFLINE_URL, { ignoreSearch: true })),
  );
});
