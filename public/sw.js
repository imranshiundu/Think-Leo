/* Think Leo — offline service worker v4
 * ─────────────────────────────────────
 * The install contract: add it to the home screen, launch it, and it
 * works even with the Wi-Fi off. Strategy:
 *   · app shell + icons + audio  → precached at install
 *   · static assets (_next/*)    → cache-first (immutable, versioned)
 *   · music (/audio/*.mp3)       → cache-first, streamed from disk cache
 *   · navigations                → network-first, offline → cached "/"
 *   · /api/*                     → network-only (device log is fire-and-forget)
 *
 * v4 — new offline shell for LEO EGGS + a forced cache refresh so every
 * device leaves the old build behind (phones were still serving v3).
 */
const VERSION = "think-leo-v4";
const CORE = [
  "/",
  "/manifest.webmanifest",
  "/logo.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(CORE).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // live network only

  // immutable build assets + icons + music: cache-first, populate on use
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/audio/") ||
    /\.(css|js|png|jpg|jpeg|svg|webp|woff2?|webmanifest|mp3)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
            return res;
          })
      )
    );
    return;
  }

  // navigations: network-first so updates land, cache fallback so offline works
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/").then((hit) => hit || Response.error()))
    );
  }
});
