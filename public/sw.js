/**
 * Service Worker — Task Notification Scheduler
 *
 * Receives pending tasks from the main thread via postMessage.
 * Checks every 60 seconds if any task is due → shows notification.
 * Works even when the tab is closed (as long as browser is open).
 */

const SW_VERSION = '1.0.0';
let pendingTasks = [];

// ── Receive tasks from main thread ───────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SYNC_TASKS') {
    pendingTasks = event.data.tasks || [];
  }
});

// ── Check tasks every 60 seconds ─────────────────────────
setInterval(() => {
  if (pendingTasks.length === 0) return;

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  pendingTasks.forEach((task) => {
    if (task.notified) return;
    if (!task.due_time) return;

    // Compare HH:MM (due_time from DB is "HH:MM:SS", trim seconds)
    const dueHHMM = task.due_time.substring(0, 5);

    if (dueHHMM <= currentTime) {
      self.registration.showNotification('📌 Nhiệm Vụ Đến Hạn', {
        body: task.title,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: `task-${task.id}`,
        data: { taskId: task.id },
        requireInteraction: true,
      });

      // Mark as notified locally (prevent re-fire)
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
