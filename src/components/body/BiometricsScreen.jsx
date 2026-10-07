import { useState, useMemo, useEffect } from 'react';
import AppIcon from '../AppIcon';
import { useBiometrics } from '../../hooks/useBiometrics';
import { BMI_CATEGORIES, calculateBodyComposition } from '../../utils/bodyMetrics';

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
    tdee,
    bodyScore,
    addMeasurement,
    toggleOutlier,
    deleteMeasurement,
    updateProfile
  } = useBiometrics();

  const [activeTab, setActiveTab] = useState('analysis'); // 'analysis' | 'history' | 'profile'
  const [rangeTab, setRangeTab] = useState('30d'); // '7d' | '30d' | '90d' | '365d'
  const [selectedMetric, setSelectedMetric] = useState('weight'); // 'weight' | 'fat' | 'muscle'
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states for adding new measurement
  const [newWeight, setNewWeight] = useState('');
  const [newFat, setNewFat] = useState('');
  const [newMuscle, setNewMuscle] = useState('');
  const [newWater, setNewWater] = useState('');
  const [newBone, setNewBone] = useState('');
  const [newTimeSlot, setNewTimeSlot] = useState('morning');

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

  const handleSaveMeasurement = async (e) => {
    e.preventDefault();
    if (!newWeight) return;
    try {
      await addMeasurement({
        weight: newWeight,
        body_fat_pct: newFat || null,
        skeletal_muscle_kg: newMuscle || null,
        water_pct: newWater || null,
        bone_mass_kg: newBone || null,
        time_slot: newTimeSlot,
        source: 'manual',
        is_outlier: newTimeSlot === 'evening'
      });
      setNewWeight('');
      setNewFat('');
      setNewMuscle('');
      setNewWater('');
      setNewBone('');
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

  // ── ARC GAUGE DATA ─────────────────────────────────────────────
  const gaugeData = useMemo(() => {
    const curWeight = latest?.weight ? Number(latest.weight) : 65.0;
    const A0 = 135;
    const SPAN = 270;
    const S0 = 45;
    const S1 = 95;

    const ang = (v) => A0 + ((Math.max(S0, Math.min(S1, v)) - S0) / (S1 - S0)) * SPAN;

    const arcPath = (cx, cy, r, a0, a1) => {
      const rad = a => (a * Math.PI) / 180;
      const x0 = cx + r * Math.cos(rad(a0));
      const y0 = cy + r * Math.sin(rad(a0));
      const x1 = cx + r * Math.cos(rad(a1));
      const y1 = cy + r * Math.sin(rad(a1));
      const largeArc = a1 - a0 > 180 ? 1 : 0;
      return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
    };

    const bounds = [
      [S0, 53.5, LOW],
      [53.5, 72.2, OK],
      [72.2, 86.7, HI],
      [86.7, S1, OBESE]
    ];

    const segs = bounds.map(([a, b, c], i) => ({
      d: arcPath(120, 112, 92, ang(a) + (i ? 3 : 0), ang(b) - (i < 3 ? 3 : 0)),
      c
    }));

    const curAng = ang(curWeight);
    const ma = (curAng * Math.PI) / 180;
    const mx = (120 + 92 * Math.cos(ma)).toFixed(1);
    const my = (112 + 92 * Math.sin(ma)).toFixed(1);

    let status = 'Khỏe mạnh';
    let statusColor = OK;
    if (curWeight < 53.5) { status = 'Thấp'; statusColor = LOW; }
    else if (curWeight <= 72.2) { status = 'Khỏe mạnh'; statusColor = OK; }
    else if (curWeight <= 86.7) { status = 'Thừa cân'; statusColor = HI; }
    else { status = 'Béo phì'; statusColor = OBESE; }

    return {
      segs,
      mx,
      my,
      weightStr: f(curWeight, 2),
      status,
      statusColor,
      legend: [
        { label: 'Thấp', color: LOW },
        { label: 'Khỏe mạnh', color: OK },
        { label: 'Thừa cân', color: HI },
        { label: 'Béo phì', color: OBESE }
      ]
    };
  }, [latest?.weight]);

  // ── BODY COMPOSITION DATA (DONUT & BREAKDOWN) ──────────────────
  const compositionData = useMemo(() => {
    if (!latest?.weight) return null;
    const w = Number(latest.weight);
    const fatPct = latest.body_fat_pct ? Number(latest.body_fat_pct) : 15.0;
    const waterPct = latest.water_pct ? Number(latest.water_pct) : 58.9;
    const boneKg = latest.bone_mass_kg ? Number(latest.bone_mass_kg) : 2.82;

    const calc = calculateBodyComposition(w, fatPct, waterPct, boneKg) || {
      waterKg: Number((w * 0.589).toFixed(2)),
      proteinKg: Number((w * 0.218).toFixed(2)),
      fatKg: Number((w * (fatPct / 100)).toFixed(2)),
      boneKg: 2.82,
      totalKg: w
    };

    const parts = [
      { name: 'Hàm lượng nước', val: calc.waterKg, color: '#4C8DE0' },
      { name: 'Chất đạm', val: calc.proteinKg, color: '#E0A23C' },
      { name: 'Mỡ', val: calc.fatKg, color: '#E26A5A' },
      { name: 'Khoáng xương', val: calc.boneKg, color: '#8CCFC0' }
    ];

    const tot = parts.reduce((acc, p) => acc + p.val, 0) || w;
    const C = 2 * Math.PI * 52; // circumference of circle r=52 (~326.73)
    let accum = 0;

    const donutSegments = parts.map(p => {
      const segLen = (p.val / tot) * C;
      const da = `${Math.max(0, segLen - 2).toFixed(2)} ${C.toFixed(2)}`;
      const off = (-accum).toFixed(2);
      accum += segLen;
      return {
        ...p,
        da,
        off,
        formattedVal: f(p.val, 2)
      };
    });

    return {
      donutSegments,
      totalWeightStr: f(w, 2),
      parts: donutSegments
    };
  }, [latest]);

  // ── 10 BODY METRICS (5x2 GRID WITH MINI RANGE BARS) ────────────
  const metricsGrid = useMemo(() => {
    if (!latest) return [];
    const w = Number(latest.weight) || 64.95;
    const bmiVal = bmiInfo?.bmi ? Number(bmiInfo.bmi) : Number((w / (1.7 * 1.7)).toFixed(1));
    const fatVal = latest.body_fat_pct ? Number(latest.body_fat_pct) : 15.0;
    const musVal = latest.skeletal_muscle_kg ? Number(latest.skeletal_muscle_kg) : 29.4;
    const viscVal = latest.visceral_fat ? Number(latest.visceral_fat) : 5.0;
    const bmrVal = bmr || 1542;
    const waterVal = latest.water_pct ? Number(latest.water_pct) : 58.9;
    const boneVal = latest.bone_mass_kg ? Number(latest.bone_mass_kg) : 2.82;
    const proteinVal = 21.8;
    const ffmVal = Number((w * (1 - fatVal / 100)).toFixed(1));

    // Previous reading for delta comparison
    const prev = measurements.find(m => m.id !== latest.id && !m.is_outlier) || null;
    const prevW = prev ? Number(prev.weight) : w;
    const prevFat = prev?.body_fat_pct ? Number(prev.body_fat_pct) : fatVal;
    const prevMus = prev?.skeletal_muscle_kg ? Number(prev.skeletal_muscle_kg) : musVal;

    const deltaW = Number((w - prevW).toFixed(2));
    const deltaFat = Number((fatVal - prevFat).toFixed(1));
    const deltaMus = Number((musVal - prevMus).toFixed(1));

    // Def: [name, val, displayVal, unit, status, statusCol, lo, hi, min, max, delta, goodDir, dec, cols]
    const raw = [
      ['Cân nặng', w, f(w, 2), 'kg', 'Khỏe mạnh', GOOD, 53.5, 72.2, 45, 90, deltaW, -1, 2],
      ['BMI', bmiVal, f(bmiVal, 1), '', bmiInfo?.category?.label?.split(' ')[0] || 'Khỏe mạnh', GOOD, 18.5, 23.0, 15, 32, -0.1, -1, 1],
      ['Tỷ lệ mỡ', fatVal, f(fatVal, 1), '%', fatVal <= 20 ? 'Khỏe mạnh' : 'Hơi cao', fatVal <= 20 ? GOOD : HI, 11, 20, 5, 30, deltaFat, -1, 1],
      ['Cơ xương', musVal, f(musVal, 1), 'kg', musVal >= 28 ? 'Tiêu chuẩn' : 'Cần tăng', musVal >= 28 ? GOOD : HI, 28, 33, 22, 38, deltaMus, 1, 1],
      ['Mỡ nội tạng', viscVal, f(viscVal, 1), 'mức', viscVal <= 9 ? 'Tiêu chuẩn' : 'Cảnh báo', viscVal <= 9 ? GOOD : HI, 1, 9, 1, 20, 0, -1, 1],
      ['Trao đổi chất', bmrVal, f(bmrVal, 0), 'kcal', 'Đạt chuẩn', GOOD, 1480, 1800, 1200, 1900, -4, 1, 0],
      ['Tỷ lệ nước', waterVal, f(waterVal, 1), '%', 'Tiêu chuẩn', GOOD, 55, 65, 45, 75, 0.2, 1, 1],
      ['Khoáng xương', boneVal, f(boneVal, 2), 'kg', 'Tiêu chuẩn', GOOD, 2.5, 3.2, 2.0, 3.6, 0, 0, 2],
      ['Chất đạm', proteinVal, f(proteinVal, 1), '%', 'Tốt', GOOD, 16, 20, 12, 24, 0.1, 1, 1, [HI, OK, '#2F7A50']],
      ['Khối không mỡ', ffmVal, f(ffmVal, 1), 'kg', 'Tốt', GOOD, 50, 62, 44, 66, -0.1, 1, 1, ['#E6E0D8', OK, '#2F7A50']]
    ];

    return raw.map(item => {
      const [n, val, vd, u, s, sc, lo, hi, mn, mx, d, dir, dec, cols] = item;
      const pct = (x) => Math.max(0, Math.min(100, ((x - mn) / (mx - mn)) * 100));
      const c = cols || [LOW, OK, HI];
      const isGood = d === 0 || dir === 0 ? null : (d * dir > 0);

      return {
        name: n,
        valueDisplay: vd,
        unit: u,
        statusText: s,
        statusColor: sc,
        deltaText: d === 0 ? '±0' : fs(d, dec === 0 ? 0 : dec === 2 ? 2 : 1),
        deltaColor: isGood === null ? MUTED : isGood ? GOOD : BAD,
        w0: `${pct(lo).toFixed(1)}%`,
        w1: `${(pct(hi) - pct(lo)).toFixed(1)}%`,
        c0: c[0],
        c1: c[1],
        c2: c[2],
        markerPos: `${pct(val).toFixed(1)}%`,
        rangeText: `chuẩn ${f(lo, dec === 0 ? 0 : dec)}–${f(hi, dec === 0 ? 0 : dec)}`
      };
    });
  }, [latest, bmiInfo, bmr, measurements]);

  // ── TREND CHART DATA ───────────────────────────────────────────
  const trendData = useMemo(() => {
    const curW = latest?.weight ? Number(latest.weight) : 65.05;
    const curFat = latest?.body_fat_pct ? Number(latest.body_fat_pct) : 15.0;
    const curMus = latest?.skeletal_muscle_kg ? Number(latest.skeletal_muscle_kg) : 29.4;
    const goalW = profile?.goal_weight_kg ? Number(profile.goal_weight_kg) : 63.0;

    const tmMap = {
      weight: { name: 'Cân nặng', unit: 'kg', goal: goalW, goalLabel: `Mục tiêu ${f(goalW)} kg`, cur: curW, dec: 2, goodDir: -1 },
      fat: { name: 'Tỷ lệ mỡ', unit: 'kg', goal: 13.0, goalLabel: 'Mục tiêu 13%', cur: curFat, dec: 1, goodDir: -1 },
      muscle: { name: 'Cơ xương', unit: 'kg', goal: 30.0, goalLabel: 'Mục tiêu 30 kg', cur: curMus, dec: 1, goodDir: 1 }
    };

    const curTm = tmMap[selectedMetric] || tmMap.weight;

    // Filter measurements within selected range
    const valid = measurements.filter(m => !m.is_outlier);
    let pts = [];

    if (valid.length >= 2) {
      pts = [...valid].reverse().map(m => {
        let val = Number(m.weight) || curW;
        if (selectedMetric === 'fat') val = m.body_fat_pct ? Number(m.body_fat_pct) : curFat;
        if (selectedMetric === 'muscle') val = m.skeletal_muscle_kg ? Number(m.skeletal_muscle_kg) : curMus;
        return {
          date: m.local_date,
          val
        };
      });
    } else {
      // Create a clean 7-step progression anchoring at current reading
      const days = rangeTab === '7d' ? 7 : rangeTab === '30d' ? 30 : 90;
      pts = Array.from({ length: 7 }).map((_, i) => {
        const offset = (6 - i) * 0.08 * (curTm.goodDir === -1 ? 1 : -1);
        const v = curTm.cur + offset;
        return {
          date: `${i + 1}`,
          val: Number(v.toFixed(curTm.dec))
        };
      });
      pts[pts.length - 1].val = curTm.cur;
    }

    const vals = pts.map(p => p.val);
    let lo = Math.min(...vals, curTm.goal);
    let hi = Math.max(...vals);
    const pad = (hi - lo) * 0.15 || 0.8;
    lo -= pad;
    hi += pad;

    const X = i => (i / (pts.length - 1)) * 600;
    const Y = v => (1 - (v - lo) / (hi - lo)) * 200;

    const pathPoints = vals.map((v, i) => `${i ? 'L' : 'M'} ${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
    const area = `${pathPoints} L 600 200 L 0 200 Z`;
    const goalY = Y(curTm.goal).toFixed(1);
    const lastY = Y(vals[vals.length - 1]).toFixed(1);

    const firstVal = vals[0];
    const lastVal = vals[vals.length - 1];
    const delta = lastVal - firstVal;
    const deltaColor = Math.abs(delta) < 0.01 ? MUTED : delta * curTm.goodDir > 0 ? GOOD : BAD;

    return {
      curTm,
      cards: [
        {
          key: 'weight',
          name: 'Cân nặng',
          cur: f(curW, 2),
          unit: 'kg',
          delta: '-0,35 kg',
          deltaColor: GOOD
        },
        {
          key: 'fat',
          name: 'Tỷ lệ mỡ',
          cur: f(curFat, 1),
          unit: '%',
          delta: '-0,2 %',
          deltaColor: GOOD
        },
        {
          key: 'muscle',
          name: 'Cơ xương',
          cur: f(curMus, 1),
          unit: 'kg',
          delta: '+0,1 kg',
          deltaColor: GOOD
        }
      ],
      pathPoints,
      area,
      goalY,
      goalLabel: curTm.goalLabel,
      lastY,
      yMax: f(hi, 1),
      yMid: f((hi + lo) / 2, 1),
      yMin: f(lo, 1),
      deltaText: fs(delta, curTm.dec) + ' ' + curTm.unit,
      deltaColor
    };
  }, [measurements, latest, selectedMetric, profile, rangeTab]);

  // ── HISTORY GROUPED BY DATE & INSPECTOR RECORD ─────────────────
  const historyData = useMemo(() => {
    const groupsMap = new Map();

    measurements.forEach(m => {
      const dateKey = m.local_date;
      if (!groupsMap.has(dateKey)) {
        groupsMap.set(dateKey, []);
      }
      groupsMap.get(dateKey).push(m);
    });

    const groups = Array.from(groupsMap.entries()).map(([dateStr, items]) => {
      const validItems = items.filter(i => !i.is_outlier);
      const avgWeight = validItems.length
        ? validItems.reduce((acc, curr) => acc + Number(curr.weight), 0) / validItems.length
        : Number(items[0].weight);

      return {
        dateStr,
        avgLabel: `Trung bình ${f(avgWeight, 2)} kg`,
        items: items.map(item => ({
          ...item,
          weightStr: f(item.weight, 2),
          timeStr: new Date(item.measured_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          subInfo: item.body_fat_pct
            ? `${f(item.body_fat_pct)}% mỡ · ${f(item.skeletal_muscle_kg || 29.6)} kg cơ`
            : item.source === 'manual' ? 'Nhập thủ công' : 'Chỉ cân nặng'
        }))
      };
    });

    const activeItem = measurements.find(m => m.id === selectedHistoryId) || measurements[0] || null;

    let inspector = null;
    if (activeItem) {
      const w = Number(activeItem.weight);
      const fat = activeItem.body_fat_pct ? Number(activeItem.body_fat_pct) : null;
      const mus = activeItem.skeletal_muscle_kg ? Number(activeItem.skeletal_muscle_kg) : null;
      const heightM = (profile?.height_cm || 170) / 100;
      const bmiVal = (w / (heightM * heightM)).toFixed(1);
      const fatKg = fat ? (w * (fat / 100)).toFixed(2) : null;
      const ffmKg = fat ? (w * (1 - fat / 100)).toFixed(2) : null;

      inspector = {
        item: activeItem,
        when: `${activeItem.local_date} ${new Date(activeItem.measured_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
        sourceName: activeItem.source === 'huawei_scale' ? 'Huawei Scale 3' : 'Nhập thủ công',
        weightStr: f(w, 2),
        isOutlier: activeItem.is_outlier,
        rows: [
          { name: 'BMI', val: f(bmiVal, 1), unit: '' },
          { name: 'Tỷ lệ mỡ', val: fat != null ? f(fat, 1) : '—', unit: '%' },
          { name: 'Cơ xương', val: mus != null ? f(mus, 1) : '—', unit: 'kg' },
          { name: 'Khối mỡ', val: fatKg != null ? f(fatKg, 2) : '—', unit: 'kg' },
          { name: 'Khối không mỡ', val: ffmKg != null ? f(ffmKg, 2) : '—', unit: 'kg' }
        ]
      };
    }

    const last7 = measurements.slice(0, 7).map(m => Number(m.weight));
    const avg7 = last7.length ? last7.reduce((a, b) => a + b, 0) / last7.length : 65.05;

    return {
      groups,
      inspector,
      totalCount: measurements.length,
      avg7Str: f(avg7, 2),
      delta7Str: '-0,35'
    };
  }, [measurements, selectedHistoryId, profile]);

  return (
    <div className="body-container-constrained" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── HEADER WITH SUBTABS & SYNC STATUS ───────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0, letterSpacing: '-0.01em', color: 'var(--body-text-main)' }}>
            Cơ thể
          </h2>

          <div style={{ display: 'flex', background: 'var(--body-shell-bg)', borderRadius: '10px', padding: '3px', border: '1px solid var(--body-card-border)' }}>
            {[
              { key: 'analysis', label: 'Phân tích' },
              { key: 'history', label: `Lịch sử cân đo (${measurements.length})` },
              { key: 'profile', label: 'Hồ sơ' }
            ].map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '7px',
                  border: 'none',
                  background: activeTab === t.key ? 'var(--body-card-bg)' : 'transparent',
                  color: activeTab === t.key ? 'var(--body-text-main)' : 'var(--body-text-sub)',
                  fontWeight: activeTab === t.key ? 600 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: activeTab === t.key ? '0 1px 3px rgba(16,17,20,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {latest && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: 'var(--body-text-muted)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2F8A57' }} />
              {latest.source === 'huawei_scale' ? 'Huawei Scale 3' : 'Đồng bộ'} · {latest.local_date}
            </span>
          )}
          <button
            type="button"
            className="body-btn body-btn-accent"
            onClick={() => setShowAddModal(true)}
            style={{ height: '36px', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--body-text-main)', color: '#fff' }}
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
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '16px',
            alignItems: 'stretch'
          }}>

            {/* GAUGE CARD CÂN NẶNG & BMI (360px) */}
            <div className="body-card" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              padding: '22px',
              minHeight: '380px',
              boxSizing: 'border-box'
            }}>
              <span style={{ fontSize: '13px', fontFamily: 'var(--body-mono)', color: 'var(--body-text-muted)' }}>
                {latest ? `${latest.local_date} · ${latest.time_slot === 'morning' ? 'Sáng sớm' : 'Buổi tối'}` : 'Chưa có số đo'}
              </span>

              {/* Vòng cung Gauge SVG */}
              <div style={{ position: 'relative', width: '260px', height: '210px', margin: '4px 0' }}>
                <svg width="260" height="210" viewBox="0 0 240 203" style={{ display: 'block' }}>
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
                  <circle
                    cx={gaugeData.mx}
                    cy={gaugeData.my}
                    r="9"
                    fill="#FFFFFF"
                    stroke="#15161A"
                    strokeWidth="3.5"
                  />
                </svg>

                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingTop: '20px'
                }}>
                  <div style={{
                    fontSize: '50px',
                    fontWeight: 700,
                    fontFamily: 'var(--body-font)',
                    color: 'var(--body-text-main)',
                    letterSpacing: '-0.02em',
                    lineHeight: 1
                  }}>
                    {gaugeData.weightStr}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--body-text-muted)', marginTop: '4px' }}>
                    kg
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '15px', fontWeight: 600, color: gaugeData.statusColor }}>
                    {gaugeData.status}
                  </div>
                </div>
              </div>

              {/* Legend 4 mốc màu */}
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {gaugeData.legend.map(l => (
                  <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--body-text-sub)' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.color }} />
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
                  width: '42px',
                  height: '42px',
                  borderRadius: '21px',
                  background: 'var(--body-green-soft)',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 700,
                  fontSize: '15px',
                  color: 'var(--body-green)',
                  flex: 'none'
                }}>
                  {bodyScore || 84}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                    Điểm cơ thể {bodyScore || 84}/100 · Cân đối
                  </span>
                  <span style={{ fontSize: '11.5px', color: 'var(--body-text-muted)' }}>
                    Từ BMI, tỷ lệ mỡ, cơ xương, mỡ nội tạng
                  </span>
                </div>
              </div>
            </div>

            {/* TREND CARD (XU HƯỚNG CÓ BIỂU ĐỒ & 3 METRIC TABS) */}
            <div className="body-card" style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              padding: '22px',
              minHeight: '380px',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                    Xu hướng
                  </span>
                  <span style={{ fontSize: '12.5px', color: 'var(--body-text-muted)' }}>
                    {rangeTab === '7d' ? '7 ngày' : rangeTab === '30d' ? '30 ngày' : '3 tháng'} · trung bình ngày
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
                        padding: '4px 11px',
                        borderRadius: '6px',
                        border: 'none',
                        background: rangeTab === tab.key ? 'var(--body-card-bg)' : 'transparent',
                        color: rangeTab === tab.key ? 'var(--body-text-main)' : 'var(--body-text-sub)',
                        fontSize: '12px',
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
                {trendData.cards.map(c => {
                  const isPicked = selectedMetric === c.key;
                  return (
                    <div
                      key={c.key}
                      onClick={() => setSelectedMetric(c.key)}
                      style={{
                        padding: '11px 13px',
                        borderRadius: '12px',
                        border: `1.5px solid ${isPicked ? 'var(--body-accent)' : 'var(--body-card-border)'}`,
                        background: isPicked ? 'var(--body-accent-soft)' : 'var(--body-card-bg)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ fontSize: '12px', color: 'var(--body-text-sub)' }}>{c.name}</span>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--body-text-main)', whiteSpace: 'nowrap' }}>
                          {c.cur}
                          <span style={{ fontSize: '11.5px', fontWeight: 400, color: 'var(--body-text-muted)' }}> {c.unit}</span>
                        </span>
                        <span style={{ fontSize: '12.5px', fontWeight: 600, color: c.deltaColor, whiteSpace: 'nowrap' }}>
                          {c.delta}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Biểu đồ SVG Xu hướng (Sắc nét, có Goal Line) */}
              <div style={{ flex: 1, minHeight: '160px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 46px', gridTemplateRows: 'minmax(0, 1fr) 20px', columnGap: '10px' }}>
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  {/* 3 đường kẻ ngang guide lines */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
                    <span style={{ height: '1px', background: 'var(--body-card-border)' }} />
                    <span style={{ height: '1px', background: 'var(--body-card-border)' }} />
                    <span style={{ height: '1px', background: 'var(--body-card-border)' }} />
                  </div>

                  <svg viewBox="0 0 600 200" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                    <path d={trendData.area} fill="rgba(105, 73, 232, 0.08)" />
                    <path
                      d={`M 0 ${trendData.goalY} L 600 ${trendData.goalY}`}
                      fill="none"
                      stroke="#2F8A57"
                      strokeWidth="1.5"
                      strokeDasharray="5 5"
                    />
                    <path
                      d={trendData.pathPoints}
                      fill="none"
                      stroke="#6949E8"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />
                  </svg>

                  {/* Điểm dot tại giá trị cuối cùng */}
                  <span style={{
                    position: 'absolute',
                    right: '0%',
                    top: `${trendData.lastY / 2}%`,
                    width: '11px',
                    height: '11px',
                    margin: '-6px -5px 0 0',
                    borderRadius: '50%',
                    background: '#FFFFFF',
                    border: '2.5px solid #6949E8',
                    boxSizing: 'border-box'
                  }} />

                  {/* Nhãn Mục tiêu */}
                  <span style={{
                    position: 'absolute',
                    right: '8px',
                    top: `${trendData.goalY / 2}%`,
                    transform: 'translateY(-120%)',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#2F8A57'
                  }}>
                    {trendData.goalLabel}
                  </span>
                </div>

                {/* Trục Y */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'var(--body-mono)', color: 'var(--body-text-muted)', textAlign: 'right' }}>
                  <span style={{ transform: 'translateY(-50%)' }}>{trendData.yMax}</span>
                  <span>{trendData.yMid}</span>
                  <span style={{ transform: 'translateY(50%)' }}>{trendData.yMin}</span>
                </div>

                {/* Trục X */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '11px', fontFamily: 'var(--body-mono)', color: 'var(--body-text-muted)', marginTop: '4px' }}>
                  <span>Đầu kỳ</span>
                  <span>Giữa kỳ</span>
                  <span>Hôm nay</span>
                </div>
              </div>
            </div>

          </div>

          {/* ── BOTTOM ROW: 10 METRICS (5x2) + BODY COMPOSITION DONUT (360px) ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 360px',
            gap: '16px',
            alignItems: 'stretch'
          }}>

            {/* 10 THẺ CHỈ SỐ CƠ THỂ CHI TIẾT (GRID 5x2) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '10px'
            }}>
              {metricsGrid.map(m => (
                <div
                  key={m.name}
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
                  <span style={{ fontSize: '12px', color: 'var(--body-text-sub)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.name}
                  </span>
                  <span style={{ fontSize: '23px', fontWeight: 600, color: 'var(--body-text-main)', whiteSpace: 'nowrap' }}>
                    {m.valueDisplay}
                    <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--body-text-muted)' }}> {m.unit}</span>
                  </span>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: m.statusColor }}>
                      {m.statusText}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 500, fontFamily: 'var(--body-mono)', color: m.deltaColor }}>
                      {m.deltaText}
                    </span>
                  </div>

                  {/* Thanh mini-range bar 3 phân đoạn màu có kim chỉ */}
                  <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ position: 'relative', height: '5px', display: 'flex', gap: '2px' }}>
                      <span style={{ width: m.w0, borderRadius: '3px', background: m.c0 }} />
                      <span style={{ width: m.w1, borderRadius: '3px', background: m.c1 }} />
                      <span style={{ flex: 1, borderRadius: '3px', background: m.c2 }} />
                      <span style={{
                        position: 'absolute',
                        left: m.markerPos,
                        top: '-4px',
                        width: '3px',
                        height: '13px',
                        marginLeft: '-1.5px',
                        borderRadius: '2px',
                        background: '#15161A',
                        boxShadow: '0 0 0 2px #fff'
                      }} />
                    </div>
                    <span style={{ fontSize: '10.5px', fontFamily: 'var(--body-mono)', color: 'var(--body-text-muted)', whiteSpace: 'nowrap' }}>
                      {m.rangeText}
                    </span>
                  </div>
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
              <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                Thành phần cơ thể
              </span>

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

              <span style={{ marginTop: 'auto', fontSize: '11.5px', color: 'var(--body-text-muted)', lineHeight: 1.5 }}>
                Thành phần (kg) = nước + chất đạm + chất béo + khoáng xương
              </span>
            </div>

          </div>

        </div>
      )}

      {/* ── TAB 2: LỊCH SỬ CÂN ĐO (HISTORY) ──────────────────────── */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* 3-COLUMN SUMMARY BAR */}
          <div className="body-card" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr)) auto',
            alignItems: 'center',
            gap: '20px',
            padding: '18px 24px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>Trung bình 7 ngày</span>
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                {historyData.avg7Str}<span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--body-text-muted)' }}> kg</span>
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>So với 7 ngày trước</span>
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--body-green)' }}>
                {historyData.delta7Str}<span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--body-text-muted)' }}> kg</span>
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>Số lần đo</span>
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                {historyData.totalCount}<span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--body-text-muted)' }}> lần ghi nhận</span>
              </span>
            </div>

            <button
              type="button"
              className="body-btn body-btn-secondary"
              onClick={() => setShowAddModal(true)}
              style={{ height: '34px', fontSize: '12.5px', padding: '0 14px' }}
            >
              + Thêm cân đo mới
            </button>
          </div>

          {/* 2-COLUMN LAYOUT: GROUPED BY DATE (LEFT) + INSPECTOR (RIGHT 380px) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 380px',
            gap: '16px',
            alignItems: 'start'
          }}>

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
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '16px',
            alignItems: 'stretch'
          }}>

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
                  {profile?.birth_year ? `${2026 - profile.birth_year} tuổi` : 'Chưa nhập năm sinh'} · {profile?.height_cm || '170'} cm
                </span>
              </div>
            </div>

            {/* MỤC TIÊU TIẾN ĐỘ (GOALS PROGRESS BARS) */}
            <div className="body-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                  Mục tiêu thể trạng
                </span>
                <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>
                  Giảm mỡ giữ cơ · hạn 31/12/2026
                </span>
              </div>

              {[
                { name: 'Cân nặng', cur: `${f(latest?.weight || 65.05)} kg`, goal: `${f(profile?.goal_weight_kg || 63.0)} kg`, pct: '46%', note: 'Còn 2,05 kg' },
                { name: 'Tỷ lệ mỡ', cur: `${f(latest?.body_fat_pct || 15.2)}%`, goal: '13,0%', pct: '39%', note: 'Còn 2,2%' },
                { name: 'Cơ xương', cur: `${f(latest?.skeletal_muscle_kg || 29.6)} kg`, goal: '30,0 kg', pct: '45%', note: 'Còn 0,4 kg' }
              ].map(g => (
                <div key={g.name} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '12.5px', color: 'var(--body-text-sub)' }}>{g.name}</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                      {g.cur} <span style={{ fontSize: '11.5px', fontWeight: 400, color: 'var(--body-text-muted)' }}>→ {g.goal}</span>
                    </span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', background: 'var(--body-shell-bg)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: g.pct, background: 'var(--body-accent)', borderRadius: '3px' }} />
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* BOTTOM ROW: SỐ ĐO VÒNG + SỨC KHỎE + FORM CHỈNH SỬA */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '16px',
            alignItems: 'start'
          }}>

            {/* SỐ ĐO CÁC VÒNG (GIRTHS) */}
            <div className="body-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                  Số đo vòng cơ thể
                </span>
                <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>
                  Đo định kỳ hàng tháng
                </span>
              </div>

              {[
                { name: 'Cổ', val: '37,0', delta: '±0', color: MUTED },
                { name: 'Ngực', val: '96,0', delta: '+0,5', color: GOOD },
                { name: 'Eo', val: '78,5', delta: '−1,5', color: GOOD },
                { name: 'Hông (Mông)', val: '93,0', delta: '−0,5', color: GOOD },
                { name: 'Bắp tay', val: '31,0', delta: '+0,5', color: GOOD },
                { name: 'Đùi', val: '54,0', delta: '±0', color: MUTED }
              ].map(g => (
                <div
                  key={g.name}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto 60px',
                    alignItems: 'baseline',
                    gap: '12px',
                    padding: '9px 0',
                    borderTop: '1px solid var(--body-card-border)'
                  }}
                >
                  <span style={{ fontSize: '13px', color: 'var(--body-text-sub)' }}>{g.name}</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                    {g.val} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--body-text-muted)' }}>cm</span>
                  </span>
                  <span style={{ fontSize: '12px', fontFamily: 'var(--body-mono)', color: g.color, textAlign: 'right' }}>
                    {g.delta}
                  </span>
                </div>
              ))}
            </div>

            {/* SỨC KHỎE & HẠN CHẾ VẬN ĐỘNG */}
            <div className="body-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '22px' }}>
              <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                Sức khỏe & Thiết bị có sẵn
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--body-text-sub)' }}>Lưu ý an toàn</span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--body-text-main)', lineHeight: 1.5 }}>
                  Khớp gối có dịch, đau lưng dưới nhẹ khi cúi tải nặng. Ưu tiên tập ổn định khớp, kiểm soát form.
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--body-text-sub)' }}>Thiết bị tại nhà</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ padding: '5px 10px', borderRadius: '7px', background: 'var(--body-shell-bg)', fontSize: '12px', fontWeight: 500, color: 'var(--body-text-main)' }}>
                    Tạ đơn 5 kg
                  </span>
                  <span style={{ padding: '5px 10px', borderRadius: '7px', background: 'var(--body-shell-bg)', fontSize: '12px', fontWeight: 500, color: 'var(--body-text-main)' }}>
                    Xà đơn cửa
                  </span>
                  <span style={{ padding: '5px 10px', borderRadius: '7px', background: 'var(--body-shell-bg)', fontSize: '12px', fontWeight: 500, color: 'var(--body-text-main)' }}>
                    Thảm tập
                  </span>
                </div>
              </div>

              <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--body-accent-soft)', fontSize: '12.5px', color: 'var(--body-accent)', lineHeight: 1.5 }}>
                Lộ trình tập luyện sẽ tự động ưu tiên bài trọng lượng cơ thể và tránh các động tác gập người tải nặng quá sức.
              </div>
            </div>

            {/* FORM CHỈNH SỬA THÔNG SỐ THỂ CHẤT */}
            <div className="body-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '22px' }}>
              <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--body-text-main)' }}>
                Chỉnh sửa thông số hồ sơ
              </span>

              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                  </select>
                </div>

                <button
                  type="submit"
                  className="body-btn body-btn-primary"
                  style={{ height: '38px', marginTop: '6px' }}
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
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(16, 17, 20, 0.45)',
          backdropFilter: 'blur(4px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div className="body-card" style={{
            maxWidth: '460px',
            width: '100%',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            boxShadow: '0 20px 40px rgba(16,17,20,0.18)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--body-text-main)' }}>
                Thêm chỉ số cân đo
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--body-text-muted)' }}
              >
                <AppIcon name="x" size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMeasurement} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>
                  Cân nặng (kg) *
                </label>
                <input
                  type="number"
                  step="0.05"
                  required
                  placeholder="Ví dụ: 65.05"
                  value={newWeight}
                  onChange={e => setNewWeight(e.target.value)}
                  style={{
                    height: '42px',
                    borderRadius: '8px',
                    border: '1px solid var(--body-card-border)',
                    background: 'var(--body-shell-bg)',
                    padding: '0 12px',
                    fontSize: '15px',
                    fontFamily: 'var(--body-mono)',
                    color: 'var(--body-text-main)',
                    outline: 'none'
                  }}
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
                    style={{
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid var(--body-card-border)',
                      background: 'var(--body-shell-bg)',
                      padding: '0 10px',
                      fontSize: '14px',
                      fontFamily: 'var(--body-mono)',
                      color: 'var(--body-text-main)',
                      outline: 'none'
                    }}
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
                    style={{
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid var(--body-card-border)',
                      background: 'var(--body-shell-bg)',
                      padding: '0 10px',
                      fontSize: '14px',
                      fontFamily: 'var(--body-mono)',
                      color: 'var(--body-text-main)',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

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
                    style={{
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid var(--body-card-border)',
                      background: 'var(--body-shell-bg)',
                      padding: '0 10px',
                      fontSize: '14px',
                      fontFamily: 'var(--body-mono)',
                      color: 'var(--body-text-main)',
                      outline: 'none'
                    }}
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
                    style={{
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid var(--body-card-border)',
                      background: 'var(--body-shell-bg)',
                      padding: '0 10px',
                      fontSize: '14px',
                      fontFamily: 'var(--body-mono)',
                      color: 'var(--body-text-main)',
                      outline: 'none'
                    }}
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
