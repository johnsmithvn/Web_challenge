/**
 * parts — mảnh UI + helper dùng chung cho module chi tiêu. Gom vào 1 file để 6
 * màn Finance khỏi lặp: format tiền, tra danh mục, donut SVG, biểu đồ nhịp chi, chip
 * necessity, picker gắn Task.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatVND } from '../../utils/currencyUtils';
import { formatDate, parseDmy } from '../../utils/dateUtils';
import CATS from '../../data/finance-categories.json';
import AppIcon from '../AppIcon';
import DatePickerPopover from '../DatePickerPopover';

export { formatVND };
export const money = (n) => formatVND(Math.round(n || 0));

// ── Tra danh mục ────────────────────────────────────────────────────────────
export const EXPENSE_BY_KEY = Object.fromEntries(CATS.expenseGroups.map(g => [g.key, g]));
export const INCOME_BY_KEY = Object.fromEntries(CATS.incomeGroups.map(g => [g.key, g]));
export const SUB_BY_KEY = {};
for (const g of CATS.expenseGroups) for (const s of g.subs || []) SUB_BY_KEY[s.key] = { ...s, group: g };

export function catInfo(categoryId, cats = CATS) {
  const expense = cats.expenseGroups.find(g => g.key === categoryId);
  const income = cats.incomeGroups.find(g => g.key === categoryId);
  return expense || income
    || { key: categoryId, label: categoryId || 'Khác', icon: 'package', color: '#8b91a6' };
}
export function subLabel(subId, cats = CATS) {
  if (!subId) return null;
  for (const group of cats.expenseGroups) {
    const sub = (group.subs || []).find(item => item.key === subId);
    if (sub) return sub.label;
  }
  return null;
}

export function FinanceIcon({ categoryId, name, cats = CATS, size = 18, weight = 'regular', ...props }) {
  const iconName = name || catInfo(categoryId, cats).icon;
  return <AppIcon name={iconName} size={size} weight={weight} {...props} />;
}

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

/**
 * Ô chọn ngày dùng chung cho Finance — LUÔN hiện dd/mm/yyyy.
 *
 * `<input type="date">` hiển thị theo NGÔN NGỮ TRÌNH DUYỆT (máy để tiếng Anh ra
 * mm/dd/yyyy) và không có cách nào ép định dạng bằng HTML/CSS/JS, nên phải bỏ hẳn
 * control gốc. Bên trong vẫn là `DatePickerPopover` có sẵn của app (RULES.md §5),
 * chỉ bọc thêm nút hiển thị để mỗi call site vẫn gọn một dòng.
 *
 * `max` thay cho attribute `max` của native input: chặn chọn ngày tương lai.
 */
const POPOVER_HEIGHT = 430;   // chiều cao thực tế của .dp-popover, dùng để chọn hướng mở

export function DateField({ value, onChange, max, placeholder = 'dd/mm/yyyy', className = 'fin-input' }) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [text, setText] = useState(() => (value ? formatDate(value) : ''));
  const boxRef = useRef(null);
  // Ngày đổi từ bên ngoài (nút Hôm nay/Hôm qua, chọn trong lịch) thì ô chữ theo kịp.
  useEffect(() => { setText(value ? formatDate(value) : ''); }, [value]);

  const commit = (raw) => {
    const iso = parseDmy(raw);
    if (!iso || (max && iso > max)) return false;
    onChange(iso);
    return true;
  };

  // Gõ tới đâu chèn dấu "/" tới đó; đủ 8 chữ số mới ghi ra ngoài.
  const type = (event) => {
    const digits = event.target.value.replace(/\D/g, '').slice(0, 8);
    setText([digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/'));
    if (digits.length === 8) commit([digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].join('/'));
  };
  // Gõ dở dang hoặc ngày không có thật thì trả ô về giá trị đang lưu, không im lặng nuốt.
  const blur = () => { if (!commit(text)) setText(value ? formatDate(value) : ''); };

  const toggle = () => {
    // Mở xuống dưới mà không đủ chỗ thì lật lên trên: trước đây popover tràn khỏi màn
    // hình và nút Lưu nằm ngoài vùng cuộn được, coi như không bấm được.
    const box = boxRef.current?.getBoundingClientRect();
    if (box) setDropUp(window.innerHeight - box.bottom < POPOVER_HEIGHT && box.top > POPOVER_HEIGHT);
    setOpen(o => !o);
  };

  return (
    <span className="fin-datefield" ref={boxRef}>
      <span className={`${className} fin-datefield__box`}>
        <input className="fin-datefield__text" value={text} onChange={type} onBlur={blur}
          inputMode="numeric" placeholder={placeholder} aria-label="Ngày, dạng ngày/tháng/năm" />
        <button type="button" className="fin-datefield__pick" onClick={toggle}
          aria-label="Mở lịch" title="Mở lịch"><AppIcon name="calendar" size={15} /></button>
      </span>
      {open && (
        <DatePickerPopover value={value || ''} hideTime max={max}
          onChange={onChange} onClose={() => setOpen(false)}
          style={dropUp ? { bottom: '100%', left: 0, marginBottom: '4px' } : { top: '100%', left: 0, marginTop: '4px' }} />
      )}
    </span>
  );
}

// ── Picker gắn Task vào giao dịch (liên kết Task) ────────────────────────────
export function TaskPicker({ tasks, value, onPick }) {
  const [open, setOpen] = useState(false);
  const current = tasks.find(t => t.id === value);
  return (
    <div className="fin-taskpick">
      <button type="button" className="fin-taskpick__btn" onClick={() => setOpen(o => !o)}>
        <AppIcon name="pushPin" size={15} weight={current ? 'fill' : 'regular'} />
        <span>{current ? current.title : 'Gắn nhiệm vụ'}</span>
      </button>
      {value && <button type="button" className="fin-taskpick__clear" onClick={() => onPick(null)} aria-label="Bỏ liên kết nhiệm vụ"><AppIcon name="x" size={13} /></button>}
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
export function Segmented({ options, value, onChange, ariaLabel = 'Tùy chọn' }) {
  return (
    <div className="fin-seg" role="group" aria-label={ariaLabel}>
      {options.map(o => (
        <button key={o.value} type="button"
          className={`fin-seg__btn${value === o.value ? ' fin-seg__btn--active' : ''}`}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}>
          {o.icon && <AppIcon name={o.icon} size={14} />}
          <span>{o.label}</span>
          {o.hint && <small>{o.hint}</small>}
        </button>
      ))}
    </div>
  );
}

// ── Bộ lọc kỳ (dùng chung Tổng quan + Giao dịch, chung state qua nav) ────────
const PERIOD_MONTHS = Array.from({ length: 12 }, (_, index) => `Tháng ${index + 1}`);

export function PeriodPicker({ options, period, value, onChange }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const currentMonthKey = options.find(option => /^\d{4}-\d{2}$/.test(option.key))?.key;
  const currentYear = Number((currentMonthKey || '').slice(0, 4));
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(value || '');
  const yearMatch = /^year-(\d{4})$/.exec(value || '');
  const selectedYear = Number(monthMatch?.[1] || yearMatch?.[1] || currentYear);
  const [viewYear, setViewYear] = useState(selectedYear);
  const cur = period || options.find(option => option.key === value) || options[0];
  const days = useMemo(() => {
    if (!cur) return 0;
    return Math.round((new Date(cur.to + 'T00:00:00') - new Date(cur.from + 'T00:00:00')) / 86400000) + 1;
  }, [cur]);

  useEffect(() => {
    if (!open) return undefined;
    const close = event => {
      if (event.key === 'Escape' || (event.type === 'mousedown' && !rootRef.current?.contains(event.target))) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const choose = key => { onChange(key); setOpen(false); };
  const shiftPeriod = delta => {
    if (monthMatch) {
      const date = new Date(Number(monthMatch[1]), Number(monthMatch[2]) - 1 + delta, 1);
      choose(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    } else if (yearMatch) {
      choose(`year-${Number(yearMatch[1]) + delta}`);
    }
  };
  const previousDisabled = value === 'all'
    || (monthMatch ? value <= '2000-01' : Number(yearMatch?.[1]) <= 2000);
  const nextDisabled = value === 'all'
    || (monthMatch ? value >= currentMonthKey : Number(yearMatch?.[1]) >= currentYear);
  const years = useMemo(
    () => Array.from({ length: Math.max(1, currentYear - 1999) }, (_, index) => currentYear - index),
    [currentYear],
  );

  return (
    <div className="fin-period">
      <AppIcon name="calendar" size={17} className="fin-period__ico" />
      <span className="fin-period__lbl">Đang xem</span>
      <div className="fin-period__picker" ref={rootRef}>
        <button type="button" className={`fin-period__trigger${open ? ' is-open' : ''}`}
          aria-haspopup="dialog" aria-expanded={open}
          onClick={() => { if (!open) setViewYear(selectedYear); setOpen(active => !active); }}>
          <strong>{cur?.label}</strong><AppIcon name="caretDown" size={13} />
        </button>
        {open && <div className="fin-period__popover" role="dialog" aria-label="Chọn tháng và năm">
          <div className="fin-period__yearbar">
            <button type="button" onClick={() => setViewYear(year => Math.max(2000, year - 1))}
              disabled={viewYear <= 2000} aria-label="Năm trước"><AppIcon name="caretLeft" size={14} /></button>
            <select value={viewYear} onChange={event => setViewYear(Number(event.target.value))} aria-label="Năm">
              {years.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
            <button type="button" onClick={() => setViewYear(year => Math.min(currentYear, year + 1))}
              disabled={viewYear >= currentYear} aria-label="Năm sau"><AppIcon name="caretRight" size={14} /></button>
          </div>
          <div className="fin-period__months">
            {PERIOD_MONTHS.map((label, index) => {
              const key = `${viewYear}-${String(index + 1).padStart(2, '0')}`;
              return <button type="button" key={key} disabled={key > currentMonthKey}
                className={value === key ? 'is-selected' : ''} onClick={() => choose(key)}>{label}</button>;
            })}
          </div>
          <div className="fin-period__presets">
            <button type="button" className={value === `year-${viewYear}` ? 'is-selected' : ''}
              onClick={() => choose(`year-${viewYear}`)}><AppIcon name="calendar" size={14} /> Cả năm {viewYear}</button>
            <button type="button" className={value === 'all' ? 'is-selected' : ''}
              onClick={() => choose('all')}><AppIcon name="infinity" size={14} /> Tất cả</button>
          </div>
        </div>}
      </div>
      <span className="fin-period__days">{value === 'all' ? 'Toàn bộ dữ liệu' : `${days} ngày`}</span>
      <div className="fin-period__nav">
        <button type="button" disabled={previousDisabled} onClick={() => shiftPeriod(-1)} aria-label="Kỳ trước"><AppIcon name="caretLeft" size={14} /></button>
        <button type="button" disabled={nextDisabled} onClick={() => shiftPeriod(1)} aria-label="Kỳ sau"><AppIcon name="caretRight" size={14} /></button>
      </div>
    </div>
  );
}

export { CATS };
