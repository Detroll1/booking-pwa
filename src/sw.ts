/// <reference lib="webworker" />
import {cleanupOutdatedCaches, createHandlerBoundToURL, matchPrecache, precacheAndRoute} from 'workbox-precaching';
import {NavigationRoute, registerRoute} from 'workbox-routing';
import {NetworkOnly} from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope & {__WB_MANIFEST: Array<{url: string; revision: string | null}>};

// Each tenant gets its own worker scope (e.g. /s/<slug>/) and therefore its own
// cache namespace. The shared build is one set of files; isolation is by scope.
const scopePath = new URL(self.registration.scope).pathname;
const slug = scopePath.split('/').filter(Boolean).pop() ?? 'app';
const CACHE_PREFIX = `booking-${slug}`;

self.addEventListener('install', () => {
  void self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST, {cacheName: `${CACHE_PREFIX}-precache`});

// API calls, auth and anything private must never be cached in the worker.
registerRoute(
  ({url}) =>
    url.pathname.startsWith('/functions/') ||
    url.pathname.startsWith('/auth/') ||
    url.hostname.endsWith('supabase.co'),
  new NetworkOnly(),
);

// Deep links serve the studio shell: network first, cached shell offline.
registerRoute(
  new NavigationRoute(async ({request}) => {
    try {
      return await fetch(request);
    } catch {
      return (await matchPrecache('index.html')) ?? Response.error();
    }
  }),
);

void createHandlerBoundToURL;
