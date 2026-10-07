import { useState, useMemo, lazy, Suspense } from 'react';
import AppIcon from '../AppIcon';
import BASE_EXERCISES from '../../data/body-exercises.json';
import { useWorkouts } from '../../hooks/useWorkouts';
import { estimateRecoveryState, RECOVERY_STATUS } from '../../utils/workoutLogic';

const MuscleBodyCanvas = lazy(() => import('./MuscleBodyCanvas'));

const MUSCLE_ANATOMY = [
  {
    id: 'chest',
    vn: 'Ngực',
    en: 'Pectoralis major · minor',
    nameUp: 'CHEST',
    side: 'front',
    desc: 'Cơ ngực lớn và ngực bé, phủ phía trước lồng ngực từ xương đòn đến xương ức.',
    fn: 'Đẩy tay ra trước, khép tay vào thân, hỗ trợ xoay trong khớp vai.',
    sec: ['shoulders', 'triceps'],
    baseTargetSets: 14
  },
  {
    id: 'shoulders',
    vn: 'Vai',
    en: 'Deltoids',
    nameUp: 'DELTOIDS',
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
    nameUp: 'BICEPS',
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
    nameUp: 'FOREARMS',
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
    nameUp: 'ABS',
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
    nameUp: 'OBLIQUES',
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
    nameUp: 'QUADRICEPS',
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
    nameUp: 'TRAPEZIUS',
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
    nameUp: 'LATS',
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
    nameUp: 'TRICEPS',
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
    nameUp: 'LOWER BACK',
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
    nameUp: 'GLUTES',
    side: 'back',
    desc: 'Cơ mông lớn, nhỡ và bé; cơ mông lớn là cơ khỏe nhất cơ thể.',
    fn: 'Duỗi hông, dạng chân, giữ vững khung chậu khi đứng một chân.',
    sec: ['quads', 'hamstrings', 'lowerback'],
    baseTargetSets: 12
  },
  {
    id: 'hamstrings',
    vn: 'Đùi sau',
    en: 'Hamstrings',
    nameUp: 'HAMSTRINGS',
    side: 'back',
    desc: 'Ba cơ ở mặt sau đùi, chạy từ ụ ngồi đến dưới khớp gối.',
    fn: 'Gập gối, duỗi hông; giữ ổn định khớp gối khi chạy nước rút và tiếp đất.',
    sec: ['glutes', 'lowerback', 'calves'],
    baseTargetSets: 10
  },
  {
    id: 'calves',
    vn: 'Bắp chân',
    en: 'Gastrocnemius · soleus',
    nameUp: 'CALVES',
    side: 'back',
    desc: 'Cơ bắp chân và cơ dép ở mặt sau cẳng chân.',
    fn: 'Kiễng gót chân, truyền lực đẩy khi đi, chạy bộ và bật nhảy.',
    sec: ['hamstrings'],
    baseTargetSets: 8
  }
];

const EQUIPMENT_LABELS = {
  all: 'Mọi thiết bị',
  bw: 'Không dụng cụ',
  db: 'Tạ đơn',
  bar: 'Xà & dây',
  gym: 'Máy gym'
};

const DAYS_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export default function MuscleMapScreen({ onSelectExercise }) {
  const { recentSets, exerciseMap } = useWorkouts();

  const [selectedMuscleId, setSelectedMuscleId] = useState('chest');
  const [viewMode, setViewMode] = useState('group'); // 'group' | 'heat' | 'rec'
  const [sideView, setSideView] = useState('front'); // 'front' | 'back'
  const [selectedEquip, setSelectedEquip] = useState('all');
  const [sheetTab, setSheetTab] = useState('ov'); // 'ov' | 'ex' | 'pr'
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [now] = useState(() => Date.now());

  // 1. Phân tích dữ liệu thực tế từ recentSets trong 7 ngày
  const { muscleStats, heatMap, recoveryMap } = useMemo(() => {
    const stats = {};
    const heat = {};
    const rec = {};

    const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;

    MUSCLE_ANATOMY.forEach(m => {
      stats[m.id] = {
        days: [0, 0, 0, 0, 0, 0, 0],
        totalSets: 0,
        lastCompletedTime: null,
        bestPR: null
      };
    });

    (recentSets || []).forEach(set => {
      if (set.actual_val == null && set.weight == null && set.reps == null) return;
      const ex = exerciseMap?.get(set.exercise_key);
      if (!ex) return;

      const targetMuscles = [ex.primary, ...(ex.secondary || [])].filter(Boolean);
      const setTime = set.completed_at ? new Date(set.completed_at).getTime() : null;

      targetMuscles.forEach(mId => {
        if (!stats[mId]) return;

        if (setTime && setTime >= sevenDaysAgo) {
          const jsDay = new Date(setTime).getDay();
          const dayIdx = jsDay === 0 ? 6 : jsDay - 1;
          stats[mId].days[dayIdx] += 1;
          stats[mId].totalSets += 1;
        }

        if (setTime) {
          if (!stats[mId].lastCompletedTime || setTime > stats[mId].lastCompletedTime) {
            stats[mId].lastCompletedTime = setTime;
          }
        }

        const score = (Number(set.weight) || 0) * (Number(set.reps) || 0) || Number(set.reps) || Number(set.actual_val) || 0;
        if (score > 0) {
          if (!stats[mId].bestPR || score > stats[mId].bestPR.score) {
            stats[mId].bestPR = {
              score,
              exName: ex.name,
              valText: set.weight ? `${set.weight} kg × ${set.reps}` : `${set.reps || set.actual_val} reps`,
              dateText: set.completed_at ? new Date(set.completed_at).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' }) : 'Gần đây'
            };
          }
        }
      });
    });

    MUSCLE_ANATOMY.forEach(m => {
      const st = stats[m.id];
      const hoursSince = st.lastCompletedTime ? Math.max(0, Math.round((now - st.lastCompletedTime) / (3600 * 1000))) : null;
      const recState = estimateRecoveryState(st.totalSets, hoursSince);

      const ratio = Math.min(1, st.totalSets / (m.baseTargetSets || 12));
      heat[m.id] = ratio;
      rec[m.id] = recState;
    });

    return { muscleStats: stats, heatMap: heat, recoveryMap: rec };
  }, [recentSets, exerciseMap, now]);

  // Thông tin nhóm cơ đang chọn
  const selectedMuscle = useMemo(() => {
    const anatomical = MUSCLE_ANATOMY.find(m => m.id === selectedMuscleId) || MUSCLE_ANATOMY[0];
    const st = muscleStats[anatomical.id] || { days: [0, 0, 0, 0, 0, 0, 0], totalSets: 0, bestPR: null };
    const recState = recoveryMap[anatomical.id] || RECOVERY_STATUS.READY;

    let recPct = 100;
    let recLabel = 'Sẵn sàng';
    let recBg = '#E6F2EA';
    let recFg = '#2F7A50';
    let recText = 'Nhóm cơ đã hồi phục hoàn toàn. Sẵn sàng cho buổi tập tiếp theo.';

    if (recState === RECOVERY_STATUS.MID) {
      recPct = 55;
      recLabel = 'Đang hồi';
      recBg = '#FBF0DC';
      recFg = '#9A6514';
      recText = 'Đang trong quá trình tái tạo sợi cơ. Có thể tập nhẹ hoặc đổi nhóm cơ khác.';
    } else if (recState === RECOVERY_STATUS.LOW) {
      recPct = 25;
      recLabel = 'Cần nghỉ';
      recBg = '#FBE5E0';
      recFg = '#B23A22';
      recText = 'Cơ bắp vừa chịu tải nặng hôm nay. Khuyến nghị nghỉ tối thiểu 24-48 giờ.';
    }

    return {
      ...anatomical,
      currentSets: st.totalSets,
      targetSets: anatomical.baseTargetSets,
      days: st.days,
      pr: st.bestPR,
      recovery: recState,
      recPct,
      recLabel,
      recBg,
      recFg,
      recText
    };
  }, [selectedMuscleId, muscleStats, recoveryMap]);

  // Danh sách bài tập phù hợp
  const exercises = useMemo(() => {
    return BASE_EXERCISES.filter(ex => {
      const matchMuscle = ex.primary === selectedMuscleId || (ex.secondary || []).includes(selectedMuscleId);
      if (!matchMuscle) return false;
      if (selectedEquip === 'all') return true;
      return ex.equipment === selectedEquip;
    });
  }, [selectedMuscleId, selectedEquip]);

  // Đổi nhóm cơ + tự động xoay mặt trước/sau nếu cần
  const handlePickMuscle = (id, forceRotate = true) => {
    setSelectedMuscleId(id);
    const m = MUSCLE_ANATOMY.find(item => item.id === id);
    if (m && forceRotate) {
      setSideView(m.side);
    }
  };

  // Helper lấy màu dot cho từng cơ trong thanh chip
  const getChipDotColor = (mId) => {
    if (viewMode === 'heat') {
      const r = heatMap[mId] || 0;
      return r >= 0.8 ? '#C8361F' : r >= 0.4 ? '#E8804F' : '#E6E0D8';
    }
    if (viewMode === 'rec') {
      const r = recoveryMap[mId] || RECOVERY_STATUS.READY;
      return r === RECOVERY_STATUS.READY ? '#2F8A57' : r === RECOVERY_STATUS.MID ? '#B57A12' : '#C23B22';
    }
    return mId === selectedMuscleId ? '#6949E8' : selectedMuscle.sec.includes(mId) ? '#C4B6F4' : '#D2C7BC';
  };

  return (
    <div className="body-atlas-wrapper">
      {/* ── WATERMARK CHỮ IN HOA LỚN PHÍA SAU MÔ HÌNH 3D ─────────────── */}
      <div className="body-atlas-watermark">
        {selectedMuscle.nameUp}
      </div>

      {/* ── DẢI CHIP CHỌN CƠ TRƯỢT NGANG Ở ĐỈNH ──────────────────────── */}
      <div className="body-atlas-chips-bar">
        {MUSCLE_ANATOMY.map(m => {
          const isSel = m.id === selectedMuscleId;
          const dotColor = getChipDotColor(m.id);
          return (
            <button
              key={m.id}
              className={`body-atlas-chip ${isSel ? 'active' : ''}`}
              onClick={() => handlePickMuscle(m.id, true)}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '4px', background: dotColor, flexShrink: 0 }} />
              <span>{m.vn}</span>
            </button>
          );
        })}
      </div>

      {/* ── CỤM NÚT ICON NỔI BÊN PHẢI (CHẾ ĐỘ & LẬT MẶT) ─────────────── */}
      <div className="body-atlas-floating-tools">
        {/* Chế độ Nhóm cơ */}
        <button
          className={`body-atlas-tool-btn ${viewMode === 'group' ? 'active' : ''}`}
          onClick={() => setViewMode('group')}
          title="Chế độ Nhóm cơ & Cơ phụ trợ"
        >
          <AppIcon name="user" size={19} />
        </button>

        {/* Chế độ Mức tập */}
        <button
          className={`body-atlas-tool-btn ${viewMode === 'heat' ? 'active' : ''}`}
          onClick={() => setViewMode('heat')}
          title="Chế độ Mức tập 7 ngày"
        >
          <AppIcon name="chartDonut" size={19} />
        </button>

        {/* Chế độ Phục hồi */}
        <button
          className={`body-atlas-tool-btn ${viewMode === 'rec' ? 'active' : ''}`}
          onClick={() => setViewMode('rec')}
          title="Chế độ Trạng thái phục hồi"
        >
          <AppIcon name="checkCircle" size={19} />
        </button>

        {/* Lật Mặt trước / Mặt sau */}
        <button
          className="body-atlas-tool-btn"
          onClick={() => setSideView(s => s === 'front' ? 'back' : 'front')}
          title={`Lật sang ${sideView === 'front' ? 'Mặt sau' : 'Mặt trước'}`}
          style={{ marginTop: '6px' }}
        >
          <AppIcon name="pencil" size={18} />
        </button>
      </div>

      {/* ── CANVAS 3D THREE.JS ────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: '340px', position: 'relative', zIndex: 2 }}>
        <Suspense fallback={
          <div style={{ width: '100%', height: '100%', minHeight: '340px', display: 'grid', placeItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--body-text-muted)', fontFamily: 'var(--body-mono)' }}>Đang tải mô hình 3D...</span>
          </div>
        }>
          <MuscleBodyCanvas
            selectedId={selectedMuscleId}
            onSelectMuscle={(id) => handlePickMuscle(id, false)}
            viewSide={sideView}
            mode={viewMode}
            secondaryList={selectedMuscle.sec || []}
            heatMap={heatMap}
            recoveryMap={recoveryMap}
          />
        </Suspense>
      </div>

      {/* ── DESKTOP ATLAS: CÁC CARD NỔI FLOATING HAI BÊN (min-width: 841px) ── */}
      <div className="body-atlas-desktop">
        {/* CỘT NỔI BÊN TRÁI: TÊN CƠ, MÔ TẢ & GAUGE PHỤC HỒI */}
        <div className="body-atlas-desktop-left">
          <div className="body-atlas-desktop-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--body-mono)', fontWeight: 600, color: 'var(--body-text-muted)', letterSpacing: '0.08em' }}>
                {selectedMuscle.side === 'front' ? 'MẶT TRƯỚC' : 'MẶT SAU'}
              </span>
              <h2 style={{ fontSize: '32px', fontWeight: 800, margin: 0, color: 'var(--body-text-main)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {selectedMuscle.vn}
              </h2>
              <span style={{ fontSize: '12px', fontFamily: 'var(--body-mono)', color: 'var(--body-text-muted)' }}>
                {selectedMuscle.en}
              </span>
            </div>

            <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.55, color: 'var(--body-text-sub)' }}>
              {selectedMuscle.desc}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--body-text-main)' }}>Chức năng</span>
              <span style={{ fontSize: '12px', color: 'var(--body-text-sub)', lineHeight: 1.45 }}>{selectedMuscle.fn}</span>
            </div>

            {/* Vòng tròn phục hồi SVG */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px', background: 'var(--body-shell-bg)', borderRadius: '12px', marginTop: '4px' }}>
              <div style={{ position: 'relative', width: '64px', height: '64px', flexShrink: 0 }}>
                <svg width="64" height="64" viewBox="0 0 76 76" style={{ display: 'block' }}>
                  <circle cx="38" cy="38" r="31" fill="none" stroke="var(--body-card-border)" strokeWidth="7" />
                  <circle
                    cx="38"
                    cy="38"
                    r="31"
                    fill="none"
                    stroke={selectedMuscle.recFg}
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={`${(selectedMuscle.recPct / 100) * 194.7} 194.7`}
                    transform="rotate(-90 38 38)"
                  />
                </svg>
                <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: '14px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: 'var(--body-text-main)' }}>
                  {selectedMuscle.recPct}%
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: selectedMuscle.recFg }}>
                  {selectedMuscle.recLabel}
                </span>
                <span style={{ fontSize: '11.5px', color: 'var(--body-text-muted)', lineHeight: 1.35 }}>
                  {selectedMuscle.recText}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CỘT NỔI BÊN PHẢI: LƯỚI 7 NGÀY, PR VÀ CƠ PHỤ TRỢ */}
        <div className="body-atlas-desktop-right">
          {/* Card 1: Mức tập 7 ngày */}
          <div className="body-atlas-desktop-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--body-text-main)' }}>Mức tập 7 ngày</span>
              <span style={{ fontSize: '12px', fontFamily: 'var(--body-mono)', fontWeight: 700, color: 'var(--body-text-main)' }}>
                {selectedMuscle.currentSets}<span style={{ fontWeight: 400, color: 'var(--body-text-muted)' }}> / {selectedMuscle.targetSets} set</span>
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '5px' }}>
              {DAYS_SHORT.map((day, idx) => {
                const val = selectedMuscle.days[idx] || 0;
                return (
                  <div key={day} style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                    <span style={{
                      width: '100%',
                      height: '30px',
                      borderRadius: '6px',
                      background: val > 0 ? 'var(--body-accent-soft)' : 'var(--body-shell-bg)',
                      border: val > 0 ? '1px solid var(--body-accent-border)' : '1px solid transparent',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '11px',
                      fontWeight: 700,
                      fontFamily: 'var(--body-mono)',
                      color: val > 0 ? 'var(--body-accent)' : 'var(--body-text-muted)'
                    }}>
                      {val || '·'}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--body-text-muted)', fontWeight: 500 }}>{day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 2: Kỷ lục cá nhân (PR) */}
          <div className="body-atlas-desktop-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--body-text-main)' }}>Kỷ lục cá nhân (PR)</span>
            {selectedMuscle.pr ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FDF3E3', color: '#B57A12', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <AppIcon name="trophy" size={17} weight="fill" />
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--body-text-muted)' }}>{selectedMuscle.pr.exName}</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--body-text-main)', fontFamily: 'var(--body-mono)' }}>{selectedMuscle.pr.valText}</span>
                </div>
                <span style={{ fontSize: '10.5px', color: 'var(--body-text-muted)', fontFamily: 'var(--body-mono)' }}>{selectedMuscle.pr.dateText}</span>
              </div>
            ) : (
              <div style={{ fontSize: '11.5px', color: 'var(--body-text-muted)' }}>Chưa có kỷ lục nào</div>
            )}
          </div>

          {/* Card 3: Cơ phụ trợ */}
          <div className="body-atlas-desktop-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--body-text-main)' }}>Cơ phụ trợ</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(selectedMuscle.sec || []).map(secId => {
                const secAnatomy = MUSCLE_ANATOMY.find(m => m.id === secId);
                if (!secAnatomy) return null;
                return (
                  <button
                    key={secId}
                    onClick={() => handlePickMuscle(secId, true)}
                    style={{
                      height: '28px',
                      padding: '0 10px',
                      borderRadius: '14px',
                      background: 'var(--body-accent-soft)',
                      border: '1px solid var(--body-accent-border)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: 'var(--body-accent)',
                      cursor: 'pointer'
                    }}
                  >
                    <span>{secAnatomy.vn}</span>
                    <AppIcon name="arrowRight" size={11} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* DẢI BÀI TẬP DÀN NGANG Ở ĐÁY */}
        <div className="body-atlas-desktop-bottom">
          <div className="body-atlas-desktop-card" style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                  Bài tập cho {selectedMuscle.vn} ({exercises.length})
                </span>
              </div>
              {/* Lọc thiết bị */}
              <div style={{ display: 'flex', gap: '5px' }}>
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
                        fontSize: '11px',
                        fontWeight: on ? 600 : 500,
                        cursor: 'pointer'
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hàng ngang các thẻ bài tập */}
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '2px' }}>
              {exercises.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--body-text-muted)', padding: '10px 0' }}>
                  Không có bài tập phù hợp với thiết bị đã chọn.
                </div>
              ) : (
                exercises.map(ex => (
                  <div
                    key={ex.key}
                    style={{
                      width: '210px',
                      flexShrink: 0,
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'var(--body-card-bg)',
                      border: '1px solid var(--body-card-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--body-text-main)', lineHeight: 1.25 }}>
                        {ex.name}
                      </span>
                      <span style={{
                        padding: '2px 5px',
                        borderRadius: '4px',
                        fontSize: '9.5px',
                        fontWeight: 600,
                        background: ex.level === 'Nâng cao' ? '#FBE5E0' : ex.level === 'Trung bình' ? '#FBF0DC' : '#E6F2EA',
                        color: ex.level === 'Nâng cao' ? '#B23A22' : ex.level === 'Trung bình' ? '#9A6514' : '#2F7A50',
                        flexShrink: 0
                      }}>
                        {ex.level}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--body-text-muted)' }}>
                        {EQUIPMENT_LABELS[ex.equipment] || ex.equipment} · {ex.defaultSets}×{ex.defaultTarget}
                      </span>
                      {onSelectExercise && (
                        <button
                          className="body-btn body-btn-accent"
                          onClick={() => onSelectExercise(ex)}
                          style={{ height: '24px', padding: '0 8px', fontSize: '10.5px' }}
                        >
                          Tập
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── MOBILE ATLAS: BOTTOM SHEET 3 TABS (max-width: 840px) ─────── */}
      <div
        className="body-atlas-sheet-mobile"
        style={{
          height: sheetExpanded ? '80vh' : '390px'
        }}
      >
        {/* Thanh kéo vuốt mở rộng / thu gọn */}
        <div
          className="body-atlas-sheet-handle"
          onClick={() => setSheetExpanded(!sheetExpanded)}
          title="Nhấn để mở rộng hoặc thu gọn"
        />

        {/* Header Bottom Sheet */}
        <div style={{ padding: '8px 18px 0', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '10px', flex: 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
            <span style={{ fontSize: '23px', fontWeight: 700, color: 'var(--body-text-main)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {selectedMuscle.vn}
            </span>
            <span style={{ fontSize: '11.5px', fontFamily: 'var(--body-mono)', color: 'var(--body-text-muted)' }}>
              {selectedMuscle.en}
            </span>
          </div>
          <span style={{
            padding: '5px 11px',
            borderRadius: '20px',
            background: selectedMuscle.recBg,
            fontSize: '11.5px',
            fontWeight: 700,
            color: selectedMuscle.recFg,
            flexShrink: 0
          }}>
            {selectedMuscle.recLabel} · {selectedMuscle.recPct}%
          </span>
        </div>

        {/* 3 Tabs: Tổng quan | Bài tập | Kỷ lục & Cơ phụ */}
        <div style={{ display: 'flex', gap: '22px', padding: '0 18px', borderBottom: '1px solid var(--body-card-border)', flex: 'none', marginTop: '10px' }}>
          {[
            { key: 'ov', label: 'Tổng quan' },
            { key: 'ex', label: `Bài tập (${exercises.length})` },
            { key: 'pr', label: 'Kỷ lục & Cơ phụ' }
          ].map(t => (
            <button
              key={t.key}
              className={`body-atlas-sheet-tab ${sheetTab === t.key ? 'active' : ''}`}
              onClick={() => setSheetTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Nội dung Tab cuộn độc lập */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 18px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* TAB 1: TỔNG QUAN */}
          {sheetTab === 'ov' && (
            <>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.55, color: 'var(--body-text-sub)' }}>
                {selectedMuscle.desc}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--body-text-main)' }}>Chức năng</span>
                <span style={{ fontSize: '12.5px', color: 'var(--body-text-sub)', lineHeight: 1.5 }}>{selectedMuscle.fn}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--body-text-main)' }}>Mức tập 7 ngày</span>
                <span style={{ fontSize: '12px', fontFamily: 'var(--body-mono)', fontWeight: 700, color: 'var(--body-text-main)' }}>
                  {selectedMuscle.currentSets}
                  <span style={{ fontWeight: 400, color: 'var(--body-text-muted)' }}> / {selectedMuscle.targetSets} set</span>
                </span>
              </div>

              {/* Lưới 7 ngày (T2 - CN) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '6px' }}>
                {DAYS_SHORT.map((day, idx) => {
                  const val = selectedMuscle.days[idx] || 0;
                  return (
                    <div key={day} style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                      <span style={{
                        width: '100%',
                        height: '32px',
                        borderRadius: '6px',
                        background: val > 0 ? 'var(--body-accent-soft)' : 'var(--body-shell-bg)',
                        border: val > 0 ? '1px solid var(--body-accent-border)' : '1px solid transparent',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: '11px',
                        fontWeight: 700,
                        fontFamily: 'var(--body-mono)',
                        color: val > 0 ? 'var(--body-accent)' : 'var(--body-text-muted)'
                      }}>
                        {val || '·'}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--body-text-muted)', fontWeight: 500 }}>{day}</span>
                    </div>
                  );
                })}
              </div>

              <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'var(--body-shell-bg)', fontSize: '12px', color: 'var(--body-text-sub)', lineHeight: 1.45 }}>
                {selectedMuscle.recText}
              </div>
            </>
          )}

          {/* TAB 2: BÀI TẬP */}
          {sheetTab === 'ex' && (
            <>
              {/* Lọc thiết bị */}
              <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '2px' }}>
                {Object.entries(EQUIPMENT_LABELS).map(([k, label]) => {
                  const on = selectedEquip === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setSelectedEquip(k)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--body-card-border)',
                        background: on ? 'var(--body-text-main)' : 'var(--body-shell-bg)',
                        color: on ? 'var(--body-bg)' : 'var(--body-text-sub)',
                        fontSize: '11.5px',
                        fontWeight: on ? 600 : 500,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Danh sách bài tập */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {exercises.length === 0 ? (
                  <div style={{ fontSize: '12.5px', color: 'var(--body-text-muted)', padding: '24px 0', textAlign: 'center' }}>
                    Không có bài tập phù hợp cho bộ lọc này.
                  </div>
                ) : (
                  exercises.map(ex => (
                    <div
                      key={ex.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: '12px',
                        background: 'var(--body-shell-bg)',
                        border: '1px solid var(--body-card-border)',
                        gap: '10px'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--body-text-main)' }}>{ex.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--body-text-muted)' }}>
                          {EQUIPMENT_LABELS[ex.equipment] || ex.equipment} · {ex.defaultSets} × {ex.defaultTarget}
                        </span>
                      </div>

                      <span style={{
                        padding: '3px 7px',
                        borderRadius: '6px',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        background: ex.level === 'Nâng cao' ? '#FBE5E0' : ex.level === 'Trung bình' ? '#FBF0DC' : '#E6F2EA',
                        color: ex.level === 'Nâng cao' ? '#B23A22' : ex.level === 'Trung bình' ? '#9A6514' : '#2F7A50',
                        flexShrink: 0
                      }}>
                        {ex.level}
                      </span>

                      {onSelectExercise && (
                        <button
                          className="body-btn body-btn-accent"
                          onClick={() => onSelectExercise(ex)}
                          style={{ height: '30px', padding: '0 10px', fontSize: '11px', flexShrink: 0 }}
                          title="Bắt đầu tập bài này"
                        >
                          <AppIcon name="play" size={12} weight="fill" /> Tập
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* TAB 3: KỶ LỤC & CƠ PHỤ TRỢ */}
          {sheetTab === 'pr' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--body-text-main)' }}>Kỷ lục cá nhân (PR)</span>
                {selectedMuscle.pr ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    background: 'var(--body-shell-bg)',
                    borderRadius: '12px',
                    border: '1px solid var(--body-card-border)'
                  }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FDF3E3', color: '#B57A12', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <AppIcon name="trophy" size={20} weight="fill" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>{selectedMuscle.pr.exName}</span>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--body-text-main)', fontFamily: 'var(--body-mono)' }}>
                        {selectedMuscle.pr.valText}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--body-text-muted)', fontFamily: 'var(--body-mono)' }}>
                      {selectedMuscle.pr.dateText}
                    </span>
                  </div>
                ) : (
                  <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--body-shell-bg)', fontSize: '12px', color: 'var(--body-text-muted)', textAlign: 'center' }}>
                    Chưa ghi nhận kỷ lục cho nhóm cơ này.
                  </div>
                )}
              </div>

              {/* Các nhóm cơ phụ trợ liên đới */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--body-text-main)' }}>Nhóm cơ phụ trợ</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                  {(selectedMuscle.sec || []).map(secId => {
                    const secAnatomy = MUSCLE_ANATOMY.find(m => m.id === secId);
                    if (!secAnatomy) return null;
                    return (
                      <button
                        key={secId}
                        onClick={() => handlePickMuscle(secId, true)}
                        style={{
                          height: '34px',
                          padding: '0 13px',
                          borderRadius: '17px',
                          background: 'var(--body-accent-soft)',
                          border: '1px solid var(--body-accent-border)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          color: 'var(--body-accent)',
                          cursor: 'pointer'
                        }}
                      >
                        <span>{secAnatomy.vn}</span>
                        <AppIcon name="arrowRight" size={13} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
