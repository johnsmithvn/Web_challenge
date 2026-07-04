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
        icon: '/favicon.svg',
        badge: '/favicon.svg',
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
        if (client.url.includes('/tracker') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new tab
      return self.clients.openWindow('/tracker');
    })
  );
});

// ── Install & Activate ───────────────────────────────────
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
