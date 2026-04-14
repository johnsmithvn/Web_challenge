import { useNotifications } from '../hooks/useNotifications';
import '../styles/daily.css';

export default function NotificationSettings() {
  const {
    settings, permission, supported,
    requestPermission, updateSettings, sendTestNotification,
  } = useNotifications();

  const handleToggle = async () => {
    if (!settings.enabled && permission !== 'granted') {
      const result = await requestPermission();
      if (result !== 'granted') return;
    }
    updateSettings({ enabled: !settings.enabled });
  };

  const handleTimeChange = (e) => {
    const [h, m] = e.target.value.split(':').map(Number);
    updateSettings({ reminderHour: h, reminderMin: m });
  };

  const timeValue = `${String(settings.reminderHour).padStart(2,'0')}:${String(settings.reminderMin).padStart(2,'0')}`;

  return (
    <div className="notif-settings card" id="notification-settings">
      <div className="dash-card-title">🔔 Thông Báo Nhắc Nhở</div>

      {!supported && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          Browser của bạn không hỗ trợ notifications.
        </p>
      )}

      {supported && (
        <>
          {/* Enable toggle */}
          <div className="notif-settings__row" style={{ marginTop: '1rem' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                Nhắc nhở hàng ngày
              </div>
              <div className="notif-settings__label">
                {permission === 'denied'
                  ? '⚠️ Bạn đã từ chối quyền — vào Settings browser để bật lại'
                  : settings.enabled ? '✅ Đang bật' : 'Tắt'}
              </div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={handleToggle}
                disabled={permission === 'denied'}
                id="notif-toggle"
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* Time picker */}
          {settings.enabled && (
            <div className="notif-settings__row">
              <div className="notif-settings__label">Nhắc lúc</div>
              <input
                type="time"
                className="time-input"
                value={timeValue}
                onChange={handleTimeChange}
                id="notif-time-input"
              />
            </div>
          )}

          {/* Test button */}
          {settings.enabled && permission === 'granted' && (
            <button
              className="btn btn-ghost"
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', marginTop: '0.25rem' }}
              onClick={sendTestNotification}
              id="notif-test-btn"
            >
              🔔 Gửi Test Notification
            </button>
          )}
        </>
      )}
    </div>
  );
}
