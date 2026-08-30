import { useEffect, useCallback, useMemo } from 'react';
import { getWeekDays } from '../utils/calendarTimeUtils';
import AppIcon from './AppIcon';

/**
 * CalendarToolbar — Thanh điều hướng lịch chuẩn Google Calendar.
 * Nằm cố định ở đỉnh, đồng bộ tuyệt đối giữa Lịch Tuần và Lịch Tháng,
 * triệt tiêu hiện tượng giật cục hoặc dính scroll khi chuyển view.
 */
export default function CalendarToolbar({
  currentDate,
  setCurrentDate,
  calendarMode,
  setCalendarMode,
  startOnSunday,
  setStartOnSunday,
}) {
  // Phím tắt bàn phím thông minh: W (Tuần), M (Tháng), T (Hôm nay)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        setCalendarMode('week');
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setCalendarMode('month');
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setCurrentDate(new Date());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCalendarMode, setCurrentDate]);

  // Tính toán nhãn tiêu đề ngày tháng
  const titleLabel = useMemo(() => {
    if (calendarMode === 'month') {
      const mLabel = currentDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
      return mLabel.charAt(0).toUpperCase() + mLabel.slice(1);
    }

    // Ở chế độ Tuần: Tính khoảng tháng của 7 ngày
    const days = getWeekDays(currentDate, startOnSunday);
    const d1 = days[0]?.date || currentDate;
    const d2 = days[6]?.date || currentDate;
    const m1 = d1.getMonth() + 1;
    const y1 = d1.getFullYear();
    const m2 = d2.getMonth() + 1;
    const y2 = d2.getFullYear();

    if (y1 === y2) {
      if (m1 === m2) {
        return `Tháng ${m1} năm ${y1}`;
      }
      return `Thg ${m1} – Thg ${m2}, ${y1}`;
    }
    return `Thg ${m1}, ${y1} – Thg ${m2}, ${y2}`;
  }, [calendarMode, currentDate, startOnSunday]);

  const goToday = useCallback(() => {
    setCurrentDate(new Date());
  }, [setCurrentDate]);

  const goPrev = useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (calendarMode === 'week') {
        d.setDate(d.getDate() - 7);
      } else {
        d.setMonth(d.getMonth() - 1);
      }
      return d;
    });
  }, [calendarMode, setCurrentDate]);

  const goNext = useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (calendarMode === 'week') {
        d.setDate(d.getDate() + 7);
      } else {
        d.setMonth(d.getMonth() + 1);
      }
      return d;
    });
  }, [calendarMode, setCurrentDate]);

  const toggleStartDay = useCallback(() => {
    setStartOnSunday((prev) => {
      const next = !prev;
      localStorage.setItem('lh_cal_start_sun', String(next));
      return next;
    });
  }, [setStartOnSunday]);

  return (
    <div className="cal-header-bar">
      {/* Cụm điều hướng bên trái: Hôm nay, < >, Tiêu đề */}
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
            aria-label={calendarMode === 'week' ? 'Tuần trước' : 'Tháng trước'}
          >
            <AppIcon name="caretLeft" size={16} />
          </button>
          <button
            type="button"
            className="cal-header-bar__arrow-btn"
            onClick={goNext}
            aria-label={calendarMode === 'week' ? 'Tuần sau' : 'Tháng sau'}
          >
            <AppIcon name="caretRight" size={16} />
          </button>
        </div>

        <h2 className="cal-header-bar__title">
          {titleLabel}
        </h2>
      </div>

      {/* Cụm tùy chọn bên phải: Bắt đầu tuần, Legend & Bộ chuyển Tuần / Tháng trực tiếp */}
      <div className="cal-header-bar__right">
        <button
          type="button"
          className="cal-header-bar__btn-startday"
          onClick={toggleStartDay}
          title="Đổi ngày bắt đầu tuần"
        >
          Bắt đầu: <strong>{startOnSunday ? 'Chủ Nhật' : 'Thứ 2'}</strong>
        </button>

        <div className="week-cal__color-legend">
          <span className="week-cal__legend-item week-cal__legend-item--holiday">
            <span className="week-cal__legend-dot" /> Ngày lễ
          </span>
          <span className="week-cal__legend-item week-cal__legend-item--fun">
            <span className="week-cal__legend-dot" /> Dịp đặc biệt / Dev
          </span>
          <span className="week-cal__legend-item week-cal__legend-item--overdue">
            <span className="week-cal__legend-dot" /> Quá hạn
          </span>
          <span className="week-cal__legend-item week-cal__legend-item--done">
            <span className="week-cal__legend-dot" /> Đã xong
          </span>
        </div>

        {/* Bộ chuyển view trực tiếp dạng Pill Segmented (1 click là đổi ngay, rất gọn và tiện) */}
        <div className="week-cal__view-switch" role="tablist" aria-label="Chế độ lịch">
          <button
            type="button"
            role="tab"
            aria-selected={calendarMode === 'week'}
            className={`week-cal__view-btn${calendarMode === 'week' ? ' week-cal__view-btn--active' : ''}`}
            onClick={() => setCalendarMode('week')}
            title="Xem theo Tuần (Phím tắt: W)"
          >
            Tuần
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={calendarMode === 'month'}
            className={`week-cal__view-btn${calendarMode === 'month' ? ' week-cal__view-btn--active' : ''}`}
            onClick={() => setCalendarMode('month')}
            title="Xem theo Tháng (Phím tắt: M)"
          >
            Tháng
          </button>
        </div>
      </div>
    </div>
  );
}
