/*
 * MGames 2026 service worker.
 *
 * Two jobs: keep the app usable when venue wifi drops, and receive push
 * notifications. Written by hand rather than generated — it is short enough to
 * read in one sitting, and a caching bug on the day would be worse than no
 * cache at all.
 */

const VERSION = "v1";
const SHELL_CACHE = `mgames-shell-${VERSION}`;
const DATA_CACHE = `mgames-data-${VERSION}`;

// Only the things that are useless to fetch twice. Pages themselves are
// deliberately not precached: they are server-rendered per request and a
// precached copy would go stale within minutes on event day.
const SHELL_ASSETS = ["/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      // A failed precache must not block activation — the app works fine
      // without it, and a stuck worker would be far worse.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("mgames-") && !k.endsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/**
 * Network-first for navigations, falling back to the last successful copy.
 *
 * Scores change all day, so a cache-first strategy would show yesterday's
 * numbers to somebody standing courtside. Network-first means they always get
 * live data when there is a connection, and the previous page rather than the
 * browser's offline error when there is not.
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache Supabase traffic or server actions — stale scores are the one
  // thing this must not serve.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(DATA_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached ?? caches.match("/") ?? Response.error()),
        ),
    );
    return;
  }

  // Immutable build output: safe to serve from cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});

/* ----------------------------------------------------------- push ------- */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "MGames 2026", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "MGames 2026";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    // Lets a follow-up on the same subject replace the earlier notification
    // rather than stacking three alerts about one match.
    tag: payload.tag || "mgames",
    renotify: Boolean(payload.tag),
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";

  // Focus an already-open tab rather than piling up new ones.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
