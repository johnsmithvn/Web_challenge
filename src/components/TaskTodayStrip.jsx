import { useEffect, useState } from 'react';
import { hasExplicitTime, timeToMinutes } from '../utils/calendarTimeUtils';

/*
 * TaskTodayStrip — dải "Hôm nay" 7h→24h dưới header (mockup desktop): vạch giờ, vạch "bây giờ",
 * chip các việc có giờ hôm nay (bấm để mở chi tiết). Chỉ hiện trên desktop (CSS).
 */
const H0 = 7;
const H1 = 24;
const pos = (minutes) => `${(((minutes / 60) - H0) / (H1 - H0) * 100).toFixed(2)}%`;
const HOURS = [8, 10, 12, 14, 16, 18, 20, 22];

export default function TaskTodayStrip({ tasks = [], today, onOpen }) {
  const [nowMin, setNowMin] = useState(() => new Date().getHours() * 60 + new Date().getMinutes());
  useEffect(() => {
    const id = setInterval(() => setNowMin(new Date().getHours() * 60 + new Date().getMinutes()), 60000);
    return () => clearInterval(id);
  }, []);

  const open = tasks.filter((t) => t.due_date === today && !t.completed && t.status !== 'skip' && t.status !== 'done');
  const timed = open.filter((t) => hasExplicitTime(t.due_time)).sort((a, b) => a.due_time.localeCompare(b.due_time));

  return (
    <div className="tk-today-strip">
      <div className="tk-today-strip__label">
        <span className="tk-today-strip__title">Hôm nay</span>
        <span className="tk-today-strip__sub">{timed.length} có giờ · {open.length - timed.length} cả ngày</span>
      </div>
      <div className="tk-today-strip__track">
        {HOURS.map((h) => (
          <span key={h} className="tk-today-strip__hour" style={{ left: pos(h * 60) }}>
            <span>{h}h</span>
          </span>
        ))}
        {nowMin >= H0 * 60 && (
          <span className="tk-today-strip__now" style={{ left: pos(nowMin) }}>
            <span />
          </span>
        )}
        {timed.map((t) => (
          <button
            key={t.id}
            type="button"
            className="tk-today-strip__item"
            style={{ left: `min(${pos(Math.max(H0 * 60, timeToMinutes(t.due_time)))}, calc(100% - 200px))` }}
            onClick={() => onOpen?.(t)}
            title={t.title}
          >
            <span className="tk-today-strip__dot" style={{ background: t.status === 'doing' ? 'var(--tk-st-doing)' : 'var(--tk-st-todo)' }} />
            <span className="tk-today-strip__name">{t.title}</span>
            <span className="tk-today-strip__time">{t.due_time.slice(0, 5)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
