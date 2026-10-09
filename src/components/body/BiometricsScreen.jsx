import { useState, useMemo, useEffect } from 'react';
import AppIcon from '../AppIcon';
import { useBiometrics } from '../../hooks/useBiometrics';
import {
  BMI_CATEGORIES,
  calculateBodyComposition,
  calculateNavyBodyFat,
  estimateVisceralFatFromWaist,
  weightForBmi
} from '../../utils/bodyMetrics';

// Helper formatting functions (Vietnamese decimal comma style)
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

const GOOD = '#2F8A57';
const BAD = '#C23B22';
const MUTED = '#8A8A84';
const LOW = '#4C8DE0';
const OK = '#3E9E68';
const HI = '#E0822C';
const OBESE = '#D2462B';

export default function BiometricsScreen() {
  const {
    measurements,
    latest,
    profile,
    bmiInfo,
    bmr,
    bodyScore,
    addMeasurement,
    toggleOutlier,
    deleteMeasurement,
    updateProfile
  } = useBiometrics();

  const [activeTab, setActiveTab] = useState('analysis'); // 'analysis' | 'history' | 'profile'
  const [rangeTab, setRangeTab] = useState('30d'); // '7d' | '30d' | '90d' | '365d'
  const [now] = useState(() => Date.now());
  const [selectedMetric, setSelectedMetric] = useState('weight'); // 'weight' | 'fat' | 'muscle'
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states for adding new measurement
  const [newWeight, setNewWeight] = useState('');
  const [newFat, setNewFat] = useState('');
  const [newMuscle, setNewMuscle] = useState('');
  const [newVisceral, setNewVisceral] = useState('');
  const [newWater, setNewWater] = useState('');
  const [newBone, setNewBone] = useState('');
  const [newTimeSlot, setNewTimeSlot] = useState('morning');

  // Tape calculator states (US Navy & WHtR)
  const [showTapeCalc, setShowTapeCalc] = useState(false);
  const [tapeWaist, setTapeWaist] = useState('');
  const [tapeNeck, setTapeNeck] = useState('');
  const [tapeHip, setTapeHip] = useState('');
  const [tapeCalculated, setTapeCalculated] = useState(null);

  // Profile edit states
  const [editHeight, setEditHeight] = useState(profile?.height_cm || '');
  const [editGoalWeight, setEditGoalWeight] = useState(profile?.goal_weight_kg || '');
  const [editActivity, setEditActivity] = useState(profile?.activity_level || 'moderate');
  const [editGender, setEditGender] = useState(profile?.gender || 'male');
  const [editBirthYear, setEditBirthYear] = useState(profile?.birth_year || '');
  const [profileSaved, setProfileSaved] = useState(false);

  // Sync profile when loaded from database
  useEffect(() => {
    if (profile) {
      if (profile.height_cm != null) setEditHeight(profile.height_cm);
      if (profile.goal_weight_kg != null) setEditGoalWeight(profile.goal_weight_kg);
      if (profile.activity_level) setEditActivity(profile.activity_level);
      if (profile.gender) setEditGender(profile.gender);
      if (profile.birth_year != null) setEditBirthYear(profile.birth_year);
    }
  }, [profile]);

  // Default selected history item to latest
  useEffect(() => {
    if (!selectedHistoryId && latest?.id) {
      setSelectedHistoryId(latest.id);
    }
  }, [selectedHistoryId, latest]);

  const heightCm = profile?.height_cm ? Number(profile.height_cm) : null;
  const isFemale = profile?.gender === 'female';

  // Thước dây US Navy: chỉ tính khi có chiều cao thật; WHtR chỉ để tham khảo, không tự điền "mỡ nội tạng"
  const handleRunTapeCalc = () => {
    const gender = editGender || profile?.gender || 'male';
    const height = editHeight ? Number(editHeight) : heightCm;
    const waist = Number(tapeWaist);
    const neck = Number(tapeNeck);
    const hip = Number(tapeHip);
    if (!height) {
      setTapeCalculated({ error: 'Cần nhập chiều cao ở tab Hồ sơ trước khi tính.' });
      return;
    }
    if (gender !== 'male' && gender !== 'female') {
      setTapeCalculated({ error: 'Công thức Navy chỉ có cho Nam / Nữ — chọn giới tính ở tab Hồ sơ.' });
      return;
    }
    if (!waist || !neck) return;
    const navyFat = calculateNavyBodyFat(gender, height, waist, neck, hip);
    const whtr = estimateVisceralFatFromWaist(waist, height);
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
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (err) {
      console.error('Error saving profile:', err);
    }
  };

  // Lần đo hợp lệ (bỏ lần đo lệch giờ), mới nhất trước
  const validMeasurements = useMemo(() => measurements.filter(m => !m.is_outlier), [measurements]);

  // ── ARC GAUGE: dải cân nặng theo chiều cao (ngưỡng BMI châu Á 18,5 / 23 / 25) ──
  const gaugeData = useMemo(() => {
    const curWeight = latest?.weight ? Number(latest.weight) : null;
    const A0 = 135;
    const SPAN = 270;
    const arcPath = (cx, cy, r, a0, a1) => {
      const rad = a => (a * Math.PI) / 180;
      const x0 = cx + r * Math.cos(rad(a0));
      const y0 = cy + r * Math.sin(rad(a0));
      const x1 = cx + r * Math.cos(rad(a1));
      const y1 = cy + r * Math.sin(rad(a1));
      const largeArc = a1 - a0 > 180 ? 1 : 0;
      return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
    };
    const legend = [
      { label: 'Thiếu cân', color: LOW },
      { label: 'Bình thường', color: OK },
      { label: 'Thừa cân', color: HI },
      { label: 'Béo phì', color: OBESE }
    ];

    // Chưa có chiều cao → không phân loại được, vẽ cung trung tính và không đặt kim
    if (!heightCm) {
      return {
        segs: [{ d: arcPath(120, 112, 92, A0, A0 + SPAN), c: 'var(--body-border-subtle)' }],
        mx: null,
        my: null,
        weightStr: curWeight ? f(curWeight, 2) : '—',
        status: curWeight ? 'Nhập chiều cao để phân loại' : 'Chưa có số đo',
        statusColor: MUTED,
        legend
      };
    }

    const S0 = weightForBmi(15, heightCm);
    const S1 = weightForBmi(32, heightCm);
    const w185 = weightForBmi(BMI_CATEGORIES.NORMAL.min, heightCm);
    const w23 = weightForBmi(BMI_CATEGORIES.OVERWEIGHT.min, heightCm);
    const w25 = weightForBmi(BMI_CATEGORIES.OBESE.min, heightCm);
    const ang = (v) => A0 + ((Math.max(S0, Math.min(S1, v)) - S0) / (S1 - S0)) * SPAN;
    const bounds = [[S0, w185, LOW], [w185, w23, OK], [w23, w25, HI], [w25, S1, OBESE]];
    const segs = bounds.map(([a, b, c], i) => ({
      d: arcPath(120, 112, 92, ang(a) + (i ? 3 : 0), ang(b) - (i < 3 ? 3 : 0)),
      c
    }));

    let mx = null;
    let my = null;
    if (curWeight) {
      const ma = (ang(curWeight) * Math.PI) / 180;
      mx = (120 + 92 * Math.cos(ma)).toFixed(1);
      my = (112 + 92 * Math.sin(ma)).toFixed(1);
    }
    const cat = bmiInfo?.category;
    const catColor = cat?.key === 'underweight' ? LOW : cat?.key === 'normal' ? OK : cat?.key === 'overweight' ? HI : OBESE;

    return {
      segs,
      mx,
      my,
      weightStr: curWeight ? f(curWeight, 2) : '—',
      status: cat ? `${cat.label} · BMI ${f(bmiInfo.bmi, 1)}` : 'Chưa có số đo',
      statusColor: cat ? catColor : MUTED,
      legend
    };
  }, [latest, heightCm, bmiInfo]);

  const bodyScoreLabel = bodyScore == null ? null
    : bodyScore >= 80 ? 'Rất tốt' : bodyScore >= 65 ? 'Cân đối' : bodyScore >= 50 ? 'Trung bình' : 'Cần cải thiện';

  // ── THÀNH PHẦN CƠ THỂ: chỉ khi đã đo mỡ (4 phần khi có thêm nước + khoáng xương) ──
  const compositionData = useMemo(() => {
    if (!latest?.weight || latest.body_fat_pct == null) return null;
    const w = Number(latest.weight);
    const full = calculateBodyComposition(w, Number(latest.body_fat_pct), latest.water_pct != null ? Number(latest.water_pct) : null, latest.bone_mass_kg != null ? Number(latest.bone_mass_kg) : null);
    const fatKg = Number((w * Number(latest.body_fat_pct) / 100).toFixed(2));
    const parts = full
      ? [
          { name: 'Hàm lượng nước', val: full.waterKg, color: '#4C8DE0' },
          { name: 'Chất đạm & khác', val: full.proteinKg, color: '#E0A23C' },
          { name: 'Mỡ', val: full.fatKg, color: '#E26A5A' },
          { name: 'Khoáng xương', val: full.boneKg, color: '#8CCFC0' }
        ]
      : [
          { name: 'Mỡ', val: fatKg, color: '#E26A5A' },
          { name: 'Khối không mỡ', val: Number((w - fatKg).toFixed(2)), color: '#4C8DE0' }
        ];

    const tot = parts.reduce((acc, p) => acc + p.val, 0) || w;
    const C = 2 * Math.PI * 52;
    let accum = 0;
    const donutSegments = parts.map(p => {
      const segLen = (p.val / tot) * C;
      const da = `${Math.max(0, segLen - 2).toFixed(2)} ${C.toFixed(2)}`;
      const off = (-accum).toFixed(2);
      accum += segLen;
      return { ...p, da, off, formattedVal: f(p.val, 2) };
    });

    return {
      donutSegments,
      totalWeightStr: f(w, 2),
      parts: donutSegments,
      isFull: Boolean(full)
    };
  }, [latest]);

  // ── 10 CHỈ SỐ: chỉ hiện số đã đo/công thức từ dữ liệu thật; thiếu thì "Chưa đo" ──
  const metricsGrid = useMemo(() => {
    if (!latest) return [];
    const w = Number(latest.weight);
    const num = v => (v == null ? null : Number(v));
    // Lần đo hợp lệ trước đó có giá trị cho trường này (để tính chênh lệch thật)
    const previousValueOf = (field) => {
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

    // [tên, giá trị, đơn vị, số lẻ, nguồn ('measured'|'formula'|null), khoảng chuẩn [lo,hi] | null, giá trị trước, hướng tốt, nhãn trạng thái]
    const rows = [
      ['Cân nặng', w, 'kg', 2, 'measured', healthyW, prevW, 0, bmiInfo?.category?.label || null],
      ['BMI', bmiInfo?.bmi ?? null, '', 1, bmiInfo ? 'formula' : null, [18.5, 22.9], prevBmi, 0, bmiInfo?.category?.label || null],
      ['Tỷ lệ mỡ', fat, '%', 1, fat != null ? 'measured' : null, fatRange, prevFat, -1, null],
      ['Cơ xương', num(latest.skeletal_muscle_kg), 'kg', 1, latest.skeletal_muscle_kg != null ? 'measured' : null, null, previousValueOf('skeletal_muscle_kg'), 1, null],
      ['Mỡ nội tạng', num(latest.visceral_fat), 'mức', 0, latest.visceral_fat != null ? 'measured' : null, [1, 9], previousValueOf('visceral_fat'), -1, null],
      ['Trao đổi chất', bmr, 'kcal', 0, bmr ? 'formula' : null, null, null, 0, bmr ? 'Mifflin-St Jeor' : null],
      ['Tỷ lệ nước', num(latest.water_pct), '%', 1, latest.water_pct != null ? 'measured' : null, waterRange, previousValueOf('water_pct'), 1, null],
      ['Khoáng xương', num(latest.bone_mass_kg), 'kg', 2, latest.bone_mass_kg != null ? 'measured' : null, null, previousValueOf('bone_mass_kg'), 0, null],
      ['Khối không mỡ', ffm, 'kg', 1, ffm != null ? 'formula' : null, null, prevFfm, 1, null]
    ];

    return rows.map(([name, val, unit, dec, source, range, prev, goodDir, label]) => {
      const has = val != null && !Number.isNaN(val);
      const inRange = has && range ? val >= range[0] && val <= range[1] : null;
      const delta = has && prev != null ? Number((val - prev).toFixed(dec)) : null;
      const deltaColor = delta == null || delta === 0 || goodDir === 0 ? MUTED : delta * goodDir > 0 ? GOOD : BAD;
      let statusText = 'Chưa đo';
      let statusColor = MUTED;
      if (has) {
        if (label) {
          statusText = label;
          statusColor = inRange === false ? HI : inRange ? GOOD : 'var(--body-text-sub)';
        } else if (range) {
          statusText = inRange ? 'Trong khoảng chuẩn' : val < range[0] ? 'Thấp hơn chuẩn' : 'Cao hơn chuẩn';
          statusColor = inRange ? GOOD : HI;
        } else {
          statusText = source === 'formula' ? 'Tính từ số đo' : 'Đã đo';
          statusColor = 'var(--body-text-sub)';
        }
      }
      // Thanh khoảng chuẩn: dải hiển thị rộng hơn khoảng chuẩn 40% mỗi bên
      let bar = null;
      if (has && range) {
        const span = range[1] - range[0];
        const mn = range[0] - span * 0.4;
        const mx = range[1] + span * 0.4;
        const pct = x => Math.max(0, Math.min(100, ((x - mn) / (mx - mn)) * 100));
        bar = {
          w0: `${pct(range[0]).toFixed(1)}%`,
          w1: `${(pct(range[1]) - pct(range[0])).toFixed(1)}%`,
          markerPos: `${pct(val).toFixed(1)}%`,
          rangeText: `chuẩn ${f(range[0], dec === 0 ? 0 : 1)}–${f(range[1], dec === 0 ? 0 : 1)}`
        };
      }
      return {
        name,
        valueDisplay: has ? f(val, dec) : '—',
        unit: has ? unit : '',
        statusText,
        statusColor,
        deltaText: delta == null ? '' : fs(delta, dec),
        deltaColor,
        source: has ? source : null,
        bar
      };
    });
  }, [latest, bmiInfo, bmr, validMeasurements, heightCm, isFemale]);

  // ── XU HƯỚNG: chỉ vẽ từ các lần đo thật trong khoảng đã chọn ──
  const trendData = useMemo(() => {
    const days = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }[rangeTab] || 30;
    const cutoff = now - days * 86400000;
    const fieldOf = { weight: 'weight', fat: 'body_fat_pct', muscle: 'skeletal_muscle_kg' };
    const meta = {
      weight: { name: 'Cân nặng', unit: 'kg', dec: 2, goodDir: profile?.goal_weight_kg && latest?.weight ? (Number(profile.goal_weight_kg) < Number(latest.weight) ? -1 : 1) : 0, goal: profile?.goal_weight_kg ? Number(profile.goal_weight_kg) : null },
      fat: { name: 'Tỷ lệ mỡ', unit: '%', dec: 1, goodDir: -1, goal: null },
      muscle: { name: 'Cơ xương', unit: 'kg', dec: 1, goodDir: 1, goal: null }
    };
    const pointsOf = (key) => validMeasurements
      .filter(m => m[fieldOf[key]] != null && new Date(m.measured_at || m.local_date).getTime() >= cutoff)
      .slice()
      .reverse()
      .map(m => ({ date: m.local_date, val: Number(m[fieldOf[key]]) }));

    const cards = Object.keys(meta).map(key => {
      const pts = pointsOf(key);
      const cur = pts.length ? pts[pts.length - 1].val : null;
      const delta = pts.length >= 2 ? pts[pts.length - 1].val - pts[0].val : null;
      const dir = meta[key].goodDir;
      return {
        key,
        name: meta[key].name,
        cur: cur != null ? f(cur, meta[key].dec) : '—',
        unit: meta[key].unit,
        delta: delta == null ? '' : `${fs(delta, meta[key].dec)} ${meta[key].unit}`,
        deltaColor: delta == null || Math.abs(delta) < 0.001 || dir === 0 ? MUTED : delta * dir > 0 ? GOOD : BAD
      };
    });

    const curTm = meta[selectedMetric] || meta.weight;
    const pts = pointsOf(selectedMetric);
    if (pts.length < 2) {
      return { cards, curTm, hasTrend: false };
    }

    const vals = pts.map(p => p.val);
    let lo = Math.min(...vals, curTm.goal ?? Infinity);
    let hi = Math.max(...vals, curTm.goal ?? -Infinity);
    const pad = (hi - lo) * 0.15 || 0.8;
    lo -= pad;
    hi += pad;
    const X = i => (i / (pts.length - 1)) * 600;
    const Y = v => (1 - (v - lo) / (hi - lo)) * 200;
    const pathPoints = vals.map((v, i) => `${i ? 'L' : 'M'} ${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');

    return {
      cards,
      curTm,
      hasTrend: true,
      pathPoints,
      area: `${pathPoints} L 600 200 L 0 200 Z`,
      goalY: curTm.goal != null ? Y(curTm.goal).toFixed(1) : null,
      goalLabel: curTm.goal != null ? `Mục tiêu ${f(curTm.goal)} ${curTm.unit}` : '',
      lastY: Y(vals[vals.length - 1]).toFixed(1),
      yMax: f(hi, 1),
      yMid: f((hi + lo) / 2, 1),
      yMin: f(lo, 1),
      firstDate: pts[0].date,
      midDate: pts[Math.floor(pts.length / 2)].date,
      lastDate: pts[pts.length - 1].date
    };
  }, [validMeasurements, latest, selectedMetric, profile, rangeTab, now]);

  // ── LỊCH SỬ GOM THEO NGÀY & THẺ CHI TIẾT LẦN ĐO ──
  const historyData = useMemo(() => {
    const groupsMap = new Map();
    measurements.forEach(m => {
      if (!groupsMap.has(m.local_date)) groupsMap.set(m.local_date, []);
      groupsMap.get(m.local_date).push(m);
    });

    const groups = Array.from(groupsMap.entries()).map(([dateStr, items]) => {
      const validItems = items.filter(i => !i.is_outlier);
      const avgWeight = validItems.length
        ? validItems.reduce((acc, curr) => acc + Number(curr.weight), 0) / validItems.length
        : Number(items[0].weight);
      return {
        dateStr,
        avgLabel: `Trung bình ${f(avgWeight, 2)} kg`,
        items: items.map(item => {
          const parts = [];
          if (item.body_fat_pct != null) parts.push(`${f(item.body_fat_pct)}% mỡ`);
          if (item.skeletal_muscle_kg != null) parts.push(`${f(item.skeletal_muscle_kg)} kg cơ`);
          return {
            ...item,
            weightStr: f(item.weight, 2),
            timeStr: new Date(item.measured_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            subInfo: parts.length ? parts.join(' · ') : 'Chỉ cân nặng'
          };
        })
      };
    });

    const activeItem = measurements.find(m => m.id === selectedHistoryId) || measurements[0] || null;
    let inspector = null;
    if (activeItem) {
      const w = Number(activeItem.weight);
      const fat = activeItem.body_fat_pct != null ? Number(activeItem.body_fat_pct) : null;
      const mus = activeItem.skeletal_muscle_kg != null ? Number(activeItem.skeletal_muscle_kg) : null;
      const bmiVal = heightCm ? w / ((heightCm / 100) ** 2) : null;
      inspector = {
        item: activeItem,
        when: `${activeItem.local_date} ${new Date(activeItem.measured_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
        sourceName: activeItem.source === 'huawei_scale' ? 'Cân Huawei' : activeItem.source === 'csv_import' ? 'Nhập file' : 'Nhập tay',
        weightStr: f(w, 2),
        isOutlier: activeItem.is_outlier,
        rows: [
          { name: 'BMI', val: bmiVal != null ? f(bmiVal, 1) : '—', unit: bmiVal != null ? '' : '(cần chiều cao)' },
          { name: 'Tỷ lệ mỡ', val: fat != null ? f(fat, 1) : '—', unit: '%' },
          { name: 'Cơ xương', val: mus != null ? f(mus, 1) : '—', unit: 'kg' },
          { name: 'Khối mỡ', val: fat != null ? f(w * fat / 100, 2) : '—', unit: 'kg' },
          { name: 'Khối không mỡ', val: fat != null ? f(w * (1 - fat / 100), 2) : '—', unit: 'kg' }
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
    const goalW = profile?.goal_weight_kg ? Number(profile.goal_weight_kg) : null;
    const towardGoal = delta7 != null && goalW != null && latestValid
      ? (Number(latestValid.weight) > goalW ? delta7 < 0 : delta7 > 0)
      : null;

    return {
      groups,
      inspector,
      totalCount: measurements.length,
      latestWeightStr: latestValid ? f(latestValid.weight, 2) : '—',
      delta7Str: delta7 == null ? '—' : fs(delta7, 2),
      delta7Color: towardGoal == null ? 'var(--body-text-main)' : towardGoal ? GOOD : BAD
    };
  }, [measurements, validMeasurements, selectedHistoryId, profile, heightCm]);

  // ── MỤC TIÊU CÂN NẶNG (hồ sơ chỉ lưu cân nặng mục tiêu) ──
  const weightGoal = useMemo(() => {
    const goal = profile?.goal_weight_kg ? Number(profile.goal_weight_kg) : null;
    const cur = validMeasurements[0] ? Number(validMeasurements[0].weight) : null;
    const start = validMeasurements.length ? Number(validMeasurements[validMeasurements.length - 1].weight) : null;
    if (goal == null || cur == null) return { goal, cur, pct: null };
    const pct = start !== goal ? Math.max(0, Math.min(100, Math.round(((start - cur) / (start - goal)) * 100))) : 100;
    return { goal, cur, start, pct, remain: Math.abs(cur - goal) };
  }, [profile, validMeasurements]);

  return (
    <div className="body-container-constrained" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── HEADER WITH SUBTABS & SYNC STATUS ───────────────────── */}
      <div className="body-cothe-header">
        <div className="body-cothe-header-left">
          <h2 className="body-cothe-title" style={{ fontSize: '22px', fontWeight: 700, margin: 0, letterSpacing: '-0.01em', color: 'var(--body-text-main)' }}>
            Cơ thể
          </h2>

          <div className="body-cothe-tabs">
            {[
              { key: 'analysis', label: 'Phân tích' },
              { key: 'history', label: 'Lịch sử' },
              { key: 'profile', label: 'Hồ sơ' }
            ].map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`body-cothe-tab-btn ${activeTab === t.key ? 'active' : ''}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="body-cothe-header-right">
          {latest && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: 'var(--body-text-muted)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2F8A57' }} />
              {latest.source === 'huawei_scale' ? 'Cân Huawei' : latest.source === 'csv_import' ? 'Nhập file' : 'Nhập tay'} · {latest.local_date}
            </span>
          )}
          <button
            type="button"
            className="body-btn body-btn-primary"
            onClick={() => setShowAddModal(true)}
            style={{ height: '34px', padding: '0 13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <AppIcon name="plus" size={14} />
            <span>Thêm cân đo</span>
          </button>
        </div>
      </div>

      {/* ── TAB 1: PHÂN TÍCH CHỈ SỐ CƠ THỂ (ANALYSIS) ────────────── */}
      {activeTab === 'analysis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ── TOP ROW: GAUGE CARD (360px) + TREND CHART (FLEX: 1) ── */}
          <div className="body-cothe-top-grid">

            {/* GAUGE CARD CÂN NẶNG & BMI (360px) */}
            <div className="body-card body-cothe-gauge-card" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              padding: '22px',
              boxSizing: 'border-box'
            }}>
              <span style={{ fontSize: '13px', fontFamily: 'var(--body-mono)', color: 'var(--body-text-muted)' }}>
                {latest ? `${latest.local_date} · ${latest.time_slot === 'morning' ? 'Sáng sớm' : 'Buổi tối'}` : 'Chưa có số đo'}
              </span>

              {/* Vòng cung Gauge SVG */}
              <div style={{ position: 'relative', width: '240px', maxWidth: '100%', height: '190px', margin: '4px 0' }}>
                <svg width="240" height="190" viewBox="0 0 240 203" style={{ display: 'block', width: '100%', height: '100%' }}>
                  {gaugeData.segs.map((seg, idx) => (
                    <path
                      key={idx}
                      d={seg.d}
                      fill="none"
                      stroke={seg.c}
                      strokeWidth="12"
                      strokeLinecap="round"
                    />
                  ))}
                  {gaugeData.mx != null && (
                    <circle
                      cx={gaugeData.mx}
                      cy={gaugeData.my}
                      r="9"
                      fill="#FFFFFF"
                      stroke="#15161A"
                      strokeWidth="3.5"
                    />
                  )}
                </svg>

                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingTop: '16px'
                }}>
                  <div style={{
                    fontSize: '46px',
                    fontWeight: 700,
                    fontFamily: 'var(--body-font)',
                    color: 'var(--body-text-main)',
                    letterSpacing: '-0.02em',
                    lineHeight: 1
                  }}>
                    {gaugeData.weightStr}
                  </div>
                  <div style={{ fontSize: '13.5px', color: 'var(--body-text-muted)', marginTop: '4px' }}>
                    kg
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '14.5px', fontWeight: 600, color: gaugeData.statusColor }}>
                    {gaugeData.status}
                  </div>
                </div>
              </div>

              {/* Legend 4 mốc màu (wrap trên mobile an toàn tuyệt đối) */}
              <div style={{ display: 'flex', gap: '8px 12px', justifyContent: 'center', alignItems: 'center', width: '100%', flexWrap: 'wrap' }}>
                {gaugeData.legend.map(l => (
                  <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--body-text-sub)', whiteSpace: 'nowrap' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: l.color, flex: 'none' }} />
                    {l.label}
                  </span>
                ))}
              </div>

              {/* Box Điểm số cơ thể */}
              <div style={{
                marginTop: 'auto',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                paddingTop: '14px',
                borderTop: '1px solid var(--body-card-border)'
              }}>
                <span style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '20px',
                  background: bodyScore != null && bmiInfo ? 'var(--body-green-soft)' : 'var(--body-shell-bg)',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 700,
                  fontSize: '15px',
                  color: bodyScore != null && bmiInfo ? 'var(--body-green)' : 'var(--body-text-muted)',
                  flex: 'none'
                }}>
                  {bodyScore != null && bmiInfo ? bodyScore : '—'}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                    {bodyScore != null && bmiInfo ? `Điểm cơ thể ${bodyScore}/100 · ${bodyScoreLabel}` : 'Chưa đủ dữ liệu để chấm điểm'}
                  </span>
                  <span style={{ fontSize: '11.5px', color: 'var(--body-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {bodyScore != null && bmiInfo ? 'Ước tính từ BMI và các chỉ số đã đo' : 'Cần cân nặng và chiều cao'}
                  </span>
                </div>
              </div>
            </div>

            {/* TREND CARD (XU HƯỚNG CÓ BIỂU ĐỒ & 3 METRIC TABS) */}
            <div className="body-card body-cothe-trend-card" style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              padding: '22px',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                    Xu hướng
                  </span>
                  <span style={{ fontSize: '12.5px', color: 'var(--body-text-muted)' }}>
                    {rangeTab === '7d' ? '7 ngày' : rangeTab === '30d' ? '30 ngày' : rangeTab === '90d' ? '3 tháng' : 'Năm'} · trung bình ngày
                  </span>
                </div>

                <div style={{ display: 'flex', background: 'var(--body-shell-bg)', borderRadius: '9px', padding: '3px', border: '1px solid var(--body-card-border)' }}>
                  {[
                    { key: '7d', label: 'Tuần' },
                    { key: '30d', label: 'Tháng' },
                    { key: '90d', label: '3 tháng' },
                    { key: '365d', label: 'Năm' }
                  ].map(tab => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setRangeTab(tab.key)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        background: rangeTab === tab.key ? 'var(--body-card-bg)' : 'transparent',
                        color: rangeTab === tab.key ? 'var(--body-text-main)' : 'var(--body-text-sub)',
                        fontSize: '11.5px',
                        fontWeight: rangeTab === tab.key ? 600 : 500,
                        cursor: 'pointer',
                        boxShadow: rangeTab === tab.key ? '0 1px 2px rgba(16,17,20,0.08)' : 'none'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3 Metric Cards clickable */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                {trendData.cards.map(c => {
                  const isPicked = selectedMetric === c.key;
                  return (
                    <div
                      key={c.key}
                      onClick={() => setSelectedMetric(c.key)}
                      style={{
                        padding: '9px 10px',
                        borderRadius: '11px',
                        border: `1.5px solid ${isPicked ? 'var(--body-accent)' : 'var(--body-card-border)'}`,
                        background: isPicked ? 'var(--body-accent-soft)' : 'var(--body-card-bg)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        minWidth: 0
                      }}
                    >
                      <span style={{ fontSize: '11px', color: 'var(--body-text-sub)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--body-text-main)', whiteSpace: 'nowrap' }}>
                          {c.cur}
                          <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--body-text-muted)' }}> {c.unit}</span>
                        </span>
                        <span style={{ fontSize: '11.5px', fontWeight: 600, color: c.deltaColor, whiteSpace: 'nowrap' }}>
                          {c.delta}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Biểu đồ SVG Xu hướng (chỉ vẽ khi có ≥ 2 lần đo thật trong khoảng đã chọn) */}
              {!trendData.hasTrend ? (
                <div style={{ flex: 1, minHeight: '140px', display: 'grid', placeItems: 'center', textAlign: 'center', fontSize: '12.5px', color: 'var(--body-text-muted)', padding: '0 12px' }}>
                  Cần ít nhất 2 lần đo {trendData.curTm.name.toLowerCase()} trong khoảng thời gian này để vẽ xu hướng.
                </div>
              ) : (
              <div style={{ flex: 1, minHeight: '140px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 46px', gridTemplateRows: 'minmax(0, 1fr) 20px', columnGap: '10px' }}>
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  {/* 3 đường kẻ ngang guide lines */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
                    <span style={{ height: '1px', background: 'var(--body-card-border)' }} />
                    <span style={{ height: '1px', background: 'var(--body-card-border)' }} />
                    <span style={{ height: '1px', background: 'var(--body-card-border)' }} />
                  </div>

                  <svg viewBox="0 0 600 200" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden' }}>
                    <path d={trendData.area} fill="rgba(105, 73, 232, 0.08)" />
                    {trendData.goalY != null && (
                      <path
                        d={`M 0 ${trendData.goalY} L 600 ${trendData.goalY}`}
                        fill="none"
                        stroke="#2F8A57"
                        strokeWidth="1.5"
                        strokeDasharray="5 5"
                      />
                    )}
                    <path
                      d={trendData.pathPoints}
                      fill="none"
                      stroke="#6949E8"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />
                    {/* Nhãn Mục tiêu nằm an toàn bên trong SVG, không bị tràn ra ngoài */}
                    {trendData.goalY != null && (
                      <text
                        x="590"
                        y={Math.max(16, Math.min(185, Number(trendData.goalY) - 6))}
                        textAnchor="end"
                        fill="#2F8A57"
                        fontSize="12"
                        fontWeight="600"
                        fontFamily="var(--body-font)"
                      >
                        {trendData.goalLabel}
                      </text>
                    )}
                    {/* Điểm dot tại giá trị cuối cùng bên trong SVG */}
                    <circle
                      cx="598"
                      cy={trendData.lastY}
                      r="5"
                      fill="#FFFFFF"
                      stroke="#6949E8"
                      strokeWidth="3"
                    />
                  </svg>
                </div>

                {/* Trục Y */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'var(--body-mono)', color: 'var(--body-text-muted)', textAlign: 'right' }}>
                  <span style={{ transform: 'translateY(-50%)' }}>{trendData.yMax}</span>
                  <span>{trendData.yMid}</span>
                  <span style={{ transform: 'translateY(50%)' }}>{trendData.yMin}</span>
                </div>

                {/* Trục X */}
                <div style={{ gridColumn: '1 / 2', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '11px', fontFamily: 'var(--body-mono)', color: 'var(--body-text-muted)', marginTop: '4px' }}>
                  <span>{trendData.firstDate}</span>
                  <span>{trendData.midDate}</span>
                  <span>{trendData.lastDate}</span>
                </div>
              </div>
              )}
            </div>

          </div>

          {/* BANNER MINH BẠCH NGUỒN GỐC CHỈ SỐ */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'rgba(105, 73, 232, 0.05)',
            border: '1px solid rgba(105, 73, 232, 0.15)',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>🔬</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                  Cơ sở khoa học & Nguồn dữ liệu chỉ số
                </span>
                <span style={{ fontSize: '12px', color: 'var(--body-text-sub)', lineHeight: 1.4 }}>
                  <strong>BMI & BMR:</strong> Tính từ chiều cao, cân nặng, tuổi (thang BMI châu Á & Mifflin-St Jeor).
                  Chỉ số chưa đo sẽ hiện "Chưa đo" — app không tự điền giá trị ước đoán.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowTapeCalc(true);
                setShowAddModal(true);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--body-accent)',
                background: 'transparent',
                color: 'var(--body-accent)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              📐 Không có cân? Đo bằng thước dây (US Navy)
            </button>
          </div>

          {/* ── BOTTOM ROW: 10 METRICS (5x2) + BODY COMPOSITION DONUT (360px) ── */}
          <div className="body-cothe-bottom-grid">

            {/* 10 THẺ CHỈ SỐ CƠ THỂ CHI TIẾT (GRID 5x2) */}
            <div className="body-metrics-10-grid">
              {metricsGrid.map(m => (
                <div
                  key={m.name}
                  className="body-metric-item-card"
                  style={{
                    background: 'var(--body-card-bg)',
                    border: '1px solid var(--body-card-border)',
                    borderRadius: '14px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    minWidth: 0,
                    boxSizing: 'border-box'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--body-text-sub)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.name}
                    </span>
                    {m.source && (
                      <span style={{
                        fontSize: '9.5px',
                        padding: '1.5px 5.5px',
                        borderRadius: '4px',
                        background: 'rgba(47, 138, 87, 0.12)',
                        color: '#2F8A57',
                        fontWeight: 600,
                        whiteSpace: 'nowrap'
                      }}>
                        {m.source === 'formula' ? 'Công thức' : 'Đã đo'}
                      </span>
                    )}
                  </div>
                  <span className="body-metric-val-num" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--body-text-main)', whiteSpace: 'nowrap' }}>
                    {m.valueDisplay}
                    <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--body-text-muted)' }}> {m.unit}</span>
                  </span>

                  <div className="body-metric-delta-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: m.statusColor }}>
                      {m.statusText}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 500, fontFamily: 'var(--body-mono)', color: m.deltaColor }}>
                      {m.deltaText}
                    </span>
                  </div>

                  {/* Thanh khoảng chuẩn có kim chỉ (chỉ khi chỉ số có khoảng chuẩn rõ ràng) */}
                  {m.bar && (
                    <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <div style={{ position: 'relative', height: '5px', display: 'flex', gap: '2px' }}>
                        <span style={{ width: m.bar.w0, borderRadius: '3px', background: LOW }} />
                        <span style={{ width: m.bar.w1, borderRadius: '3px', background: OK }} />
                        <span style={{ flex: 1, borderRadius: '3px', background: HI }} />
                        <span style={{
                          position: 'absolute',
                          left: m.bar.markerPos,
                          top: '-4px',
                          width: '3px',
                          height: '13px',
                          marginLeft: '-1.5px',
                          borderRadius: '2px',
                          background: 'var(--body-text-main)',
                          boxShadow: '0 0 0 2px var(--body-card-bg)'
                        }} />
                      </div>
                      <span style={{ fontSize: '10.5px', fontFamily: 'var(--body-mono)', color: 'var(--body-text-muted)', whiteSpace: 'nowrap' }}>
                        {m.bar.rangeText}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* THÀNH PHẦN CƠ THỂ (BODY COMPOSITION DONUT) */}
            <div className="body-card" style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              padding: '22px',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                  Thành phần cơ thể
                </span>
                {compositionData && (
                  <span style={{
                    fontSize: '10.5px',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: 'rgba(47, 138, 87, 0.12)',
                    color: '#2F8A57',
                    fontWeight: 600
                  }}>
                    Đã đo
                  </span>
                )}
              </div>

              {!compositionData && (
                <div style={{ fontSize: '12.5px', color: 'var(--body-text-muted)', lineHeight: 1.5 }}>
                  Cần số đo tỷ lệ mỡ (cân BIA/InBody hoặc thước dây) để xem thành phần cơ thể.
                </div>
              )}

              {compositionData && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  {/* Donut SVG 128px */}
                  <div style={{ position: 'relative', width: '128px', height: '128px', flex: 'none' }}>
                    <svg width="128" height="128" viewBox="0 0 128 128" style={{ display: 'block', transform: 'rotate(-90deg)' }}>
                      {compositionData.donutSegments.map((c, i) => (
                        <circle
                          key={i}
                          cx="64"
                          cy="64"
                          r="52"
                          fill="none"
                          stroke={c.color}
                          strokeWidth="16"
                          strokeDasharray={c.da}
                          strokeDashoffset={c.off}
                        />
                      ))}
                    </svg>
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '2px'
                    }}>
                      <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                        {compositionData.totalWeightStr}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--body-text-muted)' }}>
                        kg
                      </span>
                    </div>
                  </div>

                  {/* 4 dòng danh sách chi tiết */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '11px', minWidth: 0 }}>
                    {compositionData.parts.map(p => (
                      <div key={p.name} style={{ display: 'grid', gridTemplateColumns: '8px minmax(0, 1fr) auto', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '4px', background: p.color }} />
                        <span style={{ fontSize: '12.5px', color: 'var(--body-text-sub)' }}>{p.name}</span>
                        <span style={{ fontSize: '12.5px', fontWeight: 600, fontFamily: 'var(--body-mono)', color: 'var(--body-text-main)' }}>
                          {p.formattedVal} kg
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {compositionData && (
                <span style={{ marginTop: 'auto', fontSize: '11.5px', color: 'var(--body-text-muted)', lineHeight: 1.5 }}>
                  {compositionData.isFull
                    ? 'Thành phần (kg) = nước + mỡ + khoáng xương + phần còn lại (đạm & khác)'
                    : 'Đo thêm tỷ lệ nước và khoáng xương để tách chi tiết khối không mỡ.'}
                </span>
              )}
            </div>

          </div>

        </div>
      )}

      {/* ── TAB 2: LỊCH SỬ CÂN ĐO (HISTORY) ──────────────────────── */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* 3-COLUMN SUMMARY BAR */}
          <div className="body-card body-cothe-history-stats">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>Cân nặng hiện tại</span>
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                {historyData.latestWeightStr}<span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--body-text-muted)' }}> kg</span>
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>So với 7 ngày trước</span>
              <span style={{ fontSize: '20px', fontWeight: 700, color: historyData.delta7Color }}>
                {historyData.delta7Str}<span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--body-text-muted)' }}> kg</span>
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>Số lần đo</span>
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                {historyData.totalCount}<span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--body-text-muted)' }}> lần</span>
              </span>
            </div>

            <button
              type="button"
              className="body-btn body-btn-secondary"
              onClick={() => setShowAddModal(true)}
              style={{ height: '34px', fontSize: '12.5px', padding: '0 14px' }}
            >
              + Thêm cân đo
            </button>
          </div>

          {/* 2-COLUMN LAYOUT: GROUPED BY DATE (LEFT) + INSPECTOR (RIGHT 380px) */}
          <div className="body-cothe-history-grid">

            {/* DANH SÁCH LẦN ĐO GOM THEO NGÀY */}
            <div className="body-card" style={{ padding: '0', overflow: 'hidden' }}>
              {historyData.groups.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--body-text-muted)', fontSize: '13.5px' }}>
                  Chưa có lần đo nào được ghi nhận. Bấm "+ Thêm cân đo" để bắt đầu!
                </div>
              ) : (
                historyData.groups.map(group => (
                  <div key={group.dateStr} style={{ borderBottom: '1px solid var(--body-card-border)' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      padding: '14px 20px 8px',
                      background: 'var(--body-shell-bg)'
                    }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                        {group.dateStr}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--body-text-sub)' }}>
                        {group.avgLabel}
                      </span>
                    </div>

                    {group.items.map(item => {
                      const isSelected = selectedHistoryId === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedHistoryId(item.id)}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '36px minmax(0, 1fr) auto auto 14px',
                            alignItems: 'center',
                            gap: '14px',
                            padding: '12px 20px',
                            background: isSelected ? 'var(--body-accent-soft)' : 'var(--body-card-bg)',
                            borderLeft: `3px solid ${isSelected ? 'var(--body-accent)' : 'transparent'}`,
                            cursor: 'pointer',
                            borderTop: '1px solid var(--body-card-border)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: 'var(--body-shell-bg)',
                            display: 'grid',
                            placeItems: 'center',
                            color: 'var(--body-text-sub)'
                          }}>
                            <AppIcon name={item.source === 'manual' ? 'pencil' : 'scales'} size={17} />
                          </span>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                            <span style={{ fontSize: '15px', fontWeight: 700, color: item.is_outlier ? '#9A5A10' : 'var(--body-text-main)' }}>
                              {item.weightStr}
                              <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--body-text-muted)' }}> kg</span>
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>
                              {item.subInfo}
                            </span>
                          </div>

                          {item.is_outlier && (
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              background: '#FDF0E1',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#9A5A10',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              ⚠️ Đo lệch giờ
                            </span>
                          )}

                          <span style={{ fontSize: '12.5px', fontFamily: 'var(--body-mono)', color: 'var(--body-text-sub)' }}>
                            {item.timeStr}
                          </span>

                          <AppIcon name="caretRight" size={13} style={{ color: 'var(--body-text-muted)' }} />
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* INSPECTOR: THẺ CHI TIẾT LẦN ĐO ĐANG CHỌN (380px) */}
            {historyData.inspector ? (
              <div className="body-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontFamily: 'var(--body-mono)', color: 'var(--body-text-muted)' }}>
                    {historyData.inspector.when}
                  </span>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    background: 'var(--body-shell-bg)',
                    fontSize: '11.5px',
                    fontWeight: 500,
                    color: 'var(--body-text-sub)'
                  }}>
                    {historyData.inspector.sourceName}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '44px', fontWeight: 700, color: 'var(--body-text-main)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {historyData.inspector.weightStr}
                  </span>
                  <span style={{ fontSize: '15px', color: 'var(--body-text-muted)' }}>kg</span>
                </div>

                {historyData.inspector.isOutlier && (
                  <div style={{
                    padding: '12px',
                    borderRadius: '10px',
                    background: '#FDF5EA',
                    border: '1px solid #F4DDBE',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <span style={{ fontSize: '12.5px', color: '#6E4510', lineHeight: 1.45 }}>
                      Lần đo này được đánh dấu lệch giờ (ví dụ đo vào buổi tối sau khi ăn no), đang được tách khỏi đường xu hướng chính.
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleOutlier(historyData.inspector.item.id)}
                      style={{
                        height: '32px',
                        borderRadius: '8px',
                        border: '1px solid #E4D3BB',
                        background: '#fff',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#6E4510',
                        cursor: 'pointer'
                      }}
                    >
                      Bỏ đánh dấu lệch
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {historyData.inspector.rows.map(r => (
                    <div
                      key={r.name}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        padding: '10px 0',
                        borderTop: '1px solid var(--body-card-border)'
                      }}
                    >
                      <span style={{ fontSize: '13px', color: 'var(--body-text-sub)' }}>{r.name}</span>
                      <span style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--body-mono)', color: 'var(--body-text-main)' }}>
                        {r.val} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--body-text-muted)' }}>{r.unit}</span>
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => toggleOutlier(historyData.inspector.item.id)}
                    style={{
                      flex: 1,
                      height: '36px',
                      borderRadius: '8px',
                      border: '1px solid var(--body-card-border)',
                      background: 'var(--body-card-bg)',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: 'var(--body-text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    {historyData.inspector.isOutlier ? 'Bình thường' : 'Đánh dấu lệch'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMeasurement(historyData.inspector.item.id)}
                    style={{
                      flex: 1,
                      height: '36px',
                      borderRadius: '8px',
                      border: '1px solid #F1D3CC',
                      background: '#FFF5F4',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: 'var(--body-red)',
                      cursor: 'pointer'
                    }}
                  >
                    Xóa lần đo
                  </button>
                </div>
              </div>
            ) : null}

          </div>

        </div>
      )}

      {/* ── TAB 3: HỒ SƠ THỂ TRẠNG (PROFILE) ──────────────────────── */}
      {activeTab === 'profile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* TOP CARDS: AVATAR + GOALS */}
          <div className="body-cothe-profile-grid">

            {/* AVATAR & THÔNG TIN CƠ BẢN */}
            <div className="body-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '22px' }}>
              <span style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366F1, #22D3EE)',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                fontSize: '22px',
                color: '#fff',
                flex: 'none'
              }}>
                {(profile?.gender === 'female' ? 'N' : 'M')}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                  {profile?.gender === 'female' ? 'Hồ sơ Nữ' : 'Hồ sơ Nam'}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--body-text-muted)' }}>
                  {profile?.birth_year ? `${new Date().getFullYear() - profile.birth_year} tuổi` : 'Chưa nhập năm sinh'} · {heightCm ? `${f(heightCm)} cm` : 'Chưa nhập chiều cao'}
                </span>
              </div>
            </div>

            {/* MỤC TIÊU CÂN NẶNG — chỉ có goal_weight_kg trong DB, không bịa thêm mục tiêu mỡ/cơ */}
            <div className="body-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                  Mục tiêu thể trạng
                </span>
                {weightGoal.pct != null && (
                  <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>
                    {weightGoal.remain > 0 ? `Còn ${f(weightGoal.remain)} kg` : 'Đã đạt mục tiêu'}
                  </span>
                )}
              </div>

              {weightGoal.pct != null ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '12.5px', color: 'var(--body-text-sub)' }}>Cân nặng</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                      {f(weightGoal.cur)} kg <span style={{ fontSize: '11.5px', fontWeight: 400, color: 'var(--body-text-muted)' }}>→ {f(weightGoal.goal)} kg</span>
                    </span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', background: 'var(--body-shell-bg)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${weightGoal.pct}%`, background: 'var(--body-accent)', borderRadius: '3px' }} />
                  </div>
                  <span style={{ fontSize: '11.5px', color: 'var(--body-text-muted)' }}>
                    Bắt đầu {f(weightGoal.start)} kg · tiến độ {weightGoal.pct}%
                  </span>
                </div>
              ) : (
                <span style={{ fontSize: '13px', color: 'var(--body-text-muted)', lineHeight: 1.5 }}>
                  {weightGoal.goal == null
                    ? 'Chưa đặt cân nặng mục tiêu — nhập ở form bên dưới.'
                    : 'Chưa có lần cân nào để tính tiến độ.'}
                </span>
              )}
            </div>

          </div>

          {/* BOTTOM ROW: FORM CHỈNH SỬA */}
          <div className="body-cothe-profile-bottom-grid">

            {/* FORM CHỈNH SỬA THÔNG SỐ THỂ CHẤT */}
            <div className="body-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '22px', gridColumn: '1 / -1' }}>
              <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                Chỉnh sửa thông số hồ sơ
              </span>
              <span style={{ fontSize: '12px', color: 'var(--body-text-muted)', marginTop: '-10px' }}>
                Cần chiều cao, giới tính và năm sinh để tính BMR/TDEE và mục tiêu dinh dưỡng.
              </span>

              <form onSubmit={handleSaveProfile} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', alignItems: 'end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--body-text-sub)' }}>
                    Giới tính
                  </label>
                  <select
                    value={editGender}
                    onChange={e => setEditGender(e.target.value)}
                    style={{
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid var(--body-card-border)',
                      background: 'var(--body-shell-bg)',
                      padding: '0 12px',
                      fontSize: '13px',
                      color: 'var(--body-text-main)',
                      outline: 'none'
                    }}
                  >
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--body-text-sub)' }}>
                    Năm sinh
                  </label>
                  <input
                    type="number"
                    min="1900"
                    max={new Date().getFullYear()}
                    placeholder="Ví dụ: 1995"
                    value={editBirthYear}
                    onChange={e => setEditBirthYear(e.target.value)}
                    style={{
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid var(--body-card-border)',
                      background: 'var(--body-shell-bg)',
                      padding: '0 12px',
                      fontSize: '13.5px',
                      color: 'var(--body-text-main)',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--body-text-sub)' }}>
                    Chiều cao (cm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    placeholder="Ví dụ: 170"
                    value={editHeight}
                    onChange={e => setEditHeight(e.target.value)}
                    style={{
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid var(--body-card-border)',
                      background: 'var(--body-shell-bg)',
                      padding: '0 12px',
                      fontSize: '13.5px',
                      color: 'var(--body-text-main)',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--body-text-sub)' }}>
                    Cân nặng mục tiêu (kg)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="Ví dụ: 63.0"
                    value={editGoalWeight}
                    onChange={e => setEditGoalWeight(e.target.value)}
                    style={{
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid var(--body-card-border)',
                      background: 'var(--body-shell-bg)',
                      padding: '0 12px',
                      fontSize: '13.5px',
                      color: 'var(--body-text-main)',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--body-text-sub)' }}>
                    Mức vận động hàng ngày
                  </label>
                  <select
                    value={editActivity}
                    onChange={e => setEditActivity(e.target.value)}
                    style={{
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid var(--body-card-border)',
                      background: 'var(--body-shell-bg)',
                      padding: '0 12px',
                      fontSize: '13px',
                      color: 'var(--body-text-main)',
                      outline: 'none'
                    }}
                  >
                    <option value="sedentary">Ít vận động (Ngồi văn phòng)</option>
                    <option value="light">Nhẹ (Tập 1–3 buổi/tuần)</option>
                    <option value="moderate">Vừa (Tập 3–5 buổi/tuần)</option>
                    <option value="active">Nặng (Tập 6–7 buổi/tuần)</option>
                    <option value="very_active">Rất nặng (Lao động nặng / VĐV)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="body-btn body-btn-primary"
                  style={{ height: '38px' }}
                >
                  {profileSaved ? '✓ Đã lưu thành công' : 'Lưu thông tin hồ sơ'}
                </button>
              </form>
            </div>

          </div>

        </div>
      )}

      {/* ── MODAL: THÊM CÂN ĐO THỦ CÔNG ─────────────────────────── */}
      {showAddModal && (
        <div className="body-modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="body-modal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--body-text-main)' }}>
                  Thêm chỉ số cân đo
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--body-text-muted)', marginTop: '3px', display: 'block' }}>
                  Chỉ cần nhập Cân nặng. Các chỉ số InBody khác là tùy chọn (nếu có máy đo).
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--body-text-muted)', padding: '4px', display: 'grid', placeItems: 'center' }}
              >
                <AppIcon name="x" size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMeasurement} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>
                    Cân nặng (kg) *
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--body-accent)', fontWeight: 600 }}>Bắt buộc</span>
                </div>
                <input
                  type="number"
                  step="0.05"
                  required
                  autoFocus
                  placeholder="Ví dụ: 65.05"
                  value={newWeight}
                  onChange={e => setNewWeight(e.target.value)}
                  className="body-input"
                  style={{ fontFamily: 'var(--body-mono)', fontSize: '15px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--body-text-sub)' }}>
                    Tỷ lệ mỡ (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Ví dụ: 15.2"
                    value={newFat}
                    onChange={e => setNewFat(e.target.value)}
                    className="body-input"
                    style={{ fontFamily: 'var(--body-mono)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--body-text-sub)' }}>
                    Cơ xương (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Ví dụ: 29.6"
                    value={newMuscle}
                    onChange={e => setNewMuscle(e.target.value)}
                    className="body-input"
                    style={{ fontFamily: 'var(--body-mono)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--body-text-sub)' }}>
                    Mỡ nội tạng (mức 1–20)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="Ví dụ: 5.0"
                    value={newVisceral}
                    onChange={e => setNewVisceral(e.target.value)}
                    className="body-input"
                    style={{ fontFamily: 'var(--body-mono)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowTapeCalc(!showTapeCalc)}
                    style={{
                      height: '42px',
                      borderRadius: '8px',
                      border: '1px dashed var(--body-accent)',
                      background: showTapeCalc ? 'var(--body-accent-soft)' : 'transparent',
                      color: 'var(--body-accent)',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>📐</span>
                    <span>{showTapeCalc ? 'Đóng tính thước dây' : 'Tính mỡ qua thước dây'}</span>
                  </button>
                </div>
              </div>

              {/* Collapsible US Navy & WHtR Tape Calculator */}
              {showTapeCalc && (
                <div style={{
                  background: 'var(--body-shell-bg)',
                  borderRadius: '12px',
                  padding: '14px',
                  border: '1px solid var(--body-card-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                      📐 Công thức Hải quân Mỹ (US Navy & WHtR)
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--body-text-muted)' }}>
                      Không cần cân InBody
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: (editGender || profile?.gender) === 'female' ? '1fr 1fr 1fr' : '1fr 1fr', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--body-text-sub)' }}>Vòng eo (ngang rốn, cm) *</label>
                      <input
                        type="number"
                        step="0.5"
                        placeholder="78"
                        value={tapeWaist}
                        onChange={e => setTapeWaist(e.target.value)}
                        className="body-input"
                        style={{ height: '36px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--body-text-sub)' }}>Vòng cổ (dưới yết hầu, cm) *</label>
                      <input
                        type="number"
                        step="0.5"
                        placeholder="37"
                        value={tapeNeck}
                        onChange={e => setTapeNeck(e.target.value)}
                        className="body-input"
                        style={{ height: '36px' }}
                      />
                    </div>
                    {(editGender || profile?.gender) === 'female' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', color: 'var(--body-text-sub)' }}>Vòng hông (cm) *</label>
                        <input
                          type="number"
                          step="0.5"
                          placeholder="93"
                          value={tapeHip}
                          onChange={e => setTapeHip(e.target.value)}
                          className="body-input"
                          style={{ height: '36px' }}
                        />
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={handleRunTapeCalc}
                      style={{
                        padding: '7px 15px',
                        borderRadius: '6px',
                        background: 'var(--body-accent)',
                        color: '#fff',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Tính & Điền vào form
                    </button>

                    {tapeCalculated?.error && (
                      <span style={{ fontSize: '11.5px', color: BAD, fontWeight: 600 }}>
                        {tapeCalculated.error}
                      </span>
                    )}
                    {tapeCalculated?.fatPct != null && (
                      <span style={{ fontSize: '11.5px', color: GOOD, fontWeight: 600 }}>
                        ✓ Mỡ ước tính {f(tapeCalculated.fatPct)}%
                        {tapeCalculated.whtr != null && ` · Eo/Cao ${tapeCalculated.whtr.toFixed(2)} (${tapeCalculated.whtrStatus})`}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--body-text-sub)' }}>
                    Tỷ lệ nước (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Ví dụ: 58.9"
                    value={newWater}
                    onChange={e => setNewWater(e.target.value)}
                    className="body-input"
                    style={{ fontFamily: 'var(--body-mono)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--body-text-sub)' }}>
                    Khoáng xương (kg)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    placeholder="Ví dụ: 2.82"
                    value={newBone}
                    onChange={e => setNewBone(e.target.value)}
                    className="body-input"
                    style={{ fontFamily: 'var(--body-mono)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>
                  Thời điểm cân đo
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setNewTimeSlot('morning')}
                    style={{
                      height: '38px',
                      borderRadius: '8px',
                      border: `1.5px solid ${newTimeSlot === 'morning' ? 'var(--body-accent)' : 'var(--body-card-border)'}`,
                      background: newTimeSlot === 'morning' ? 'var(--body-accent-soft)' : 'var(--body-card-bg)',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: 'var(--body-text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    🌅 Sáng sớm (đói bụng)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTimeSlot('evening')}
                    style={{
                      height: '38px',
                      borderRadius: '8px',
                      border: `1.5px solid ${newTimeSlot === 'evening' ? 'var(--body-accent)' : 'var(--body-card-border)'}`,
                      background: newTimeSlot === 'evening' ? 'var(--body-accent-soft)' : 'var(--body-card-bg)',
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

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="body-btn body-btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  style={{ flex: 1, height: '42px' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="body-btn body-btn-primary"
                  style={{ flex: 1, height: '42px' }}
                >
                  Lưu số đo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
