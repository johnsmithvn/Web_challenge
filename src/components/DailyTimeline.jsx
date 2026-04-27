/**
 * DailyTimeline — Shows all activities for a selected date.
 * Data: [{ id, action, label, amount, meta, created_at }]
 */

const ACTION_ICONS = {
  habit_done:       '✅',
  habit_undo:       '↩️',
  task_done:        '📌',
  task_add:         '📋',
  expense_add:      '💰',
  collect_add:      '📥',
  focus_done:       '🎯',
  mood_set:         '😊',
  xp_earned:        '⚡',
  challenge_done:   '🏆',
  subscription_add: '📦',
  journey_start:    '🚀',
  journey_complete: '🎉',
};

const ACTION_LABELS = {
  habit_done:       'Hoàn thành thói quen',
  habit_undo:       'Bỏ đánh dấu thói quen',
  task_done:        'Hoàn thành nhiệm vụ',
  task_add:         'Thêm nhiệm vụ',
  expense_add:      'Ghi chi tiêu',
  collect_add:      'Lưu vào Collect',
  focus_done:       'Hoàn thành Focus',
  mood_set:         'Cập nhật tâm trạng',
  xp_earned:        'Nhận XP',
  challenge_done:   'Hoàn thành Challenge',
  subscription_add: 'Thêm đăng ký',
  journey_start:    'Bắt đầu lộ trình',
  journey_complete: 'Hoàn thành lộ trình',
};

export default function DailyTimeline({ entries = [], date }) {
  if (entries.length === 0) {
    return (
      <div className="timeline-empty">
        Không có hoạt động nào ngày {date && new Date(date).toLocaleDateString('vi-VN')}
      </div>
    );
  }

  return (
    <div className="timeline">
      <div className="timeline__header">
        📅 {date && new Date(date).toLocaleDateString('vi-VN', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        })}
        <span className="timeline__count">{entries.length} hoạt động</span>
      </div>

      <div className="timeline__list">
        {entries.map(entry => {
          const icon = ACTION_ICONS[entry.action] || '📝';
          const time = new Date(entry.created_at).toLocaleTimeString('vi-VN', {
            hour: '2-digit', minute: '2-digit'
          });
          const typeLabel = ACTION_LABELS[entry.action] || entry.action;

          return (
            <div key={entry.id} className="timeline__item">
              <div className="timeline__dot">{icon}</div>
              <div className="timeline__line" />
              <div className="timeline__content">
                <div className="timeline__time">{time}</div>
                <div className="timeline__action">{typeLabel}</div>
                {entry.label && (
                  <div className="timeline__label">{entry.label}</div>
                )}
                {entry.amount && (
                  <span className="timeline__amount">+{entry.amount}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
