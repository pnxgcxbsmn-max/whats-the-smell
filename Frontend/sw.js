const CACHE_VERSION = "v4-20240126";
const CACHE_NAME = `wts-cache-${CACHE_VERSION}`;
const CRITICAL_ASSETS = [
  "/",
  "/index.html",
  "/app.js",
  "/access-gate.js",
  "/manifest.json",
  "/assets/brand/logo-en.png",
];

// Pre-cache critical assets on install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Caching critical assets...");
      return cache.addAll(CRITICAL_ASSETS).catch(err => {
        console.warn("[SW] Some assets failed to cache:", err.message);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("[SW] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// OPTIMIZATION: Intelligent caching strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  if (url.hostname !== self.location.hostname && !url.hostname.includes("localhost")) {
    return;
  }

  // STRATEGY 1: Images - Cache first, fallback to network
  if (/\.(webp|png|jpg|jpeg|gif|svg)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((response) => {
        return (
          response ||
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
          })
        );
      })
    );
  }
  // STRATEGY 2: API calls - Network first, fallback to cache
  else if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request) || new Response("Offline", { status: 503 });
        })
    );
  }
  // STRATEGY 3: HTML/JS/CSS - Network first for fresh content
  else {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request) || new Response("Offline", { status: 503 });
        })
    );
  }
});
