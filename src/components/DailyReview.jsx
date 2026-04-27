import { useState, useEffect } from 'react';
import { useActivityLog } from '../hooks/useActivityLog';
import '../styles/widgets.css';

/**
 * DailyReview — Quick recap widget for today's progress.
 * Shows activity count and recent actions.
 * Used in: TrackerPage sidebar or dashboard area.
 */
export default function DailyReview() {
  const { getTodayCount, getTimelineByDate, enabled } = useActivityLog();
  const [count, setCount] = useState(0);
  const [recentActions, setRecentActions] = useState([]);

  useEffect(() => {
    if (!enabled) return;
    const today = new Date().toISOString().split('T')[0];
    getTodayCount().then(setCount);
    getTimelineByDate(today).then(entries => {
      // Show last 5 actions
      setRecentActions(entries.slice(-5).reverse());
    });
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!enabled || count === 0) return null;

  const ACTION_ICONS = {
    habit_done: '✅', habit_undo: '↩️', task_done: '📌',
    expense_add: '💰', collect_add: '📥', focus_done: '🎯',
    mood_set: '😊', challenge_done: '🏆',
  };

  return (
    <div className="daily-review">
      <div className="daily-review__header">
        <span className="daily-review__title">📊 Hôm nay</span>
        <span className="daily-review__count">{count} hoạt động</span>
      </div>
      {recentActions.length > 0 && (
        <div className="daily-review__list">
          {recentActions.map(entry => (
            <div key={entry.id} className="daily-review__item">
              <span className="daily-review__icon">{ACTION_ICONS[entry.action] || '📝'}</span>
              <span className="daily-review__label">{entry.label || entry.action}</span>
              <span className="daily-review__time">
                {new Date(entry.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
