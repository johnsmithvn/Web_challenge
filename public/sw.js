/**
 * Service Worker — Task Notification Scheduler
 *
 * Receives today's reminders from the main thread via postMessage
 * (built by buildTodayReminders in src/utils/calendarTimeUtils.js):
 *   - start of a task's time block ("⏱ Đến giờ làm", Google Calendar style)
 *   - task deadline ("📌 Nhiệm Vụ Đến Hạn")
 *
 * NOTE: browsers suspend idle service workers, so this 60s timer is best-effort —
 * it is NOT guaranteed to run when no tab is open. The synced list is only
 * valid for the day it was synced (see the day-rollover guard below).
 */

const SW_VERSION = '1.3.0';
let reminders = [];
let syncDay = null; // local YYYY-MM-DD when reminders were last synced
// Tags already shown today. The app re-syncs on every task change, so without
// this a reminder whose time has passed would fire again after each sync.
const firedTags = new Set();
let firedDay = null;

function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Receive reminders from main thread ───────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SYNC_REMINDERS') {
    reminders = event.data.reminders || [];
    syncDay = localDay();
  }
});

// ── Check reminders every 60 seconds ─────────────────────
setInterval(() => {
  const now = new Date();
  const today = localDay(now);
  if (firedDay !== today) {
    firedTags.clear();
    firedDay = today;
  }
  if (reminders.length === 0) return;
  // The synced reminders are only for `syncDay`. If the day has rolled over (tab left
  // open past midnight), don't fire stale ones — wait for a fresh SYNC_REMINDERS.
  if (syncDay && today !== syncDay) return;

  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  reminders.forEach((r) => {
    if (firedTags.has(r.tag)) return;
    if (r.at > currentTime) return;
    // Time block already over → a late "start working" ping is just noise.
    if (r.until && currentTime >= r.until) return;

    self.registration.showNotification(r.title, {
      body: r.body,
      icon: '/pwa-192x192.png',
      badge: '/favicon.png',
      tag: r.tag,             // coalesce duplicates with the same tag
      renotify: false,        // if the SW restarts, don't re-alert an already-shown reminder
      data: { taskId: r.taskId },
      requireInteraction: true,
    });
    firedTags.add(r.tag);
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
// Đổi tên cache → bước activate xoá cache cũ (v1.3.0 còn giữ file /src/… cũ của dev server).
const CACHE_NAME = 'lh-pwa-v1.4.0';
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

  // 2. Cache-first CHỈ cho file build có hash (/assets/…, tên đổi mỗi bản build nên
  // không bao giờ cũ) và icon precache. File không hash — dev server Vite (/src/…,
  // /@vite/…, /node_modules/.vite/…) — đi thẳng mạng: trước đây chúng bị cache-first
  // nên sửa code xong reload vẫn thấy giao diện cũ.
  if (url.origin === self.location.origin
    && (url.pathname.startsWith('/assets/') || STATIC_PRECACHE.includes(url.pathname))) {
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
