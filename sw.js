// Offline cache. Bump VERSION whenever any file changes so phones pick up the new copy.
const VERSION = "budget-v1";
const FILES = [
  "./",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "js/app.js",
  "js/nav.js",
  "js/store.js",
  "js/format.js",
  "js/csv.js",
  "js/ui.js",
  "js/screens/home.js",
  "js/screens/reports.js",
  "js/screens/budgets.js",
  "js/screens/people.js",
  "js/screens/person.js",
  "js/screens/history.js",
  "js/screens/entry.js",
  "fonts/inter.ttf",
  "fonts/manrope.ttf",
  "fonts/playfair_display.ttf",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Cache first, so the app opens offline; anything not cached comes from the network.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || fetch(event.request)),
  );
});
