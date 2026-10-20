// ===========================================================================
// Topnet Solutions Academy — Service Worker
// Simple caching strategy for offline support and performance
// ===========================================================================

const CACHE_NAME = 'topnet-academy-v1';
const STATIC_CACHE = 'topnet-static-v1';
const IMAGE_CACHE = 'topnet-images-v1';

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/logo-topnet.jpg',
];

// ---------------------------------------------------------------------------
// Install — pre-cache essential static assets
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Silently fail if some assets are not available yet
      });
    })
  );
  // Activate immediately without waiting for existing tabs to close
  self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Activate — clean up old caches
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAME, STATIC_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !currentCaches.includes(name))
          .map((name) => caches.delete(name))
      );
    })
  );
  // Take control of all open clients immediately
  self.clients.claim();
});

// ---------------------------------------------------------------------------
// Fetch — routing strategies
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip API calls in development
  if (url.pathname.startsWith('/api/')) {
    // Network-first for API calls
    event.respondWith(networkFirst(request, CACHE_NAME));
    return;
  }

  // Cache-first for images
  if (
    request.destination === 'image' ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/)
  ) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // Cache-first for static assets (CSS, JS, fonts)
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    url.pathname.match(/\.(css|js|woff2?|ttf|eot)$/) ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Network-first for HTML pages (navigation)
  if (request.destination === 'document' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request, CACHE_NAME));
    return;
  }

  // Default: network-first
  event.respondWith(networkFirst(request, CACHE_NAME));
});

// ---------------------------------------------------------------------------
// Strategy: Cache-first (for static assets and images)
// ---------------------------------------------------------------------------
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // If both cache and network fail, return a basic offline response
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

// ---------------------------------------------------------------------------
// Strategy: Network-first (for API calls and HTML pages)
// ---------------------------------------------------------------------------
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Fallback to cache when network fails
    const cached = await caches.match(request);
    if (cached) return cached;

    // For navigation requests, try to return the cached homepage as fallback
    if (request.destination === 'document' || request.headers.get('accept')?.includes('text/html')) {
      const fallback = await caches.match('/');
      if (fallback) return fallback;
    }

    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}
