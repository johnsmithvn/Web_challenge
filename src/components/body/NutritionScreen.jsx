import { useState, useMemo } from 'react';
import AppIcon from '../AppIcon';
import SkeletonList from '../SkeletonList';
import { useNutrition } from '../../hooks/useNutrition';
import { useBiometrics } from '../../hooks/useBiometrics';
import { calculateMacroTargets } from '../../utils/bodyMetrics';

function getISOWeekNumber(date = new Date()) {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target) / (7 * 24 * 3600 * 1000));
}

export default function NutritionScreen() {
  const {
    hasLoaded,
    selectedDate,
    setSelectedDate,
    mealLogs,
    savedMeals,
    weeklyCheckins,
    addMealLog,
    deleteMealLog,
    saveWeeklyCheckin,
    saveMealTemplate
  } = useNutrition();

  const { tdee, latest: latestBiometrics, hasLoaded: bioLoaded } = useBiometrics();

  const [activeTab, setActiveTab] = useState('daily'); // 'daily' | 'checkin'
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states for adding meal
  const [mealType, setMealType] = useState('lunch');
  const [mealName, setMealName] = useState('');
  const [mealKcal, setMealKcal] = useState('');
  const [mealProtein, setMealProtein] = useState('');
  const [mealCarbs, setMealCarbs] = useState('');
  const [mealFat, setMealFat] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);

  // Weekly check-in form states (Standard ISO week, unrated initial ratings)
  const currentWeekNumber = useMemo(() => getISOWeekNumber(new Date()), []);
  const [checkinWeight, setCheckinWeight] = useState('');
  const [checkinWaist, setCheckinWaist] = useState('');
  const [feelEnergy, setFeelEnergy] = useState(0);
  const [feelSleep, setFeelSleep] = useState(0);
  const [feelHunger, setFeelHunger] = useState(0);
  const [feelSoreness, setFeelSoreness] = useState(0);
  const [checkinNotes, setCheckinNotes] = useState('');
  const [checkinSaved, setCheckinSaved] = useState(false);

  // Daily totals
  const totalKcal = mealLogs.reduce((sum, m) => sum + (m.calories || 0), 0);
  const totalProtein = mealLogs.reduce((sum, m) => sum + (Number(m.protein) || 0), 0);
  const totalCarbs = mealLogs.reduce((sum, m) => sum + (Number(m.carbs) || 0), 0);
  const totalFat = mealLogs.reduce((sum, m) => sum + (Number(m.fat) || 0), 0);

  // Mục tiêu macro dùng chung công thức với Tổng quan (null nếu chưa đủ hồ sơ để tính TDEE)
  const targets = calculateMacroTargets(tdee, latestBiometrics?.weight);
  const goalKcal = targets?.kcal ?? null;
  const goalProtein = targets?.protein ?? null;
  const goalFat = targets?.fat ?? null;
  const goalCarbs = targets?.carbs ?? null;

  const handleAddMeal = async (e) => {
    e.preventDefault();
    if (!mealName.trim() || !mealKcal) return;

    try {
      const mealData = {
        type: mealType,
        name: mealName.trim(),
        calories: Number(mealKcal),
        protein: Number(mealProtein) || 0,
        carbs: Number(mealCarbs) || 0,
        fat: Number(mealFat) || 0
      };

      await addMealLog(mealData);

      if (saveAsTemplate) {
        await saveMealTemplate(mealData);
      }

      setMealName('');
      setMealKcal('');
      setMealProtein('');
      setMealCarbs('');
      setMealFat('');
      setSaveAsTemplate(false);
      setShowAddModal(false);
    } catch (err) {
      console.error('Error adding meal:', err);
    }
  };

  const handlePickSaved = async (tpl) => {
    try {
      await addMealLog({
        type: mealType,
        name: tpl.name,
        calories: tpl.calories || tpl.kcal,
        protein: tpl.protein || 0,
        carbs: tpl.carbs || 0,
        fat: tpl.fat || 0
      });
      setShowAddModal(false);
    } catch (err) {
      console.error('Error adding template meal:', err);
    }
  };

  const handleSaveWeekly = async (e) => {
    e.preventDefault();
    try {
      await saveWeeklyCheckin({
        week_number: currentWeekNumber,
        year: new Date().getFullYear(),
        weight_avg: checkinWeight ? Number(checkinWeight) : null,
        waist_cm: checkinWaist ? Number(checkinWaist) : null,
        feel_energy: feelEnergy > 0 ? feelEnergy : null,
        feel_sleep: feelSleep > 0 ? feelSleep : null,
        feel_hunger: feelHunger > 0 ? feelHunger : null,
        feel_soreness: feelSoreness > 0 ? feelSoreness : null,
        notes: checkinNotes
      });
      setCheckinSaved(true);
      setTimeout(() => setCheckinSaved(false), 2500);
    } catch (err) {
      console.error('Error saving checkin:', err);
    }
  };

  if (!hasLoaded || !bioLoaded) return <SkeletonList heading rows={4} gap="10px" label="Đang tải dinh dưỡng" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── HEADER NAVIGATION & DATE STRIP ─────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0, letterSpacing: '-0.01em', color: 'var(--body-text-main)' }}>
            Dinh dưỡng & Check-in
          </h2>

          <div style={{ display: 'flex', background: 'var(--body-shell-bg)', borderRadius: '10px', padding: '3px', border: '1px solid var(--body-card-border)' }}>
            <button
              onClick={() => setActiveTab('daily')}
              style={{
                padding: '6px 14px',
                borderRadius: '7px',
                border: 'none',
                background: activeTab === 'daily' ? 'var(--body-card-bg)' : 'transparent',
                color: activeTab === 'daily' ? 'var(--body-text-main)' : 'var(--body-text-sub)',
                fontWeight: activeTab === 'daily' ? 600 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: activeTab === 'daily' ? '0 1px 3px rgba(16,17,20,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Nhật ký hôm nay
            </button>
            <button
              onClick={() => setActiveTab('checkin')}
              style={{
                padding: '6px 14px',
                borderRadius: '7px',
                border: 'none',
                background: activeTab === 'checkin' ? 'var(--body-card-bg)' : 'transparent',
                color: activeTab === 'checkin' ? 'var(--body-text-main)' : 'var(--body-text-sub)',
                fontWeight: activeTab === 'checkin' ? 600 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: activeTab === 'checkin' ? '0 1px 3px rgba(16,17,20,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Check-in tuần
            </button>
          </div>
        </div>

        {activeTab === 'daily' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{
                height: '36px',
                borderRadius: '8px',
                border: '1px solid var(--body-card-border)',
                background: 'var(--body-card-bg)',
                color: 'var(--body-text-main)',
                padding: '0 10px',
                fontSize: '13px',
                fontFamily: 'inherit',
                outline: 'none'
              }}
            />
            <button
              className="body-btn body-btn-accent"
              onClick={() => setShowAddModal(true)}
              style={{ height: '36px', padding: '0 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <AppIcon name="plus" size={14} />
              <span>Thêm món</span>
            </button>
          </div>
        )}
      </div>

      {/* ── TAB 1: NHẬT KÝ ĂN UỐNG HÔM NAY ─────────────────────── */}
      {activeTab === 'daily' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* 2 CARD MACRO VÀ CALO */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>

            {/* Calo Progress */}
            <div className="body-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--body-text-main)' }}>Năng lượng nạp vào</span>
                <span style={{ fontSize: '12px', color: 'var(--body-text-muted)' }}>
                  Mục tiêu: {goalKcal ? `${goalKcal} kcal` : 'Chưa thiết lập'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '32px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: 'var(--body-text-main)' }}>
                  {totalKcal}
                </span>
                <span style={{ fontSize: '14px', color: 'var(--body-text-muted)' }}>
                  {goalKcal ? `/ ${goalKcal} kcal` : ' kcal'}
                </span>
              </div>
              {goalKcal ? (
                <div style={{ height: '8px', borderRadius: '4px', background: 'var(--body-shell-bg)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, Math.round((totalKcal / goalKcal) * 100))}%`,
                    background: totalKcal > goalKcal ? 'var(--body-amber)' : 'var(--body-accent)',
                    borderRadius: '4px'
                  }} />
                </div>
              ) : null}
              <div style={{ fontSize: '12px', color: 'var(--body-text-sub)' }}>
                {goalKcal
                  ? (goalKcal - totalKcal >= 0 ? `Còn lại ${goalKcal - totalKcal} kcal thâm hụt` : `Vượt mục tiêu ${totalKcal - goalKcal} kcal`)
                  : 'Cập nhật hồ sơ ở tab Cơ thể để tính mức TDEE'}
              </div>
            </div>

            {/* 3 Macro breakdown */}
            <div className="body-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--body-text-main)' }}>Cân bằng đa lượng</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--body-text-sub)' }}>Đạm (P)</span>
                  <span style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: 'var(--body-accent)' }}>
                    {totalProtein.toFixed(0)}g
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--body-text-muted)' }}>
                    {goalProtein ? `/${goalProtein}g` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--body-text-sub)' }}>Carb (C)</span>
                  <span style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: 'var(--body-green)' }}>
                    {totalCarbs.toFixed(0)}g
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--body-text-muted)' }}>
                    {goalCarbs ? `/${goalCarbs}g` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--body-text-sub)' }}>Béo (F)</span>
                  <span style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: 'var(--body-amber)' }}>
                    {totalFat.toFixed(0)}g
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--body-text-muted)' }}>
                    {goalFat ? `/${goalFat}g` : ''}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* DANH SÁCH BỮA ĂN THEO LOẠI */}
          <div className="body-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--body-text-main)' }}>
                Các bữa ăn trong ngày ({selectedDate})
              </h3>
              <button
                className="body-btn body-btn-secondary"
                onClick={() => setShowAddModal(true)}
                style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
              >
                + Ghi thêm bữa
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {['breakfast', 'lunch', 'dinner', 'snack'].map(type => {
                const typeLabel = type === 'breakfast' ? 'Bữa sáng' : type === 'lunch' ? 'Bữa trưa' : type === 'dinner' ? 'Bữa tối' : 'Bữa phụ';
                const typeMeals = mealLogs.filter(m => (m.meal_type || m.type) === type);
                const typeKcal = typeMeals.reduce((s, m) => s + (m.calories || 0), 0);

                return (
                  <div key={type} style={{ borderRadius: '12px', border: '1px solid var(--body-card-border)', background: 'var(--body-card-bg)', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', background: 'var(--body-shell-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                        {typeLabel}
                      </span>
                      <span style={{ fontSize: '13px', fontFamily: 'var(--body-mono)', fontWeight: 600, color: 'var(--body-text-sub)' }}>
                        {typeKcal} kcal
                      </span>
                    </div>

                    <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {typeMeals.length === 0 ? (
                        <div style={{ fontSize: '12px', color: 'var(--body-text-muted)', padding: '6px 0' }}>
                          Chưa ghi món cho bữa này.
                        </div>
                      ) : (
                        typeMeals.map(m => (
                          <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--body-shell-bg)' }}>
                            <div>
                              <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                                {m.name}
                              </div>
                              <div style={{ fontSize: '11.5px', color: 'var(--body-text-muted)' }}>
                                {m.protein}g Đạm · {m.carbs}g Carb · {m.fat}g Béo
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'var(--body-mono)', color: 'var(--body-text-main)' }}>
                                {m.calories} kcal
                              </span>
                              <button
                                onClick={() => deleteMealLog(m.id)}
                                style={{ background: 'none', border: 'none', color: '#B5B4AE', cursor: 'pointer', padding: '4px', display: 'flex' }}
                                title="Xóa món"
                              >
                                <AppIcon name="trash" size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* ── TAB 2: CHECK-IN TUẦN ─────────────────────────────────── */}
      {activeTab === 'checkin' && (
        <div className="body-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <span className="body-badge body-badge-accent" style={{ marginBottom: '6px' }}>
                TUẦN {currentWeekNumber} · NĂM {new Date().getFullYear()}
              </span>
              <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 0 0', color: 'var(--body-text-main)' }}>
                Đánh giá tuần & Cân đo định kỳ
              </h3>
              <div style={{ fontSize: '13px', color: 'var(--body-text-muted)' }}>
                Ghi nhận cảm nhận thể trạng và chỉ số vòng eo để theo dõi tái cấu trúc cơ thể
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveWeekly} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--body-shell-bg)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>Cân nặng TB tuần (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Ví dụ: 64.9"
                  value={checkinWeight}
                  onChange={e => setCheckinWeight(e.target.value)}
                  style={{
                    height: '40px',
                    borderRadius: '8px',
                    border: '1px solid var(--body-card-border)',
                    background: 'var(--body-card-bg)',
                    padding: '0 12px',
                    fontSize: '16px',
                    fontFamily: 'var(--body-mono)',
                    color: 'var(--body-text-main)',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--body-shell-bg)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>Vòng eo sáng sớm (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="Ví dụ: 75.5"
                  value={checkinWaist}
                  onChange={e => setCheckinWaist(e.target.value)}
                  style={{
                    height: '40px',
                    borderRadius: '8px',
                    border: '1px solid var(--body-card-border)',
                    background: 'var(--body-card-bg)',
                    padding: '0 12px',
                    fontSize: '16px',
                    fontFamily: 'var(--body-mono)',
                    color: 'var(--body-text-main)',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                Cảm nhận thể trạng trong tuần (1–5 sao):
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                {[
                  { label: 'Mức năng lượng', val: feelEnergy, set: setFeelEnergy, icon: 'lightning' },
                  { label: 'Chất lượng giấc ngủ', val: feelSleep, set: setFeelSleep, icon: 'moon' },
                  { label: 'Kiểm soát cơn đói', val: feelHunger, set: setFeelHunger, icon: 'bowlFood' },
                  { label: 'Mức độ hồi cơ', val: feelSoreness, set: setFeelSoreness, icon: 'heart' }
                ].map(f => (
                  <div key={f.label} style={{ padding: '12px', borderRadius: '10px', background: 'var(--body-shell-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AppIcon name={f.icon} size={15} style={{ color: 'var(--body-accent)' }} />
                      <span style={{ fontSize: '12.5px', color: 'var(--body-text-main)' }}>{f.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '3px' }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <span
                          key={star}
                          onClick={() => f.set(star)}
                          style={{
                            cursor: 'pointer',
                            fontSize: '16px',
                            color: star <= f.val ? '#E0A23C' : '#D1CFC7'
                          }}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--body-text-main)' }}>Ghi chú tổng kết tuần:</label>
              <textarea
                value={checkinNotes}
                onChange={e => setCheckinNotes(e.target.value)}
                placeholder="Ghi lại tiến độ tập luyện, cảm xúc, chế độ ăn thâm hụt hoặc những điều cần cải thiện..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid var(--body-card-border)',
                  background: 'var(--body-shell-bg)',
                  fontSize: '13.5px',
                  color: 'var(--body-text-main)',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button type="submit" className="body-btn body-btn-accent" style={{ height: '38px', padding: '0 20px' }}>
                Lưu check-in tuần {currentWeekNumber}
              </button>
              {checkinSaved && (
                <span style={{ fontSize: '13px', color: 'var(--body-green)', fontWeight: 600 }}>
                  ✓ Đã lưu thành công vào cơ sở dữ liệu
                </span>
              )}
            </div>
          </form>

          {/* Lịch sử checkin đã lưu */}
          {weeklyCheckins.length > 0 && (
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--body-card-border)', paddingTop: '16px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 10px 0', color: 'var(--body-text-main)' }}>
                Lịch sử các tuần trước
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {weeklyCheckins.map(c => (
                  <div key={`${c.year}-${c.week_number}`} style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--body-shell-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--body-text-main)' }}>
                      Tuần {c.week_number} · Năm {c.year}
                    </span>
                    <span style={{ fontSize: '12.5px', color: 'var(--body-text-sub)', fontFamily: 'var(--body-mono)' }}>
                      {c.weight_avg ? `${c.weight_avg} kg` : ''} {c.waist_cm ? `· Eo ${c.waist_cm} cm` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL THÊM MÓN NHANH ─────────────────────────────────── */}
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
          <div className="body-card" style={{ width: '100%', maxWidth: '440px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Thêm món vào nhật ký</h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--body-text-muted)', display: 'flex' }}
              >
                <AppIcon name="x" size={18} />
              </button>
            </div>

            {/* Quick Pick Saved Foods */}
            {savedMeals && savedMeals.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--body-text-muted)', marginBottom: '8px' }}>
                  {/* Món gợi ý mặc định không có id (chưa phải món bạn lưu) */}
                  {savedMeals.some(m => m.id) ? 'MÓN ĐÃ LƯU (BẤM ĐỂ CHỌN NHANH)' : 'GỢI Ý MÓN PHỔ BIẾN (BẤM ĐỂ CHỌN NHANH)'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {savedMeals.map(t => (
                    <button
                      key={t.name}
                      onClick={() => handlePickSaved(t)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--body-card-border)',
                        background: 'var(--body-shell-bg)',
                        color: 'var(--body-text-main)',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      + {t.name} ({t.calories || t.kcal} kcal)
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleAddMeal} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>Bữa ăn</label>
                <select
                  value={mealType}
                  onChange={e => setMealType(e.target.value)}
                  style={{
                    height: '38px',
                    borderRadius: '8px',
                    border: '1px solid var(--body-card-border)',
                    background: 'var(--body-shell-bg)',
                    padding: '0 10px',
                    color: 'var(--body-text-main)',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                >
                  <option value="breakfast">Bữa sáng</option>
                  <option value="lunch">Bữa trưa</option>
                  <option value="dinner">Bữa tối</option>
                  <option value="snack">Bữa phụ</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>Tên món ăn *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Cơm ức gà nướng"
                  value={mealName}
                  onChange={e => setMealName(e.target.value)}
                  style={{
                    height: '38px',
                    borderRadius: '8px',
                    border: '1px solid var(--body-card-border)',
                    background: 'var(--body-shell-bg)',
                    padding: '0 10px',
                    fontSize: '13.5px',
                    color: 'var(--body-text-main)',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>Calories (kcal) *</label>
                  <input
                    type="number"
                    required
                    placeholder="350"
                    value={mealKcal}
                    onChange={e => setMealKcal(e.target.value)}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>Đạm (g)</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="30"
                    value={mealProtein}
                    onChange={e => setMealProtein(e.target.value)}
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>Carb (g)</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="45"
                    value={mealCarbs}
                    onChange={e => setMealCarbs(e.target.value)}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--body-text-sub)' }}>Béo (g)</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="10"
                    value={mealFat}
                    onChange={e => setMealFat(e.target.value)}
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

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--body-text-sub)', cursor: 'pointer', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  checked={saveAsTemplate}
                  onChange={e => setSaveAsTemplate(e.target.checked)}
                />
                Lưu vào danh sách món mẫu để chọn nhanh lần sau
              </label>

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
                  Ghi món
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
