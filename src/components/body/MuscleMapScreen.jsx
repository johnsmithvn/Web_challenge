import { useState, useMemo } from 'react';
import AppIcon from '../AppIcon';
import MuscleAnatomy2D from './MuscleAnatomy2D';
import BASE_EXERCISES from '../../data/body-exercises.json';
import { useWorkouts } from '../../hooks/useWorkouts';
import { calculateRecoveryMetrics, muscleFigureFills, RECOVERY_STATUS } from '../../utils/workoutLogic';

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

const VIEW_MODES = [
  { key: 'group', icon: 'user', title: 'Chế độ Nhóm cơ & Cơ phụ trợ' },
  { key: 'heat', icon: 'chartDonut', title: 'Chế độ Mức tập 7 ngày' },
  { key: 'rec', icon: 'checkCircle', title: 'Chế độ Trạng thái phục hồi' }
];

// Chú thích dưới sân khấu theo chế độ (màu khớp muscleFigureFills)
const LEGENDS = {
  rec: [
    { label: 'Cần nghỉ', color: 'var(--body-red)' },
    { label: 'Đang hồi', color: 'var(--body-amber)' },
    { label: 'Sẵn sàng', color: 'var(--body-green)' }
  ],
  heat: [
    { label: 'Chưa tập', color: 'var(--body-track)' },
    { label: 'Ít', color: 'var(--body-blue)' },
    { label: 'Vừa', color: 'var(--body-amber)' },
    { label: 'Nhiều', color: 'var(--body-red)' }
  ],
  group: [
    { label: 'Cơ chính', color: 'var(--body-accent)' },
    { label: 'Cơ phụ', color: 'var(--body-blue)' }
  ]
};

const REC_COLOR = { ready: 'var(--body-green)', mid: 'var(--body-amber)', low: 'var(--body-red)' };
const LEVEL_TONE = { 'Cơ bản': 'easy', 'Trung bình': 'mid', 'Nâng cao': 'hard' };
// Vòng phục hồi r40 chia 3 cung, mỗi cung chừa khe 14°
const REC_SEG = (2 * Math.PI * 40 * (120 - 14)) / 360;

export default function MuscleMapScreen({ onSelectExercise }) {
  const { recentSets, exerciseMap } = useWorkouts();

  const [selectedMuscleId, setSelectedMuscleId] = useState('chest');
  const [viewMode, setViewMode] = useState('group'); // 'group' | 'heat' | 'rec'
  const [sideView, setSideView] = useState('front'); // 'front' | 'back'
  const [selectedEquip, setSelectedEquip] = useState('all');
  const [sheetTab, setSheetTab] = useState('ov'); // 'ov' | 'ex' | 'pr'
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [desktopCardsHidden, setDesktopCardsHidden] = useState(false);
  const [now] = useState(() => Date.now());

  // 1. Phân tích dữ liệu thực tế từ recentSets trong 7 ngày
  const { muscleStats, heatMap, recoveryMap, recoveryDetails } = useMemo(() => {
    const stats = {};
    const heat = {};
    const rec = {};
    const recDet = {};

    const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;

    MUSCLE_ANATOMY.forEach(m => {
      stats[m.id] = {
        days: [0, 0, 0, 0, 0, 0, 0],
        totalSets: 0,
        primarySets: 0,
        secondarySets: 0,
        lastCompletedTime: null,
        lastPrimaryTime: null,
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

        const isPri = ex.primary === mId;

        if (setTime && setTime >= sevenDaysAgo) {
          const jsDay = new Date(setTime).getDay();
          const dayIdx = jsDay === 0 ? 6 : jsDay - 1;
          stats[mId].days[dayIdx] += 1;
          stats[mId].totalSets += 1;
          if (isPri) {
            stats[mId].primarySets += 1;
          } else {
            stats[mId].secondarySets += 1;
          }
        }

        if (setTime) {
          if (!stats[mId].lastCompletedTime || setTime > stats[mId].lastCompletedTime) {
            stats[mId].lastCompletedTime = setTime;
          }
          if (isPri && (!stats[mId].lastPrimaryTime || setTime > stats[mId].lastPrimaryTime)) {
            stats[mId].lastPrimaryTime = setTime;
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
      const hoursSincePrimary = st.lastPrimaryTime ? Math.max(0, Math.round((now - st.lastPrimaryTime) / (3600 * 1000))) : null;

      const metrics = calculateRecoveryMetrics({
        totalSets: st.totalSets,
        primarySets: st.primarySets,
        hoursSince,
        hoursSincePrimary
      });

      const ratio = Math.min(1, st.totalSets / (m.baseTargetSets || 12));
      heat[m.id] = ratio;
      rec[m.id] = metrics.state;
      recDet[m.id] = metrics;
    });

    return { muscleStats: stats, heatMap: heat, recoveryMap: rec, recoveryDetails: recDet };
  }, [recentSets, exerciseMap, now]);

  // Thông tin nhóm cơ đang chọn
  const selectedMuscle = useMemo(() => {
    const anatomical = MUSCLE_ANATOMY.find(m => m.id === selectedMuscleId) || MUSCLE_ANATOMY[0];
    const st = muscleStats[anatomical.id] || { days: [0, 0, 0, 0, 0, 0, 0], totalSets: 0, primarySets: 0, secondarySets: 0, bestPR: null };
    const recMetrics = recoveryDetails[anatomical.id] || calculateRecoveryMetrics();

    return {
      ...anatomical,
      currentSets: st.totalSets,
      primarySets: st.primarySets,
      secondarySets: st.secondarySets,
      targetSets: anatomical.baseTargetSets,
      days: st.days,
      pr: st.bestPR,
      recovery: recMetrics.state,
      recStep: { [RECOVERY_STATUS.LOW]: 1, [RECOVERY_STATUS.MID]: 2, [RECOVERY_STATUS.READY]: 3 }[recMetrics.state] || 3,
      recHours: recMetrics.hoursSince,
      recLabel: recMetrics.label,
      recBg: recMetrics.bg,
      recFg: recMetrics.fg,
      recText: recMetrics.text
    };
  }, [selectedMuscleId, muscleStats, recoveryDetails]);

  // Danh sách bài tập phù hợp
  const exercises = useMemo(() => {
    return BASE_EXERCISES.filter(ex => {
      const matchMuscle = ex.primary === selectedMuscleId || (ex.secondary || []).includes(selectedMuscleId);
      if (!matchMuscle) return false;
      if (selectedEquip === 'all') return true;
      return ex.equipment === selectedEquip;
    });
  }, [selectedMuscleId, selectedEquip]);

  const figureColors = useMemo(
    () => muscleFigureFills({ mode: viewMode, selected: selectedMuscleId, secondary: selectedMuscle.sec, heatMap, recoveryMap }),
    [viewMode, selectedMuscleId, selectedMuscle.sec, heatMap, recoveryMap]
  );

  // Đổi nhóm cơ + tự động xoay mặt trước/sau nếu cần
  const handlePickMuscle = (id, forceRotate = true) => {
    setSelectedMuscleId(id);
    setSheetCollapsed(false); // Tự động mở lại bảng chi tiết khi người dùng chọn/bấm vào bất kỳ cơ nào
    setDesktopCardsHidden(false);
    const m = MUSCLE_ANATOMY.find(item => item.id === id);
    if (m && forceRotate) {
      setSideView(m.side);
    }
  };

  const recColor = REC_COLOR[selectedMuscle.recovery] || REC_COLOR.ready;
  const recShort = `${selectedMuscle.recLabel}${selectedMuscle.recHours != null ? ` · ${selectedMuscle.recHours}h` : ''}`;
  const cardsHidden = sheetCollapsed || desktopCardsHidden;
  const sheetH = sheetCollapsed ? '48px' : sheetExpanded ? '80vh' : '390px';
  const secMuscles = (selectedMuscle.sec || []).map(id => MUSCLE_ANATOMY.find(m => m.id === id)).filter(Boolean);

  // Phần dùng chung desktop + sheet mobile
  const weekGrid = (
    <div className="body-atlas-week">
      {DAYS_SHORT.map((day, idx) => {
        const val = selectedMuscle.days[idx] || 0;
        return (
          <span key={day} className={val > 0 ? 'is-on' : undefined}>
            <b>{val || '·'}</b>
            <small>{day}</small>
          </span>
        );
      })}
    </div>
  );
  const weekHead = (
    <div className="body-atlas-card-head">
      <span>Mức tập 7 ngày</span>
      <b>{selectedMuscle.currentSets}<small> / {selectedMuscle.targetSets} set</small></b>
    </div>
  );
  const prBlock = selectedMuscle.pr ? (
    <div className="body-atlas-pr">
      <span className="body-atlas-pr-ic"><AppIcon name="trophy" size={18} weight="fill" /></span>
      <span className="body-atlas-pr-main">
        <small>{selectedMuscle.pr.exName}</small>
        <b>{selectedMuscle.pr.valText}</b>
      </span>
      <span className="body-atlas-pr-date">{selectedMuscle.pr.dateText}</span>
    </div>
  ) : null;
  const secChips = (
    <div className="body-atlas-sec">
      {secMuscles.map(s => (
        <button key={s.id} type="button" className="body-chip body-atlas-sec-chip" onClick={() => handlePickMuscle(s.id, true)}>
          {s.vn}<AppIcon name="arrowRight" size={12} />
        </button>
      ))}
    </div>
  );
  const equipChips = (
    <div className="body-chip-row body-atlas-equip" role="group" aria-label="Lọc dụng cụ">
      {Object.entries(EQUIPMENT_LABELS).map(([k, label]) => (
        <button key={k} type="button" className="body-chip" aria-pressed={selectedEquip === k} onClick={() => setSelectedEquip(k)}>
          {label}
        </button>
      ))}
    </div>
  );
  const levelBadge = ex => <span className={`body-atlas-level is-${LEVEL_TONE[ex.level] || 'easy'}`}>{ex.level}</span>;
  const startBtn = ex => onSelectExercise && (
    <button type="button" className="body-btn body-btn-primary body-atlas-go" onClick={() => onSelectExercise(ex)} title="Bắt đầu tập bài này">
      <AppIcon name="play" size={12} weight="fill" />Tập
    </button>
  );

  return (
    <div className="body-atlas-wrapper" style={{ '--atlas-sheet-h': sheetH }}>
      {/* ── WATERMARK TÊN CƠ IN HOA PHÍA SAU HÌNH ──────────────────── */}
      <div className="body-atlas-watermark" aria-hidden="true">
        {selectedMuscle.nameUp}
      </div>

      {/* ── DẢI CHIP CHỌN CƠ Ở ĐỈNH ──────────────────────────────── */}
      <div className="body-atlas-chips-bar body-chip-row" role="group" aria-label="Chọn nhóm cơ">
        {MUSCLE_ANATOMY.map(m => {
          const hours = recoveryDetails[m.id]?.hoursSince;
          return (
            <button
              key={m.id}
              type="button"
              className="body-chip body-atlas-chip"
              aria-pressed={m.id === selectedMuscleId}
              onClick={() => handlePickMuscle(m.id, true)}
            >
              <i style={{ '--dc': figureColors.fills[m.id] || 'var(--body-track)' }} />
              {m.vn}
              {hours != null && <small title="Giờ kể từ lần tập gần nhất">{hours}h</small>}
            </button>
          );
        })}
      </div>

      {/* ── CỤM NÚT CÔNG CỤ NỔI BÊN PHẢI ─────────────────────────── */}
      <div className="body-atlas-floating-tools">
        {VIEW_MODES.map(v => (
          <button
            key={v.key}
            type="button"
            className="body-atlas-tool-btn"
            aria-pressed={viewMode === v.key}
            onClick={() => setViewMode(v.key)}
            title={v.title}
            aria-label={v.title}
          >
            <AppIcon name={v.icon} size={19} />
          </button>
        ))}

        {/* Lật mặt: chỉ mobile (desktop đã thấy cả hai mặt) */}
        <button
          type="button"
          className="body-atlas-tool-btn is-flip"
          onClick={() => setSideView(s => s === 'front' ? 'back' : 'front')}
          title={`Lật sang ${sideView === 'front' ? 'Mặt sau' : 'Mặt trước'}`}
          aria-label={`Lật sang ${sideView === 'front' ? 'mặt sau' : 'mặt trước'}`}
        >
          <AppIcon name="arrowsClockwise" size={18} />
        </button>

        {/* Ẩn / Hiện bảng thông tin để ngắm toàn thân & bấm chân */}
        <button
          type="button"
          className="body-atlas-tool-btn is-sep"
          aria-pressed={cardsHidden}
          onClick={() => {
            setSheetCollapsed(c => !c);
            setDesktopCardsHidden(h => !h);
          }}
          title={cardsHidden ? 'Hiện lại bảng thông tin nhóm cơ' : 'Thu gọn bảng để nhìn và bấm vào chân'}
          aria-label={cardsHidden ? 'Hiện lại bảng thông tin nhóm cơ' : 'Thu gọn bảng thông tin'}
        >
          <AppIcon name={cardsHidden ? 'eye' : 'eyeOff'} size={18} />
        </button>
      </div>

      {/* ── SÂN KHẤU: hình 2D (desktop hai mặt, mobile một mặt) ─────── */}
      <div className={`body-atlas-fig-zone${desktopCardsHidden ? ' is-free' : ''}`}>
        <span className="body-atlas-platform" aria-hidden="true" />
        <span className="body-atlas-ring body-deco-pulse" aria-hidden="true" />
        <span className="body-atlas-hint" aria-hidden="true">
          <AppIcon name="handPointing" size={14} />Bấm vào nhóm cơ để xem chi tiết
        </span>
        <MuscleAnatomy2D
          side="both"
          className={`body-atlas-fig is-${sideView}`}
          height="var(--body-atlas-fig-h)"
          selected={selectedMuscleId}
          onSelect={(id) => handlePickMuscle(id, true)}
          labelOf={(id) => MUSCLE_ANATOMY.find(m => m.id === id)?.vn || id}
          {...figureColors}
        />
        <div className="body-atlas-legend" aria-hidden="true">
          {LEGENDS[viewMode].map(l => (
            <span key={l.label}><i style={{ '--dc': l.color }} />{l.label}</span>
          ))}
        </div>
      </div>

      {/* ── DESKTOP: THẺ NỔI HAI BÊN + DẢI BÀI Ở ĐÁY (≥ 841px) ─────── */}
      <div className={`body-atlas-desktop ${desktopCardsHidden ? 'hidden-cards' : ''}`}>
        {/* Trái: tên cơ, mô tả, phục hồi */}
        <div className="body-atlas-desktop-left">
          <section className="body-atlas-desktop-card body-atlas-info" style={{ '--dc': recColor }}>
            <div className="body-atlas-name">
              <span className="body-eyebrow">{selectedMuscle.side === 'front' ? 'MẶT TRƯỚC' : 'MẶT SAU'}</span>
              <h2>{selectedMuscle.vn}</h2>
              <small>{selectedMuscle.en}</small>
              <span className="body-atlas-status">{selectedMuscle.recLabel}</span>
            </div>

            <p className="body-atlas-desc">{selectedMuscle.desc}</p>

            <div className="body-atlas-fn">
              <b>Chức năng</b>
              <span>{selectedMuscle.fn}</span>
            </div>

            {/* 3 nấc trạng thái rời rạc (Cần nghỉ / Đang hồi / Sẵn sàng), không hiển thị % */}
            <div className="body-atlas-rec">
              <div className="body-atlas-rec-ring">
                <svg viewBox="0 0 96 96" aria-hidden="true">
                  {[0, 1, 2].map(i => (
                    <circle
                      key={i}
                      cx="48"
                      cy="48"
                      r="40"
                      className={i < selectedMuscle.recStep ? 'is-on' : undefined}
                      strokeDasharray={`${REC_SEG} ${2 * Math.PI * 40}`}
                      transform={`rotate(${-90 + i * 120 + 7} 48 48)`}
                    />
                  ))}
                </svg>
                <b>{selectedMuscle.recHours != null ? `${selectedMuscle.recHours}h` : '—'}</b>
              </div>
              <span className="body-atlas-rec-text">
                <b>{selectedMuscle.recLabel}</b>
                <small>{selectedMuscle.recText}</small>
              </span>
            </div>
          </section>
        </div>

        {/* Phải: lưới 7 ngày, kỷ lục, cơ phụ trợ */}
        <div className="body-atlas-desktop-right">
          <section className="body-atlas-desktop-card">
            {weekHead}
            {weekGrid}
          </section>

          <section className="body-atlas-desktop-card">
            <span className="body-atlas-card-title">Kỷ lục cá nhân (PR)</span>
            {prBlock || <span className="body-atlas-muted">Chưa có kỷ lục nào</span>}
          </section>

          <section className="body-atlas-desktop-card">
            <span className="body-atlas-card-title">Cơ phụ trợ</span>
            {secChips}
          </section>
        </div>

        {/* Đáy: bài tập cho nhóm cơ */}
        <div className="body-atlas-desktop-bottom">
          <section className="body-atlas-desktop-card body-atlas-exbar">
            <div className="body-atlas-exbar-head">
              <span className="body-atlas-card-title">Bài tập cho {selectedMuscle.vn} ({exercises.length})</span>
              {equipChips}
            </div>
            <div className="body-atlas-exrow">
              {exercises.length === 0 ? (
                <span className="body-atlas-muted">Không có bài tập phù hợp với thiết bị đã chọn.</span>
              ) : exercises.map(ex => (
                <div key={ex.key} className="body-tile body-atlas-ex">
                  <div className="body-atlas-ex-top">
                    <b>{ex.name}</b>
                    {levelBadge(ex)}
                  </div>
                  <div className="body-atlas-ex-foot">
                    <small>{EQUIPMENT_LABELS[ex.equipment] || ex.equipment} · {ex.defaultSets}×{ex.defaultTarget}</small>
                    {startBtn(ex)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* ── MOBILE: BOTTOM SHEET 3 TAB (≤ 840px) ──────────────────── */}
      <div className={`body-atlas-sheet-mobile${sheetCollapsed ? ' collapsed' : ''}`} style={{ '--dc': recColor }}>
        {sheetCollapsed ? (
          /* Thu gọn: thanh mỏng 48px nhường chỗ cho hình để bấm chân */
          <button type="button" className="body-atlas-sheet-bar" onClick={() => setSheetCollapsed(false)}>
            <i />
            <b>{selectedMuscle.vn}</b>
            <span className="body-atlas-status">{recShort}</span>
            <em>Xem chi tiết<AppIcon name="caretUp" size={14} /></em>
          </button>
        ) : (
          <>
            <button
              type="button"
              className="body-atlas-sheet-handle"
              onClick={() => setSheetExpanded(!sheetExpanded)}
              title="Nhấn để mở rộng hoặc thu gọn"
              aria-label={sheetExpanded ? 'Thu nhỏ bảng' : 'Mở rộng bảng'}
            />

            <div className="body-atlas-sheet-head">
              <span className="body-atlas-sheet-name">
                <b>{selectedMuscle.vn}</b>
                <small>{selectedMuscle.en}</small>
              </span>
              <span className="body-atlas-status">{recShort}</span>
              <button
                type="button"
                className="body-icon-btn"
                onClick={() => setSheetCollapsed(true)}
                title="Thu gọn bảng để nhìn và bấm vào chân"
                aria-label="Thu gọn bảng chi tiết"
              >
                <AppIcon name="x" size={16} />
              </button>
            </div>

            {/* 3 tab: Tổng quan | Bài tập | Kỷ lục & Cơ phụ */}
            <div className="body-atlas-sheet-tabs" role="tablist" aria-label="Chi tiết nhóm cơ">
              {[
                { key: 'ov', label: 'Tổng quan' },
                { key: 'ex', label: `Bài tập (${exercises.length})` },
                { key: 'pr', label: 'Kỷ lục & Cơ phụ' }
              ].map(t => (
                <button key={t.key} type="button" role="tab" className="body-chip" aria-selected={sheetTab === t.key} onClick={() => setSheetTab(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="body-atlas-sheet-body">
              {sheetTab === 'ov' && (
                <>
                  <p className="body-atlas-desc">{selectedMuscle.desc}</p>
                  <div className="body-atlas-fn">
                    <b>Chức năng</b>
                    <span>{selectedMuscle.fn}</span>
                  </div>
                  {weekHead}
                  {weekGrid}
                  <div className="body-atlas-note">{selectedMuscle.recText}</div>
                </>
              )}

              {sheetTab === 'ex' && (
                <>
                  {equipChips}
                  {exercises.length === 0 ? (
                    <span className="body-atlas-muted is-center">Không có bài tập phù hợp cho bộ lọc này.</span>
                  ) : exercises.map(ex => (
                    <div key={ex.key} className="body-tile body-atlas-mex">
                      <span className="body-atlas-mex-main">
                        <b>{ex.name}</b>
                        <small>{EQUIPMENT_LABELS[ex.equipment] || ex.equipment} · {ex.defaultSets} × {ex.defaultTarget}</small>
                      </span>
                      {levelBadge(ex)}
                      {startBtn(ex)}
                    </div>
                  ))}
                </>
              )}

              {sheetTab === 'pr' && (
                <>
                  <span className="body-atlas-card-title">Kỷ lục cá nhân (PR)</span>
                  {prBlock || <span className="body-atlas-note is-center">Chưa ghi nhận kỷ lục cho nhóm cơ này.</span>}
                  <span className="body-atlas-card-title">Nhóm cơ phụ trợ</span>
                  {secChips}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
