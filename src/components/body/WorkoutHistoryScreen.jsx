import { useState, useMemo } from 'react';
import AppIcon from '../AppIcon';
import { DAY_TYPE_COLORS } from '../../utils/workoutLogic';

const DEFAULT_CHART_EXERCISES = [
  { key: 'push-up', name: 'Push-up', unit: 'rep' },
  { key: 'goblet-squat', name: 'Goblet Squat', unit: 'rep' },
  { key: 'dumbbell-row', name: 'Dumbbell Row', unit: 'rep' },
  { key: 'plank', name: 'Plank', unit: 's' }
];

export default function WorkoutHistoryScreen({ sessions = [], recentSets = [] }) {
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const currentYear = new Date().getFullYear();

  // Chỉ lấy các buổi tập đã hoàn thành
  const completedSessions = useMemo(() => {
    return (sessions || []).filter(s => s.status === 'completed');
  }, [sessions]);

  // Dynamically resolve exercises that user has actually trained
  const availableExercises = useMemo(() => {
    const map = new Map();
    (recentSets || []).forEach(s => {
      const key = s.exercise_key || s.exercise_name;
      if (key && !map.has(key)) {
        map.set(key, {
          key,
          name: s.exercise_name || key,
          unit: s.unit || 'rep'
        });
      }
    });
    if (map.size === 0) {
      DEFAULT_CHART_EXERCISES.forEach(e => map.set(e.key, e));
    }
    return Array.from(map.values()).slice(0, 6);
  }, [recentSets]);

  const [selectedExKey, setSelectedExKey] = useState(() => availableExercises[0]?.key || 'push-up');

  // Fallback to first available if current selection is not in list
  const activeEx = useMemo(() => {
    return availableExercises.find(e => e.key === selectedExKey) || availableExercises[0];
  }, [availableExercises, selectedExKey]);

  // Derive real exercise history from recentSets
  const historyList = useMemo(() => {
    if (!activeEx) return [];
    const exSets = (recentSets || []).filter(s =>
      s.exercise_key === activeEx.key
      || (s.exercise_name && s.exercise_name.toLowerCase() === activeEx.name.toLowerCase())
    );

    if (exSets.length === 0) return [];

    // Group sets by local_date or completed_at
    const grouped = new Map();
    exSets.forEach(s => {
      const ts = s.completed_at || s.logged_at || s.created_at;
      const dateKey = ts
        ? new Date(ts).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' })
        : 'Gần đây';
      const existing = grouped.get(dateKey) || {
        date: dateKey,
        rawTime: ts ? new Date(ts).getTime() : 0,
        type: 'Tập luyện',
        target: Number(s.target_val || 10),
        sets: [],
        pr: false,
        delta: '—'
      };
      if (s.actual_val != null) {
        existing.sets.push(Number(s.actual_val));
      }
      if (s.is_pr) existing.pr = true;
      grouped.set(dateKey, existing);
    });

    const chronoSessions = Array.from(grouped.values()).sort((a, b) => a.rawTime - b.rawTime);

    // Tính delta động giữa buổi sau và buổi trước
    chronoSessions.forEach((curr, idx) => {
      if (idx === 0) {
        curr.delta = '—';
      } else {
        const prev = chronoSessions[idx - 1];
        const maxCurr = curr.sets.length > 0 ? Math.max(...curr.sets) : 0;
        const maxPrev = prev.sets.length > 0 ? Math.max(...prev.sets) : 0;
        const diff = maxCurr - maxPrev;
        const unit = activeEx.unit || 'rep';
        curr.delta = diff > 0 ? `+${diff} ${unit}` : diff < 0 ? `${diff} ${unit}` : '±0';
      }
    });

    return chronoSessions;
  }, [recentSets, activeEx]);

  const exUnit = activeEx?.unit || 'rep';

  // KPI computations
  const lastSession = historyList[historyList.length - 1];

  // Next planned target
  const nextTarget = lastSession && lastSession.sets.length > 0
    ? (lastSession.sets.every(v => v >= lastSession.target) ? lastSession.target + (exUnit === 's' ? 5 : 1) : lastSession.target)
    : (exUnit === 's' ? 45 : 15);

  const allVals = historyList.flatMap(h => h.sets);
  const highestVal = allVals.length > 0 ? Math.max(...allVals, nextTarget) : nextTarget;
  const yMax = Math.max(highestVal * 1.25, exUnit === 's' ? 60 : 20);
  const numGroups = Math.max(1, historyList.length + 1);
  const groupWidth = 100 / numGroups;

  // State chọn ngày trên Lịch tháng (Mobile tương tác)
  const today = new Date();
  const [selectedDayNum, setSelectedDayNum] = useState(() => today.getDate());

  const selectedDateStr = useMemo(() => {
    return `${currentYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDayNum).padStart(2, '0')}`;
  }, [currentYear, selectedMonth, selectedDayNum]);

  const selectedSession = useMemo(() => {
    return completedSessions.find(s => s.local_date === selectedDateStr);
  }, [completedSessions, selectedDateStr]);

  const selectedDayInfo = useMemo(() => {
    const d = new Date(currentYear, selectedMonth - 1, selectedDayNum);
    const dayOfWeek = d.getDay();
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return {
      weekdayName: dayNames[dayOfWeek],
      formattedDate: `${selectedDayNum}/${selectedMonth}`
    };
  }, [currentYear, selectedMonth, selectedDayNum]);

  const selectedDaySets = useMemo(() => {
    if (!selectedSession) return [];
    const sets = (recentSets || []).filter(s => s.session_id === selectedSession.id);
    const grouped = new Map();
    sets.forEach(s => {
      const key = s.exercise_key || s.exercise_name;
      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          name: s.exercise_name || key,
          sets: [],
          target_val: s.target_val,
          target_sets: s.target_sets,
          unit: s.unit || 'rep',
          hasPr: false
        });
      }
      const item = grouped.get(key);
      if (s.actual_val != null) item.sets.push(s.actual_val);
      if (s.is_pr) item.hasPr = true;
    });
    return Array.from(grouped.values());
  }, [selectedSession, recentSets]);

  return (
    <>
      {/* ── GIAO DIỆN DESKTOP (BỐ CỤC CHUẨN DESKTOP) ──────────────── */}
      <div className="body-history-desktop-view">
      {/* ── HEADER SUMMARY STATS ─────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 4px 0', letterSpacing: '-0.01em' }}>
            Lịch sử tập & Tiến bộ
          </h2>
          <div style={{ fontSize: '13.5px', color: 'var(--body-text-muted)' }}>
            {completedSessions.length > 0
              ? `${completedSessions.length} buổi đã hoàn thành · Theo dõi tiến độ thực tế`
              : 'Chưa có buổi tập nào hoàn tất'}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', fontSize: '12.5px' }}>
          {Object.entries(DAY_TYPE_COLORS).map(([name, color]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
              <span style={{ color: 'var(--body-text-sub)' }}>{name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── KHỐI TIẾN BỘ TỪNG BÀI (PER-SET BAR CHART) ────────────── */}
      <div className="body-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>Tiến bộ từng bài tập</div>
            <div style={{ fontSize: '12.5px', color: 'var(--body-text-muted)' }}>
              Mỗi cột dọc là một set · Đường nét đứt là mục tiêu · Cột nét đứt là buổi tới
            </div>
          </div>

          {/* Exercise Tabs */}
          <div style={{ display: 'flex', gap: '6px', background: 'var(--body-shell-bg)', padding: '4px', borderRadius: '10px', flexWrap: 'wrap' }}>
            {availableExercises.map(ex => (
              <button
                key={ex.key}
                className="body-btn"
                style={{
                  height: '30px',
                  padding: '0 12px',
                  fontSize: '12.5px',
                  background: selectedExKey === ex.key ? 'var(--body-card-bg)' : 'transparent',
                  color: selectedExKey === ex.key ? 'var(--body-text-main)' : 'var(--body-text-muted)',
                  boxShadow: selectedExKey === ex.key ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                }}
                onClick={() => setSelectedExKey(ex.key)}
              >
                {ex.name}
              </button>
            ))}
          </div>
        </div>

        {historyList.length === 0 ? (
          <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--body-text-muted)' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--body-shell-bg)', display: 'grid', placeItems: 'center', margin: '0 auto 12px auto' }}>
              <AppIcon name="barbell" size={20} />
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--body-text-main)', marginBottom: '4px' }}>
              Chưa có dữ liệu cho bài {activeEx?.name || 'này'}
            </div>
            <div style={{ fontSize: '13px' }}>
              Hãy thực hiện và lưu buổi tập ở tab Buổi tập để bắt đầu ghi nhận tiến độ.
            </div>
          </div>
        ) : (
          <div>
            {/* Chart Container */}
            <div style={{
              height: '240px',
              padding: '24px 16px 12px 16px',
              background: 'var(--body-shell-bg)',
              borderRadius: '14px',
              position: 'relative'
            }}>
              {/* Target guideline */}
              <div style={{
                position: 'absolute',
                left: '16px',
                right: '16px',
                top: `${100 - ((lastSession?.target || 10) / yMax) * 100}%`,
                borderTop: '1.5px dashed var(--body-accent)',
                zIndex: 1,
                display: 'flex',
                justifyContent: 'flex-end'
              }}>
                <span style={{
                  fontSize: '10.5px',
                  fontFamily: 'var(--body-mono)',
                  color: 'var(--body-accent)',
                  background: 'var(--body-shell-bg)',
                  padding: '0 6px',
                  transform: 'translateY(-50%)',
                  fontWeight: 600
                }}>
                  Mục tiêu {lastSession?.target || 10} {exUnit}
                </span>
              </div>

              {/* Render Sessions Bars */}
              <div style={{ display: 'flex', height: '100%', alignItems: 'flex-end', justifyContent: 'space-around', position: 'relative', zIndex: 2 }}>
                {historyList.map((session, sIdx) => (
                  <div
                    key={sIdx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      height: '100%',
                      justifyContent: 'flex-end',
                      width: `${groupWidth * 0.8}%`
                    }}
                  >
                    {/* PR indicator */}
                    {session.pr && (
                      <div style={{ marginBottom: '4px', color: '#E0A23C' }}>
                        <AppIcon name="trophy" size={14} />
                      </div>
                    )}

                    {/* Set bars group */}
                    <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', width: '100%', height: '100%' }}>
                      {session.sets.map((val, setIdx) => {
                        const isMet = val >= session.target;
                        const heightPct = Math.min(100, (val / yMax) * 100);
                        return (
                          <div
                            key={setIdx}
                            style={{
                              flex: 1,
                              height: `${heightPct}%`,
                              borderRadius: '4px 4px 0 0',
                              background: isMet ? 'var(--body-accent)' : '#F0B67F',
                              transition: 'height 0.3s ease'
                            }}
                            title={`Set ${setIdx + 1}: ${val}${exUnit}`}
                          />
                        );
                      })}
                    </div>

                    {/* Bottom date label */}
                    <div style={{ marginTop: '8px', fontSize: '11.5px', fontFamily: 'var(--body-mono)', color: 'var(--body-text-muted)' }}>
                      {session.date}
                    </div>
                  </div>
                ))}

                {/* Ghost Bar for Next Session */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'flex-end',
                    width: `${groupWidth * 0.8}%`
                  }}
                >
                  <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', width: '100%', height: '100%' }}>
                    {Array.from({ length: 3 }, (_, i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: `${(nextTarget / yMax) * 100}%`,
                          borderRadius: '4px 4px 0 0',
                          border: '1.5px dashed var(--body-accent-border)',
                          background: 'transparent'
                        }}
                        title={`Mục tiêu set ${i + 1}: ${nextTarget}${exUnit}`}
                      />
                    ))}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '11.5px', fontFamily: 'var(--body-mono)', color: 'var(--body-accent)', fontWeight: 600 }}>
                    Buổi tới
                  </div>
                </div>
              </div>
            </div>

            {/* Bảng chi tiết lần tập */}
            <div style={{ marginTop: '16px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--body-card-border)', color: 'var(--body-text-muted)', textAlign: 'left', height: '36px' }}>
                    <th>NGÀY TẬP</th>
                    <th>CÁC SET ĐÃ GHI</th>
                    <th>SO VỚI LẦN TRƯỚC</th>
                    <th>ĐÁNH GIÁ</th>
                  </tr>
                </thead>
                <tbody>
                  {[...historyList].reverse().map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--body-card-border)', height: '48px' }}>
                      <td style={{ fontWeight: 600 }}>{row.date} · {row.type}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {row.sets.map((v, sIdx) => (
                            <span
                              key={sIdx}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                background: v >= row.target ? 'var(--body-green-soft)' : 'var(--body-shell-bg)',
                                color: v >= row.target ? 'var(--body-green-text)' : 'var(--body-text-main)',
                                fontFamily: 'var(--body-mono)',
                                fontSize: '12px',
                                fontWeight: 600
                              }}
                            >
                              {v}{exUnit}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ color: row.delta.startsWith('+') ? 'var(--body-green)' : 'var(--body-text-muted)', fontWeight: 600 }}>
                        {row.delta}
                      </td>
                      <td>
                        {row.pr ? (
                          <span className="body-badge body-badge-amber" style={{ gap: '4px' }}>
                            <AppIcon name="trophy" size={12} /> Kỷ lục mới
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>Bình thường</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── LỊCH THÁNG (MONTH CALENDAR) ─────────────────────────── */}
      <div className="body-card">
        <div className="body-card-header">
          <div>
            <h3 className="body-card-title">Lịch tập Tháng {selectedMonth}, {currentYear}</h3>
            <div style={{ fontSize: '12.5px', color: 'var(--body-text-muted)' }}>
              Theo dõi chuỗi buổi tập đã hoàn thành theo lộ trình
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="body-btn-icon" onClick={() => setSelectedMonth(prev => Math.max(1, prev - 1))}>
              <AppIcon name="caretLeft" size={14} />
            </button>
            <button className="body-btn-icon" onClick={() => setSelectedMonth(prev => Math.min(12, prev + 1))}>
              <AppIcon name="caretRight" size={14} />
            </button>
          </div>
        </div>

        {/* Weekday headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '8px', textAlign: 'center', marginBottom: '8px' }}>
          {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
            <div key={d} style={{ fontSize: '12px', fontFamily: 'var(--body-mono)', color: 'var(--body-text-muted)', fontWeight: 600 }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        {(() => {
          const daysInMonth = new Date(currentYear, selectedMonth, 0).getDate();
          const firstDayWeekday = new Date(currentYear, selectedMonth - 1, 1).getDay(); // 0: CN, 1: T2, ..., 6: T7
          const startOffset = firstDayWeekday === 0 ? 6 : firstDayWeekday - 1;

          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '6px' }}>
              {/* Padding cells */}
              {Array.from({ length: startOffset }, (_, idx) => (
                <div key={`empty-${idx}`} style={{ minHeight: '60px', borderRadius: '10px', background: 'transparent' }} />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const dayNum = i + 1;
                const trainedSession = completedSessions.find(s => {
                  if (!s.local_date) return false;
                  const parts = s.local_date.split('-').map(Number);
                  return parts[0] === currentYear && parts[1] === selectedMonth && parts[2] === dayNum;
                });

                return (
                  <div
                    key={dayNum}
                    className="body-calendar-cell"
                    style={{
                      minHeight: '60px',
                      border: '1px solid var(--body-card-border)',
                      borderRadius: '10px',
                      padding: '6px',
                      background: trainedSession ? 'var(--body-shell-bg)' : 'var(--body-card-bg)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="body-calendar-num">{dayNum}</span>
                      {trainedSession && (
                        <span style={{ color: 'var(--body-green)' }}>
                          <AppIcon name="checkCircle" size={12} />
                        </span>
                      )}
                    </div>

                    {trainedSession && (
                      <div
                        className="body-calendar-pill"
                        style={{
                          background: DAY_TYPE_COLORS[trainedSession.day_type] || 'var(--body-accent)',
                          padding: '2px 4px',
                          borderRadius: '4px',
                          fontSize: '10.5px',
                          color: '#fff',
                          textAlign: 'center',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {trainedSession.day_type || 'Tập'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>

      {/* ── GIAO DIỆN MOBILE CHUYÊN BIỆT (CHUẨN PROTOTYPE LỊCH SỬ TẬP MOBILE 390PX) ── */}
      <div className="body-history-mobile-view">
        {/* 1. HEADER MOBILE: LỊCH SỬ TẬP + CHỌN THÁNG */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 2px'
        }}>
          <span style={{ fontSize: '19px', fontWeight: 600, color: 'var(--body-text-main)' }}>
            Lịch sử tập
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setSelectedMonth(prev => Math.max(1, prev - 1))}
              style={{
                width: '32px',
                height: '32px',
                border: 'none',
                background: 'transparent',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--body-text-main)',
                cursor: 'pointer'
              }}
            >
              <AppIcon name="caretLeft" size={14} />
            </button>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--body-text-main)', minWidth: '48px', textAlign: 'center' }}>
              Th{selectedMonth}
            </span>
            <button
              type="button"
              onClick={() => setSelectedMonth(prev => Math.min(12, prev + 1))}
              style={{
                width: '32px',
                height: '32px',
                border: 'none',
                background: 'transparent',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--body-text-main)',
                cursor: 'pointer'
              }}
            >
              <AppIcon name="caretRight" size={14} />
            </button>
          </div>
        </div>

        {/* 2. KHỐI LỊCH THÁNG (MONTH CALENDAR CHO MOBILE) */}
        <div className="body-history-mobile-cal-card">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            fontFamily: 'var(--body-mono)',
            fontSize: '10.5px',
            color: 'var(--body-text-muted)',
            textAlign: 'center',
            paddingBottom: '4px'
          }}>
            <span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span>CN</span>
          </div>

          {(() => {
            const daysInMonth = new Date(currentYear, selectedMonth, 0).getDate();
            const firstDayWeekday = new Date(currentYear, selectedMonth - 1, 1).getDay();
            const startOffset = firstDayWeekday === 0 ? 6 : firstDayWeekday - 1;

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '2px' }}>
                {Array.from({ length: startOffset }, (_, idx) => (
                  <div key={`empty-mob-${idx}`} style={{ height: '46px' }} />
                ))}

                {Array.from({ length: daysInMonth }, (_, i) => {
                  const dayNum = i + 1;
                  const dateStr = `${currentYear}-${String(selectedMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const session = completedSessions.find(s => s.local_date === dateStr);
                  const isSelected = selectedDayNum === dayNum;
                  const isToday = today.getFullYear() === currentYear && (today.getMonth() + 1) === selectedMonth && today.getDate() === dayNum;

                  const dotColor = session
                    ? (DAY_TYPE_COLORS[session.day_type] || '#6949E8')
                    : 'transparent';

                  return (
                    <div
                      key={`mob-day-${dayNum}`}
                      onClick={() => setSelectedDayNum(dayNum)}
                      className={`body-history-mobile-cell ${isSelected ? 'selected' : ''}`}
                    >
                      <span style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '12px',
                        background: isSelected ? 'var(--body-accent)' : isToday ? 'var(--body-shell-bg)' : 'transparent',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: isSelected ? '#FFFFFF' : 'var(--body-text-main)'
                      }}>
                        {dayNum}
                      </span>
                      <span style={{
                        width: '14px',
                        height: '5px',
                        borderRadius: '3px',
                        background: dotColor,
                        boxSizing: 'border-box'
                      }} />
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* 3. THẺ CHI TIẾT BUỔI TẬP THEO NGÀY ĐANG CHỌN */}
        <div style={{
          background: 'var(--body-card-bg)',
          border: '1px solid var(--body-card-border)',
          borderRadius: '18px',
          padding: '14px 14px 8px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            paddingBottom: '8px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
              <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                {selectedDayInfo.weekdayName} — {selectedSession ? (selectedSession.name || `Buổi ${selectedSession.day_type || 'Tập'}`) : 'Ngày nghỉ'}
              </span>
              <span style={{ fontSize: '11.5px', color: 'var(--body-text-muted)' }}>
                {selectedDayInfo.formattedDate} · {selectedSession
                  ? `${selectedSession.duration_seconds ? `${Math.round(selectedSession.duration_seconds / 60)} phút · ` : ''}${selectedSession.routine_id ? 'Lộ trình' : 'Buổi tự do'}`
                  : 'Phục hồi thể lực'}
              </span>
            </div>

            <span style={{
              height: '24px',
              padding: '0 9px',
              borderRadius: '7px',
              background: selectedSession ? 'var(--body-green-soft)' : 'var(--body-shell-bg)',
              color: selectedSession ? 'var(--body-green-text)' : 'var(--body-text-muted)',
              display: 'flex',
              alignItems: 'center',
              fontSize: '11px',
              fontWeight: 600,
              flex: 'none'
            }}>
              {selectedSession ? 'ĐÃ HOÀN THÀNH' : 'NGHỈ'}
            </span>
          </div>

          {selectedSession ? (
            <div>
              {selectedDaySets.length > 0 ? (
                selectedDaySets.map(item => (
                  <div
                    key={item.key}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) auto',
                      gap: '4px 10px',
                      alignItems: 'baseline',
                      padding: '10px 0',
                      borderTop: '1px solid var(--body-card-border)'
                    }}
                  >
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: 'var(--body-text-main)'
                    }}>
                      {item.name}
                      {item.hasPr && (
                        <span style={{ color: 'var(--body-amber-text)', display: 'inline-flex' }}>
                          <AppIcon name="trophy" size={12} weight="fill" />
                        </span>
                      )}
                    </span>
                    <span style={{
                      fontFamily: 'var(--body-mono)',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--body-text-main)'
                    }}>
                      {item.sets.join(' · ')} {item.unit}
                    </span>
                    <span style={{
                      fontSize: '10.5px',
                      color: 'var(--body-text-muted)',
                      gridColumn: '1 / -1'
                    }}>
                      Mục tiêu: {item.target_sets || 3} × {item.target_val || 10}{item.unit}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ padding: '8px 0', fontSize: '12px', color: 'var(--body-text-muted)' }}>
                  Buổi tập đã hoàn thành nhưng không có dữ liệu hiệp chi tiết.
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '4px 0 10px', fontSize: '12.5px', color: 'var(--body-text-sub)', lineHeight: 1.55 }}>
              Ngày nghỉ phục hồi thể lực theo lộ trình. Cho phép cơ bắp tái tạo glycogen và thư giãn.
            </div>
          )}
        </div>

        {/* 4. KHỐI TIẾN BỘ TỪNG BÀI TẬP */}
        <div style={{
          background: 'var(--body-card-bg)',
          border: '1px solid var(--body-card-border)',
          borderRadius: '18px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--body-text-main)' }}>
            Tiến bộ từng bài
          </span>

          {/* Exercise Tabs cuộn ngang */}
          <div className="body-history-mobile-tab-scroll">
            {availableExercises.map(ex => {
              const isSelected = ex.key === selectedExKey;
              return (
                <button
                  key={ex.key}
                  type="button"
                  onClick={() => setSelectedExKey(ex.key)}
                  style={{
                    height: '34px',
                    flex: 'none',
                    padding: '0 12px',
                    borderRadius: '9px',
                    border: isSelected ? '1px solid var(--body-accent)' : '1px solid var(--body-border-subtle)',
                    background: isSelected ? 'var(--body-accent)' : 'var(--body-card-bg)',
                    color: isSelected ? '#FFFFFF' : 'var(--body-text-main)',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '12px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer'
                  }}
                >
                  {ex.name}
                </button>
              );
            })}
          </div>

          {/* 2 KPIs Tóm tắt */}
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--body-text-muted)' }}>Cao nhất đạt được</span>
              <span style={{ fontSize: '17px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                {highestVal} {exUnit}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--body-text-muted)' }}>Mục tiêu buổi tới</span>
              <span style={{ fontSize: '17px', fontWeight: 600, color: 'var(--body-accent)' }}>
                {nextTarget} {exUnit}
              </span>
            </div>
          </div>

          {/* Danh sách thẻ lịch sử các lần tập bài này trên mobile */}
          <div className="body-history-mobile-list" style={{ marginTop: '4px' }}>
            {[...historyList].reverse().map((row, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--body-shell-bg)',
                  borderRadius: '12px',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                    {row.date} · {row.type}
                  </span>
                  {row.pr && (
                    <span className="body-badge body-badge-amber" style={{ gap: '4px', fontSize: '10.5px', padding: '2px 6px' }}>
                      <AppIcon name="trophy" size={11} /> PR
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {row.sets.map((v, sIdx) => (
                    <span
                      key={sIdx}
                      style={{
                        padding: '3px 7px',
                        borderRadius: '6px',
                        background: v >= row.target ? 'var(--body-green-soft)' : 'var(--body-card-bg)',
                        color: v >= row.target ? 'var(--body-green-text)' : 'var(--body-text-main)',
                        fontFamily: 'var(--body-mono)',
                        fontSize: '11.5px',
                        fontWeight: 600
                      }}
                    >
                      {v}{exUnit}
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--body-text-muted)' }}>
                  <span>Mục tiêu: {row.target}{exUnit}</span>
                  <span style={{
                    color: row.delta.startsWith('+') ? 'var(--body-green)' : 'var(--body-text-muted)',
                    fontWeight: 600
                  }}>
                    {row.delta}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
