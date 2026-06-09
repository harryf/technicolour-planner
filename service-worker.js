/* =========================================================================
   Sarah's Amazing Technicolour Planner, service worker.
   Job: make the app open offline after first load, and update cleanly.
   Strategy: precache the whole shell on install; serve cache-first; on a new
   version, wait politely (no auto-reload) until the page tells us to take over.
   ========================================================================= */

// Bump this string on every release (matches the in-app VERSION constant).
const VERSION = "1.1.2";
const CACHE = "technicolour-v" + VERSION;

// The full offline shell. Relative URLs so it works on the /technicolour-planner/ subpath.
const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "src/export.js",
  // Export libraries (lazy-used in the UI, but precached so exports also work offline).
  "vendor/exceljs.min.js",
  "vendor/docx.umd.js",
  "vendor/pptxgen.bundle.js",
];

self.addEventListener("install", (event) => {
  // Precache the shell, then activate right away so a new version applies on the next load.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // addAll is atomic; if a single file 404s the whole install fails, so add
      // individually and ignore misses (e.g. a vendor file not yet present in dev).
      // {cache:"reload"} bypasses the browser HTTP cache so a new version never precaches a stale
      // shell (GitHub Pages serves these with max-age=600). add individually so one 404 doesn't fail all.
      Promise.all(
        SHELL.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch((err) => console.warn("[sw] precache miss:", url, err && err.message))
        )
      )
    )
  );
});

self.addEventListener("activate", (event) => {
  // Drop old versioned caches, then take control of open clients.
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("technicolour-v") && k !== CACHE).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never cache writes
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // app makes no cross-origin runtime calls

  event.respondWith(
    (async () => {
      const cached = await caches.match(req, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const res = await fetch(req);
        // Runtime-cache successful same-origin responses so future loads are offline-safe.
        if (res && res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      } catch (err) {
        // Offline and uncached: for navigations, fall back to the app shell.
        if (req.mode === "navigate") {
          const shell = (await caches.match("index.html")) || (await caches.match("./"));
          if (shell) return shell;
        }
        throw err;
      }
    })()
  );
});
