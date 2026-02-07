const CACHE_VERSION = "v14-20260207-phase2";
const CACHE_NAME = `wts-cache-${CACHE_VERSION}`;
const SHELL_URL = "/index.html";
const CRITICAL_ASSETS = [
  "/",
  "/index.html",
  "/gateway.js",
  "/app.js",
  "/access-gate.js",
  "/manifest.webmanifest",
  "/assets/brand/logo-en.png",
  "/assets/brand/logo-es.png",
  "/assets/pwa/icon-192.png",
  "/assets/pwa/icon-512.png",
];

// Network-first files (always check server first)
const NETWORK_FIRST_FILES = [
  "/gateway.js",
  "/app.js",
  "/access-gate.js",
  "/index.html",
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
    }).then(() => self.clients.claim())
  );
});

// OPTIMIZATION: Intelligent caching strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin || url.hostname.includes("localhost");

  if (request.mode === "navigate" && sameOrigin) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(SHELL_URL, response.clone()));
          return response;
        })
        .catch(() => caches.match(SHELL_URL))
    );
    return;
  }

  if (!sameOrigin) return;

  const pathname = url.pathname;
  const isNetworkFirst = NETWORK_FIRST_FILES.some((file) => pathname === file || pathname.endsWith(file));

  if (isNetworkFirst) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (/\.(webp|png|jpg|jpeg|gif|svg)$/i.test(pathname)) {
    event.respondWith(cacheFirst(request));
  } else if (pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(networkFirst(request));
  }
});

function networkFirst(request) {
  return fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
      }
      return networkResponse;
    })
    .catch(() => caches.match(request) || new Response("Offline", { status: 503 }));
}

function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse.clone()));
      }
      return networkResponse;
    });
  });
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Changes (2026-02-06):
// - CACHE_VERSION remains explicit for predictable cache busting.
// - activate now deletes old caches and claims clients within waitUntil for immediate control.
// - skipWaiting is already used on install to activate new SW without user refresh.
