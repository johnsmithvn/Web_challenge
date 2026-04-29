import { useMemo } from 'react';

/**
 * CashflowBar — 30-day horizontal bar showing subscription due dates.
 *
 * Props:
 *   subs — Array of subscriptions [{id, name, icon, next_due, amount, active}]
 */
export default function CashflowBar({ subs = [] }) {
  const days = useMemo(() => {
    const result = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      result.push(d.toISOString().split('T')[0]);
    }
    return result;
  }, []);

  const cashflowMap = useMemo(() => {
    const map = {};
    subs.filter(s => s.active).forEach(sub => {
      const due = sub.next_due;
      if (!due) return;
      if (!map[due]) map[due] = [];
      map[due].push(sub);
    });
    return map;
  }, [subs]);

  const todayStr = new Date().toISOString().split('T')[0];
  const hasDots = Object.keys(cashflowMap).some(d => days.includes(d));

  if (!hasDots && subs.length === 0) return null;

  return (
    <div className="cashflow-bar">
      <div className="cashflow-bar__title">📅 Lịch thanh toán 30 ngày tới</div>
      <div className="cashflow-bar__track">
        {days.map(day => {
          const hits = cashflowMap[day] || [];
          const isToday = day === todayStr;
          const date = new Date(day + 'T00:00:00');
          const label = date.getDate();

          return (
            <div
              key={day}
              className={`cashflow-bar__day${isToday ? ' cashflow-bar__day--today' : ''}`}
              title={
                hits.length > 0
                  ? hits.map(s => `${s.icon} ${s.name}`).join('\n')
                  : date.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'short' })
              }
            >
              <div className="cashflow-bar__label">{label === 1 || isToday ? label : (label % 5 === 0 ? label : '')}</div>
              <div className={`cashflow-bar__cell${hits.length > 0 ? ' cashflow-bar__cell--active' : ''}`}>
                {hits.length > 0 && (
                  <span className="cashflow-bar__dot" style={{ '--dot-count': hits.length }}>
                    {hits.length > 1 ? hits.length : ''}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {hasDots && (
        <div className="cashflow-bar__legend">
          {Object.entries(cashflowMap)
            .filter(([d]) => days.includes(d))
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(0, 5)
            .map(([date, items]) => (
              <div key={date} className="cashflow-bar__legend-item">
                <span className="cashflow-bar__legend-date">
                  {new Date(date + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                </span>
                {items.map(s => (
                  <span key={s.id} className="cashflow-bar__legend-sub">{s.icon} {s.name}</span>
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
