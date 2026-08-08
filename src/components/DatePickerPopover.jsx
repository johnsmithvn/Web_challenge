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
 */
export default function DatePickerPopover({ value, onChange, onClose, timeValue, onTimeChange, hideTime, style }) {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toDateStr(today), [today]);

  // Draft state — internal selection before Save
  const [draft, setDraft] = useState(value || '');
  // Default time: use provided value, or current HH:MM if none
  const [draftTime, setDraftTime] = useState(timeValue || nowHHMM());

  // Calendar view month
  const initialDate = value ? new Date(value + 'T00:00:00') : today;
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

  // ── Save / Cancel ──
  const handleSave = useCallback(() => {
    onChange(draft);
    if (onTimeChange) {
      // Always save time — default to '00:00' if user cleared it
      onTimeChange(draftTime || '00:00');
    }
    onClose();
  }, [draft, draftTime, onChange, onTimeChange, onClose]);

  const draftLabel = draft
    ? new Date(draft + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'short' })
    : null;

  const hasChanges = draft !== (value || '') || draftTime !== (timeValue || nowHHMM());
  const showTimeInput = !hideTime;

  return (
    <div ref={popoverRef} className="dp-popover" style={style}>
      {/* ── Header ── */}
      <div className="dp-header">
        <span className="dp-header__tab dp-header__tab--active"><AppIcon name="calendar" size={14} /> Bắt đầu lúc</span>
        {draftLabel && (
          <span className="dp-header__value">
            {draftLabel}
            {draftTime && <span style={{ opacity: 0.7 }}> · ⏰ {draftTime}</span>}
            <button className="dp-header__value-clear" onClick={() => { setDraft(''); setDraftTime(''); }} title="Xoá" aria-label="Xóa ngày"><AppIcon name="x" size={13} /></button>
          </span>
        )}
      </div>

      {/* ── Body ── */}
      <div className="dp-body">
        {/* Left: Shortcuts */}
        <div className="dp-shortcuts">
          {shortcuts.map((s, i) => (
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
              const isSelected = ds === draft;
              let cls = 'dp-grid__cell';
              if (cell.other) cls += ' dp-grid__cell--other';
              if (isToday) cls += ' dp-grid__cell--today';
              if (isSelected) cls += ' dp-grid__cell--selected';

              return (
                <button
                  key={i}
                  className={cls}
                  onClick={() => {
                    setDraft(ds);
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
          <span className="dp-time__label">⏰ Giờ bắt đầu</span>
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
          disabled={!draft}
          title="Lưu"
        >
          <AppIcon name="check" size={14} /> Lưu
        </button>
      </div>
    </div>
  );
}
