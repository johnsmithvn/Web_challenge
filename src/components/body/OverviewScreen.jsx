import { useState, useMemo } from 'react';
import AppIcon from '../AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useBiometrics } from '../../hooks/useBiometrics';
import { useNutrition } from '../../hooks/useNutrition';
import { useWorkouts } from '../../hooks/useWorkouts';
import {
  estimateRecoveryState,
  RECOVERY_STATUS,
  RECOVERY_LABELS,
  RECOVERY_COLORS
} from '../../utils/workoutLogic';

export default function OverviewScreen({ onNavigateTab, onStartSession }) {
  const { user } = useAuth();
  const { latest: latestWeight, addMeasurement, tdee, bmiInfo } = useBiometrics();
  const { mealLogs, addMealLog, waterCups, updateWater } = useNutrition();
  const { activeRoutine, routineItems, sessions, recentSets, exerciseMap } = useWorkouts();

  const [quickModal, setQuickModal] = useState(false);
  const [weightInput, setWeightInput] = useState(latestWeight?.weight ? String(latestWeight.weight) : '');
  const [kcalInput, setKcalInput] = useState('');
  const [mealNameInput, setMealNameInput] = useState('Bữa ăn');

  const [now] = useState(() => Date.now());
  const today = useMemo(() => new Date(now), [now]);
  // Database standard: 1 = T2, 2 = T3, ..., 6 = T7, 7 = CN
  const jsDay = today.getDay();
  const todayWeekday = jsDay === 0 ? 7 : jsDay;
  const todayStr = today.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });
  const weekdayLabel = (w) => (w === 7 ? 'CN' : `T${w + 1}`);

  const todayDateStr = useMemo(() => {
    const d = new Date(now);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [now]);

  // Today's scheduled session
  const todayRoutineItems = useMemo(() => {
    return (routineItems || []).filter(item => item.weekday === todayWeekday);
  }, [routineItems, todayWeekday]);

  // Today completed session
  const todayCompletedSession = useMemo(() => {
    return (sessions || []).find(s => s.status === 'completed' && s.local_date === todayDateStr);
  }, [sessions, todayDateStr]);

  // Completed sets count today
  const todaySetsCount = useMemo(() => {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfDayMs = startOfDay.getTime();

    return (recentSets || []).filter(s => {
      if (s.actual_val == null && s.weight == null && s.reps == null) return false;
      const ts = s.completed_at ? new Date(s.completed_at).getTime() : null;
      return ts && ts >= startOfDayMs;
    }).length;
  }, [recentSets, now]);

  // Nutrition totals
  const totalKcal = mealLogs.reduce((sum, m) => sum + (m.calories || 0), 0);
  const totalProtein = mealLogs.reduce((sum, m) => sum + (Number(m.protein) || 0), 0);
  const totalCarbs = mealLogs.reduce((sum, m) => sum + (Number(m.carbs) || 0), 0);
  const totalFat = mealLogs.reduce((sum, m) => sum + (Number(m.fat) || 0), 0);
  const goalKcal = tdee ? Math.round(tdee) : null;
  const remainingKcal = goalKcal ? Math.max(0, goalKcal - totalKcal) : null;

  // 3 Rings SVG metrics (2b Prototype standard)
  const kcalRatio = goalKcal ? Math.min(1, totalKcal / goalKcal) : 0;
  const kcalDash = `${(kcalRatio * 295.3).toFixed(1)} 295.3`;

  const currentWaterL = (waterCups || 0) * 0.25;
  const waterRatio = Math.min(1, currentWaterL / 2.5);
  const waterDash = `${(waterRatio * 295.3).toFixed(1)} 295.3`;

  const targetWorkoutSets = todayRoutineItems.length > 0
    ? todayRoutineItems.reduce((acc, it) => acc + (it.target_sets || 3), 0)
    : 12;
  const isWorkoutDoneToday = Boolean(todayCompletedSession);
  const workoutRatio = isWorkoutDoneToday ? 1 : Math.min(1, todaySetsCount / targetWorkoutSets);
  const workoutDash = `${(workoutRatio * 295.3).toFixed(1)} 295.3`;

  // Dynamic headline (Phương án 2b "Nhịp ngày")
  const headline = useMemo(() => {
    if (isWorkoutDoneToday) {
      return remainingKcal != null
        ? `Tập xong, còn ${remainingKcal.toLocaleString('vi-VN')} kcal. Cân nặng đang đúng hướng.`
        : 'Tập xong. Cân nặng đang đúng hướng.';
    }
    if (todayRoutineItems.length > 0) {
      return remainingKcal != null
        ? `Lịch hôm nay: ${todayRoutineItems[0]?.day_name || 'Buổi tập'}. Còn ${remainingKcal.toLocaleString('vi-VN')} kcal.`
        : `Lịch hôm nay: ${todayRoutineItems[0]?.day_name || 'Buổi tập'}.`;
    }
    return remainingKcal != null
      ? `Hôm nay nghỉ ngơi hồi phục. Còn ${remainingKcal.toLocaleString('vi-VN')} kcal.`
      : 'Hôm nay nghỉ ngơi hồi phục.';
  }, [isWorkoutDoneToday, remainingKcal, todayRoutineItems]);

  // Muscle Recovery Status (derived from actual recentSets & exerciseMap)
  const muscleRecovery = useMemo(() => {
    const MUSCLES = [
      { key: 'chest', name: 'Ngực' },
      { key: 'back', name: 'Lưng & Xô' },
      { key: 'legs', name: 'Chân & mông' },
      { key: 'shoulders', name: 'Vai' },
      { key: 'arms', name: 'Tay' },
      { key: 'core', name: 'Bụng & Core' }
    ];

    const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;

    return MUSCLES.map(m => {
      const matchingSets = (recentSets || []).filter(s => {
        if (s.actual_val == null && s.weight == null && s.reps == null) return false;
        const info = exerciseMap?.get(s.exercise_key);
        const primary = info?.primary || info?.primary_muscle || '';
        if (m.key === 'arms') return primary === 'triceps' || primary === 'biceps' || primary === 'arms';
        if (m.key === 'legs') return primary === 'quads' || primary === 'glutes' || primary === 'hamstrings' || primary === 'calves' || primary === 'legs';
        if (m.key === 'back') return primary === 'back' || primary === 'lats';
        if (m.key === 'core') return primary === 'abs' || primary === 'obliques' || primary === 'core';
        return primary === m.key;
      });

      const sevenDaySets = matchingSets.filter(s => {
        const ts = s.completed_at ? new Date(s.completed_at).getTime() : null;
        return ts && ts >= sevenDaysAgo;
      }).length;

      let hoursSinceLast = null;
      let maxT = 0;

      matchingSets.forEach(s => {
        if (s.completed_at) {
          const t = new Date(s.completed_at).getTime();
          if (!Number.isNaN(t) && t > maxT) maxT = t;
        }
      });

      if (maxT > 0) {
        hoursSinceLast = Math.max(0, Math.round((now - maxT) / (1000 * 3600)));
      }

      const state = estimateRecoveryState(sevenDaySets, hoursSinceLast);
      const color = RECOVERY_COLORS[state] || '#2F7A50';
      const bg = state === RECOVERY_STATUS.LOW ? 'rgba(194, 59, 34, 0.12)' : state === RECOVERY_STATUS.MID ? 'rgba(181, 122, 18, 0.12)' : 'rgba(47, 138, 87, 0.12)';
      const label = RECOVERY_LABELS[state] || 'Sẵn sàng';
      const hoursText = hoursSinceLast == null ? 'Chưa tập' : hoursSinceLast < 24 ? 'Hôm nay' : `${hoursSinceLast}h trước`;

      return {
        name: m.name,
        label,
        color,
        bg,
        hours: hoursText
      };
    });
  }, [recentSets, exerciseMap, now]);

  // 7-day schedule strip from routineItems
  const scheduleDays = useMemo(() => {
    const list = [
      { day: 'T2', num: 1 },
      { day: 'T3', num: 2 },
      { day: 'T4', num: 3 },
      { day: 'T5', num: 4 },
      { day: 'T6', num: 5 },
      { day: 'T7', num: 6 },
      { day: 'CN', num: 7 }
    ];

    return list.map(d => {
      const items = (routineItems || []).filter(item => item.weekday === d.num);
      return {
        ...d,
        hasItem: items.length > 0,
        itemsCount: items.length,
        title: items.length > 0 ? (items[0].day_name || 'Tập luyện') : (d.num === 7 ? 'Check-in' : 'Nghỉ')
      };
    });
  }, [routineItems]);

  const handleQuickSave = async () => {
    if (weightInput) {
      await addMeasurement({
        weight: Number(weightInput),
        time_slot: 'morning',
        source: 'manual'
      }).catch(console.error);
    }
    if (kcalInput && mealNameInput) {
      await addMealLog({
        name: mealNameInput,
        calories: Number(kcalInput),
        type: 'lunch'
      }).catch(console.error);
    }
    setQuickModal(false);
  };

  const handleAddWaterCup = () => {
    updateWater?.((waterCups || 0) + 1);
  };

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'bạn';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── TOP HEADER / GREETING ───────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px 0', letterSpacing: '-0.01em', color: 'var(--body-text-main)' }}>
            Chào {userName} 👋
          </h2>
          <div style={{ fontSize: '13px', color: 'var(--body-text-muted)', fontWeight: 500 }}>
            {todayStr} {activeRoutine ? `· Kế hoạch: ${activeRoutine.name}` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="body-btn body-btn-secondary"
            onClick={() => setQuickModal(true)}
            style={{ height: '36px', padding: '0 12px', fontSize: '12.5px' }}
          >
            <AppIcon name="pencil" size={14} /> Ghi nhanh
          </button>
          <button
            className="body-btn body-btn-accent"
            onClick={() => onStartSession?.({
              weekday: todayWeekday,
              day: todayWeekday,
              name: todayRoutineItems.length > 0 ? `Buổi ${weekdayLabel(todayWeekday)}` : 'Buổi tập tự do'
            })}
            style={{ height: '36px', padding: '0 15px', fontSize: '12.5px' }}
          >
            <AppIcon name="play" size={14} weight="fill" />
            <span>Bắt đầu buổi tập</span>
          </button>
        </div>
      </div>

      {/* ── CARD PHƯƠNG ÁN 2B: 3 VÒNG MỤC TIÊU (RINGS) ──────────── */}
      <div className="body-card" style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: 'var(--body-text-muted)', fontWeight: 500 }}>{todayStr}</span>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--body-text-main)', margin: 0, letterSpacing: '-0.01em', lineHeight: 1.35 }}>
            {headline}
          </h3>
          <span style={{ fontSize: '12.5px', color: 'var(--body-text-sub)' }}>
            Tuần {activeRoutine?.current_week || 1} · {activeRoutine?.name || 'Kế hoạch cá nhân'} · Mục tiêu: {goalKcal ? `${goalKcal.toLocaleString('vi-VN')} kcal` : 'Theo TDEE'}
          </span>
        </div>

        {/* 3 Rings SVG Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', paddingTop: '6px' }}>
          {/* Ring 1: Calo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative', width: '88px', height: '88px' }}>
              <svg width="88" height="88" viewBox="0 0 112 112" className="body-ring-svg">
                <circle cx="56" cy="56" r="47" fill="none" stroke="var(--body-shell-bg)" strokeWidth="10" />
                <circle
                  cx="56"
                  cy="56"
                  r="47"
                  fill="none"
                  stroke="#6949E8"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={kcalDash}
                />
              </svg>
              <div className="body-ring-center">
                <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: 'var(--body-text-main)' }}>
                  {totalKcal > 0 ? totalKcal.toLocaleString('vi-VN') : '0'}
                </span>
                <span style={{ fontSize: '9.5px', color: 'var(--body-text-muted)' }}>
                  /{goalKcal || '—'}
                </span>
              </div>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--body-text-main)' }}>Calo nạp</span>
          </div>

          {/* Ring 2: Nước uống */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative', width: '88px', height: '88px' }}>
              <svg width="88" height="88" viewBox="0 0 112 112" className="body-ring-svg">
                <circle cx="56" cy="56" r="47" fill="none" stroke="var(--body-shell-bg)" strokeWidth="10" />
                <circle
                  cx="56"
                  cy="56"
                  r="47"
                  fill="none"
                  stroke="#3A82F6"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={waterDash}
                />
              </svg>
              <div className="body-ring-center">
                <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: 'var(--body-text-main)' }}>
                  {currentWaterL.toFixed(1)}L
                </span>
                <span style={{ fontSize: '9.5px', color: 'var(--body-text-muted)' }}>
                  /2.5L
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--body-text-main)' }}>Nước uống</span>
              <button
                onClick={handleAddWaterCup}
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '9px',
                  border: 'none',
                  background: 'var(--body-accent-soft)',
                  color: 'var(--body-accent)',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer'
                }}
                title="Thêm 1 cốc nước (250ml)"
              >
                +
              </button>
            </div>
          </div>

          {/* Ring 3: Buổi tập / Vận động */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative', width: '88px', height: '88px' }}>
              <svg width="88" height="88" viewBox="0 0 112 112" className="body-ring-svg">
                <circle cx="56" cy="56" r="47" fill="none" stroke="var(--body-shell-bg)" strokeWidth="10" />
                <circle
                  cx="56"
                  cy="56"
                  r="47"
                  fill="none"
                  stroke="#2F8A57"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={workoutDash}
                />
              </svg>
              <div className="body-ring-center">
                <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: 'var(--body-text-main)' }}>
                  {isWorkoutDoneToday ? 'Xong' : todaySetsCount}
                </span>
                <span style={{ fontSize: '9.5px', color: 'var(--body-text-muted)' }}>
                  {isWorkoutDoneToday ? '100%' : `/${targetWorkoutSets} set`}
                </span>
              </div>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--body-text-main)' }}>Buổi tập</span>
          </div>
        </div>
      </div>

      {/* ── TIMELINE HÔM NAY (PHƯƠNG ÁN 2B NHỊP NGÀY) ───────────── */}
      <div className="body-card" style={{ padding: '20px' }}>
        <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--body-text-main)', marginBottom: '14px' }}>
          Nhịp sinh hoạt hôm nay
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Mốc 1: Buổi sáng — Đo lường & Thể trạng */}
          <div className="body-timeline-item">
            <div className="body-timeline-icon-col">
              <span className="body-timeline-icon" style={{ background: '#F1EEFD', color: '#6949E8' }}>
                <AppIcon name="user" size={17} />
              </span>
              <span className="body-timeline-line" />
            </div>
            <div style={{ padding: '2px 0 16px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--body-text-main)' }}>Buổi sáng · Cân nặng & Số đo</span>
              <span style={{ fontSize: '12px', color: 'var(--body-text-sub)', lineHeight: 1.4 }}>
                {latestWeight?.weight ? `${latestWeight.weight} kg · ${latestWeight.local_date}` : 'Chưa có dữ liệu cân đo sáng nay'}
                {bmiInfo?.bmi ? ` · BMI ${bmiInfo.bmi} (${bmiInfo.classification})` : ''}
              </span>
            </div>
            <button
              className="body-btn body-btn-secondary"
              onClick={() => onNavigateTab?.('biometrics')}
              style={{ height: '30px', padding: '0 10px', fontSize: '11px', flexShrink: 0 }}
            >
              {latestWeight?.weight ? 'Xem cơ thể' : '+ Ghi cân'}
            </button>
          </div>

          {/* Mốc 2: Buổi trưa / Chiều — Tập luyện */}
          <div className="body-timeline-item">
            <div className="body-timeline-icon-col">
              <span className="body-timeline-icon" style={{ background: isWorkoutDoneToday ? '#E6F2EA' : '#FAF3E8', color: isWorkoutDoneToday ? '#2F8A57' : '#B57A12' }}>
                <AppIcon name="barbell" size={17} />
              </span>
              <span className="body-timeline-line" />
            </div>
            <div style={{ padding: '2px 0 16px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                {isWorkoutDoneToday ? 'Buổi tập hôm nay · Đã hoàn thành' : 'Buổi tập hôm nay · Lịch trình'}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--body-text-sub)', lineHeight: 1.4 }}>
                {isWorkoutDoneToday
                  ? `${todayCompletedSession.title || 'Buổi tập'} · ${Math.round(todayCompletedSession.duration_seconds / 60)} phút · ${todaySetsCount} set`
                  : todayRoutineItems.length > 0
                    ? `Lịch ${weekdayLabel(todayWeekday)}: ${todayRoutineItems.length} bài tập theo lộ trình`
                    : 'Hôm nay: Nghỉ ngơi hồi phục cơ bắp'}
              </span>
            </div>
            {isWorkoutDoneToday ? (
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#2F8A57', padding: '4px 8px', background: '#E6F2EA', borderRadius: '6px', flexShrink: 0 }}>
                Đã xong
              </span>
            ) : (
              <button
                className="body-btn body-btn-accent"
                onClick={() => onStartSession?.({ weekday: todayWeekday, day: todayWeekday, name: todayRoutineItems.length > 0 ? `Buổi ${weekdayLabel(todayWeekday)}` : 'Buổi tập tự do' })}
                style={{ height: '30px', padding: '0 11px', fontSize: '11px', flexShrink: 0 }}
              >
                Tập ngay
              </button>
            )}
          </div>

          {/* Mốc 3: Buổi tối — Dinh dưỡng & Năng lượng */}
          <div className="body-timeline-item">
            <div className="body-timeline-icon-col">
              <span className="body-timeline-icon" style={{ background: '#EBF3FE', color: '#2563EB' }}>
                <AppIcon name="bowlFood" size={17} />
              </span>
              <span className="body-timeline-line" />
            </div>
            <div style={{ padding: '2px 0 16px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--body-text-main)' }}>Buổi tối · Dinh dưỡng & Macro</span>
              <span style={{ fontSize: '12px', color: 'var(--body-text-sub)', lineHeight: 1.4 }}>
                Đã nạp {totalKcal} kcal ({totalProtein}g P · {totalCarbs}g C · {totalFat}g F) · {mealLogs.length} bữa ăn
              </span>
            </div>
            <button
              className="body-btn body-btn-secondary"
              onClick={() => onNavigateTab?.('nutrition')}
              style={{ height: '30px', padding: '0 10px', fontSize: '11px', flexShrink: 0 }}
            >
              + Bữa ăn
            </button>
          </div>

          {/* Mốc 4: Cuối tuần / Kế hoạch */}
          <div className="body-timeline-item">
            <div className="body-timeline-icon-col">
              <span className="body-timeline-icon" style={{ background: '#FAF8FF', color: '#6949E8' }}>
                <AppIcon name="calendar" size={17} />
              </span>
            </div>
            <div style={{ padding: '2px 0 4px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--body-text-main)' }}>Tiến độ tuần & Đánh giá</span>
              <span style={{ fontSize: '12px', color: 'var(--body-text-sub)', lineHeight: 1.4 }}>
                {activeRoutine ? `${activeRoutine.name} (Tuần ${activeRoutine.current_week || 1})` : 'Chưa kích hoạt lộ trình cố định'} · Check-in Chủ nhật
              </span>
            </div>
            <button
              className="body-btn body-btn-secondary"
              onClick={() => onNavigateTab?.('routine')}
              style={{ height: '30px', padding: '0 10px', fontSize: '11px', flexShrink: 0 }}
            >
              Lộ trình
            </button>
          </div>
        </div>
      </div>

      {/* ── THỐNG KÊ LỊCH TUẦN & PHỤC HỒI CƠ BẮP ────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {/* Lịch 7 ngày */}
        <div className="body-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--body-text-main)' }}>Lịch tập tuần này</span>
            <button
              className="body-btn"
              onClick={() => onNavigateTab?.('routine')}
              style={{ height: '26px', padding: '0 8px', fontSize: '11px' }}
            >
              Chi tiết
            </button>
          </div>
          <div className="body-days-strip">
            {scheduleDays.map(d => {
              const isToday = d.num === todayWeekday;
              return (
                <div key={d.day} className={`body-day-chip ${isToday ? 'active' : ''}`}>
                  <span className="body-day-chip-label">{d.day}</span>
                  <span className="body-day-chip-name" style={{ fontSize: '12px' }}>{d.title}</span>
                  <span className="body-day-chip-meta">{d.hasItem ? `${d.itemsCount} bài` : 'Nghỉ'}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trạng thái phục hồi cơ */}
        <div className="body-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--body-text-main)' }}>Trạng thái phục hồi cơ</span>
            <button
              className="body-btn"
              onClick={() => onNavigateTab?.('muscles')}
              style={{ height: '26px', padding: '0 8px', fontSize: '11px' }}
            >
              Bản đồ 3D
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {muscleRecovery.map(m => (
              <div
                key={m.name}
                style={{
                  padding: '8px 10px',
                  borderRadius: '10px',
                  background: 'var(--body-shell-bg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--body-text-main)' }}>{m.name}</span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: m.color }}>{m.label}</span>
                <span style={{ fontSize: '10px', color: 'var(--body-text-muted)' }}>{m.hours}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MODAL GHI NHANH ─────────────────────────────────────── */}
      {quickModal && (
        <div className="body-modal-backdrop" onClick={() => setQuickModal(false)}>
          <div className="body-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Ghi nhanh chỉ số</h3>
              <button
                className="body-btn"
                onClick={() => setQuickModal(false)}
                style={{ width: '28px', height: '28px', padding: 0 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--body-text-sub)', display: 'block', marginBottom: '4px' }}>
                  Cân nặng sáng nay (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  className="body-input"
                  placeholder="VD: 68.5"
                  value={weightInput}
                  onChange={e => setWeightInput(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--body-text-sub)', display: 'block', marginBottom: '4px' }}>
                  Tên món ăn vừa nạp
                </label>
                <input
                  type="text"
                  className="body-input"
                  placeholder="VD: Cơm gà, Phở bò..."
                  value={mealNameInput}
                  onChange={e => setMealNameInput(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--body-text-sub)', display: 'block', marginBottom: '4px' }}>
                  Ước tính calo (kcal)
                </label>
                <input
                  type="number"
                  className="body-input"
                  placeholder="VD: 550"
                  value={kcalInput}
                  onChange={e => setKcalInput(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button className="body-btn" onClick={() => setQuickModal(false)}>Hủy</button>
              <button className="body-btn body-btn-primary" onClick={handleQuickSave}>Lưu ngay</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
