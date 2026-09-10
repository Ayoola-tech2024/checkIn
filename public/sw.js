// checkIn PWA Service Worker (Offline WASM & Shell Cache)
const CACHE_NAME = 'checkin-v2';
const STATIC_ASSETS = [
  '/',
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
        console.warn('[SW] Some assets failed pre-caching:', err);
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
  // Never intercept API requests with static cache
  if (event.request.url.includes('/api/')) {
    return;
  }

  // Stale-while-revalidate for WASM and static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh version in background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
