import { useState, useMemo, useEffect } from 'react';
import AppIcon from '../AppIcon';
import { useBiometrics } from '../../hooks/useBiometrics';
import { BMI_CATEGORIES } from '../../utils/bodyMetrics';

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
  const [rangeTab, setRangeTab] = useState('30d'); // '7d' | '30d' | '90d'
  const [selectedMetric, setSelectedMetric] = useState('weight'); // 'weight' | 'fat' | 'muscle'
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states for adding new measurement
  const [newWeight, setNewWeight] = useState('');
  const [newFat, setNewFat] = useState('');
  const [newMuscle, setNewMuscle] = useState('');
  const [newTimeSlot, setNewTimeSlot] = useState('morning');

  // Profile edit states (empty defaults if profile not yet created)
  const [editHeight, setEditHeight] = useState(profile?.height_cm || '');
  const [editGoalWeight, setEditGoalWeight] = useState(profile?.goal_weight_kg || '');
  const [editActivity, setEditActivity] = useState(profile?.activity_level || 'moderate');
  const [editGender, setEditGender] = useState(profile?.gender || 'male');
  const [editBirthYear, setEditBirthYear] = useState(profile?.birth_year || '');
  const [profileSaved, setProfileSaved] = useState(false);
  const [now] = useState(() => Date.now());

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

  const handleSaveMeasurement = async (e) => {
    e.preventDefault();
    if (!newWeight) return;
    try {
      await addMeasurement({
        weight: newWeight,
        body_fat_pct: newFat || null,
        skeletal_muscle_kg: newMuscle || null,
        time_slot: newTimeSlot,
        source: 'manual',
        is_outlier: newTimeSlot === 'evening'
      });
      setNewWeight('');
      setNewFat('');
      setNewMuscle('');
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

  // Dynamic pointer coordinates on the arc gauge (piecewise linear mapping per BMI category)
  const bmiPointerCoords = useMemo(() => {
    if (!bmiInfo?.bmi) return { cx: 120, cy: 60 };
    const bmiVal = Number(bmiInfo.bmi);
    let deg;
    if (bmiVal <= 18.5) {
      const clamped = Math.max(14, bmiVal);
      const ratio = (clamped - 14) / (18.5 - 14); // 0..1
      deg = 180 - ratio * (180 - 128);
    } else if (bmiVal <= 23.0) {
      const ratio = (bmiVal - 18.5) / (23.0 - 18.5); // 0..1
      deg = 122 - ratio * (122 - 74);
    } else if (bmiVal <= 25.0) {
      const ratio = (bmiVal - 23.0) / (25.0 - 23.0); // 0..1
      deg = 68 - ratio * (68 - 40);
    } else {
      const clamped = Math.min(35, bmiVal);
      const ratio = (clamped - 25.0) / (35.0 - 25.0); // 0..1
      deg = 35 - ratio * 35;
    }

    const rad = (deg * Math.PI) / 180;
    const cx = 120 + 90 * Math.cos(rad);
    const cy = 150 - 90 * Math.sin(rad);
    return { cx: Math.round(cx), cy: Math.round(cy) };
  }, [bmiInfo?.bmi]);

  const bodyScoreLabel = useMemo(() => {
    if (bodyScore == null) return null;
    if (bodyScore >= 80) return 'Rất tốt';
    if (bodyScore >= 65) return 'Cân đối';
    if (bodyScore >= 50) return 'Trung bình';
    return 'Cần cải thiện';
  }, [bodyScore]);

  // Tính toán trend line từ dữ liệu thật có áp dụng filter theo khoảng thời gian
  const sparklineData = useMemo(() => {
    const valid = measurements.filter(m => !m.is_outlier);
    if (valid.length < 2) return null;

    const daysLimit = rangeTab === '7d' ? 7 : rangeTab === '30d' ? 30 : 90;
    const cutoffTime = now - daysLimit * 24 * 3600 * 1000;
    const inRange = valid.filter(m => {
      const t = new Date(m.measured_at || m.local_date).getTime();
      return !Number.isNaN(t) && t >= cutoffTime;
    });

    const dataset = inRange.length >= 2 ? inRange : valid;
    const sorted = [...dataset].reverse();
    const values = sorted.map(m => {
      if (selectedMetric === 'fat') return m.body_fat_pct || 0;
      if (selectedMetric === 'muscle') return m.skeletal_muscle_kg || 0;
      return Number(m.weight) || 0;
    }).filter(v => v > 0);

    if (values.length < 2) return null;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = (max - min) || 1;

    const width = 300;
    const height = 80;
    const padding = 10;

    const points = values.map((val, idx) => {
      const x = padding + (idx / (values.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((val - min) / range) * (height - 2 * padding);
      return { x: Math.round(x), y: Math.round(y) };
    });

    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const area = `${path} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

    return { path, area, points, first: values[0], last: values[values.length - 1] };
  }, [measurements, selectedMetric, rangeTab, now]);

  const fatEval = useMemo(() => {
    if (!latest?.body_fat_pct) return { text: 'Chưa đo', color: 'var(--body-text-muted)' };
    const val = Number(latest.body_fat_pct);
    const isMale = (profile?.gender || 'male') === 'male';
    if (isMale) {
      if (val < 10) return { text: 'Rất thấp (<10%)', color: 'var(--body-amber)' };
      if (val <= 20) return { text: 'Tiêu chuẩn (10–20%)', color: 'var(--body-green)' };
      if (val <= 25) return { text: 'Hơi cao (21–25%)', color: 'var(--body-amber)' };
      return { text: 'Mỡ cao (>25%)', color: '#C23B22' };
    } else {
      if (val < 18) return { text: 'Rất thấp (<18%)', color: 'var(--body-amber)' };
      if (val <= 28) return { text: 'Tiêu chuẩn (18–28%)', color: 'var(--body-green)' };
      if (val <= 33) return { text: 'Hơi cao (29–33%)', color: 'var(--body-amber)' };
      return { text: 'Mỡ cao (>33%)', color: '#C23B22' };
    }
  }, [latest?.body_fat_pct, profile?.gender]);

  const muscleEval = useMemo(() => {
    if (!latest?.skeletal_muscle_kg) return { text: 'Chưa đo', color: 'var(--body-text-muted)' };
    const val = Number(latest.skeletal_muscle_kg);
    const isMale = (profile?.gender || 'male') === 'male';
    const goodThreshold = isMale ? 30 : 22;
    return val >= goodThreshold
      ? { text: 'Tốt (đủ khối lượng cơ)', color: 'var(--body-green)' }
      : { text: 'Cần tăng cường cơ', color: 'var(--body-amber)' };
  }, [latest?.skeletal_muscle_kg, profile?.gender]);

  const visceralEval = useMemo(() => {
    if (!latest?.visceral_fat) return { text: 'Chưa đo', color: 'var(--body-text-muted)' };
    const val = Number(latest.visceral_fat);
    if (val <= 9) return { text: 'An toàn (Cấp 1–9)', color: 'var(--body-green)' };
    if (val <= 14) return { text: 'Cảnh báo (Cấp 10–14)', color: 'var(--body-amber)' };
    return { text: 'Nguy cơ cao (Cấp 15+)', color: '#C23B22' };
  }, [latest?.visceral_fat]);

  const waterEval = useMemo(() => {
    if (!latest?.water_pct) return { text: 'Chưa đo', color: 'var(--body-text-muted)' };
    const val = Number(latest.water_pct);
    return val >= 50
      ? { text: 'Đủ nước (≥50%)', color: 'var(--body-blue, #4C8DE0)' }
      : { text: 'Hơi thiếu nước (<50%)', color: 'var(--body-amber)' };
  }, [latest?.water_pct]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── HEADER WITH SUBTABS & SYNC STATUS ───────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0, letterSpacing: '-0.01em', color: 'var(--body-text-main)' }}>
            Cơ thể
          </h2>

          <div style={{ display: 'flex', background: 'var(--body-shell-bg)', borderRadius: '10px', padding: '3px', border: '1px solid var(--body-card-border)' }}>
            {[
              { key: 'analysis', label: 'Phân tích' },
              { key: 'history', label: `Lịch sử (${measurements.length})` },
              { key: 'profile', label: 'Hồ sơ' }
            ].map(t => (
              <button
                key={t.key}
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
              Lần đo gần nhất: {latest.local_date}
            </span>
          )}
          <button
            className="body-btn body-btn-accent"
            onClick={() => setShowAddModal(true)}
            style={{ height: '36px', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <AppIcon name="plus" size={14} />
            <span>Thêm cân đo</span>
          </button>
        </div>
      </div>

      {/* ── TAB 1: PHÂN TÍCH CHỈ SỐ CƠ THỂ (ANALYSIS) ────────────── */}
      {activeTab === 'analysis' && (
        <>
          {!latest ? (
            <div className="body-card" style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '28px', background: 'var(--body-accent-soft)', display: 'grid', placeItems: 'center', color: 'var(--body-accent)' }}>
                <AppIcon name="scales" size={28} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--body-text-main)' }}>
                Chưa có dữ liệu cân đo
              </h3>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--body-text-sub)', maxWidth: '420px', lineHeight: 1.6 }}>
                Ghi nhận số đo cân nặng đầu tiên để Life Hub phân tích chỉ số thể trạng, tính BMI, BMR và mức calo tiêu hao TDEE cho bạn.
              </p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  className="body-btn body-btn-accent"
                  onClick={() => setShowAddModal(true)}
                  style={{ height: '40px', padding: '0 18px' }}
                >
                  <AppIcon name="plus" size={15} />
                  <span>Ghi lần cân đầu tiên</span>
                </button>
                <button
                  className="body-btn body-btn-secondary"
                  onClick={() => setActiveTab('profile')}
                  style={{ height: '40px', padding: '0 18px' }}
                >
                  <span>Thiết lập chiều cao & mục tiêu</span>
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px', alignItems: 'stretch' }}>

                {/* CỘT TRÁI: ARC GAUGE BMI & CÂN NẶNG */}
                <div className="body-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '24px' }}>
                  <div style={{ fontSize: '12.5px', fontFamily: 'var(--body-mono)', color: 'var(--body-text-muted)' }}>
                    {latest.local_date} · {latest.time_slot === 'morning' ? 'Sáng sớm' : 'Buổi tối'}
                  </div>

                    {/* Arc Gauge Visualizer */}
                    <div style={{ position: 'relative', width: '260px', height: '210px', margin: '6px 0' }}>
                      <svg width="260" height="210" viewBox="0 0 240 190">
                        <path d="M 30 150 A 90 90 0 0 1 65 65" fill="none" stroke="#3A82F6" strokeWidth="12" strokeLinecap="round" />
                        <path d="M 72 58 A 90 90 0 0 1 145 42" fill="none" stroke="#2F8A57" strokeWidth="12" strokeLinecap="round" />
                        <path d="M 153 45 A 90 90 0 0 1 195 85" fill="none" stroke="#B57A12" strokeWidth="12" strokeLinecap="round" />
                        <path d="M 200 95 A 90 90 0 0 1 210 150" fill="none" stroke="#C23B22" strokeWidth="12" strokeLinecap="round" />
                        <circle cx={bmiPointerCoords.cx} cy={bmiPointerCoords.cy} r="8" fill="#FFFFFF" stroke="#15161A" strokeWidth="3.5" />
                      </svg>

                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '32px' }}>
                      <div style={{ fontSize: '46px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: 'var(--body-text-main)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                        {Number(latest.weight).toFixed(2).replace('.', ',')}
                      </div>
                      <div style={{ fontSize: '14px', color: 'var(--body-text-muted)', marginTop: '4px' }}>kg</div>
                      {bmiInfo ? (
                        <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: 600, color: bmiInfo.category.color }}>
                          {bmiInfo.category.label} (BMI {bmiInfo.bmi})
                        </div>
                      ) : (
                        <button
                          onClick={() => setActiveTab('profile')}
                          style={{
                            marginTop: '8px',
                            fontSize: '12.5px',
                            color: 'var(--body-accent)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: '4px 0'
                          }}
                        >
                          Nhập chiều cao để tính BMI
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Gauge Legend */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', fontSize: '11.5px', color: 'var(--body-text-sub)' }}>
                    {Object.values(BMI_CATEGORIES).map(c => (
                      <span key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.color }} />
                        {c.label.split(' ')[0]}
                      </span>
                    ))}
                  </div>

                  {/* Điểm số cơ thể */}
                  {bodyScore !== null && (
                    <div style={{
                      marginTop: 'auto',
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      paddingTop: '16px',
                      borderTop: '1px solid var(--body-card-border)'
                    }}>
                      <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '22px',
                        background: 'var(--body-green-soft)',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: '16px',
                        fontWeight: 700,
                        color: 'var(--body-green)'
                      }}>
                        {bodyScore}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                          Điểm cơ thể: {bodyScore}/100 · {bodyScoreLabel}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>
                          Tổng hợp từ BMI, tỷ lệ mỡ, cơ xương & mỡ nội tạng
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* CỘT PHẢI: XU HƯỚNG & 3 THẺ CHỈ SỐ */}
                <div className="body-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--body-text-main)' }}>Xu hướng</span>
                      <span style={{ fontSize: '12.5px', color: 'var(--body-text-muted)' }}>
                        {measurements.length} lần đo đã ghi nhận
                      </span>
                    </div>

                    <div style={{ display: 'flex', background: 'var(--body-shell-bg)', borderRadius: '8px', padding: '2px' }}>
                      {['7d', '30d', '90d'].map(r => (
                        <button
                          key={r}
                          onClick={() => setRangeTab(r)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: 'none',
                            background: rangeTab === r ? 'var(--body-card-bg)' : 'transparent',
                            color: rangeTab === r ? 'var(--body-text-main)' : 'var(--body-text-sub)',
                            fontSize: '12px',
                            fontWeight: rangeTab === r ? 600 : 500,
                            cursor: 'pointer'
                          }}
                        >
                          {r === '7d' ? '7 ngày' : r === '30d' ? '30 ngày' : '3 tháng'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3 Metric Selector Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    <div
                      onClick={() => setSelectedMetric('weight')}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: selectedMetric === 'weight' ? 'var(--body-accent-soft)' : 'var(--body-shell-bg)',
                        border: `1.5px solid ${selectedMetric === 'weight' ? 'var(--body-accent)' : 'var(--body-card-border)'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                    >
                      <span style={{ fontSize: '11.5px', color: 'var(--body-text-sub)' }}>Cân nặng</span>
                      <span style={{ fontSize: '17px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: 'var(--body-text-main)' }}>
                        {Number(latest.weight).toFixed(2).replace('.', ',')} kg
                      </span>
                    </div>

                    <div
                      onClick={() => setSelectedMetric('fat')}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: selectedMetric === 'fat' ? 'var(--body-accent-soft)' : 'var(--body-shell-bg)',
                        border: `1.5px solid ${selectedMetric === 'fat' ? 'var(--body-accent)' : 'var(--body-card-border)'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                    >
                      <span style={{ fontSize: '11.5px', color: 'var(--body-text-sub)' }}>Tỷ lệ mỡ</span>
                      <span style={{ fontSize: '17px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: 'var(--body-text-main)' }}>
                        {latest.body_fat_pct ? `${latest.body_fat_pct}%` : '—'}
                      </span>
                    </div>

                    <div
                      onClick={() => setSelectedMetric('muscle')}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: selectedMetric === 'muscle' ? 'var(--body-accent-soft)' : 'var(--body-shell-bg)',
                        border: `1.5px solid ${selectedMetric === 'muscle' ? 'var(--body-accent)' : 'var(--body-card-border)'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                    >
                      <span style={{ fontSize: '11.5px', color: 'var(--body-text-sub)' }}>Cơ xương</span>
                      <span style={{ fontSize: '17px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: 'var(--body-text-main)' }}>
                        {latest.skeletal_muscle_kg ? `${latest.skeletal_muscle_kg} kg` : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Sparkline Canvas Area */}
                  <div style={{ height: '90px', position: 'relative', marginTop: '6px' }}>
                    {sparklineData ? (
                      <svg width="100%" height="90" viewBox="0 0 300 80" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                        <defs>
                          <linearGradient id="bodyTrendGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--body-accent)" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="var(--body-accent)" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path d={sparklineData.area} fill="url(#bodyTrendGradient)" />
                        <path d={sparklineData.path} fill="none" stroke="var(--body-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        {sparklineData.points.map((p, idx) => (
                          <circle key={idx} cx={p.x} cy={p.y} r="3" fill="var(--body-accent)" />
                        ))}
                      </svg>
                    ) : (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12.5px', color: 'var(--body-text-muted)' }}>
                        Cần thêm ít nhất 2 lần đo để vẽ đường xu hướng
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 6 Thẻ chi tiết khác */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                {[
                  { title: 'Tỷ lệ mỡ', val: latest.body_fat_pct ? `${latest.body_fat_pct}%` : '—', status: fatEval.text, color: fatEval.color, icon: 'heart' },
                  { title: 'Khối cơ xương', val: latest.skeletal_muscle_kg ? `${latest.skeletal_muscle_kg} kg` : '—', status: muscleEval.text, color: muscleEval.color, icon: 'barbell' },
                  { title: 'Mỡ nội tạng', val: latest.visceral_fat ? `Cấp ${latest.visceral_fat}` : '—', status: visceralEval.text, color: visceralEval.color, icon: 'shieldCheck' },
                  { title: 'Tỷ lệ nước', val: latest.water_pct ? `${latest.water_pct}%` : '—', status: waterEval.text, color: waterEval.color, icon: 'drop' },
                  { title: 'BMR cơ bản', val: bmr ? `${bmr} kcal` : '—', status: 'Mifflin-St Jeor', color: 'var(--body-accent)', icon: 'fire' },
                  { title: 'TDEE duy trì', val: tdee ? `${tdee} kcal` : '—', status: 'Mức calo giữ cân', color: 'var(--body-accent)', icon: 'lightning' }
                ].map(m => (
                  <div
                    key={m.title}
                    style={{
                      padding: '14px',
                      borderRadius: '12px',
                      background: 'var(--body-shell-bg)',
                      border: '1px solid var(--body-card-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: 'var(--body-text-sub)' }}>{m.title}</span>
                      <AppIcon name={m.icon} size={15} style={{ color: 'var(--body-text-muted)' }} />
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: 'var(--body-text-main)' }}>
                      {m.val}
                    </div>
                    <div style={{ fontSize: '11px', color: m.color, fontWeight: 600 }}>
                      {m.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB 2: LỊCH SỬ CÂN ĐO (HISTORY) ──────────────────────── */}
      {activeTab === 'history' && (
        <div className="body-card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 2px 0' }}>Lịch sử các lần cân đo</h3>
              <div style={{ fontSize: '12.5px', color: 'var(--body-text-muted)' }}>
                Đánh dấu các lần đo lệch giờ để không ảnh hưởng đến xu hướng
              </div>
            </div>
          </div>

          {measurements.length === 0 ? (
            <div style={{ padding: '36px 0', textAlign: 'center', color: 'var(--body-text-muted)', fontSize: '13.5px' }}>
              Chưa có lần đo nào được lưu. Bấm "Thêm cân đo" để bắt đầu!
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="body-set-table" style={{ width: '100%', minWidth: '600px' }}>
                <thead>
                  <tr>
                    <th>NGÀY & GIỜ</th>
                    <th>THỜI ĐIỂM</th>
                    <th style={{ textAlign: 'center' }}>CÂN NẶNG</th>
                    <th style={{ textAlign: 'center' }}>TỶ LỆ MỠ</th>
                    <th style={{ textAlign: 'center' }}>CƠ XƯƠNG</th>
                    <th>NGUỒN DỮ LIỆU</th>
                    <th style={{ textAlign: 'center' }}>ĐO LỆCH GIỜ</th>
                    <th style={{ textAlign: 'center' }}>XÓA</th>
                  </tr>
                </thead>
                <tbody>
                  {measurements.map(m => (
                    <tr key={m.id} style={{ opacity: m.is_outlier ? 0.6 : 1 }}>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--body-text-main)' }}>
                          {m.local_date}
                        </span>
                        <span style={{ fontSize: '11.5px', color: 'var(--body-text-muted)', marginLeft: '6px' }}>
                          {new Date(m.measured_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: m.time_slot === 'morning' ? 'var(--body-green-soft)' : 'var(--body-amber-soft)',
                          color: m.time_slot === 'morning' ? 'var(--body-green-text)' : 'var(--body-amber)',
                          fontSize: '11.5px',
                          fontWeight: 600
                        }}>
                          {m.time_slot === 'morning' ? 'Sáng sớm' : 'Buổi tối'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--body-mono)', fontWeight: 700, fontSize: '14px' }}>
                        {Number(m.weight).toFixed(2).replace('.', ',')} kg
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--body-mono)', fontSize: '13px' }}>
                        {m.body_fat_pct ? `${m.body_fat_pct}%` : '—'}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--body-mono)', fontSize: '13px' }}>
                        {m.skeletal_muscle_kg ? `${m.skeletal_muscle_kg} kg` : '—'}
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: 'var(--body-text-sub)' }}>
                          {m.source === 'huawei_scale' ? 'Huawei Scale 3' : 'Nhập thủ công'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => toggleOutlier(m.id)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: m.is_outlier ? 'var(--body-amber-soft)' : 'var(--body-shell-bg)',
                            color: m.is_outlier ? 'var(--body-amber)' : 'var(--body-text-muted)'
                          }}
                        >
                          {m.is_outlier ? '⚠️ Đã đánh dấu lệch' : 'Bình thường'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => deleteMeasurement(m.id)}
                          style={{ background: 'none', border: 'none', color: '#B5B4AE', cursor: 'pointer', padding: '4px' }}
                          title="Xóa lần đo"
                        >
                          <AppIcon name="trash" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: HỒ SƠ THỂ TRẠNG & TDEE (PROFILE) ──────────────── */}
      {activeTab === 'profile' && (
        <div className="body-card" style={{ padding: '24px', maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0' }}>Hồ sơ thể trạng & Năng lượng</h3>
            <div style={{ fontSize: '12.5px', color: 'var(--body-text-muted)' }}>
              Thông số dùng để tính chỉ số BMI, BMR (Mifflin-St Jeor) và lượng calo tiêu hao TDEE
            </div>
          </div>

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>Chiều cao (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  value={editHeight}
                  onChange={e => setEditHeight(e.target.value)}
                  style={{
                    height: '38px',
                    borderRadius: '8px',
                    border: '1px solid var(--body-card-border)',
                    background: 'var(--body-shell-bg)',
                    padding: '0 12px',
                    color: 'var(--body-text-main)',
                    fontSize: '14px',
                    fontFamily: 'var(--body-mono)',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>Cân nặng mục tiêu (kg)</label>
                <input
                  type="number"
                  step="0.5"
                  value={editGoalWeight}
                  onChange={e => setEditGoalWeight(e.target.value)}
                  style={{
                    height: '38px',
                    borderRadius: '8px',
                    border: '1px solid var(--body-card-border)',
                    background: 'var(--body-shell-bg)',
                    padding: '0 12px',
                    color: 'var(--body-text-main)',
                    fontSize: '14px',
                    fontFamily: 'var(--body-mono)',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>Giới tính</label>
                <select
                  value={editGender}
                  onChange={e => setEditGender(e.target.value)}
                  style={{
                    height: '38px',
                    borderRadius: '8px',
                    border: '1px solid var(--body-card-border)',
                    background: 'var(--body-shell-bg)',
                    padding: '0 12px',
                    color: 'var(--body-text-main)',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                >
                  <option value="male">Nam (Mifflin-St Jeor +5)</option>
                  <option value="female">Nữ (Mifflin-St Jeor -161)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>Năm sinh</label>
                <input
                  type="number"
                  min="1940"
                  max="2025"
                  value={editBirthYear}
                  onChange={e => setEditBirthYear(e.target.value)}
                  style={{
                    height: '38px',
                    borderRadius: '8px',
                    border: '1px solid var(--body-card-border)',
                    background: 'var(--body-shell-bg)',
                    padding: '0 12px',
                    color: 'var(--body-text-main)',
                    fontSize: '14px',
                    fontFamily: 'var(--body-mono)',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>Mức độ vận động hàng ngày</label>
              <select
                value={editActivity}
                onChange={e => setEditActivity(e.target.value)}
                style={{
                  height: '40px',
                  borderRadius: '8px',
                  border: '1px solid var(--body-card-border)',
                  background: 'var(--body-shell-bg)',
                  padding: '0 12px',
                  color: 'var(--body-text-main)',
                  fontSize: '13px',
                  outline: 'none'
                }}
              >
                <option value="sedentary">Ít vận động (ngồi văn phòng, không tập)</option>
                <option value="light">Vận động nhẹ (tập 1–3 ngày/tuần)</option>
                <option value="moderate">Vận động vừa (tập 3–5 ngày/tuần · khuyến nghị)</option>
                <option value="active">Vận động nhiều (tập nặng 6–7 ngày/tuần)</option>
                <option value="very_active">Cường độ rất cao (vận động viên)</option>
              </select>
            </div>

            {bmr && tdee && (
              <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--body-accent-soft)', border: '1px solid var(--body-accent-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--body-text-sub)' }}>BMR cơ bản</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: 'var(--body-accent)' }}>
                    {bmr} kcal
                  </div>
                </div>
                <div style={{ width: '1px', height: '28px', background: 'var(--body-accent-border)' }} />
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--body-text-sub)' }}>TDEE duy trì</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: 'var(--body-accent)' }}>
                    {tdee} kcal
                  </div>
                </div>
                <div style={{ width: '1px', height: '28px', background: 'var(--body-accent-border)' }} />
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--body-text-sub)' }}>Thâm hụt giảm mỡ (-500)</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: 'var(--body-green)' }}>
                    {Math.max(1200, tdee - 500)} kcal
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button type="submit" className="body-btn body-btn-accent" style={{ height: '40px', padding: '0 20px' }}>
                Lưu hồ sơ thể trạng
              </button>
              {profileSaved && (
                <span style={{ fontSize: '13px', color: 'var(--body-green)', fontWeight: 600 }}>
                  ✓ Đã lưu thành công
                </span>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ── MODAL THÊM CÂN ĐO MỚI ───────────────────────────────── */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(16, 17, 20, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="body-card" style={{ width: '100%', maxWidth: '420px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Thêm lần cân đo mới</h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--body-text-muted)', display: 'flex' }}
              >
                <AppIcon name="x" size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMeasurement} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>Cân nặng (kg) *</label>
                <input
                  type="number"
                  step="0.05"
                  required
                  placeholder="Ví dụ: 64.95"
                  value={newWeight}
                  onChange={e => setNewWeight(e.target.value)}
                  style={{
                    height: '40px',
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>Tỷ lệ mỡ (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="17.2"
                    value={newFat}
                    onChange={e => setNewFat(e.target.value)}
                    style={{
                      height: '40px',
                      borderRadius: '8px',
                      border: '1px solid var(--body-card-border)',
                      background: 'var(--body-shell-bg)',
                      padding: '0 12px',
                      fontSize: '14px',
                      fontFamily: 'var(--body-mono)',
                      color: 'var(--body-text-main)',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>Cơ xương (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="29.8"
                    value={newMuscle}
                    onChange={e => setNewMuscle(e.target.value)}
                    style={{
                      height: '40px',
                      borderRadius: '8px',
                      border: '1px solid var(--body-card-border)',
                      background: 'var(--body-shell-bg)',
                      padding: '0 12px',
                      fontSize: '14px',
                      fontFamily: 'var(--body-mono)',
                      color: 'var(--body-text-main)',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>Thời điểm cân</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="slot"
                      value="morning"
                      checked={newTimeSlot === 'morning'}
                      onChange={() => setNewTimeSlot('morning')}
                    />
                    Sáng sớm (sau khi thức dậy)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="slot"
                      value="evening"
                      checked={newTimeSlot === 'evening'}
                      onChange={() => setNewTimeSlot('evening')}
                    />
                    Buổi tối (đo lệch giờ)
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="body-btn body-btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  style={{ flex: 1 }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="body-btn body-btn-accent"
                  style={{ flex: 1 }}
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
