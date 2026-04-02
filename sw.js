const CACHE_NAME = 'brumoutloud-cache-v5';
const STATIC_CACHE = 'brumoutloud-static-v5';
const DYNAMIC_CACHE = 'brumoutloud-dynamic-v5';

// Static assets that rarely change
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/js/main.js',
  '/js/push-notifications.js',
  '/js/admin-notification-poller.js',
  '/faviconV2.png',
  '/favicon.html',
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
  '/terms-of-submission.html',
  '/admin-settings.html',
  '/test-event-ssg.html'
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
      }),
      // Cache SSG pages (event and venue pages)
      caches.open(CACHE_NAME).then((cache) => {
        console.log('Service Worker: Caching SSG pages');
        return cacheSSGPages(cache);
      })
    ]).then(() => {
      console.log('Service Worker: All caches populated');
      return self.skipWaiting(); // Activate immediately
    }).catch(err => {
      console.error('Service Worker: Installation failed', err);
    })
  );
});

// Function to cache SSG pages (event and venue pages)
async function cacheSSGPages(cache) {
  try {
    // Cache event pages
    const eventPages = await getEventPages();
    if (eventPages.length > 0) {
      console.log(`Service Worker: Attempting to cache ${eventPages.length} event pages`);
      for (const page of eventPages) {
        try {
          // Use fetch with no-cache to avoid 206 partial responses
          const response = await fetch(page, { cache: 'no-cache' });
          if (response.ok && response.status === 200) {
            await cache.put(page, response);
            console.log('Service Worker: Cached event page:', page);
          } else {
            console.log(`Service Worker: Skipping event page (${response.status}):`, page);
          }
        } catch (err) {
          console.log('Service Worker: Failed to cache event page:', page, err.message);
        }
      }
    } else {
      console.log('Service Worker: No event pages to cache');
    }
    
    // Cache venue pages
    const venuePages = await getVenuePages();
    if (venuePages.length > 0) {
      console.log(`Service Worker: Attempting to cache ${venuePages.length} venue pages`);
      for (const page of venuePages) {
        try {
          // Use fetch with no-cache to avoid 206 partial responses
          const response = await fetch(page, { cache: 'no-cache' });
          if (response.ok && response.status === 200) {
            await cache.put(page, response);
            console.log('Service Worker: Cached venue page:', page);
          } else {
            console.log(`Service Worker: Skipping venue page (${response.status}):`, page);
          }
        } catch (err) {
          console.log('Service Worker: Failed to cache venue page:', page, err.message);
        }
      }
    } else {
      console.log('Service Worker: No venue pages to cache');
    }
  } catch (err) {
    console.log('Service Worker: Error caching SSG pages:', err);
  }
}

// Function to get event pages from the event directory
async function getEventPages() {
  try {
    // Check if we're in a build environment or if event pages exist
    const response = await fetch('/.netlify/functions/get-events?limit=10');
    if (response.ok) {
      const data = await response.json();
      if (data.events && data.events.length > 0) {
        // Only return event pages if we have events and they likely exist
        return data.events.map(event => `/event/${event.slug}.html`);
      }
    }
  } catch (err) {
    console.log('Service Worker: Could not fetch event pages:', err);
  }
  
  // Fallback: return empty array if no events or API fails
  console.log('Service Worker: No event pages to cache (expected if SSG not run)');
  return [];
}

// Function to get venue pages from the venue directory
async function getVenuePages() {
  try {
    // This would ideally fetch from an API, but for now we'll use a fallback
    const response = await fetch('/.netlify/functions/get-venue-list');
    if (response.ok) {
      const data = await response.json();
      return data.map(venue => `/venue/${venue.slug}.html`) || [];
    }
  } catch (err) {
    console.log('Service Worker: Could not fetch venue pages:', err);
  }
  
  // Fallback: return empty array
  return [];
}

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
    // Handle favicon requests specifically
    if (url.pathname === '/favicon.ico') {
      const faviconResponse = await caches.match('/faviconV2.png');
      if (faviconResponse) {
        return new Response(faviconResponse.body, {
          status: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=31536000'
          }
        });
      }
    }
    
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
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    // Only cache successful responses that are not partial (206)
    if (networkResponse.ok && networkResponse.status !== 206) {
      try {
        const cache = await caches.open(cacheName);
        await cache.put(request, networkResponse.clone());
      } catch (cacheError) {
        console.log('Service Worker: Failed to cache response:', cacheError.message);
      }
    }
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Cache first strategy failed:', error.message);
    // Return cached version if available, otherwise throw
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Network First strategy - good for dynamic content
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    // Only cache successful responses that are not partial (206)
    if (networkResponse.ok && networkResponse.status !== 206) {
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
    // Only cache successful responses that are not partial (206)
    if (networkResponse.ok && networkResponse.status !== 206) {
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
         pathname.startsWith('/event/') ||
         pathname.startsWith('/venue/') ||
         (!pathname.includes('.') && !pathname.includes('/.netlify/'));
}

// Background sync for form submissions (if supported)
if ('SyncManager' in self) {
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

// Push notification handling
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    // Default options
    const options = {
      body: data.body,
      icon: '/faviconV2.png',
      badge: '/faviconV2.png',
      vibrate: [200, 100, 200],
      data: data.data || {},
      tag: data.tag || 'default',
      requireInteraction: data.requireInteraction || false,
      actions: data.actions || []
    };
    
    // Add specific handling for different notification types
    if (data.type === 'new-submission') {
      options.requireInteraction = true;
      options.vibrate = [300, 100, 300, 100, 300]; // More urgent pattern
      options.data.url = '/admin-approvals.html';
    } else if (data.type === 'approval-status') {
      options.requireInteraction = false;
      options.data.url = '/admin-approvals.html';
    } else if (data.type === 'system-alert') {
      options.requireInteraction = data.severity === 'high';
      options.data.url = '/admin-system-status.html';
    }
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } else {
    // Fallback for notifications without data
    event.waitUntil(
      self.registration.showNotification('Brum Outloud', {
        body: 'You have a new notification',
        icon: '/faviconV2.png',
        badge: '/faviconV2.png',
        tag: 'default'
      })
    );
  }
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const notificationData = event.notification.data || {};
  const url = notificationData.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Periodic background sync (if supported)
if ('PeriodicSyncManager' in self) {
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