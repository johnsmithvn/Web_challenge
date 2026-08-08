import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import '../styles/datepicker.css';
import { toDateStr } from '../utils/dateUtils';
import AppIcon from './AppIcon';

// ── Date helpers ──────────────────────────────────────────
const nowHHMM = () => { const n = new Date(); return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`; };

const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MONTH_NAMES = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function nextWeekday(target) {
  // target: 0=Sun..6=Sat — returns next occurrence (not today)
  const d = new Date();
  let diff = target - d.getDay();
  if (diff <= 0) diff += 7;
  return addDays(d, diff);
}

function fmtShortDay(d) {
  return WEEKDAY_LABELS[d.getDay()];
}

function fmtShortDate(d) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Range presets (mode="range") ──────────────────────────
// Cột shortcut ở chế độ khoảng nhìn LÙI (lịch sử), khác hẳn cột mặc định nhìn
// TỚI (hạn chót). setMonth() tự tràn khi ngày đích không tồn tại (31/8 lùi 6
// tháng → 3/3) — chấp nhận vì đây là cận dưới của bộ lọc.
const RANGE_SHORTCUTS = [
  { label: 'Hôm nay', days: 0 },
  { label: 'Hôm qua', days: 1, single: true },
  { label: '7 ngày',  days: 6 },
  { label: '2 tuần',  days: 13 },
  { label: '3 tháng', months: 3 },
  { label: '6 tháng', months: 6 },
  { label: '1 năm',   months: 12 },
];

export function rangeFromPreset(p) {
  const start = new Date();
  const end = new Date();
  if (p.single) { start.setDate(start.getDate() - p.days); end.setDate(end.getDate() - p.days); }
  else if (p.months) start.setMonth(start.getMonth() - p.months);
  else start.setDate(start.getDate() - p.days);
  return { from: toDateStr(start), to: toDateStr(end) };
}

// ── Calendar grid builder ─────────────────────────────────
function buildCalendar(year, month) {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];

  // Previous month fill
  const prevDays = new Date(year, month, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevDays - i);
    cells.push({ date: d, other: true });
  }

  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ date: new Date(year, month, i), other: false });
  }

  // Next month fill (to complete 6 rows)
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ date: new Date(year, month + 1, i), other: true });
  }

  return cells;
}

/**
 * DatePickerPopover — ClickUp-style date picker
 *
 * Uses internal draft state. User selects a date (highlight),
 * then clicks Save to confirm, or X to cancel.
 *
 * Props:
 *   value        — current date string (YYYY-MM-DD) or ''
 *   onChange      — (dateStr) => void — called on Save
 *   onClose       — () => void — called on Cancel/X
 *   timeValue    — current time string (HH:MM) or ''
 *   onTimeChange  — (timeStr) => void — called on Save with time
 *   hideTime     — if true, hide time input (for quick date-only pickers)
 *   style        — optional positioning styles for the popover
 *
 * ── mode="range" (v6.1.0) ────────────────────────────────────────────────
 * Cùng 1 component, chọn KHOẢNG thay vì 1 ngày. Khác biệt:
 *   value    — { from, to } thay cho chuỗi ngày
 *   onChange — nhận { from, to } (to luôn >= from)
 *   cột shortcut đổi sang preset nhìn lùi (Hôm nay/Hôm qua/7 ngày/…)
 *   ô giờ luôn ẩn (khoảng ngày không có giờ)
 * Click 1: đặt mốc đầu. Click 2: đặt mốc cuối (click trước mốc đầu thì tự
 * đảo). Click 3: bắt đầu khoảng mới.
 */
export default function DatePickerPopover({ value, onChange, onClose, timeValue, onTimeChange, hideTime, mode = 'single', style }) {
  const isRange = mode === 'range';
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toDateStr(today), [today]);

  // Draft state — internal selection before Save
  const [draft, setDraft] = useState(isRange ? '' : (value || ''));
  const [rFrom, setRFrom] = useState(isRange ? (value?.from || '') : '');
  const [rTo, setRTo]     = useState(isRange ? (value?.to || '') : '');
  // Default time: use provided value, or current HH:MM if none
  const [draftTime, setDraftTime] = useState(timeValue || nowHHMM());

  // Calendar view month
  const initialSeed = isRange ? (value?.from || todayStr) : value;
  const initialDate = initialSeed ? new Date(initialSeed + 'T00:00:00') : today;
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  const popoverRef = useRef(null);

  // Click outside = cancel
  useEffect(() => {
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // ── Shortcuts ──
  const shortcuts = useMemo(() => {
    const mon = nextWeekday(1);
    return [
      { label: 'Hôm nay', date: today, day: fmtShortDay(today) },
      { label: 'Ngày mai', date: addDays(today, 1), day: fmtShortDay(addDays(today, 1)) },
      { label: 'Thứ Hai', date: mon, day: fmtShortDay(mon) },
      { label: 'Tuần sau', date: addDays(today, 7), day: fmtShortDate(addDays(today, 7)) },
      { label: '2 tuần', date: addDays(today, 14), day: fmtShortDate(addDays(today, 14)) },
      { label: '4 tuần', date: addDays(today, 28), day: fmtShortDate(addDays(today, 28)) },
      { label: '8 tuần', date: addDays(today, 56), day: fmtShortDate(addDays(today, 56)) },
    ];
  }, [today]);

  // ── Calendar cells ──
  const cells = useMemo(() => buildCalendar(viewYear, viewMonth), [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  // Click 1 → mốc đầu, click 2 → mốc cuối, click 3 → khoảng mới.
  const pickRange = (ds) => {
    if (!rFrom || rTo) { setRFrom(ds); setRTo(''); }
    else if (ds < rFrom) { setRTo(rFrom); setRFrom(ds); }
    else setRTo(ds);
  };

  // ── Save / Cancel ──
  const handleSave = useCallback(() => {
    if (isRange) {
      // Chưa chọn mốc cuối → coi như khoảng 1 ngày.
      onChange({ from: rFrom, to: rTo || rFrom });
      onClose();
      return;
    }
    onChange(draft);
    if (onTimeChange) {
      // Always save time — default to '00:00' if user cleared it
      onTimeChange(draftTime || '00:00');
    }
    onClose();
  }, [isRange, rFrom, rTo, draft, draftTime, onChange, onTimeChange, onClose]);

  const fmtLong = (ds) => new Date(ds + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const draftLabel = draft
    ? new Date(draft + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'short' })
    : null;

  const hasChanges = isRange
    ? (rFrom !== (value?.from || '') || (rTo || rFrom) !== (value?.to || ''))
    : (draft !== (value || '') || draftTime !== (timeValue || nowHHMM()));
  const showTimeInput = !hideTime && !isRange;

  return (
    <div ref={popoverRef} className="dp-popover" style={style}>
      {/* ── Header ── */}
      <div className="dp-header">
        {isRange ? (
          <>
            <span className={`dp-header__tab${!rTo ? ' dp-header__tab--active' : ''}`}>
              <AppIcon name="calendar" size={14} /> Từ: {rFrom ? fmtLong(rFrom) : '—'}
            </span>
            <span className={`dp-header__tab${rTo ? ' dp-header__tab--active' : ''}`}>
              <AppIcon name="calendar" size={14} /> Đến: {rTo ? fmtLong(rTo) : '—'}
            </span>
            {(rFrom || rTo) && (
              <button className="dp-header__value-clear" onClick={() => { setRFrom(''); setRTo(''); }}
                title="Xoá khoảng" aria-label="Xoá khoảng"><AppIcon name="x" size={13} /></button>
            )}
          </>
        ) : (
          <>
            <span className="dp-header__tab dp-header__tab--active"><AppIcon name="calendar" size={14} /> Bắt đầu lúc</span>
            {draftLabel && (
              <span className="dp-header__value">
                {draftLabel}
                {draftTime && <span style={{ opacity: 0.7, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}> · <AppIcon name="clock" size={13} /> {draftTime}</span>}
                <button className="dp-header__value-clear" onClick={() => { setDraft(''); setDraftTime(''); }} title="Xoá" aria-label="Xóa ngày"><AppIcon name="x" size={13} /></button>
              </span>
            )}
          </>
        )}
      </div>

      {/* ── Body ── */}
      <div className="dp-body">
        {/* Left: Shortcuts — mode range đổi hẳn sang preset nhìn lùi */}
        <div className="dp-shortcuts">
          {isRange ? RANGE_SHORTCUTS.map((s, i) => {
            const r = rangeFromPreset(s);
            const active = rFrom === r.from && (rTo || rFrom) === r.to;
            return (
              <button
                key={i}
                className={`dp-shortcut${active ? ' dp-shortcut--active' : ''}`}
                onClick={() => {
                  setRFrom(r.from); setRTo(r.to);
                  const d = new Date(r.to + 'T00:00:00');
                  setViewYear(d.getFullYear());
                  setViewMonth(d.getMonth());
                }}
              >
                <span>{s.label}</span>
                <span className="dp-shortcut__day">{fmtShortDate(new Date(r.from + 'T00:00:00'))}</span>
              </button>
            );
          }) : shortcuts.map((s, i) => (
            <button
              key={i}
              className={`dp-shortcut${draft === toDateStr(s.date) ? ' dp-shortcut--active' : ''}`}
              onClick={() => {
                setDraft(toDateStr(s.date));
                setViewYear(s.date.getFullYear());
                setViewMonth(s.date.getMonth());
              }}
            >
              <span>{s.label}</span>
              <span className="dp-shortcut__day">{s.day}</span>
            </button>
          ))}
        </div>

        {/* Right: Calendar */}
        <div className="dp-calendar">
          <div className="dp-calendar__nav">
            <span className="dp-calendar__title">
              {MONTH_NAMES[viewMonth]}, {viewYear}
            </span>
            <div className="dp-calendar__nav-btns">
              <button className="dp-calendar__nav-btn dp-calendar__today-btn" onClick={goToday}>
                Hôm nay
              </button>
              <button className="dp-calendar__nav-btn" onClick={prevMonth}>‹</button>
              <button className="dp-calendar__nav-btn" onClick={nextMonth}>›</button>
            </div>
          </div>

          <div className="dp-grid">
            {/* Weekday headers */}
            {WEEKDAY_LABELS.map(d => (
              <div key={d} className="dp-grid__head">{d}</div>
            ))}

            {/* Day cells */}
            {cells.map((cell, i) => {
              const ds = toDateStr(cell.date);
              const isToday = ds === todayStr;
              let cls = 'dp-grid__cell';
              if (cell.other) cls += ' dp-grid__cell--other';
              if (isToday) cls += ' dp-grid__cell--today';
              if (isRange) {
                if (ds === rFrom || (rTo && ds === rTo)) cls += ' dp-grid__cell--selected';
                if (rTo && ds > rFrom && ds < rTo) cls += ' dp-grid__cell--in-range';
              } else if (ds === draft) {
                cls += ' dp-grid__cell--selected';
              }

              return (
                <button
                  key={i}
                  className={cls}
                  onClick={() => {
                    if (isRange) pickRange(ds); else setDraft(ds);
                    if (cell.other) {
                      setViewYear(cell.date.getFullYear());
                      setViewMonth(cell.date.getMonth());
                    }
                  }}
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Time input (always visible unless hideTime) ── */}
      {showTimeInput && (
        <div className="dp-time">
          <span className="dp-time__label"><AppIcon name="clock" size={14} /> Giờ bắt đầu</span>
          <input
            type="time"
            className="dp-time__input"
            value={draftTime}
            onChange={(e) => setDraftTime(e.target.value)}
          />
          <button
            type="button"
            className="dp-time__now-btn"
            onClick={() => setDraftTime(nowHHMM())}
            title="Đặt giờ hiện tại"
          >Bây giờ</button>
        </div>
      )}

      {/* ── Footer: Save / Close ── */}
      <div className="dp-footer">
        <button className="dp-footer__cancel" onClick={onClose} title="Huỷ">
          <AppIcon name="x" size={14} /> Huỷ
        </button>
        <button
          className={`dp-footer__save${hasChanges ? ' dp-footer__save--active' : ''}`}
          onClick={handleSave}
          disabled={isRange ? !rFrom : !draft}
          title="Lưu"
        >
          <AppIcon name="check" size={14} /> Lưu
        </button>
      </div>
    </div>
  );
}
