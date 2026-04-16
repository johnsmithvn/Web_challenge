import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHabitStore } from '../hooks/useHabitStore';
import { useXpStore, XP_REWARDS } from '../hooks/useXpStore';
import '../styles/sections.css';
import '../styles/tracker.css';

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const WEEKS_CONFIG = [
  {
    id: 1,
    label: 'Tuần 1',
    task: 'Thử thách Cá nhân: Hành động nhỏ',
    color: 'blue',
    badge: { label: 'Lấy Đà', emoji: '✅', cls: 'badge-green' },
  },
  {
    id: 2,
    label: 'Tuần 2',
    task: 'Thử thách Đồng đội: Báo cáo chéo',
    color: 'purple',
    badge: { label: 'Bứt Phá', emoji: '✅', cls: 'badge-gold' },
  },
  {
    id: 3,
    label: 'Tuần 3',
    task: 'Học lý thuyết: Giải mã cơ chế não bộ',
    color: 'cyan',
    badge: { label: 'Hoàn Thành', emoji: '🏆', cls: 'badge-cyan' },
  },
];

/** Small inline banner that pops up when user clicks a locked row */
function LockBanner({ message, cta, onCta, onClose }) {
  return (
    <div className="lock-banner" role="alert">
      <span className="lock-banner__icon">🔒</span>
      <span className="lock-banner__msg">{message}</span>
      {cta && (
        <button className="lock-banner__btn" onClick={onCta}>{cta}</button>
      )}
      <button className="lock-banner__close" onClick={onClose} aria-label="Đóng">✕</button>
    </div>
  );
}

export default function TrackerSection({ compact = false, isInTeam = false }) {
  const { data, toggle, weekDates, streak, weekDone, completionPct, badge } = useHabitStore();
  const { addXp, hasMilestone } = useXpStore();
  const navigate = useNavigate();

  // Track which week's banner is visible: null | 2 | 3
  const [bannerWeek, setBannerWeek] = useState(null);
  const bannerTimer = useRef(null);

  const showBanner = (wkId) => {
    setBannerWeek(wkId);
    clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBannerWeek(null), 6000);
  };

  const handleToggle = (dateKey) => {
    const wasUnchecked = !data[dateKey];
    toggle(dateKey);
    if (wasUnchecked && !hasMilestone('daily_check', { date: dateKey })) {
      addXp(XP_REWARDS.daily_check, 'daily_check', { date: dateKey });
    }
  };

  // Compute week date slices and done counts
  const weekSlices = WEEKS_CONFIG.map((wk, wi) => {
    const slice = weekDates.slice(0, 7).map((_, di) => {
      const base = new Date(weekDates[0]);
      base.setDate(base.getDate() + wi * 7 + di);
      return base.toISOString().split('T')[0];
    });
    return { slice, doneDays: slice.filter(d => data[d]).length };
  });

  const week1Done = weekSlices[0].doneDays;
  const week2Done = weekSlices[1].doneDays;

  /**
   * Lock rules:
   * - Week 2: ALWAYS locked for self-tick (requires team accountability)
   *     no team  → popup: "Tìm đồng đội để mở khóa Tuần 2"
   *     in team  → popup: "Đồng đội sẽ báo cáo chéo cho bạn"
   * - Week 3: locked until Week 2 is fully done (7/7)
   */
  const getLockInfo = (wkId) => {
    if (wkId === 2) {
      return {
        locked: true,
        message: isInTeam
          ? '🤝 Tuần 2 do đồng đội xác nhận — vào trang Đồng Đội để xem'
          : '👥 Tuần 2 cần đồng đội để mở khóa',
        cta:     isInTeam ? 'Đến trang Đồng Đội' : 'Tìm đồng đội ngay',
        onCta:   () => navigate('/dong-doi'),
      };
    }
    if (wkId === 3 && week2Done < 7) {
      return {
        locked: true,
        message: `⏳ Hoàn thành Tuần 2 trước đã (${week2Done}/7 ngày)`,
        cta: null,
        onCta: null,
      };
    }
    return { locked: false };
  };

  return (
    <section className={compact ? '' : 'section tracker-section'} id={compact ? undefined : 'tracker'}>
      <div className={compact ? '' : 'container'}>
        {!compact && (
          <>
            <div className="section-label">📊 Theo Dõi</div>
            <h2 className="display-2" style={{ marginBottom: '0.75rem' }}>
              Bảng Tiến Độ <span className="gradient-text">Kỷ Luật</span>
            </h2>
            <p className="section-desc">Tick mỗi ngày để giữ streak 🔥</p>
          </>
        )}

        {/* Stats row */}
        <div className="tracker-stats">
          <div className="tracker-stat-card card">
            <span className="tracker-stat-icon" style={{ animationName: 'fire-flicker' }}>🔥</span>
            <span className="tracker-stat-val gradient-text">{streak}</span>
            <span className="tracker-stat-label">Ngày streak</span>
          </div>
          <div className="tracker-stat-card card">
            <span className="tracker-stat-icon">📅</span>
            <span className="tracker-stat-val gradient-text-green">{weekDone}/7</span>
            <span className="tracker-stat-label">Tuần này</span>
          </div>
          <div className="tracker-stat-card card">
            <span className="tracker-stat-icon">⚡</span>
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="tracker-stat-label">Hoàn thành</span>
                <span className="tracker-stat-val" style={{ fontSize: '1rem' }}>{completionPct}%</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${completionPct}%` }} />
              </div>
            </div>
          </div>
          {badge && (
            <div className="tracker-stat-card card card-glow-green">
              <span className="tracker-stat-icon" style={{ fontSize: '2rem' }}>{badge.emoji}</span>
              <span className={`badge ${badge.color === 'gold' ? 'badge-gold' : 'badge-green'}`}>{badge.label}</span>
            </div>
          )}
        </div>

        {/* Main tracker table */}
        <div className="tracker-table-wrap">
          <table className="tracker-table">
            <thead>
              <tr>
                <th>GIAI ĐOẠN</th>
                <th>NHIỆM VỤ TRỌNG TÂM</th>
                {DAY_LABELS.map(d => <th key={d}>{d}</th>)}
                <th>ĐÁNH GIÁ</th>
              </tr>
            </thead>
            <tbody>
              {WEEKS_CONFIG.map((wk, wi) => {
                const { slice: weekDatesSlice, doneDays } = weekSlices[wi];
                const { locked, message, cta, onCta } = getLockInfo(wk.id);

                return (
                  <>
                    <tr
                      key={wk.id}
                      className={locked ? 'tracker-row--locked' : ''}
                    >
                      <td>
                        <span className={`week-label week-label--${wk.color}`}>
                          {locked ? '🔒 ' : ''}{wk.label}
                        </span>
                      </td>
                      <td style={{ lineHeight: 1.4 }}>
                        {wk.task}
                        {locked && wk.id === 2 && !isInTeam && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--purple-light)', marginTop: '0.2rem' }}>
                            👥 Cần đồng đội để mở khóa
                          </div>
                        )}
                        {locked && wk.id === 2 && isInTeam && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--cyan)', marginTop: '0.2rem' }}>
                            🤝 Đồng đội sẽ báo cáo chéo cho bạn
                          </div>
                        )}
                        {locked && wk.id === 3 && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--gold-dim)', marginTop: '0.2rem' }}>
                            ⏳ Hoàn thành Tuần 2 trước ({week2Done}/7)
                          </div>
                        )}
                      </td>
                      {weekDatesSlice.map((dateKey, di) => (
                        <td key={di}>
                          <input
                            type="checkbox"
                            className={`habit-checkbox ${locked ? 'habit-checkbox--locked' : ''}`}
                            checked={!!data[dateKey]}
                            onChange={() => {
                              if (locked) {
                                showBanner(wk.id);
                              } else {
                                handleToggle(dateKey);
                              }
                            }}
                            id={`check-w${wk.id}-d${di + 1}`}
                            aria-label={`${wk.label} ${DAY_LABELS[di]}${locked ? ' (bị khóa)' : ''}`}
                            title={locked ? message : ''}
                          />
                        </td>
                      ))}
                      <td>
                        <div className="tracker-score">
                          <span style={{ color: doneDays === 7 ? 'var(--green)' : 'var(--text-secondary)' }}>
                            {doneDays}/7
                          </span>
                          {' '}
                          <span className={`badge ${wk.badge.cls}`} style={{ fontSize: '0.7rem' }}>
                            {wk.badge.emoji} {wk.badge.label}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Inline lock banner — shows when user taps a locked row */}
                    {bannerWeek === wk.id && locked && (
                      <tr key={`banner-${wk.id}`} className="tracker-row-banner">
                        <td colSpan={10} style={{ padding: '0 0 0.5rem 0' }}>
                          <LockBanner
                            message={message}
                            cta={cta}
                            onCta={() => { onCta?.(); setBannerWeek(null); }}
                            onClose={() => setBannerWeek(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="tracker-legend">
          <span>💡 Tip: Tick trước 23:59 để giữ streak</span>
          <span className="badge badge-green">🔥 3 ngày = Lấy Đà</span>
          <span className="badge badge-gold">🟡 10 ngày = Bứt Phá</span>
          <span className="badge badge-purple">🏆 21 ngày = Hoàn Thành</span>
        </div>
      </div>
    </section>
  );
}
