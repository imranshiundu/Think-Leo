/* Think Leo — offline service worker v5
 * ─────────────────────────────────────
 * The install contract: add it to the home screen, launch it, and it
 * works even with the Wi-Fi off. Strategy:
 *   · app shell + icons + audio  → precached at install
 *   · code (_next/*, js, css)    → NETWORK-FIRST, cached as offline fallback
 *                                  (v4 cached code first, so devices kept
 *                                  running the old build after every fix —
 *                                  the "still broken" bug)
 *   · music (/audio/*.mp3)       → cache-first, streamed from disk cache
 *   · navigations                → network-first, offline → cached "/"
 *   · /api/*                     → network-only (device log is fire-and-forget)
 *
 * v5 — code always comes from the network while the kid is online, so the
 * newest game reaches every phone on the very next launch; offline play
 * still falls back to the last-good copy. Installing v5 also deletes every
 * v1–v4 cache, forcing all devices onto fresh code.
 */
const VERSION = "think-leo-v5";
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

/** Fresh whenever online; last-good copy when offline. */
async function networkFirst(req, fallbackToShell = false) {
  const cache = await caches.open(VERSION);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    if (fallbackToShell) {
      const shell = await cache.match("/");
      if (shell) return shell;
    }
    return Response.error();
  }
}

/** Immutable goodies (icons, music): cache-first, fill on use. */
async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const fresh = await fetch(req);
  if (fresh && fresh.ok) cache.put(req, fresh.clone());
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // live network only

  // music + icons + manifest never change between builds → cache-first
  const isImmutable =
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/audio/") ||
    /\.(png|jpg|jpeg|svg|webp|mp3|webmanifest)$/.test(url.pathname);

  if (isImmutable) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // everything else (code, styles, navigations): NETWORK-FIRST.
  // Dev-mode chunks and freshly shipped fixes must NEVER be shadowed by a
  // cached copy — that was the whole v4 bug.
  event.respondWith(networkFirst(req, req.mode === "navigate"));
});
