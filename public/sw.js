// checkIn PWA Service Worker (v3 - Deployment Resilience & WASM Cache)
const CACHE_NAME = 'checkin-v3';
const STATIC_ASSETS = [
  '/',
  '/logo.svg',
  '/favicon.ico',
  '/manifest.json',
  '/wasm/camera_utils.js',
  '/wasm/face_mesh.js',
  '/wasm/face_mesh.binarypb',
  '/wasm/face_mesh_solution_packed_assets.data',
  '/wasm/face_mesh_solution_packed_assets_loader.js',
  '/wasm/face_mesh_solution_simd_wasm_bin.data',
  '/wasm/face_mesh_solution_simd_wasm_bin.js',
  '/wasm/face_mesh_solution_simd_wasm_bin.wasm',
  '/wasm/face_mesh_solution_wasm_bin.js',
  '/wasm/face_mesh_solution_wasm_bin.wasm',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching completed with warnings:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Bypass SW for all API requests
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. Network-first strategy for Next.js build chunks (/_next/) and navigation requests
  // This ensures new Vercel deployments immediately serve fresh static chunks matching the new build.
  if (url.pathname.startsWith('/_next/') || event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            if (event.request.mode === 'navigate') {
              return caches.match('/');
            }
          });
        })
    );
    return;
  }

  // 3. Stale-while-revalidate for local WASM assets & static images
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
