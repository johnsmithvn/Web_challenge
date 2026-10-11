import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import AppIcon from './AppIcon';
import { PRIORITY_LABELS } from '../utils/taskNlpParser';
import { STATUS_META, ksStyle, taskCardModel } from '../utils/kanbanUtils';
import { toDateStr } from '../utils/dateUtils';
import { solarToLunar, lunarLabel } from '../utils/lunarUtils';

/**
 * TaskFloatingPopovers — Tập hợp các floating popovers xuất hiện tại chỗ khi click thẻ:
 * 1. Date/Time Picker (có Âm lịch)
 * 2. Priority Picker
 * 3. Status Picker
 * 4. Date Range Picker
 */

/** Menu chọn 1 mục (Chuyển sang / Ưu tiên) — khung 220px như mockup. */
function PickList({ head, items, current, onSelect, onClose, style }) {
  const ref = useRef(null);
  usePopoverShell(ref, onClose);
  return (
    <div ref={ref} className="tk-popover tk-picklist" style={style} onClick={(e) => e.stopPropagation()}>
      <span className="tk-picklist__head">{head}</span>
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          className={`tk-picklist__item${current === it.key ? ' is-on' : ''}`}
          onClick={() => {
            onSelect(it.key);
            onClose();
          }}
        >
          <AppIcon name={it.icon} size={16} weight={it.weight || 'regular'} style={{ color: it.color, flex: 'none' }} />
          {it.label}
          {current === it.key && <AppIcon name="check" size={14} style={{ marginLeft: 'auto', color: 'var(--tk-accent)' }} />}
        </button>
      ))}
    </div>
  );
}

export function StatusPopover({ currentStatus, onSelect, onClose, style }) {
  const current = currentStatus === 'completed' ? 'done' : currentStatus || 'todo';
  return (
    <PickList
      head="Chuyển sang"
      items={Object.entries(STATUS_META).map(([key, m]) => ({ key, ...m }))}
      current={current}
      onSelect={onSelect}
      onClose={onClose}
      style={style}
    />
  );
}

export function PriorityPopover({ currentPriority = 0, onSelect, onClose, style }) {
  return (
    <PickList
      head="Ưu tiên"
      items={[5, 4, 3, 2, 1, 0].map((lvl) => ({
        key: lvl,
        label: PRIORITY_LABELS[lvl].label,
        icon: PRIORITY_LABELS[lvl].icon,
        weight: lvl === 5 ? 'fill' : 'regular',
        color: PRIORITY_LABELS[lvl].color,
      }))}
      current={Number(currentPriority) || 0}
      onSelect={onSelect}
      onClose={onClose}
      style={style}
    />
  );
}

const DOW_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const DOW_FULL = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const shiftStr = (base, n) => {
  const [y, m, d] = base.split('-').map(Number);
  return toDateStr(new Date(y, m - 1, d + n));
};
const shortDM = (v) => `${Number(v.slice(8, 10))}/${Number(v.slice(5, 7))}`;
const monthOf = (v) => new Date(Number(v.slice(0, 4)), Number(v.slice(5, 7)) - 1, 1);

// Đóng khi bấm ra ngoài / Esc, và đẩy popover (position: fixed) vào trong khung nhìn — lật lên khi sát đáy.
function usePopoverShell(ref, onClose) {
  useEffect(() => {
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', key);
    };
  }, [ref, onClose]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || getComputedStyle(el).position !== 'fixed') return;
    const r = el.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 8) el.style.top = `${Math.max(8, window.innerHeight - r.height - 8)}px`;
    if (r.right > window.innerWidth - 8) el.style.left = `${Math.max(8, window.innerWidth - r.width - 8)}px`;
  }, [ref]);
}

/** Lưới tháng (CN đầu tuần) có ngày âm dưới mỗi ô. `cellState(v)` → { sel, inRange }. */
function MonthGrid({ month, setMonth, cellState, onPick }) {
  const todayStr = toDateStr();
  const Y = month.getFullYear();
  const M = month.getMonth();
  const first = new Date(Y, M, 1).getDay();
  const nd = new Date(Y, M + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= nd; d++) cells.push(d);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" className="tk-icon-btn" onClick={() => setMonth(new Date(Y, M - 1, 1))} aria-label="Tháng trước">
          <AppIcon name="caretLeft" size={13} />
        </button>
        <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--tk-text-main)' }}>Tháng {M + 1}, {Y}</span>
        <button type="button" className="tk-icon-btn" onClick={() => setMonth(new Date(Y, M + 1, 1))} aria-label="Tháng sau">
          <AppIcon name="caretRight" size={13} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {DOW_SHORT.map((d, i) => (
          <span key={d} style={{ textAlign: 'center', fontSize: '10.5px', fontWeight: 600, color: i === 0 ? 'var(--tk-sun)' : 'var(--tk-text-mute)' }}>{d}</span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const v = toDateStr(new Date(Y, M, d));
          const { sel, inRange } = cellState(v);
          const sun = (first + d - 1) % 7 === 0;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onPick(v)}
              className="tk-cal-cell"
              style={{
                background: sel ? 'var(--tk-sel-bg)' : inRange ? 'var(--tk-accent-soft)' : 'transparent',
                color: sel ? 'var(--tk-sel-fg)' : sun ? 'var(--tk-sun)' : 'var(--tk-text-main)',
                boxShadow: v === todayStr && !sel ? 'inset 0 0 0 1px var(--tk-accent)' : 'none',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 600, lineHeight: 1 }}>{d}</span>
              <span style={{ fontSize: '8.5px', lineHeight: 1, color: sel ? 'inherit' : 'var(--tk-text-mute)' }}>
                {lunarLabel(solarToLunar(d, M + 1, Y))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const chipStyle = (on) => ({
  height: '28px',
  borderRadius: '7px',
  border: '1px solid var(--tk-border)',
  background: on ? 'var(--tk-sel-bg)' : 'var(--tk-border-soft)',
  color: on ? 'var(--tk-sel-fg)' : 'var(--tk-text-main)',
  fontSize: '11.5px',
  fontWeight: 500,
  cursor: 'pointer',
});

/** Chọn hạn: lối tắt, lịch có ngày âm, giờ (hoặc Cả ngày). Chỉ lưu khi bấm Lưu. */
export function TaskDatePickerPopover({ initialDate, initialTime, onSave, onClose, style }) {
  const ref = useRef(null);
  usePopoverShell(ref, onClose);

  const todayStr = toDateStr();
  const init = { due: initialDate || null, tm: initialTime ? initialTime.slice(0, 5) : null };
  const [draft, setDraft] = useState(init);
  const [month, setMonth] = useState(() => monthOf(initialDate || todayStr));
  const dirty = draft.due !== init.due || draft.tm !== init.tm;

  const dow = new Date().getDay();
  const quick = [
    ['Hôm nay', 0],
    ['Ngày mai', 1],
    ['Thứ Hai', ((1 - dow + 7) % 7) || 7],
    ['Tuần sau', 7],
  ].map(([label, n]) => ({ label, v: shiftStr(todayStr, n) }));

  const label = draft.due
    ? `${DOW_SHORT[new Date(`${draft.due}T00:00:00`).getDay()]} ${shortDM(draft.due)} · ${draft.tm || 'cả ngày'}`
    : 'Không hạn';

  return (
    <div
      ref={ref}
      className="tk-popover"
      style={{ width: '264px', display: 'flex', flexDirection: 'column', gap: '8px', ...style }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tk-text-main)' }}>{label}</span>
        <button
          type="button"
          onClick={() => setDraft({ due: null, tm: null })}
          style={{ background: 'none', border: 'none', color: 'var(--tk-text-mute)', fontSize: '11.5px', cursor: 'pointer' }}
        >
          Xóa hạn
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
        {quick.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => {
              setDraft((d) => ({ ...d, due: q.v }));
              setMonth(monthOf(q.v));
            }}
            style={chipStyle(draft.due === q.v)}
          >
            {q.label} <span style={{ opacity: 0.6 }}>{shortDM(q.v)}</span>
          </button>
        ))}
      </div>

      <MonthGrid
        month={month}
        setMonth={setMonth}
        cellState={(v) => ({ sel: draft.due === v, inRange: false })}
        onPick={(v) => setDraft((d) => ({ ...d, due: v }))}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
        {[null, '09:00', '12:00', '18:00', '21:00'].map((tm) => (
          <button
            key={tm || 'all'}
            type="button"
            onClick={() => setDraft((d) => ({ due: d.due || todayStr, tm }))}
            style={{ ...chipStyle(!!draft.due && draft.tm === tm), height: '26px', fontSize: '11px' }}
          >
            {tm ? tm.replace(/^0/, '') : 'Cả ngày'}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!dirty}
        onClick={() => {
          onSave(draft.due, draft.due ? draft.tm : null);
          onClose();
        }}
        className="tk-btn-primary"
        style={{ height: '32px', fontSize: '12px', justifyContent: 'center', opacity: dirty ? 1 : 0.45 }}
      >
        Lưu
      </button>
    </div>
  );
}

/** Lọc theo khoảng ngày: bấm ngày đầu rồi ngày cuối (lịch có ngày âm). */
export function DateRangePopover({ initialFrom, initialTo, onApply, onClose, style }) {
  const ref = useRef(null);
  usePopoverShell(ref, onClose);

  const todayStr = toDateStr();
  const [rg, setRg] = useState({ a: initialFrom || null, b: initialTo || null });
  const [month, setMonth] = useState(() => monthOf(initialFrom || todayStr));

  const now = new Date();
  const dow = now.getDay();
  const dom = now.getDate();
  const lastDom = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const quick = [
    ['Hôm nay', 0, 0],
    ['Tuần này', -dow, 6 - dow],
    ['Tuần sau', 7 - dow, 13 - dow],
    ['Tháng này', 1 - dom, lastDom - dom],
  ].map(([label, x, y]) => ({ label, a: shiftStr(todayStr, x), b: shiftStr(todayStr, y) }));

  const pick = (v) => {
    if (!rg.a || rg.b) setRg({ a: v, b: null });
    else setRg(v < rg.a ? { a: v, b: rg.a } : { a: rg.a, b: v });
  };
  const label = !rg.a
    ? 'Chọn khoảng ngày'
    : !rg.b
    ? `${shortDM(rg.a)} → chọn ngày cuối`
    : rg.a === rg.b
    ? shortDM(rg.a)
    : `${shortDM(rg.a)} → ${shortDM(rg.b)}`;

  return (
    <div
      ref={ref}
      className="tk-popover"
      style={{ width: '264px', display: 'flex', flexDirection: 'column', gap: '8px', ...style }}
      onClick={(e) => e.stopPropagation()}
    >
      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tk-text-main)' }}>{label}</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
        {quick.map((q) => (
          <button key={q.label} type="button" onClick={() => setRg({ a: q.a, b: q.b })} style={chipStyle(rg.a === q.a && rg.b === q.b)}>
            {q.label}
          </button>
        ))}
      </div>
      <MonthGrid
        month={month}
        setMonth={setMonth}
        cellState={(v) => ({ sel: v === rg.a || v === rg.b, inRange: !!(rg.a && rg.b && v > rg.a && v < rg.b) })}
        onPick={pick}
      />
      <button
        type="button"
        disabled={!rg.a}
        onClick={() => {
          onApply(rg.a, rg.b || rg.a);
          onClose();
        }}
        className="tk-btn-primary"
        style={{ height: '32px', fontSize: '12px', justifyContent: 'center', opacity: rg.a ? 1 : 0.45 }}
      >
        Áp dụng
      </button>
    </div>
  );
}

export function RecurrencePopover({ currentRule, onSelect, onClose, style }) {
  const ref = useRef(null);

  usePopoverShell(ref, onClose);

  const options = [
    { label: 'Không lặp', rule: null, icon: 'minus' },
    { label: 'Hằng ngày', rule: { type: 'interval', days: 1 }, icon: 'repeat' },
    { label: 'Mỗi 2 ngày', rule: { type: 'interval', days: 2 }, icon: 'repeat' },
    { label: 'Hàng tuần', rule: { type: 'weekly', weekday: new Date().getDay() }, icon: 'calendar' },
    { label: 'Hàng tháng', rule: { type: 'monthly', day: new Date().getDate() }, icon: 'calendar' },
  ];

  return (
    <div
      ref={ref}
      className="tk-popover"
      style={{
        minWidth: '180px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        ...style,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--tk-text-mute)', padding: '4px 8px' }}>
        Chu kỳ lặp lại
      </div>
      {options.map((opt, idx) => {
        const isSelected = (!currentRule && !opt.rule) || (currentRule && opt.rule && currentRule.type === opt.rule.type);
        return (
          <button
            key={idx}
            type="button"
            onClick={() => {
              onSelect(opt.rule);
              onClose();
            }}
            style={{
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              background: isSelected ? 'var(--tk-accent-soft)' : 'transparent',
              color: isSelected ? 'var(--tk-accent, #5EF2C2)' : 'var(--tk-text-main)',
              fontSize: '12.5px',
              fontWeight: isSelected ? 600 : 400,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0 8px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <AppIcon name={opt.icon} size={14} color={isSelected ? 'var(--tk-accent, #5EF2C2)' : 'var(--tk-text-sub)'} />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Popover "Ngày" (mockup): sự kiện + việc của ngày, bấm việc để mở chi tiết,
 * ô gõ nhanh "Thêm việc cho ngày này, Enter" (mặc định hạn = ngày đó, giờ = ô vừa bấm).
 */
export function TaskDayPopover({ dateStr, time, holidays = [], tasks = [], onOpenTask, onCreate, onClose, style }) {
  const ref = useRef(null);
  usePopoverShell(ref, onClose);
  const [val, setVal] = useState('');
  const today = toDateStr();
  const d = new Date(`${dateStr}T00:00:00`);
  const lunar = solarToLunar(d.getDate(), d.getMonth() + 1, d.getFullYear());
  return (
    <div ref={ref} className="tk-popover tk-daypop" style={style} onClick={(e) => e.stopPropagation()}>
      <div className="tk-daypop__head">
        <span className="tk-daypop__title">
          {DOW_FULL[d.getDay()]}, {d.getDate()}/{d.getMonth() + 1}{time ? ` · ${time}` : ''}
        </span>
        <span className="tk-daypop__lunar">Âm {lunar.day}/{lunar.month}</span>
        <button type="button" className="tk-icon-btn" onClick={onClose} aria-label="Đóng">
          <AppIcon name="x" size={13} />
        </button>
      </div>
      {holidays.map((h) => (
        <span key={h} className="tk-daypop__ev">
          <AppIcon name="star" size={11} weight="fill" />
          {h}
        </span>
      ))}
      <div className="tk-daypop__list">
        {tasks.map((t) => {
          const m = taskCardModel(t, today);
          const st = STATUS_META[m.st];
          return (
            <button key={t.id} type="button" className="tk-daypop__item" style={ksStyle(m.k)} onClick={() => onOpenTask(t)}>
              <AppIcon name={st.icon} size={14} weight={st.weight} style={{ color: st.color, flex: 'none' }} />
              <span className={`tk-daypop__t${m.done ? ' is-done' : ''}`}>{t.title}</span>
              {t.due_date === dateStr && t.due_time && <span className="tk-daypop__tm">{t.due_time.slice(0, 5)}</span>}
            </button>
          );
        })}
        {tasks.length === 0 && <span className="tk-daypop__empty">Chưa có việc nào trong ngày.</span>}
      </div>
      <label className="tk-daypop__add">
        <AppIcon name="plus" size={13} />
        <input
          autoFocus
          value={val}
          placeholder="Thêm việc cho ngày này, Enter"
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && val.trim()) {
              onCreate(val.trim());
              setVal('');
            }
          }}
        />
      </label>
    </div>
  );
}
