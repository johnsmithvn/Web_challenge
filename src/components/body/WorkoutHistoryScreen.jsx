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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
  );
}
