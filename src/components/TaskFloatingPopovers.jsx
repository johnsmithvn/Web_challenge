import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import AppIcon from './AppIcon';
import { PRIORITY_LABELS } from '../utils/taskNlpParser';
import { STATUS_META, ksStyle, taskCardModel } from '../utils/kanbanUtils';
import { toDateStr } from '../utils/dateUtils';
import { solarToLunar, lunarLabel } from '../utils/lunarUtils';
import { datePickDraft, datePickPatch } from '../utils/calendarTimeUtils';
import '../styles/date-popover.css';

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

/**
 * Lưới tháng (CN đầu tuần) có ngày âm dưới mỗi ô. `cellState(v)` → { sel, inRange, edge: 'a'|'b', off }
 * (off = ngày không chọn được, vd sau mốc `max`).
 * nav 'center' = ‹ Tháng › (popover đổi hạn) · 'left' = Tháng ‹ › (popover lọc khoảng ngày) như mockup.
 * joined: ô trong khoảng nối liền (bo 2 đầu khoảng) — popover đổi hạn.
 */
function MonthGrid({ month, setMonth, cellState, onPick, nav = 'center', joined = false }) {
  const todayStr = toDateStr();
  const Y = month.getFullYear();
  const M = month.getMonth();
  const first = new Date(Y, M, 1).getDay();
  const nd = new Date(Y, M + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= nd; d++) cells.push(d);
  const prev = (
    <button type="button" className="tk-dp-navbtn" onClick={() => setMonth(new Date(Y, M - 1, 1))} aria-label="Tháng trước">
      <AppIcon name="caretLeft" size={12} />
    </button>
  );
  const next = (
    <button type="button" className="tk-dp-navbtn" onClick={() => setMonth(new Date(Y, M + 1, 1))} aria-label="Tháng sau">
      <AppIcon name="caretRight" size={12} />
    </button>
  );
  const title = <span className="tk-dp-title">Tháng {M + 1}, {Y}</span>;

  return (
    <>
      <div className={`tk-dp-nav is-${nav}`}>
        {nav === 'center' ? <>{prev}{title}{next}</> : <>{title}{prev}{next}</>}
      </div>
      <div className={`tk-dp-grid${joined ? ' is-joined' : ''}`}>
        {DOW_SHORT.map((d, i) => (
          <span key={d} className={`tk-dp-dow${i === 0 ? ' is-sun' : ''}`}>{d}</span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const v = toDateStr(new Date(Y, M, d));
          const { sel, inRange, edge, off } = cellState(v);
          const cls = [
            'tk-cal-cell',
            sel ? 'is-sel' : inRange ? 'is-range' : '',
            joined && edge ? `is-edge-${edge}` : '',
            v === todayStr && !sel ? 'is-today' : '',
            (first + d - 1) % 7 === 0 ? 'is-sun' : '',
          ].filter(Boolean).join(' ');
          return (
            <button key={v} type="button" onClick={() => onPick(v)} className={cls} disabled={off}>
              <span className="tk-cal-cell__n">{d}</span>
              <span className="tk-cal-cell__l">{lunarLabel(solarToLunar(d, M + 1, Y))}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

const dayLabel = (v) => {
  const d = new Date(`${v}T00:00:00`);
  return `${DOW_SHORT[d.getDay()]}, ${d.getDate()} thg ${d.getMonth() + 1}`;
};

/**
 * Chọn MỘT ngày (ô ngày của Finance): cùng khung 256px + lịch âm với popover đổi hạn, bấm ngày là
 * chọn luôn — không cần Lưu. `max` khóa các ngày sau mốc. Escape chỉ đóng lịch, không lọt ra hộp
 * thoại bọc ngoài (form Thêm/Sửa bắt Escape để đóng chính nó). Thường được portal ra ngoài khung
 * cuộn → chặn mousedown để popover bọc ngoài (bộ lọc, InfoTip…) không tưởng là bấm ra ngoài.
 */
export function DatePopover({ value, max, onPick, onClose, style, className = '' }) {
  const ref = useRef(null);
  usePopoverShell(ref, onClose);
  const todayStr = toDateStr();
  const [month, setMonth] = useState(() => monthOf(value || todayStr));
  const pick = (v) => {
    onPick(v);
    onClose();
  };

  return (
    <div
      ref={ref}
      className={`tk-popover tk-datepick ${className}`}
      style={style}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        onClose();
      }}
    >
      <MonthGrid
        month={month}
        setMonth={setMonth}
        cellState={(v) => ({ sel: v === value, off: Boolean(max && v > max) })}
        onPick={pick}
      />
      <div className="tk-dp-foot">
        {value && (
          <button type="button" className="tk-dp-btn" onClick={() => pick('')}>
            <AppIcon name="x" size={12} />
            Bỏ ngày
          </button>
        )}
        <button type="button" className="tk-dp-btn tk-dp-cancel" onClick={onClose}>Huỷ</button>
        <button type="button" className="tk-dp-save" disabled={Boolean(max && todayStr > max)} onClick={() => pick(todayStr)}>
          Hôm nay
        </button>
      </div>
    </div>
  );
}

/**
 * Đổi ngày giờ của việc (mockup): ô Bắt đầu + Kết thúc (tuỳ chọn), lịch có ngày âm, dòng giờ bắt đầu → kết thúc.
 * Ô đang chọn quyết định ngày bấm: Bắt đầu đặt ngày chính (giữ Kết thúc nếu vẫn sau); Kết thúc đặt ngày cuối
 * (bấm trước Bắt đầu thì thành Bắt đầu mới). ✕ "Bỏ hạn" xoá hết, ✕ "Bỏ ngày kết thúc" chỉ bỏ ngày cuối.
 * Chỉ lưu khi bấm Lưu (mờ khi chưa đổi); onSave nhận patch { start_date, start_time, due_date, due_time }.
 */
export function TaskDatePickerPopover({ task, onSave, onClose, style }) {
  const ref = useRef(null);
  usePopoverShell(ref, onClose);

  const [dr, setDr] = useState(() => datePickDraft(task));
  const [field, setField] = useState('a');
  const [timeOn, setTimeOn] = useState(() => !!(dr.ta || dr.tb));
  const [month, setMonth] = useState(() => monthOf(dr.a || toDateStr()));
  const B = dr.a && dr.b && dr.b > dr.a ? dr.b : null;

  const pick = (v) => {
    if (field === 'b' && dr.a) setDr((d) => (v < d.a ? { ...d, a: v } : { ...d, b: v === d.a ? null : v }));
    else setDr((d) => ({ ...d, a: v, b: d.b && d.b > v ? d.b : null }));
  };
  const clearA = (e) => {
    e.stopPropagation();
    setDr({ a: null, b: null, ta: null, tb: null });
    setTimeOn(false);
    setField('a');
  };
  const clearB = (e) => {
    e.stopPropagation();
    setDr((d) => ({ ...d, b: null }));
    setField('a');
  };
  const addTime = () => {
    setTimeOn(true);
    setDr((d) => ({ ...d, a: d.a || toDateStr(), ta: d.ta || '09:00' }));
  };
  const noTime = () => {
    setTimeOn(false);
    setDr((d) => ({ ...d, ta: null, tb: null }));
  };

  const patch = datePickPatch({ ...dr, b: B });
  // So với nháp lúc mở (đã quy về dạng popover lưu), không so với task gốc: task dạng popover không biểu diễn
  // được (vd chỉ có Bắt đầu) sẽ không tự sáng Lưu và không bị đổi khi người dùng chưa chỉnh gì.
  const [base] = useState(() => datePickPatch(datePickDraft(task)));
  const dirty = Object.keys(patch).some((k) => patch[k] !== base[k]);
  const save = () => {
    if (dirty) onSave(patch);
    onClose();
  };

  const fields = [
    { k: 'a', label: 'Bắt đầu', val: dr.a, empty: 'Không hạn', clear: clearA, clearTip: 'Bỏ hạn' },
    { k: 'b', label: 'Kết thúc', val: B, empty: 'Tuỳ chọn', clear: clearB, clearTip: 'Bỏ ngày kết thúc' },
  ];

  return (
    <div ref={ref} className="tk-popover tk-datepick" style={style} onClick={(e) => e.stopPropagation()}>
      <div className="tk-dp-fields">
        {fields.map((f) => (
          <div
            key={f.k}
            role="button"
            tabIndex={0}
            className={`tk-dp-field${field === f.k ? ' is-on' : ''}`}
            onClick={() => setField(f.k)}
            onKeyDown={(e) => e.key === 'Enter' && setField(f.k)}
          >
            <span className="tk-dp-field__text">
              <span className="tk-dp-field__lbl">{f.label}</span>
              <span className={`tk-dp-field__val${f.val ? '' : ' is-empty'}`}>{f.val ? dayLabel(f.val) : f.empty}</span>
            </span>
            {f.val && (
              <button type="button" className="tk-dp-x" title={f.clearTip} aria-label={f.clearTip} onClick={f.clear}>
                <AppIcon name="x" size={11} />
              </button>
            )}
          </div>
        ))}
      </div>

      <MonthGrid
        month={month}
        setMonth={setMonth}
        joined
        cellState={(v) => ({
          sel: v === dr.a || v === B,
          inRange: !!(B && v > dr.a && v < B),
          edge: B && v === dr.a ? 'a' : B && v === B ? 'b' : null,
        })}
        onPick={pick}
      />

      {timeOn && (
        <div className="tk-dp-timerow">
          <AppIcon name="clock" size={13} className="tk-dp-timerow__ic" />
          <input type="time" aria-label="Giờ bắt đầu" value={dr.ta || ''} onChange={(e) => setDr((d) => ({ ...d, a: d.a || toDateStr(), ta: e.target.value || null }))} />
          <AppIcon name="arrowRight" size={11} className="tk-dp-timerow__arrow" />
          <input type="time" aria-label="Giờ kết thúc" value={dr.tb || ''} onChange={(e) => setDr((d) => ({ ...d, tb: e.target.value || null }))} />
          <button type="button" className="tk-dp-x" title="Bỏ giờ" aria-label="Bỏ giờ" onClick={noTime}>
            <AppIcon name="x" size={11} />
          </button>
        </div>
      )}

      <div className="tk-dp-foot">
        {!timeOn && (
          <button type="button" className="tk-dp-btn" onClick={addTime}>
            <AppIcon name="clock" size={13} />
            Thêm giờ
          </button>
        )}
        <button type="button" className="tk-dp-btn tk-dp-cancel" onClick={onClose}>Huỷ</button>
        <button type="button" className={`tk-dp-save${dirty ? '' : ' is-idle'}`} onClick={save}>
          <AppIcon name="check" size={12} />
          Lưu
        </button>
      </div>
    </div>
  );
}

/** Lọc theo khoảng ngày (mockup): nhãn khoảng · 4 khoảng nhanh · lịch có ngày âm · "Bấm ngày đầu, rồi ngày cuối". */
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
  const apply = () => {
    if (!rg.a) return;
    onApply(rg.a, rg.b || rg.a);
    onClose();
  };

  return (
    <div ref={ref} className="tk-popover tk-datepick" style={style} onClick={(e) => e.stopPropagation()}>
      <div className="tk-rp-head">
        <AppIcon name="calendar" size={13} className="tk-rp-head__ic" />
        <span className="tk-rp-head__lbl">{label}</span>
      </div>
      <div className="tk-rp-quick">
        {quick.map((q) => (
          <button
            key={q.label}
            type="button"
            title={`${shortDM(q.a)} – ${shortDM(q.b)}`}
            className={`tk-rp-chip${rg.a === q.a && rg.b === q.b ? ' is-on' : ''}`}
            onClick={() => setRg({ a: q.a, b: q.b })}
          >
            {q.label}
          </button>
        ))}
      </div>
      <MonthGrid
        month={month}
        setMonth={setMonth}
        nav="left"
        cellState={(v) => ({ sel: v === rg.a || v === rg.b, inRange: !!(rg.a && rg.b && v > rg.a && v < rg.b) })}
        onPick={pick}
      />
      <div className="tk-dp-foot">
        <span className="tk-rp-hint">Bấm ngày đầu, rồi ngày cuối</span>
        <button type="button" className="tk-dp-btn" onClick={onClose}>Huỷ</button>
        <button type="button" className={`tk-dp-save${rg.a ? '' : ' is-idle'}`} onClick={apply}>
          <AppIcon name="check" size={12} />
          Áp dụng
        </button>
      </div>
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
