/**
 * Service Worker — Task Notification Scheduler
 *
 * Receives the current day's pending tasks from the main thread via postMessage
 * and shows a notification when one is due.
 *
 * NOTE: browsers suspend idle service workers, so this 60s timer is best-effort —
 * it is NOT guaranteed to run when no tab is open. The synced task list is only
 * valid for the day it was synced (see the day-rollover guard below).
 */

const SW_VERSION = '1.1.0';
let pendingTasks = [];
let syncDay = null; // local YYYY-MM-DD when tasks were last synced

function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Receive tasks from main thread ───────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SYNC_TASKS') {
    pendingTasks = event.data.tasks || [];
    syncDay = localDay();
  }
});

// ── Check tasks every 60 seconds ─────────────────────────
setInterval(() => {
  if (pendingTasks.length === 0) return;

  const now = new Date();
  // The synced tasks are only for `syncDay`. If the day has rolled over (tab left
  // open past midnight), don't fire stale tasks — wait for a fresh SYNC_TASKS.
  if (syncDay && localDay(now) !== syncDay) return;

  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  pendingTasks.forEach((task) => {
    if (task.notified) return;
    if (!task.due_time) return;

    // Compare HH:MM (due_time from DB is "HH:MM:SS", trim seconds)
    const dueHHMM = task.due_time.substring(0, 5);

    // Skip tasks with default '00:00' time (no explicit time set by user)
    if (dueHHMM === '00:00') return;

    if (dueHHMM <= currentTime) {
      self.registration.showNotification('📌 Nhiệm Vụ Đến Hạn', {
        body: task.title,
        icon: '/pwa-192x192.png',
        badge: '/favicon.png',
        tag: `task-${task.id}`, // coalesce duplicates with the same tag
        renotify: false,        // if the SW restarts, don't re-alert an already-shown task
        data: { taskId: task.id },
        requireInteraction: true,
      });

      // Mark as notified locally (prevent re-fire within this SW lifetime)
      task.notified = true;
    }
  });
}, 60_000); // every 60 seconds

// ── Handle notification click → focus app ────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing tab if open
      for (const client of clients) {
        if (client.url.includes('/tasks') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new tab
      return self.clients.openWindow('/tasks');
    })
  );
});

// ── Offline Shell Caching ────────────────────────────────
const CACHE_NAME = 'lh-pwa-v1.3.0';
const STATIC_PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
];

// ── Install & Activate ───────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => (
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )).then(() => self.clients.claim())
  );
});

// ── Fetch Handler: Network-First cho HTML, Cache-First cho Assets ──
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Bỏ qua các API bên ngoài như Supabase REST
  if (url.pathname.startsWith('/rest/v1') || url.pathname.startsWith('/auth/v1')) {
    return;
  }

  // 1. Navigation requests (mở trang SPA: /, /tasks, /finance, /accounts...)
  // Network-First: Ưu tiên mạng để luôn lấy bản mới nhất; mất mạng thì fallback về index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', clone));
          }
          return response;
        })
        .catch(() => caches.match('/') || caches.match('/index.html'))
    );
    return;
  }

  // 2. Static assets cùng domain (JS, CSS, icons, fonts)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        const fetchPromise = fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            }
            return networkResponse;
          })
          .catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
