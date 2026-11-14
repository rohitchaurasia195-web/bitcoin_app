const CACHE = "btc-v1";
const SHELL = [
  "./",
  "index.html",
  "more.js",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "data/btc.json",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
