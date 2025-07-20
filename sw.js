const CACHE_NAME = 'brumoutloud-cache-v2';
const STATIC_CACHE = 'brumoutloud-static-v2';
const DYNAMIC_CACHE = 'brumoutloud-dynamic-v2';

// Static assets that rarely change
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/js/main.js',
  '/faviconV2.png',
  '/progressflag.svg.png',
  '/manifest.json'
];

// Core pages for offline functionality
const CORE_PAGES = [
  '/events.html',
  '/all-venues.html',
  '/community.html',
  '/contact.html',
  '/promoter-tool.html',
  '/get-listed.html',
  '/privacy-policy.html',
  '/terms-and-conditions.html',
  '/terms-of-submission.html'
];

// External resources to cache
const EXTERNAL_RESOURCES = [
  'https://fonts.googleapis.com/css2?family=Anton&family=Poppins:wght@400;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      // Cache core pages
      caches.open(CACHE_NAME).then((cache) => {
        console.log('Service Worker: Caching core pages');
        return cache.addAll(CORE_PAGES);
      }),
      // Cache external resources
      caches.open(CACHE_NAME).then((cache) => {
        console.log('Service Worker: Caching external resources');
        return Promise.allSettled(
          EXTERNAL_RESOURCES.map(url => 
            cache.add(url).catch(err => console.log(`Failed to cache ${url}:`, err))
          )
        );
      })
    ]).then(() => {
      console.log('Service Worker: All caches populated');
      return self.skipWaiting(); // Activate immediately
    }).catch(err => {
      console.error('Service Worker: Installation failed', err);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  const cacheWhitelist = [CACHE_NAME, STATIC_CACHE, DYNAMIC_CACHE];
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!cacheWhitelist.includes(cacheName)) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all pages immediately
      self.clients.claim()
    ]).then(() => {
      console.log('Service Worker: Activated and ready');
    })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip cross-origin requests except for fonts and CDN resources
  if (url.origin !== location.origin && 
      !url.host.includes('fonts.googleapis.com') &&
      !url.host.includes('fonts.gstatic.com') &&
      !url.host.includes('cdnjs.cloudflare.com')) {
    return;
  }
  
  event.respondWith(handleFetch(request));
});

async function handleFetch(request) {
  const url = new URL(request.url);
  
  try {
    // Strategy 1: Cache First for static assets
    if (isStaticAsset(url.pathname)) {
      return await cacheFirst(request, STATIC_CACHE);
    }
    
    // Strategy 2: Network First for API calls and dynamic content
    if (isAPICall(url.pathname)) {
      return await networkFirst(request, DYNAMIC_CACHE);
    }
    
    // Strategy 3: Stale While Revalidate for pages
    if (isPageRequest(url.pathname)) {
      return await staleWhileRevalidate(request, CACHE_NAME);
    }
    
    // Strategy 4: Network First with Cache Fallback for everything else
    return await networkFirst(request, DYNAMIC_CACHE);
    
  } catch (error) {
    console.error('Service Worker: Fetch failed for', request.url, error);
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlineResponse = await caches.match('/offline.html');
      return offlineResponse || new Response('Offline', { status: 503 });
    }
    
    // Return cached version or generic error
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Network Error', { status: 503 });
  }
}

// Cache First strategy - good for static assets
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  const networkResponse = await fetch(request);
  if (networkResponse.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, networkResponse.clone());
  }
  return networkResponse;
}

// Network First strategy - good for dynamic content
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Stale While Revalidate strategy - good for pages
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // Start fetch in background
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(err => {
    console.log('Background fetch failed:', err);
    return cachedResponse;
  });
  
  // Return cached version immediately if available, otherwise wait for network
  return cachedResponse || fetchPromise;
}

// Helper functions to determine caching strategy
function isStaticAsset(pathname) {
  return pathname.includes('/css/') ||
         pathname.includes('/js/') ||
         pathname.includes('/fonts/') ||
         pathname.endsWith('.png') ||
         pathname.endsWith('.jpg') ||
         pathname.endsWith('.jpeg') ||
         pathname.endsWith('.webp') ||
         pathname.endsWith('.svg') ||
         pathname.endsWith('.ico') ||
         pathname.endsWith('.woff') ||
         pathname.endsWith('.woff2') ||
         pathname.endsWith('.mp4');
}

function isAPICall(pathname) {
  return pathname.includes('/.netlify/functions/') ||
         pathname.includes('/api/');
}

function isPageRequest(pathname) {
  return pathname.endsWith('.html') || 
         pathname === '/' ||
         (!pathname.includes('.') && !pathname.includes('/.netlify/'));
}

// Background sync for form submissions (if supported)
if ('sync' in window.ServiceWorkerRegistration.prototype) {
  self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
      console.log('Service Worker: Background sync triggered');
      event.waitUntil(handleBackgroundSync());
    }
  });
}

async function handleBackgroundSync() {
  // Handle any queued form submissions or data sync
  console.log('Service Worker: Handling background sync');
}

// Push notification handling (if implemented)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/faviconV2.png',
      badge: '/faviconV2.png',
      vibrate: [200, 100, 200],
      data: data.data || {}
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});

// Periodic background sync (if supported)
if ('periodicSync' in window.ServiceWorkerRegistration.prototype) {
  self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'content-sync') {
      event.waitUntil(syncContent());
    }
  });
}

async function syncContent() {
  // Sync latest events and venues data
  console.log('Service Worker: Syncing content in background');
}

// Message handling for cache management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(clearAllCaches());
  }
});

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
  console.log('Service Worker: All caches cleared');
}