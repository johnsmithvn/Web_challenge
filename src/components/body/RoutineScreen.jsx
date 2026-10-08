import { useState, useEffect, useMemo } from 'react';
import AppIcon from '../AppIcon';
import BASE_EXERCISES from '../../data/body-exercises.json';
import ROUTINE_TEMPLATES from '../../data/body-routine-templates.json';
import MUSCLE_MAP from '../../data/body-muscles.json';
import { DAY_TYPE_COLORS, stepOfUnit } from '../../utils/workoutLogic';

const BASE_WEEKDAY_DEFS = [
  { day: 1, label: 'T2', short: 'Thứ Hai', defaultName: 'Thân trên', defaultType: 'Đẩy' },
  { day: 2, label: 'T3', short: 'Thứ Ba', defaultName: 'Nghỉ', defaultType: null },
  { day: 3, label: 'T4', short: 'Thứ Tư', defaultName: 'Thân dưới & Bụng', defaultType: 'Chân' },
  { day: 4, label: 'T5', short: 'Thứ Năm', defaultName: 'Nghỉ', defaultType: null },
  { day: 5, label: 'T6', short: 'Thứ Sáu', defaultName: 'Toàn thân', defaultType: 'Toàn thân' },
  { day: 6, label: 'T7', short: 'Thứ Bảy', defaultName: 'Nghỉ', defaultType: null },
  { day: 7, label: 'CN', short: 'Chủ Nhật', defaultName: 'Check-in', defaultType: null }
];

export default function RoutineScreen({
  routine,
  routineItems = [],
  routines = [],
  routineTemplates = ROUTINE_TEMPLATES,
  sessions = [],
  recentSets = [],
  onCreateRoutineFromTemplate,
  onCreateCustomRoutine,
  onSwitchRoutine,
  onUpdateRoutineDetails,
  onDeleteRoutine,
  onStartSession,
  onUpdateTarget,
  onUpdateSets,
  onAddExercise,
  onDeleteExercise,
  onToggleAutoProgress
}) {
  // Thứ trong tuần đang xem (1: T2 -> 7: CN, mặc định Thứ Ba hoặc Thứ Hai)
  const [selectedDay, setSelectedDay] = useState(2);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [localItems, setLocalItems] = useState(routineItems);
  const [autoProgressState, setAutoProgressState] = useState(routine?.auto_progress ?? true);

  // Chế độ xem trước template (Preview mode)
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [previewDays, setPreviewDays] = useState([]);
  const [expandedTplKey, setExpandedTplKey] = useState(null);

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

  // Khởi tạo previewDays khi chọn template để preview
  const handleStartPreview = (tmpl) => {
    setPreviewTemplate(tmpl);
    const cloned = (tmpl.days || []).map(d => ({
      weekday: d.weekday,
      day_name: d.day_name,
      focus: d.focus,
      items: (d.items || []).map(it => ({
        id: `prev-${d.weekday}-${it.exercise_key}-${Math.random().toString(36).substr(2, 5)}`,
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

  // Dữ liệu 7 ngày trong tuần
  const weekdaysData = useMemo(() => {
    return BASE_WEEKDAY_DEFS.map(def => {
      const items = currentDisplayItems.filter(item => item.weekday === def.day);
      if (items.length > 0) {
        const totalSets = items.reduce((sum, it) => sum + (Number(it.target_sets) || 0), 0);
        const estMinutes = Math.round(totalSets * 1.8);
        const dayName = items[0].day_name || def.defaultName;
        const muscles = [];
        items.forEach(it => {
          const ex = BASE_EXERCISES.find(e => e.key === it.exercise_key);
          const m = MUSCLE_MAP[ex?.primary]?.name || ex?.primary;
          if (m && !muscles.includes(m)) muscles.push(m);
        });

        let dotColor = '#6949E8';
        let shortName = 'Tập';
        if (dayName.includes('Chân')) { dotColor = '#2F8A57'; shortName = 'Chân'; }
        else if (dayName.includes('Đẩy')) { dotColor = '#E0822C'; shortName = 'Đẩy'; }
        else if (dayName.includes('Kéo')) { dotColor = '#3A82F6'; shortName = 'Kéo'; }
        else if (dayName.includes('Toàn thân')) { dotColor = '#9A6514'; shortName = 'Toàn thân'; }
        else if (dayName.includes('Thân trên')) { dotColor = '#6949E8'; shortName = 'Thân trên'; }
        else if (dayName.includes('Thân dưới')) { dotColor = '#2F8A57'; shortName = 'Thân dưới'; }
        else { shortName = dayName.slice(0, 8); }

        return {
          day: def.day,
          label: def.label,
          short: def.short,
          shortName,
          name: dayName,
          meta: `${items.length} bài · ${totalSets} set`,
          est: `~${estMinutes} phút`,
          dotColor,
          isTrain: true,
          focus: muscles.join(', ') || 'Cơ bắp toàn diện'
        };
      }
      return {
        day: def.day,
        label: def.label,
        short: def.short,
        shortName: def.day === 7 ? 'Check-in' : 'Nghỉ',
        name: def.day === 7 ? 'Check-in' : 'Nghỉ',
        meta: def.day === 7 ? 'Cân sáng, eo' : 'Phục hồi',
        est: '',
        dotColor: '#C9C7C0',
        isTrain: false,
        note: def.day === 7
          ? 'Đo vòng eo, cân nặng vào buổi sáng sau khi ngủ dậy để theo dõi tiến độ tuần.'
          : 'Nghỉ ngơi, đi bộ nhẹ hoặc giãn cơ 15 phút. Cho phép sợi cơ tổng hợp lại glycogen.'
      };
    });
  }, [currentDisplayItems]);

  const activeDay = weekdaysData.find(w => w.day === selectedDay) || weekdaysData[0];
  const dayItems = currentDisplayItems.filter(item => item.weekday === selectedDay);

  // Thống kê thẻ ĐANG THEO
  const routineWeeksTotal = routine?.weeks || 8;
  const currentWeekNumber = useMemo(() => {
    if (!routine?.start_date) return 3;
    const start = new Date(routine.start_date);
    const now = new Date();
    const diffDays = Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
    const week = Math.floor(diffDays / 7) + 1;
    return Math.min(routineWeeksTotal, Math.max(1, week));
  }, [routine, routineWeeksTotal]);

  const completedSessionsCount = useMemo(() => {
    return sessions.filter(s => s.status === 'completed' && (!routine?.id || s.routine_id === routine.id)).length;
  }, [sessions, routine]);

  const prTotalCount = useMemo(() => {
    return recentSets.filter(s => s.is_pr).length || 3;
  }, [recentSets]);

  // Hành động với bài tập (Hỗ trợ cả chế độ xem trước và chế độ đang theo)
  const handleStepChange = (item, delta) => {
    const step = stepOfUnit(item.unit);
    const nextVal = Math.max(step, Number(item.target_val) + delta * step);

    if (isPreviewing) {
      setPreviewDays(prev => prev.map(d => ({
        ...d,
        items: (d.items || []).map(it => it.id === item.id ? { ...it, target_val: nextVal } : it)
      })));
    } else {
      setLocalItems(prev => prev.map(it => it.id === item.id ? { ...it, target_val: nextVal } : it));
      onUpdateTarget?.(item.id, nextVal);
    }
  };

  const handleSetChange = (item, delta) => {
    const nextSets = Math.max(1, Number(item.target_sets) + delta);

    if (isPreviewing) {
      setPreviewDays(prev => prev.map(d => ({
        ...d,
        items: (d.items || []).map(it => it.id === item.id ? { ...it, target_sets: nextSets } : it)
      })));
    } else {
      setLocalItems(prev => prev.map(it => it.id === item.id ? { ...it, target_sets: nextSets } : it));
      onUpdateSets?.(item.id, nextSets);
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
        id: `prev-${selectedDay}-${exercise.key}-${Math.random().toString(36).substr(2, 5)}`,
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
        return [...prev, { weekday: selectedDay, day_name: activeDay.name, items: [newItem] }];
      });
      setShowPicker(false);
      return;
    }

    onAddExercise?.({
      weekday: selectedDay,
      dayName: activeDay.name,
      exerciseKey: exercise.key,
      name: exercise.name,
      sets: exercise.defaultSets || 3,
      targetVal: exercise.defaultTarget || 10,
      unit: exercise.metric || 'rep',
      kg: exercise.defaultKg != null ? exercise.defaultKg : (exercise.equipment === 'db' ? 5 : 0),
      restSeconds: 60
    });
    setShowPicker(false);
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

  const filteredPicker = BASE_EXERCISES.filter(e =>
    !pickerSearch
    || e.name.toLowerCase().includes(pickerSearch.toLowerCase())
    || (e.primary && e.primary.toLowerCase().includes(pickerSearch.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      {/* ── HEADER THANH CÔNG CỤ LỘ TRÌNH ──────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 4px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 700,
            margin: 0,
            color: 'var(--body-text-main)',
            fontFamily: 'var(--body-font)'
          }}>
            Lộ trình
          </h2>

          {routines.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12.5px', color: 'var(--body-text-muted)' }}>Lộ trình:</span>
              <select
                value={routine?.id || ''}
                onChange={e => onSwitchRoutine?.(e.target.value)}
                style={{
                  height: '32px',
                  borderRadius: '8px',
                  border: '1px solid var(--body-border-subtle)',
                  background: 'var(--body-card-bg)',
                  color: 'var(--body-text-main)',
                  padding: '0 10px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {routines.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.is_active ? '(Đang theo)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            style={{
              height: '36px',
              padding: '0 15px',
              borderRadius: '10px',
              background: '#15161A',
              color: '#FFFFFF',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
            }}
          >
            <AppIcon name="plus" size={14} />
            <span>Tạo lộ trình</span>
          </button>
        </div>
      </div>

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

      {/* ── GIAO DIỆN DESKTOP (BỐ CỤC 2 CỘT 296px & MAIN TABLE) ──────── */}
      <div className="body-routine-desktop-view">
        <div className="body-routine-container">

        {/* ── CỘT TRÁI: THÔNG TIN LỘ TRÌNH & CÁC MẪU (296px) ───────── */}
        <div className="body-routine-sidebar">

          {/* Card ĐANG THEO (Dark) */}
          <div className="body-routine-card-dark">
            <div className="body-routine-dark-header">
              <span className="body-routine-dark-badge">ĐANG THEO</span>
              <span className="body-routine-dark-week">
                Tuần {currentWeekNumber} / {routineWeeksTotal}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 className="body-routine-dark-title">
                  {routine?.name || 'Chưa chọn lộ trình'}
                </h3>
                {routine?.id && (
                  <button
                    type="button"
                    onClick={() => setShowEditModal(true)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#9C9AA8',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'grid',
                      placeItems: 'center'
                    }}
                    title="Chỉnh sửa thông tin lộ trình"
                  >
                    <AppIcon name="pencil" size={14} />
                  </button>
                )}
              </div>
              <div className="body-routine-dark-sub">
                {routineWeeksTotal} tuần · {weekdaysData.filter(w => w.isTrain).length} buổi/tuần · {routine?.goal || 'Duy trì cơ bắp & tăng sức bền'}
              </div>
            </div>

            {/* Dải 8 vạch tuần */}
            <div className="body-routine-week-bars">
              {Array.from({ length: routineWeeksTotal }).map((_, idx) => (
                <span
                  key={idx}
                  className={`body-routine-week-bar ${idx < currentWeekNumber ? 'active' : ''}`}
                />
              ))}
            </div>

            {/* 3 chỉ số tóm tắt */}
            <div className="body-routine-dark-stats">
              <div className="body-routine-stat-item">
                <span className="body-routine-stat-label">Đã tập</span>
                <span className="body-routine-stat-val">{completedSessionsCount} buổi</span>
              </div>
              <div className="body-routine-stat-item">
                <span className="body-routine-stat-label">Đúng lịch</span>
                <span className="body-routine-stat-val">100%</span>
              </div>
              <div className="body-routine-stat-item">
                <span className="body-routine-stat-label">Kỷ lục</span>
                <span className="body-routine-stat-val">{prTotalCount} PR</span>
              </div>
            </div>
          </div>

          {/* Tiêu đề MẪU CÓ SẴN */}
          <div style={{
            fontFamily: 'var(--body-mono)',
            fontSize: '10.5px',
            letterSpacing: '0.09em',
            color: 'var(--body-text-muted)',
            fontWeight: 600,
            padding: '4px 2px 0'
          }}>
            MẪU CÓ SẴN
          </div>

          {/* Danh sách Templates */}
          {(routineTemplates || []).map((t) => {
            const isSelectedTpl = previewTemplate?.key === t.key;
            const isExpanded = expandedTplKey === t.key || isSelectedTpl;
            const levelLabel = t.level || (t.key.includes('calisthenics') ? 'Trung cấp' : 'Cơ bản');
            const levelBg = levelLabel === 'Trung cấp' ? 'var(--body-amber-soft)' : 'var(--body-green-soft)';
            const levelColor = levelLabel === 'Trung cấp' ? 'var(--body-amber-text)' : 'var(--body-green-text)';

            return (
              <div
                key={t.key}
                className={`body-routine-tpl-card ${isSelectedTpl ? 'active' : ''}`}
                onClick={() => setExpandedTplKey(isExpanded ? null : t.key)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                    {t.name}
                  </span>
                  <span style={{
                    padding: '3px 7px',
                    borderRadius: '6px',
                    background: levelBg,
                    color: levelColor,
                    fontSize: '10.5px',
                    fontWeight: 600,
                    flex: 'none'
                  }}>
                    {levelLabel}
                  </span>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--body-text-muted)', lineHeight: 1.4 }}>
                  {t.weeks} tuần · {t.days?.length || 3} buổi/tuần · {t.goal}
                </div>

                {/* Tags loại bài */}
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  <span style={{
                    height: '22px',
                    padding: '0 7px',
                    borderRadius: '6px',
                    background: 'var(--body-shell-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: 'var(--body-text-sub)'
                  }}>
                    {t.key.includes('calisthenics') ? 'Bodyweight' : (t.key.includes('30min') ? 'Nghỉ 90s' : 'Kháng lực')}
                  </span>
                  <span style={{
                    height: '22px',
                    padding: '0 7px',
                    borderRadius: '6px',
                    background: 'var(--body-shell-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: 'var(--body-text-sub)'
                  }}>
                    {t.days?.length || 3} buổi / tuần
                  </span>
                </div>

                {/* Nút Xem trước, Tùy chỉnh và Dùng mẫu */}
                {isExpanded && (
                  <div
                    style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '6px' }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleStartPreview(t)}
                        style={{
                          flex: 1,
                          height: '32px',
                          borderRadius: '8px',
                          border: '1px solid var(--body-border-subtle)',
                          background: 'var(--body-card-bg)',
                          color: 'var(--body-text-main)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Xem trước
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenCustomizeTemplate(t)}
                        style={{
                          flex: 1.2,
                          height: '32px',
                          borderRadius: '8px',
                          border: '1px solid var(--body-accent)',
                          background: 'var(--body-accent-tint)',
                          color: 'var(--body-accent)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Sửa rep & hiệp
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onCreateRoutineFromTemplate?.(t.key);
                        handleStopPreview();
                      }}
                      style={{
                        width: '100%',
                        height: '32px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'var(--body-accent)',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Dùng mẫu này ngay
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── CỘT PHẢI: CHI TIẾT LỘ TRÌNH & KẾ HOẠCH THEO THỨ ─────── */}
        <div className="body-routine-main">

          {/* Top Bar của Routine */}
          <div className="body-routine-main-top">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '22px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                  {activeRoutineData?.name || 'Chưa chọn lộ trình'}
                </span>
                {!isPreviewing && (
                  <button
                    type="button"
                    onClick={() => setShowEditModal(true)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--body-text-muted)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'grid',
                      placeItems: 'center'
                    }}
                    title="Chỉnh sửa lộ trình"
                  >
                    <AppIcon name="pencil" size={15} />
                  </button>
                )}
              </div>

              {/* Tags thông tin tóm tắt */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <span className="body-routine-pill">
                  {activeRoutineData?.weeks || 4} tuần · {weekdaysData.filter(w => w.isTrain).length} buổi/tuần
                </span>
                <span className="body-routine-pill">
                  Mục tiêu: {activeRoutineData?.goal || 'Rèn luyện sức khỏe'}
                </span>
                <span className="body-routine-pill">
                  Nghỉ 90s giữa hiệp · Bodyweight & Tạ đơn
                </span>
              </div>
            </div>

            {/* Trạng thái Lộ trình */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                background: isPreviewing ? 'var(--body-accent-soft)' : 'var(--body-green-soft, rgba(16, 185, 129, 0.12))',
                color: isPreviewing ? 'var(--body-accent)' : 'var(--body-green, #10B981)',
                border: `1px solid ${isPreviewing ? 'var(--body-accent-border)' : 'var(--body-green-border, rgba(16, 185, 129, 0.25))'}`,
                userSelect: 'none'
              }}>
                <AppIcon name="checkCircle" size={14} />
                <span>{isPreviewing ? 'Đang xem trước' : 'Đã lưu vào hồ sơ'}</span>
              </span>
            </div>
          </div>

          {/* Dải 7 ngày trong tuần */}
          <div className="body-routine-days-strip">
            {weekdaysData.map((wd) => {
              const isSelected = selectedDay === wd.day;
              return (
                <div
                  key={wd.day}
                  onClick={() => setSelectedDay(wd.day)}
                  className={`body-routine-day-card ${isSelected ? 'active' : ''}`}
                >
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--body-text-muted)' }}>
                    {wd.label}
                  </span>
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    color: 'var(--body-text-main)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: wd.dotColor,
                      flex: 'none'
                    }} />
                    {wd.name}
                  </span>
                  <span style={{
                    marginTop: 'auto',
                    fontSize: '11px',
                    color: 'var(--body-text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {wd.meta}
                  </span>
                  {wd.est && (
                    <span style={{
                      fontFamily: 'var(--body-mono)',
                      fontSize: '11px',
                      color: 'var(--body-text-muted)'
                    }}>
                      {wd.est}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Chi tiết theo ngày */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--body-card-border)' }}>
            <div style={{
              padding: '16px 24px 10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline'
            }}>
              <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                {activeDay.short} — Buổi {activeDay.name}
              </span>
              <span style={{ fontSize: '12.5px', color: 'var(--body-text-muted)' }}>
                {activeDay.isTrain ? `${dayItems.length} bài tập · ${activeDay.est}` : 'Ngày nghỉ phục hồi'}
              </span>
            </div>

            {/* Nếu là ngày tập */}
            {activeDay.isTrain ? (
              <div className="body-routine-table-wrap">
                <div className="body-routine-row body-routine-header-row">
                  <span></span>
                  <span>BÀI TẬP</span>
                  <span>KIỂU MỤC TIÊU</span>
                  <span style={{ textAlign: 'center' }}>HIỆP (SET)</span>
                  <span style={{ textAlign: 'center' }}>MỤC TIÊU (REP/S)</span>
                  <span>TẠ</span>
                  <span>NGHỈ</span>
                  <span></span>
                </div>

                {/* Hàng bài tập (Cho phép bấm -/+ sửa cả khi xem trước và khi đang theo) */}
                {dayItems.map((item) => {
                  const exDef = BASE_EXERCISES.find(e => e.key === item.exercise_key);
                  const muscleVn = MUSCLE_MAP[exDef?.primary]?.name || exDef?.primary || '';

                  return (
                    <div key={item.id} className="body-routine-row">
                      <span style={{ color: '#C9C7C0', display: 'grid', placeItems: 'center', cursor: 'grab' }}>
                        <AppIcon name="dotsSix" size={16} />
                      </span>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                        <span style={{
                          fontSize: '13.5px',
                          fontWeight: 600,
                          color: 'var(--body-text-main)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {exDef?.name || item.exercise_key}
                        </span>
                        <span style={{ fontSize: '11.5px', color: 'var(--body-text-muted)' }}>
                          {muscleVn}
                        </span>
                      </div>

                      <span style={{
                        justifySelf: 'start',
                        height: '26px',
                        padding: '0 8px',
                        borderRadius: '6px',
                        background: 'var(--body-accent-soft)',
                        color: 'var(--body-accent)',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '11.5px',
                        fontWeight: 600
                      }}>
                        {item.unit === 's' ? 'Set × Giây' : 'Set × Rep'}
                      </span>

                      {/* Bộ đếm SET */}
                      <div className="body-routine-counter">
                        <button
                          type="button"
                          className="body-routine-counter-btn"
                          onClick={() => handleSetChange(item, -1)}
                          title="Giảm 1 hiệp"
                        >
                          <AppIcon name="minus" size={11} />
                        </button>
                        <span style={{
                          flex: 1,
                          textAlign: 'center',
                          fontFamily: 'var(--body-mono)',
                          fontSize: '13.5px',
                          fontWeight: 600
                        }}>
                          {item.target_sets}
                        </span>
                        <button
                          type="button"
                          className="body-routine-counter-btn"
                          onClick={() => handleSetChange(item, 1)}
                          title="Tăng 1 hiệp"
                        >
                          <AppIcon name="plus" size={11} />
                        </button>
                      </div>

                      {/* Bộ đếm Mục tiêu (REP/GIÂY) */}
                      <div className="body-routine-counter-target">
                        <button
                          type="button"
                          className="body-routine-counter-btn"
                          onClick={() => handleStepChange(item, -1)}
                          title="Giảm mục tiêu"
                        >
                          <AppIcon name="minus" size={11} />
                        </button>
                        <span style={{
                          flex: 1,
                          textAlign: 'center',
                          fontFamily: 'var(--body-mono)',
                          fontSize: '13.5px',
                          fontWeight: 600,
                          color: 'var(--body-accent)'
                        }}>
                          {item.target_val}
                          <span style={{ fontSize: '10.5px', fontWeight: 400, color: 'var(--body-text-muted)', marginLeft: '3px' }}>
                            {item.unit}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="body-routine-counter-btn"
                          onClick={() => handleStepChange(item, 1)}
                          title="Tăng mục tiêu"
                        >
                          <AppIcon name="plus" size={11} />
                        </button>
                      </div>

                      {/* Tạ */}
                      <span style={{ fontFamily: 'var(--body-mono)', fontSize: '12.5px', color: 'var(--body-text-sub)' }}>
                        {item.kg ? `${item.kg} kg` : 'BW'}
                      </span>

                      {/* Nghỉ */}
                      <span style={{ fontFamily: 'var(--body-mono)', fontSize: '12px', color: 'var(--body-text-muted)' }}>
                        {item.rest_seconds || 90}s
                      </span>

                      {/* Xóa */}
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'transparent',
                          color: '#B5B4AE',
                          display: 'grid',
                          placeItems: 'center',
                          cursor: 'pointer'
                        }}
                        title="Xoá bài tập"
                      >
                        <AppIcon name="trash" size={14} />
                      </button>
                    </div>
                  );
                })}

                {/* Nút dashed thêm bài */}
                {!showPicker && (
                  <button
                    type="button"
                    className="body-routine-dashed-btn"
                    onClick={() => setShowPicker(true)}
                  >
                    <AppIcon name="plus" size={14} />
                    <span>Thêm bài tập vào {activeDay.short}</span>
                  </button>
                )}

                {/* Inline Exercise Picker */}
                {showPicker && (
                  <div style={{
                    margin: '12px 0 16px',
                    padding: '14px',
                    borderRadius: '12px',
                    background: 'var(--body-accent-tint)',
                    border: '1px solid var(--body-accent-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        flex: 1,
                        height: '34px',
                        borderRadius: '9px',
                        background: 'var(--body-card-bg)',
                        border: '1px solid var(--body-border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '0 11px',
                        color: 'var(--body-text-muted)'
                      }}>
                        <AppIcon name="magnifyingGlass" size={14} />
                        <input
                          type="text"
                          placeholder="Tìm trong thư viện bài tập..."
                          value={pickerSearch}
                          onChange={e => setPickerSearch(e.target.value)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            outline: 'none',
                            width: '100%',
                            fontSize: '12.5px',
                            color: 'var(--body-text-main)'
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPicker(false)}
                        style={{
                          height: '34px',
                          padding: '0 12px',
                          borderRadius: '9px',
                          border: 'none',
                          background: 'var(--body-shell-bg)',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          color: 'var(--body-text-sub)',
                          cursor: 'pointer'
                        }}
                      >
                        Đóng
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                      {filteredPicker.map(ex => (
                        <button
                          key={ex.key}
                          type="button"
                          onClick={() => handleAddExercise(ex)}
                          style={{
                            height: '32px',
                            padding: '0 11px',
                            borderRadius: '8px',
                            background: 'var(--body-card-bg)',
                            border: '1px solid var(--body-border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '7px',
                            fontSize: '12px',
                            fontWeight: 500,
                            color: 'var(--body-text-main)',
                            cursor: 'pointer'
                          }}
                        >
                          <AppIcon name="plus" size={12} style={{ color: 'var(--body-accent)' }} />
                          <span>{ex.name}</span>
                          <span style={{ fontSize: '11px', color: 'var(--body-text-muted)' }}>
                            ({MUSCLE_MAP[ex.primary]?.name || ex.primary})
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Nút Bắt đầu buổi tập thuận tiện ở cuối bảng bài */}
                {!isPreviewing && dayItems.length > 0 && (
                  <div style={{ marginTop: '16px', marginBottom: '10px', display: 'flex', justifyContent: 'flex-start' }}>
                    <button
                      type="button"
                      onClick={() => onStartSession?.({
                        weekday: selectedDay,
                        day: selectedDay,
                        name: activeDay.name,
                        focus: activeDay.focus
                      })}
                      style={{
                        height: '42px',
                        padding: '0 20px',
                        borderRadius: '10px',
                        background: 'var(--body-accent)',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(105, 73, 232, 0.25)'
                      }}
                    >
                      <AppIcon name="play" size={15} weight="fill" />
                      <span>Bắt đầu buổi tập {activeDay.name} ngay ({dayItems.length} bài)</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Nếu là ngày nghỉ */
              <div style={{ flex: 1, padding: '12px 24px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{
                  maxWidth: '560px',
                  fontSize: '13.5px',
                  lineHeight: 1.6,
                  color: 'var(--body-text-sub)',
                  margin: 0
                }}>
                  {activeDay.note}
                </p>

                {!showPicker && (
                  <button
                    type="button"
                    onClick={() => setShowPicker(true)}
                    style={{
                      alignSelf: 'flex-start',
                      height: '36px',
                      padding: '0 14px',
                      borderRadius: '9px',
                      border: '1px solid var(--body-border-subtle)',
                      background: 'var(--body-card-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: 'var(--body-text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    <AppIcon name="plus" size={13} />
                    <span>Thêm bài tập nếu muốn tập bù</span>
                  </button>
                )}

                {showPicker && (
                  <div style={{
                    maxWidth: '560px',
                    padding: '14px',
                    borderRadius: '12px',
                    background: 'var(--body-accent-tint)',
                    border: '1px solid var(--body-accent-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Tìm bài tập tập bù..."
                        value={pickerSearch}
                        onChange={e => setPickerSearch(e.target.value)}
                        style={{
                          flex: 1,
                          height: '34px',
                          borderRadius: '8px',
                          border: '1px solid var(--body-border-subtle)',
                          padding: '0 10px',
                          fontSize: '12.5px',
                          outline: 'none',
                          background: 'var(--body-card-bg)',
                          color: 'var(--body-text-main)'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPicker(false)}
                        style={{
                          height: '34px',
                          padding: '0 12px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'var(--body-shell-bg)',
                          color: 'var(--body-text-sub)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Đóng
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                      {filteredPicker.map(ex => (
                        <button
                          key={ex.key}
                          type="button"
                          onClick={() => handleAddExercise(ex)}
                          style={{
                            height: '30px',
                            padding: '0 10px',
                            borderRadius: '7px',
                            background: 'var(--body-card-bg)',
                            border: '1px solid var(--body-border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12px',
                            color: 'var(--body-text-main)',
                            cursor: 'pointer'
                          }}
                        >
                          <AppIcon name="plus" size={11} style={{ color: 'var(--body-accent)' }} />
                          <span>{ex.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Dưới cùng: Toggle Tăng tiến tự động */}
            <div style={{
              margin: '0 24px 20px',
              padding: '14px 16px',
              borderRadius: '12px',
              background: 'var(--body-shell-bg)',
              display: 'flex',
              alignItems: 'center',
              gap: '14px'
            }}>
              <button
                type="button"
                role="switch"
                aria-checked={autoProgressState}
                onClick={toggleAutoProgress}
                disabled={isPreviewing}
                style={{
                  width: '40px',
                  height: '24px',
                  borderRadius: '12px',
                  background: autoProgressState ? 'var(--body-accent)' : '#C9C7C0',
                  position: 'relative',
                  flex: 'none',
                  cursor: isPreviewing ? 'not-allowed' : 'pointer',
                  border: 'none',
                  padding: 0,
                  transition: 'background 0.2s ease'
                }}
              >
                <span style={{
                  position: 'absolute',
                  top: '3px',
                  left: autoProgressState ? '19px' : '3px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '9px',
                  background: '#FFFFFF',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                  transition: 'left 0.2s ease'
                }} />
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                  Tăng tiến tự động (Progressive Overload)
                </span>
                <span style={{ fontSize: '12px', color: 'var(--body-text-sub)' }}>
                  Đạt đủ mọi set trong buổi tập thì buổi sau tự động +1 rep (-5s cho bài tính giây).
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>

      {/* ── GIAO DIỆN MOBILE CHUYÊN BIỆT (CHUẨN PROTOTYPE BODY - LỘ TRÌNH 390PX) ── */}
      <div className="body-routine-mobile-view">
        {/* 1. THẺ ĐEN LỘ TRÌNH HIỆN TẠI */}
        <div className="body-routine-card-dark">
          <div className="body-routine-dark-header">
            <span className="body-routine-dark-badge">ĐANG THEO</span>
            <span className="body-routine-dark-week">
              Tuần {currentWeekNumber} / {routineWeeksTotal}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 className="body-routine-dark-title" style={{ fontSize: '18px' }}>
                {routine?.name || 'Chưa chọn lộ trình'}
              </h3>
              {routine?.id && (
                <button
                  type="button"
                  onClick={() => setShowEditModal(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#9C9AA8',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'grid',
                    placeItems: 'center'
                  }}
                  title="Chỉnh sửa thông tin lộ trình"
                >
                  <AppIcon name="pencil" size={14} />
                </button>
              )}
            </div>
            <div className="body-routine-dark-sub">
              {routineWeeksTotal} tuần · {routine?.goal || 'Duy trì cơ bắp & tăng sức bền'}
            </div>
          </div>

          {/* Dải vạch tuần */}
          <div className="body-routine-week-bars" style={{ gap: '3px' }}>
            {Array.from({ length: routineWeeksTotal }).map((_, idx) => (
              <span
                key={idx}
                className={`body-routine-week-bar ${idx < currentWeekNumber ? 'active' : ''}`}
                style={{ height: '5px', borderRadius: '3px' }}
              />
            ))}
          </div>

          {/* Dòng tóm tắt chuẩn mobile */}
          <div style={{ fontSize: '12px', color: '#A9A7B4', lineHeight: 1.4 }}>
            {weekdaysData.filter(w => w.isTrain).length} buổi/tuần · {completedSessionsCount} buổi đã tập · đúng lịch 100%
          </div>
        </div>

        {/* 2. DẢI 7 NGÀY DẠNG NÚT MOBILE */}
        <div className="body-routine-mobile-days-strip">
          {weekdaysData.map(wd => {
            const isSelected = selectedDay === wd.day;
            return (
              <div
                key={wd.day}
                onClick={() => setSelectedDay(wd.day)}
                className={`body-routine-mobile-day-btn ${isSelected ? 'active' : ''}`}
              >
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: isSelected ? 'var(--body-accent)' : 'var(--body-text-sub)' }}>
                  {wd.label}
                </span>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: wd.dotColor,
                  flex: 'none'
                }} />
                <span style={{
                  fontSize: '9.5px',
                  fontWeight: 500,
                  color: isSelected ? 'var(--body-accent)' : 'var(--body-text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '44px',
                  textAlign: 'center'
                }}>
                  {wd.shortName || wd.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* 3. THẺ CHI TIẾT NGÀY TẬP */}
        <div style={{
          background: 'var(--body-card-bg)',
          border: '1px solid var(--body-card-border)',
          borderRadius: '18px',
          padding: '14px 16px 6px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingBottom: '10px' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--body-text-main)' }}>
              {activeDay.short} — Buổi {activeDay.name}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>
              {activeDay.isTrain ? `${dayItems.length} bài tập · ${activeDay.est}` : 'Ngày nghỉ phục hồi'}
            </span>
          </div>

          {activeDay.isTrain ? (
            <>
              {dayItems.map(item => {
                const exDef = BASE_EXERCISES.find(e => e.key === item.exercise_key);
                const muscleVn = MUSCLE_MAP[exDef?.primary]?.name || exDef?.primary || '';

                return (
                  <div key={item.id} className="body-routine-mobile-ex-row">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                      <span style={{
                        fontSize: '13.5px',
                        fontWeight: 600,
                        color: 'var(--body-text-main)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {exDef?.name || item.exercise_key}
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--body-text-muted)' }}>
                        {muscleVn ? `${muscleVn} · ` : ''}{item.unit === 's' ? 'Set × Giây' : 'Set × Rep'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div className="body-routine-mobile-counter">
                        <button
                          type="button"
                          className="body-routine-mobile-counter-btn"
                          onClick={() => handleStepChange(item, -1)}
                          title="Giảm mục tiêu"
                        >
                          <AppIcon name="minus" size={11} />
                        </button>
                        <span
                          className="body-routine-mobile-counter-val"
                          onClick={() => handleSetChange(item, 1)}
                          title="Nhấn để tăng số hiệp"
                          style={{ cursor: 'pointer' }}
                        >
                          {item.target_sets} × {item.target_val}{item.unit === 's' ? 's' : ''}
                        </span>
                        <button
                          type="button"
                          className="body-routine-mobile-counter-btn"
                          onClick={() => handleStepChange(item, 1)}
                          title="Tăng mục tiêu"
                        >
                          <AppIcon name="plus" size={11} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          border: 'none',
                          background: 'transparent',
                          color: '#B5B4AE',
                          display: 'grid',
                          placeItems: 'center',
                          cursor: 'pointer',
                          padding: 0
                        }}
                        title="Xoá bài tập"
                      >
                        <AppIcon name="trash" size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Nút Thêm bài tập dạng inline text tím */}
              {!showPicker && (
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  style={{
                    minHeight: '46px',
                    borderTop: '1px solid var(--body-card-border)',
                    borderBottom: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--body-accent)',
                    cursor: 'pointer',
                    padding: '8px 0',
                    width: '100%'
                  }}
                >
                  <AppIcon name="plusCircle" size={16} />
                  <span>Thêm bài tập</span>
                </button>
              )}

              {/* Nút to tím Bắt đầu buổi tập này */}
              {!isPreviewing && dayItems.length > 0 && (
                <div style={{ padding: '12px 0 8px' }}>
                  <button
                    type="button"
                    onClick={() => onStartSession?.({
                      weekday: selectedDay,
                      day: selectedDay,
                      name: activeDay.name,
                      focus: activeDay.focus
                    })}
                    style={{
                      width: '100%',
                      height: '42px',
                      borderRadius: '11px',
                      background: 'var(--body-accent)',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(105, 73, 232, 0.25)'
                    }}
                  >
                    <AppIcon name="play" size={14} weight="fill" />
                    <span>Bắt đầu buổi tập này</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '4px 0 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '13px', lineHeight: 1.55, color: 'var(--body-text-sub)' }}>
                {activeDay.note}
              </span>
              {!showPicker && (
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  style={{
                    alignSelf: 'flex-start',
                    height: '32px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--body-border-subtle)',
                    background: 'var(--body-shell-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--body-text-main)',
                    cursor: 'pointer'
                  }}
                >
                  <AppIcon name="plus" size={12} />
                  <span>Thêm bài tập tập bù</span>
                </button>
              )}
            </div>
          )}

          {/* Inline Exercise Picker cho Mobile */}
          {showPicker && (
            <div style={{
              margin: '8px 0 12px',
              padding: '12px',
              borderRadius: '12px',
              background: 'var(--body-accent-tint)',
              border: '1px solid var(--body-accent-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="Tìm bài tập..."
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  style={{
                    flex: 1,
                    height: '32px',
                    borderRadius: '8px',
                    border: '1px solid var(--body-border-subtle)',
                    padding: '0 10px',
                    fontSize: '12px',
                    outline: 'none',
                    background: 'var(--body-card-bg)',
                    color: 'var(--body-text-main)'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPicker(false)}
                  style={{
                    height: '32px',
                    padding: '0 10px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--body-shell-bg)',
                    color: 'var(--body-text-sub)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Đóng
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', maxHeight: '160px', overflowY: 'auto' }}>
                {filteredPicker.map(ex => (
                  <button
                    key={ex.key}
                    type="button"
                    onClick={() => handleAddExercise(ex)}
                    style={{
                      height: '30px',
                      padding: '0 9px',
                      borderRadius: '7px',
                      background: 'var(--body-card-bg)',
                      border: '1px solid var(--body-border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '11.5px',
                      color: 'var(--body-text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    <AppIcon name="plus" size={11} style={{ color: 'var(--body-accent)' }} />
                    <span>{ex.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 4. CARD TĂNG TIẾN TỰ ĐỘNG */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 14px',
          background: 'var(--body-card-bg)',
          border: '1px solid var(--body-card-border)',
          borderRadius: '16px'
        }}>
          <button
            type="button"
            role="switch"
            aria-checked={autoProgressState}
            onClick={toggleAutoProgress}
            disabled={isPreviewing}
            style={{
              width: '40px',
              height: '24px',
              borderRadius: '12px',
              background: autoProgressState ? 'var(--body-accent)' : '#C9C7C0',
              position: 'relative',
              flex: 'none',
              cursor: isPreviewing ? 'not-allowed' : 'pointer',
              border: 'none',
              padding: 0,
              transition: 'background 0.2s ease'
            }}
          >
            <span style={{
              position: 'absolute',
              top: '3px',
              left: autoProgressState ? '19px' : '3px',
              width: '18px',
              height: '18px',
              borderRadius: '9px',
              background: '#FFFFFF',
              boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
              transition: 'left 0.2s ease'
            }} />
          </button>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-main)' }}>
              Tăng tiến tự động
            </span>
            <span style={{ fontSize: '11.5px', color: 'var(--body-text-muted)' }}>
              Đạt đủ mỗi set thì buổi sau +1 rep
            </span>
          </div>
        </div>

        {/* 5. DẢI MẪU CÓ SẴN (CUỘN NGANG) */}
        <div style={{
          fontFamily: 'var(--body-mono)',
          fontSize: '10.5px',
          letterSpacing: '0.09em',
          color: 'var(--body-text-muted)',
          fontWeight: 600,
          padding: '4px 2px 0'
        }}>
          MẪU CÓ SẴN
        </div>

        <div className="body-routine-mobile-tpls-scroll">
          {(routineTemplates || []).map(t => {
            const isSelectedTpl = previewTemplate?.key === t.key;
            return (
              <div
                key={t.key}
                onClick={() => handleStartPreview(t)}
                style={{
                  width: '200px',
                  flex: 'none',
                  background: 'var(--body-card-bg)',
                  border: isSelectedTpl ? '1.5px solid var(--body-accent)' : '1px solid var(--body-card-border)',
                  borderRadius: '14px',
                  padding: '13px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  boxSizing: 'border-box',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                    {t.name}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 5px',
                    borderRadius: '5px',
                    background: 'var(--body-accent-soft)',
                    color: 'var(--body-accent)',
                    fontWeight: 600
                  }}>
                    {t.weeks} tuần
                  </span>
                </div>
                <span style={{ fontSize: '11.5px', color: 'var(--body-text-muted)', lineHeight: 1.35 }}>
                  {t.days?.length || 3} buổi/tuần · {t.goal}
                </span>
              </div>
            );
          })}
        </div>
      </div>

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
                            const ex = BASE_EXERCISES.find(e => e.key === it.exercise_key);

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
                    onClick={() => {
                      if (window.confirm(`Bạn có chắc muốn xoá lộ trình "${routine.name}"?`)) {
                        onDeleteRoutine?.(routine.id);
                        setShowEditModal(false);
                      }
                    }}
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
