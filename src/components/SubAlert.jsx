import { useState, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { cardStatementSummary, nextAnnualFee, billCycle, addDaysStr } from '../utils/financeLogic';
import { toDateStr } from '../utils/dateUtils';
import AppIcon from './AppIcon';
import '../styles/widgets.css';

/**
 * SubAlert — nhắc nghĩa vụ tài chính sắp tới hạn (hóa đơn + thẻ) ở footer sidebar.
 * v6.0.0: đọc từ module Finance mới (finance_bills / finance_cards) thay cho
 * subscriptions cũ. Query nhẹ, chỉ khi đã đăng nhập; ẩn nếu không có gì sắp tới.
 *
 * Widget này phải BIẾT kỳ nào đã trả, không chỉ biết ngày đến hạn: nhắc một hóa
 * đơn vừa trả xong là cách nhanh nhất để người dùng học cách phớt lờ nó.
 */

export default function SubAlert() {
  const { user } = useAuth();
  const enabled = isSupabaseEnabled && !!user;
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!enabled) { setItems([]); return; }
    const today = toDateStr();
    (async () => {
      try {
        const [bills, cards, txs] = await Promise.all([
          supabase.from('finance_bills').select('id, name, due_day, rrule, anchor_date, enabled, finished_at, skipped_periods').eq('user_id', user.id),
          supabase.from('finance_cards').select('id, name, statement_day, due_day, grace, annual_fee, annual_fee_on').eq('user_id', user.id),
          // 90 ngày phủ trọn kỳ hóa đơn đang chạy và một chu kỳ sao kê thẻ — đủ để biết
          // "đã trả chưa" mà không kéo cả sổ giao dịch về chỉ để vẽ 5 dòng nhắc.
          supabase.from('finance_transactions')
            .select('amount, occurred_at, type, excluded, bill_id, bill_period, card_id, card_period, source_card_id')
            .eq('user_id', user.id).gte('occurred_at', addDaysStr(today, -90)),
        ]);
        const paid = txs.data || [];
        const list = [];
        for (const b of bills.data || []) {
          if (!b.enabled || b.finished_at) continue;
          const cyc = billCycle(b, today);
          if (cyc == null || cyc.days > 7) continue;   // kỳ còn xa (hóa đơn quý/năm) thì chưa nhắc
          if ((b.skipped_periods || []).includes(cyc.period)) continue;
          if (paid.some(t => t.bill_id === b.id && t.bill_period === cyc.period)) continue;
          list.push({ key: `b${b.name}`, icon: 'receipt', name: b.name, days: cyc.days });
        }
        for (const c of cards.data || []) {
          const cyc = cardStatementSummary(c, paid, today);
          // Sao kê 0đ (chưa quẹt gì, hoặc đã trả hết) thì ngày đến hạn không phải việc phải làm.
          if (cyc.outstanding > 0 && cyc.daysUntilDue >= 0 && cyc.daysUntilDue <= 7) {
            list.push({ key: `c${c.name}`, icon: 'creditCard', name: c.name, days: cyc.daysUntilDue });
          }
          const fee = c.annual_fee > 0 ? nextAnnualFee(c.annual_fee_on, today) : null;
          if (fee && fee.days <= 7) list.push({ key: `f${c.name}`, icon: 'calendar', name: `${c.name} · phí thường niên`, days: fee.days });
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
              {it.days < 0 ? `Quá ${Math.abs(it.days)} ngày` : it.days === 0 ? 'Hôm nay' : `${it.days} ngày`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
