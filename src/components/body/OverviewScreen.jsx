import { useState, useMemo, useEffect } from 'react';
import AppIcon from '../AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useBiometrics } from '../../hooks/useBiometrics';
import { useNutrition } from '../../hooks/useNutrition';
import { useWorkouts } from '../../hooks/useWorkouts';
import MuscleBodyCanvas from './MuscleBodyCanvas';
import { estimateRecoveryState, calculateRecoveryMetrics } from '../../utils/workoutLogic';
import { getWeekDates, toDateStr } from '../../utils/dateUtils';

const VN_MUSCLES = {
  chest: 'Ngực',
  shoulders: 'Vai',
  triceps: 'Tay sau',
  quads: 'Đùi trước',
  glutes: 'Mông',
  hamstrings: 'Đùi sau',
  calves: 'Bắp chân',
  lowerback: 'Lưng dưới',
  biceps: 'Tay trước',
  forearms: 'Cẳng tay',
  abs: 'Bụng',
  obliques: 'Liên sườn',
  traps: 'Cầu vai',
  lats: 'Xô'
};

export default function OverviewScreen({ onNavigateTab, onStartSession }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { latest: latestWeight, addMeasurement, measurements, profile, tdee } = useBiometrics();
  const { mealLogs, addMealLog, updateWater, waterCups } = useNutrition();
  const { activeRoutine, routineItems, sessions, recentSets, exerciseMap } = useWorkouts();

  const [quickModal, setQuickModal] = useState(false);
  const [quickTab, setQuickTab] = useState('weight'); // 'weight' | 'meal' | 'water'
  const [weightInput, setWeightInput] = useState(latestWeight?.weight ? String(latestWeight.weight) : '');
  const [weightTimeSlot, setWeightTimeSlot] = useState('morning');
  const [mealNameInput, setMealNameInput] = useState('');
  const [mealTypeInput, setMealTypeInput] = useState('breakfast');
  const [kcalInput, setKcalInput] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);

  // Lắng nghe sự kiện "Ghi nhanh" từ Header chung
  useEffect(() => {
    const handleOpenQuick = () => {
      setQuickModal(true);
      if (latestWeight?.weight && !weightInput) {
        setWeightInput(String(latestWeight.weight));
      }
    };
    window.addEventListener('body:open-quick-capture', handleOpenQuick);
    return () => window.removeEventListener('body:open-quick-capture', handleOpenQuick);
  }, [latestWeight?.weight, weightInput]);

  const [now] = useState(() => Date.now());
  const today = useMemo(() => new Date(now), [now]);
  const jsDay = today.getDay();
  const todayWeekday = jsDay === 0 ? 7 : jsDay; // 1 = T2 ... 7 = CN

  const todayStr = useMemo(() => {
    return today.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });
  }, [today]);

  const timeGreeting = useMemo(() => {
    const hr = today.getHours();
    if (hr < 12) return 'Sáng nay';
    if (hr < 18) return 'Chiều nay';
    return 'Tối nay';
  }, [today]);

  const displayName = user?.user_metadata?.full_name?.split(' ').pop() || user?.email?.split('@')[0] || 'bạn';
  const todayDateStr = useMemo(() => toDateStr(today), [today]);

  // Buổi tập hoàn thành hôm nay
  const todayCompletedSession = useMemo(() => {
    return (sessions || []).find(s => s.status === 'completed' && s.local_date === todayDateStr);
  }, [sessions, todayDateStr]);

  // Các bài tập theo lịch hôm nay
  const todayRoutineItems = useMemo(() => {
    return (routineItems || []).filter(item => item.weekday === todayWeekday);
  }, [routineItems, todayWeekday]);

  // Số set đã tập hôm nay
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

  // ── THẺ 1: BUỔI TẬP HÔM NAY ──────────────────────────────────
  const sessionStats = useMemo(() => {
    const isDone = Boolean(todayCompletedSession);
    const hasPlan = todayRoutineItems.length > 0;

    if (isDone) {
      const durationMin = Math.max(1, Math.round((todayCompletedSession.duration_seconds || 0) / 60));
      const exercisesCount = todayCompletedSession.exercises_count || 1;
      const setsCount = todayCompletedSession.sets_count || todaySetsCount || 1;
      const volumeKg = todayCompletedSession.total_volume || 0;
      const title = todayCompletedSession.title || 'Buổi tập hôm nay';
      const weekText = activeRoutine
        ? `Tuần ${activeRoutine.current_week || 1} / ${activeRoutine.target_weeks || 8} · ${activeRoutine.name}`
        : 'Buổi tập tự do';
      const finishTime = todayCompletedSession.completed_at || todayCompletedSession.ended_at
        ? new Date(todayCompletedSession.completed_at || todayCompletedSession.ended_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        : 'Hoàn thành';

      return { isDone: true, hasPlan: true, durationMin, exercisesCount, setsCount, volumeKg, title, weekText, finishTime };
    }

    if (hasPlan) {
      const exercisesCount = todayRoutineItems.length;
      const setsCount = todayRoutineItems.reduce((acc, it) => acc + (it.target_sets || 3), 0);
      const title = todayRoutineItems[0]?.day_name || 'Buổi tập hôm nay';
      const weekText = activeRoutine
        ? `Tuần ${activeRoutine.current_week || 1} / ${activeRoutine.target_weeks || 8} · ${activeRoutine.name}`
        : 'Kế hoạch tập luyện';

      return {
        isDone: false,
        hasPlan: true,
        durationMin: 0,
        exercisesCount,
        setsCount,
        volumeKg: 0,
        title,
        weekText,
        finishTime: null
      };
    }

    return {
      isDone: false,
      hasPlan: false,
      durationMin: 0,
      exercisesCount: 0,
      setsCount: 0,
      volumeKg: 0,
      title: 'Hôm nay không có lịch tập',
      weekText: activeRoutine ? `Lộ trình: ${activeRoutine.name} · Nghỉ ngơi phục hồi` : 'Chưa chọn lộ trình nào',
      finishTime: null
    };
  }, [todayCompletedSession, todayRoutineItems, todaySetsCount, activeRoutine]);

  // ── THẺ 2: CÂN NẶNG & SPARKLINE THẬT ─────────────────────────
  const weightData = useMemo(() => {
    if (!latestWeight || !latestWeight.weight) {
      return {
        hasData: false,
        currentStr: '—',
        diffText: '',
        time: '',
        spark: null,
        startStr: '—',
        remainText: '',
        progressPercent: 0
      };
    }

    const currentWeight = Number(latestWeight.weight);
    const targetWeight = profile?.target_weight ? Number(profile.target_weight) : null;
    const startWeight = profile?.start_weight
      ? Number(profile.start_weight)
      : (measurements && measurements.length > 0 ? Number(measurements[measurements.length - 1].weight) : currentWeight);

    let diffText = 'Lần đo đầu tiên';
    if (measurements && measurements.length >= 2) {
      const prevWeight = Number(measurements[1].weight);
      const diff = currentWeight - prevWeight;
      const diffSign = diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
      diffText = `${diffSign.replace('.', ',')} kg`;
    }

    // Sparkline từ các lần đo thật
    const recentM = (measurements || []).slice(0, 20).reverse();
    let spark = null;
    if (recentM.length >= 2) {
      const weights = recentM.map(m => Number(m.weight));
      const minW = Math.min(...weights) - 0.5;
      const maxW = Math.max(...weights) + 0.5;
      const range = maxW - minW || 1;
      const n = weights.length;

      const X = i => (i / (n - 1)) * 300;
      const Y = v => Math.max(5, Math.min(75, (1 - (v - minW) / range) * 80));

      const line = weights.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
      spark = {
        line,
        area: `${line} L300 80 L0 80 Z`,
        goal: targetWeight ? `M0 ${Y(targetWeight).toFixed(1)} L300 ${Y(targetWeight).toFixed(1)}` : null
      };
    } else {
      spark = {
        line: 'M0 40 L300 40',
        area: 'M0 40 L300 40 L300 80 L0 80 Z',
        goal: null
      };
    }

    let progressPercent = 0;
    let remainText = '';
    if (targetWeight) {
      const remain = Math.abs(currentWeight - targetWeight);
      remainText = `còn ${remain.toFixed(1).replace('.', ',')} kg tới ${targetWeight.toFixed(1).replace('.', ',')} kg`;
      if (startWeight !== targetWeight) {
        progressPercent = Math.min(100, Math.max(0, Math.round(((startWeight - currentWeight) / (startWeight - targetWeight)) * 100)));
      }
    } else {
      remainText = 'Chưa đặt mục tiêu';
    }

    const timeStr = latestWeight.measured_at
      ? new Date(latestWeight.measured_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      : '';

    return {
      hasData: true,
      currentStr: currentWeight.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 }),
      diffText,
      time: timeStr,
      spark,
      startStr: `${startWeight.toFixed(1).replace('.', ',')} kg`,
      remainText,
      progressPercent
    };
  }, [latestWeight, measurements, profile]);

  // ── THẺ 3: DINH DƯỠNG & MACROS THẬT ──────────────────────────
  const nutritionData = useMemo(() => {
    const totalKcal = (mealLogs || []).reduce((sum, m) => sum + (m.calories || 0), 0);
    const goalKcal = tdee ? Math.round(tdee) : (profile?.target_calories ? Number(profile.target_calories) : 2050);
    const C44 = 2 * Math.PI * 44;
    const ratio = goalKcal > 0 ? Math.min(1, totalKcal / goalKcal) : 0;
    const kcalDash = `${(C44 * ratio).toFixed(1)} ${C44.toFixed(1)}`;

    const totalProt = (mealLogs || []).reduce((sum, m) => sum + (Number(m.protein) || 0), 0);
    const goalProt = Math.round((goalKcal * 0.3) / 4);
    const totalCarb = (mealLogs || []).reduce((sum, m) => sum + (Number(m.carbs) || 0), 0);
    const goalCarb = Math.round((goalKcal * 0.45) / 4);
    const totalFatVal = (mealLogs || []).reduce((sum, m) => sum + (Number(m.fat) || 0), 0);
    const goalFatVal = Math.round((goalKcal * 0.25) / 9);

    const macros = [
      {
        n: 'Đạm',
        v: `${Math.round(totalProt)}/${goalProt} g`,
        p: `${goalProt > 0 ? Math.min(100, Math.round(totalProt / goalProt * 100)) : 0}%`,
        c: '#6949E8'
      },
      {
        n: 'Tinh bột',
        v: `${Math.round(totalCarb)}/${goalCarb} g`,
        p: `${goalCarb > 0 ? Math.min(100, Math.round(totalCarb / goalCarb * 100)) : 0}%`,
        c: '#E0A23C'
      },
      {
        n: 'Chất béo',
        v: `${Math.round(totalFatVal)}/${goalFatVal} g`,
        p: `${goalFatVal > 0 ? Math.min(100, Math.round(totalFatVal / goalFatVal * 100)) : 0}%`,
        c: '#E26A5A'
      }
    ];

    const mealsCount = (mealLogs || []).length;
    let note = 'Chưa ghi bữa ăn nào hôm nay.';
    if (mealsCount > 0) {
      const remainKcal = goalKcal - totalKcal;
      const remainProt = Math.max(0, goalProt - Math.round(totalProt));
      note = remainKcal >= 0
        ? `Còn ${remainKcal} kcal và ${remainProt} g đạm cho hôm nay.`
        : `Vượt mục tiêu ${Math.abs(remainKcal)} kcal hôm nay.`;
    }

    return {
      totalKcal,
      goalKcal,
      kcalDash,
      macros,
      mealsCount,
      note
    };
  }, [mealLogs, tdee, profile]);

  // ── THẺ 4: PHỤC HỒI CƠ (BẢN ĐỒ CƠ THẬT) ─────────────────────
  const recoveryData = useMemo(() => {
    const map = {};
    const muscleKeys = Object.keys(VN_MUSCLES);

    if (!recentSets || recentSets.length === 0) {
      muscleKeys.forEach(k => { map[k] = 'ready'; });
    } else {
      const stats = {};
      muscleKeys.forEach(k => {
        stats[k] = { totalSets: 0, primarySets: 0, lastTime: null, lastPrimaryTime: null };
      });
      const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;

      recentSets.forEach(s => {
        if (s.actual_val == null && s.weight == null && s.reps == null) return;
        const ex = exerciseMap?.get(s.exercise_key);
        if (!ex) return;
        const targetMuscles = [ex.primary, ...(ex.secondary || [])].filter(Boolean);
        const setTime = s.completed_at ? new Date(s.completed_at).getTime() : null;

        targetMuscles.forEach(mId => {
          if (!stats[mId]) return;
          const isPri = ex.primary === mId;
          if (setTime && setTime >= sevenDaysAgo) {
            stats[mId].totalSets += 1;
            if (isPri) stats[mId].primarySets += 1;
          }
          if (setTime) {
            if (!stats[mId].lastTime || setTime > stats[mId].lastTime) {
              stats[mId].lastTime = setTime;
            }
            if (isPri && (!stats[mId].lastPrimaryTime || setTime > stats[mId].lastPrimaryTime)) {
              stats[mId].lastPrimaryTime = setTime;
            }
          }
        });
      });

      muscleKeys.forEach(k => {
        const st = stats[k];
        const hoursSince = st.lastTime ? Math.max(0, Math.round((now - st.lastTime) / (3600 * 1000))) : null;
        const hoursSincePrimary = st.lastPrimaryTime ? Math.max(0, Math.round((now - st.lastPrimaryTime) / (3600 * 1000))) : null;
        const metrics = calculateRecoveryMetrics({
          totalSets: st.totalSets,
          primarySets: st.primarySets,
          hoursSince,
          hoursSincePrimary
        });
        map[k] = metrics.state;
      });
    }

    const recGroups = [
      { id: 'low', n: 'Cần nghỉ', c: '#C23B22', items: [], joined: '' },
      { id: 'mid', n: 'Đang hồi', c: '#B57A12', items: [], joined: '' },
      { id: 'ready', n: 'Sẵn sàng', c: '#2F8A57', items: [], joined: '' }
    ];

    muscleKeys.forEach(k => {
      const state = map[k] || 'ready';
      const grp = recGroups.find(g => g.id === state);
      if (grp) grp.items.push(VN_MUSCLES[k] || k);
    });

    recGroups.forEach(g => {
      g.joined = g.items.join(', ');
    });

    return { map, recGroups };
  }, [recentSets, exerciseMap, now]);

  // ── THẺ 5: TUẦN NÀY (7-NGÀY CỘT THẬT) ───────────────────────
  const weekData = useMemo(() => {
    const weekDates = getWeekDates(today);
    const mondayStr = new Date(weekDates[0]);
    const sundayStr = new Date(weekDates[6]);
    const dateRange = `${mondayStr.getDate()}/${mondayStr.getMonth() + 1} – ${sundayStr.getDate()}/${sundayStr.getMonth() + 1}`;

    const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

    const weekCompletedSessions = (sessions || []).filter(
      s => s.status === 'completed' && weekDates.includes(s.local_date)
    );

    const weekSets = weekCompletedSessions.reduce((acc, s) => acc + (s.sets_count || 0), 0);
    const weekDurationSec = weekCompletedSessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
    const weekDurationMin = Math.round(weekDurationSec / 60);

    const timeText = weekDurationMin >= 60
      ? `${Math.floor(weekDurationMin / 60)}g ${weekDurationMin % 60}`
      : `${weekDurationMin}`;
    const timeUnit = weekDurationMin >= 60 ? 'p' : ' phút';

    const plannedWeekdays = new Set((routineItems || []).map(it => it.weekday));
    const targetSessions = activeRoutine?.target_days_per_week || plannedWeekdays.size || 4;

    const dayStats = weekDates.map((dateStr, idx) => {
      const weekdayNum = idx + 1;
      const daySessions = (sessions || []).filter(
        s => s.status === 'completed' && s.local_date === dateStr
      );
      const setsOnDay = daySessions.reduce((acc, s) => acc + (s.sets_count || 0), 0);
      const isDone = daySessions.length > 0;
      const isPlanned = plannedWeekdays.has(weekdayNum);

      let st = 'rest';
      if (isDone) {
        st = 'done';
      } else if (isPlanned) {
        st = dateStr >= todayDateStr ? 'plan' : 'missed';
      }

      return {
        d: DAY_LABELS[idx],
        dateStr,
        s: setsOnDay,
        st
      };
    });

    const maxSets = Math.max(16, ...dayStats.map(d => d.s));

    const columns = dayStats.map((item) => {
      const isTodayCol = item.dateStr === todayDateStr;
      return {
        d: item.d,
        lbl: item.s > 0 ? item.s : '',
        h: item.st === 'rest' ? '4px' : `${Math.max(8, Math.round(item.s / maxSets * 100))}%`,
        bg: item.st === 'done'
          ? (isTodayCol ? '#6949E8' : '#C4B6F4')
          : item.st === 'plan' ? 'transparent' : '#F0EEE9',
        bd: item.st === 'plan' ? '1.5px dashed #C9C6BE' : '0',
        fg: isTodayCol ? '#15161A' : '#8A8A84',
        font: `${isTodayCol ? 600 : 500} 11px/1 'Be Vietnam Pro', sans-serif`
      };
    });

    return {
      dateRange,
      stats: [
        { n: 'Buổi', v: `${weekCompletedSessions.length}`, u: ` / ${targetSessions}` },
        { n: 'Set', v: `${weekSets}`, u: '' },
        { n: 'Thời gian', v: timeText, u: timeUnit }
      ],
      columns
    };
  }, [today, todayDateStr, sessions, routineItems, activeRoutine]);

  // ── THẺ 6: CHECK-IN TUẦN & NGÀY MAI THẬT ────────────────────
  const checkinTomorrowData = useMemo(() => {
    const daysLeft = Math.max(0, 7 - todayWeekday);
    const weekDates = getWeekDates(today);
    const sundayDate = new Date(weekDates[6]);
    const checkinDate = `CN ${sundayDate.getDate()}/${sundayDate.getMonth() + 1}`;

    const tomorrowWeekday = todayWeekday === 7 ? 1 : todayWeekday + 1;
    const tomorrowWeekdayLabel = tomorrowWeekday === 1 ? 'Thứ Hai' : tomorrowWeekday === 2 ? 'Thứ Ba' : tomorrowWeekday === 3 ? 'Thứ Tư' : tomorrowWeekday === 4 ? 'Thứ Năm' : tomorrowWeekday === 5 ? 'Thứ Sáu' : tomorrowWeekday === 6 ? 'Thứ Bảy' : 'Chủ Nhật';
    const tomorrowDateObj = new Date(today);
    tomorrowDateObj.setDate(tomorrowDateObj.getDate() + 1);
    const tomorrowDateStr = `${tomorrowWeekdayLabel} ${tomorrowDateObj.getDate()}/${tomorrowDateObj.getMonth() + 1}`;

    const tomorrowItems = (routineItems || []).filter(it => it.weekday === tomorrowWeekday);
    const hasTomorrowPlan = tomorrowItems.length > 0;

    let tomorrowTitle = 'Ngày nghỉ (Rest day)';
    let tomorrowExercises = [];
    let recoveryNote = 'Không có lịch tập vào ngày mai. Hãy nghỉ ngơi và nạp đủ dinh dưỡng!';

    if (hasTomorrowPlan) {
      tomorrowTitle = tomorrowItems[0]?.day_name || 'Buổi tập theo lịch';
      tomorrowExercises = tomorrowItems.slice(0, 4).map(it => {
        const ex = exerciseMap?.get(it.exercise_id);
        const name = it.exercise_name || ex?.name || it.exercise_id;
        const target = it.target_sets ? `${it.target_sets} × ${it.target_reps || 10}` : '3 × 10';
        return { n: name, rx: target };
      });
      recoveryNote = 'Sẵn sàng cho buổi tập ngày mai!';
    }

    return {
      daysLeft,
      checkinDate,
      hasTomorrowPlan,
      tomorrowTitle,
      tomorrowDate: tomorrowDateStr,
      tomorrowExercises,
      recoveryNote
    };
  }, [today, todayWeekday, routineItems, exerciseMap]);

  // Xử lý lưu Modal Ghi nhanh (Cân nặng / Bữa ăn)
  const handleSaveQuick = async (e) => {
    e?.preventDefault?.();
    setQuickLoading(true);
    try {
      if (quickTab === 'weight') {
        if (!weightInput || Number(weightInput) <= 0) {
          showToast?.('Vui lòng nhập số cân nặng hợp lệ (kg)', 'warning');
          return;
        }
        await addMeasurement?.({
          weight: Number(weightInput),
          time_slot: weightTimeSlot,
          source: 'manual',
          is_outlier: weightTimeSlot === 'evening'
        });
        showToast?.(`Đã lưu cân nặng ${weightInput} kg!`, 'success');
        setQuickModal(false);
      } else if (quickTab === 'meal') {
        if (!mealNameInput.trim()) {
          showToast?.('Vui lòng nhập tên món hoặc bữa ăn', 'warning');
          return;
        }
        await addMealLog?.({
          meal_type: mealTypeInput,
          name: mealNameInput.trim(),
          calories: Number(kcalInput) || 0
        });
        showToast?.(`Đã thêm bữa ăn "${mealNameInput.trim()}" (${kcalInput || 0} kcal)!`, 'success');
        setMealNameInput('');
        setKcalInput('');
        setQuickModal(false);
      }
    } catch (err) {
      console.error('Error saving quick capture:', err);
      showToast?.('Lỗi khi lưu: ' + (err.message || 'Thử lại'), 'error');
    } finally {
      setQuickLoading(false);
    }
  };

  const handleQuickWaterAdd = async (cupsToAdd) => {
    try {
      const nextCups = Math.max(0, (waterCups || 0) + cupsToAdd);
      await updateWater?.(nextCups);
      if (cupsToAdd > 0) {
        showToast?.(`Đã thêm ${cupsToAdd * 250}ml nước (Tổng hôm nay: ${(nextCups * 0.25).toFixed(1)}L)`, 'success');
      } else {
        showToast?.(`Đã trừ 250ml nước (Tổng hôm nay: ${(nextCups * 0.25).toFixed(1)}L)`, 'info');
      }
    } catch (err) {
      console.error('Error updating water:', err);
      showToast?.('Lỗi cập nhật nước', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── LỜI CHÀO TRÊN MOBILE (DESKTOP ĐÃ CÓ TRÊN 1 HEADER DUY NHẤT) ── */}
      <div className="body-mobile-greeting" style={{ display: 'none', flexDirection: 'column', gap: '4px', padding: '0 2px 2px' }}>
        <span style={{ fontSize: '19px', fontWeight: 600, color: 'var(--body-text-main)', letterSpacing: '-0.01em' }}>
          {timeGreeting}, {displayName}
        </span>
        <span style={{ fontSize: '12.5px', color: 'var(--body-text-muted)', fontWeight: 500 }}>
          {todayStr}
        </span>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          PHƯƠNG ÁN 2A: DESKTOP BẢNG THẺ GRID (3 CỘT × 2 HÀNG)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="body-2a-grid">

        {/* ── CARD 1: BUỔI TẬP HÔM NAY (DARK CARD) ── */}
        <div className="body-2a-dark-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ font: "500 10.5px/1 var(--body-mono)", letterSpacing: "0.09em", color: "#9C9AA8" }}>
              BUỔI TẬP HÔM NAY
            </span>
            {sessionStats.isDone ? (
              <span style={{ padding: "5px 9px", borderRadius: "20px", background: "rgba(62,158,104,0.22)", font: "600 11.5px/1 'Be Vietnam Pro',sans-serif", color: "#7FD3A2", display: "flex", alignItems: "center", gap: "5px" }}>
                <AppIcon name="checkCircle" size={13} weight="fill" />
                Xong {sessionStats.finishTime}
              </span>
            ) : sessionStats.hasPlan ? (
              <span style={{ padding: "5px 9px", borderRadius: "20px", background: "rgba(105,73,232,0.25)", font: "600 11.5px/1 'Be Vietnam Pro',sans-serif", color: "#B3A2F0", display: "flex", alignItems: "center", gap: "5px" }}>
                <AppIcon name="calendar" size={13} />
                Lên lịch hôm nay
              </span>
            ) : (
              <span style={{ padding: "5px 9px", borderRadius: "20px", background: "rgba(255,255,255,0.1)", font: "600 11.5px/1 'Be Vietnam Pro',sans-serif", color: "#9C9AA8", display: "flex", alignItems: "center", gap: "5px" }}>
                <AppIcon name="moon" size={13} />
                Nghỉ ngơi
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <span style={{ font: "600 24px/1.15 'Be Vietnam Pro',sans-serif", color: "#FFFFFF", letterSpacing: "-0.01em" }}>
              {sessionStats.title}
            </span>
            <span style={{ font: "400 13px/1 'Be Vietnam Pro',sans-serif", color: "#9C9AA8" }}>
              {sessionStats.weekText}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ font: "400 11.5px/1 'Be Vietnam Pro',sans-serif", color: "#9C9AA8" }}>Thời gian</span>
              <span style={{ font: "600 19px/1 'Be Vietnam Pro',sans-serif" }}>
                {sessionStats.isDone ? `${sessionStats.durationMin} phút` : (sessionStats.hasPlan ? '~45p' : '0p')}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ font: "400 11.5px/1 'Be Vietnam Pro',sans-serif", color: "#9C9AA8" }}>Bài</span>
              <span style={{ font: "600 19px/1 'Be Vietnam Pro',sans-serif" }}>
                {sessionStats.isDone || sessionStats.hasPlan ? sessionStats.exercisesCount : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ font: "400 11.5px/1 'Be Vietnam Pro',sans-serif", color: "#9C9AA8" }}>Set</span>
              <span style={{ font: "600 19px/1 'Be Vietnam Pro',sans-serif" }}>
                {sessionStats.isDone || sessionStats.hasPlan ? sessionStats.setsCount : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ font: "400 11.5px/1 'Be Vietnam Pro',sans-serif", color: "#9C9AA8" }}>Khối lượng</span>
              <span style={{ font: "600 19px/1 'Be Vietnam Pro',sans-serif" }}>
                {sessionStats.isDone ? `${sessionStats.volumeKg.toLocaleString('vi-VN')} kg` : '—'}
              </span>
            </div>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            {sessionStats.isDone ? (
              <>
                <AppIcon name="trophy" size={17} weight="fill" style={{ color: "#E0A23C" }} />
                <span style={{ flex: 1, font: "400 12.5px/1.3 'Be Vietnam Pro',sans-serif", color: "#D8D6E0" }}>
                  Buổi tập đã hoàn thành xuất sắc!
                </span>
                <button
                  onClick={() => onNavigateTab?.('history')}
                  style={{ font: "600 12.5px/1 'Be Vietnam Pro',sans-serif", color: "#B3A2F0", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  Xem buổi tập
                </button>
              </>
            ) : sessionStats.hasPlan ? (
              <button
                onClick={() => onStartSession ? onStartSession(todayRoutineItems) : onNavigateTab?.('routine')}
                style={{
                  height: '34px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  background: '#6949E8',
                  color: '#FFF',
                  fontWeight: 600,
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <AppIcon name="play" size={14} weight="fill" />
                Bắt đầu tập hôm nay
              </button>
            ) : (
              <button
                onClick={() => onNavigateTab?.('routine')}
                style={{
                  height: '34px',
                  padding: '0 14px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.12)',
                  color: '#FFF',
                  fontWeight: 600,
                  fontSize: '12.5px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Xem lộ trình tập
              </button>
            )}
          </div>
        </div>

        {/* ── CARD 2: CÂN NẶNG ── */}
        <div className="body-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ font: "600 14px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-main)" }}>Cân nặng</span>
            <span style={{ font: "400 12px/1 var(--body-mono)", color: "var(--body-text-muted)" }}>
              {weightData.hasData ? weightData.time : 'Chưa đo'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span style={{ font: "600 32px/1 'Be Vietnam Pro',sans-serif", letterSpacing: "-0.01em", color: "var(--body-text-main)" }}>
              {weightData.currentStr}<span style={{ font: "400 14px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-muted)" }}> kg</span>
            </span>
            {weightData.hasData && (
              <span style={{ font: "600 12.5px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-green)" }}>
                {weightData.diffText}
              </span>
            )}
          </div>

          {weightData.hasData ? (
            <>
              <div style={{ flex: 1, minHeight: '65px', position: 'relative' }}>
                <svg viewBox="0 0 300 80" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}>
                  <path d={weightData.spark.area} fill="rgba(105,73,232,0.08)" />
                  {weightData.spark.goal && (
                    <path d={weightData.spark.goal} fill="none" stroke="#2F8A57" strokeWidth="1.25" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                  )}
                  <path d={weightData.spark.line} fill="none" stroke="#6949E8" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <span style={{ height: '6px', borderRadius: '3px', background: '#F0EEE9', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${weightData.progressPercent}%`, background: '#6949E8', borderRadius: '3px' }} />
                </span>
                <div style={{ display: 'flex', justifyContent: 'space-between', font: "400 12px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-muted)" }}>
                  <span>{weightData.startStr}</span>
                  <span>{weightData.remainText}</span>
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px', background: 'var(--body-shell-bg)', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
              <span style={{ font: "400 12px/1.4 'Be Vietnam Pro',sans-serif", color: "var(--body-text-muted)" }}>
                Ghi lần cân đầu tiên để bắt đầu vẽ biểu đồ tiến độ & tính BMI, TDEE
              </span>
              <button
                type="button"
                onClick={() => setQuickModal(true)}
                className="body-btn body-btn-secondary"
                style={{ width: '100%', height: '32px', fontSize: '12px', fontWeight: 600 }}
              >
                + Ghi cân nặng ngay
              </button>
            </div>
          )}
        </div>

        {/* ── CARD 3: DINH DƯỠNG ── */}
        <div className="body-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ font: "600 14px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-main)" }}>Dinh dưỡng</span>
            <span style={{ font: "400 12px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-muted)" }}>
              {nutritionData.mealsCount} bữa đã ghi
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <div style={{ position: 'relative', width: '104px', height: '104px', flex: 'none' }}>
              <svg width="104" height="104" viewBox="0 0 104 104" style={{ display: 'block', transform: 'rotate(-90deg)' }}>
                <circle cx="52" cy="52" r="44" fill="none" stroke="#F0EEE9" strokeWidth="10" />
                <circle cx="52" cy="52" r="44" fill="none" stroke="#6949E8" strokeWidth="10" strokeLinecap="round" strokeDasharray={nutritionData.kcalDash} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <span style={{ font: "600 18px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-main)" }}>
                  {nutritionData.totalKcal.toLocaleString('vi-VN')}
                </span>
                <span style={{ font: "400 10.5px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-muted)" }}>
                  / {nutritionData.goalKcal.toLocaleString('vi-VN')} kcal
                </span>
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '11px', minWidth: 0 }}>
              {nutritionData.macros.map(m => (
                <div key={m.n} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', font: "400 12px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-sub)" }}>
                    <span>{m.n}</span>
                    <span style={{ font: "500 11.5px/1 var(--body-mono)", color: "var(--body-text-main)" }}>{m.v}</span>
                  </div>
                  <span style={{ height: '5px', borderRadius: '3px', background: '#F0EEE9', overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: m.p, background: m.c, borderRadius: '3px' }} />
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ font: "400 12.5px/1.45 'Be Vietnam Pro',sans-serif", color: "var(--body-text-sub)" }}>
              {nutritionData.note}
            </span>
            <button
              onClick={() => onNavigateTab?.('nutrition')}
              style={{ font: "600 12px/1 'Be Vietnam Pro',sans-serif", color: "#6949E8", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              Xem thực đơn
            </button>
          </div>
        </div>

        {/* ── CARD 4: PHỤC HỒI CƠ (CANVAS 3D + DANH SÁCH) ── */}
        <div className="body-card" style={{ padding: 0, display: 'grid', gridTemplateColumns: '200px minmax(0,1fr)', overflow: 'hidden', minHeight: 0 }}>
          <div className="body-2a-muscle-canvas-box">
            <MuscleBodyCanvas recovery={recoveryData.map} view="front" mode="rec" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ font: "600 14px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-main)" }}>Phục hồi cơ</span>
              <span
                onClick={() => onNavigateTab?.('muscles')}
                style={{ font: "600 12px/1 'Be Vietnam Pro',sans-serif", color: "#6949E8", cursor: 'pointer' }}
              >
                Bản đồ cơ
              </span>
            </div>

            {recoveryData.recGroups.map(g => (
              <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '7px', font: `600 12px/1 'Be Vietnam Pro',sans-serif`, color: g.c }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '4px', background: g.c }} />
                  {g.n} ({g.items.length})
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {g.items.length === 0 ? (
                    <span style={{ fontSize: '11.5px', color: 'var(--body-text-muted)' }}>—</span>
                  ) : (
                    g.items.map(item => (
                      <span key={item} className="body-2a-chip">
                        {item}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CARD 5: TUẦN NÀY ── */}
        <div className="body-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ font: "600 14px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-main)" }}>Tuần này</span>
            <span style={{ font: "400 12px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-muted)" }}>{weekData.dateRange}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
            {weekData.stats.map(s => (
              <div key={s.n} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ font: "400 11.5px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-muted)" }}>{s.n}</span>
                <span style={{ font: "600 19px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-main)" }}>
                  {s.v}<span style={{ font: "400 12px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-muted)" }}>{s.u}</span>
                </span>
              </div>
            ))}
          </div>

          <div style={{ flex: 1, minHeight: '90px', display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '8px', alignItems: 'end' }}>
            {weekData.columns.map((c, i) => (
              <div key={i} style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: '7px' }}>
                <span style={{ font: "500 10.5px/1 var(--body-mono)", color: "var(--body-text-muted)" }}>{c.lbl}</span>
                <span style={{ width: '100%', height: c.h, minHeight: '4px', borderRadius: '6px', background: c.bg, border: c.bd, boxSizing: 'border-box' }} />
                <span style={{ font: c.font, color: c.fg }}>{c.d}</span>
              </div>
            ))}
          </div>

          <span style={{ font: "400 12px/1.4 'Be Vietnam Pro',sans-serif", color: "var(--body-text-muted)" }}>
            Cột = số set mỗi ngày · nét đứt là buổi đã lên lịch
          </span>
        </div>

        {/* ── CARD 6: CHECK-IN TUẦN + NGÀY MAI ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minHeight: 0 }}>
          {/* 6a: Check-in tuần */}
          <div className="body-2a-checkin-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ font: "600 14px/1 'Be Vietnam Pro',sans-serif", color: "#2D2270" }}>Check-in tuần</span>
              <span style={{ font: "500 11.5px/1 var(--body-mono)", color: "#5238C9" }}>{checkinTomorrowData.checkinDate}</span>
            </div>
            <span style={{ font: "400 13px/1.5 'Be Vietnam Pro',sans-serif", color: "#4A3AA8" }}>
              {checkinTomorrowData.daysLeft === 0
                ? 'Hôm nay là ngày check-in! Cân buổi sáng và đo vòng eo.'
                : `Còn ${checkinTomorrowData.daysLeft} ngày. Cần 2 thứ: cân buổi sáng Chủ nhật và số đo vòng eo.`}
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ height: '28px', padding: '0 10px', borderRadius: '8px', background: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px', font: "500 12px/1 'Be Vietnam Pro',sans-serif", color: "#2D2270" }}>
                <AppIcon name="scales" size={13} /> Cân sáng CN
              </span>
              <span style={{ height: '28px', padding: '0 10px', borderRadius: '8px', background: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px', font: "500 12px/1 'Be Vietnam Pro',sans-serif", color: "#2D2270" }}>
                <AppIcon name="ruler" size={13} /> Vòng eo
              </span>
              <span style={{ height: '28px', padding: '0 10px', borderRadius: '8px', background: 'transparent', display: 'flex', alignItems: 'center', gap: '6px', font: "500 12px/1 'Be Vietnam Pro',sans-serif", color: "#5238C9" }}>
                <AppIcon name="camera" size={13} /> Ảnh (tùy chọn)
              </span>
            </div>
          </div>

          {/* 6b: Ngày mai */}
          <div className="body-card" style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ font: "600 14px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-main)" }}>Ngày mai</span>
              <span style={{ font: "400 12px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-muted)" }}>{checkinTomorrowData.tomorrowDate}</span>
            </div>
            <span style={{ font: "600 17px/1.2 'Be Vietnam Pro',sans-serif", color: "var(--body-text-main)" }}>
              {checkinTomorrowData.tomorrowTitle}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {checkinTomorrowData.tomorrowExercises.length === 0 ? (
                <div style={{ padding: '8px 0', fontSize: '13px', color: 'var(--body-text-muted)' }}>
                  Không có bài tập nào được lên lịch cho ngày mai.
                </div>
              ) : (
                checkinTomorrowData.tomorrowExercises.map((e, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0', borderTop: '1px solid var(--body-card-border)' }}>
                    <span style={{ font: "400 13px/1.2 'Be Vietnam Pro',sans-serif", color: "var(--body-text-sub)" }}>{e.n}</span>
                    <span style={{ font: "500 12px/1 var(--body-mono)", color: "var(--body-text-muted)" }}>{e.rx}</span>
                  </div>
                ))
              )}
            </div>
            <span style={{ marginTop: 'auto', font: "400 12px/1.4 'Be Vietnam Pro',sans-serif", color: "var(--body-green)" }}>
              {checkinTomorrowData.recoveryNote}
            </span>
          </div>
        </div>

      </div>

      {/* ══════════════════════════════════════════════════════════════════
          PHƯƠNG ÁN 2A: MOBILE CHUẨN THIẾT KẾ (DỮ LIỆU THẬT)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="body-2a-mobile">

        {/* 1. Thẻ Buổi tập hôm nay */}
        <div className="body-2a-dark-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ font: "500 10px/1 var(--body-mono)", letterSpacing: "0.09em", color: "#9C9AA8" }}>
              BUỔI TẬP HÔM NAY
            </span>
            {sessionStats.isDone ? (
              <span style={{ padding: "4px 8px", borderRadius: "20px", background: "rgba(62,158,104,0.22)", font: "600 11px/1 'Be Vietnam Pro',sans-serif", color: "#7FD3A2" }}>
                Xong {sessionStats.finishTime}
              </span>
            ) : sessionStats.hasPlan ? (
              <span style={{ padding: "4px 8px", borderRadius: "20px", background: "rgba(105,73,232,0.25)", font: "600 11px/1 'Be Vietnam Pro',sans-serif", color: "#B3A2F0" }}>
                Lên lịch hôm nay
              </span>
            ) : (
              <span style={{ padding: "4px 8px", borderRadius: "20px", background: "rgba(255,255,255,0.1)", font: "600 11px/1 'Be Vietnam Pro',sans-serif", color: "#9C9AA8" }}>
                Nghỉ ngơi
              </span>
            )}
          </div>
          <span style={{ font: "600 19px/1.2 'Be Vietnam Pro',sans-serif", color: "#FFFFFF" }}>
            {sessionStats.title}
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ font: "400 11px/1 'Be Vietnam Pro',sans-serif", color: "#9C9AA8" }}>Thời gian</span>
              <span style={{ font: "600 15px/1 'Be Vietnam Pro',sans-serif" }}>
                {sessionStats.isDone ? `${sessionStats.durationMin}p` : (sessionStats.hasPlan ? '~45p' : '0p')}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ font: "400 11px/1 'Be Vietnam Pro',sans-serif", color: "#9C9AA8" }}>Bài</span>
              <span style={{ font: "600 15px/1 'Be Vietnam Pro',sans-serif" }}>
                {sessionStats.isDone || sessionStats.hasPlan ? sessionStats.exercisesCount : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ font: "400 11px/1 'Be Vietnam Pro',sans-serif", color: "#9C9AA8" }}>Set</span>
              <span style={{ font: "600 15px/1 'Be Vietnam Pro',sans-serif" }}>
                {sessionStats.isDone || sessionStats.hasPlan ? sessionStats.setsCount : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ font: "400 11px/1 'Be Vietnam Pro',sans-serif", color: "#9C9AA8" }}>Khối lượng</span>
              <span style={{ font: "600 15px/1 'Be Vietnam Pro',sans-serif" }}>
                {sessionStats.isDone ? `${sessionStats.volumeKg.toLocaleString('vi-VN')}` : '—'}
              </span>
            </div>
          </div>
          {!sessionStats.isDone && sessionStats.hasPlan && (
            <button
              onClick={() => onStartSession ? onStartSession(todayRoutineItems) : onNavigateTab?.('routine')}
              style={{
                marginTop: '10px',
                height: '36px',
                width: '100%',
                borderRadius: '8px',
                background: '#6949E8',
                color: '#FFF',
                fontWeight: 600,
                fontSize: '13px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <AppIcon name="play" size={14} weight="fill" />
              Bắt đầu tập hôm nay
            </button>
          )}
        </div>

        {/* 2. Grid 2 cột: Cân nặng + Năng lượng */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
          {/* Cân nặng */}
          <div className="body-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ font: "400 12px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-muted)" }}>Cân nặng</span>
            <span style={{ font: "600 22px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-main)" }}>
              {weightData.currentStr}<span style={{ font: "400 12px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-muted)" }}> kg</span>
            </span>
            {weightData.hasData && weightData.spark ? (
              <svg viewBox="0 0 300 80" preserveAspectRatio="none" style={{ width: '100%', height: '38px', display: 'block' }}>
                <path d={weightData.spark.line} fill="none" stroke="#6949E8" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </svg>
            ) : (
              <div style={{ height: '38px', display: 'flex', alignItems: 'center', fontSize: '11px', color: 'var(--body-text-muted)' }}>
                Chưa có số đo
              </div>
            )}
            <span style={{ font: "600 11.5px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-green)" }}>
              {weightData.diffText || '—'}
            </span>
          </div>

          {/* Năng lượng */}
          <div className="body-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ font: "400 12px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-muted)" }}>Năng lượng</span>
            <span style={{ font: "600 22px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-main)" }}>
              {nutritionData.totalKcal.toLocaleString('vi-VN')}<span style={{ font: "400 12px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-muted)" }}> kcal</span>
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              {nutritionData.macros.map(m => (
                <span key={m.n} style={{ height: '5px', borderRadius: '3px', background: '#F0EEE9', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: m.p, background: m.c, borderRadius: '3px' }} />
                </span>
              ))}
            </div>
            <span style={{ font: "400 11.5px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-muted)" }}>
              {nutritionData.goalKcal > nutritionData.totalKcal
                ? `còn ${nutritionData.goalKcal - nutritionData.totalKcal} kcal`
                : `vượt ${nutritionData.totalKcal - nutritionData.goalKcal} kcal`}
            </span>
          </div>
        </div>

        {/* 3. Phục hồi cơ */}
        <div className="body-card" style={{ padding: 0, display: 'grid', gridTemplateColumns: '132px minmax(0, 1fr)', overflow: 'hidden', height: '220px' }}>
          <div className="body-2a-muscle-canvas-box">
            <MuscleBodyCanvas recovery={recoveryData.map} view="front" mode="rec" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          </div>
          <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
            <span style={{ font: "600 13.5px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-main)" }}>Phục hồi cơ</span>
            {recoveryData.recGroups.map(g => (
              <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', font: "600 11.5px/1 'Be Vietnam Pro',sans-serif", color: g.c }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '4px', background: g.c }} />
                  {g.n} ({g.items.length})
                </span>
                <span style={{ font: "400 12px/1.35 'Be Vietnam Pro',sans-serif", color: "var(--body-text-sub)" }}>
                  {g.items.length === 0 ? '—' : g.joined}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Tuần này */}
        <div className="body-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ font: "600 13.5px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-main)" }}>Tuần này</span>
            <span style={{ font: "400 11.5px/1 'Be Vietnam Pro',sans-serif", color: "var(--body-text-muted)" }}>
              {weekData.stats[0].v}{weekData.stats[0].u} buổi · {weekData.stats[1].v} set
            </span>
          </div>
          <div style={{ height: '96px', display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '6px', alignItems: 'end' }}>
            {weekData.columns.map((c, i) => (
              <div key={i} style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '100%', height: c.h, minHeight: '4px', borderRadius: '5px', background: c.bg, border: c.bd, boxSizing: 'border-box' }} />
                <span style={{ font: c.font, color: c.fg }}>{c.d}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Check-in tuần */}
        <div className="body-2a-checkin-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AppIcon name="clipboard" size={22} style={{ color: "#5238C9", flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ font: "600 13px/1.2 'Be Vietnam Pro',sans-serif", color: "#2D2270" }}>
              Check-in tuần · {checkinTomorrowData.checkinDate}
            </span>
            <span style={{ font: "400 12px/1.3 'Be Vietnam Pro',sans-serif", color: "#4A3AA8" }}>
              {checkinTomorrowData.daysLeft === 0
                ? 'Hôm nay check-in: cân sáng và vòng eo'
                : `Còn ${checkinTomorrowData.daysLeft} ngày · cần cân sáng và vòng eo`}
            </span>
          </div>
          <AppIcon name="caretRight" size={14} style={{ color: "#5238C9", flexShrink: 0 }} />
        </div>

      </div>

      {/* ── MODAL GHI NHANH HOẠT ĐỘNG (CÂN NẶNG / BỮA ĂN / NƯỚC UỐNG) ── */}
      {quickModal && (
        <div className="body-modal-backdrop" onClick={() => setQuickModal(false)}>
          <div className="body-modal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', width: '100%' }}>
            
            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>⚡</span>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                  Ghi nhanh hoạt động
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setQuickModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--body-text-muted)', display: 'grid', placeItems: 'center', padding: '4px' }}
              >
                <AppIcon name="x" size={18} />
              </button>
            </div>

            {/* 3 Tab chuyển đổi mục đích rõ ràng */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '6px',
              padding: '4px',
              borderRadius: '10px',
              background: 'var(--body-shell-bg)',
              marginBottom: '18px'
            }}>
              {[
                { key: 'weight', label: 'Cân nặng', icon: '⚖️' },
                { key: 'meal', label: 'Bữa ăn', icon: '🥗' },
                { key: 'water', label: 'Nước uống', icon: '💧' }
              ].map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setQuickTab(t.key)}
                  style={{
                    height: '34px',
                    borderRadius: '8px',
                    border: 'none',
                    background: quickTab === t.key ? 'var(--body-card-bg)' : 'transparent',
                    color: quickTab === t.key ? 'var(--body-text-main)' : 'var(--body-text-muted)',
                    fontWeight: quickTab === t.key ? 700 : 500,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    boxShadow: quickTab === t.key ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* FORM 1: CÂN NẶNG */}
            {quickTab === 'weight' && (
              <form onSubmit={handleSaveQuick} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>
                    Cân nặng hôm nay (kg) *
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    required
                    autoFocus
                    className="body-input"
                    placeholder="Ví dụ: 65.05"
                    value={weightInput}
                    onChange={e => setWeightInput(e.target.value)}
                  />
                  {latestWeight?.weight && (
                    <span style={{ fontSize: '11px', color: 'var(--body-text-muted)' }}>
                      Số đo gần nhất: {latestWeight.weight} kg ({latestWeight.local_date})
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>
                    Thời điểm đo
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setWeightTimeSlot('morning')}
                      style={{
                        height: '38px',
                        borderRadius: '8px',
                        border: `1.5px solid ${weightTimeSlot === 'morning' ? 'var(--body-accent)' : 'var(--body-card-border)'}`,
                        background: weightTimeSlot === 'morning' ? 'var(--body-accent-soft)' : 'var(--body-card-bg)',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        color: 'var(--body-text-main)',
                        cursor: 'pointer'
                      }}
                    >
                      🌅 Sáng sớm (đói)
                    </button>
                    <button
                      type="button"
                      onClick={() => setWeightTimeSlot('evening')}
                      style={{
                        height: '38px',
                        borderRadius: '8px',
                        border: `1.5px solid ${weightTimeSlot === 'evening' ? 'var(--body-accent)' : 'var(--body-card-border)'}`,
                        background: weightTimeSlot === 'evening' ? 'var(--body-accent-soft)' : 'var(--body-card-bg)',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        color: 'var(--body-text-main)',
                        cursor: 'pointer'
                      }}
                    >
                      🌙 Buổi tối (sau ăn)
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    className="body-btn body-btn-secondary"
                    onClick={() => setQuickModal(false)}
                    style={{ flex: 1, height: '42px' }}
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={quickLoading}
                    className="body-btn body-btn-primary"
                    style={{ flex: 1, height: '42px' }}
                  >
                    {quickLoading ? 'Đang lưu...' : 'Lưu cân nặng'}
                  </button>
                </div>
              </form>
            )}

            {/* FORM 2: BỮA ĂN */}
            {quickTab === 'meal' && (
              <form onSubmit={handleSaveQuick} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>
                    Tên món / Bữa ăn *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    className="body-input"
                    placeholder="Ví dụ: Phở bò tái, Cơm tấm, Salad gà..."
                    value={mealNameInput}
                    onChange={e => setMealNameInput(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>
                    Bữa ăn
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                    {[
                      { key: 'breakfast', label: 'Sáng' },
                      { key: 'lunch', label: 'Trưa' },
                      { key: 'dinner', label: 'Tối' },
                      { key: 'snack', label: 'Phụ' }
                    ].map(m => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setMealTypeInput(m.key)}
                        style={{
                          height: '34px',
                          borderRadius: '8px',
                          border: `1.5px solid ${mealTypeInput === m.key ? 'var(--body-accent)' : 'var(--body-card-border)'}`,
                          background: mealTypeInput === m.key ? 'var(--body-accent-soft)' : 'var(--body-card-bg)',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--body-text-main)',
                          cursor: 'pointer'
                        }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>
                    Calo ước tính (kcal)
                  </label>
                  <input
                    type="number"
                    step="10"
                    className="body-input"
                    placeholder="Ví dụ: 450"
                    value={kcalInput}
                    onChange={e => setKcalInput(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    className="body-btn body-btn-secondary"
                    onClick={() => setQuickModal(false)}
                    style={{ flex: 1, height: '42px' }}
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={quickLoading}
                    className="body-btn body-btn-primary"
                    style={{ flex: 1, height: '42px' }}
                  >
                    {quickLoading ? 'Đang lưu...' : 'Lưu bữa ăn'}
                  </button>
                </div>
              </form>
            )}

            {/* FORM 3: NƯỚC UỐNG */}
            {quickTab === 'water' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center' }}>
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(76, 141, 224, 0.08)',
                  border: '1px solid rgba(76, 141, 224, 0.2)',
                  width: '100%',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ fontSize: '28px', marginBottom: '4px' }}>💧</div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                    {((waterCups || 0) * 0.25).toFixed(2)} L
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--body-text-muted)', marginTop: '2px' }}>
                    Đã uống {waterCups || 0} cốc · Mục tiêu khuyến nghị 2.0 L
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', width: '100%' }}>
                  <button
                    type="button"
                    onClick={() => handleQuickWaterAdd(1)}
                    style={{
                      height: '42px',
                      borderRadius: '8px',
                      border: '1px solid var(--body-card-border)',
                      background: 'var(--body-card-bg)',
                      fontWeight: 600,
                      fontSize: '12.5px',
                      color: 'var(--body-text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    +250 ml (1 cốc)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickWaterAdd(2)}
                    style={{
                      height: '42px',
                      borderRadius: '8px',
                      border: '1px solid var(--body-card-border)',
                      background: 'var(--body-card-bg)',
                      fontWeight: 600,
                      fontSize: '12.5px',
                      color: 'var(--body-text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    +500 ml (2 cốc)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickWaterAdd(3)}
                    style={{
                      height: '42px',
                      borderRadius: '8px',
                      border: '1px solid var(--body-card-border)',
                      background: 'var(--body-card-bg)',
                      fontWeight: 600,
                      fontSize: '12.5px',
                      color: 'var(--body-text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    +750 ml (1 bình)
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '4px' }}>
                  <button
                    type="button"
                    disabled={!waterCups || waterCups <= 0}
                    onClick={() => handleQuickWaterAdd(-1)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--body-card-border)',
                      background: 'transparent',
                      color: 'var(--body-text-muted)',
                      fontSize: '11.5px',
                      cursor: waterCups > 0 ? 'pointer' : 'not-allowed',
                      opacity: waterCups > 0 ? 1 : 0.5
                    }}
                  >
                    −250 ml (Trừ bớt)
                  </button>

                  <button
                    type="button"
                    className="body-btn body-btn-secondary"
                    onClick={() => setQuickModal(false)}
                    style={{ height: '36px', padding: '0 16px' }}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
