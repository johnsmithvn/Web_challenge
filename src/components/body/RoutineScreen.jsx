import { useState, useEffect, useMemo, useCallback } from 'react';
import AppIcon from '../AppIcon';
import BASE_EXERCISES from '../../data/body-exercises.json';
import ROUTINE_TEMPLATES from '../../data/body-routine-templates.json';
import MUSCLE_MAP from '../../data/body-muscles.json';
import {
  stepOfUnit,
  getRoutineWeek,
  calculateAdherence,
  getCycleRange,
  buildCycleSummary,
  formatValWithUnit,
  estimateQueueMinutes,
  getWeekDays,
  mapWeekSessions,
  splitExerciseName,
  splitDayName,
  DAY_TAG_COLORS
} from '../../utils/workoutLogic';
import { normVi } from '../../utils/kanbanUtils';
import { toDateStr } from '../../utils/dateUtils';
import { ConfirmModal } from '../ConfirmModal';

const BASE_WEEKDAY_DEFS = [
  { day: 1, label: 'T2', short: 'Thứ Hai', defaultName: 'Thân trên', defaultType: 'Đẩy' },
  { day: 2, label: 'T3', short: 'Thứ Ba', defaultName: 'Nghỉ', defaultType: null },
  { day: 3, label: 'T4', short: 'Thứ Tư', defaultName: 'Thân dưới & Bụng', defaultType: 'Chân' },
  { day: 4, label: 'T5', short: 'Thứ Năm', defaultName: 'Nghỉ', defaultType: null },
  { day: 5, label: 'T6', short: 'Thứ Sáu', defaultName: 'Toàn thân', defaultType: 'Toàn thân' },
  { day: 6, label: 'T7', short: 'Thứ Bảy', defaultName: 'Nghỉ', defaultType: null },
  { day: 7, label: 'CN', short: 'Chủ Nhật', defaultName: 'Check-in', defaultType: null }
];

// Bảng Thêm bài: gom theo cơ chính
const PICK_GROUP_OF = {
  chest: 'Ngực', shoulders: 'Vai', biceps: 'Tay', triceps: 'Tay', forearms: 'Tay',
  lats: 'Lưng', traps: 'Lưng', lowerback: 'Lưng', quads: 'Chân', hamstrings: 'Chân', calves: 'Chân',
  glutes: 'Mông', abs: 'Bụng', obliques: 'Bụng'
};
const PICK_GROUPS = ['Ngực', 'Vai', 'Tay', 'Lưng', 'Chân', 'Mông', 'Bụng'];
const PICK_EQS = [['all', 'Tất cả'], ['bw', 'Tay không'], ['db', 'Tạ đơn'], ['bar', 'Xà']];
const EQ_LABEL = { bw: 'Không dụng cụ', db: 'Tạ đơn', bar: 'Xà', gym: 'Máy tập' };

const baseExOf = key => BASE_EXERCISES.find(e => e.key === key);
const muscleOf = ex => MUSCLE_MAP[ex?.primary]?.name || ex?.primary || '';
const unitLabel = unit => (unit === 's' ? 'giây' : unit || 'rep');
const ddmm = dateStr => { const [, m, d] = dateStr.split('-'); return `${Number(d)}/${Number(m)}`; };
const mmss = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const minutesOf = items => estimateQueueMinutes(items.flatMap(it => Array.from({ length: Number(it.target_sets) || 0 }, () => it)));
const levelOf = t => t.level || (t.key.includes('calisthenics') ? 'Trung cấp' : 'Cơ bản');

export default function RoutineScreen({
  routine,
  exerciseMap,
  routineItems = [],
  routines = [],
  routineTemplates = ROUTINE_TEMPLATES,
  sessions = [],
  recentSets = [],
  activeSession,
  onResumeSession,
  onCreateCustomRoutine,
  onSwitchRoutine,
  onUpdateRoutineDetails,
  onDeleteRoutine,
  onStartSession,
  onUpdateTarget,
  onUpdateSets,
  onUpdateRest,
  onUpdateUnit,
  onReorderItems,
  onNavigate,
  onAddExercise,
  onDeleteExercise,
  onToggleAutoProgress,
  onLoadCycleSets,
  onRestartCycle
}) {
  // Thứ trong tuần đang xem (1: T2 -> 7: CN, tự động chọn theo thứ của ngày hôm nay)
  // Bài có sẵn + bài tự tạo (exerciseMap của useWorkouts); thiếu map thì dùng thư viện gốc
  const allExercises = useMemo(
    () => (exerciseMap?.size ? Array.from(exerciseMap.values()) : BASE_EXERCISES),
    [exerciseMap]
  );
  const exOf = useCallback(key => exerciseMap?.get(key) || baseExOf(key), [exerciseMap]);

  const [today] = useState(() => new Date());
  const todayWeekday = today.getDay() || 7;
  const [selectedDay, setSelectedDay] = useState(todayWeekday);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerGroup, setPickerGroup] = useState('all');
  const [pickerEq, setPickerEq] = useState('all');
  const [openItemId, setOpenItemId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [localItems, setLocalItems] = useState(routineItems);
  const [autoProgressState, setAutoProgressState] = useState(routine?.auto_progress ?? true);

  // Chế độ xem trước template (Preview mode)
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [previewDays, setPreviewDays] = useState([]);

  // Modal tạo lộ trình tự do & sửa lộ trình hiện tại
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Modal Tùy chỉnh chi tiết Hiệp/Rep của Template trước khi áp dụng
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [customizingTpl, setCustomizingTpl] = useState(null);
  const [customizedDays, setCustomizedDays] = useState([]);
  const [customizedWeeks, setCustomizedWeeks] = useState(4);
  const [customizedName, setCustomizedName] = useState('');
  const [customizedGoal, setCustomizedGoal] = useState('');

  // Form states cho Tạo lộ trình tự do
  const [customName, setCustomName] = useState('Lộ trình tập luyện mới');
  const [customGoal, setCustomGoal] = useState('Tăng cơ giảm mỡ & thể lực toàn diện');
  const [customWeeks, setCustomWeeks] = useState(8);
  const [customSplit, setCustomSplit] = useState('upper-lower');

  // Form states cho Sửa lộ trình
  const [editName, setEditName] = useState(routine?.name || '');
  const [editGoal, setEditGoal] = useState(routine?.goal || '');
  const [editWeeks, setEditWeeks] = useState(routine?.weeks || 8);

  // Sync state khi props cập nhật
  useEffect(() => {
    setLocalItems(routineItems);
  }, [routineItems]);

  useEffect(() => {
    if (routine) {
      setAutoProgressState(routine.auto_progress ?? true);
      setEditName(routine.name || '');
      setEditGoal(routine.goal || '');
      setEditWeeks(routine.weeks || 8);
    }
  }, [routine]);

  // Escape đóng popover / menu / bảng thêm bài
  useEffect(() => {
    if (!showSwitcher && !showMenu && !showPicker) return undefined;
    const onKey = e => {
      if (e.key !== 'Escape') return;
      setShowSwitcher(false);
      setShowMenu(false);
      setShowPicker(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSwitcher, showMenu, showPicker]);

  // Khởi tạo previewDays khi chọn template để preview
  const handleStartPreview = (tmpl) => {
    setPreviewTemplate(tmpl);
    const cloned = (tmpl.days || []).map(d => ({
      weekday: d.weekday,
      day_name: d.day_name,
      focus: d.focus,
      items: (d.items || []).map(it => ({
        id: `prev-${crypto.randomUUID()}`,
        exercise_key: it.exercise_key,
        target_sets: it.target_sets || 3,
        target_val: it.target_val || 10,
        unit: it.unit || 'rep',
        kg: it.kg || 0,
        rest_seconds: it.rest_seconds || 90
      }))
    }));
    setPreviewDays(cloned);
  };

  const handleStopPreview = () => {
    setPreviewTemplate(null);
    setPreviewDays([]);
  };

  // Mở modal tùy chỉnh Hiệp / Rep của template
  const handleOpenCustomizeTemplate = (tmpl) => {
    setCustomizingTpl(tmpl);
    setCustomizedName(tmpl.name);
    setCustomizedGoal(tmpl.goal);
    setCustomizedWeeks(tmpl.weeks || 4);

    const sourceDays = (previewTemplate?.key === tmpl.key && previewDays.length > 0)
      ? previewDays
      : (tmpl.days || []);

    const cloned = sourceDays.map(d => ({
      weekday: d.weekday,
      day_name: d.day_name,
      focus: d.focus,
      items: (d.items || []).map(it => ({
        exercise_key: it.exercise_key,
        target_sets: Number(it.target_sets) || 3,
        target_val: Number(it.target_val) || 10,
        unit: it.unit || 'rep',
        kg: Number(it.kg) || 0,
        rest_seconds: Number(it.rest_seconds) || 90
      }))
    }));

    setCustomizedDays(cloned);
    setShowCustomizeModal(true);
  };

  const isPreviewing = Boolean(previewTemplate);
  const activeRoutineData = isPreviewing ? previewTemplate : routine;

  // Danh sách items hiển thị trên bảng
  const currentDisplayItems = useMemo(() => {
    if (isPreviewing && previewDays.length > 0) {
      const items = [];
      previewDays.forEach(day => {
        (day.items || []).forEach(it => {
          items.push({
            id: it.id,
            weekday: day.weekday,
            day_name: day.day_name,
            exercise_key: it.exercise_key,
            target_sets: it.target_sets,
            target_val: it.target_val,
            unit: it.unit,
            kg: it.kg,
            rest_seconds: it.rest_seconds
          });
        });
      });
      return items;
    }
    return localItems;
  }, [isPreviewing, previewDays, localItems]);

  // Dữ liệu 7 ngày trong tuần. Tên dạng "Ngày A - Ngực, Vai" tách thành nhãn "Ngày A" + tên buổi.
  const weekdaysData = useMemo(() => {
    return BASE_WEEKDAY_DEFS.map(def => {
      const items = currentDisplayItems.filter(item => item.weekday === def.day);
      if (items.length === 0) {
        const isCheck = def.day === 7;
        return {
          ...def,
          items,
          isTrain: false,
          isCheck,
          name: isCheck ? 'Check-in' : 'Nghỉ',
          title: isCheck ? 'Check-in tuần' : 'Nghỉ',
          meta: isCheck ? 'Cân sáng, đo vòng eo' : 'Phục hồi'
        };
      }
      const name = items[0].day_name || def.defaultName;
      const { tag, letter, title } = splitDayName(name);
      const muscles = [...new Set(items.map(it => muscleOf(exOf(it.exercise_key))).filter(Boolean))];
      return {
        ...def,
        items,
        isTrain: true,
        name,
        tag,
        tagColor: DAY_TAG_COLORS[letter] || 'var(--body-accent)',
        title,
        totalSets: items.reduce((sum, it) => sum + (Number(it.target_sets) || 0), 0),
        est: minutesOf(items),
        muscles,
        focus: muscles.join(', ') || 'Cơ bắp toàn diện'
      };
    });
  }, [currentDisplayItems, exOf]);

  const activeDay = weekdaysData.find(w => w.day === selectedDay) || weekdaysData[0];
  const dayItems = activeDay.items;
  const currentActiveSession = activeSession || sessions.find(s => s.status === 'in_progress');

  // Thống kê thẻ ĐANG THEO
  const routineWeeksTotal = routine?.weeks || 8;
  const currentWeekNumber = useMemo(
    () => getRoutineWeek(routine?.start_date, routineWeeksTotal)?.current ?? 1,
    [routine, routineWeeksTotal]
  );

  const completedSessionsCount = useMemo(() => {
    return sessions.filter(s => s.status === 'completed' && (!routine?.id || s.routine_id === routine.id)).length;
  }, [sessions, routine]);

  // Số lần đạt kỷ lục mới (đếm theo buổi + bài, không đếm từng set)
  const prTotalCount = useMemo(() => {
    return new Set(recentSets.filter(s => s.is_pr).map(s => `${s.session_id}:${s.exercise_key}`)).size;
  }, [recentSets]);

  // Tỷ lệ hoàn thành lịch của lộ trình đang theo (buổi tập bù vẫn được tính)
  const adherence = useMemo(() => {
    if (!routine?.id) return { pct: null };
    return calculateAdherence({
      startDate: routine.start_date,
      plannedWeekdays: [...new Set(localItems.map(it => it.weekday))],
      completedDates: sessions.filter(s => s.status === 'completed' && s.routine_id === routine.id).map(s => s.local_date)
    });
  }, [routine, localItems, sessions]);
  const adherenceText = adherence.pct == null ? '—' : `${adherence.pct}%`;

  // ── Hết chu kỳ N tuần: tổng kết + lặp lại / tập nhẹ / đổi lộ trình ─────────────
  const cycle = useMemo(() => getCycleRange(routine?.start_date, routineWeeksTotal), [routine, routineWeeksTotal]);
  const cycleOver = Boolean(cycle) && !isPreviewing && toDateStr(today) > cycle.to;
  const [cycleOpen, setCycleOpen] = useState(false);
  const [cycleSets, setCycleSets] = useState(null);
  const [cycleBusy, setCycleBusy] = useState(false);
  const cycleSessions = useMemo(() => (cycle ? sessions.filter(s => s.routine_id === routine?.id
    && s.local_date >= cycle.from && s.local_date <= cycle.to) : []), [cycle, sessions, routine]);
  const cycleSummary = useMemo(
    () => (cycleSets ? buildCycleSummary(localItems, cycleSessions, cycleSets) : null),
    [cycleSets, localItems, cycleSessions]
  );
  const cycleAdherence = useMemo(() => {
    if (!cycle) return { pct: null };
    const [y, m, d] = cycle.to.split('-').map(Number);
    return calculateAdherence({
      startDate: cycle.from,
      plannedWeekdays: [...new Set(localItems.map(it => it.weekday))],
      completedDates: cycleSessions.filter(s => s.status === 'completed').map(s => s.local_date),
      today: new Date(y, m - 1, d + 1) // ngày sau chu kỳ: ngày cuối chưa tập vẫn bị tính
    });
  }, [cycle, localItems, cycleSessions]);

  const openCycleSummary = async () => {
    setCycleOpen(true);
    setCycleSets(null);
    const rows = await onLoadCycleSets?.(cycleSessions.map(s => s.id));
    setCycleSets(rows || []);
  };

  const restartCycle = async deload => {
    setCycleBusy(true);
    await onRestartCycle?.({ deload });
    setCycleBusy(false);
    setCycleOpen(false);
  };
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // ── Lịch tuần: ngày tháng, buổi đã tập, buổi đang dở ─────────────
  const weekDays = useMemo(() => getWeekDays(weekOffset, today), [weekOffset, today]);
  const isCurrentWeek = weekOffset === 0;
  const doneByWeekday = useMemo(
    () => (isPreviewing ? {} : mapWeekSessions(sessions, weekDays, routine?.id)),
    [isPreviewing, sessions, weekDays, routine]
  );
  const thisWeekDone = useMemo(
    () => Object.keys(mapWeekSessions(sessions, getWeekDays(0, today), routine?.id)).length,
    [sessions, today, routine]
  );
  const ongoingWeekday = !isPreviewing && isCurrentWeek ? Number(currentActiveSession?.planned_weekday) || null : null;
  const ongoingSets = useMemo(
    () => (currentActiveSession ? recentSets.filter(s => s.session_id === currentActiveSession.id) : []),
    [currentActiveSession, recentSets]
  );
  const doneSetsOf = item => Math.min(
    Number(item.target_sets) || 0,
    ongoingSets.filter(s => (s.routine_item_id ? s.routine_item_id === item.id : s.exercise_key === item.exercise_key)).length
  );

  const dayStatus = wd => {
    if (wd.isTrain && wd.day === ongoingWeekday) return 'ong';
    if (doneByWeekday[wd.day]) return 'done';
    if (!wd.isTrain) return wd.isCheck ? 'check' : 'rest';
    return isCurrentWeek && wd.day === todayWeekday ? 'today' : null;
  };

  // ── Ngày đang chọn ────────────────────────────────────────────
  const showProg = selectedDay === ongoingWeekday;
  const isSelectedToday = isCurrentWeek && selectedDay === todayWeekday;
  const selectedDate = weekDays[selectedDay - 1];
  const doneSession = doneByWeekday[selectedDay];
  const dayTotalSets = activeDay.totalSets || 0;
  const dayDoneSets = showProg ? dayItems.reduce((sum, it) => sum + doneSetsOf(it), 0) : 0;
  const currentItemId = showProg ? dayItems.find(it => doneSetsOf(it) < (Number(it.target_sets) || 0))?.id : null;
  const ongoingPct = dayTotalSets ? Math.round((dayDoneSets / dayTotalSets) * 100) : 0;
  const ongoingTime = currentActiveSession?.duration_seconds ? ` · ${mmss(currentActiveSession.duration_seconds)}` : '';
  const doneText = doneSession
    ? [ddmm(doneSession.local_date), doneSession.duration_seconds ? `${Math.max(1, Math.round(doneSession.duration_seconds / 60))} phút` : null].filter(Boolean).join(' · ')
    : '';
  const cta = isPreviewing || dayItems.length === 0 ? null
    : showProg ? 'cont'
      : doneSession ? 'done'
        : isSelectedToday ? 'start' : 'other';
  const startPayload = { weekday: selectedDay, day: selectedDay, name: activeDay.name, focus: activeDay.focus };
  const dayEyebrow = [
    activeDay.tag?.toUpperCase(),
    `${activeDay.short.toUpperCase()} ${ddmm(selectedDate.date)}`,
    isSelectedToday ? 'HÔM NAY' : null
  ].filter(Boolean).join(' · ');
  const dayMeta = activeDay.isTrain
    ? `${dayItems.length} bài · ${dayTotalSets} set · ~${activeDay.est} phút`
    : activeDay.meta;
  const dayRows = dayItems.map((item, idx) => {
    const ex = exOf(item.exercise_key);
    const dn = showProg ? doneSetsOf(item) : 0;
    return {
      item,
      idx,
      ...splitExerciseName(ex?.name || item.exercise_key),
      muscle: muscleOf(ex),
      dn,
      isCur: item.id === currentItemId,
      full: showProg && dn >= (Number(item.target_sets) || 0)
    };
  });

  // ── Thanh lộ trình ─────────────────────────────────────────────
  const trainDayCount = weekdaysData.filter(w => w.isTrain).length;
  const rests = [...new Set(currentDisplayItems.map(it => Number(it.rest_seconds) || 0))];
  const equipText = [...new Set(currentDisplayItems.map(it => exOf(it.exercise_key)?.equipment).filter(Boolean))]
    .map(k => EQ_LABEL[k]).join(' & ');
  const barChips = [
    trainDayCount ? `${trainDayCount} buổi/tuần` : null,
    rests.length === 1 && rests[0] ? `Nghỉ ${rests[0]}s giữa hiệp` : null,
    equipText || null
  ].filter(Boolean);
  const weekFill = trainDayCount ? Math.min(1, thisWeekDone / trainDayCount) : 0;
  const showStats = Boolean(routine?.id) && !isPreviewing;
  const canEdit = showStats;
  const routineName = activeRoutineData?.name || 'Chọn một lộ trình';
  const weekRange = weekDays[0].month === weekDays[6].month
    ? `${weekDays[0].day} – ${weekDays[6].day}/${weekDays[6].month}`
    : `${weekDays[0].day}/${weekDays[0].month} – ${weekDays[6].day}/${weekDays[6].month}`;
  const weekTitle = { 0: 'Lịch tuần này', '-1': 'Tuần trước', 1: 'Tuần sau' }[weekOffset] || 'Lịch tuần';

  // ── Bảng thêm bài ─────────────────────────────────────────────
  const pickQuery = normVi(pickerSearch.trim());
  const pickBase = allExercises.filter(ex =>
    (pickerEq === 'all' || ex.equipment === pickerEq)
    && (!pickQuery || normVi(ex.name).includes(pickQuery) || normVi(muscleOf(ex)).includes(pickQuery)));
  const pickCountOf = g => (g === 'all' ? pickBase.length : pickBase.filter(ex => PICK_GROUP_OF[ex.primary] === g).length);
  const pickSections = PICK_GROUPS
    .filter(g => pickerGroup === 'all' || g === pickerGroup)
    .map(g => ({ g, items: pickBase.filter(ex => PICK_GROUP_OF[ex.primary] === g) }))
    .filter(sec => sec.items.length > 0);
  const dayKeys = new Set(dayItems.map(it => it.exercise_key));

  const selectDay = day => {
    setSelectedDay(day);
    setOpenItemId(null);
  };

  const openPicker = () => {
    setPickerSearch('');
    setShowPicker(true);
  };

  const patchPreviewItem = (id, patch) => setPreviewDays(prev => prev.map(d => ({
    ...d,
    items: (d.items || []).map(it => (it.id === id ? { ...it, ...patch } : it))
  })));

  // Hành động với bài tập (Hỗ trợ cả chế độ xem trước và chế độ đang theo)
  const handleStepChange = (item, delta) => {
    const step = stepOfUnit(item.unit);
    const nextVal = Math.max(step, Number(item.target_val) + delta * step);

    if (isPreviewing) {
      patchPreviewItem(item.id, { target_val: nextVal });
    } else {
      setLocalItems(prev => prev.map(it => it.id === item.id ? { ...it, target_val: nextVal } : it));
      onUpdateTarget?.(item.id, nextVal);
    }
  };

  const handleSetChange = (item, delta) => {
    const nextSets = Math.max(1, Number(item.target_sets) + delta);

    if (isPreviewing) {
      patchPreviewItem(item.id, { target_sets: nextSets });
    } else {
      setLocalItems(prev => prev.map(it => it.id === item.id ? { ...it, target_sets: nextSets } : it));
      onUpdateSets?.(item.id, nextSets);
    }
  };

  // Nghỉ giữa hiệp: bước 15s, 0s = sang set kế ngay (màn tập bỏ qua đếm nghỉ)
  const handleRestChange = (item, delta) => {
    const nextRest = Math.min(300, Math.max(0, (Number(item.rest_seconds ?? 90) || 0) + delta * 15));

    if (isPreviewing) {
      patchPreviewItem(item.id, { rest_seconds: nextRest });
    } else {
      setLocalItems(prev => prev.map(it => it.id === item.id ? { ...it, rest_seconds: nextRest } : it));
      onUpdateRest?.(item.id, nextRest);
    }
  };

  // Đổi kiểu mục tiêu rep ↔ giây, đặt lại giá trị mặc định của kiểu mới
  const handleUnitToggle = (item) => {
    const unit = item.unit === 's' ? 'rep' : 's';
    const targetVal = unit === 's' ? 30 : 10;
    if (isPreviewing) patchPreviewItem(item.id, { unit, target_val: targetVal });
    else onUpdateUnit?.(item.id, unit, targetVal);
  };

  // Thả bài đang kéo vào vị trí của bài targetId (cùng ngày)
  const handleDrop = (targetId) => {
    const ids = dayItems.map(it => it.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    setDragId(null);
    setDragOverId(null);
    if (from < 0 || to < 0 || from === to) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    if (isPreviewing) {
      setPreviewDays(prev => prev.map(d => (d.weekday !== selectedDay ? d : {
        ...d,
        items: ids.map(id => d.items.find(it => it.id === id))
      })));
    } else {
      onReorderItems?.(ids);
    }
  };

  const handleDeleteItem = (itemId) => {
    if (isPreviewing) {
      setPreviewDays(prev => prev.map(d => ({
        ...d,
        items: (d.items || []).filter(it => it.id !== itemId)
      })));
    } else {
      setLocalItems(prev => prev.filter(it => it.id !== itemId));
      onDeleteExercise?.(itemId);
    }
  };

  const handleAddExercise = (exercise) => {
    if (isPreviewing) {
      const newItem = {
        id: `prev-${crypto.randomUUID()}`,
        exercise_key: exercise.key,
        target_sets: exercise.defaultSets || 3,
        target_val: exercise.defaultTarget || 10,
        unit: exercise.metric || 'rep',
        kg: exercise.defaultKg != null ? exercise.defaultKg : (exercise.equipment === 'db' ? 5 : 0),
        rest_seconds: 60
      };
      setPreviewDays(prev => {
        const foundDay = prev.find(d => d.weekday === selectedDay);
        if (foundDay) {
          return prev.map(d => d.weekday === selectedDay ? { ...d, items: [...d.items, newItem] } : d);
        }
        return [...prev, { weekday: selectedDay, day_name: activeDay.isTrain ? activeDay.name : 'Tập bù', items: [newItem] }];
      });
      return;
    }

    onAddExercise?.({
      weekday: selectedDay,
      dayName: activeDay.isTrain ? activeDay.name : 'Tập bù',
      exerciseKey: exercise.key,
      name: exercise.name,
      sets: exercise.defaultSets || 3,
      targetVal: exercise.defaultTarget || 10,
      unit: exercise.metric || 'rep',
      kg: exercise.defaultKg != null ? exercise.defaultKg : (exercise.equipment === 'db' ? 5 : 0),
      restSeconds: 60
    });
  };

  const toggleAutoProgress = () => {
    if (isPreviewing) return;
    const next = !autoProgressState;
    setAutoProgressState(next);
    onToggleAutoProgress?.(routine?.id, next);
  };

  // Áp dụng mẫu từ chế độ xem trước (Lấy đúng các số hiệp/rep đã sửa)
  const handleApplyPreviewTemplate = () => {
    if (!previewTemplate) return;
    onCreateCustomRoutine?.({
      name: previewTemplate.name,
      goal: previewTemplate.goal,
      weeks: previewTemplate.weeks || 4,
      days: previewDays
    });
    handleStopPreview();
  };

  // Áp dụng sau khi tùy chỉnh trong Modal Customize
  const handleSaveCustomizedTemplate = (e) => {
    e.preventDefault();
    onCreateCustomRoutine?.({
      name: customizedName,
      goal: customizedGoal,
      weeks: customizedWeeks,
      days: customizedDays
    });
    setShowCustomizeModal(false);
    handleStopPreview();
  };

  // Tạo lộ trình tùy chỉnh từ form tự do
  const handleCreateCustomSubmit = (e) => {
    e.preventDefault();
    let initialDays = [];

    if (customSplit === 'upper-lower') {
      initialDays = [
        {
          weekday: 1,
          day_name: 'Thân trên',
          items: [
            { exercise_key: 'push-up', target_sets: 3, target_val: 12, unit: 'rep', kg: 0, rest_seconds: 90 },
            { exercise_key: 'pike-push-up', target_sets: 3, target_val: 8, unit: 'rep', kg: 0, rest_seconds: 90 }
          ]
        },
        {
          weekday: 2,
          day_name: 'Thân dưới',
          items: [
            { exercise_key: 'slow-squat', target_sets: 3, target_val: 12, unit: 'rep', kg: 0, rest_seconds: 90 },
            { exercise_key: 'glute-bridge', target_sets: 3, target_val: 15, unit: 'rep', kg: 0, rest_seconds: 90 }
          ]
        },
        {
          weekday: 4,
          day_name: 'Thân trên B',
          items: [
            { exercise_key: 'assisted-pull-up', target_sets: 3, target_val: 6, unit: 'rep', kg: 0, rest_seconds: 90 },
            { exercise_key: 'plank', target_sets: 3, target_val: 40, unit: 's', kg: 0, rest_seconds: 90 }
          ]
        },
        {
          weekday: 5,
          day_name: 'Thân dưới & Lõi',
          items: [
            { exercise_key: 'slow-squat', target_sets: 2, target_val: 10, unit: 'rep', kg: 0, rest_seconds: 90 },
            { exercise_key: 'dead-bug', target_sets: 3, target_val: 10, unit: 'rep', kg: 0, rest_seconds: 90 }
          ]
        }
      ];
    } else if (customSplit === 'fullbody') {
      initialDays = [
        {
          weekday: 1,
          day_name: 'Toàn thân A',
          items: [
            { exercise_key: 'push-up', target_sets: 3, target_val: 10, unit: 'rep', kg: 0, rest_seconds: 90 },
            { exercise_key: 'slow-squat', target_sets: 3, target_val: 12, unit: 'rep', kg: 0, rest_seconds: 90 }
          ]
        },
        {
          weekday: 3,
          day_name: 'Toàn thân B',
          items: [
            { exercise_key: 'assisted-pull-up', target_sets: 3, target_val: 6, unit: 'rep', kg: 0, rest_seconds: 90 },
            { exercise_key: 'glute-bridge', target_sets: 3, target_val: 15, unit: 'rep', kg: 0, rest_seconds: 90 }
          ]
        },
        {
          weekday: 5,
          day_name: 'Toàn thân C (Nhẹ)',
          items: [
            { exercise_key: 'push-up', target_sets: 2, target_val: 10, unit: 'rep', kg: 0, rest_seconds: 90 },
            { exercise_key: 'plank', target_sets: 2, target_val: 35, unit: 's', kg: 0, rest_seconds: 90 }
          ]
        }
      ];
    } else if (customSplit === 'ppl') {
      initialDays = [
        {
          weekday: 1,
          day_name: 'Đẩy (Push)',
          items: [
            { exercise_key: 'push-up', target_sets: 3, target_val: 12, unit: 'rep', kg: 0, rest_seconds: 90 },
            { exercise_key: 'pike-push-up', target_sets: 3, target_val: 8, unit: 'rep', kg: 0, rest_seconds: 90 }
          ]
        },
        {
          weekday: 3,
          day_name: 'Kéo (Pull)',
          items: [
            { exercise_key: 'assisted-pull-up', target_sets: 3, target_val: 6, unit: 'rep', kg: 0, rest_seconds: 90 },
            { exercise_key: 'dead-bug', target_sets: 3, target_val: 10, unit: 'rep', kg: 0, rest_seconds: 90 }
          ]
        },
        {
          weekday: 5,
          day_name: 'Chân (Legs)',
          items: [
            { exercise_key: 'slow-squat', target_sets: 3, target_val: 12, unit: 'rep', kg: 0, rest_seconds: 90 },
            { exercise_key: 'glute-bridge', target_sets: 3, target_val: 15, unit: 'rep', kg: 0, rest_seconds: 90 }
          ]
        }
      ];
    }

    onCreateCustomRoutine?.({
      name: customName,
      goal: customGoal,
      weeks: customWeeks,
      days: initialDays
    });

    setShowCreateModal(false);
    handleStopPreview();
  };

  // Lưu thông tin chỉnh sửa lộ trình
  const handleSaveEditSubmit = (e) => {
    e.preventDefault();
    if (!routine?.id) return;
    onUpdateRoutineDetails?.(routine.id, {
      name: editName,
      goal: editGoal,
      weeks: editWeeks
    });
    setShowEditModal(false);
  };

  const nameText = <span className="body-rt-name-text">{routineName}</span>;

  // Đổi lộ trình: popover trên desktop, bottom sheet trên mobile — cùng nội dung, CSS đổi vị trí
  const switcherPanel = showSwitcher && (
    <>
      <div className="body-rt-backdrop is-sheet" onClick={() => setShowSwitcher(false)} />
      <div className="body-rt-pop" role="dialog" aria-label="Đổi lộ trình">
        <span className="body-rt-sheet-grip" />
        <div className="body-rt-sheet-head">
          <span>Đổi lộ trình</span>
          <button type="button" className="body-rt-icon-btn is-round" onClick={() => setShowSwitcher(false)} aria-label="Đóng">
            <AppIcon name="x" size={15} />
          </button>
        </div>
        {routines.length > 0 && (
          <>
            <span className="body-rt-pop-label">LỘ TRÌNH CỦA TÔI</span>
            {routines.map(r => {
              const on = r.id === routine?.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  className={`body-rt-pop-item${on && !isPreviewing ? ' is-on' : ''}`}
                  onClick={() => {
                    setShowSwitcher(false);
                    handleStopPreview();
                    if (!on) onSwitchRoutine?.(r.id);
                  }}
                >
                  <AppIcon
                    name={on ? 'checkCircle' : 'circle'}
                    size={18}
                    weight={on ? 'fill' : 'regular'}
                    className={on ? 'body-rt-ic-accent' : 'body-rt-ic-faint'}
                  />
                  <span className="body-rt-pop-text">
                    <span className="body-rt-pop-name">{r.name}</span>
                    <span className="body-rt-pop-meta">
                      {r.weeks || 8} tuần{on ? ` · đang ở tuần ${currentWeekNumber}/${routineWeeksTotal}` : ''}
                    </span>
                  </span>
                  {on && <span className="body-rt-tag is-dark">Đang theo</span>}
                </button>
              );
            })}
            <div className="body-rt-pop-sep" />
          </>
        )}
        <span className="body-rt-pop-label">MẪU CÓ SẴN</span>
        {(routineTemplates || []).map(t => (
          <button
            key={t.key}
            type="button"
            className={`body-rt-pop-item${previewTemplate?.key === t.key ? ' is-on' : ''}`}
            onClick={() => {
              setShowSwitcher(false);
              handleStartPreview(t);
            }}
          >
            <AppIcon name="file" size={18} className="body-rt-ic-muted" />
            <span className="body-rt-pop-text">
              <span className="body-rt-pop-name">{t.name}</span>
              <span className="body-rt-pop-meta">{t.weeks} tuần · {t.days?.length || 0} buổi/tuần · {t.goal}</span>
            </span>
            <span className={`body-rt-tag ${levelOf(t) === 'Trung cấp' ? 'is-amber' : 'is-green'}`}>{levelOf(t)}</span>
          </button>
        ))}
        <div className="body-rt-pop-sep" />
        <button
          type="button"
          className="body-rt-pop-item is-create"
          onClick={() => {
            setShowSwitcher(false);
            setShowCreateModal(true);
          }}
        >
          <span className="body-rt-plus"><AppIcon name="plus" size={13} /></span>
          <span className="body-rt-pop-text">
            <span className="body-rt-pop-name">Tạo lộ trình mới</span>
            <span className="body-rt-pop-meta">Tự chọn bài, hoặc bắt đầu từ lịch trống</span>
          </span>
        </button>
      </div>
    </>
  );

  const menuButton = (
    <button
      type="button"
      className="body-rt-icon-btn"
      onClick={() => setShowMenu(v => !v)}
      aria-haspopup="menu"
      aria-expanded={showMenu}
      aria-label="Tùy chọn lộ trình"
      title="Thêm"
    >
      <AppIcon name="dots" size={18} />
    </button>
  );

  const menuPanel = showMenu && (
    <>
      <div className="body-rt-backdrop" onClick={() => setShowMenu(false)} />
      <div className="body-rt-menu" role="menu">
        {canEdit && (
          <button
            type="button"
            role="menuitem"
            className="body-rt-menu-item"
            onClick={() => {
              setShowMenu(false);
              setShowEditModal(true);
            }}
          >
            <AppIcon name="pencil" size={15} />Sửa lộ trình
          </button>
        )}
        <button
          type="button"
          role="menuitem"
          className="body-rt-menu-item"
          onClick={() => {
            setShowMenu(false);
            setShowCreateModal(true);
          }}
        >
          <AppIcon name="plus" size={15} />Tạo lộ trình mới
        </button>
      </div>
    </>
  );

  const cycleCard = cycleOver && (
    <div className="body-rt-card body-rt-cycle">
      <AppIcon name="flag" size={20} className="body-rt-ic-accent" />
      <span className="body-rt-auto-text">
        <b>Đã xong chu kỳ {routineWeeksTotal} tuần</b>
        <span>Xem kết quả, rồi chọn lặp lại, tập nhẹ hoặc đổi lộ trình. Vẫn tập tiếp được như cũ.</span>
      </span>
      <button type="button" className="body-rt-btn-dark" onClick={openCycleSummary}>Xem tổng kết</button>
    </div>
  );

  const cycleVal = (sets, val, unit) => `${sets}×${val}${unit === 's' ? 's' : ''}`;

  const autoSwitch = (
    <button
      type="button"
      role="switch"
      aria-checked={autoProgressState}
      aria-label="Tăng tiến tự động"
      className="body-rt-switch"
      onClick={toggleAutoProgress}
      disabled={isPreviewing}
    />
  );

  const statusIcon = st => {
    if (st === 'done') return <AppIcon name="checkCircle" size={19} weight="fill" className="body-rt-ic-done" />;
    if (st === 'ong') return <span className="body-rt-badge is-ong"><i />Đang dở</span>;
    if (st === 'today') return <span className="body-rt-badge is-today">Hôm nay</span>;
    if (st === 'rest') return <AppIcon name="moon" size={16} className="body-rt-ic-faint" />;
    if (st === 'check') return <AppIcon name="scales" size={16} className="body-rt-ic-faint" />;
    return null;
  };

  const setsStepper = (item, lg) => (
    <div className={`body-rt-stepper${lg ? ' is-lg' : ''}`}>
      <button
        type="button"
        className="body-rt-step"
        onClick={() => handleSetChange(item, -1)}
        disabled={Number(item.target_sets) <= 1}
        aria-label="Giảm 1 hiệp"
      >
        <AppIcon name="minus" size={lg ? 14 : 12} />
      </button>
      <span className="body-rt-val">{item.target_sets}</span>
      <button type="button" className="body-rt-step" onClick={() => handleSetChange(item, 1)} aria-label="Tăng 1 hiệp">
        <AppIcon name="plus" size={lg ? 14 : 12} />
      </button>
    </div>
  );

  const restStepper = (item, lg) => (
    <div className={`body-rt-stepper${lg ? ' is-lg' : ''}`}>
      <button
        type="button"
        className="body-rt-step"
        onClick={() => handleRestChange(item, -1)}
        disabled={Number(item.rest_seconds ?? 90) <= 0}
        aria-label="Giảm 15 giây nghỉ"
      >
        <AppIcon name="minus" size={lg ? 14 : 12} />
      </button>
      <span className="body-rt-val">{item.rest_seconds ?? 90}{lg ? <small>giây</small> : 's'}</span>
      <button
        type="button"
        className="body-rt-step"
        onClick={() => handleRestChange(item, 1)}
        disabled={Number(item.rest_seconds ?? 90) >= 300}
        aria-label="Tăng 15 giây nghỉ"
      >
        <AppIcon name="plus" size={lg ? 14 : 12} />
      </button>
    </div>
  );

  // Desktop: chữ rep/giây bấm được để đổi kiểu; mobile đổi bằng nút "Tính theo ..." riêng
  const targetStepper = (item, lg) => (
    <div className={`body-rt-stepper${lg ? ' is-lg' : ''}`}>
      <button
        type="button"
        className="body-rt-step"
        onClick={() => handleStepChange(item, -1)}
        disabled={Number(item.target_val) <= stepOfUnit(item.unit)}
        aria-label="Giảm mục tiêu"
      >
        <AppIcon name="minus" size={lg ? 14 : 12} />
      </button>
      <span className="body-rt-val">
        {item.target_val}
        {lg ? (
          <small>{unitLabel(item.unit)}</small>
        ) : (
          <button type="button" className="body-rt-unit" onClick={() => handleUnitToggle(item)} title="Bấm để đổi rep / giây">
            {unitLabel(item.unit)}
          </button>
        )}
      </span>
      <button type="button" className="body-rt-step" onClick={() => handleStepChange(item, 1)} aria-label="Tăng mục tiêu">
        <AppIcon name="plus" size={lg ? 14 : 12} />
      </button>
    </div>
  );

  const progDots = (item, dn) => (
    <span className="body-rt-dots">
      <span>
        {Array.from({ length: Number(item.target_sets) || 0 }, (_, j) => <i key={j} className={j < dn ? 'on' : ''} />)}
      </span>
      <b className={dn ? 'on' : ''}>{dn}/{item.target_sets}</b>
    </span>
  );

  const emptyState = (
    <div className="body-rt-empty">
      <span className={`body-rt-empty-ic${activeDay.isCheck ? ' is-green' : ''}`}>
        <AppIcon name={activeDay.isCheck ? 'scales' : 'moon'} size={24} />
      </span>
      <span className="body-rt-empty-title">{activeDay.isCheck ? 'Check-in tuần' : 'Không có bài theo lịch'}</span>
      <span className="body-rt-empty-text">
        {activeDay.isCheck
          ? 'Cân buổi sáng trước khi ăn và đo vòng eo. Số liệu dùng để so sánh tiến bộ theo tuần.'
          : 'Nghỉ ngơi, đi bộ nhẹ hoặc giãn cơ. Thêm bài nếu muốn tập bù buổi đã lỡ.'}
      </span>
      {activeDay.isCheck ? (
        <>
          <button type="button" className="body-rt-btn-dark" onClick={() => onNavigate?.('biometrics')}>
            <AppIcon name="plus" size={14} />Ghi cân đo
          </button>
          <button type="button" className="body-rt-link" onClick={openPicker}>Thêm bài tập</button>
        </>
      ) : (
        <button type="button" className="body-rt-btn-outline" onClick={openPicker}>
          <AppIcon name="plus" size={14} />Thêm bài tập bù
        </button>
      )}
    </div>
  );

  return (
    <div className="body-routine-screen">
      {/* ── BANNER KHI ĐANG XEM TRƯỚC (PREVIEW MODE) ──────────────── */}
      {isPreviewing && (
        <div style={{
          background: 'var(--body-accent-soft)',
          border: '1.5px solid var(--body-accent-border)',
          borderRadius: '14px',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'var(--body-accent)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center'
            }}>
              <AppIcon name="eye" size={16} />
            </span>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                Đang xem trước mẫu: <span style={{ color: 'var(--body-accent)' }}>{previewTemplate.name}</span>
                <span style={{ marginLeft: '8px', fontSize: '12px', fontWeight: 400, color: 'var(--body-text-sub)' }}>
                  (Bạn có thể chỉnh sửa số hiệp, số rep trực tiếp ở bảng bên dưới)
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>
                {previewTemplate.weeks} tuần · {previewTemplate.days?.length || 4} buổi/tuần · {previewTemplate.goal}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleStopPreview}
              style={{
                height: '34px',
                padding: '0 14px',
                borderRadius: '8px',
                border: '1px solid var(--body-border-subtle)',
                background: 'var(--body-card-bg)',
                color: 'var(--body-text-main)',
                fontSize: '12.5px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <AppIcon name="back" size={13} />
              <span>Quay lại lộ trình của tôi</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenCustomizeTemplate(previewTemplate)}
              style={{
                height: '34px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid var(--body-accent)',
                background: 'var(--body-card-bg)',
                color: 'var(--body-accent)',
                fontSize: '12.5px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <AppIcon name="pencil" size={13} />
              <span>Tùy chỉnh số hiệp & rep</span>
            </button>

            <button
              type="button"
              onClick={handleApplyPreviewTemplate}
              style={{
                height: '34px',
                padding: '0 16px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--body-accent)',
                color: '#fff',
                fontSize: '12.5px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <AppIcon name="check" size={13} />
              <span>Dùng mẫu này</span>
            </button>
          </div>
        </div>
      )}

      {/* ── DESKTOP: thanh lộ trình + lịch tuần dọc + chi tiết ngày ─────────── */}
      <div className="body-routine-desktop-view body-rt-desktop">
        <section className="body-rt-card body-rt-bar">
          <div className="body-rt-bar-main">
            <span className="body-rt-eyebrow">
              {isPreviewing ? 'ĐANG XEM TRƯỚC' : routine ? 'ĐANG THEO' : 'CHƯA CÓ LỘ TRÌNH'}
              {showStats && (
                <>
                  <span className="body-rt-eyebrow-dot" />
                  <span className="body-rt-saved"><AppIcon name="checkCircle" size={13} />Đã lưu vào hồ sơ</span>
                </>
              )}
            </span>
            <div className="body-rt-switch-wrap">
              <button
                type="button"
                className={`body-rt-name${showSwitcher ? ' is-open' : ''}`}
                aria-haspopup="dialog"
                aria-expanded={showSwitcher}
                onClick={() => setShowSwitcher(v => !v)}
                title="Đổi lộ trình"
              >
                {nameText}
                <span className="body-rt-caret"><AppIcon name="caretDown" size={14} /></span>
              </button>
              {switcherPanel}
            </div>
            <div className="body-rt-chips">
              {barChips.map(c => <span key={c} className="body-rt-chip">{c}</span>)}
              {activeRoutineData?.goal && <span className="body-rt-goal">{activeRoutineData.goal}</span>}
            </div>
          </div>

          {showStats && (
            <>
              <div className="body-rt-bar-sec">
                <span className="body-rt-label">TIẾN ĐỘ</span>
                <span className="body-rt-big">
                  {cycleOver ? 'Hết chu kỳ' : <>Tuần {currentWeekNumber}<small>/ {routineWeeksTotal}</small></>}
                </span>
                <div className="body-rt-weeks">
                  {Array.from({ length: routineWeeksTotal }, (_, i) => {
                    const isCur = i === currentWeekNumber - 1;
                    return (
                      <span
                        key={i}
                        className={i < currentWeekNumber - 1 ? 'is-done' : isCur ? 'is-cur' : ''}
                        style={isCur ? { '--fill': `${Math.round(weekFill * 100)}%` } : undefined}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="body-rt-bar-sec body-rt-stats">
                <div>
                  <span className="body-rt-label">ĐÃ TẬP</span>
                  <span className="body-rt-big">{completedSessionsCount}<small>buổi</small></span>
                </div>
                <div>
                  <span className="body-rt-label">ĐÚNG LỊCH</span>
                  <span className="body-rt-big">
                    {adherenceText}
                    {adherence.planned ? <small>{adherence.done}/{adherence.planned}</small> : null}
                  </span>
                </div>
                <div>
                  <span className="body-rt-label">KỶ LỤC</span>
                  <span className="body-rt-big">{prTotalCount}<small>PR</small></span>
                </div>
              </div>
            </>
          )}

          <div className="body-rt-bar-actions">
            {canEdit && (
              <button
                type="button"
                className="body-rt-icon-btn"
                onClick={() => setShowEditModal(true)}
                title="Sửa lộ trình"
                aria-label="Sửa lộ trình"
              >
                <AppIcon name="pencil" size={16} />
              </button>
            )}
            <div className="body-rt-menu-wrap">{menuButton}{menuPanel}</div>
          </div>
        </section>

        {cycleCard}

        <div className="body-rt-grid">
          <div className="body-rt-left">
            <div className="body-rt-card body-rt-week">
              <div className="body-rt-week-head">
                <span className="body-rt-week-title">{weekTitle}<small>{weekRange}</small></span>
                <span className="body-rt-week-nav">
                  <button type="button" className="body-rt-icon-btn is-sm" onClick={() => setWeekOffset(w => w - 1)} aria-label="Tuần trước">
                    <AppIcon name="caretLeft" size={13} />
                  </button>
                  <button type="button" className="body-rt-icon-btn is-sm" onClick={() => setWeekOffset(w => w + 1)} aria-label="Tuần sau">
                    <AppIcon name="caretRight" size={13} />
                  </button>
                </span>
              </div>
              <div className="body-rt-days">
                {weekdaysData.map((wd, i) => (
                  <button
                    key={wd.day}
                    type="button"
                    className={`body-rt-day${selectedDay === wd.day ? ' is-selected' : ''}${wd.isTrain ? '' : ' is-rest'}${isCurrentWeek && wd.day === todayWeekday ? ' is-today' : ''}`}
                    onClick={() => selectDay(wd.day)}
                    aria-pressed={selectedDay === wd.day}
                  >
                    <span className="body-rt-day-label"><b>{wd.label}</b><small>{ddmm(weekDays[i].date)}</small></span>
                    <span className="body-rt-day-info">
                      <span className="body-rt-day-title">{wd.title}</span>
                      <span className="body-rt-day-meta">
                        {wd.isTrain ? (
                          <>
                            {wd.tag && <><b style={{ color: wd.tagColor }}>{wd.tag}</b> · </>}
                            {wd.items.length} bài · ~{wd.est} phút
                          </>
                        ) : wd.meta}
                      </span>
                    </span>
                    <span className="body-rt-day-status">{statusIcon(dayStatus(wd))}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="body-rt-card body-rt-auto">
              {autoSwitch}
              <span className="body-rt-auto-text">
                <b>Tăng tiến tự động</b>
                <span>Đủ mục tiêu ở mọi set thì buổi sau đề xuất +1 rep, bài tính giây +5s. Bạn duyệt trước khi áp dụng.</span>
              </span>
            </div>
          </div>

          <div className="body-rt-card body-rt-detail">
            <div className="body-rt-detail-head">
              <div className="body-rt-detail-info">
                <span className="body-rt-eyebrow" style={activeDay.isTrain ? { color: activeDay.tagColor } : undefined}>{dayEyebrow}</span>
                <h2 className="body-rt-detail-title">{activeDay.title}</h2>
                <div className="body-rt-detail-meta">
                  <span>{dayMeta}</span>
                  {activeDay.muscles?.map(m => <span key={m} className="body-rt-mchip">{m}</span>)}
                </div>
              </div>

              {cta === 'cont' && (
                <div className="body-rt-ongoing">
                  <div className="body-rt-ongoing-head">
                    <span><i />Buổi đang dở</span>
                    <span className="body-rt-mono">{dayDoneSets}/{dayTotalSets} set{ongoingTime}</span>
                  </div>
                  <div className="body-rt-prog"><span style={{ width: `${ongoingPct}%` }} /></div>
                  <button type="button" className="body-rt-btn-dark" onClick={() => onResumeSession?.(currentActiveSession)}>
                    <AppIcon name="play" size={12} weight="fill" />Tiếp tục buổi
                  </button>
                </div>
              )}
              {cta === 'start' && (
                <div className="body-rt-cta-col">
                  <button type="button" className="body-rt-btn-dark is-lg" onClick={() => onStartSession?.(startPayload)}>
                    Bắt đầu buổi<AppIcon name="arrowRight" size={15} />
                  </button>
                  <span className="body-rt-hint">Chọn cách tập ở bước sau</span>
                </div>
              )}
              {cta === 'other' && (
                <button type="button" className="body-rt-btn-outline" onClick={() => onStartSession?.(startPayload)}>
                  <AppIcon name="play" size={13} />Tập buổi này hôm nay
                </button>
              )}
              {cta === 'done' && (
                <div className="body-rt-cta-col">
                  <span className="body-rt-done-pill"><AppIcon name="checkCircle" size={14} weight="fill" />Đã tập · {doneText}</span>
                  <button type="button" className="body-rt-link" onClick={() => onNavigate?.('history')}>
                    Xem kết quả buổi<AppIcon name="arrowRight" size={13} />
                  </button>
                </div>
              )}
            </div>

            {activeDay.isTrain ? (
              <div className="body-rt-table">
                <div className="body-rt-row is-head">
                  <span /><span>BÀI TẬP</span><span>HIỆP</span><span>MỤC TIÊU</span><span>TẠ</span><span>NGHỈ</span><span />
                </div>
                {dayRows.map(({ item, idx, vn, en, muscle, dn, isCur }) => (
                  <div
                    key={item.id}
                    className={`body-rt-row${isCur ? ' is-current' : ''}${dragId === item.id ? ' is-dragging' : ''}${dragOverId === item.id && dragId && dragId !== item.id ? ' is-over' : ''}`}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', item.id);
                      setDragId(item.id);
                    }}
                    onDragOver={e => {
                      e.preventDefault();
                      if (dragOverId !== item.id) setDragOverId(item.id);
                    }}
                    onDrop={e => {
                      e.preventDefault();
                      handleDrop(item.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setDragOverId(null);
                    }}
                  >
                    <span className="body-rt-row-no" title="Kéo để đổi thứ tự">
                      <AppIcon name="dotsSix" size={14} />
                      <span>{String(idx + 1).padStart(2, '0')}</span>
                    </span>
                    <div className="body-rt-row-name">
                      <span className="body-rt-row-title">
                        {vn}
                        {isCur && <span className="body-rt-badge-sm">Đang tập</span>}
                      </span>
                      <span className="body-rt-row-sub">
                        {[en, muscle].filter(Boolean).join(' · ')}
                        {showProg && progDots(item, dn)}
                      </span>
                    </div>
                    {setsStepper(item)}
                    {targetStepper(item)}
                    <span className={`body-rt-kg${item.kg ? '' : ' is-bw'}`}>{item.kg ? `${item.kg} kg` : 'BW'}</span>
                    {restStepper(item)}
                    <button
                      type="button"
                      className="body-rt-del"
                      onClick={() => handleDeleteItem(item.id)}
                      title="Xóa bài"
                      aria-label={`Xóa ${vn}`}
                    >
                      <AppIcon name="trash" size={14} />
                    </button>
                  </div>
                ))}
                <div className="body-rt-table-foot">
                  <button type="button" className="body-rt-btn-soft" onClick={openPicker}>
                    <AppIcon name="plus" size={14} />Thêm bài tập
                  </button>
                  <span className="body-rt-hint">
                    Bấm chữ <em>rep</em> / <em>giây</em> để đổi kiểu mục tiêu · kéo ⋮⋮ để đổi thứ tự
                  </span>
                </div>
              </div>
            ) : emptyState}
          </div>
        </div>
      </div>

      {/* ── MOBILE ───────────────────────────────────────────────────────────── */}
      <div className={`body-routine-mobile-view${cta ? ' has-cta' : ''}`}>
        <section className="body-rt-card body-rt-m-head">
          <div className="body-rt-m-top">
            <button
              type="button"
              className="body-rt-m-name"
              aria-haspopup="dialog"
              aria-expanded={showSwitcher}
              onClick={() => setShowSwitcher(true)}
            >
              <span className="body-rt-eyebrow">
                {isPreviewing ? 'ĐANG XEM TRƯỚC' : routine
                  ? `ĐANG THEO · ${cycleOver ? 'HẾT CHU KỲ' : `TUẦN ${currentWeekNumber}/${routineWeeksTotal}`}`
                  : 'CHƯA CÓ LỘ TRÌNH'}
              </span>
              <span className="body-rt-m-title">
                {nameText}
                <span className="body-rt-caret is-sm"><AppIcon name="caretDown" size={13} /></span>
              </span>
            </button>
            <div className="body-rt-menu-wrap">{menuButton}{menuPanel}</div>
          </div>

          {showStats && (
            <div className="body-rt-m-stats">
              <div><span className="body-rt-big">{completedSessionsCount}<small>buổi</small></span><span>Đã tập</span></div>
              <div><span className="body-rt-big">{adherenceText}</span><span>Đúng lịch</span></div>
              <div><span className="body-rt-big">{prTotalCount}<small>PR</small></span><span>Kỷ lục</span></div>
            </div>
          )}

          <div className="body-rt-m-week">
            {weekdaysData.map((wd, i) => {
              const st = dayStatus(wd);
              const dot = st === 'done' || st === 'ong' || st === 'today' ? ` is-${st}` : wd.isTrain ? ' is-train' : '';
              return (
                <button
                  key={wd.day}
                  type="button"
                  className={`${selectedDay === wd.day ? 'is-selected' : ''}${isCurrentWeek && wd.day === todayWeekday ? ' is-today' : ''}${wd.isTrain ? '' : ' is-rest'}`}
                  onClick={() => selectDay(wd.day)}
                  aria-pressed={selectedDay === wd.day}
                  aria-label={`${wd.short} ${ddmm(weekDays[i].date)}`}
                >
                  <span className="body-rt-m-wd">{wd.label}</span>
                  <span className="body-rt-m-n">{weekDays[i].day}</span>
                  <i className={`body-rt-m-dot${dot}`} />
                </button>
              );
            })}
          </div>
          {switcherPanel}
        </section>

        {cycleCard}

        <div className="body-rt-m-dayhead">
          <span className="body-rt-eyebrow" style={activeDay.isTrain ? { color: activeDay.tagColor } : undefined}>{dayEyebrow}</span>
          <span className="body-rt-m-daytitle">{activeDay.title}</span>
          <span className="body-rt-m-daymeta">{dayMeta}</span>
        </div>

        {activeDay.isTrain ? (
          <>
            {dayRows.map(({ item, idx, vn, muscle, dn, isCur, full }) => {
              const open = openItemId === item.id;
              return (
                <div key={item.id} className={`body-rt-m-ex${isCur ? ' is-current' : ''}`}>
                  <button
                    type="button"
                    className="body-rt-m-ex-head"
                    onClick={() => setOpenItemId(open ? null : item.id)}
                    aria-expanded={open}
                  >
                    <span className={`body-rt-m-no${full ? ' is-full' : isCur ? ' is-current' : ''}`}>{idx + 1}</span>
                    <span className="body-rt-m-ex-info">
                      <span className="body-rt-m-ex-name">{vn}</span>
                      <span className="body-rt-m-ex-sub">
                        <b>{item.target_sets} × {item.target_val} {unitLabel(item.unit)}</b>
                        <i>·</i>{item.kg ? `${item.kg} kg` : 'BW'}
                        {muscle && <><i>·</i>{muscle}</>}
                      </span>
                    </span>
                    {showProg
                      ? progDots(item, dn)
                      : <AppIcon name={open ? 'caretUp' : 'caretDown'} size={15} className="body-rt-ic-muted" />}
                  </button>
                  {open && (
                    <div className="body-rt-m-ex-edit">
                      <div className="body-rt-m-fields">
                        <div><span>Hiệp</span>{setsStepper(item, true)}</div>
                        <div><span>Mục tiêu mỗi hiệp</span>{targetStepper(item, true)}</div>
                        <div><span>Nghỉ giữa hiệp</span>{restStepper(item, true)}</div>
                      </div>
                      <div className="body-rt-m-ex-actions">
                        <button type="button" className="body-rt-text-btn" onClick={() => handleUnitToggle(item)}>
                          <AppIcon name="repeat" size={13} />Tính theo {item.unit === 's' ? 'rep' : 'giây'}
                        </button>
                        <button
                          type="button"
                          className="body-rt-text-btn is-danger"
                          onClick={() => {
                            setOpenItemId(null);
                            handleDeleteItem(item.id);
                          }}
                        >
                          <AppIcon name="trash" size={13} />Xóa bài
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <button type="button" className="body-rt-m-add" onClick={openPicker}>
              <AppIcon name="plus" size={14} />Thêm bài tập
            </button>

            {/* Thanh hành động ghim sát đáy (mobile-view chừa đệm dưới để không che chữ) */}
            {cta && (
              <div className="body-rt-card body-rt-m-cta">
                {cta === 'cont' && (
                  <div className="body-rt-m-cta-row">
                    <div className="body-rt-m-cta-info">
                      <div className="body-rt-ongoing-head">
                        <span><i />Buổi đang dở</span>
                        <span className="body-rt-mono">{dayDoneSets}/{dayTotalSets} set</span>
                      </div>
                      <div className="body-rt-prog is-thin"><span style={{ width: `${ongoingPct}%` }} /></div>
                    </div>
                    <button type="button" className="body-rt-btn-dark is-xl" onClick={() => onResumeSession?.(currentActiveSession)}>
                      <AppIcon name="play" size={12} weight="fill" />Tiếp tục
                    </button>
                  </div>
                )}
                {cta === 'start' && (
                  <button type="button" className="body-rt-btn-dark is-xl is-block" onClick={() => onStartSession?.(startPayload)}>
                    Bắt đầu buổi<span className="body-rt-mono is-dim">~{activeDay.est} phút</span><AppIcon name="arrowRight" size={15} />
                  </button>
                )}
                {cta === 'other' && (
                  <button type="button" className="body-rt-btn-outline is-xl is-block" onClick={() => onStartSession?.(startPayload)}>
                    <AppIcon name="play" size={13} />Tập buổi này hôm nay
                  </button>
                )}
                {cta === 'done' && (
                  <div className="body-rt-m-cta-row">
                    <span className="body-rt-done-text"><AppIcon name="checkCircle" size={17} weight="fill" />Đã tập · {doneText}</span>
                    <button type="button" className="body-rt-link" onClick={() => onNavigate?.('history')}>
                      Kết quả<AppIcon name="arrowRight" size={13} />
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="body-rt-card body-rt-auto is-row">
              <span className="body-rt-auto-text">
                <b>Tăng tiến tự động</b>
                <span>Đủ mục tiêu → đề xuất +1 rep / +5s</span>
              </span>
              {autoSwitch}
            </div>
          </>
        ) : emptyState}
      </div>

      {/* ── THÊM BÀI: ngăn phải (desktop) / bottom sheet (mobile) ──────────── */}
      {showPicker && (
        <>
          <div className="body-rt-drawer-backdrop" onClick={() => setShowPicker(false)} />
          <aside className="body-rt-drawer" role="dialog" aria-label="Thêm bài tập">
            <div className="body-rt-drawer-head">
              <span className="body-rt-sheet-grip" />
              <div className="body-rt-drawer-title-row">
                <span className="body-rt-drawer-titles">
                  <span className="body-rt-eyebrow is-accent">
                    THÊM VÀO {activeDay.short.toUpperCase()}{activeDay.tag ? ` · ${activeDay.tag.toUpperCase()}` : ''}
                  </span>
                  <span className="body-rt-drawer-title">Thêm bài tập</span>
                </span>
                <button type="button" className="body-rt-icon-btn" onClick={() => setShowPicker(false)} aria-label="Đóng">
                  <AppIcon name="x" size={15} />
                </button>
              </div>
              <div className="body-rt-search">
                <AppIcon name="search" size={16} />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  placeholder="Tìm theo tên tiếng Việt hoặc tiếng Anh"
                  aria-label="Tìm bài tập"
                  autoFocus={window.matchMedia?.('(min-width: 841px)').matches}
                />
                {pickerSearch && (
                  <button type="button" className="body-rt-search-clear" onClick={() => setPickerSearch('')} aria-label="Xóa tìm kiếm">
                    <AppIcon name="x" size={11} />
                  </button>
                )}
              </div>
              <div className="body-rt-groups">
                {['all', ...PICK_GROUPS].map(g => {
                  const count = pickCountOf(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      className={`body-rt-gchip${pickerGroup === g ? ' is-on' : ''}${count ? '' : ' is-empty'}`}
                      onClick={() => setPickerGroup(g)}
                      aria-pressed={pickerGroup === g}
                    >
                      {g === 'all' ? 'Tất cả' : g}<small>{count}</small>
                    </button>
                  );
                })}
              </div>
              <div className="body-rt-seg" role="group" aria-label="Dụng cụ">
                {PICK_EQS.map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className={pickerEq === k ? 'is-on' : ''}
                    onClick={() => setPickerEq(k)}
                    aria-pressed={pickerEq === k}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="body-rt-drawer-list">
              {pickSections.map(sec => (
                <div key={sec.g}>
                  <span className="body-rt-sec">{sec.g.toUpperCase()} · {sec.items.length}</span>
                  {sec.items.map(ex => {
                    const { vn, en } = splitExerciseName(ex.name);
                    const has = dayKeys.has(ex.key);
                    const def = `${ex.defaultSets || 3} × ${ex.defaultTarget || 10}${ex.metric === 's' ? 's' : ''}${ex.defaultKg ? ` · ${ex.defaultKg}kg` : ''}`;
                    return (
                      <div key={ex.key} className="body-rt-lib">
                        <span className="body-rt-lib-info">
                          <span className="body-rt-lib-name">{vn}</span>
                          <span className="body-rt-lib-sub">
                            <span className="body-rt-m-only">{def} · </span>
                            {[en, muscleOf(ex)].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <span className="body-rt-lib-def"><b>{def}</b><small>{EQ_LABEL[ex.equipment]}</small></span>
                        {has ? (
                          <span className="body-rt-add is-has"><AppIcon name="check" size={12} /><span>Đã có</span></span>
                        ) : (
                          <button type="button" className="body-rt-add" onClick={() => handleAddExercise(ex)} aria-label={`Thêm ${vn}`}>
                            <AppIcon name="plus" size={12} /><span>Thêm</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              {pickSections.length === 0 && (
                <div className="body-rt-lib-empty">
                  <AppIcon name="search" size={22} />
                  <b>Không có bài phù hợp</b>
                  <span>Thử bỏ bớt bộ lọc hoặc tìm bằng tên tiếng Anh.</span>
                </div>
              )}
            </div>

            <div className="body-rt-drawer-foot">
              <span className="body-rt-drawer-sum">
                <b>{activeDay.short}{activeDay.isTrain ? ` · ${activeDay.title}` : ''}</b>
                <small>{dayItems.length} bài · {dayTotalSets} set · ~{activeDay.est || 0} phút</small>
              </span>
              <button type="button" className="body-rt-btn-dark is-xl" onClick={() => setShowPicker(false)}>Xong</button>
            </div>
          </aside>
        </>
      )}

      {/* ── MODAL TÙY CHỈNH HIỆP & REP CỦA TEMPLATE TRƯỚC KHI ÁP DỤNG ─ */}
      {showCustomizeModal && (
        <div className="body-modal-backdrop" onClick={() => setShowCustomizeModal(false)}>
          <div
            className="body-modal-box"
            style={{ maxWidth: '640px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              padding: '18px 22px',
              borderBottom: '1px solid var(--body-card-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                  Tùy chỉnh số hiệp & rep khi áp dụng
                </span>
                <div style={{ fontSize: '12px', color: 'var(--body-text-muted)', marginTop: '2px' }}>
                  {customizingTpl?.name} · Tự do tăng giảm theo thể trạng của bạn
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomizeModal(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--body-text-muted)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <AppIcon name="x" size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomizedTemplate} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ padding: '18px 22px', overflowY: 'auto', maxHeight: '60vh', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Thông tin chung */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px', color: 'var(--body-text-main)' }}>
                      Tên lộ trình
                    </label>
                    <input
                      type="text"
                      required
                      value={customizedName}
                      onChange={e => setCustomizedName(e.target.value)}
                      style={{
                        width: '100%',
                        height: '36px',
                        borderRadius: '8px',
                        border: '1px solid var(--body-border-subtle)',
                        padding: '0 10px',
                        fontSize: '13px',
                        background: 'var(--body-card-bg)',
                        color: 'var(--body-text-main)',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px', color: 'var(--body-text-main)' }}>
                      Số tuần
                    </label>
                    <select
                      value={customizedWeeks}
                      onChange={e => setCustomizedWeeks(Number(e.target.value))}
                      style={{
                        width: '100%',
                        height: '36px',
                        borderRadius: '8px',
                        border: '1px solid var(--body-border-subtle)',
                        padding: '0 8px',
                        fontSize: '13px',
                        background: 'var(--body-card-bg)',
                        color: 'var(--body-text-main)',
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value={4}>4 tuần</option>
                      <option value={6}>6 tuần</option>
                      <option value={8}>8 tuần</option>
                      <option value={12}>12 tuần</option>
                    </select>
                  </div>
                </div>

                {/* Danh sách các buổi tập và bài tập */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                    Cấu hình bài tập theo từng thứ:
                  </span>

                  {customizedDays.map((day, dIdx) => {
                    const dayDef = BASE_WEEKDAY_DEFS.find(w => w.day === day.weekday) || { short: `Thứ ${day.weekday}` };

                    return (
                      <div
                        key={day.weekday}
                        style={{
                          background: 'var(--body-shell-bg)',
                          borderRadius: '12px',
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                            {dayDef.short}: {day.day_name}
                          </span>
                          <span style={{ fontSize: '11.5px', color: 'var(--body-text-muted)' }}>
                            {day.items.length} bài
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {day.items.map((it, itIdx) => {
                            const ex = exOf(it.exercise_key);

                            const updateItem = (newSets, newTarget) => {
                              setCustomizedDays(prev => prev.map((d, di) => {
                                if (di !== dIdx) return d;
                                return {
                                  ...d,
                                  items: d.items.map((item, ii) => {
                                    if (ii !== itIdx) return item;
                                    return {
                                      ...item,
                                      target_sets: newSets !== undefined ? Math.max(1, newSets) : item.target_sets,
                                      target_val: newTarget !== undefined ? Math.max(1, newTarget) : item.target_val
                                    };
                                  })
                                };
                              }));
                            };

                            const removeItem = () => {
                              setCustomizedDays(prev => prev.map((d, di) => {
                                if (di !== dIdx) return d;
                                return {
                                  ...d,
                                  items: d.items.filter((_, ii) => ii !== itIdx)
                                };
                              }));
                            };

                            return (
                              <div
                                key={it.exercise_key + itIdx}
                                style={{
                                  background: 'var(--body-card-bg)',
                                  borderRadius: '8px',
                                  padding: '8px 10px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '8px'
                                }}
                              >
                                <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                                  {ex?.name || it.exercise_key}
                                </span>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {/* Sửa Hiệp */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--body-text-muted)' }}>Hiệp:</span>
                                    <div className="body-routine-counter" style={{ height: '28px' }}>
                                      <button
                                        type="button"
                                        className="body-routine-counter-btn"
                                        style={{ width: '24px' }}
                                        onClick={() => updateItem(it.target_sets - 1, undefined)}
                                      >
                                        −
                                      </button>
                                      <span style={{ width: '22px', textAlign: 'center', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--body-mono)' }}>
                                        {it.target_sets}
                                      </span>
                                      <button
                                        type="button"
                                        className="body-routine-counter-btn"
                                        style={{ width: '24px' }}
                                        onClick={() => updateItem(it.target_sets + 1, undefined)}
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>

                                  {/* Sửa Rep/s */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--body-text-muted)' }}>Mục tiêu:</span>
                                    <div className="body-routine-counter-target" style={{ height: '28px' }}>
                                      <button
                                        type="button"
                                        className="body-routine-counter-btn"
                                        style={{ width: '24px' }}
                                        onClick={() => updateItem(undefined, it.target_val - (it.unit === 's' ? 5 : 1))}
                                      >
                                        −
                                      </button>
                                      <span style={{ minWidth: '40px', textAlign: 'center', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--body-mono)', color: 'var(--body-accent)' }}>
                                        {it.target_val} {it.unit}
                                      </span>
                                      <button
                                        type="button"
                                        className="body-routine-counter-btn"
                                        style={{ width: '24px' }}
                                        onClick={() => updateItem(undefined, it.target_val + (it.unit === 's' ? 5 : 1))}
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>

                                  {/* Nút Xoá */}
                                  <button
                                    type="button"
                                    onClick={removeItem}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      color: '#B5B4AE',
                                      cursor: 'pointer',
                                      padding: '4px'
                                    }}
                                    title="Xóa bài khỏi ngày này"
                                  >
                                    <AppIcon name="trash" size={13} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{
                padding: '14px 22px',
                borderTop: '1px solid var(--body-card-border)',
                display: 'flex',
                gap: '8px',
                background: 'var(--body-card-bg)'
              }}>
                <button
                  type="button"
                  onClick={() => setShowCustomizeModal(false)}
                  style={{
                    flex: 1,
                    height: '38px',
                    borderRadius: '9px',
                    border: '1px solid var(--body-border-subtle)',
                    background: 'var(--body-shell-bg)',
                    color: 'var(--body-text-main)',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1.5,
                    height: '38px',
                    borderRadius: '9px',
                    border: 'none',
                    background: 'var(--body-accent)',
                    color: '#fff',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Lưu & Bắt đầu lộ trình này
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL TẠO LỘ TRÌNH MỚI TỰ DO ─────────────────────────── */}
      {showCreateModal && (
        <div className="body-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="body-modal-box" onClick={e => e.stopPropagation()}>
            <div style={{
              padding: '18px 22px',
              borderBottom: '1px solid var(--body-card-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                Tạo lộ trình mới
              </span>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--body-text-muted)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <AppIcon name="x" size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCustomSubmit} style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px', color: 'var(--body-text-main)' }}>
                  Tên lộ trình
                </label>
                <input
                  type="text"
                  required
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="Ví dụ: Lịch tập A/B buổi sáng"
                  style={{
                    width: '100%',
                    height: '38px',
                    borderRadius: '9px',
                    border: '1px solid var(--body-border-subtle)',
                    padding: '0 12px',
                    fontSize: '13.5px',
                    boxSizing: 'border-box',
                    background: 'var(--body-card-bg)',
                    color: 'var(--body-text-main)',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px', color: 'var(--body-text-main)' }}>
                  Mục tiêu chính
                </label>
                <input
                  type="text"
                  value={customGoal}
                  onChange={e => setCustomGoal(e.target.value)}
                  placeholder="Ví dụ: Tăng cơ ngực vai, bảo vệ khớp gối"
                  style={{
                    width: '100%',
                    height: '38px',
                    borderRadius: '9px',
                    border: '1px solid var(--body-border-subtle)',
                    padding: '0 12px',
                    fontSize: '13.5px',
                    boxSizing: 'border-box',
                    background: 'var(--body-card-bg)',
                    color: 'var(--body-text-main)',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px', color: 'var(--body-text-main)' }}>
                  Thời lượng kế hoạch
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {[4, 6, 8, 12].map(w => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setCustomWeeks(w)}
                      style={{
                        height: '34px',
                        borderRadius: '8px',
                        border: `1.5px solid ${customWeeks === w ? 'var(--body-accent)' : 'var(--body-border-subtle)'}`,
                        background: customWeeks === w ? 'var(--body-accent-soft)' : 'var(--body-card-bg)',
                        color: customWeeks === w ? 'var(--body-accent)' : 'var(--body-text-main)',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {w} tuần
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px', color: 'var(--body-text-main)' }}>
                  Khung lịch ban đầu (Split)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { key: 'upper-lower', label: 'Thân trên / Thân dưới (4 buổi)', desc: 'T2 Thân trên, T3 Thân dưới, T5 Thân trên B, T6 Thân dưới & Lõi' },
                    { key: 'fullbody', label: 'Toàn thân (Full Body 3 buổi)', desc: 'T2, T4, T6 tập toàn thân. Nghỉ ngơi T3, T5, T7, CN' },
                    { key: 'ppl', label: 'Đẩy / Kéo / Chân (Push Pull Legs)', desc: 'T2 Đẩy, T4 Kéo, T6 Chân' },
                    { key: 'empty', label: 'Lịch trống hoàn toàn', desc: '7 ngày nghỉ sẵn, tự lên bài tập từ đầu' }
                  ].map(s => (
                    <div
                      key={s.key}
                      onClick={() => setCustomSplit(s.key)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: `1.5px solid ${customSplit === s.key ? 'var(--body-accent)' : 'var(--body-card-border)'}`,
                        background: customSplit === s.key ? 'var(--body-accent-tint)' : 'var(--body-card-bg)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px'
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                        {s.label}
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--body-text-muted)' }}>
                        {s.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', paddingTop: '10px', marginTop: 'auto' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    flex: 1,
                    height: '40px',
                    borderRadius: '10px',
                    border: '1px solid var(--body-border-subtle)',
                    background: 'var(--body-shell-bg)',
                    color: 'var(--body-text-main)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1.5,
                    height: '40px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'var(--body-accent)',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Tạo lộ trình & Bắt đầu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {cycleOpen && cycle && (
        <div className="body-modal-backdrop" onClick={() => !cycleBusy && setCycleOpen(false)}>
          <div className="body-modal-box body-rt-cyc" role="dialog" aria-label="Tổng kết chu kỳ" onClick={e => e.stopPropagation()}>
            <div className="body-rt-cyc-head">
              <span className="body-rt-cyc-titles">
                <span className="body-rt-eyebrow">{ddmm(cycle.from)} – {ddmm(cycle.to)} · {routineWeeksTotal} TUẦN</span>
                <span className="body-rt-cyc-title">Tổng kết chu kỳ</span>
              </span>
              <button
                type="button"
                className="body-rt-icon-btn is-round"
                onClick={() => setCycleOpen(false)}
                disabled={cycleBusy}
                aria-label="Đóng"
              >
                <AppIcon name="x" size={15} />
              </button>
            </div>

            <div className="body-rt-cyc-body">
              {!cycleSummary ? (
                <p className="body-rt-cyc-empty">Đang tải kết quả…</p>
              ) : (
                <>
                  <div className="body-rt-cyc-stats">
                    <div><span className="body-rt-big">{cycleSummary.sessions}<small>buổi</small></span><span>Đã tập</span></div>
                    <div>
                      <span className="body-rt-big">{cycleAdherence.pct == null ? '—' : `${cycleAdherence.pct}%`}</span>
                      <span>Đúng lịch</span>
                    </div>
                    <div><span className="body-rt-big">{cycleSummary.prs}<small>PR</small></span><span>Kỷ lục</span></div>
                  </div>
                  <div className="body-rt-cyc-list">
                    <span className="body-rt-label">MỤC TIÊU ĐẦU CHU KỲ → BÂY GIỜ</span>
                    {cycleSummary.exercises.map(e => (
                      <div key={e.key} className="body-rt-cyc-row">
                        <span className="body-rt-cyc-name">{splitExerciseName(exOf(e.key)?.name || e.key).vn}</span>
                        <span className={`body-rt-mono${e.startVal != null && e.nowVal > e.startVal ? ' is-up' : ''}`}>
                          {e.startVal != null && `${cycleVal(e.startSets, e.startVal, e.unit)} → `}
                          {cycleVal(e.nowSets, e.nowVal, e.unit)}
                        </span>
                        <span className="body-rt-cyc-best">
                          {e.best == null ? 'chưa tập' : `tốt nhất ${formatValWithUnit(e.best, e.unit)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="body-rt-cyc-actions">
              <button type="button" className="body-rt-cyc-opt" onClick={() => restartCycle(false)} disabled={cycleBusy}>
                <AppIcon name="repeat" size={18} />
                <span className="body-rt-auto-text">
                  <b>Lặp lại chu kỳ</b>
                  <span>Giữ mục tiêu hiện tại, quay về tuần 1/{routineWeeksTotal}.</span>
                </span>
              </button>
              <button type="button" className="body-rt-cyc-opt" onClick={() => restartCycle(true)} disabled={cycleBusy}>
                <AppIcon name="leaf" size={18} />
                <span className="body-rt-auto-text">
                  <b>Tập nhẹ rồi lặp lại</b>
                  <span>Giảm ~20% mục tiêu mọi bài (giữ nguyên kg), tăng tiến tự động sẽ kéo lên lại.</span>
                </span>
              </button>
              <button
                type="button"
                className="body-rt-cyc-opt"
                onClick={() => {
                  setCycleOpen(false);
                  setShowSwitcher(true);
                }}
                disabled={cycleBusy}
              >
                <AppIcon name="listChecks" size={18} />
                <span className="body-rt-auto-text">
                  <b>Chọn lộ trình mới</b>
                  <span>Mở danh sách lộ trình của bạn và mẫu có sẵn.</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmDeleteOpen}
        title="Xóa lộ trình?"
        message={`Lộ trình "${routine?.name || ''}" và các bài trong lịch sẽ bị xóa. Lịch sử buổi tập vẫn được giữ.`}
        confirmLabel="Xóa lộ trình"
        danger
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          setShowEditModal(false);
          onDeleteRoutine?.(routine.id);
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      {/* ── MODAL CHỈNH SỬA LỘ TRÌNH HIỆN TẠI ─────────────────────── */}
      {showEditModal && (
        <div className="body-modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div className="body-modal-box" onClick={e => e.stopPropagation()}>
            <div style={{
              padding: '18px 22px',
              borderBottom: '1px solid var(--body-card-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                Chỉnh sửa lộ trình
              </span>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--body-text-muted)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <AppIcon name="x" size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditSubmit} style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px', color: 'var(--body-text-main)' }}>
                  Tên lộ trình
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    borderRadius: '9px',
                    border: '1px solid var(--body-border-subtle)',
                    padding: '0 12px',
                    fontSize: '13.5px',
                    boxSizing: 'border-box',
                    background: 'var(--body-card-bg)',
                    color: 'var(--body-text-main)',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px', color: 'var(--body-text-main)' }}>
                  Mục tiêu
                </label>
                <input
                  type="text"
                  value={editGoal}
                  onChange={e => setEditGoal(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    borderRadius: '9px',
                    border: '1px solid var(--body-border-subtle)',
                    padding: '0 12px',
                    fontSize: '13.5px',
                    boxSizing: 'border-box',
                    background: 'var(--body-card-bg)',
                    color: 'var(--body-text-main)',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px', color: 'var(--body-text-main)' }}>
                  Số tuần
                </label>
                <input
                  type="number"
                  min="1"
                  max="52"
                  value={editWeeks}
                  onChange={e => setEditWeeks(Number(e.target.value))}
                  style={{
                    width: '100%',
                    height: '38px',
                    borderRadius: '9px',
                    border: '1px solid var(--body-border-subtle)',
                    padding: '0 12px',
                    fontSize: '13.5px',
                    boxSizing: 'border-box',
                    background: 'var(--body-card-bg)',
                    color: 'var(--body-text-main)',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', paddingTop: '10px' }}>
                {routines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOpen(true)}
                    style={{
                      height: '40px',
                      padding: '0 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--body-red)',
                      background: 'var(--body-red-soft)',
                      color: 'var(--body-red)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Xoá
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  style={{
                    flex: 1,
                    height: '40px',
                    borderRadius: '10px',
                    border: '1px solid var(--body-border-subtle)',
                    background: 'var(--body-shell-bg)',
                    color: 'var(--body-text-main)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Hủy
                </button>

                <button
                  type="submit"
                  style={{
                    flex: 1.5,
                    height: '40px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'var(--body-accent)',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
