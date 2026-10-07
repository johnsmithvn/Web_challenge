import { useState, useEffect, useMemo } from 'react';
import AppIcon from '../AppIcon';
import BASE_EXERCISES from '../../data/body-exercises.json';
import ROUTINE_TEMPLATES from '../../data/body-routine-templates.json';
import MUSCLE_MAP from '../../data/body-muscles.json';
import { DAY_TYPE_COLORS, stepOfUnit } from '../../utils/workoutLogic';

const WEEKS_TOTAL = 8;

const BASE_WEEKDAY_DEFS = [
  { day: 1, label: 'T2', short: 'Thứ 2', defaultName: 'Chân', defaultType: 'Chân' },
  { day: 2, label: 'T3', short: 'Thứ 3', defaultName: 'Đẩy', defaultType: 'Đẩy' },
  { day: 3, label: 'T4', short: 'Thứ 4', defaultName: 'Kéo', defaultType: 'Kéo' },
  { day: 4, label: 'T5', short: 'Thứ 5', defaultName: 'Nghỉ', defaultType: null },
  { day: 5, label: 'T6', short: 'Thứ 6', defaultName: 'Toàn thân', defaultType: 'Toàn thân' },
  { day: 6, label: 'T7', short: 'Thứ 7', defaultName: 'Nghỉ', defaultType: null },
  { day: 7, label: 'CN', short: 'Chủ Nhật', defaultName: 'Check-in', defaultType: null }
];

export default function RoutineScreen({
  routine,
  routineItems = [],
  routineTemplates = ROUTINE_TEMPLATES,
  onCreateRoutineFromTemplate,
  onStartSession,
  onUpdateTarget,
  onUpdateSets,
  onAddExercise,
  onDeleteExercise,
  onToggleAutoProgress
}) {
  const [selectedDay, setSelectedDay] = useState(2); // Thứ 3 mặc định
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [localItems, setLocalItems] = useState(routineItems);
  const [autoProgressState, setAutoProgressState] = useState(routine?.auto_progress ?? true);

  // Sync localItems whenever routineItems prop updates from database
  useEffect(() => {
    setLocalItems(routineItems);
  }, [routineItems]);

  useEffect(() => {
    if (routine) {
      setAutoProgressState(routine.auto_progress ?? true);
    }
  }, [routine]);

  // Dynamically compute weekday metrics from actual items
  const weekdaysData = useMemo(() => {
    return BASE_WEEKDAY_DEFS.map(def => {
      const items = localItems.filter(item => item.weekday === def.day);
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
        return {
          day: def.day,
          label: def.label,
          short: def.short,
          name: dayName,
          meta: `${items.length} bài · ${totalSets} set`,
          est: `~${estMinutes} phút`,
          type: def.defaultType || dayName,
          focus: muscles.join(', ') || 'Cơ bắp toàn diện'
        };
      }
      return {
        day: def.day,
        label: def.label,
        short: def.short,
        name: def.day === 7 ? 'Check-in' : 'Nghỉ',
        meta: def.day === 7 ? 'Cân sáng, eo' : 'Phục hồi',
        est: '',
        type: null,
        note: def.day === 7
          ? 'Đo vòng eo, cân vào buổi sáng sau khi ngủ dậy để theo dõi tiến độ tuần.'
          : 'Nghỉ ngơi, đi bộ nhẹ hoặc giãn cơ 15 phút. Cho phép sợi cơ tổng hợp lại glycogen.'
      };
    });
  }, [localItems]);

  const activeTrainDaysCount = useMemo(() => {
    return new Set(localItems.map(it => it.weekday)).size;
  }, [localItems]);

  const activeDay = weekdaysData.find(w => w.day === selectedDay) || weekdaysData[1];
  const dayItems = localItems.filter(item => item.weekday === selectedDay);

  const handleStepChange = (item, delta) => {
    const step = stepOfUnit(item.unit);
    const nextVal = Math.max(step, Number(item.target_val) + delta * step);
    setLocalItems(prev => prev.map(it => it.id === item.id ? { ...it, target_val: nextVal } : it));
    onUpdateTarget?.(item.id, nextVal);
  };

  const handleSetChange = (item, delta) => {
    const nextSets = Math.max(1, Number(item.target_sets) + delta);
    setLocalItems(prev => prev.map(it => it.id === item.id ? { ...it, target_sets: nextSets } : it));
    onUpdateSets?.(item.id, nextSets);
  };

  const handleDeleteItem = (itemId) => {
    setLocalItems(prev => prev.filter(it => it.id !== itemId));
    onDeleteExercise?.(itemId);
  };

  const handleAddExercise = (exercise) => {
    onAddExercise?.({
      weekday: selectedDay,
      dayName: activeDay.name,
      exerciseKey: exercise.key,
      name: exercise.name,
      sets: exercise.defaultSets || 3,
      targetVal: exercise.defaultTarget || 12,
      unit: exercise.metric || 'rep',
      kg: exercise.defaultKg != null ? exercise.defaultKg : (exercise.equipment === 'db' ? 5 : 0),
      restSeconds: 60
    });
    setShowPicker(false);
  };

  const toggleAutoProgress = () => {
    const next = !autoProgressState;
    setAutoProgressState(next);
    onToggleAutoProgress?.(routine?.id, next);
  };

  const filteredPicker = BASE_EXERCISES.filter(e =>
    !pickerSearch
    || e.name.toLowerCase().includes(pickerSearch.toLowerCase())
    || (e.primary && e.primary.toLowerCase().includes(pickerSearch.toLowerCase()))
  );

  // If user does not have an active routine yet: Onboarding view with templates
  if (!routine) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: '32px 16px 16px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--body-accent-soft)', color: 'var(--body-accent)', display: 'grid', placeItems: 'center', margin: '0 auto 16px auto' }}>
            <AppIcon name="barbell" size={28} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--body-text-main)' }}>
            Chọn lộ trình rèn luyện
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--body-text-muted)', margin: 0, lineHeight: 1.5 }}>
            Bắt đầu với một lộ trình thiết kế chuẩn để theo dõi số set, rep, tạ và tự động tăng tiến mỗi tuần.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {(routineTemplates || []).map((tmpl) => (
            <div
              key={tmpl.key}
              className="body-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px',
                border: '1.5px solid var(--body-card-border)',
                transition: 'border-color 0.2s ease'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className="body-badge body-badge-accent">
                    {tmpl.weeks} tuần
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>
                    {tmpl.days?.length || 3} buổi/tuần
                  </span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--body-text-main)' }}>
                  {tmpl.name}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--body-text-sub)', margin: 0, lineHeight: 1.5 }}>
                  {tmpl.goal || tmpl.description}
                </p>
              </div>

              <button
                className="body-btn body-btn-primary"
                onClick={() => onCreateRoutineFromTemplate?.(tmpl.key)}
                style={{ width: '100%', height: '38px', gap: '6px' }}
              >
                <span>Bắt đầu lộ trình này</span>
                <AppIcon name="arrowRight" size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', alignItems: 'start' }}>
      {/* ── CỘT TRÁI: THÔNG TIN LỘ TRÌNH (MAX 340px) ─────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '340px', width: '100%' }}>

        {/* Card Đang theo */}
        <div className="body-card-dark" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--body-mono)', fontSize: '10.5px', letterSpacing: '0.09em', color: '#9C9AA8', fontWeight: 600 }}>
              ĐANG THEO
            </span>
            <span style={{ fontFamily: 'var(--body-mono)', fontSize: '11.5px', color: '#B3A2F0', fontWeight: 600 }}>
              Kế hoạch {routine?.weeks || WEEKS_TOTAL} tuần
            </span>
          </div>

          <div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 5px 0', color: '#FFFFFF' }}>
              {routine?.name || 'Giảm mỡ giữ cơ'}
            </h3>
            <div style={{ fontSize: '12.5px', color: '#9C9AA8' }}>
              Mục tiêu: {routine?.goal || 'Duy trì cơ bắp & tăng sức bền'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="body-badge body-badge-accent">
              {activeTrainDaysCount} buổi / tuần
            </span>
            <span style={{ fontSize: '12px', color: '#9C9AA8' }}>
              {autoProgressState ? 'Tự tăng tiến (+1 rep)' : 'Cố định mục tiêu'}
            </span>
          </div>
        </div>

        {/* Lịch mẫu có sẵn */}
        <div className="body-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--body-text-main)' }}>
            Đổi sang mẫu khác
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(routineTemplates || []).map((t) => (
              <div
                key={t.key}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid var(--body-card-border)',
                  background: 'var(--body-card-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}
              >
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--body-text-muted)' }}>
                    {t.weeks} tuần · {t.days?.length || 3} buổi/tuần
                  </div>
                </div>

                <button
                  className="body-btn body-btn-secondary"
                  onClick={() => onCreateRoutineFromTemplate?.(t.key)}
                  style={{ height: '28px', padding: '0 10px', fontSize: '11.5px' }}
                >
                  Chọn
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── CỘT PHẢI: CHI TIẾT THEO THỨ (CURRENT BLUEPRINT) ──────── */}
      <div className="body-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* 7-Days Strip Navigation */}
        <div className="body-days-strip">
          {weekdaysData.map((wd) => {
            const isSelected = selectedDay === wd.day;
            const hasWorkout = wd.type != null;
            return (
              <button
                key={wd.day}
                onClick={() => setSelectedDay(wd.day)}
                className={`body-day-chip ${isSelected ? 'active' : ''}`}
                style={{
                  border: isSelected ? '1.5px solid var(--body-accent)' : undefined,
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span className="body-day-chip-label">{wd.label}</span>
                  {hasWorkout && (
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: DAY_TYPE_COLORS[wd.type] || 'var(--body-accent)'
                    }} />
                  )}
                </div>
                <span className="body-day-chip-name">{wd.name}</span>
                <span className="body-day-chip-meta">{wd.meta}</span>
              </button>
            );
          })}
        </div>

        {/* Header Ngày đang chọn */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--body-text-main)' }}>
                {activeDay.short} — Buổi {activeDay.name}
              </h3>
              {activeDay.type && (
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: DAY_TYPE_COLORS[activeDay.type] ? `${DAY_TYPE_COLORS[activeDay.type]}22` : 'var(--body-accent-soft)',
                  color: DAY_TYPE_COLORS[activeDay.type] || 'var(--body-accent)',
                  fontSize: '11.5px',
                  fontWeight: 600
                }}>
                  {activeDay.type}
                </span>
              )}
            </div>
            {activeDay.focus && (
              <div style={{ fontSize: '12.5px', color: 'var(--body-text-muted)', marginTop: '2px' }}>
                Trọng tâm: {activeDay.focus}
              </div>
            )}
          </div>

          {activeDay.type && (
            <button
              className="body-btn body-btn-accent"
              onClick={() => onStartSession?.({ weekday: selectedDay, day: selectedDay, name: activeDay.name, focus: activeDay.focus })}
              style={{ height: '36px', gap: '6px' }}
            >
              <AppIcon name="play" size={14} />
              <span>Bắt đầu buổi tập này</span>
            </button>
          )}
        </div>

        {/* Danh sách bài tập của thứ */}
        {dayItems.length > 0 ? (
          <div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--body-card-border)', color: 'var(--body-text-muted)', textAlign: 'left', height: '36px' }}>
                    <th style={{ width: '32px' }}></th>
                    <th style={{ paddingBottom: '8px' }}>BÀI TẬP</th>
                    <th style={{ paddingBottom: '8px' }}>LOẠI</th>
                    <th style={{ paddingBottom: '8px', textAlign: 'center' }}>SỐ SET</th>
                    <th style={{ paddingBottom: '8px', textAlign: 'center' }}>MỤC TIÊU</th>
                    <th style={{ paddingBottom: '8px', textAlign: 'center' }}>MỨC TẠ</th>
                    <th style={{ paddingBottom: '8px', textAlign: 'center' }}>NGHỈ</th>
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {dayItems.map((item) => {
                    const exDef = BASE_EXERCISES.find(e => e.key === item.exercise_key);
                    const muscleVn = MUSCLE_MAP[exDef?.primary]?.name || exDef?.primary || '';

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--body-card-border)', height: '56px' }}>
                        <td>
                          <span style={{ color: 'var(--body-text-muted)', display: 'grid', placeItems: 'center' }}>
                            <AppIcon name="dotsSix" size={16} />
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--body-text-main)' }}>
                            {exDef?.name || item.exercise_key}
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--body-text-muted)' }}>
                            {muscleVn}
                          </div>
                        </td>
                        <td>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: 'var(--body-accent-soft)',
                            color: 'var(--body-accent)',
                            fontSize: '11.5px',
                            fontWeight: 600
                          }}>
                            {item.unit === 's' ? 'Set × Giây' : 'Set × Rep'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', height: '32px', border: '1px solid var(--body-card-border)', borderRadius: '8px', overflow: 'hidden' }}>
                            <button
                              onClick={() => handleSetChange(item, -1)}
                              style={{ width: '28px', height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--body-text-sub)' }}
                            >
                              −
                            </button>
                            <span style={{ width: '26px', textAlign: 'center', fontWeight: 600, fontFamily: 'var(--body-mono)', fontSize: '13px' }}>
                              {item.target_sets}
                            </span>
                            <button
                              onClick={() => handleSetChange(item, 1)}
                              style={{ width: '28px', height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--body-text-sub)' }}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            height: '32px',
                            border: '1px solid var(--body-accent-border)',
                            background: 'var(--body-accent-tint)',
                            borderRadius: '8px',
                            overflow: 'hidden'
                          }}>
                            <button
                              onClick={() => handleStepChange(item, -1)}
                              style={{ width: '28px', height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--body-accent)', fontWeight: 700 }}
                            >
                              −
                            </button>
                            <span style={{ minWidth: '46px', textAlign: 'center', fontWeight: 700, fontFamily: 'var(--body-mono)', fontSize: '13px', color: 'var(--body-accent)' }}>
                              {item.target_val} <span style={{ fontSize: '10.5px', fontWeight: 400, color: 'var(--body-text-muted)' }}>{item.unit}</span>
                            </span>
                            <button
                              onClick={() => handleStepChange(item, 1)}
                              style={{ width: '28px', height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--body-accent)', fontWeight: 700 }}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--body-mono)', fontSize: '12.5px', color: 'var(--body-text-sub)' }}>
                          {item.kg ? `${item.kg} kg` : '—'}
                        </td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--body-mono)', fontSize: '12px', color: 'var(--body-text-muted)' }}>
                          {item.rest_seconds}s
                        </td>
                        <td>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            style={{ width: '28px', height: '28px', border: 'none', background: 'transparent', borderRadius: '6px', color: 'var(--body-text-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                            title="Xóa bài"
                          >
                            <AppIcon name="trash" size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Nút Thêm bài tập vào thứ (nếu chưa mở picker) */}
            {!showPicker && (
              <button
                onClick={() => setShowPicker(true)}
                style={{
                  width: '100%',
                  marginTop: '16px',
                  height: '42px',
                  borderRadius: '10px',
                  border: '1.5px dashed var(--body-accent-border)',
                  background: 'transparent',
                  color: 'var(--body-accent)',
                  fontWeight: 600,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <AppIcon name="plus" size={14} />
                <span>Thêm bài tập vào {activeDay.short}</span>
              </button>
            )}
          </div>
        ) : (
          <div style={{ padding: '24px', borderRadius: '12px', background: 'var(--body-shell-bg)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '14px', color: 'var(--body-text-sub)', lineHeight: 1.6 }}>
              {activeDay.note || 'Không có bài tập nào được lên lịch cho ngày này.'}
            </div>
            {!showPicker && (
              <button
                onClick={() => setShowPicker(true)}
                style={{
                  alignSelf: 'flex-start',
                  height: '34px',
                  padding: '0 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--body-card-border)',
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
                <AppIcon name="plus" size={13} />
                <span>Thêm bài tập nếu muốn tập bù</span>
              </button>
            )}
          </div>
        )}

        {/* Khối Picker dùng chung cho cả ngày có bài tập và ngày trống */}
        {showPicker && (
          <div style={{ marginTop: '8px', padding: '14px', borderRadius: '12px', background: 'var(--body-accent-tint)', border: '1px solid var(--body-accent-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="text"
                placeholder="Tìm trong thư viện bài tập..."
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
                style={{
                  flex: 1,
                  height: '36px',
                  borderRadius: '8px',
                  border: '1px solid var(--body-card-border)',
                  padding: '0 12px',
                  fontSize: '13px',
                  background: 'var(--body-card-bg)',
                  color: 'var(--body-text-main)',
                  outline: 'none'
                }}
              />
              <button
                onClick={() => setShowPicker(false)}
                style={{ height: '36px', padding: '0 12px', borderRadius: '8px', border: 'none', background: 'var(--body-shell-bg)', color: 'var(--body-text-sub)', fontWeight: 600, cursor: 'pointer' }}
              >
                Đóng
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
              {filteredPicker.map(ex => (
                <button
                  key={ex.key}
                  onClick={() => handleAddExercise(ex)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: 'var(--body-card-bg)',
                    border: '1px solid var(--body-card-border)',
                    color: 'var(--body-text-main)',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <AppIcon name="plus" size={12} style={{ color: 'var(--body-accent)' }} />
                  <span>{ex.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--body-text-muted)' }}>({MUSCLE_MAP[ex.primary]?.name || ex.primary})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Khối Tăng tiến tự động (Auto-progression) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '14px 18px',
          borderRadius: '12px',
          background: 'var(--body-shell-bg)',
          border: '1px solid var(--body-card-border)',
          marginTop: 'auto'
        }}>
          {/* Accessible Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={autoProgressState}
            onClick={toggleAutoProgress}
            style={{
              width: '42px',
              height: '24px',
              borderRadius: '12px',
              background: autoProgressState ? 'var(--body-accent)' : '#C9C7C0',
              position: 'relative',
              flex: 'none',
              cursor: 'pointer',
              border: 'none',
              padding: 0,
              transition: 'background 0.2s ease'
            }}
          >
            <div style={{
              width: '18px',
              height: '18px',
              borderRadius: '9px',
              background: '#FFFFFF',
              position: 'absolute',
              top: '3px',
              left: autoProgressState ? '21px' : '3px',
              transition: 'left 0.2s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.25)'
            }} />
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--body-text-main)' }}>
              Tăng tiến tự động (Progressive Overload)
            </span>
            <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>
              Đạt đủ mọi set trong buổi tập thì buổi sau tự động +1 rep (+5s cho bài tính giây).
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
