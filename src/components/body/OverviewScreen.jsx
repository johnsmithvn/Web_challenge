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
  const { latest: latestWeight, addMeasurement, tdee } = useBiometrics();
  const { mealLogs, addMealLog } = useNutrition();
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

  // Today's scheduled session
  const todayRoutineItems = useMemo(() => {
    return (routineItems || []).filter(item => item.weekday === todayWeekday);
  }, [routineItems, todayWeekday]);

  // Last finished session
  const lastFinishedSession = useMemo(() => {
    return (sessions || []).find(s => s.status === 'completed');
  }, [sessions]);

  // Nutrition totals
  const totalKcal = mealLogs.reduce((sum, m) => sum + (m.calories || 0), 0);
  const totalProtein = mealLogs.reduce((sum, m) => sum + (Number(m.protein) || 0), 0);
  const totalCarbs = mealLogs.reduce((sum, m) => sum + (Number(m.carbs) || 0), 0);
  const totalFat = mealLogs.reduce((sum, m) => sum + (Number(m.fat) || 0), 0);
  const goalKcal = tdee ? Math.round(tdee) : null;

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
      // Find all completed sets targeting this muscle
      const matchingSets = (recentSets || []).filter(s => {
        // Bỏ qua set bị bỏ hoặc chưa hoàn thành
        if (s.actual_val == null && s.weight == null && s.reps == null) return false;
        const info = exerciseMap?.get(s.exercise_key);
        const primary = info?.primary || info?.primary_muscle || '';
        if (m.key === 'arms') return primary === 'triceps' || primary === 'biceps' || primary === 'arms';
        if (m.key === 'legs') return primary === 'quads' || primary === 'glutes' || primary === 'hamstrings' || primary === 'calves' || primary === 'legs';
        if (m.key === 'back') return primary === 'back' || primary === 'lats';
        if (m.key === 'core') return primary === 'abs' || primary === 'obliques' || primary === 'core';
        return primary === m.key;
      });

      // Chỉ đếm các set hoàn thành trong 7 ngày gần nhất
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

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'bạn';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* ── TOP GREETING & QUICK LOG ────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px 0', letterSpacing: '-0.01em', color: 'var(--body-text-main)' }}>
            Chào {userName} 👋
          </h2>
          <div style={{ fontSize: '13px', color: 'var(--body-text-muted)', fontWeight: 500 }}>
            {todayStr} {activeRoutine ? `· Kế hoạch: ${activeRoutine.name}` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="body-btn body-btn-secondary"
            onClick={() => setQuickModal(true)}
            style={{ height: '36px', padding: '0 14px' }}
          >
            <AppIcon name="pencil" size={15} /> Ghi nhanh
          </button>
          <button
            className="body-btn body-btn-accent"
            onClick={() => onStartSession?.({ weekday: todayWeekday, day: todayWeekday, name: todayRoutineItems.length > 0 ? `Buổi ${weekdayLabel(todayWeekday)}` : 'Buổi tập tự do' })}
            style={{ height: '36px', padding: '0 16px' }}
          >
            <AppIcon name="play" size={15} weight="fill" />
            <span>Bắt đầu buổi tập hôm nay</span>
          </button>
        </div>
      </div>

      {/* ── ROW 1: HERO WORKOUT + WEIGHT + NUTRITION ─────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>

        {/* 1. HERO CARD: BUỔI TẬP VỪA XONG / TIẾP THEO */}
        <div className="body-card-dark" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--body-mono)', fontSize: '11px', letterSpacing: '0.08em', color: '#9C9AA8', fontWeight: 600 }}>
              {lastFinishedSession ? 'BUỔI TẬP GẦN NHẤT' : 'BUỔI TẬP TIẾP THEO'}
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '20px',
              background: lastFinishedSession ? 'rgba(62, 158, 104, 0.22)' : 'rgba(105, 73, 232, 0.22)',
              color: lastFinishedSession ? '#7FD3A2' : '#C4B6F4',
              fontSize: '12px',
              fontWeight: 600
            }}>
              <AppIcon name={lastFinishedSession ? "checkCircle" : "calendar"} size={12} />
              {lastFinishedSession ? `Đã hoàn thành ${lastFinishedSession.local_date}` : 'Theo kế hoạch'}
            </span>
          </div>

          <div>
            <h3 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 6px 0', letterSpacing: '-0.01em', color: '#FFFFFF' }}>
              {lastFinishedSession ? (lastFinishedSession.title || lastFinishedSession.day_name || 'Buổi tập') : (todayRoutineItems.length > 0 ? `Lịch ${weekdayLabel(todayWeekday)} · ${todayRoutineItems.length} bài tập` : 'Hôm nay: Nghỉ ngơi hồi phục')}
            </h3>
            <div style={{ fontSize: '13px', color: '#9C9AA8' }}>
              {activeRoutine ? `Lộ trình ${activeRoutine.name}` : 'Chưa kích hoạt lộ trình cố định'}
            </div>
          </div>

          {/* 4 Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <div style={{ fontSize: '11.5px', color: '#9C9AA8', marginBottom: '2px' }}>Thời gian</div>
              <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: '#FFFFFF' }}>
                {lastFinishedSession && lastFinishedSession.duration_seconds > 0 ? `${Math.round(lastFinishedSession.duration_seconds / 60)} ph` : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11.5px', color: '#9C9AA8', marginBottom: '2px' }}>Bài tập</div>
              <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: '#FFFFFF' }}>
                {todayRoutineItems.length > 0 ? `${todayRoutineItems.length} bài` : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11.5px', color: '#9C9AA8', marginBottom: '2px' }}>Số buổi</div>
              <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: '#FFFFFF' }}>
                {sessions ? sessions.filter(s => s.status === 'completed').length : 0}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11.5px', color: '#9C9AA8', marginBottom: '2px' }}>Trạng thái</div>
              <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: '#E0A23C' }}>
                {todayRoutineItems.length > 0 ? 'Có lịch' : 'Nghỉ'}
              </div>
            </div>
          </div>

          {/* Bottom Alert / Action */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AppIcon name="trophy" size={16} style={{ color: '#E0A23C' }} />
              <span style={{ fontSize: '12.5px', color: '#D8D6E0' }}>
                {todayRoutineItems.length > 0 ? `Sẵn sàng cho buổi tập hôm nay!` : 'Hãy nghỉ ngơi và nạp đủ năng lượng!'}
              </span>
            </div>
            <button
              onClick={() => onNavigateTab?.('routine')}
              style={{
                background: 'none',
                border: 'none',
                color: '#B3A2F0',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>Xem lịch</span>
              <AppIcon name="arrowRight" size={12} />
            </button>
          </div>
        </div>

        {/* 2. CÂN NẶNG & TIẾN ĐỘ */}
        <div className="body-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--body-text-main)' }}>Cân nặng</span>
            <span style={{ fontSize: '12px', fontFamily: 'var(--body-mono)', color: 'var(--body-text-muted)' }}>
              {latestWeight ? latestWeight.local_date : 'Chưa có số đo'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span style={{ fontSize: '32px', fontWeight: 700, fontFamily: 'var(--body-mono)', letterSpacing: '-0.02em', color: 'var(--body-text-main)' }}>
              {latestWeight ? Number(latestWeight.weight).toFixed(2).replace('.', ',') : '—'} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--body-text-muted)' }}>kg</span>
            </span>
            {latestWeight?.body_fat_pct && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'var(--body-green-soft)',
                color: 'var(--body-green-text)',
                fontSize: '12px',
                fontWeight: 600
              }}>
                Mỡ {latestWeight.body_fat_pct}%
              </span>
            )}
          </div>

          <div style={{ flex: 1, minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button
              className="body-btn body-btn-secondary"
              onClick={() => onNavigateTab?.('biometrics')}
              style={{ height: '34px', fontSize: '12.5px' }}
            >
              <AppIcon name="scales" size={14} />
              <span>Xem phân tích thể trạng & BMI</span>
            </button>
          </div>
        </div>

        {/* 3. DINH DƯỠNG & MACROS */}
        <div className="body-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--body-text-main)' }}>Dinh dưỡng hôm nay</span>
            <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>{mealLogs.length} món đã ghi</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <div style={{ position: 'relative', width: '90px', height: '90px', flex: 'none' }}>
              <svg width="90" height="90" viewBox="0 0 96 96" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="48" cy="48" r="40" fill="none" stroke="var(--body-shell-bg)" strokeWidth="9" />
                {goalKcal ? (
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke="var(--body-accent)"
                    strokeWidth="9"
                    strokeDasharray="251.2"
                    strokeDashoffset={Math.max(0, 251.2 * (1 - Math.min(1, totalKcal / goalKcal)))}
                    strokeLinecap="round"
                  />
                ) : null}
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: 'var(--body-text-main)' }}>{totalKcal}</span>
                <span style={{ fontSize: '10px', color: 'var(--body-text-muted)' }}>
                  {goalKcal ? `/${goalKcal} kcal` : 'kcal'}
                </span>
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                <span style={{ color: 'var(--body-text-sub)' }}>Đạm</span>
                <span style={{ fontFamily: 'var(--body-mono)', fontWeight: 600, color: 'var(--body-accent)' }}>{totalProtein.toFixed(0)}g</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                <span style={{ color: 'var(--body-text-sub)' }}>Carb</span>
                <span style={{ fontFamily: 'var(--body-mono)', fontWeight: 600, color: 'var(--body-green)' }}>{totalCarbs.toFixed(0)}g</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                <span style={{ color: 'var(--body-text-sub)' }}>Béo</span>
                <span style={{ fontFamily: 'var(--body-mono)', fontWeight: 600, color: 'var(--body-amber)' }}>{totalFat.toFixed(0)}g</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>
              {goalKcal
                ? (goalKcal - totalKcal > 0 ? `Còn lại ${goalKcal - totalKcal} kcal` : `Đạt ${totalKcal} kcal`)
                : (totalKcal > 0 ? `Đã nạp ${totalKcal} kcal (Chưa đặt mục tiêu)` : 'Chưa thiết lập mục tiêu calo')}
            </span>
            <button
              onClick={() => onNavigateTab?.('nutrition')}
              style={{ background: 'none', border: 'none', color: 'var(--body-accent)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              Mở nhật ký ăn →
            </button>
          </div>
        </div>

      </div>

      {/* ── ROW 2: PHỤC HỒI CƠ THỂ & LỊCH 7 NGÀY ────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>

        {/* PHỤC HỒI NHÓM CƠ */}
        <div className="body-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                Bản đồ phục hồi cơ
              </div>
              <div style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>
                Mô hình 48h sau các buổi tập
              </div>
            </div>
            <button
              onClick={() => onNavigateTab?.('muscles')}
              style={{ background: 'none', border: 'none', color: 'var(--body-accent)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
            >
              Mở bản đồ 3D →
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
            {muscleRecovery.map(m => (
              <div
                key={m.name}
                style={{
                  padding: '10px 12px',
                  borderRadius: '12px',
                  background: 'var(--body-shell-bg)',
                  border: '1px solid var(--body-card-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--body-text-main)' }}>{m.name}</span>
                  <span style={{
                    padding: '2px 7px',
                    borderRadius: '5px',
                    background: m.bg,
                    color: m.color,
                    fontSize: '11px',
                    fontWeight: 600
                  }}>
                    {m.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* LỊCH 7 NGÀY TUẦN NÀY */}
        <div className="body-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                Lộ trình 7 ngày tuần này
              </div>
              <div style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>
                Thứ Hai — Chủ Nhật
              </div>
            </div>
            <button
              onClick={() => onNavigateTab?.('routine')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--body-accent)',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>Chi tiết lộ trình</span>
              <AppIcon name="arrowRight" size={12} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
            {scheduleDays.map(d => {
              const isToday = d.num === todayWeekday;
              const hasItem = d.hasItem;

              return (
                <div
                  key={d.day}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 4px',
                    borderRadius: '12px',
                    background: isToday ? 'var(--body-accent-soft)' : 'var(--body-shell-bg)',
                    border: `1.5px solid ${isToday ? 'var(--body-accent)' : 'var(--body-card-border)'}`,
                    minHeight: '76px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => onNavigateTab?.('routine')}
                >
                  <span style={{ fontSize: '11px', fontFamily: 'var(--body-mono)', fontWeight: 600, color: isToday ? 'var(--body-accent)' : 'var(--body-text-muted)' }}>
                    {d.day}
                  </span>

                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isToday ? '#6949E8' : hasItem ? '#2F8A57' : '#8A8A84'
                  }} />

                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: isToday ? 'var(--body-accent)' : 'var(--body-text-main)' }}>
                    {hasItem ? 'Tập' : 'Nghỉ'}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--body-accent-soft)', padding: '10px 14px', borderRadius: '12px', marginTop: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AppIcon name="lightning" size={16} style={{ color: 'var(--body-accent)' }} />
              <span style={{ fontSize: '12.5px', color: 'var(--body-text-main)', fontWeight: 500 }}>
                {todayRoutineItems.length > 0 ? `Hôm nay có ${todayRoutineItems.length} bài tập theo lịch!` : 'Hôm nay không có lịch tập cố định.'}
              </span>
            </div>
            <button
              className="body-btn body-btn-accent"
              onClick={() => onStartSession?.({ weekday: todayWeekday, day: todayWeekday, name: `Buổi ${weekdayLabel(todayWeekday)}` })}
              style={{ height: '30px', padding: '0 12px', fontSize: '12px' }}
            >
              Vào tập
            </button>
          </div>
        </div>

      </div>

      {/* ── QUICK CHECK-IN MODAL ─────────────────────────────────── */}
      {quickModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(16, 17, 20, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="body-card" style={{ width: '100%', maxWidth: '420px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Ghi nhanh chỉ số</h3>
              <button
                onClick={() => setQuickModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--body-text-muted)' }}
              >
                <AppIcon name="x" size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>Cân nặng (kg)</label>
              <input
                type="number"
                step="0.05"
                value={weightInput}
                onChange={e => setWeightInput(e.target.value)}
                style={{
                  height: '40px',
                  padding: '0 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--body-card-border)',
                  background: 'var(--body-shell-bg)',
                  color: 'var(--body-text-main)',
                  fontSize: '15px',
                  fontFamily: 'var(--body-mono)',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>Tên món ăn</label>
              <input
                type="text"
                value={mealNameInput}
                onChange={e => setMealNameInput(e.target.value)}
                style={{
                  height: '40px',
                  padding: '0 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--body-card-border)',
                  background: 'var(--body-shell-bg)',
                  color: 'var(--body-text-main)',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>Calories (kcal)</label>
              <input
                type="number"
                step="10"
                value={kcalInput}
                onChange={e => setKcalInput(e.target.value)}
                style={{
                  height: '40px',
                  padding: '0 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--body-card-border)',
                  background: 'var(--body-shell-bg)',
                  color: 'var(--body-text-main)',
                  fontSize: '15px',
                  fontFamily: 'var(--body-mono)',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button
                className="body-btn body-btn-secondary"
                onClick={() => setQuickModal(false)}
                style={{ flex: 1 }}
              >
                Hủy
              </button>
              <button
                className="body-btn body-btn-accent"
                onClick={handleQuickSave}
                style={{ flex: 1 }}
              >
                Lưu chỉ số
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
