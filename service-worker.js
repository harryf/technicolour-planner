/* =========================================================================
   Technicolour Planner, service worker (access withdrawn, v3.0.0).
   Job: replace the cached app on every installed copy with the Access Denied
   page, serve that page offline, and refuse every other file.
   ========================================================================= */

// Bump this string on every release (matches the in-app VERSION constant).
const VERSION = "3.0.0";
const CACHE = "technicolour-v" + VERSION;

// The only files still served.
const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
];
const ALLOWED = new Set(SHELL.map((u) => new URL(u, self.location.href).pathname));

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        SHELL.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch((err) => console.warn("[sw] precache miss:", url, err && err.message))
        )
      )
    )
  );
});

self.addEventListener("activate", (event) => {
  // Drop every older cache (the old app shell and export libraries), then take control.
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

function denied() {
  return new Response("Access Denied", {
    status: 403,
    statusText: "Forbidden",
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      // Every navigation lands on the Access Denied page, online or offline.
      if (req.mode === "navigate") {
        const shell = (await caches.match("index.html")) || (await caches.match("./"));
        if (shell) return shell;
        try { return await fetch(new Request("index.html", { cache: "reload" })); } catch (e) { return denied(); }
      }
      if (req.method !== "GET" || !ALLOWED.has(url.pathname)) return denied();
      const cached = await caches.match(req, { ignoreSearch: true });
      if (cached) return cached;
      try { return await fetch(req); } catch (e) { return denied(); }
    })()
  );
});
