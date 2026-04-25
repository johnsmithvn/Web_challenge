import { useState, useEffect } from 'react';
import { useSubscriptions } from '../hooks/useSubscriptions';
import '../styles/widgets.css';

/**
 * SubAlert — Compact alert showing upcoming subscription renewals.
 * Shows only when there are subs due within 7 days.
 * Used in: Sidebar footer or FinancePage header.
 */
export default function SubAlert() {
  const { subs, fetchSubs, getUpcoming, enabled } = useSubscriptions();
  const [upcoming, setUpcoming] = useState([]);

  useEffect(() => {
    if (enabled) fetchSubs();
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setUpcoming(getUpcoming(7));
  }, [subs, getUpcoming]);

  if (!enabled || upcoming.length === 0) return null;

  return (
    <div className="sub-alert">
      <div className="sub-alert__title">
        ⚠️ Sắp gia hạn ({upcoming.length})
      </div>
      <div className="sub-alert__list">
        {upcoming.map(sub => {
          const daysLeft = Math.ceil((new Date(sub.next_due) - new Date()) / (1000 * 60 * 60 * 24));
          return (
            <div key={sub.id} className="sub-alert__item">
              <span>{sub.icon} {sub.name}</span>
              <span className={`sub-alert__days${daysLeft <= 2 ? ' sub-alert__days--urgent' : ''}`}>
                {daysLeft <= 0 ? 'Hết hạn!' : `${daysLeft} ngày`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
