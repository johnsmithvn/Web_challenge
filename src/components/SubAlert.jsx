import { useState, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { cardCycle } from '../utils/financeLogic';
import { toDateStr } from '../utils/dateUtils';
import AppIcon from './AppIcon';
import '../styles/widgets.css';

/**
 * SubAlert — nhắc nghĩa vụ tài chính sắp tới hạn (hóa đơn + thẻ) ở footer sidebar.
 * v6.0.0: đọc từ module Finance mới (finance_bills / finance_cards) thay cho
 * subscriptions cũ. Query nhẹ, chỉ khi đã đăng nhập; ẩn nếu không có gì sắp tới.
 */
function daysUntilDay(dueDay, today) {
  if (!dueDay) return null;
  const t = new Date(today + 'T00:00:00');
  let due = new Date(t.getFullYear(), t.getMonth(), dueDay);
  if (due < t) due = new Date(t.getFullYear(), t.getMonth() + 1, dueDay);
  return Math.round((due - t) / 86400000);
}

export default function SubAlert() {
  const { user } = useAuth();
  const enabled = isSupabaseEnabled && !!user;
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!enabled) { setItems([]); return; }
    const today = toDateStr();
    (async () => {
      try {
        const [bills, cards] = await Promise.all([
          supabase.from('finance_bills').select('name, due_day, enabled, finished_at').eq('user_id', user.id),
          supabase.from('finance_cards').select('name, statement_day, due_day, grace').eq('user_id', user.id),
        ]);
        const list = [];
        for (const b of bills.data || []) {
          if (!b.enabled || b.finished_at) continue;
          const d = daysUntilDay(b.due_day, today);
          if (d != null && d <= 7) list.push({ key: `b${b.name}`, icon: 'receipt', name: b.name, days: d });
        }
        for (const c of cards.data || []) {
          const cyc = cardCycle(c, today);
          if (cyc.daysUntilDue >= 0 && cyc.daysUntilDue <= 7) list.push({ key: `c${c.name}`, icon: 'creditCard', name: c.name, days: cyc.daysUntilDue });
        }
        list.sort((a, b) => a.days - b.days);
        setItems(list);
      } catch { setItems([]); }
    })();
  }, [enabled, user]);

  if (!enabled || items.length === 0) return null;

  return (
    <div className="sub-alert">
      <div className="sub-alert__title"><AppIcon name="warning" size={14} /> Sắp tới hạn ({items.length})</div>
      <div className="sub-alert__list">
        {items.slice(0, 5).map(it => (
          <div key={it.key} className="sub-alert__item">
            <span><AppIcon name={it.icon} size={14} /> {it.name}</span>
            <span className={`sub-alert__days${it.days <= 2 ? ' sub-alert__days--urgent' : ''}`}>
              {it.days <= 0 ? 'Hôm nay' : `${it.days} ngày`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
