import { useState, useMemo, useEffect, useRef } from 'react';
import AppIcon from '../AppIcon';
import SkeletonList from '../SkeletonList';
import { ConfirmModal } from '../ConfirmModal';
import { useBiometrics } from '../../hooks/useBiometrics';
import { useElementWidth } from '../../hooks/useElementWidth';
import {
  calculateBodyComposition,
  calculateNavyBodyFat,
  estimateVisceralFatFromWaist,
  weightForBmi,
  dailyAverageSeries,
  trendDomain,
  bmiGaugeAngle,
  smoothPath
} from '../../utils/bodyMetrics';

// Số kiểu Việt (dấu phẩy thập phân)
const f = (v, d = 1) => {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toFixed(d).replace('.', ',');
};
const fs = (v, d = 1) => {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const num = Number(v);
  if (Math.abs(num) < 0.001) return '±0';
  return (num > 0 ? '+' : '−') + f(Math.abs(num), d);
};
const ddmm = str => {
  const [, m, d] = String(str).split('-');
  return `${Number(d)}/${Number(m)}`;
};

const GAUGE_LO = 15;
const GAUGE_HI = 32;
const GAUGE_SEGS = [[15, 18.5, '#4A8FE7'], [18.5, 23, '#2F9E5B'], [23, 25, '#E8973A'], [25, 32, '#D9503F']];
const BMI_SHORT = { underweight: 'Thiếu cân', normal: 'Bình thường', overweight: 'Thừa cân', obese: 'Béo phì' };
const BMI_COLOR = { underweight: '#4A8FE7', normal: '#2F9E5B', overweight: '#E8973A', obese: '#D9503F' };
const BMI_LEGEND = [
  ['underweight', 'Thiếu cân', '<18,5'],
  ['normal', 'Bình thường', '18,5–22,9'],
  ['overweight', 'Thừa cân', '23–24,9'],
  ['obese', 'Béo phì', '≥25']
];
const RANGES = [
  { k: '7d', l: 'Tuần', s: '7 ngày', days: 7 },
  { k: '30d', l: 'Tháng', s: '30 ngày', days: 30 },
  { k: '90d', l: '3 tháng', s: '90 ngày', days: 90 },
  { k: '365d', l: 'Năm', s: '12 tháng', days: 365 }
];
const TREND_METRICS = [
  { key: 'weight', field: 'weight', name: 'Cân nặng', unit: 'kg', dec: 2, color: '#6949E8', minSpan: 0.6 },
  { key: 'fat', field: 'body_fat_pct', name: 'Tỷ lệ mỡ', unit: '%', dec: 1, color: '#E07B39', minSpan: 0.4, goodDir: -1 },
  { key: 'muscle', field: 'skeletal_muscle_kg', name: 'Cơ xương', unit: 'kg', dec: 1, color: '#2F8A57', minSpan: 0.4, goodDir: 1 }
];
const SOURCE_NAME = { manual: 'Nhập tay', huawei_scale: 'Cân Huawei', csv_import: 'Nhập file' };
const ACTIVITY_OPTIONS = [
  ['sedentary', 'Ít vận động (ngồi văn phòng)'],
  ['light', 'Nhẹ (tập 1–3 buổi/tuần)'],
  ['moderate', 'Vừa (tập 3–5 buổi/tuần)'],
  ['active', 'Nặng (tập 6–7 buổi/tuần)'],
  ['very_active', 'Rất nặng (lao động nặng / VĐV)']
];

const toneOf = (delta, goodDir) => {
  if (delta == null || Math.abs(delta) < 0.001 || !goodDir) return 'muted';
  return delta * goodDir > 0 ? 'good' : 'bad';
};
const slotLabelOf = m => {
  if (m?.time_slot === 'morning') return 'Buổi sáng';
  if (m?.time_slot === 'evening') return 'Buổi tối';
  const h = new Date(m?.measured_at).getHours();
  return h < 11 ? 'Buổi sáng' : h < 14 ? 'Buổi trưa' : h < 18 ? 'Buổi chiều' : 'Buổi tối';
};
const timeOf = m => new Date(m.measured_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/** Đồng hồ BMI nửa vòng: thang 15–32, kim đặt theo BMI; số cân nằm dưới vòng cung (không đè lên). */
function BmiGauge({ bmi, color, weightText, small }) {
  const cx = 150;
  const cy = 158;
  const R = 124;
  const r1 = v => Math.round(v * 10) / 10;
  const pt = (a, r = R) => [r1(cx + r * Math.cos(a)), r1(cy - r * Math.sin(a))];
  const arc = (a1, a2) => {
    const p1 = pt(a1);
    const p2 = pt(a2);
    return `M${p1[0]} ${p1[1]}A${R} ${R} 0 0 1 ${p2[0]} ${p2[1]}`;
  };
  const gap = 0.012;
  const marker = bmi != null ? pt(bmiGaugeAngle(bmi, GAUGE_LO, GAUGE_HI)) : null;
  const ticks = [[18.5, '18,5'], [23, '23'], [25, '25']].map(([v, t]) => {
    const p = pt(bmiGaugeAngle(v, GAUGE_LO, GAUGE_HI), R + 22);
    return { x: p[0], y: p[1], t };
  });

  return (
    <div className={`body-bm-gauge${small ? ' is-small' : ''}`}>
      <svg viewBox="0 0 300 176" aria-hidden="true">
        <path d={arc(Math.PI, 0)} className="bm-gauge-track" />
        {bmi != null
          ? GAUGE_SEGS.map(([a, b, c], i) => (
            <path
              key={c}
              d={arc(bmiGaugeAngle(a) - (i ? gap : 0), bmiGaugeAngle(b) + (i < 3 ? gap : 0))}
              stroke={c}
              className="bm-gauge-seg"
            />
          ))
          : <path d={arc(Math.PI, 0)} className="bm-gauge-seg is-empty" />}
        {marker && <circle cx={marker[0]} cy={marker[1]} r="11" stroke={color} className="bm-gauge-marker" />}
        {bmi != null && ticks.map(t => (
          <text key={t.t} x={t.x} y={t.y + 3.5} textAnchor="middle" className="bm-gauge-tick">{t.t}</text>
        ))}
        {bmi != null && (
          <>
            <text x={cx - R} y={cy + 19} textAnchor="middle" className="bm-gauge-tick">15</text>
            <text x={cx + R} y={cy + 19} textAnchor="middle" className="bm-gauge-tick">32</text>
          </>
        )}
      </svg>
      <div className="body-bm-gauge-center">
        <b>{weightText}<small>kg</small></b>
        <span>Cân nặng</span>
      </div>
    </div>
  );
}

/** Biểu đồ xu hướng: đường cong mượt, vùng tô mờ, trục tự co theo dữ liệu, nhãn giá trị lần cuối. */
function TrendChart({ points, color, unit, dec, minSpan, mobile }) {
  const [ref, W] = useElementWidth();
  const H = mobile ? 170 : 214;
  const gradId = `bmFill${mobile ? 'M' : 'D'}`;

  const chart = useMemo(() => {
    if (W < 120 || points.length < 2) return null;
    const padL = 4;
    const padR = mobile ? 34 : 44;
    const padT = mobile ? 34 : 40;
    const padB = 24;
    const pw = W - padL - padR;
    const ph = H - padT - padB;
    const base = padT + ph;
    const vals = points.map(p => p.val);
    const { lo, hi } = trendDomain(vals, minSpan);
    const x = i => padL + (i / (points.length - 1)) * pw;
    const y = v => padT + (1 - (v - lo) / (hi - lo)) * ph;
    const P = vals.map((v, i) => [x(i), y(v)]);
    const line = smoothPath(P);
    const last = P[P.length - 1];
    const area = `${line}L${last[0]} ${base}L${P[0][0]} ${base}Z`;
    const lastY = last[1];
    const grid = [0, 1, 2, 3].map(k => {
      const v = lo + (hi - lo) * (k / 3);
      const yy = y(v);
      return { y: yy, label: Math.abs(yy - (lastY - 24)) > 16 ? f(v, 1) : null };
    });
    const minGap = mobile ? 56 : 72;
    const n = points.length - 1;
    const keep = [0];
    for (let i = 1; i < n; i++) {
      if (x(i) - x(keep[keep.length - 1]) >= minGap && x(n) - x(i) >= minGap) keep.push(i);
    }
    keep.push(n);
    return { padL, pw, base, line, area, grid, last, keep, P, x };
  }, [W, H, mobile, points, minSpan]);

  return (
    <div ref={ref} className={`body-bm-trend-chart${mobile ? ' is-mobile' : ''}`} style={{ height: H }}>
      {points.length < 2 ? (
        <div className="body-bm-trend-empty">
          <AppIcon name="chartLine" size={20} />
          <span>Cần ít nhất 2 ngày có số đo trong khoảng này để vẽ xu hướng.</span>
        </div>
      ) : chart && (
        <>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Biểu đồ xu hướng">
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={color} stopOpacity="0.2" />
                <stop offset="1" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {chart.grid.map((g, k) => (
              <g key={k}>
                <line x1={chart.padL} x2={chart.padL + chart.pw} y1={g.y} y2={g.y} className="bm-grid" />
                {g.label && <text x={W - (mobile ? 30 : 38)} y={g.y + 3.5} className="bm-tick">{g.label}</text>}
              </g>
            ))}
            <path d={chart.area} fill={`url(#${gradId})`} />
            <path d={chart.line} fill="none" stroke={color} strokeWidth={mobile ? 2.2 : 2.5} strokeLinecap="round" strokeLinejoin="round" />
            <line x1={chart.last[0]} x2={chart.last[0]} y1={chart.last[1]} y2={chart.base} stroke={color} strokeDasharray="2 3" opacity="0.5" />
            {chart.P.map((p, i) => (
              <circle
                key={i}
                cx={p[0]}
                cy={p[1]}
                r={i === chart.P.length - 1 ? (mobile ? 4.5 : 5.5) : (mobile ? 2.6 : 3.2)}
                className="bm-point"
                stroke={color}
              />
            ))}
            {chart.keep.map((i, k) => (
              <text
                key={i}
                x={chart.x(i)}
                y={chart.base + 16}
                textAnchor={k === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
                className="bm-tick"
              >
                {ddmm(points[i].date)}
              </text>
            ))}
          </svg>
          <span className="body-bm-trend-last" style={{ left: chart.last[0], top: chart.last[1] }}>
            {f(points[points.length - 1].val, dec)} {unit}
          </span>
        </>
      )}
    </div>
  );
}

export default function BiometricsScreen() {
  const {
    hasLoaded,
    measurements,
    latest,
    profile,
    bmiInfo,
    bmr,
    tdee,
    bodyScore,
    addMeasurement,
    toggleOutlier,
    deleteMeasurement,
    updateProfile
  } = useBiometrics();

  const [activeTab, setActiveTab] = useState('analysis'); // 'analysis' | 'history' | 'profile'
  const [rangeTab, setRangeTab] = useState('30d');
  const [now] = useState(() => Date.now());
  const [selectedMetric, setSelectedMetric] = useState('weight');
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [inspectorOpen, setInspectorOpen] = useState(false); // mobile: ngăn chi tiết lần đo
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Form thêm cân đo
  const [newWeight, setNewWeight] = useState('');
  const [newFat, setNewFat] = useState('');
  const [newMuscle, setNewMuscle] = useState('');
  const [newVisceral, setNewVisceral] = useState('');
  const [newWater, setNewWater] = useState('');
  const [newBone, setNewBone] = useState('');
  const [newTimeSlot, setNewTimeSlot] = useState('morning');

  // Thước dây (US Navy & WHtR)
  const [showTapeCalc, setShowTapeCalc] = useState(false);
  const [tapeWaist, setTapeWaist] = useState('');
  const [tapeNeck, setTapeNeck] = useState('');
  const [tapeHip, setTapeHip] = useState('');
  const [tapeCalculated, setTapeCalculated] = useState(null);

  // Hồ sơ
  const [editHeight, setEditHeight] = useState(profile?.height_cm || '');
  const [editGoalWeight, setEditGoalWeight] = useState(profile?.goal_weight_kg || '');
  const [editActivity, setEditActivity] = useState(profile?.activity_level || 'moderate');
  const [editGender, setEditGender] = useState(profile?.gender || 'male');
  const [editBirthYear, setEditBirthYear] = useState(profile?.birth_year || '');
  const [profileSaved, setProfileSaved] = useState(false);
  const savedTimerRef = useRef(null);

  // Hồ sơ tải xong / đổi → đổ vào form (điều chỉnh state ngay khi render, không qua effect)
  const [syncedProfile, setSyncedProfile] = useState(profile);
  if (profile !== syncedProfile) {
    setSyncedProfile(profile);
    if (profile) {
      if (profile.height_cm != null) setEditHeight(profile.height_cm);
      if (profile.goal_weight_kg != null) setEditGoalWeight(profile.goal_weight_kg);
      if (profile.activity_level) setEditActivity(profile.activity_level);
      if (profile.gender) setEditGender(profile.gender);
      if (profile.birth_year != null) setEditBirthYear(profile.birth_year);
    }
  }

  // Chưa chọn lần đo nào thì xem lần mới nhất
  const activeHistoryId = selectedHistoryId ?? latest?.id ?? null;

  useEffect(() => () => clearTimeout(savedTimerRef.current), []);

  // Header mobile của BodyPage bấm "+" → mở form thêm cân đo
  useEffect(() => {
    const open = () => setShowAddModal(true);
    window.addEventListener('body:add-measurement', open);
    return () => window.removeEventListener('body:add-measurement', open);
  }, []);

  // Escape đóng modal / ngăn chi tiết
  useEffect(() => {
    if (!showAddModal && !inspectorOpen) return undefined;
    const onKey = e => {
      if (e.key !== 'Escape') return;
      setShowAddModal(false);
      setInspectorOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAddModal, inspectorOpen]);

  const heightCm = profile?.height_cm ? Number(profile.height_cm) : null;
  const isFemale = profile?.gender === 'female';
  const validMeasurements = useMemo(() => measurements.filter(m => !m.is_outlier), [measurements]);

  const openAddModal = (withTape = false) => {
    setSaveError('');
    setShowTapeCalc(withTape);
    setShowAddModal(true);
  };

  // Thước dây US Navy: chỉ tính khi có chiều cao thật; WHtR chỉ để tham khảo
  const handleRunTapeCalc = () => {
    const gender = editGender || profile?.gender || 'male';
    const height = editHeight ? Number(editHeight) : heightCm;
    if (!height) {
      setTapeCalculated({ error: 'Cần nhập chiều cao ở tab Hồ sơ trước khi tính.' });
      return;
    }
    if (gender !== 'male' && gender !== 'female') {
      setTapeCalculated({ error: 'Công thức Navy chỉ có cho Nam / Nữ — chọn giới tính ở tab Hồ sơ.' });
      return;
    }
    if (!Number(tapeWaist) || !Number(tapeNeck)) {
      setTapeCalculated({ error: 'Nhập vòng eo và vòng cổ.' });
      return;
    }
    const navyFat = calculateNavyBodyFat(gender, height, Number(tapeWaist), Number(tapeNeck), Number(tapeHip));
    const whtr = estimateVisceralFatFromWaist(Number(tapeWaist), height);
    if (navyFat == null) {
      setTapeCalculated({ error: 'Số đo chưa hợp lệ (vòng eo phải lớn hơn vòng cổ).' });
      return;
    }
    setTapeCalculated({ fatPct: navyFat, whtr: whtr?.whtr ?? null, whtrStatus: whtr?.status || null });
    setNewFat(String(navyFat));
  };

  const handleSaveMeasurement = async (e) => {
    e.preventDefault();
    if (!newWeight) return;
    setSaveError('');
    try {
      await addMeasurement({
        weight: newWeight,
        body_fat_pct: newFat || null,
        skeletal_muscle_kg: newMuscle || null,
        visceral_fat: newVisceral || null,
        water_pct: newWater || null,
        bone_mass_kg: newBone || null,
        time_slot: newTimeSlot,
        // DB chỉ nhận manual | huawei_scale | csv_import; số đo bằng thước dây vẫn là nhập tay
        source: 'manual',
        is_outlier: newTimeSlot === 'evening'
      });
      setNewWeight('');
      setNewFat('');
      setNewMuscle('');
      setNewVisceral('');
      setNewWater('');
      setNewBone('');
      setShowTapeCalc(false);
      setTapeCalculated(null);
      setShowAddModal(false);
    } catch (err) {
      console.error('Error adding measurement:', err);
      setSaveError('Không lưu được số đo. Kiểm tra kết nối rồi thử lại.');
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      await updateProfile({
        height_cm: editHeight ? Number(editHeight) : null,
        goal_weight_kg: editGoalWeight ? Number(editGoalWeight) : null,
        activity_level: editActivity,
        gender: editGender,
        birth_year: editBirthYear ? Number(editBirthYear) : null
      });
      setProfileSaved(true);
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setProfileSaved(false), 2500);
    } catch (err) {
      console.error('Error saving profile:', err);
    }
  };

  const submitOnCtrlEnter = e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.requestSubmit();
    }
  };

  // ── LẦN ĐO GẦN NHẤT + BMI ────────────────────────────────────
  const bmiKey = bmiInfo?.category?.key || null;
  const bmiColor = BMI_COLOR[bmiKey] || 'var(--body-text-muted)';
  const bodyScoreLabel = bodyScore == null ? null
    : bodyScore >= 80 ? 'Rất tốt' : bodyScore >= 65 ? 'Cân đối' : bodyScore >= 50 ? 'Trung bình' : 'Cần cải thiện';
  const latestStatus = latest
    ? `${SOURCE_NAME[latest.source] || 'Nhập tay'} · ${new Date(latest.measured_at).toLocaleDateString('vi-VN')} ${timeOf(latest)}`
    : 'Chưa có số đo';

  // ── THÀNH PHẦN CƠ THỂ: chỉ khi đã đo mỡ (4 phần khi có thêm nước + khoáng xương) ──
  const composition = useMemo(() => {
    if (!latest?.weight || latest.body_fat_pct == null) return null;
    const w = Number(latest.weight);
    const full = calculateBodyComposition(
      w,
      Number(latest.body_fat_pct),
      latest.water_pct != null ? Number(latest.water_pct) : null,
      latest.bone_mass_kg != null ? Number(latest.bone_mass_kg) : null
    );
    const fatKg = Number(((w * Number(latest.body_fat_pct)) / 100).toFixed(2));
    const parts = full
      ? [
          { name: 'Hàm lượng nước', short: 'Nước', val: full.waterKg, color: '#4A8FE7' },
          { name: 'Chất đạm & khác', short: 'Đạm & khác', val: full.proteinKg, color: '#E8A33D' },
          { name: 'Mỡ', short: 'Mỡ', val: full.fatKg, color: '#D9503F' },
          { name: 'Khoáng xương', short: 'Khoáng xương', val: full.boneKg, color: '#5CC8A8' }
        ]
      : [
          { name: 'Mỡ', short: 'Mỡ', val: fatKg, color: '#D9503F' },
          { name: 'Khối không mỡ', short: 'Không mỡ', val: Number((w - fatKg).toFixed(2)), color: '#4A8FE7' }
        ];
    const tot = parts.reduce((acc, p) => acc + p.val, 0) || w;
    const C = 2 * Math.PI * 74;
    let acc = 0;
    return {
      total: f(w, 2),
      isFull: Boolean(full),
      parts: parts.map(p => {
        const len = (p.val / tot) * C;
        const seg = { ...p, kg: f(p.val, 2), pct: f((p.val / tot) * 100, 1), da: `${Math.max(0, len - 3).toFixed(1)} ${C.toFixed(1)}`, off: (-acc).toFixed(1) };
        acc += len;
        return seg;
      })
    };
  }, [latest]);

  // ── 9 CHỈ SỐ: chỉ hiện số đã đo / tính từ dữ liệu thật; thiếu thì "Chưa đo" ──
  const metrics = useMemo(() => {
    if (!latest) return [];
    const w = Number(latest.weight);
    const num = v => (v == null ? null : Number(v));
    const previousValueOf = field => {
      const prev = validMeasurements.find(m => m.id !== latest.id && m[field] != null);
      return prev ? Number(prev[field]) : null;
    };
    const fat = num(latest.body_fat_pct);
    const fatRange = isFemale ? [18, 28] : [10, 20];
    const waterRange = isFemale ? [45, 60] : [50, 65];
    const prevW = previousValueOf('weight');
    const prevFat = previousValueOf('body_fat_pct');
    const ffm = fat != null ? Number((w * (1 - fat / 100)).toFixed(1)) : null;
    const prevFfm = prevFat != null && prevW != null ? Number((prevW * (1 - prevFat / 100)).toFixed(1)) : null;
    const healthyW = heightCm ? [weightForBmi(18.5, heightCm), weightForBmi(22.9, heightCm)] : null;
    const prevBmi = heightCm && prevW ? Number((prevW / ((heightCm / 100) ** 2)).toFixed(1)) : null;
    const bmiLabel = bmiKey ? BMI_SHORT[bmiKey] : null;

    // [tên, giá trị, đơn vị, số lẻ, nguồn, khoảng chuẩn, giá trị trước, hướng tốt, nhãn trạng thái, nhãn ngắn]
    const rows = [
      ['Cân nặng', w, 'kg', 2, 'measured', healthyW, prevW, 0, bmiLabel, bmiLabel],
      ['BMI', bmiInfo?.bmi ?? null, '', 1, bmiInfo ? 'formula' : null, [18.5, 22.9], prevBmi, 0, bmiLabel ? `${bmiLabel} (Á Đông)` : null, bmiLabel],
      ['Tỷ lệ mỡ', fat, '%', 1, fat != null ? 'measured' : null, fatRange, prevFat, -1, null, null],
      ['Cơ xương', num(latest.skeletal_muscle_kg), 'kg', 1, latest.skeletal_muscle_kg != null ? 'measured' : null, null, previousValueOf('skeletal_muscle_kg'), 1, null, null],
      ['Mỡ nội tạng', num(latest.visceral_fat), 'mức', 0, latest.visceral_fat != null ? 'measured' : null, [1, 9], previousValueOf('visceral_fat'), -1, null, null],
      ['Trao đổi chất (BMR)', bmr, 'kcal', 0, bmr ? 'formula' : null, null, null, 0, bmr ? 'Mifflin-St Jeor' : null, bmr ? 'Mifflin-St Jeor' : null],
      ['Tỷ lệ nước', num(latest.water_pct), '%', 1, latest.water_pct != null ? 'measured' : null, waterRange, previousValueOf('water_pct'), 1, null, null],
      ['Khoáng xương', num(latest.bone_mass_kg), 'kg', 2, latest.bone_mass_kg != null ? 'measured' : null, null, previousValueOf('bone_mass_kg'), 0, null, null],
      ['Khối không mỡ', ffm, 'kg', 1, ffm != null ? 'formula' : null, null, prevFfm, 1, null, null]
    ];

    return rows.map(([name, val, unit, dec, source, range, prev, goodDir, label, labelShort]) => {
      const has = val != null && !Number.isNaN(val);
      const inRange = has && range ? val >= range[0] && val <= range[1] : null;
      const delta = has && prev != null ? Number((val - prev).toFixed(dec)) : null;
      let status = 'Chưa đo';
      let statusShort = 'Chưa đo';
      let statusTone = 'muted';
      if (has) {
        if (label) {
          status = label;
          statusShort = labelShort || label;
          statusTone = inRange === false ? 'warn' : inRange ? 'good' : 'neutral';
        } else if (range) {
          status = inRange ? 'Trong khoảng chuẩn' : val < range[0] ? 'Thấp hơn chuẩn' : 'Cao hơn chuẩn';
          statusShort = inRange ? 'Trong chuẩn' : val < range[0] ? 'Thấp' : 'Cao';
          statusTone = inRange ? 'good' : 'warn';
        } else if (delta != null && delta !== 0 && goodDir) {
          status = delta * goodDir > 0 ? 'Tốt hơn lần trước' : 'Kém hơn lần trước';
          statusShort = delta > 0 ? 'Tăng' : 'Giảm';
          statusTone = delta * goodDir > 0 ? 'good' : 'warn';
        } else {
          status = source === 'formula' ? 'Tính từ số đo' : 'Đã đo';
          statusShort = status;
          statusTone = 'neutral';
        }
      }
      // Thanh khoảng chuẩn: dải hiển thị rộng hơn khoảng chuẩn 40% mỗi bên
      let bar = null;
      if (has && range) {
        const span = range[1] - range[0];
        const mn = range[0] - span * 0.4;
        const mx = range[1] + span * 0.4;
        bar = {
          f1: (range[0] - mn) / (mx - mn),
          f2: span / (mx - mn),
          f3: (mx - range[1]) / (mx - mn),
          pos: `${Math.max(0, Math.min(100, ((val - mn) / (mx - mn)) * 100)).toFixed(1)}%`
        };
      }
      return {
        name,
        value: has ? f(val, dec) : '—',
        unit: has ? unit : '',
        source: has ? source : null,
        delta: delta == null ? '' : fs(delta, dec),
        deltaTone: toneOf(delta, goodDir),
        status,
        statusShort,
        statusTone,
        rangeText: range ? `chuẩn ${f(range[0], dec === 0 ? 0 : 1)}–${f(range[1], dec === 0 ? 0 : 1)}` : unit === 'kcal' ? 'kcal/ngày' : unit,
        bar
      };
    });
  }, [latest, bmiInfo, bmiKey, bmr, validMeasurements, heightCm, isFemale]);

  // ── XU HƯỚNG ─────────────────────────────────────────────────
  const range = RANGES.find(r => r.k === rangeTab) || RANGES[1];
  const goalW = profile?.goal_weight_kg ? Number(profile.goal_weight_kg) : null;
  const trend = useMemo(() => {
    const cutoff = now - range.days * 86400000;
    const weightDir = goalW != null && latest?.weight ? (goalW < Number(latest.weight) ? -1 : 1) : 0;
    const series = TREND_METRICS.map(tm => {
      const pts = dailyAverageSeries(validMeasurements, tm.field, cutoff);
      const cur = pts.length ? pts[pts.length - 1].val : null;
      const delta = pts.length >= 2 ? pts[pts.length - 1].val - pts[0].val : null;
      const goodDir = tm.key === 'weight' ? weightDir : tm.goodDir;
      return { ...tm, pts, cur, delta, tone: toneOf(delta, goodDir) };
    });
    const sel = series.find(s => s.key === selectedMetric) || series[0];
    let goal = null;
    if (sel.key === 'weight' && goalW != null && sel.cur != null) {
      const remain = goalW - sel.cur;
      const d = sel.delta;
      const towardGoal = d == null || Math.abs(d) < 0.005 ? null : (remain > 0 ? d > 0 : d < 0);
      goal = {
        target: f(goalW, 1),
        remain: Math.abs(remain) < 0.05 ? 'đã đạt' : `${remain > 0 ? '+' : '−'}${f(Math.abs(remain), 2)} kg`,
        reached: Math.abs(remain) < 0.05,
        text: d == null || Math.abs(d) < 0.005
          ? 'Kỳ này cân nặng không đổi.'
          : `Kỳ này ${d < 0 ? 'giảm' : 'tăng'} ${f(Math.abs(d), 2)} kg, ${towardGoal ? 'đúng' : 'ngược'} hướng mục tiêu.`
      };
    }
    return { series, sel, goal };
  }, [validMeasurements, now, range, selectedMetric, goalW, latest]);

  // ── LỊCH SỬ GOM THEO NGÀY ────────────────────────────────────
  const history = useMemo(() => {
    const groupsMap = new Map();
    measurements.forEach(m => {
      if (!groupsMap.has(m.local_date)) groupsMap.set(m.local_date, []);
      groupsMap.get(m.local_date).push(m);
    });
    const groups = Array.from(groupsMap.entries()).map(([dateStr, items]) => {
      const valid = items.filter(i => !i.is_outlier);
      const avg = (valid.length ? valid : items).reduce((acc, cur) => acc + Number(cur.weight), 0) / (valid.length || items.length);
      const d = new Date(`${dateStr}T00:00:00`);
      return {
        dateStr,
        label: `${d.toLocaleDateString('vi-VN', { weekday: 'long' })}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
        avg: f(avg, 2),
        items: items.map(item => {
          const parts = [];
          if (item.body_fat_pct != null) parts.push(`${f(item.body_fat_pct)}% mỡ`);
          if (item.skeletal_muscle_kg != null) parts.push(`${f(item.skeletal_muscle_kg)} kg cơ`);
          return { ...item, weightStr: f(item.weight, 2), timeStr: timeOf(item), sub: parts.length ? parts.join(' · ') : 'Chỉ cân nặng' };
        })
      };
    });

    const activeItem = measurements.find(m => m.id === activeHistoryId) || measurements[0] || null;
    let inspector = null;
    if (activeItem) {
      const w = Number(activeItem.weight);
      const fat = activeItem.body_fat_pct != null ? Number(activeItem.body_fat_pct) : null;
      const mus = activeItem.skeletal_muscle_kg != null ? Number(activeItem.skeletal_muscle_kg) : null;
      const bmiVal = heightCm ? w / ((heightCm / 100) ** 2) : null;
      inspector = {
        item: activeItem,
        when: `${new Date(activeItem.measured_at).toLocaleDateString('vi-VN')} · ${timeOf(activeItem)} · ${slotLabelOf(activeItem)}`,
        source: SOURCE_NAME[activeItem.source] || 'Nhập tay',
        weight: f(w, 2),
        rows: [
          { name: 'BMI', val: bmiVal != null ? f(bmiVal, 1) : '—', unit: bmiVal != null ? '' : 'cần chiều cao' },
          { name: 'Tỷ lệ mỡ', val: f(fat, 1), unit: fat != null ? '%' : '' },
          { name: 'Cơ xương', val: f(mus, 1), unit: mus != null ? 'kg' : '' },
          { name: 'Khối mỡ', val: fat != null ? f((w * fat) / 100, 2) : '—', unit: fat != null ? 'kg' : '' },
          { name: 'Khối không mỡ', val: fat != null ? f(w * (1 - fat / 100), 2) : '—', unit: fat != null ? 'kg' : '' },
          { name: 'Mỡ nội tạng', val: f(activeItem.visceral_fat, 0), unit: activeItem.visceral_fat != null ? 'mức' : '' },
          { name: 'Tỷ lệ nước', val: f(activeItem.water_pct, 1), unit: activeItem.water_pct != null ? '%' : '' }
        ]
      };
    }

    // So với lần cân hợp lệ gần nhất cách ít nhất 7 ngày
    let delta7 = null;
    const latestValid = validMeasurements[0];
    if (latestValid) {
      const t0 = new Date(latestValid.measured_at).getTime();
      const ref = validMeasurements.find(m => t0 - new Date(m.measured_at).getTime() >= 7 * 86400000);
      if (ref) delta7 = Number(latestValid.weight) - Number(ref.weight);
    }
    const towardGoal = delta7 != null && goalW != null && latestValid
      ? (Number(latestValid.weight) > goalW ? delta7 < 0 : delta7 > 0)
      : null;
    return {
      groups,
      inspector,
      total: measurements.length,
      latestWeight: latestValid ? f(latestValid.weight, 2) : '—',
      delta7: delta7 == null ? '—' : fs(delta7, 2),
      delta7Tone: towardGoal == null ? 'neutral' : towardGoal ? 'good' : 'bad'
    };
  }, [measurements, validMeasurements, activeHistoryId, goalW, heightCm]);

  // ── MỤC TIÊU CÂN NẶNG ────────────────────────────────────────
  const weightGoal = useMemo(() => {
    const cur = validMeasurements[0] ? Number(validMeasurements[0].weight) : null;
    const start = validMeasurements.length ? Number(validMeasurements[validMeasurements.length - 1].weight) : null;
    if (goalW == null || cur == null) return { goal: goalW, cur, pct: null };
    const pct = start !== goalW ? Math.max(0, Math.min(100, Math.round(((start - cur) / (start - goalW)) * 100))) : 100;
    return { goal: goalW, cur, start, pct, remain: Math.abs(cur - goalW) };
  }, [goalW, validMeasurements]);

  if (!hasLoaded) return <SkeletonList heading rows={4} gap="10px" label="Đang tải số đo" />;

  const age = profile?.birth_year ? new Date().getFullYear() - profile.birth_year : null;
  const tabs = [['analysis', 'Phân tích'], ['history', 'Lịch sử'], ['profile', 'Hồ sơ']];
  const scoreC = 2 * Math.PI * 19;

  // ── KHỐI GIAO DIỆN ───────────────────────────────────────────
  const gaugeCard = (
    <section className="body-bm-card body-bm-gauge-card">
      <div className="body-bm-card-head">
        <b>Lần đo gần nhất</b>
        {latest && <small>{ddmm(latest.local_date)} · {slotLabelOf(latest)}</small>}
      </div>
      {latest ? (
        <>
          <BmiGauge bmi={bmiInfo?.bmi ?? null} color={bmiColor} weightText={f(latest.weight, 2)} />
          <div className="body-bm-bmi-chips">
            {bmiInfo ? (
              <>
                <span className={`body-bm-bmi-chip is-${bmiKey}`}>
                  <b>BMI {f(bmiInfo.bmi, 1)}</b><i />{BMI_SHORT[bmiKey]}
                </span>
                <span className="body-bm-chip">Chuẩn Á Đông</span>
              </>
            ) : (
              <button type="button" className="body-bm-chip is-action" onClick={() => setActiveTab('profile')}>
                <AppIcon name="ruler" size={13} />Nhập chiều cao để tính BMI
              </button>
            )}
          </div>
          {bmiInfo && (
            <div className="body-bm-legend">
              {BMI_LEGEND.map(([k, label, rangeText]) => (
                <span key={k} className={k === bmiKey ? 'is-on' : ''}>
                  <b><i style={{ background: BMI_COLOR[k] }} />{label}</b>
                  <small>{rangeText}</small>
                </span>
              ))}
            </div>
          )}
          {bodyScore != null && (
            <div className="body-bm-score">
              <span className="body-bm-score-ring">
                <svg viewBox="0 0 46 46" aria-hidden="true">
                  <circle cx="23" cy="23" r="19" className="bm-score-track" />
                  <circle cx="23" cy="23" r="19" className="bm-score-bar" strokeDasharray={`${((bodyScore / 100) * scoreC).toFixed(1)} ${scoreC.toFixed(1)}`} />
                </svg>
                <b>{bodyScore}</b>
              </span>
              <span className="body-bm-score-text">
                <b>Điểm cơ thể {bodyScore}/100 · {bodyScoreLabel}</b>
                <small>Ước tính từ BMI và các chỉ số đã đo</small>
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="body-bm-empty">
          <span><AppIcon name="scales" size={24} /></span>
          <b>Chưa có lần đo nào</b>
          <p>Thêm số cân đầu tiên để xem BMI, xu hướng và các chỉ số cơ thể.</p>
          <button type="button" className="body-bm-btn is-dark" onClick={() => openAddModal()}>
            <AppIcon name="plus" size={14} />Thêm cân đo
          </button>
        </div>
      )}
    </section>
  );

  const rangeSeg = (
    <div className="body-bm-seg is-small" role="group" aria-label="Khoảng thời gian">
      {RANGES.map(r => (
        <button key={r.k} type="button" className={rangeTab === r.k ? 'is-on' : ''} onClick={() => setRangeTab(r.k)} aria-pressed={rangeTab === r.k}>
          {r.l}
        </button>
      ))}
    </div>
  );

  const trendTiles = (
    <div className="body-bm-tiles">
      {trend.series.map(t => (
        <button
          key={t.key}
          type="button"
          className={`body-bm-tile${t.key === trend.sel.key ? ' is-on' : ''}`}
          style={t.key === trend.sel.key ? { borderColor: t.color } : undefined}
          onClick={() => setSelectedMetric(t.key)}
          aria-pressed={t.key === trend.sel.key}
        >
          <span className="body-bm-tile-name"><i style={{ background: t.color }} />{t.name}</span>
          <span className="body-bm-tile-row">
            <b>{t.cur != null ? f(t.cur, t.dec) : '—'}<small>{t.cur != null ? t.unit : ''}</small></b>
            <em className={`is-${t.tone}`}>{t.delta != null ? fs(t.delta, t.dec) : ''}</em>
          </span>
        </button>
      ))}
    </div>
  );

  const goalLine = trend.goal && (
    <div className="body-bm-goal">
      <AppIcon name="flagPennant" size={15} />
      <span>
        {trend.goal.reached
          ? <>Đã đạt mục tiêu <b>{trend.goal.target} kg</b>. {trend.goal.text}</>
          : <>Mục tiêu <b>{trend.goal.target} kg</b> · còn <b className="is-good">{trend.goal.remain}</b> nữa. {trend.goal.text}</>}
      </span>
    </div>
  );

  const scienceCard = (
    <section className="body-bm-science">
      <span className="body-bm-science-ic"><AppIcon name="flask" size={17} /></span>
      <span className="body-bm-science-text">
        <b>Cơ sở khoa học &amp; Nguồn dữ liệu chỉ số</b>
        <small>
          <strong>BMI &amp; BMR:</strong> Tính từ chiều cao, cân nặng, tuổi (thang BMI châu Á &amp; Mifflin-St Jeor).
          Chỉ số chưa đo sẽ hiện "Chưa đo" — app không tự điền giá trị ước đoán.
        </small>
      </span>
      <button type="button" className="body-bm-science-btn" onClick={() => openAddModal(true)}>
        <AppIcon name="ruler" size={14} />Không có cân? Đo bằng thước dây (US Navy)
      </button>
    </section>
  );

  const metricCards = (
    <div className="body-bm-metrics">
      {metrics.map(m => (
        <div key={m.name} className="body-bm-metric">
          <div className="body-bm-metric-head">
            <span>{m.name}</span>
            {m.source && <em className={`is-${m.source}`}>{m.source === 'formula' ? 'Công thức' : 'Đã đo'}</em>}
            {m.source && <i className={`body-bm-metric-dot is-${m.source}`} />}
          </div>
          <div className="body-bm-metric-val">
            <b>{m.value}<small>{m.unit}</small></b>
            {m.delta && <em className={`is-${m.deltaTone}`}>{m.delta}</em>}
          </div>
          <div className={`body-bm-bar${m.bar ? '' : ' is-hidden'}`} aria-hidden="true">
            {m.bar && (
              <>
                <span style={{ flex: m.bar.f1 }} />
                <span style={{ flex: m.bar.f2 }} />
                <span style={{ flex: m.bar.f3 }} />
                <i style={{ left: m.bar.pos }} />
              </>
            )}
          </div>
          <div className="body-bm-metric-foot">
            <span className={`is-${m.statusTone}`}>
              <span className="body-bm-d-text">{m.status}</span>
              <span className="body-bm-m-text">{m.statusShort}</span>
            </span>
            <small>{m.rangeText}</small>
          </div>
        </div>
      ))}
    </div>
  );

  const compositionCard = (
    <section className="body-bm-card body-bm-comp">
      <div className="body-bm-card-head">
        <b>Thành phần cơ thể</b>
        {composition && <em className="body-bm-badge is-measured">Đã đo</em>}
      </div>
      {composition ? (
        <div className="body-bm-comp-body">
          <div className="body-bm-donut">
            <svg viewBox="0 0 180 180" aria-hidden="true">
              {composition.parts.map(p => (
                <circle key={p.name} cx="90" cy="90" r="74" stroke={p.color} strokeDasharray={p.da} strokeDashoffset={p.off} className="bm-donut-seg" />
              ))}
            </svg>
            <span><b>{composition.total}</b><small>kg tổng</small></span>
          </div>
          <div className="body-bm-comp-list">
            {composition.parts.map(p => (
              <div key={p.name}>
                <span><i style={{ background: p.color }} /><span className="body-bm-d-text">{p.name}</span><span className="body-bm-m-text">{p.short}</span></span>
                <b>{p.kg} kg</b>
                <small>{p.pct}%</small>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="body-bm-comp-empty">
          <AppIcon name="chartDonut" size={20} />
          <span>Cần đo tỷ lệ mỡ (cân InBody hoặc thước dây) để tính thành phần cơ thể.</span>
        </div>
      )}
      {composition && (
        <small className="body-bm-footnote">
          {composition.isFull
            ? 'Thành phần (kg) = nước + mỡ + khoáng xương + phần còn lại (đạm & khác).'
            : 'Đo thêm tỷ lệ nước và khoáng xương để tách đủ 4 phần.'}
        </small>
      )}
    </section>
  );

  const inspector = history.inspector && (
    <aside className={`body-bm-card body-bm-insp${inspectorOpen ? ' is-open' : ''}`} aria-label="Chi tiết lần đo">
      <span className="body-bm-sheet-grip" />
      <div className="body-bm-insp-head">
        <small>{history.inspector.when}</small>
        <em className="body-bm-chip">{history.inspector.source}</em>
        <button type="button" className="body-bm-icon-btn body-bm-m-only" onClick={() => setInspectorOpen(false)} aria-label="Đóng">
          <AppIcon name="x" size={15} />
        </button>
      </div>
      <b className="body-bm-insp-weight">{history.inspector.weight}<small>kg</small></b>
      {history.inspector.item.is_outlier && (
        <div className="body-bm-outlier">
          <AppIcon name="warning" size={16} weight="fill" />
          <span>Lần đo này được đánh dấu lệch giờ (ví dụ đo buổi tối sau khi ăn no) nên tách khỏi đường xu hướng chính.</span>
        </div>
      )}
      <div className="body-bm-insp-rows">
        {history.inspector.rows.map(r => (
          <div key={r.name}>
            <span>{r.name}</span>
            <b>{r.val}<small>{r.unit}</small></b>
          </div>
        ))}
      </div>
      <div className="body-bm-insp-actions">
        <button type="button" className="body-bm-btn" onClick={() => toggleOutlier(history.inspector.item.id)}>
          <AppIcon name={history.inspector.item.is_outlier ? 'checkCircle' : 'warning'} size={14} />
          {history.inspector.item.is_outlier ? 'Đánh dấu bình thường' : 'Đánh dấu lệch giờ'}
        </button>
        <button type="button" className="body-bm-btn is-danger" onClick={() => setConfirmDeleteId(history.inspector.item.id)}>
          <AppIcon name="trash" size={14} />Xóa
        </button>
      </div>
    </aside>
  );

  return (
    <div className="body-bm">
      {/* ── THANH TRÊN: tab + trạng thái lần đo + thêm cân đo ── */}
      <div className="body-bm-top">
        <div className="body-bm-top-left">
          <div className="body-bm-seg" role="tablist" aria-label="Màn Cơ thể">
            {tabs.map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={activeTab === k} className={activeTab === k ? 'is-on' : ''} onClick={() => setActiveTab(k)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="body-bm-top-right">
          <span className="body-bm-status"><i className={latest ? 'is-on' : ''} />{latestStatus}</span>
          <button type="button" className="body-bm-btn is-dark" onClick={() => openAddModal()}>
            <AppIcon name="plus" size={14} />Thêm cân đo
          </button>
        </div>
      </div>

      {/* ── PHÂN TÍCH ─────────────────────────────────────────────── */}
      {activeTab === 'analysis' && (
        <div className="body-bm-analysis">
          <div className="body-bm-row1">
            {gaugeCard}
            <section className="body-bm-card body-bm-trend">
              <div className="body-bm-trend-head">
                <span className="body-bm-trend-title">
                  <b>Xu hướng</b>
                  <small>{range.s} · trung bình ngày</small>
                </span>
                {rangeSeg}
              </div>
              {trendTiles}
              <TrendChart points={trend.sel.pts} color={trend.sel.color} unit={trend.sel.unit} dec={trend.sel.dec} minSpan={trend.sel.minSpan} />
              <TrendChart points={trend.sel.pts} color={trend.sel.color} unit={trend.sel.unit} dec={trend.sel.dec} minSpan={trend.sel.minSpan} mobile />
              {goalLine}
            </section>
          </div>

          <div className="body-bm-d-only">{scienceCard}</div>

          {latest && (
            <div className="body-bm-row3">
              <div>
                {metricCards}
                <div className="body-bm-src-legend">
                  <span><i className="is-measured" />Đã đo</span>
                  <span><i className="is-formula" />Công thức</span>
                </div>
              </div>
              {compositionCard}
            </div>
          )}

          <div className="body-bm-m-only">{scienceCard}</div>
        </div>
      )}

      {/* ── LỊCH SỬ ──────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="body-bm-history">
          <div className="body-bm-hstats">
            <div><span>Cân nặng</span><b>{history.latestWeight}<small>kg</small></b></div>
            <div><span>7 ngày qua</span><b className={`is-${history.delta7Tone}`}>{history.delta7}<small>{history.delta7 === '—' ? '' : 'kg'}</small></b></div>
            <div><span>Số lần đo</span><b>{history.total}<small>lần</small></b></div>
          </div>

          <div className="body-bm-hgrid">
            <section className="body-bm-card body-bm-hlist">
              {history.groups.length === 0 ? (
                <div className="body-bm-empty">
                  <span><AppIcon name="scales" size={24} /></span>
                  <b>Chưa có lần đo nào</b>
                  <p>Bấm "Thêm cân đo" để ghi lần đầu.</p>
                </div>
              ) : history.groups.map(group => (
                <div key={group.dateStr} className="body-bm-hgroup">
                  <div className="body-bm-hgroup-head">
                    <b>{group.label}</b>
                    <small>TB {group.avg} kg</small>
                  </div>
                  {group.items.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      className={`body-bm-hitem${activeHistoryId === item.id ? ' is-on' : ''}`}
                      onClick={() => {
                        setSelectedHistoryId(item.id);
                        setInspectorOpen(true);
                      }}
                    >
                      <span className="body-bm-hitem-ic"><AppIcon name={item.source === 'manual' ? 'pencil' : 'scales'} size={16} /></span>
                      <span className="body-bm-hitem-main">
                        <b className={item.is_outlier ? 'is-outlier' : ''}>{item.weightStr}<small>kg</small></b>
                        <small>{item.sub}</small>
                      </span>
                      {item.is_outlier && <em className="body-bm-chip is-warn">Lệch giờ</em>}
                      <span className="body-bm-hitem-time">{item.timeStr}</span>
                      <AppIcon name="caretRight" size={13} className="body-bm-muted" />
                    </button>
                  ))}
                </div>
              ))}
            </section>
            {inspector}
          </div>
          {inspectorOpen && <div className="body-bm-sheet-backdrop body-bm-m-only" onClick={() => setInspectorOpen(false)} />}
        </div>
      )}

      {/* ── HỒ SƠ ────────────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className="body-bm-profile">
          <div className="body-bm-pgrid">
            <section className="body-bm-card body-bm-avatar">
              <span className="body-bm-avatar-ic">{profile?.gender === 'female' ? 'N' : 'M'}</span>
              <span>
                <b>{profile?.gender === 'female' ? 'Hồ sơ Nữ' : profile?.gender === 'other' ? 'Hồ sơ' : 'Hồ sơ Nam'}</b>
                <small>{age ? `${age} tuổi` : 'Chưa nhập năm sinh'} · {heightCm ? `${f(heightCm)} cm` : 'Chưa nhập chiều cao'}</small>
                {(bmr || tdee) && (
                  <small className="body-bm-energy">
                    {bmr ? `BMR ${Math.round(bmr)} kcal` : ''}{bmr && tdee ? ' · ' : ''}{tdee ? `TDEE ${Math.round(tdee)} kcal/ngày` : ''}
                  </small>
                )}
              </span>
            </section>

            <section className="body-bm-card body-bm-goalcard">
              <div className="body-bm-card-head">
                <b>Mục tiêu cân nặng</b>
                {weightGoal.pct != null && <small>{weightGoal.remain > 0.05 ? `Còn ${f(weightGoal.remain)} kg` : 'Đã đạt mục tiêu'}</small>}
              </div>
              {weightGoal.pct != null ? (
                <>
                  <div className="body-bm-goal-nums">
                    <b>{f(weightGoal.cur)} kg</b>
                    <AppIcon name="arrowRight" size={14} />
                    <b className="is-accent">{f(weightGoal.goal)} kg</b>
                  </div>
                  <div className="body-bm-progress"><span style={{ width: `${weightGoal.pct}%` }} /></div>
                  <small className="body-bm-muted-text">Bắt đầu {f(weightGoal.start)} kg · tiến độ {weightGoal.pct}%</small>
                </>
              ) : (
                <p className="body-bm-muted-text">
                  {weightGoal.goal == null ? 'Chưa đặt cân nặng mục tiêu — nhập ở form bên dưới.' : 'Chưa có lần cân nào để tính tiến độ.'}
                </p>
              )}
            </section>
          </div>

          <section className="body-bm-card body-bm-form-card">
            <div className="body-bm-card-head is-col">
              <b>Thông số hồ sơ</b>
              <small>Cần chiều cao, giới tính và năm sinh để tính BMI, BMR/TDEE và mục tiêu dinh dưỡng.</small>
            </div>
            <form className="body-bm-form" onSubmit={handleSaveProfile} onKeyDown={submitOnCtrlEnter}>
              <label className="body-bm-field">
                <span>Giới tính</span>
                <div className="body-bm-seg is-field" role="group" aria-label="Giới tính">
                  {[['male', 'Nam'], ['female', 'Nữ'], ['other', 'Khác']].map(([k, l]) => (
                    <button key={k} type="button" className={editGender === k ? 'is-on' : ''} onClick={() => setEditGender(k)} aria-pressed={editGender === k}>{l}</button>
                  ))}
                </div>
              </label>
              <label className="body-bm-field">
                <span>Năm sinh</span>
                <input className="body-bm-input" type="number" inputMode="numeric" min="1920" max={new Date().getFullYear()} placeholder="Ví dụ: 1995" value={editBirthYear} onChange={e => setEditBirthYear(e.target.value)} />
              </label>
              <label className="body-bm-field">
                <span>Chiều cao (cm)</span>
                <input className="body-bm-input" type="number" inputMode="decimal" step="0.5" required placeholder="Ví dụ: 170" value={editHeight} onChange={e => setEditHeight(e.target.value)} />
              </label>
              <label className="body-bm-field">
                <span>Cân nặng mục tiêu (kg)</span>
                <input className="body-bm-input" type="number" inputMode="decimal" step="0.5" placeholder="Ví dụ: 63" value={editGoalWeight} onChange={e => setEditGoalWeight(e.target.value)} />
              </label>
              <label className="body-bm-field is-wide">
                <span>Mức vận động hằng ngày</span>
                <select className="body-bm-input" value={editActivity} onChange={e => setEditActivity(e.target.value)}>
                  {ACTIVITY_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              <div className="body-bm-form-actions">
                <button type="submit" className="body-bm-btn is-dark">
                  <AppIcon name={profileSaved ? 'checkCircle' : 'save'} size={14} />
                  {profileSaved ? 'Đã lưu hồ sơ' : 'Lưu hồ sơ'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ── THÊM CÂN ĐO: modal (desktop) / bottom sheet (mobile) ───── */}
      {showAddModal && (
        <>
          <div className="body-bm-modal-backdrop" onClick={() => setShowAddModal(false)} />
          <div className="body-bm-modal" role="dialog" aria-modal="true" aria-label="Thêm chỉ số cân đo">
            <span className="body-bm-sheet-grip" />
            <div className="body-bm-modal-head">
              <span>
                <b>Thêm chỉ số cân đo</b>
                <small>Chỉ cần cân nặng. Các chỉ số khác nhập nếu có cân InBody.</small>
              </span>
              <button type="button" className="body-bm-icon-btn" onClick={() => setShowAddModal(false)} aria-label="Đóng">
                <AppIcon name="x" size={16} />
              </button>
            </div>
            <form className="body-bm-modal-form" onSubmit={handleSaveMeasurement} onKeyDown={submitOnCtrlEnter}>
              <div className="body-bm-modal-body">
                <label className="body-bm-field">
                  <span>Cân nặng (kg) <em>Bắt buộc</em></span>
                  <input className="body-bm-input is-big" type="number" inputMode="decimal" step="0.05" required autoFocus placeholder="Ví dụ: 65,05" value={newWeight} onChange={e => setNewWeight(e.target.value)} />
                </label>

                <div className="body-bm-seg is-field" role="group" aria-label="Thời điểm cân">
                  <button type="button" className={newTimeSlot === 'morning' ? 'is-on' : ''} onClick={() => setNewTimeSlot('morning')} aria-pressed={newTimeSlot === 'morning'}>
                    <AppIcon name="sunHorizon" size={14} />Sáng sớm (đói bụng)
                  </button>
                  <button type="button" className={newTimeSlot === 'evening' ? 'is-on' : ''} onClick={() => setNewTimeSlot('evening')} aria-pressed={newTimeSlot === 'evening'}>
                    <AppIcon name="moon" size={14} />Buổi tối (sau ăn)
                  </button>
                </div>
                {newTimeSlot === 'evening' && (
                  <small className="body-bm-hint">Lần cân buổi tối được đánh dấu lệch giờ, không đưa vào đường xu hướng.</small>
                )}

                <div className="body-bm-fields2">
                  <label className="body-bm-field">
                    <span>Tỷ lệ mỡ (%)</span>
                    <input className="body-bm-input" type="number" inputMode="decimal" step="0.1" placeholder="15,2" value={newFat} onChange={e => setNewFat(e.target.value)} />
                  </label>
                  <label className="body-bm-field">
                    <span>Cơ xương (kg)</span>
                    <input className="body-bm-input" type="number" inputMode="decimal" step="0.1" placeholder="29,6" value={newMuscle} onChange={e => setNewMuscle(e.target.value)} />
                  </label>
                  <label className="body-bm-field">
                    <span>Mỡ nội tạng (mức 1–20)</span>
                    <input className="body-bm-input" type="number" inputMode="decimal" step="0.5" placeholder="5" value={newVisceral} onChange={e => setNewVisceral(e.target.value)} />
                  </label>
                  <label className="body-bm-field">
                    <span>Tỷ lệ nước (%)</span>
                    <input className="body-bm-input" type="number" inputMode="decimal" step="0.1" placeholder="58,9" value={newWater} onChange={e => setNewWater(e.target.value)} />
                  </label>
                  <label className="body-bm-field">
                    <span>Khoáng xương (kg)</span>
                    <input className="body-bm-input" type="number" inputMode="decimal" step="0.05" placeholder="2,82" value={newBone} onChange={e => setNewBone(e.target.value)} />
                  </label>
                </div>

                <div className={`body-bm-tape${showTapeCalc ? ' is-open' : ''}`}>
                  <button type="button" className="body-bm-tape-toggle" onClick={() => setShowTapeCalc(v => !v)} aria-expanded={showTapeCalc}>
                    <AppIcon name="ruler" size={15} />
                    <span>
                      <b>Tính mỡ bằng thước dây</b>
                      <small>Công thức Hải quân Mỹ (US Navy) · không cần cân InBody</small>
                    </span>
                    <AppIcon name={showTapeCalc ? 'caretUp' : 'caretDown'} size={14} />
                  </button>
                  {showTapeCalc && (
                    <div className="body-bm-tape-body">
                      <div className={`body-bm-fields2${(editGender || profile?.gender) === 'female' ? ' is-3' : ''}`}>
                        <label className="body-bm-field">
                          <span>Vòng eo (ngang rốn, cm)</span>
                          <input className="body-bm-input" type="number" inputMode="decimal" step="0.5" placeholder="78" value={tapeWaist} onChange={e => setTapeWaist(e.target.value)} />
                        </label>
                        <label className="body-bm-field">
                          <span>Vòng cổ (dưới yết hầu, cm)</span>
                          <input className="body-bm-input" type="number" inputMode="decimal" step="0.5" placeholder="37" value={tapeNeck} onChange={e => setTapeNeck(e.target.value)} />
                        </label>
                        {(editGender || profile?.gender) === 'female' && (
                          <label className="body-bm-field">
                            <span>Vòng hông (cm)</span>
                            <input className="body-bm-input" type="number" inputMode="decimal" step="0.5" placeholder="93" value={tapeHip} onChange={e => setTapeHip(e.target.value)} />
                          </label>
                        )}
                      </div>
                      <div className="body-bm-tape-actions">
                        <button type="button" className="body-bm-btn is-accent" onClick={handleRunTapeCalc}>Tính &amp; điền vào form</button>
                        {tapeCalculated?.error && <span className="is-bad">{tapeCalculated.error}</span>}
                        {tapeCalculated?.fatPct != null && (
                          <span className="is-good">
                            Mỡ ước tính {f(tapeCalculated.fatPct)}%
                            {tapeCalculated.whtr != null && ` · Eo/Cao ${f(tapeCalculated.whtr, 2)} (${tapeCalculated.whtrStatus})`}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {saveError && <div className="body-bm-error" role="alert">{saveError}</div>}
              </div>
              <div className="body-bm-modal-foot">
                <button type="button" className="body-bm-btn" onClick={() => setShowAddModal(false)}>Hủy</button>
                <button type="submit" className="body-bm-btn is-dark" disabled={!newWeight}>Lưu số đo</button>
              </div>
            </form>
          </div>
        </>
      )}

      <ConfirmModal
        open={Boolean(confirmDeleteId)}
        title="Xóa lần đo?"
        message="Lần đo này sẽ bị xóa khỏi lịch sử và đường xu hướng. Không thể hoàn tác."
        confirmLabel="Xóa lần đo"
        cancelLabel="Giữ lại"
        danger
        onConfirm={() => {
          const id = confirmDeleteId;
          setConfirmDeleteId(null);
          setInspectorOpen(false);
          if (selectedHistoryId === id) setSelectedHistoryId(null);
          deleteMeasurement(id);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
