import { useEffect, useMemo, useState } from 'react';
import { getWeekDays } from '../utils/calendarTimeUtils';
import { solarToLunar, getCanChiYear, getCanChiMonth, getCanChiDay } from '../utils/lunarUtils';
import { toDateStr } from '../utils/dateUtils';
import AppIcon from './AppIcon';

/*
 * CalendarToolbar — điều hướng của trang Nhiệm vụ theo mockup "Kanban tối & sáng":
 *   TaskViewSwitcher : segmented 6 chế độ xem nằm trong header (desktop) + phím tắt L/K/A/D/W/M/T
 *   MobileViewMenu   : nút "<icon> Tên view ▾" mở menu 5 chế độ (mobile bỏ Tuần vì chật)
 *   CalendarNavHead  : hàng đầu khung lịch — nhãn kỳ, phụ đề âm lịch, Hôm nay, ‹ ›
 */

const TASK_VIEWS = [
  { id: 'list', label: 'Danh sách', icon: 'listBullets', key: 'l' },
  { id: 'kanban', label: 'Kanban', icon: 'kanban', key: 'k' },
  { id: 'agenda', label: 'Lịch biểu', icon: 'rows', key: 'a' },
  { id: 'day', label: 'Ngày', icon: 'sun', key: 'd' },
  { id: 'week', label: 'Tuần', icon: 'columns', key: 'w' },
  { id: 'month', label: 'Tháng', icon: 'calendar', key: 'm' },
];

const DFULL = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export function TaskViewSwitcher({ activeView, setActiveView, setCurrentDate }) {
  // Phím tắt: L/K/A/D/W/M chọn view, T về hôm nay (bỏ qua khi đang gõ chữ)
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const v = TASK_VIEWS.find((x) => x.key === key);
      if (v) {
        e.preventDefault();
        setActiveView(v.id);
      } else if (key === 't') {
        e.preventDefault();
        setCurrentDate(new Date());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setActiveView, setCurrentDate]);

  return (
    <div className="tk-views-switcher" role="tablist" aria-label="Chế độ xem">
      {TASK_VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          role="tab"
          aria-selected={activeView === v.id}
          className={`tk-view-btn${activeView === v.id ? ' tk-view-btn--active' : ''}`}
          onClick={() => setActiveView(v.id)}
          title={`${v.label} (phím ${v.key.toUpperCase()})`}
        >
          <AppIcon name={v.icon} size={14} />
          {v.label}
        </button>
      ))}
    </div>
  );
}

export function MobileViewMenu({ activeView, setActiveView }) {
  const [open, setOpen] = useState(false);
  const views = TASK_VIEWS.filter((v) => v.id !== 'week');
  const cur = views.find((v) => v.id === activeView) || views[0];
  return (
    <div className="tk-vmenu">
      <button type="button" className="tk-vmenu__btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <AppIcon name={cur.icon} size={19} style={{ color: 'var(--tk-accent)' }} />
        <span>{cur.label}</span>
        <AppIcon name="caretDown" size={13} style={{ color: 'var(--tk-text-sub)' }} />
      </button>
      {open && (
        <>
          <div className="tk-vmenu__scrim" onClick={() => setOpen(false)} />
          <div className="tk-vmenu__list" role="menu">
            {views.map((v) => (
              <button
                key={v.id}
                type="button"
                role="menuitem"
                className={`tk-vmenu__item${v.id === cur.id ? ' is-on' : ''}`}
                onClick={() => {
                  setActiveView(v.id);
                  setOpen(false);
                }}
              >
                <AppIcon name={v.icon} size={18} />
                <span>{v.label}</span>
                <AppIcon name="check" size={15} style={{ opacity: v.id === cur.id ? 1 : 0 }} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Nhãn + phụ đề của hàng điều hướng khung lịch theo từng view. */
function navLabels(view, date, startOnSunday) {
  const dd = date.getDate();
  const mm = date.getMonth() + 1;
  const yy = date.getFullYear();
  const lunar = solarToLunar(dd, mm, yy);
  const year = getCanChiYear(lunar.year);
  const isToday = toDateStr(date) === toDateStr();

  if (view === 'day') {
    return {
      label: `${isToday ? 'Hôm nay · ' : ''}${DFULL[date.getDay()]}, ${dd} tháng ${mm}`,
      sub: `Âm lịch ${lunar.day}/${lunar.month} · ngày ${getCanChiDay(dd, mm, yy).full}, tháng ${getCanChiMonth(lunar.year, lunar.month)}`,
      today: 'Hôm nay',
    };
  }
  if (view === 'week') {
    const days = getWeekDays(date, startOnSunday);
    const a = days[0].date;
    const b = days[6].date;
    return {
      label: `Tuần ${a.getDate()}/${a.getMonth() + 1} – ${b.getDate()}/${b.getMonth() + 1}, ${b.getFullYear()}`,
      sub: year,
      today: 'Tuần này',
    };
  }
  if (view === 'month') return { label: `Tháng ${mm}, ${yy}`, sub: year, today: 'Hôm nay' };
  return { label: '', sub: '', today: 'Hôm nay' }; // Lịch biểu tự truyền label/sub (cần số việc & khoảng ngày)
}

// extra: số liệu view tự báo lên (mockup: Tuần "N việc có giờ, M cả ngày", Tháng "N việc có hạn") — nối sau năm can chi
export default function CalendarNavHead({ activeView, currentDate, setCurrentDate, startOnSunday, setStartOnSunday, label: labelProp, sub: subProp, extra }) {
  const auto = useMemo(() => {
    const date = currentDate instanceof Date && !Number.isNaN(currentDate.getTime()) ? currentDate : new Date();
    return navLabels(activeView, date, startOnSunday);
  }, [activeView, currentDate, startOnSunday]);
  const label = labelProp ?? auto.label;
  const sub = subProp ?? (extra ? `${auto.sub} · ${extra}` : auto.sub);
  const { today } = auto;

  const shift = (dir) => {
    setCurrentDate((prev) => {
      const d = new Date(prev || new Date());
      if (activeView === 'day') d.setDate(d.getDate() + dir);
      else if (activeView === 'month') d.setMonth(d.getMonth() + dir, 1);
      else d.setDate(d.getDate() + 7 * dir);
      return d;
    });
  };

  return (
    <div className={`tk-cal-head tk-cal-head--${activeView}`}>
      <button type="button" className="tk-cal-head__arrow tk-cal-head__arrow--m" onClick={() => shift(-1)} aria-label="Trước">
        <AppIcon name="caretLeft" size={16} />
      </button>
      <div className="tk-cal-head__text">
        <span className="tk-cal-head__label">{label}</span>
        <span className="tk-cal-head__sub">{sub}</span>
      </div>
      <button type="button" className="tk-cal-head__arrow tk-cal-head__arrow--m" onClick={() => shift(1)} aria-label="Sau">
        <AppIcon name="caretRight" size={16} />
      </button>

      <div className="tk-cal-head__actions">
        {(activeView === 'week' || activeView === 'month') && setStartOnSunday && (
          <button
            type="button"
            className="tk-cal-head__btn tk-cal-head__btn--soft"
            title="Đổi ngày bắt đầu tuần"
            onClick={() => setStartOnSunday((prev) => {
              const next = !prev;
              try { localStorage.setItem('lh_cal_start_sun', String(next)); } catch { /* bỏ qua */ }
              return next;
            })}
          >
            Tuần từ {startOnSunday ? 'CN' : 'T2'}
          </button>
        )}
        <button type="button" className="tk-cal-head__btn" onClick={() => setCurrentDate(new Date())}>
          {today}
        </button>
        <button type="button" className="tk-cal-head__arrow" onClick={() => shift(-1)} aria-label="Trước">
          <AppIcon name="caretLeft" size={13} />
        </button>
        <button type="button" className="tk-cal-head__arrow" onClick={() => shift(1)} aria-label="Sau">
          <AppIcon name="caretRight" size={13} />
        </button>
      </div>
    </div>
  );
}
