const CACHE_NAME = 'ce-cc-v8';
const SHELL_ASSETS = ['/', '/index.html', '/manifest.webmanifest'];
const STATIC_ASSET_PATHS = new Set([
  ...SHELL_ASSETS,
  '/styles.css',
  '/ethers.umd.min.js',
  '/passkey-wallet-derivation.mjs',
]);
const STATIC_ASSET_PREFIXES = ['/js/'];
const NAVIGATION_FALLBACK_URL = '/index.html';

const isCacheableRequest = (request, url) => {
  if (url.pathname.startsWith('/api/')) return false;
  if (request.method !== 'GET' || url.origin !== self.location.origin) return false;
  return request.mode === 'navigate'
    || STATIC_ASSET_PATHS.has(url.pathname)
    || STATIC_ASSET_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
};

const isCacheableResponse = (response) => !!response && response.ok;

const putResponseInCache = async (request, response) => {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
};

const getCachedResponse = async (request) => {
  const cached = await caches.match(request);
  if (cached) return cached;

  // SPA deep links are not cached by their exact pathname, so offline
  // navigations need the cached app shell instead of failing closed.
  if (request?.mode === 'navigate') {
    return caches.match(new URL(NAVIGATION_FALLBACK_URL, self.location.origin).toString());
  }

  return null;
};

const fetchWithCacheFallback = async (request) => {
  try {
    const response = await fetch(request);
    // Regression guard: don't pin stale or broken assets forever.
    if (isCacheableResponse(response)) {
      await putResponseInCache(request, response);
    }
    return response;
  } catch (error) {
    const cached = await getCachedResponse(request);
    if (cached) return cached;
    throw error;
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (!isCacheableRequest(event.request, url)) {
    return;
  }

  event.respondWith(fetchWithCacheFallback(event.request));
});
