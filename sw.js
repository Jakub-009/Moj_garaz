/* Czas pracy — Next | GitHub Pages: /Moj_garaz/
 * Offline shell with network-first updates. This worker touches only its own cache
 * and the one confirmed legacy cache of the app formerly hosted at this path.
 */
"use strict";

const BASE = "/Moj_garaz/";
const CACHE_PREFIX = "czas-pracy-next-moj-garaz-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const LEGACY_CACHE_NAME = "moj-garaz-pwa-v1-2-0";

const APP_SHELL = `${BASE}index.html`;
const PRECACHE = [
  BASE,
  APP_SHELL,
  `${BASE}manifest.webmanifest`,
  `${BASE}icon-192.png`,
  `${BASE}icon-512.png`
];
const CACHEABLE_PATHS = new Set(PRECACHE);

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Installation fails safely if the HTML, manifest or existing icons are missing.
    await cache.addAll(PRECACHE);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) =>
        (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) ||
        key === LEGACY_CACHE_NAME
      )
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request, cacheKey, event) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(
        caches.open(CACHE_NAME)
          .then((cache) => cache.put(cacheKey, copy))
          .catch(() => { /* Cache failures must not block the online app. */ })
      );
    }
    return response;
  } catch {
    // Look up only in this app's cache, never in other apps' caches.
    const cache = await caches.open(CACHE_NAME);
    return (await cache.match(cacheKey)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  if (request.mode === "navigate") {
    // Both /Moj_garaz/ and /Moj_garaz/index.html work offline.
    event.respondWith(networkFirst(request, APP_SHELL, event));
    return;
  }

  // The monolithic application has no external JS/CSS to cache.
  // Avoid unbounded caching of arbitrary requests and query URLs.
  if (CACHEABLE_PATHS.has(url.pathname)) {
    event.respondWith(networkFirst(request, url.pathname, event));
  }
});
