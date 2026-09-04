import { useEffect, useCallback, useMemo } from 'react';
import { getWeekDays } from '../utils/calendarTimeUtils';
import { solarToLunar, getCanChiYear, getCanChiDay } from '../utils/lunarUtils';
import AppIcon from './AppIcon';
import '../styles/week-calendar.css';

/**
 * CalendarToolbar — Thanh điều hướng lịch All-in-one chuẩn Google Calendar & Notion Calendar.
 * Tích hợp:
 * 1. Điều hướng thời gian (Hôm nay, < >, Tiêu đề tháng/năm kèm Can Chi bản địa hóa)
 * 2. Segmented View Switcher: Danh sách | Lịch biểu (Agenda) | Ngày | Tuần | Tháng
 * 3. Nút Thêm công việc nhanh & Toggle Widget Panel bên phải
 */
export default function CalendarToolbar({
  currentDate = new Date(),
  setCurrentDate,
  activeView = 'week',
  setActiveView,
  startOnSunday = true,
  setStartOnSunday,
  isWidgetOpen = false,
  onToggleWidget,
  onAddNewTask,
  taskCount = 0,
}) {
  // Phím tắt bàn phím thông minh: D (Ngày), W (Tuần), M (Tháng), A (Lịch biểu), L (Danh sách), T (Hôm nay)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (key === 'w') {
        e.preventDefault();
        setActiveView('week');
      } else if (key === 'm') {
        e.preventDefault();
        setActiveView('month');
      } else if (key === 'd') {
        e.preventDefault();
        setActiveView('day');
      } else if (key === 'a') {
        e.preventDefault();
        setActiveView('agenda');
      } else if (key === 'l') {
        e.preventDefault();
        setActiveView('list');
      } else if (key === 't') {
        e.preventDefault();
        setCurrentDate(new Date());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveView, setCurrentDate]);

  // Tính toán nhãn tiêu đề ngày tháng kèm Can Chi
  const titleLabel = useMemo(() => {
    const d = currentDate instanceof Date && !isNaN(currentDate) ? currentDate : new Date();
    const dd = d.getDate();
    const mm = d.getMonth() + 1;
    const yy = d.getFullYear();

    const lunar = solarToLunar(dd, mm, yy);
    const canChiYear = getCanChiYear(lunar.year);

    if (activeView === 'day') {
      const dayName = d.toLocaleDateString('vi-VN', { weekday: 'short' });
      const canChiDay = getCanChiDay(dd, mm, yy);
      return `${dayName}, ${dd} thg ${mm}, ${yy} · ${canChiDay.full}`;
    }

    if (activeView === 'week') {
      const days = getWeekDays(d, startOnSunday);
      const d1 = days[0]?.date || d;
      const d2 = days[6]?.date || d;
      const m1 = d1.getMonth() + 1;
      const y1 = d1.getFullYear();
      const m2 = d2.getMonth() + 1;
      const y2 = d2.getFullYear();

      if (y1 === y2) {
        if (m1 === m2) {
          return `Tháng ${m1}, ${y1} · ${canChiYear}`;
        }
        return `Thg ${m1} – Thg ${m2}, ${y1} · ${canChiYear}`;
      }
      return `Thg ${m1}, ${y1} – Thg ${m2}, ${y2} · ${canChiYear}`;
    }

    // Month / Agenda / List view
    const mLabel = d.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
    const formatted = mLabel.charAt(0).toUpperCase() + mLabel.slice(1);
    return `${formatted} · ${canChiYear}`;
  }, [activeView, currentDate, startOnSunday]);

  const goToday = useCallback(() => {
    setCurrentDate(new Date());
  }, [setCurrentDate]);

  const goPrev = useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (activeView === 'day') {
        d.setDate(d.getDate() - 1);
      } else if (activeView === 'week') {
        d.setDate(d.getDate() - 7);
      } else if (activeView === 'month') {
        d.setMonth(d.getMonth() - 1);
      } else {
        d.setDate(d.getDate() - 14);
      }
      return d;
    });
  }, [activeView, setCurrentDate]);

  const goNext = useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (activeView === 'day') {
        d.setDate(d.getDate() + 1);
      } else if (activeView === 'week') {
        d.setDate(d.getDate() + 7);
      } else if (activeView === 'month') {
        d.setMonth(d.getMonth() + 1);
      } else {
        d.setDate(d.getDate() + 14);
      }
      return d;
    });
  }, [activeView, setCurrentDate]);

  const toggleStartDay = useCallback(() => {
    if (!setStartOnSunday) return;
    setStartOnSunday((prev) => {
      const next = !prev;
      localStorage.setItem('lh_cal_start_sun', String(next));
      return next;
    });
  }, [setStartOnSunday]);

  return (
    <div className="cal-header-bar">
      {/* Cụm điều hướng bên trái: Hôm nay, < >, Tiêu đề Can Chi */}
      <div className="cal-header-bar__left">
        <button
          type="button"
          className="cal-header-bar__btn-today"
          onClick={goToday}
          title="Về hôm nay (Phím tắt: T)"
        >
          Hôm nay
        </button>

        <div className="cal-header-bar__nav-arrows">
          <button
            type="button"
            className="cal-header-bar__arrow-btn"
            onClick={goPrev}
            aria-label="Lùi thời gian"
            title="Trước đó"
          >
            <AppIcon name="caretLeft" size={16} />
          </button>
          <button
            type="button"
            className="cal-header-bar__arrow-btn"
            onClick={goNext}
            aria-label="Tiến thời gian"
            title="Kế tiếp"
          >
            <AppIcon name="caretRight" size={16} />
          </button>
        </div>

        <h2 className="cal-header-bar__title">
          {titleLabel}
        </h2>
      </div>

      {/* Cụm giữa: Segmented View Switcher (5 chế độ xem) */}
      <div className="cal-segmented-control" role="tablist" aria-label="Chế độ xem lịch">
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'list'}
          className={`cal-segmented-btn${activeView === 'list' ? ' cal-segmented-btn--active' : ''}`}
          onClick={() => setActiveView('list')}
          title="Danh sách việc cần làm (Phím tắt: L)"
        >
          <AppIcon name="list" size={14} /> Danh sách
          {taskCount > 0 && <span className="cal-segmented-badge">{taskCount}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'agenda'}
          className={`cal-segmented-btn${activeView === 'agenda' ? ' cal-segmented-btn--active' : ''}`}
          onClick={() => setActiveView('agenda')}
          title="Lịch biểu theo ngày cuốn chiếu (Phím tắt: A)"
        >
          <AppIcon name="calendar" size={14} /> Lịch biểu
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'day'}
          className={`cal-segmented-btn${activeView === 'day' ? ' cal-segmented-btn--active' : ''}`}
          onClick={() => setActiveView('day')}
          title="Lịch Ngày 24h (Phím tắt: D)"
        >
          ☀️ Ngày
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'week'}
          className={`cal-segmented-btn${activeView === 'week' ? ' cal-segmented-btn--active' : ''}`}
          onClick={() => setActiveView('week')}
          title="Lịch Tuần 7 ngày (Phím tắt: W)"
        >
          🗓️ Tuần
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'month'}
          className={`cal-segmented-btn${activeView === 'month' ? ' cal-segmented-btn--active' : ''}`}
          onClick={() => setActiveView('month')}
          title="Lịch Tháng 100vh (Phím tắt: M)"
        >
          📅 Tháng
        </button>
      </div>

      {/* Cụm phải: Bắt đầu tuần, Thêm task, Toggle Widget */}
      <div className="cal-header-bar__right">
        {(activeView === 'week' || activeView === 'month') && setStartOnSunday && (
          <button
            type="button"
            className="cal-header-bar__btn-startday"
            onClick={toggleStartDay}
            title="Đổi ngày bắt đầu tuần"
          >
            Bắt đầu: <strong>{startOnSunday ? 'Chủ Nhật' : 'Thứ 2'}</strong>
          </button>
        )}

        {/* Nút Thêm công việc */}
        {onAddNewTask && (
          <button
            type="button"
            className="tasks-viewbar__add"
            onClick={onAddNewTask}
            id="task-add-btn"
            style={{ margin: 0 }}
          >
            <AppIcon name="plus" size={14} /> Thêm việc
          </button>
        )}

        {/* Nút bật/tắt Widget Panel bên phải */}
        <button
          type="button"
          className={`cal-header-bar__btn-widget${isWidgetOpen ? ' cal-header-bar__btn-widget--active' : ''}`}
          onClick={onToggleWidget}
          title={isWidgetOpen ? 'Đóng bảng tiện ích Lịch Việt' : 'Mở bảng tiện ích Lịch Việt (Lịch vạn niên, Giờ Hoàng Đạo, Đếm ngược)'}
        >
          <span>🐯</span> Tiện ích
        </button>
      </div>
    </div>
  );
}
