import { useState, useMemo, lazy, Suspense } from 'react';
import AppIcon from '../AppIcon';
import BASE_EXERCISES from '../../data/body-exercises.json';
import { useWorkouts } from '../../hooks/useWorkouts';
import { estimateRecoveryState } from '../../utils/workoutLogic';

const MuscleBodyCanvas = lazy(() => import('./MuscleBodyCanvas'));

const MUSCLE_ANATOMY = [
  {
    id: 'chest',
    vn: 'Ngực',
    en: 'Pectoralis major · minor',
    side: 'front',
    desc: 'Cơ ngực lớn và ngực bé, phủ phía trước lồng ngực từ xương đòn đến xương ức.',
    fn: 'Đẩy tay ra trước, khép tay vào thân, hỗ trợ xoay trong khớp vai.',
    sec: ['shoulders', 'triceps'],
    baseTargetSets: 12
  },
  {
    id: 'shoulders',
    vn: 'Vai',
    en: 'Deltoids',
    side: 'front',
    desc: 'Cơ delta gồm ba bó trước, giữa và sau, bao quanh khớp vai.',
    fn: 'Nâng tay ra trước, sang ngang và ra sau; giữ vững khớp vai khi đẩy và kéo.',
    sec: ['chest', 'traps', 'triceps'],
    baseTargetSets: 12
  },
  {
    id: 'biceps',
    vn: 'Tay trước',
    en: 'Biceps brachii',
    side: 'front',
    desc: 'Cơ nhị đầu ở mặt trước cánh tay trên, gồm đầu dài và đầu ngắn.',
    fn: 'Gập khuỷu tay và xoay ngửa cẳng tay; hỗ trợ mọi động tác kéo.',
    sec: ['forearms', 'lats'],
    baseTargetSets: 9
  },
  {
    id: 'forearms',
    vn: 'Cẳng tay',
    en: 'Forearm flexors · extensors',
    side: 'front',
    desc: 'Nhóm cơ gấp và duỗi cổ tay, ngón tay ở cẳng tay.',
    fn: 'Cầm nắm, gập và duỗi cổ tay; quyết định sức bám khi treo xà và kéo.',
    sec: ['biceps'],
    baseTargetSets: 6
  },
  {
    id: 'abs',
    vn: 'Bụng',
    en: 'Rectus abdominis',
    side: 'front',
    desc: 'Cơ thẳng bụng chạy dọc phía trước bụng, chia thành các múi.',
    fn: 'Gập thân, giữ vững cột sống và áp lực ổ bụng khi nâng vật nặng.',
    sec: ['obliques', 'lowerback'],
    baseTargetSets: 10
  },
  {
    id: 'obliques',
    vn: 'Liên sườn',
    en: 'Obliques',
    side: 'front',
    desc: 'Cơ chéo trong và chéo ngoài ở hai bên hông, dưới xương sườn.',
    fn: 'Xoay và nghiêng thân, chống xoay khi mang vật một bên.',
    sec: ['abs'],
    baseTargetSets: 6
  },
  {
    id: 'quads',
    vn: 'Đùi trước',
    en: 'Quadriceps',
    side: 'front',
    desc: 'Bốn đầu cơ ở mặt trước đùi, nhóm cơ lớn nhất của chi dưới.',
    fn: 'Duỗi gối, hỗ trợ gập hông; chính cho squat, leo dốc, nhảy.',
    sec: ['glutes', 'calves'],
    baseTargetSets: 14
  },
  {
    id: 'traps',
    vn: 'Cầu vai',
    en: 'Trapezius',
    side: 'back',
    desc: 'Cơ thang trải từ gáy xuống giữa lưng, nối hai bả vai.',
    fn: 'Nhún vai, kéo bả vai vào trong và xuống; giữ tư thế cổ vai.',
    sec: ['shoulders', 'lats'],
    baseTargetSets: 6
  },
  {
    id: 'lats',
    vn: 'Xô',
    en: 'Latissimus dorsi',
    side: 'back',
    desc: 'Cơ lưng rộng nhất, nối cánh tay với cột sống và khung chậu.',
    fn: 'Kéo tay xuống và về sau, khép tay vào thân; tạo độ rộng lưng V-taper.',
    sec: ['biceps', 'traps'],
    baseTargetSets: 12
  },
  {
    id: 'triceps',
    vn: 'Tay sau',
    en: 'Triceps brachii',
    side: 'back',
    desc: 'Cơ tam đầu ở mặt sau cánh tay trên, chiếm 2/3 khối lượng cánh tay.',
    fn: 'Duỗi khuỷu tay; tham gia toàn bộ các động tác đẩy ngực và vai.',
    sec: ['chest', 'shoulders'],
    baseTargetSets: 9
  },
  {
    id: 'lowerback',
    vn: 'Lưng dưới',
    en: 'Erector spinae',
    side: 'back',
    desc: 'Cơ dựng sống chạy dọc hai bên cột sống thắt lưng.',
    fn: 'Duỗi thân, giữ lưng thẳng khi cúi, nâng và đứng lâu.',
    sec: ['glutes', 'hamstrings'],
    baseTargetSets: 6
  },
  {
    id: 'glutes',
    vn: 'Mông',
    en: 'Gluteus maximus · medius',
    side: 'back',
    desc: 'Cơ mông lớn, nhỡ và bé; cơ mông lớn là cơ phát lực mạnh nhất.',
    fn: 'Duỗi hông, dạng chân, giữ vững khung chậu.',
    sec: ['quads', 'hamstrings', 'lowerback'],
    baseTargetSets: 12
  },
  {
    id: 'hamstrings',
    vn: 'Đùi sau',
    en: 'Hamstrings',
    side: 'back',
    desc: 'Ba cơ ở mặt sau đùi, chạy từ ụ ngồi đến dưới gối.',
    fn: 'Gập gối, duỗi hông; giữ ổn định khớp gối khi chạy và nhảy.',
    sec: ['glutes', 'lowerback', 'calves'],
    baseTargetSets: 10
  },
  {
    id: 'calves',
    vn: 'Bắp chân',
    en: 'Gastrocnemius · soleus',
    side: 'back',
    desc: 'Cơ bụng chân và cơ dép ở mặt sau cẳng chân.',
    fn: 'Kiễng gót, đẩy người về trước khi đi, chạy và nhảy.',
    sec: ['hamstrings'],
    baseTargetSets: 8
  }
];

const EQUIPMENT_LABELS = {
  all: 'Tất cả',
  bw: 'Không dụng cụ',
  db: 'Tạ đơn',
  bar: 'Xà & dây',
  gym: 'Máy gym'
};

const DAYS_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export default function MuscleMapScreen({ onSelectExercise }) {
  const { recentSets, exerciseMap, routineItems } = useWorkouts();

  const [selectedMuscleId, setSelectedMuscleId] = useState('chest');
  const [viewMode, setViewMode] = useState('group'); // 'group' | 'heat' | 'rec'
  const [sideView, setSideView] = useState('front'); // 'front' | 'back'
  const [selectedEquip, setSelectedEquip] = useState('all');
  const [now] = useState(() => Date.now());

  // Dynamically compute muscle sets, recovery, and PRs from real recentSets & routineItems
  const dynamicMuscles = useMemo(() => {
    const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;

    return MUSCLE_ANATOMY.map(m => {
      // Find matching sets targeting this muscle
      const matchingSets = (recentSets || []).filter(s => {
        // Bỏ qua set bị bỏ hoặc rỗng
        if (s.actual_val == null && s.weight == null && s.reps == null) return false;
        const info = exerciseMap?.get(s.exercise_key);
        const primary = info?.primary || info?.primary_muscle || '';
        const secondary = info?.secondary || info?.secondary_muscles || [];
        return primary === m.id || secondary.includes(m.id);
      });

      // Distribute sets across 7 weekdays (T2..CN = 0..6) chỉ trong 7 ngày gần nhất
      const days = [0, 0, 0, 0, 0, 0, 0];
      matchingSets.forEach(s => {
        if (!s.completed_at) return;
        const t = new Date(s.completed_at).getTime();
        if (Number.isNaN(t) || t < sevenDaysAgo) return;
        const d = new Date(s.completed_at);
        const jsDay = d.getDay();
        const idx = jsDay === 0 ? 6 : jsDay - 1;
        days[idx] += 1;
      });

      const currentSets = days.reduce((a, b) => a + b, 0);

      // Target sets from active routine items
      const scheduledItems = (routineItems || []).filter(it => {
        const info = exerciseMap?.get(it.exercise_key);
        const primary = info?.primary || info?.primary_muscle || '';
        return primary === m.id;
      });
      const routineTargetSets = scheduledItems.reduce((sum, it) => sum + (Number(it.target_sets) || 0), 0);
      const targetSets = routineTargetSets > 0 ? routineTargetSets : (m.baseTargetSets || 10);

      // Hours elapsed since last trained & best set for PR
      let hoursSinceLast = null;
      let prRecord = null;
      let maxT = 0;

      matchingSets.forEach(s => {
        if (s.completed_at) {
          const t = new Date(s.completed_at).getTime();
          if (!Number.isNaN(t) && t > maxT) maxT = t;
        }
      });

      if (maxT > 0) {
        hoursSinceLast = Math.max(0, Math.round((now - maxT) / (1000 * 3600)));

        let maxVal = 0;
        let bestSet = null;
        matchingSets.forEach(s => {
          const val = Number(s.actual_val || s.reps || 0);
          if (val > maxVal) {
            maxVal = val;
            bestSet = s;
          }
        });
        if (bestSet) {
          const exInfo = exerciseMap?.get(bestSet.exercise_key);
          const exName = exInfo?.name || bestSet.exercise_name || bestSet.exercise_key;
          const prDate = bestSet.completed_at
            ? new Date(bestSet.completed_at).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' })
            : 'Trước đây';
          prRecord = {
            exercise: exName,
            val: `${bestSet.actual_val || bestSet.reps || 0} ${bestSet.unit || 'rep'}${bestSet.kg ? ` · ${bestSet.kg}kg` : ''}`,
            date: prDate
          };
        }
      }

      const recovery = estimateRecoveryState(currentSets, hoursSinceLast);
      let recoveryLabel = 'Đã hồi phục 100%. Sẵn sàng tập luyện.';
      if (hoursSinceLast != null) {
        if (recovery === 'low') {
          recoveryLabel = hoursSinceLast < 24
            ? `Vừa tập hôm nay (${currentSets} set). Cần nghỉ ngơi hồi phục.`
            : `Đã tập ${hoursSinceLast}h trước. Đang trong giai đoạn mỏi cơ.`;
        } else if (recovery === 'mid') {
          recoveryLabel = `Đã tập ${hoursSinceLast}h trước. Đang hồi phục tốt.`;
        } else {
          recoveryLabel = `Đã tập ${hoursSinceLast}h trước. Sẵn sàng tập tiếp.`;
        }
      }

      return {
        ...m,
        targetSets,
        currentSets,
        days,
        recovery,
        recoveryLabel,
        pr: prRecord
      };
    });
  }, [recentSets, exerciseMap, routineItems, now]);

  const muscleMap = useMemo(() => {
    return Object.fromEntries(dynamicMuscles.map(m => [m.id, m]));
  }, [dynamicMuscles]);

  const selectedMuscle = muscleMap[selectedMuscleId] || dynamicMuscles[0];

  // Pick muscle and optionally flip camera side
  const handlePickMuscle = (id) => {
    setSelectedMuscleId(id);
    const target = muscleMap[id];
    if (target && target.side !== sideView) {
      setSideView(target.side);
    }
  };

  // Maps for 3D canvas
  const heatMap = useMemo(() => {
    return Object.fromEntries(
      dynamicMuscles.map(m => [m.id, Math.min(1, m.currentSets / (m.targetSets || 1))])
    );
  }, [dynamicMuscles]);

  const recoveryMap = useMemo(() => {
    return Object.fromEntries(
      dynamicMuscles.map(m => [m.id, m.recovery])
    );
  }, [dynamicMuscles]);

  // Exercises targeting this muscle
  const exercises = useMemo(() => {
    return BASE_EXERCISES.filter(e => {
      const matchMuscle = e.primary === selectedMuscle.id || (e.secondary || []).includes(selectedMuscle.id);
      const matchEquip = selectedEquip === 'all' || e.equipment === selectedEquip;
      return matchMuscle && matchEquip;
    });
  }, [selectedMuscle.id, selectedEquip]);

  // Color helper for 2D dots
  const getDotColor = (m) => {
    if (viewMode === 'heat') {
      const ratio = m.currentSets / m.targetSets;
      return ratio >= 1 ? '#C8361F' : ratio >= 0.7 ? '#E8804F' : ratio >= 0.35 ? '#F1C29C' : '#E6E0D8';
    }
    if (viewMode === 'rec') {
      return m.recovery === 'ready' ? '#3E9E68' : m.recovery === 'mid' ? '#E0A23C' : '#D2462B';
    }
    return m.id === selectedMuscleId ? '#6949E8' : (selectedMuscle.sec || []).includes(m.id) ? '#C4B6F4' : '#D2C7BC';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── TOP BAR: TIÊU ĐỀ & 3 CHẾ ĐỘ TÔ MÀU ──────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--body-text-main)' }}>
            Bản đồ cơ 3D
          </h2>
          <span style={{ fontSize: '13px', color: 'var(--body-text-muted)' }}>
            14 nhóm cơ · Tương tác 3D đa góc nhìn
          </span>
        </div>

        {/* 3 Color Mode Tabs */}
        <div style={{ display: 'flex', background: 'var(--body-shell-bg)', borderRadius: '9px', padding: '3px', border: '1px solid var(--body-card-border)' }}>
          {[
            { key: 'group', label: 'Nhóm cơ', icon: 'personSimple' },
            { key: 'heat', label: 'Mức tập 7 ngày', icon: 'fire' },
            { key: 'rec', label: 'Phục hồi', icon: 'heart' }
          ].map(m => {
            const on = viewMode === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setViewMode(m.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: on ? 'var(--body-card-bg)' : 'transparent',
                  color: on ? 'var(--body-text-main)' : 'var(--body-text-sub)',
                  fontSize: '12.5px',
                  fontWeight: on ? 600 : 500,
                  cursor: 'pointer',
                  boxShadow: on ? '0 1px 3px rgba(16,17,20,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <AppIcon name={m.icon} size={13} />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── STUDIO 3 CỘT: DANH SÁCH - 3D CANVAS - CHI TIẾT ───────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '240px minmax(0, 1fr) 390px',
        gap: '16px',
        alignItems: 'stretch'
      }}>

        {/* CỘT 1: DANH SÁCH 14 NHÓM CƠ (Trái) */}
        <div className="body-card" style={{ padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '680px', overflowY: 'auto' }}>
          <div style={{ padding: '4px 10px', fontSize: '11px', fontFamily: 'var(--body-mono)', fontWeight: 600, color: 'var(--body-text-muted)', letterSpacing: '0.06em' }}>
            MẶT TRƯỚC
          </div>
          {dynamicMuscles.filter(m => m.side === 'front').map(m => {
            const on = m.id === selectedMuscleId;
            const progress = Math.min(100, Math.round((m.currentSets / m.targetSets) * 100));
            return (
              <div
                key={m.id}
                onClick={() => handlePickMuscle(m.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '10px minmax(0, 1fr) auto',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  background: on ? 'var(--body-accent-soft)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease'
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: getDotColor(m) }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                  <span style={{ fontSize: '13px', fontWeight: on ? 600 : 500, color: on ? 'var(--body-accent)' : 'var(--body-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.vn}
                  </span>
                  <div style={{ height: '3px', borderRadius: '2px', background: 'var(--body-shell-bg)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: getDotColor(m) }} />
                  </div>
                </div>
                <span style={{ fontSize: '11px', fontFamily: 'var(--body-mono)', color: 'var(--body-text-muted)' }}>
                  {m.currentSets}/{m.targetSets}
                </span>
              </div>
            );
          })}

          <div style={{ padding: '14px 10px 4px', fontSize: '11px', fontFamily: 'var(--body-mono)', fontWeight: 600, color: 'var(--body-text-muted)', letterSpacing: '0.06em' }}>
            MẶT SAU
          </div>
          {dynamicMuscles.filter(m => m.side === 'back').map(m => {
            const on = m.id === selectedMuscleId;
            const progress = Math.min(100, Math.round((m.currentSets / m.targetSets) * 100));
            return (
              <div
                key={m.id}
                onClick={() => handlePickMuscle(m.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '10px minmax(0, 1fr) auto',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  background: on ? 'var(--body-accent-soft)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease'
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: getDotColor(m) }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                  <span style={{ fontSize: '13px', fontWeight: on ? 600 : 500, color: on ? 'var(--body-accent)' : 'var(--body-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.vn}
                  </span>
                  <div style={{ height: '3px', borderRadius: '2px', background: 'var(--body-shell-bg)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: getDotColor(m) }} />
                  </div>
                </div>
                <span style={{ fontSize: '11px', fontFamily: 'var(--body-mono)', color: 'var(--body-text-muted)' }}>
                  {m.currentSets}/{m.targetSets}
                </span>
              </div>
            );
          })}
        </div>

        {/* CỘT 2: 3D THREE.JS CANVAS (Giữa) */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: '520px' }}>
          <Suspense fallback={
            <div style={{ width: '100%', height: '100%', minHeight: '440px', display: 'grid', placeItems: 'center', background: 'var(--body-shell-bg)', borderRadius: '20px' }}>
              <span style={{ fontSize: '13px', color: 'var(--body-text-muted)', fontFamily: 'var(--body-mono)' }}>Đang tải mô hình 3D...</span>
            </div>
          }>
            <MuscleBodyCanvas
              selectedId={selectedMuscleId}
              onSelectMuscle={handlePickMuscle}
              viewSide={sideView}
              mode={viewMode}
              secondaryList={selectedMuscle.sec || []}
              heatMap={heatMap}
              recoveryMap={recoveryMap}
            />
          </Suspense>

          {/* Phím chuyển Mặt trước / Mặt sau góc trên trái */}
          <div style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            display: 'flex',
            background: 'color-mix(in srgb, var(--body-card-bg) 88%, transparent)',
            backdropFilter: 'blur(6px)',
            border: '1px solid var(--body-card-border)',
            borderRadius: '9px',
            padding: '3px',
            zIndex: 4
          }}>
            {[
              { key: 'front', label: 'Mặt trước' },
              { key: 'back', label: 'Mặt sau' }
            ].map(s => {
              const on = sideView === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setSideView(s.key)}
                  style={{
                    padding: '3px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: on ? 'var(--body-text-main)' : 'transparent',
                    color: on ? 'var(--body-bg)' : 'var(--body-text-sub)',
                    fontSize: '12px',
                    fontWeight: on ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Chú thích màu Legend góc dưới trái */}
          <div style={{
            position: 'absolute',
            left: '16px',
            bottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            padding: '10px 14px',
            background: 'color-mix(in srgb, var(--body-card-bg) 90%, transparent)',
            backdropFilter: 'blur(6px)',
            border: '1px solid var(--body-card-border)',
            borderRadius: '10px',
            zIndex: 4
          }}>
            {viewMode === 'group' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: '#6949E8' }} />
                  <span style={{ fontSize: '11.5px', color: 'var(--body-text-sub)' }}>Đang chọn</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: '#C4B6F4' }} />
                  <span style={{ fontSize: '11.5px', color: 'var(--body-text-sub)' }}>Cơ phụ trợ</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: '#D2C7BC' }} />
                  <span style={{ fontSize: '11.5px', color: 'var(--body-text-sub)' }}>Nhóm cơ khác</span>
                </div>
              </>
            )}
            {viewMode === 'heat' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: '#C8361F' }} />
                  <span style={{ fontSize: '11.5px', color: 'var(--body-text-sub)' }}>Đạt mục tiêu set</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: '#E8804F' }} />
                  <span style={{ fontSize: '11.5px', color: 'var(--body-text-sub)' }}>Gần đủ chỉ tiêu</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: '#E6E0D8' }} />
                  <span style={{ fontSize: '11.5px', color: 'var(--body-text-sub)' }}>Chưa tập</span>
                </div>
              </>
            )}
            {viewMode === 'rec' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: '#3E9E68' }} />
                  <span style={{ fontSize: '11.5px', color: 'var(--body-text-sub)' }}>Sẵn sàng tập (100%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: '#E0A23C' }} />
                  <span style={{ fontSize: '11.5px', color: 'var(--body-text-sub)' }}>Đang hồi phục</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: '#D2462B' }} />
                  <span style={{ fontSize: '11.5px', color: 'var(--body-text-sub)' }}>Cần nghỉ ngơi</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* CỘT 3: CHI TIẾT NHÓM CƠ & BÀI TẬP (Phải) */}
        <div className="body-card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '18px', maxHeight: '680px', overflowY: 'auto' }}>

          {/* Tên nhóm cơ và mô tả */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontFamily: 'var(--body-mono)', fontWeight: 600, color: 'var(--body-text-muted)', letterSpacing: '0.06em' }}>
              {selectedMuscle.side === 'front' ? 'MẶT TRƯỚC · NHÓM CHÍNH' : 'MẶT SAU · NHÓM CHÍNH'}
            </span>
            <h3 style={{ fontSize: '26px', fontWeight: 800, margin: 0, color: 'var(--body-text-main)', letterSpacing: '-0.02em' }}>
              {selectedMuscle.vn}
            </h3>
            <span style={{ fontSize: '12.5px', fontFamily: 'var(--body-mono)', color: 'var(--body-text-muted)' }}>
              {selectedMuscle.en}
            </span>
            <p style={{ margin: '6px 0 0', fontSize: '13.5px', color: 'var(--body-text-sub)', lineHeight: 1.55 }}>
              {selectedMuscle.desc}
            </p>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline', marginTop: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--body-text-main)' }}>Chức năng:</span>
              <span style={{ fontSize: '12.5px', color: 'var(--body-text-sub)' }}>{selectedMuscle.fn}</span>
            </div>
          </div>

          {/* 3 Thẻ thống kê nhanh */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: '1px solid var(--body-card-border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--body-shell-bg)' }}>
              <span style={{ fontSize: '11px', color: 'var(--body-text-muted)' }}>Set 7 ngày</span>
              <span style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: 'var(--body-text-main)' }}>
                {selectedMuscle.currentSets}<span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>/{selectedMuscle.targetSets}</span>
              </span>
            </div>
            <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--body-shell-bg)', borderLeft: '1px solid var(--body-card-border)' }}>
              <span style={{ fontSize: '11px', color: 'var(--body-text-muted)' }}>Phục hồi</span>
              <span style={{
                fontSize: '14px',
                fontWeight: 700,
                color: selectedMuscle.recovery === 'ready' ? 'var(--body-green)' : selectedMuscle.recovery === 'mid' ? 'var(--body-amber)' : '#D2462B'
              }}>
                {selectedMuscle.recovery === 'ready' ? '100% Sẵn sàng' : selectedMuscle.recovery === 'mid' ? 'Đang hồi' : 'Cần nghỉ'}
              </span>
            </div>
            <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--body-shell-bg)', borderLeft: '1px solid var(--body-card-border)' }}>
              <span style={{ fontSize: '11px', color: 'var(--body-text-muted)' }}>Kỷ lục PR</span>
              <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: 'var(--body-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedMuscle.pr?.val || '—'}
              </span>
            </div>
          </div>

          {/* Lịch tập 7 ngày (T2 - CN) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-main)' }}>
              Mức tập 7 ngày qua (số set)
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
              {DAYS_SHORT.map((day, idx) => {
                const val = (selectedMuscle.days || [])[idx] || 0;
                return (
                  <div key={day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{
                      width: '100%',
                      aspectRatio: '1',
                      borderRadius: '8px',
                      background: val > 0 ? 'var(--body-accent-soft)' : 'var(--body-shell-bg)',
                      border: val > 0 ? '1px solid var(--body-accent-border)' : '1px solid transparent',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      fontFamily: 'var(--body-mono)',
                      color: val > 0 ? 'var(--body-accent)' : 'var(--body-text-muted)'
                    }}>
                      {val || '·'}
                    </div>
                    <span style={{ fontSize: '10.5px', color: 'var(--body-text-muted)' }}>{day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bộ lọc thiết bị bài tập */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                Bài tập tác động ({exercises.length})
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {Object.entries(EQUIPMENT_LABELS).map(([k, label]) => {
                const on = selectedEquip === k;
                return (
                  <button
                    key={k}
                    onClick={() => setSelectedEquip(k)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--body-card-border)',
                      background: on ? 'var(--body-text-main)' : 'var(--body-shell-bg)',
                      color: on ? 'var(--body-bg)' : 'var(--body-text-sub)',
                      fontSize: '11.5px',
                      cursor: 'pointer'
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Danh sách bài tập */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              {exercises.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--body-text-muted)', padding: '12px 0', textAlign: 'center' }}>
                  Không có bài tập phù hợp với thiết bị đã chọn.
                </div>
              ) : (
                exercises.map(ex => (
                  <div
                    key={ex.key}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'var(--body-shell-bg)',
                      border: '1px solid var(--body-card-border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                        {ex.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--body-text-muted)' }}>
                        {EQUIPMENT_LABELS[ex.equipment] || ex.equipment} · {ex.level} · {ex.defaultSets} × {ex.defaultTarget}
                      </div>
                    </div>

                    {onSelectExercise && (
                      <button
                        className="body-btn body-btn-secondary"
                        onClick={() => onSelectExercise(ex)}
                        style={{ height: '28px', padding: '0 10px', fontSize: '11px' }}
                      >
                        Tập bài này
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
