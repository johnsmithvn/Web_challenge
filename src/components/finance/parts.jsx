/**
 * parts — mảnh UI + helper dùng chung cho module chi tiêu. Gom vào 1 file để 6
 * màn khỏi lặp: format tiền, tra danh mục, donut SVG, biểu đồ nhịp chi, chip
 * necessity, picker gắn Task.
 */
import { useMemo, useState } from 'react';
import { formatVND } from '../../utils/currencyUtils';
import CATS from '../../data/finance-categories.json';

export { formatVND };
export const money = (n) => formatVND(Math.round(n || 0));

// ── Tra danh mục ────────────────────────────────────────────────────────────
export const EXPENSE_BY_KEY = Object.fromEntries(CATS.expenseGroups.map(g => [g.key, g]));
export const INCOME_BY_KEY = Object.fromEntries(CATS.incomeGroups.map(g => [g.key, g]));
export const SUB_BY_KEY = {};
for (const g of CATS.expenseGroups) for (const s of g.subs || []) SUB_BY_KEY[s.key] = { ...s, group: g };

export function catInfo(categoryId) {
  return EXPENSE_BY_KEY[categoryId] || INCOME_BY_KEY[categoryId]
    || { key: categoryId, label: categoryId || 'Khác', icon: '📦', color: '#8b91a6' };
}
export function subLabel(subId) { return SUB_BY_KEY[subId]?.label || null; }

export const NECESSITY_META = {
  must: { label: 'Bắt buộc',  color: '#48b3a2' },
  need: { label: 'Cần thiết', color: '#9184d9' },
  want: { label: 'Muốn có',   color: '#e58159' },
};

// ── Donut SVG + legend bấm được ──────────────────────────────────────────────
export function Donut({ data, total, onSlice, size = 168 }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 10, inner = r * 0.58;
  const arcs = useMemo(() => {
    if (!data.length || !total) return [];
    let ang = -90;
    return data.map(d => {
      const frac = d.amount / total;
      const a0 = ang, a1 = ang + frac * 360; ang = a1;
      const large = a1 - a0 > 180 ? 1 : 0;
      const p = (deg, rad) => [cx + rad * Math.cos(deg * Math.PI / 180), cy + rad * Math.sin(deg * Math.PI / 180)];
      const [x0, y0] = p(a0, r), [x1, y1] = p(a1, r);
      const [ix1, iy1] = p(a1, inner), [ix0, iy0] = p(a0, inner);
      const dPath = `M${x0},${y0} A${r},${r} 0 ${large},1 ${x1},${y1} L${ix1},${iy1} A${inner},${inner} 0 ${large},0 ${ix0},${iy0} Z`;
      return { d: dPath, color: d.color, key: d.key };
    });
  }, [data, total, cx, cy, r, inner]);
  if (!data.length || !total) {
    return <div className="fin-donut fin-donut--empty" style={{ width: size, height: size }}>Chưa có dữ liệu</div>;
  }
  return (
    <svg className="fin-donut" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {arcs.map(a => (
        <path key={a.key} d={a.d} fill={a.color} stroke="#161826" strokeWidth="1.5"
          style={{ cursor: onSlice ? 'pointer' : 'default' }} onClick={() => onSlice?.(a.key)} />
      ))}
    </svg>
  );
}

// ── Biểu đồ nhịp chi: cột + đường trung bình ────────────────────────────────
export function RhythmBars({ rows, avg, unit }) {
  const max = Math.max(1, ...rows.map(r => r.amount));
  return (
    <div className="fin-rhythm">
      <div className="fin-rhythm__bars">
        {rows.map((r, i) => {
          const h = Math.round((r.amount / max) * 100);
          const strong = r.amount > avg;
          const label = unit === 'month' ? r.key.slice(5) : r.key.slice(8);
          return (
            <div key={r.key} className="fin-rhythm__col" title={`${label}: ${money(r.amount)}`}>
              <div className={`fin-rhythm__bar${strong ? ' fin-rhythm__bar--strong' : ''}`} style={{ height: `${h}%` }} />
              {(unit === 'month' || i % 5 === 0) && <span className="fin-rhythm__lbl">{label}</span>}
            </div>
          );
        })}
        {avg > 0 && <div className="fin-rhythm__avg" style={{ bottom: `${Math.round((avg / max) * 100)}%` }} />}
      </div>
      <div className="fin-rhythm__cap">Đường đứt = trung bình {money(avg)}/{unit === 'month' ? 'tháng' : 'ngày'}</div>
    </div>
  );
}

// ── Toggle Nocturne ──────────────────────────────────────────────────────────
export function Toggle({ on, onChange, label }) {
  return (
    <button type="button" className={`fin-toggle${on ? ' fin-toggle--on' : ''}`}
      onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span className="fin-toggle__track"><span className="fin-toggle__knob" /></span>
      {label && <span className="fin-toggle__label">{label}</span>}
    </button>
  );
}

// ── Picker gắn Task vào giao dịch (liên kết Task) ────────────────────────────
export function TaskPicker({ tasks, value, onPick }) {
  const [open, setOpen] = useState(false);
  const current = tasks.find(t => t.id === value);
  return (
    <div className="fin-taskpick">
      <button type="button" className="fin-taskpick__btn" onClick={() => setOpen(o => !o)}>
        {current ? `📌 ${current.title}` : '📌 Gắn nhiệm vụ'}
      </button>
      {value && <button type="button" className="fin-taskpick__clear" onClick={() => onPick(null)}>✕</button>}
      {open && (
        <div className="fin-taskpick__menu">
          {tasks.length === 0 && <div className="fin-taskpick__empty">Không có nhiệm vụ đang mở</div>}
          {tasks.map(t => (
            <button key={t.id} type="button" className="fin-taskpick__opt"
              onClick={() => { onPick(t.id); setOpen(false); }}>{t.title}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Segmented control ─────────────────────────────────────────────────────────
export function Segmented({ options, value, onChange }) {
  return (
    <div className="fin-seg">
      {options.map(o => (
        <button key={o.value} type="button"
          className={`fin-seg__btn${value === o.value ? ' fin-seg__btn--active' : ''}`}
          onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

// ── Bộ lọc kỳ (dùng chung Tổng quan + Giao dịch, chung state qua nav) ────────
export function PeriodPicker({ options, value, onChange }) {
  const idx = options.findIndex(o => o.key === value);
  const cur = options[idx] || options[0];
  const days = useMemo(() => {
    if (!cur) return 0;
    return Math.round((new Date(cur.to + 'T00:00:00') - new Date(cur.from + 'T00:00:00')) / 86400000) + 1;
  }, [cur]);
  return (
    <div className="fin-period">
      <span className="fin-period__ico">📅</span>
      <span className="fin-period__lbl">Đang xem</span>
      <select className="fin-period__select" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
      <span className="fin-period__days">{days} ngày</span>
      <div className="fin-period__nav">
        <button disabled={idx <= 0} onClick={() => onChange(options[idx - 1].key)} aria-label="Kỳ trước">‹</button>
        <button disabled={idx >= options.length - 1} onClick={() => onChange(options[idx + 1].key)} aria-label="Kỳ sau">›</button>
      </div>
    </div>
  );
}

export { CATS };
