import { useState, useMemo } from 'react';
import {
  solarToLunar,
  getCanChiYear,
  getCanChiMonth,
  getCanChiDay,
  getZodiacHours,
  getUpcomingEvents,
} from '../utils/lunarUtils';
import HOLIDAYS from '../data/holidays.json';
import AppIcon from './AppIcon';
import '../styles/calendar-widget.css';

/**
 * CalendarWidgetPanel — Cột tiện ích bên phải đậm chất bản địa hóa Việt Nam.
 * Cung cấp:
 * 1. Thẻ Lịch vạn niên (Dương - Âm - Can Chi Năm/Tháng/Ngày)
 * 2. Giờ Hoàng Đạo (12 con giáp, highlight giờ tốt, định vị giờ hiện tại)
 * 3. Đếm ngược sự kiện & ngày lễ (Âm & Dương lịch)
 */
export default function CalendarWidgetPanel({
  currentDate = new Date(),
  onClose,
  isOpen = true,
  onSelectEventDate,
  holidayToggles = { solar: true, lunar: true, international: true, japan: false, fun: true, custom: true },
  onToggleHolidayType,
  customAnniversaries = [],
  onAddCustomAnniversary,
  onDeleteCustomAnniversary,
}) {
  const [filterType, setFilterType] = useState('all'); // 'all' | 'solar' | 'lunar' | 'international' | 'custom' | 'japan' | 'fun'
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'events'

  // State bộ tạo ngày kỷ niệm cá nhân
  const [showCreateAnniv, setShowCreateAnniv] = useState(false);
  const [annivTitle, setAnnivTitle] = useState('');
  const [annivCalType, setAnnivCalType] = useState('solar');
  const [annivDay, setAnnivDay] = useState(1);
  const [annivMonth, setAnnivMonth] = useState(1);
  const [annivYear, setAnnivYear] = useState('');
  const [annivIcon, setAnnivIcon] = useState('💖');

  const handleSaveAnniv = (e) => {
    e.preventDefault();
    if (!annivTitle.trim()) return;
    if (onAddCustomAnniversary) {
      onAddCustomAnniversary({
        id: `anniv-${Date.now()}`,
        title: annivTitle.trim(),
        calType: annivCalType,
        day: Number(annivDay),
        month: Number(annivMonth),
        year: annivYear ? Number(annivYear) : null,
        icon: annivIcon || '💖',
      });
    }
    setAnnivTitle('');
    setAnnivYear('');
    setShowCreateAnniv(false);
  };

  // Tính toán thông tin lịch cho ngày đang chọn
  const dateInfo = useMemo(() => {
    const d = currentDate instanceof Date && !isNaN(currentDate) ? currentDate : new Date();
    const dd = d.getDate();
    const mm = d.getMonth() + 1;
    const yy = d.getFullYear();

    const lunar = solarToLunar(dd, mm, yy);
    const canChiYear = getCanChiYear(lunar.year);
    const canChiMonth = getCanChiMonth(lunar.year, lunar.month);
    const canChiDay = getCanChiDay(dd, mm, yy);

    const now = new Date();
    const currentHour = d.toDateString() === now.toDateString() ? now.getHours() : null;
    const zodiacHours = getZodiacHours(dd, mm, yy, currentHour);

    const dayName = d.toLocaleDateString('vi-VN', { weekday: 'long' });

    return {
      solarDay: dd,
      solarMonth: mm,
      solarYear: yy,
      dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1),
      lunarDay: lunar.day,
      lunarMonth: lunar.month,
      lunarYear: lunar.year,
      isLeap: lunar.leap,
      canChiYear,
      canChiMonth,
      canChiDay: canChiDay.full,
      zodiacHours,
    };
  }, [currentDate]);

  // Danh sách sự kiện đếm ngược sắp tới (tôn trọng các toggle bật/tắt lễ và kỷ niệm cá nhân)
  const upcomingEvents = useMemo(() => {
    const events = getUpcomingEvents(new Date(), HOLIDAYS, 90, holidayToggles, customAnniversaries);
    if (filterType === 'solar') return events.filter((e) => e.type === 'solar');
    if (filterType === 'lunar') return events.filter((e) => e.type === 'lunar');
    if (filterType === 'international') return events.filter((e) => e.type === 'international');
    if (filterType === 'custom') return events.filter((e) => e.type === 'custom');
    if (filterType === 'japan') return events.filter((e) => e.type === 'japan');
    if (filterType === 'fun') return events.filter((e) => e.type === 'fun');
    return events;
  }, [filterType, holidayToggles, customAnniversaries]);

  if (!isOpen) return null;

  return (
    <aside className="cal-widget-panel" aria-label="Tiện ích Lịch Việt">
      {/* Header của Widget Panel */}
      <div className="cal-widget-panel__header">
        <div className="cal-widget-panel__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'overview'}
            className={`cal-widget-tab${activeTab === 'overview' ? ' cal-widget-tab--active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <AppIcon name="calendar" size={14} /> Lịch vạn niên
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'events'}
            className={`cal-widget-tab${activeTab === 'events' ? ' cal-widget-tab--active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            <AppIcon name="bell" size={14} /> Sự kiện ({upcomingEvents.length})
          </button>
        </div>

        <button
          type="button"
          className="cal-widget-panel__close"
          onClick={onClose}
          title="Đóng tiện ích (giải phóng không gian)"
          aria-label="Đóng bảng tiện ích"
        >
          <AppIcon name="x" size={16} />
        </button>
      </div>

      <div className="cal-widget-panel__body">
        {activeTab === 'overview' ? (
          <>
            {/* Card 1: Thẻ Ngày Hôm Nay / Ngày đang chọn */}
            <div className="cal-widget-card cal-almanac-card">
              <div className="cal-almanac-card__header">
                <span className="cal-almanac-card__month-year">
                  Tháng {dateInfo.solarMonth} năm {dateInfo.solarYear}
                </span>
              </div>

              <div className="cal-almanac-card__main">
                <div className="cal-almanac-card__solar">
                  <div className="cal-almanac-card__solar-num">{dateInfo.solarDay}</div>
                  <div className="cal-almanac-card__dayname">{dateInfo.dayName}</div>
                </div>

                <div className="cal-almanac-card__lunar">
                  <div className="cal-almanac-card__lunar-num">{dateInfo.lunarDay}</div>
                  <div className="cal-almanac-card__lunar-label">
                    Âm lịch tháng {dateInfo.lunarMonth} {dateInfo.isLeap ? '(Nhuận)' : ''}
                  </div>
                </div>
              </div>

              <div className="cal-almanac-card__canchi-list">
                <div className="cal-almanac-canchi-item">
                  <span className="cal-almanac-canchi-icon">🌾</span>
                  <span className="cal-almanac-canchi-label">Năm:</span>
                  <strong className="cal-almanac-canchi-val">{dateInfo.canChiYear}</strong>
                </div>
                <div className="cal-almanac-canchi-item">
                  <span className="cal-almanac-canchi-icon">🌙</span>
                  <span className="cal-almanac-canchi-label">Tháng:</span>
                  <strong className="cal-almanac-canchi-val">{dateInfo.canChiMonth}</strong>
                </div>
                <div className="cal-almanac-canchi-item">
                  <span className="cal-almanac-canchi-icon">☀️</span>
                  <span className="cal-almanac-canchi-label">Ngày:</span>
                  <strong className="cal-almanac-canchi-val">{dateInfo.canChiDay}</strong>
                </div>
              </div>
            </div>

            {/* Card 2: Giờ Hoàng Đạo */}
            <div className="cal-widget-card cal-zodiac-card">
              <div className="cal-zodiac-card__header">
                <h4 className="cal-zodiac-card__title">
                  <span>🐯</span> Giờ Hoàng Đạo
                </h4>
                <span className="cal-zodiac-card__badge">6 giờ cát tinh</span>
              </div>

              <div className="cal-zodiac-grid">
                {dateInfo.zodiacHours.map((zh) => (
                  <div
                    key={zh.name}
                    className={`cal-zodiac-slot${zh.isHoangDao ? ' cal-zodiac-slot--hoangdao' : ' cal-zodiac-slot--hacdao'}${zh.isNow ? ' cal-zodiac-slot--now' : ''}`}
                    title={`${zh.name} (${zh.range}h) — ${zh.isHoangDao ? 'Giờ Hoàng Đạo' : 'Giờ Hắc Đạo'}${zh.isNow ? ' [Hiện tại]' : ''}`}
                  >
                    <span className="cal-zodiac-slot__icon">{zh.icon}</span>
                    <span className="cal-zodiac-slot__name">{zh.name}</span>
                    <span className="cal-zodiac-slot__range">{zh.range}</span>
                    {zh.isNow && <span className="cal-zodiac-slot__now-dot" />}
                  </div>
                ))}
              </div>

              <div className="cal-zodiac-legend">
                <span className="cal-zodiac-legend__item">
                  <span className="cal-zodiac-dot cal-zodiac-dot--hoangdao" /> Hoàng đạo (Tốt)
                </span>
                <span className="cal-zodiac-legend__item">
                  <span className="cal-zodiac-dot cal-zodiac-dot--hacdao" /> Hắc đạo
                </span>
              </div>
            </div>

            {/* Card 3: Lịch Sự Kiện & Toggles Bật/Tắt Lễ */}
            <div className="cal-widget-card cal-toggles-card">
              <div className="cal-toggles-card__header">
                <h4 className="cal-toggles-card__title">
                  <span>✨</span> LỊCH SỰ KIỆN
                </h4>
              </div>
              <div className="cal-toggles-list">
                <div
                  className="cal-toggle-item"
                  onClick={() => onToggleHolidayType && onToggleHolidayType('solar')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="cal-toggle-item__info">
                    <span className="cal-toggle-dot cal-toggle-dot--green" />
                    <span className="cal-toggle-item__label">Ngày lễ Việt Nam</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={holidayToggles.solar}
                    className={`cal-switch-btn cal-switch-btn--green${holidayToggles.solar ? ' cal-switch-btn--on' : ''}`}
                    tabIndex={-1}
                  >
                    <span className="cal-switch-thumb" />
                  </button>
                </div>

                <div
                  className="cal-toggle-item"
                  onClick={() => onToggleHolidayType && onToggleHolidayType('lunar')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="cal-toggle-item__info">
                    <span className="cal-toggle-dot cal-toggle-dot--yellow" />
                    <span className="cal-toggle-item__label">Ngày lễ Âm lịch</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={holidayToggles.lunar}
                    className={`cal-switch-btn cal-switch-btn--yellow${holidayToggles.lunar ? ' cal-switch-btn--on' : ''}`}
                    tabIndex={-1}
                  >
                    <span className="cal-switch-thumb" />
                  </button>
                </div>

                <div
                  className="cal-toggle-item"
                  onClick={() => onToggleHolidayType && onToggleHolidayType('international')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="cal-toggle-item__info">
                    <span className="cal-toggle-dot cal-toggle-dot--blue" />
                    <span className="cal-toggle-item__label">Ngày lễ Quốc tế (LHQ)</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={holidayToggles.international}
                    className={`cal-switch-btn cal-switch-btn--blue${holidayToggles.international ? ' cal-switch-btn--on' : ''}`}
                    tabIndex={-1}
                  >
                    <span className="cal-switch-thumb" />
                  </button>
                </div>

                <div
                  className="cal-toggle-item"
                  onClick={() => onToggleHolidayType && onToggleHolidayType('japan')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="cal-toggle-item__info">
                    <span className="cal-toggle-dot cal-toggle-dot--red" />
                    <span className="cal-toggle-item__label">Ngày lễ Nhật Bản</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={holidayToggles.japan}
                    className={`cal-switch-btn cal-switch-btn--red${holidayToggles.japan ? ' cal-switch-btn--on' : ''}`}
                    tabIndex={-1}
                  >
                    <span className="cal-switch-thumb" />
                  </button>
                </div>

                <div
                  className="cal-toggle-item"
                  onClick={() => onToggleHolidayType && onToggleHolidayType('fun')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="cal-toggle-item__info">
                    <span className="cal-toggle-dot cal-toggle-dot--purple" />
                    <span className="cal-toggle-item__label">Lễ hội Coder & Dân Geek 👾</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={holidayToggles.fun}
                    className={`cal-switch-btn cal-switch-btn--purple${holidayToggles.fun ? ' cal-switch-btn--on' : ''}`}
                    tabIndex={-1}
                  >
                    <span className="cal-switch-thumb" />
                  </button>
                </div>

                {/* 5. Ngày kỷ niệm cá nhân */}
                <div
                  className="cal-toggle-item"
                  onClick={() => onToggleHolidayType && onToggleHolidayType('custom')}
                  role="button"
                  tabIndex={0}
                  style={{ marginTop: '0.15rem' }}
                >
                  <div className="cal-toggle-item__info">
                    <span className="cal-toggle-dot cal-toggle-dot--pink" />
                    <span className="cal-toggle-item__label">
                      Kỷ niệm của tôi ({customAnniversaries.length})
                    </span>
                    <button
                      type="button"
                      className="cal-toggle-add-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCreateAnniv((prev) => !prev);
                      }}
                      title="Thêm ngày kỷ niệm, ngày hẹn hò, sinh nhật hoặc ngày giỗ"
                    >
                      {showCreateAnniv ? '✕' : '+ Thêm'}
                    </button>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={holidayToggles.custom !== false}
                    className={`cal-switch-btn cal-switch-btn--pink${holidayToggles.custom !== false ? ' cal-switch-btn--on' : ''}`}
                    tabIndex={-1}
                  >
                    <span className="cal-switch-thumb" />
                  </button>
                </div>

                {/* Form inline tạo kỷ niệm cá nhân gọn gàng */}
                {showCreateAnniv && (
                  <form className="cal-anniv-creator" onSubmit={handleSaveAnniv}>
                    <input
                      type="text"
                      className="cal-anniv-input"
                      placeholder="Tên kỷ niệm (vd: Kỷ niệm ngày cưới, Ngày giỗ...)"
                      value={annivTitle}
                      onChange={(e) => setAnnivTitle(e.target.value)}
                      autoFocus
                      required
                    />

                    <div className="cal-anniv-row">
                      <div className="cal-anniv-cal-switch">
                        <button
                          type="button"
                          className={`cal-anniv-cal-btn${annivCalType === 'solar' ? ' cal-anniv-cal-btn--active' : ''}`}
                          onClick={() => setAnnivCalType('solar')}
                        >
                          ☀️ Dương
                        </button>
                        <button
                          type="button"
                          className={`cal-anniv-cal-btn${annivCalType === 'lunar' ? ' cal-anniv-cal-btn--active' : ''}`}
                          onClick={() => setAnnivCalType('lunar')}
                        >
                          🌙 Âm lịch
                        </button>
                      </div>

                      <select
                        className="cal-anniv-select"
                        value={annivDay}
                        onChange={(e) => setAnnivDay(Number(e.target.value))}
                      >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>Ngày {d}</option>
                        ))}
                      </select>

                      <select
                        className="cal-anniv-select"
                        value={annivMonth}
                        onChange={(e) => setAnnivMonth(Number(e.target.value))}
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <option key={m} value={m}>Tháng {m}</option>
                        ))}
                      </select>
                    </div>

                    <div className="cal-anniv-row" style={{ justifyContent: 'space-between' }}>
                      <div className="cal-anniv-icons">
                        {['💖', '🎂', '💍', '🕊️', '⭐', '🎉'].map((ic) => (
                          <button
                            key={ic}
                            type="button"
                            className={`cal-anniv-icon-btn${annivIcon === ic ? ' cal-anniv-icon-btn--selected' : ''}`}
                            onClick={() => setAnnivIcon(ic)}
                          >
                            {ic}
                          </button>
                        ))}
                      </div>

                      <input
                        type="number"
                        className="cal-anniv-input"
                        style={{ width: '80px' }}
                        placeholder="Năm (tùy chọn)"
                        value={annivYear}
                        onChange={(e) => setAnnivYear(e.target.value)}
                        min="1900"
                        max="2100"
                      />
                    </div>

                    <div className="cal-anniv-actions">
                      <button
                        type="button"
                        className="cal-anniv-btn cal-anniv-btn--cancel"
                        onClick={() => setShowCreateAnniv(false)}
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="cal-anniv-btn cal-anniv-btn--save"
                        disabled={!annivTitle.trim()}
                      >
                        Lưu kỷ niệm
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Card 3: Sự kiện & Đếm ngược */
          <div className="cal-widget-card cal-events-card">
            <div className="cal-events-card__header">
              <div className="cal-events-filters">
                <button
                  type="button"
                  className={`cal-event-filter-btn${filterType === 'all' ? ' cal-event-filter-btn--active' : ''}`}
                  onClick={() => setFilterType('all')}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  className={`cal-event-filter-btn${filterType === 'solar' ? ' cal-event-filter-btn--active' : ''}`}
                  onClick={() => setFilterType('solar')}
                >
                  Dương lịch
                </button>
                <button
                  type="button"
                  className={`cal-event-filter-btn${filterType === 'lunar' ? ' cal-event-filter-btn--active' : ''}`}
                  onClick={() => setFilterType('lunar')}
                >
                  Âm lịch
                </button>
                {holidayToggles?.custom && customAnniversaries.length > 0 && (
                  <button
                    type="button"
                    className={`cal-event-filter-btn${filterType === 'custom' ? ' cal-event-filter-btn--active' : ''}`}
                    onClick={() => setFilterType('custom')}
                  >
                    💖 Kỷ niệm
                  </button>
                )}
                {holidayToggles?.international && (
                  <button
                    type="button"
                    className={`cal-event-filter-btn${filterType === 'international' ? ' cal-event-filter-btn--active' : ''}`}
                    onClick={() => setFilterType('international')}
                  >
                    Quốc tế
                  </button>
                )}
                {holidayToggles?.japan && (
                  <button
                    type="button"
                    className={`cal-event-filter-btn${filterType === 'japan' ? ' cal-event-filter-btn--active' : ''}`}
                    onClick={() => setFilterType('japan')}
                  >
                    Nhật Bản
                  </button>
                )}
                {holidayToggles?.fun && (
                  <button
                    type="button"
                    className={`cal-event-filter-btn${filterType === 'fun' ? ' cal-event-filter-btn--active' : ''}`}
                    onClick={() => setFilterType('fun')}
                  >
                    Geek
                  </button>
                )}
              </div>
            </div>

            <div className="cal-events-list">
              {upcomingEvents.length === 0 ? (
                <div className="cal-events-empty">Không có sự kiện sắp tới.</div>
              ) : (
                upcomingEvents.map((ev, idx) => (
                  <div
                    key={`${ev.dateStr}-${idx}`}
                    className="cal-event-row"
                    onClick={() => onSelectEventDate && onSelectEventDate(ev.targetDate)}
                    title="Nhấn để xem trên lịch"
                  >
                    <div className="cal-event-row__top">
                      <div className="cal-event-row__title">
                        <span className={`cal-event-dot cal-event-dot--${ev.type}`} />
                        <strong>{ev.title}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <div className={`cal-event-countdown${ev.diffDays <= 3 ? ' cal-event-countdown--soon' : ''}`}>
                          {ev.countdownLabel}
                        </div>
                        {ev.isCustom && onDeleteCustomAnniversary && (
                          <button
                            type="button"
                            className="cal-anniv-del-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteCustomAnniversary(ev.id);
                            }}
                            title="Xóa ngày kỷ niệm này"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="cal-event-row__sub">
                      <span>{ev.dayOfWeek}, {ev.solarText}</span>
                      <span className="cal-event-sep">•</span>
                      <span>{ev.lunarText}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
