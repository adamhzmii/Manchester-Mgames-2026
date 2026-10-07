/*
 * MGames 2026 service worker.
 *
 * Two jobs: keep the app usable when venue wifi drops, and receive push
 * notifications. Written by hand rather than generated — it is short enough to
 * read in one sitting, and a caching bug on the day would be worse than no
 * cache at all.
 */

const VERSION = "v3";
const SHELL_CACHE = `mgames-shell-${VERSION}`;
const DATA_CACHE = `mgames-data-${VERSION}`;

// Only the things that are useless to fetch twice. Pages themselves are
// deliberately not precached: they are server-rendered per request and a
// precached copy would go stale within minutes on event day.
const SHELL_ASSETS = ["/icons/icon-192.png", "/icons/icon-512.png", "/brand/logo-mark.png"];

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
          blockedHere().then((blocked) =>
            blocked
              ? blockedPage(url)
              : caches
                  .match(request)
                  .then((cached) => cached ?? caches.match("/"))
                  .then((cached) => cached ?? Response.error()),
          ),
        ),
    );
    return;
  }

  // Immutable build output: safe to serve from cache first. /brand/ is in the
  // list because the header crest lives there — without it the one element on
  // every screen renders as a broken image the moment the venue wifi drops.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/")
  ) {
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

/* ------------------------------------------------- blocked network ------ */

/*
 * University of Manchester wifi (eduroam, and the University VPN) resets every
 * connection to manchestermgames.com — the campus firewall refuses newly
 * registered domains — while the same site at Vercel's own address gets
 * through. When a page cannot be fetched here but the backup answers, the
 * phone is not offline, this network is blocking us: say so, and take the
 * visitor to the same page on the backup with the teams they follow.
 *
 * Copies of the constants in src/lib/backup-site.ts; a worker cannot import
 * them.
 */
const BACKUP_ORIGIN = "https://manchester-mgames-2026.vercel.app";
const PRIMARY_HOSTS = ["manchestermgames.com", "www.manchestermgames.com"];
// Written by src/lib/use-favourite-teams.ts.
const PREFS_CACHE = "mgames26-prefs";
const FOLLOW_KEY = "/__mgames/follow";

function blockedHere() {
  if (!PRIMARY_HOSTS.includes(self.location.hostname)) return Promise.resolve(false);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  return fetch(`${BACKUP_ORIGIN}/icons/icon-192.png`, {
    mode: "no-cors",
    cache: "no-store",
    signal: controller.signal,
  })
    .then(() => true)
    .catch(() => false)
    .finally(() => clearTimeout(timer));
}

function followedTeams() {
  return caches
    .open(PREFS_CACHE)
    .then((cache) => cache.match(FOLLOW_KEY))
    .then((response) => (response ? response.json() : []))
    .then((ids) => (Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : []))
    .catch(() => []);
}

function blockedPage(url) {
  return followedTeams().then((teams) => {
    const target = new URL(url.pathname + url.search, BACKUP_ORIGIN);
    if (teams.length > 0) target.searchParams.set("follow", teams.join(","));
    const href = escapeHtml(target.toString());
    // Self-contained: nothing on this address can load, so no stylesheet,
    // font or image from it either.
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="4;url=${href}">
<title>Opening the backup link · MGames 2026</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #160f29; color: #f4f1fb; font: 16px/1.5 system-ui, -apple-system, sans-serif; }
  main { max-width: 420px; padding: 32px 24px; }
  .kicker { margin: 0 0 12px; color: #f2b630; font-size: 13px; font-weight: 700;
    letter-spacing: 0.12em; text-transform: uppercase; }
  h1 { margin: 0 0 12px; font-size: 26px; line-height: 1.15; }
  p { margin: 0 0 16px; color: #c9c2e0; }
  a.button { display: block; margin: 24px 0 12px; padding: 14px 16px; border-radius: 10px;
    background: #f2b630; color: #160f29; font-weight: 700; text-align: center; text-decoration: none; }
  .small { font-size: 14px; color: #a59dc3; word-break: break-all; }
</style>
</head>
<body>
<main>
  <p class="kicker">MGames 2026</p>
  <h1>Uni wifi (eduroam) blocks manchestermgames.com</h1>
  <p>Taking you to the backup link instead. It's the same site with the same live scores.</p>
  <a class="button" href="${href}">Open the backup link</a>
  <p class="small">${escapeHtml(BACKUP_ORIGIN.replace("https://", ""))}</p>
  <p class="small">Or turn off wifi and use mobile data.</p>
</main>
<script>setTimeout(function () { location.replace(${JSON.stringify(target.toString()).replace(/</g, "\\u003c")}); }, 2500);</script>
</body>
</html>`;
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  });
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

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
