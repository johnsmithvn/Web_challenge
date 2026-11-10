import { useState, useMemo, useEffect, useCallback } from 'react';
import AppIcon from '../AppIcon';
import MuscleAnatomy2D from './MuscleAnatomy2D';
import SkeletonList from '../SkeletonList';
import { useToast } from '../../contexts/ToastContext';
import { useBiometrics } from '../../hooks/useBiometrics';
import { useNutrition } from '../../hooks/useNutrition';
import { useWorkouts } from '../../hooks/useWorkouts';
import {
  calculateRecoveryMetrics,
  getRoutineWeek,
  estimateQueueMinutes,
  generateWorkoutQueue,
  muscleFigureFills,
  getTodayTrainingState,
  buildWeekConstellation,
  splitDayName,
  splitExerciseName,
  dayColorOf
} from '../../utils/workoutLogic';
import { calculateMacroTargets } from '../../utils/bodyMetrics';
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

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
// Màu sao theo trạng thái; ngày "planned" lấy màu buổi (dayColorOf)
const STAR_C = { done: 'var(--body-amber)', today: 'var(--body-accent)', rest: 'var(--body-text-muted)' };
// Vòng "Quỹ đạo hôm nay": kcal / đạm / tinh bột (chất béo chỉ có dòng)
const ORBIT_R = [80, 62, 44];
const ringDash = (r, ratio) => `${(2 * Math.PI * r * ratio).toFixed(1)} ${(2 * Math.PI * r).toFixed(1)}`;
// Buổi đã lưu: title = "Buổi {tên ngày}", day_type = tên ngày
const sessionDayName = s => s?.day_type || String(s?.title || '').replace(/^Buổi\s+/, '');

const QUICK_TABS = [
  { key: 'weight', label: 'Cân nặng', icon: 'scales' },
  { key: 'meal', label: 'Bữa ăn', icon: 'bowlFood' }
];
const WEIGHT_SLOTS = [
  { key: 'morning', label: 'Sáng sớm (đói)', icon: 'sunHorizon' },
  { key: 'evening', label: 'Buổi tối (sau ăn)', icon: 'moon' }
];
const MEAL_TYPES = [
  { key: 'breakfast', label: 'Sáng' },
  { key: 'lunch', label: 'Trưa' },
  { key: 'dinner', label: 'Tối' },
  { key: 'snack', label: 'Phụ' }
];

export default function OverviewScreen({ onNavigateTab, onStartSession }) {
  const { showToast } = useToast();
  const { latest: latestWeight, addMeasurement, measurements, profile, tdee, hasLoaded: bioLoaded } = useBiometrics();
  const { mealLogs, addMealLog, hasLoaded: nutLoaded } = useNutrition();
  const { activeRoutine, routineItems, sessions, recentSets, exerciseMap, hasLoaded: workoutsLoaded } = useWorkouts();

  const [quickModal, setQuickModal] = useState(false);
  const [quickTab, setQuickTab] = useState('weight'); // 'weight' | 'meal'
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
  const todayDateStr = useMemo(() => toDateStr(today), [today]);

  // Buổi dở / đã xong / có lịch / nghỉ — cùng nguồn với nút "hôm nay" trên header
  const todayState = useMemo(
    () => getTodayTrainingState({ sessions, routineItems, today }),
    [sessions, routineItems, today]
  );
  const todayWeekday = todayState.weekday; // 1 = T2 ... 7 = CN

  // Các bài tập theo lịch hôm nay
  const todayRoutineItems = useMemo(() => {
    return (routineItems || []).filter(item => item.weekday === todayWeekday);
  }, [routineItems, todayWeekday]);

  // Cùng dạng dayInfo với nút "Bắt đầu buổi" của Lộ trình — màn tập lọc bài theo weekday, không nhận mảng bài
  const todayStartPayload = {
    weekday: todayWeekday,
    day: todayWeekday,
    name: todayRoutineItems[0]?.day_name || 'Buổi tập hôm nay'
  };

  // Thống kê thật của 1 buổi từ các set đã ghi (bảng sessions không lưu sẵn số set / khối lượng)
  const statsOfSession = useCallback((sessionId) => {
    const sets = (recentSets || []).filter(s => s.session_id === sessionId && s.actual_val != null);
    return {
      setsCount: sets.length,
      exercisesCount: new Set(sets.map(s => s.exercise_key)).size,
      volumeKg: Math.round(sets.reduce((acc, s) => acc + (s.unit !== 's' ? Number(s.actual_val) * Number(s.kg || 0) : 0), 0))
    };
  }, [recentSets]);

  // ── HERO: BUỔI TẬP HÔM NAY ───────────────────────────────────
  const sessionStats = useMemo(() => {
    const week = activeRoutine ? getRoutineWeek(activeRoutine.start_date, activeRoutine.weeks, today) : null;
    const weekPrefix = week ? `Tuần ${week.current} / ${week.total}` : '';
    const estMinutes = todayRoutineItems.length ? estimateQueueMinutes(generateWorkoutQueue(todayRoutineItems, 'straight')) : 0;
    const { state, session } = todayState;

    if (state === 'resume') {
      return {
        state,
        estMinutes,
        ...statsOfSession(session.id),
        durationMin: Math.round((session.duration_seconds || 0) / 60),
        title: session.day_type || session.title || 'Buổi tập đang diễn ra',
        weekText: weekPrefix ? `${weekPrefix} · Đang thực hiện` : 'Buổi tập dở dang',
        finishTime: null
      };
    }

    if (state === 'done') {
      return {
        state,
        estMinutes,
        ...statsOfSession(session.id),
        durationMin: Math.round((session.duration_seconds || 0) / 60),
        title: session.title || 'Buổi tập hôm nay',
        weekText: session.routine_id && activeRoutine && weekPrefix
          ? `${weekPrefix} · ${activeRoutine.name}`
          : 'Buổi tập tự do',
        finishTime: session.ended_at
          ? new Date(session.ended_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          : 'Hoàn thành'
      };
    }

    if (state === 'start') {
      return {
        state,
        estMinutes,
        durationMin: 0,
        exercisesCount: todayRoutineItems.length,
        setsCount: todayRoutineItems.reduce((acc, it) => acc + (Number(it.target_sets) || 0), 0),
        volumeKg: 0,
        title: todayState.dayName,
        weekText: weekPrefix ? `${weekPrefix} · ${activeRoutine.name}` : 'Kế hoạch tập luyện',
        finishTime: null
      };
    }

    return {
      state,
      estMinutes: 0,
      durationMin: 0,
      exercisesCount: 0,
      setsCount: 0,
      volumeKg: 0,
      title: 'Hôm nay không có lịch tập',
      weekText: activeRoutine ? `Lộ trình: ${activeRoutine.name} · Nghỉ ngơi phục hồi` : 'Chưa chọn lộ trình nào',
      finishTime: null
    };
  }, [todayState, todayRoutineItems, statsOfSession, activeRoutine, today]);

  // ── CÂN NẶNG & SPARKLINE THẬT ────────────────────────────────
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
    const targetWeight = profile?.goal_weight_kg ? Number(profile.goal_weight_kg) : null;
    // Mốc bắt đầu = lần cân hợp lệ cũ nhất (bảng hồ sơ không lưu cân nặng ban đầu)
    const validMeasurements = (measurements || []).filter(m => !m.is_outlier);
    const startWeight = validMeasurements.length > 0
      ? Number(validMeasurements[validMeasurements.length - 1].weight)
      : currentWeight;

    let diffText = 'Lần đo đầu tiên';
    if (measurements && measurements.length >= 2) {
      const prevWeight = Number(measurements[1].weight);
      const diff = currentWeight - prevWeight;
      const diffSign = diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
      diffText = `${diffSign.replace('.', ',')} kg`;
    }

    // Sparkline từ các lần đo thật (khung 300×80, co giãn theo thẻ); endY = % chiều cao của điểm cuối
    const recentM = (measurements || []).slice(0, 20).reverse();
    let spark = { line: 'M0 40 L300 40', goal: null, endY: 50 };
    if (recentM.length >= 2) {
      const weights = recentM.map(m => Number(m.weight));
      const minW = Math.min(...weights) - 0.5;
      const maxW = Math.max(...weights) + 0.5;
      const range = maxW - minW || 1;
      const n = weights.length;

      const X = i => (i / (n - 1)) * 300;
      const Y = v => Math.max(5, Math.min(75, (1 - (v - minW) / range) * 80));

      spark = {
        line: weights.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' '),
        goal: targetWeight ? `M0 ${Y(targetWeight).toFixed(1)} L300 ${Y(targetWeight).toFixed(1)}` : null,
        endY: (Y(weights[n - 1]) / 80) * 100
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

  // ── QUỸ ĐẠO HÔM NAY: KCAL + MACRO THẬT ───────────────────────
  const nutritionData = useMemo(() => {
    const sumOf = key => (mealLogs || []).reduce((sum, m) => sum + (Number(m[key]) || 0), 0);
    const totalKcal = sumOf('calories');
    // Cùng công thức với màn Dinh dưỡng; chưa có TDEE (thiếu hồ sơ) thì không bịa mục tiêu
    const targets = calculateMacroTargets(tdee, latestWeight?.weight);
    const goalKcal = targets?.kcal ?? null;
    const totalProt = sumOf('protein');

    const rows = [
      { key: 'kcal', n: 'Năng lượng', total: totalKcal, goal: goalKcal, unit: 'kcal', c: 'var(--body-accent)' },
      { key: 'protein', n: 'Đạm', total: totalProt, goal: targets?.protein ?? null, unit: 'g', c: 'var(--body-pink)' },
      { key: 'carbs', n: 'Tinh bột', total: sumOf('carbs'), goal: targets?.carbs ?? null, unit: 'g', c: 'var(--body-blue)' },
      { key: 'fat', n: 'Chất béo', total: sumOf('fat'), goal: targets?.fat ?? null, unit: 'g', c: 'var(--body-amber)' }
    ].map(r => ({ ...r, ratio: r.goal ? Math.min(1, r.total / r.goal) : 0 }));

    const mealsCount = (mealLogs || []).length;
    let note = mealsCount > 0 ? '' : 'Chưa ghi bữa ăn nào hôm nay.';
    if (!goalKcal) {
      note = `${note} Nhập chiều cao, giới tính, năm sinh ở tab Cơ thể để có mục tiêu calo.`.trim();
    } else if (mealsCount > 0) {
      const remainKcal = goalKcal - totalKcal;
      const remainProt = Math.max(0, targets.protein - Math.round(totalProt));
      note = remainKcal >= 0
        ? `Còn ${remainKcal} kcal và ${remainProt} g đạm cho hôm nay.`
        : `Vượt mục tiêu ${Math.abs(remainKcal)} kcal hôm nay.`;
    }
    // Bản ngắn cho thẻ nửa bề ngang trên mobile
    const shortNote = !goalKcal
      ? 'chưa có mục tiêu calo'
      : goalKcal > totalKcal
        ? `còn ${goalKcal - totalKcal} kcal`
        : `vượt ${totalKcal - goalKcal} kcal`;

    return { totalKcal, rows, mealsCount, note, shortNote };
  }, [mealLogs, tdee, latestWeight]);

  // ── PHỤC HỒI CƠ (BẢN ĐỒ CƠ THẬT) ─────────────────────────────
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

    // Màu nhóm: class is-low (red) / is-mid (amber) / is-ready (green) trong body.css
    const recGroups = [
      { id: 'low', n: 'Cần nghỉ', items: [], joined: '' },
      { id: 'mid', n: 'Đang hồi', items: [], joined: '' },
      { id: 'ready', n: 'Sẵn sàng', items: [], joined: '' }
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

  const recoveryFigure = useMemo(() => muscleFigureFills({ mode: 'rec', recoveryMap: recoveryData.map }), [recoveryData.map]);

  // ── CHÒM SAO TUẦN NÀY ────────────────────────────────────────
  const weekData = useMemo(() => {
    const weekDates = getWeekDates(today);
    const dayMonth = str => `${Number(str.slice(8, 10))}/${Number(str.slice(5, 7))}`;
    const dateRange = `${dayMonth(weekDates[0])} – ${dayMonth(weekDates[6])}`;

    const weekCompletedSessions = (sessions || []).filter(
      s => s.status === 'completed' && weekDates.includes(s.local_date)
    );

    const weekSets = weekCompletedSessions.reduce((acc, s) => acc + statsOfSession(s.id).setsCount, 0);
    const weekDurationSec = weekCompletedSessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
    const weekDurationMin = Math.round(weekDurationSec / 60);

    const timeText = weekDurationMin >= 60
      ? `${Math.floor(weekDurationMin / 60)}g ${weekDurationMin % 60}`
      : `${weekDurationMin}`;
    const timeUnit = weekDurationMin >= 60 ? 'p' : ' phút';

    const plannedWeekdays = new Set((routineItems || []).map(it => it.weekday));
    const targetSessions = plannedWeekdays.size;

    // Mỗi ngày một sao: đã tập > hôm nay > có lịch (kể cả đã lỡ) > nghỉ
    const constellation = buildWeekConstellation(weekDates.map((dateStr, idx) => {
      const daySessions = weekCompletedSessions.filter(s => s.local_date === dateStr);
      const plannedName = (routineItems || []).find(it => it.weekday === idx + 1)?.day_name || '';
      const isDone = daySessions.length > 0;
      const status = isDone ? 'done' : dateStr === todayDateStr ? 'today' : plannedName ? 'planned' : 'rest';
      const name = isDone ? sessionDayName(daySessions[0]) : plannedName;
      return {
        label: DAY_LABELS[idx],
        dateNum: String(Number(dateStr.slice(8, 10))),
        title: name ? splitDayName(name).title : 'Nghỉ',
        status,
        sets: daySessions.reduce((acc, s) => acc + statsOfSession(s.id).setsCount, 0),
        color: STAR_C[status] || dayColorOf(name)
      };
    }));

    return {
      dateRange,
      targetSessions,
      stats: [
        { n: 'Buổi', v: `${weekCompletedSessions.length}`, u: targetSessions ? ` / ${targetSessions}` : '' },
        { n: 'Set', v: `${weekSets}`, u: '' },
        { n: 'Thời gian', v: timeText, u: timeUnit }
      ],
      constellation
    };
  }, [today, todayDateStr, sessions, routineItems, statsOfSession]);

  // ── CHECK-IN TUẦN & NGÀY MAI THẬT ────────────────────────────
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
        const name = exerciseMap?.get(it.exercise_key)?.name || it.exercise_key;
        const unitLabel = it.unit === 's' ? 's' : '';
        const target = `${it.target_sets} × ${it.target_val}${unitLabel}${Number(it.kg) > 0 ? ` · ${it.kg} kg` : ''}`;
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


  if (!bioLoaded || !nutLoaded || !workoutsLoaded) {
    return <SkeletonList heading rows={4} gap="10px" label="Đang tải tổng quan" />;
  }

  const { state } = sessionStats;
  const heroTag = state === 'start' ? splitDayName(sessionStats.title) : null;
  const statusPill = {
    resume: { cls: 'is-amber', text: 'Đang tập dở' },
    done: { cls: 'is-green', icon: 'checkCircle', text: `Xong ${sessionStats.finishTime}` },
    start: { cls: 'is-accent', icon: 'calendar', text: heroTag?.tag ? `${heroTag.tag.toUpperCase()} · HÔM NAY` : 'Lên lịch hôm nay' },
    rest: { cls: '', icon: 'moon', text: 'Nghỉ ngơi' }
  }[state];
  const heroAction = {
    resume: { label: 'Tiếp tục buổi tập', icon: 'play', go: () => onNavigateTab?.('session') },
    done: { label: 'Xem buổi tập', icon: 'trophy', go: () => onNavigateTab?.('history') },
    start: { label: 'Bắt đầu tập hôm nay', icon: 'rocketLaunch', go: () => (onStartSession ? onStartSession(todayStartPayload) : onNavigateTab?.('routine')) },
    rest: { label: 'Xem lộ trình tập', icon: 'path', go: () => onNavigateTab?.('routine') }
  }[state];
  // Desktop tối đa 4 ô (ô thứ 4 thành "+n bài nữa" khi dư); mobile tối đa 3 ô (CSS ẩn ô 4 + hiện ô "+1")
  const exTiles = todayRoutineItems.length > 4 ? todayRoutineItems.slice(0, 3) : todayRoutineItems;
  const exMore = todayRoutineItems.length - exTiles.length;
  const { stars, links, doneCount } = weekData.constellation;
  const lowGroup = recoveryData.recGroups[0];
  const openBiometrics = () => onNavigateTab?.('biometrics');

  return (
    <div className="body-ov">

      {/* ── CỘT TRÁI: HERO + CHÒM SAO ── */}
      <div className="body-ov-col">
        <section className="body-hero body-ov-hero" aria-label="Buổi tập hôm nay">
          <div className="body-ov-planet body-deco-floaty" aria-hidden="true">
            <i className="body-ov-ring is-back" />
            <i className="body-ov-planet-core" />
            <i className="body-ov-ring is-front" />
            <span className="body-ov-sat body-deco-orbit"><i /></span>
          </div>

          <div className="body-ov-hero-pills">
            <span className={`body-pill ${statusPill.cls}`}>
              {statusPill.icon ? <AppIcon name={statusPill.icon} size={13} weight="fill" /> : <i />}
              {statusPill.text}
            </span>
            {state !== 'rest' && (
              <span className="body-pill">
                <AppIcon name="clock" size={13} />
                {state === 'start' ? `~${sessionStats.estMinutes} phút` : `${sessionStats.durationMin} phút`}
                {` · ${sessionStats.exercisesCount} bài · ${sessionStats.setsCount} set`}
              </span>
            )}
            {state === 'done' && (
              <span className="body-pill">
                <AppIcon name="barbell" size={13} />
                Khối lượng {sessionStats.volumeKg.toLocaleString('vi-VN')} kg
              </span>
            )}
          </div>

          <div className="body-ov-hero-head">
            <h2 className="body-ov-hero-title">{heroTag?.tag ? heroTag.title : sessionStats.title}</h2>
            <p className="body-ov-hero-sub">{sessionStats.weekText}</p>
          </div>

          {exTiles.length > 0 && (
            <ul className="body-ov-ex">
              {exTiles.map((it, i) => {
                const { vn, en } = splitExerciseName(exerciseMap?.get(it.exercise_key)?.name || it.exercise_key);
                return (
                  <li key={it.id ?? `${it.exercise_key}-${i}`} className="body-tile body-ov-ex-tile">
                    <span className="body-ov-ex-no">{String(i + 1).padStart(2, '0')}</span>
                    <span className="body-ov-ex-name">
                      <b>{vn}</b>
                      {en && <small>{en}</small>}
                    </span>
                    <span className="body-ov-ex-rx">
                      {it.target_sets} × {it.target_val} {it.unit === 's' ? 'giây' : 'rep'}
                    </span>
                  </li>
                );
              })}
              {exMore > 0 && <li className="body-tile body-ov-ex-tile is-more">+{exMore} bài nữa</li>}
              {todayRoutineItems.length === 4 && <li className="body-tile body-ov-ex-tile is-more is-mobile-more">+1 bài nữa</li>}
            </ul>
          )}

          <div className="body-ov-hero-actions">
            <button type="button" className="body-btn body-btn-primary body-btn-lg" onClick={heroAction.go}>
              <AppIcon name={heroAction.icon} size={17} weight="fill" />
              {heroAction.label}
            </button>
            {state !== 'rest' && (
              <button type="button" className="body-btn body-btn-secondary body-btn-lg" onClick={() => onNavigateTab?.('routine')}>
                <AppIcon name="path" size={17} />
                Xem lộ trình tuần
              </button>
            )}
          </div>
        </section>

        <section className="body-card body-ov-const" aria-label="Chòm sao tuần này">
          <div className="body-card-head">
            <div>
              <h3 className="body-card-title">Chòm sao tuần này</h3>
              <span className="body-card-sub">{weekData.dateRange} · mỗi buổi tập thắp một ngôi sao</span>
            </div>
            <span className="body-ov-const-count">
              {weekData.targetSessions ? `${doneCount} / ${weekData.targetSessions} SAO` : `${doneCount} SAO`}
            </span>
          </div>

          <div className="body-ov-stats">
            {weekData.stats.map(s => (
              <div key={s.n}>
                <b>{s.v}<small>{s.u}</small></b>
                <span>{s.n}</span>
              </div>
            ))}
          </div>

          <div className="body-ov-const-stage">
            <svg viewBox="0 0 834 190" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
              {links.map((l, i) => (
                <line
                  key={i}
                  className={`body-ov-link${l.lit ? ' is-lit' : ''}`}
                  x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                  strokeWidth={l.w}
                  strokeDasharray={l.dash || undefined}
                  opacity={l.op}
                />
              ))}
              {stars.map(s => (
                <g key={s.label} className={`body-ov-star is-${s.kind}`} style={{ '--star-c': s.color }}>
                  {s.halo > 0 && (
                    <circle
                      className={`body-ov-star-halo${s.pulse ? ' body-deco-pulse' : ''}`}
                      cx={s.x} cy={s.y} r={s.halo}
                      opacity={s.hop}
                    />
                  )}
                  <circle className="body-ov-star-core" cx={s.x} cy={s.y} r={s.r} />
                </g>
              ))}
            </svg>
            {stars.map(s => (
              <div
                key={s.label}
                className={`body-ov-const-lb is-${s.kind}`}
                style={{ left: `${(s.x / 834) * 100}%`, top: `${(s.ly / 190) * 100}%` }}
              >
                <span className="lb-day">{s.label}<span className="lb-date"> · {s.dateNum}</span></span>
                <span className="lb-title">{s.title}</span>
                {s.kind === 'done' && <span className="lb-sets">{s.sets} set</span>}
              </div>
            ))}
          </div>

          <div className="body-ov-legend">
            <span><i className="is-done" />Đã tập</span>
            <span><i className="is-today" />Hôm nay</span>
            <span><i className="is-next" />Sắp tới</span>
          </div>
        </section>
      </div>

      {/* ── CỘT PHẢI ── */}
      <div className="body-ov-col">
        <section className="body-card body-ov-orbit" aria-label="Quỹ đạo hôm nay">
          <div className="body-card-head">
            <h3 className="body-card-title">
              <span className="is-desk">Quỹ đạo hôm nay</span>
              <span className="is-mob">Năng lượng</span>
            </h3>
            <button type="button" className="body-card-link" onClick={() => onNavigateTab?.('nutrition')}>Dinh dưỡng</button>
          </div>

          <div className="body-ov-orbit-body">
            <div className="body-ov-orbit-ring" aria-hidden="true">
              <svg className="body-ov-orbit-svg" viewBox="0 0 176 176">
                {ORBIT_R.map((r, i) => {
                  const row = nutritionData.rows[i];
                  return (
                    <g key={row.key} className={`is-${row.key}`}>
                      <circle className="is-track" cx="88" cy="88" r={r} />
                      {row.ratio > 0 && (
                        <circle className="is-arc" cx="88" cy="88" r={r} style={{ '--ring-c': row.c }} strokeDasharray={ringDash(r, row.ratio)} />
                      )}
                    </g>
                  );
                })}
              </svg>
              <span className="body-ov-orbit-core"><AppIcon name="sparkle" size={20} weight="fill" /></span>
              <span className="body-ov-orbit-kcal">
                <b>{nutritionData.totalKcal.toLocaleString('vi-VN')}</b>
                <small>kcal</small>
              </span>
            </div>

            <ul className="body-ov-orbit-list">
              {nutritionData.rows.map(r => (
                <li key={r.key} className={`is-${r.key}`} style={{ '--ring-c': r.c }}>
                  <span className="lb"><i />{r.n}</span>
                  <span>
                    <b>{r.key === 'kcal' ? r.total.toLocaleString('vi-VN') : Math.round(r.total)}</b>
                    <small>{r.goal ? `/ ${r.goal.toLocaleString('vi-VN')} ${r.unit}` : r.unit}</small>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="body-ov-orbit-note">
            <span className="is-desk">{nutritionData.note}</span>
            <span className="is-mob">{nutritionData.shortNote}</span>
            <span className="body-ov-orbit-meals">{nutritionData.mealsCount} bữa đã ghi</span>
          </p>
        </section>

        <div className="body-ov-pair">
          <div
            className={`body-card body-ov-weight${weightData.hasData ? ' body-card-press' : ''}`}
            {...(weightData.hasData && {
              role: 'button',
              tabIndex: 0,
              title: 'Mở trang Cơ thể',
              onClick: openBiometrics,
              onKeyDown: e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openBiometrics();
                }
              }
            })}
          >
            <span className="body-ov-label">Cân nặng</span>
            <span className="body-ov-big">{weightData.currentStr}<span className="body-unit">kg</span></span>
            {weightData.hasData ? (
              <>
                <span className="body-ov-weight-diff">
                  {weightData.diffText}{weightData.time && ` · ${weightData.time}`}
                </span>
                <div className="body-ov-spark" aria-hidden="true">
                  <svg viewBox="0 0 300 80" preserveAspectRatio="none">
                    {weightData.spark.goal && (
                      <path className="is-goal" d={weightData.spark.goal} vectorEffect="non-scaling-stroke" />
                    )}
                    <path className="is-line" d={weightData.spark.line} vectorEffect="non-scaling-stroke" />
                  </svg>
                  <i style={{ top: `${weightData.spark.endY}%` }} />
                </div>
                <div className="body-ov-weight-goal">
                  <div className="body-bar"><i style={{ width: `${weightData.progressPercent}%` }} /></div>
                  <div className="body-ov-weight-goal-txt">
                    <span>{weightData.startStr}</span>
                    <span>{weightData.remainText}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="body-ov-weight-empty">
                <span>Ghi lần cân đầu tiên để bắt đầu vẽ biểu đồ tiến độ & tính BMI, TDEE</span>
                <button type="button" className="body-btn body-btn-secondary" onClick={() => setQuickModal(true)}>
                  + Ghi cân nặng ngay
                </button>
              </div>
            )}
          </div>

          <div className="body-card body-ov-checkin">
            <span className="body-ov-checkin-head"><AppIcon name="clipboard" size={16} />Check-in tuần</span>
            <span className="body-ov-big">{checkinTomorrowData.checkinDate}</span>
            <span className="body-ov-checkin-left">
              {checkinTomorrowData.daysLeft === 0 ? 'Hôm nay' : `Còn ${checkinTomorrowData.daysLeft} ngày`}
            </span>
            <span className="body-ov-checkin-prep">Cân sáng CN · Vòng eo · Ảnh (tùy chọn)</span>
          </div>
        </div>

        {/* Cả thẻ bấm được bằng chuột; bàn phím dùng nút "Bản đồ cơ" (click của nút nổi lên thẻ) */}
        <section className="body-card body-card-press body-ov-rec" aria-label="Phục hồi cơ" onClick={() => onNavigateTab?.('muscles')}>
          <div className="body-ov-rec-fig">
            <MuscleAnatomy2D side="both" height="var(--ov-fig-h)" {...recoveryFigure} />
          </div>
          <div className="body-ov-rec-main">
            <div className="body-card-head">
              <h3 className="body-card-title">Phục hồi cơ</h3>
              <button type="button" className="body-card-link">Bản đồ cơ</button>
            </div>
            <div className="body-ov-rec-counts">
              {recoveryData.recGroups.map(g => (
                <div key={g.id} className={`is-${g.id}`}>
                  <b>{g.items.length}</b>
                  <span>{g.n}</span>
                </div>
              ))}
            </div>
            <ul className="body-ov-rec-chips">
              {recoveryData.recGroups.flatMap(g => g.items.map(name => (
                <li key={name} className={`is-${g.id}`}><i />{name}</li>
              )))}
            </ul>
            {lowGroup.items.length > 0 && <p className="body-ov-rec-avoid">Tránh {lowGroup.joined} hôm nay.</p>}
          </div>
        </section>

        <section className="body-card body-ov-tomorrow" aria-label="Ngày mai">
          <div className="body-card-head">
            <h3 className="body-card-title">Ngày mai</h3>
            <span className="body-card-sub">{checkinTomorrowData.tomorrowDate}</span>
          </div>
          <span className="body-ov-tomorrow-title">{checkinTomorrowData.tomorrowTitle}</span>
          {checkinTomorrowData.tomorrowExercises.length === 0 ? (
            <p className="body-ov-empty">Không có bài tập nào được lên lịch cho ngày mai.</p>
          ) : (
            <ul className="body-ov-tomorrow-list">
              {checkinTomorrowData.tomorrowExercises.map((e, idx) => (
                <li key={idx}>
                  <span>{e.n}</span>
                  <span>{e.rx}</span>
                </li>
              ))}
            </ul>
          )}
          <span className="body-ov-tomorrow-note">{checkinTomorrowData.recoveryNote}</span>
        </section>
      </div>

      {/* ── MODAL GHI NHANH (CÂN NẶNG / BỮA ĂN) ── */}
      {quickModal && (
        <div className="body-modal-backdrop" onClick={() => setQuickModal(false)}>
          <div
            className="body-modal-panel body-ov-quick"
            role="dialog"
            aria-modal="true"
            aria-label="Ghi nhanh hoạt động"
            onClick={e => e.stopPropagation()}
          >
            <div className="body-ov-quick-head">
              <h3><AppIcon name="lightning" size={18} weight="fill" />Ghi nhanh hoạt động</h3>
              <button type="button" className="body-icon-btn" onClick={() => setQuickModal(false)} aria-label="Đóng">
                <AppIcon name="x" size={16} />
              </button>
            </div>

            <div className="body-ov-seg" role="tablist" aria-label="Loại ghi nhanh">
              {QUICK_TABS.map(t => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={quickTab === t.key}
                  className="body-chip"
                  onClick={() => setQuickTab(t.key)}
                >
                  <AppIcon name={t.icon} size={15} />
                  {t.label}
                </button>
              ))}
            </div>

            {/* FORM 1: CÂN NẶNG */}
            {quickTab === 'weight' && (
              <form onSubmit={handleSaveQuick} className="body-ov-quick-form">
                <label className="body-ov-field">
                  <span>Cân nặng hôm nay (kg) *</span>
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
                    <small>Số đo gần nhất: {latestWeight.weight} kg ({latestWeight.local_date})</small>
                  )}
                </label>

                <div className="body-ov-field">
                  <span>Thời điểm đo</span>
                  <div className="body-ov-seg">
                    {WEIGHT_SLOTS.map(s => (
                      <button
                        key={s.key}
                        type="button"
                        className="body-chip"
                        aria-pressed={weightTimeSlot === s.key}
                        onClick={() => setWeightTimeSlot(s.key)}
                      >
                        <AppIcon name={s.icon} size={15} />
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="body-ov-quick-actions">
                  <button type="button" className="body-btn body-btn-secondary" onClick={() => setQuickModal(false)}>
                    Đóng
                  </button>
                  <button type="submit" disabled={quickLoading} className="body-btn body-btn-primary">
                    {quickLoading ? 'Đang lưu...' : 'Lưu cân nặng'}
                  </button>
                </div>
              </form>
            )}

            {/* FORM 2: BỮA ĂN */}
            {quickTab === 'meal' && (
              <form onSubmit={handleSaveQuick} className="body-ov-quick-form">
                <label className="body-ov-field">
                  <span>Tên món / Bữa ăn *</span>
                  <input
                    type="text"
                    required
                    autoFocus
                    className="body-input"
                    placeholder="Ví dụ: Phở bò tái, Cơm tấm, Salad gà..."
                    value={mealNameInput}
                    onChange={e => setMealNameInput(e.target.value)}
                  />
                </label>

                <div className="body-ov-field">
                  <span>Bữa ăn</span>
                  <div className="body-ov-seg">
                    {MEAL_TYPES.map(m => (
                      <button
                        key={m.key}
                        type="button"
                        className="body-chip"
                        aria-pressed={mealTypeInput === m.key}
                        onClick={() => setMealTypeInput(m.key)}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="body-ov-field">
                  <span>Calo ước tính (kcal)</span>
                  <input
                    type="number"
                    step="10"
                    className="body-input"
                    placeholder="Ví dụ: 450"
                    value={kcalInput}
                    onChange={e => setKcalInput(e.target.value)}
                  />
                </label>

                <div className="body-ov-quick-actions">
                  <button type="button" className="body-btn body-btn-secondary" onClick={() => setQuickModal(false)}>
                    Đóng
                  </button>
                  <button type="submit" disabled={quickLoading} className="body-btn body-btn-primary">
                    {quickLoading ? 'Đang lưu...' : 'Lưu bữa ăn'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
