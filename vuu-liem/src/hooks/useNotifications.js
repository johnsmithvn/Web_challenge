import { useState, useCallback } from 'react';

const PERM_KEY = 'vl_notif_granted';
const SETTINGS_KEY = 'vl_notif_settings';

const DEFAULT_SETTINGS = {
  enabled: false,
  reminderHour: 21,
  reminderMin: 0,
};

export function useNotifications() {
  const [settings, setSettings] = useState(() => {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
    catch { return DEFAULT_SETTINGS; }
  });

  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'unsupported';
    const result = await Notification.requestPermission();
    setPermission(result);
    localStorage.setItem(PERM_KEY, result);
    return result;
  }, []);

  const updateSettings = useCallback((updates) => {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const sendTestNotification = useCallback(() => {
    if (permission !== 'granted') return;
    new Notification('⚡ Vượt Lười', {
      body: 'Hôm nay bạn chưa tick streak! Đừng để mất chuỗi 🔥',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
    });
  }, [permission]);

  // Schedule today's reminder (called on app mount if enabled)
  const scheduleTodayReminder = useCallback((todayDone) => {
    if (!settings.enabled || permission !== 'granted' || todayDone) return;
    const now = new Date();
    const fire = new Date(now);
    fire.setHours(settings.reminderHour, settings.reminderMin, 0, 0);
    if (fire <= now) return; // Already passed today

    const delay = fire - now;
    const timerId = setTimeout(() => {
      if (document.visibilityState !== 'hidden') return; // Only notify if tab not active
      new Notification('⚡ Vượt Lười — Nhắc Nhở!', {
        body: `Bạn chưa tick hôm nay. Đừng phá streak! 🔥`,
        icon: '/favicon.svg',
      });
    }, delay);

    return () => clearTimeout(timerId);
  }, [settings, permission]);

  return {
    settings,
    permission,
    supported: typeof Notification !== 'undefined',
    requestPermission,
    updateSettings,
    sendTestNotification,
    scheduleTodayReminder,
  };
}
