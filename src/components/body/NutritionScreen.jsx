import { useState, useMemo, useEffect } from 'react';
import AppIcon from '../AppIcon';
import SkeletonList from '../SkeletonList';
import { useNutrition } from '../../hooks/useNutrition';
import { useBiometrics } from '../../hooks/useBiometrics';
import { calculateMacroTargets, sumKcalByDay } from '../../utils/bodyMetrics';
import { toDateStr, mondayIndex } from '../../utils/dateUtils';

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

const MEAL_TYPES = [
  { key: 'breakfast', label: 'Bữa sáng', icon: 'coffee' },
  { key: 'lunch', label: 'Bữa trưa', icon: 'bowlFood' },
  { key: 'dinner', label: 'Bữa tối', icon: 'fish' },
  { key: 'snack', label: 'Bữa phụ', icon: 'cookie' }
];
const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const RING_R = 110;
const RING_C = 2 * Math.PI * RING_R;

const num = v => Math.round(Number(v) || 0).toLocaleString('vi-VN');
const gram = v => (Math.round((Number(v) || 0) * 10) / 10).toLocaleString('vi-VN');
const ddmm = dateStr => `${dateStr.slice(8, 10)}/${dateStr.slice(5, 7)}`;
const weekdayOf = dateStr => WEEKDAY[new Date(`${dateStr}T00:00:00`).getDay()];
const timeOf = iso => (iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '');

export default function NutritionScreen() {
  const {
    hasLoaded,
    selectedDate,
    setSelectedDate,
    mealLogs,
    savedMeals,
    weeklyCheckins,
    weekLogs,
    addMealLog,
    deleteMealLog,
    saveWeeklyCheckin,
    saveMealTemplate
  } = useNutrition();

  const { tdee, latest: latestBiometrics, hasLoaded: bioLoaded } = useBiometrics();

  const [activeTab, setActiveTab] = useState('daily'); // 'daily' | 'checkin'
  const [showAddModal, setShowAddModal] = useState(false);
  // Bữa đang mở theo ngày; ngày khác → tự mở bữa đầu tiên có món
  const [openMeal, setOpenMeal] = useState({ date: null, key: null });

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
  const currentYear = new Date().getFullYear();
  const [checkinWeight, setCheckinWeight] = useState('');
  const [checkinWaist, setCheckinWaist] = useState('');
  const [feelEnergy, setFeelEnergy] = useState(0);
  const [feelSleep, setFeelSleep] = useState(0);
  const [feelHunger, setFeelHunger] = useState(0);
  const [feelSoreness, setFeelSoreness] = useState(0);
  const [checkinNotes, setCheckinNotes] = useState('');
  const [checkinSaved, setCheckinSaved] = useState(false);

  useEffect(() => {
    if (!showAddModal) return undefined;
    const onKey = e => { if (e.key === 'Escape') setShowAddModal(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAddModal]);

  // Daily totals
  const totalKcal = mealLogs.reduce((sum, m) => sum + (m.calories || 0), 0);
  const totalProtein = mealLogs.reduce((sum, m) => sum + (Number(m.protein) || 0), 0);
  const totalCarbs = mealLogs.reduce((sum, m) => sum + (Number(m.carbs) || 0), 0);
  const totalFat = mealLogs.reduce((sum, m) => sum + (Number(m.fat) || 0), 0);

  // Mục tiêu macro dùng chung công thức với Tổng quan (null nếu chưa đủ hồ sơ để tính TDEE)
  const targets = calculateMacroTargets(tdee, latestBiometrics?.weight);
  const goalKcal = targets?.kcal ?? null;

  const today = toDateStr();
  const isToday = selectedDate === today;

  const meals = MEAL_TYPES.map(t => {
    const items = mealLogs.filter(m => (m.meal_type || m.type) === t.key);
    return { ...t, items, kcal: items.reduce((s, m) => s + (m.calories || 0), 0) };
  });
  const openKey = openMeal.date === selectedDate
    ? openMeal.key
    : (meals.find(m => m.items.length > 0)?.key ?? null);
  const toggleMeal = key => setOpenMeal({ date: selectedDate, key: openKey === key ? null : key });

  // 7 ngày gần nhất (kết thúc hôm nay)
  const week = useMemo(() => sumKcalByDay(weekLogs, today), [weekLogs, today]);
  const loggedDays = week.filter(d => d.kcal > 0);
  const weekAvg = loggedDays.length ? loggedDays.reduce((s, d) => s + d.kcal, 0) / loggedDays.length : null;
  const weekMax = Math.max(1, ...week.map(d => d.kcal), goalKcal ? goalKcal * 1.15 : 0);
  const isHit = kcal => goalKcal != null && kcal > 0 && Math.abs(kcal - goalKcal) <= goalKcal * 0.1;
  const weekHits = week.filter(d => isHit(d.kcal)).length;

  // Check-in: chốt vào Chủ nhật của tuần ISO; tuần này đã check-in thì hẹn Chủ nhật tuần sau
  const thisWeekDone = weeklyCheckins.some(c => c.week_number === currentWeekNumber && c.year === currentYear);
  const daysLeft = 6 - mondayIndex(new Date()) + (thisWeekDone ? 7 : 0);
  const nextCheckin = (() => {
    const d = new Date();
    d.setDate(d.getDate() + daysLeft);
    return toDateStr(d);
  })();
  const lastCheckin = weeklyCheckins[0];

  const openAdd = type => {
    if (type) setMealType(type);
    setShowAddModal(true);
  };

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
        year: currentYear,
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

  const over = goalKcal != null && totalKcal > goalKcal;
  const ringDash = goalKcal ? Math.min(1, totalKcal / goalKcal) * RING_C : 0;
  const macros = [
    { key: 'p', label: 'Đạm', val: totalProtein, goal: targets?.protein, color: 'var(--body-accent)' },
    { key: 'c', label: 'Tinh bột', val: totalCarbs, goal: targets?.carbs, color: 'var(--body-blue)' },
    { key: 'f', label: 'Chất béo', val: totalFat, goal: targets?.fat, color: 'var(--body-amber)' }
  ];

  const energyCard = (
    <section className="body-card body-nt-energy" style={{ '--dc': over ? 'var(--body-amber)' : 'var(--body-accent)' }}>
      <div className="body-card-head">
        <h3 className="body-card-title">Năng lượng {isToday ? 'hôm nay' : ddmm(selectedDate)}</h3>
        <span className="body-nt-mono">{goalKcal ? `${Math.round((totalKcal / goalKcal) * 100)}% mục tiêu` : 'Chưa có mục tiêu'}</span>
      </div>

      <div className="body-nt-ring">
        <svg viewBox="0 0 240 240" aria-hidden="true">
          <circle cx="120" cy="120" r={RING_R} className="nt-ring-track" />
          {ringDash > 0 && (
            <circle cx="120" cy="120" r={RING_R} className="nt-ring-bar" strokeDasharray={`${ringDash} ${RING_C}`} />
          )}
          <circle cx="120" cy="120" r="90" className="nt-ring-dots" />
        </svg>
        <span className="body-nt-ring-orbit body-deco-orbit" aria-hidden="true"><i /></span>
        <div className="body-nt-ring-center">
          <b>{num(totalKcal)}</b>
          <span>{goalKcal ? `/ ${num(goalKcal)} kcal` : 'kcal'}</span>
          {goalKcal != null && (
            <em className={over ? 'is-over' : undefined}>
              {over ? `Vượt ${num(totalKcal - goalKcal)} kcal` : `Còn ${num(goalKcal - totalKcal)} kcal`}
            </em>
          )}
        </div>
      </div>
      {goalKcal == null && <p className="body-nt-note">Cập nhật hồ sơ ở tab Cơ thể để tính mức TDEE</p>}

      <div className="body-nt-macros">
        {macros.map(m => (
          <div key={m.key} className="body-nt-macro" style={{ '--dc': m.color }}>
            <div className="body-nt-macro-row">
              <span><i />{m.label}</span>
              <b>{gram(m.val)} g{m.goal ? <small> / {gram(m.goal)} g</small> : null}</b>
            </div>
            <div className="body-bar" style={{ '--bar-c': m.color }}>
              <i style={{ width: `${m.goal ? Math.min(100, (m.val / m.goal) * 100) : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const mealsCard = (
    <section className="body-card body-nt-meals">
      <div className="body-card-head">
        <h3 className="body-card-title">Bữa ăn {isToday ? 'hôm nay' : `ngày ${ddmm(selectedDate)}`}</h3>
        <button type="button" className="body-btn body-btn-primary body-nt-add" onClick={() => openAdd()}>
          <AppIcon name="plus" size={14} />Thêm món
        </button>
      </div>

      <div className="body-nt-meal-list">
        {meals.map(meal => {
          const open = openKey === meal.key;
          return (
            <div key={meal.key} className={`body-tile body-nt-meal${open ? ' is-open' : ''}`}>
              <button
                type="button"
                className="body-nt-meal-head"
                onClick={() => toggleMeal(meal.key)}
                aria-expanded={open}
              >
                <span className="body-nt-meal-ic"><AppIcon name={meal.icon} size={19} /></span>
                <span className="body-nt-meal-name">
                  <b>{meal.label}</b>
                  <small>{meal.items.length ? `${timeOf(meal.items[0].created_at)} · ${meal.items.length} món` : 'Chưa ghi món'}</small>
                </span>
                <span className={`body-nt-meal-bar${goalKcal ? '' : ' is-hidden'}`} aria-hidden="true">
                  <i style={{ width: `${goalKcal ? Math.min(100, (meal.kcal / goalKcal) * 100) : 0}%` }} />
                </span>
                <span className="body-nt-meal-kcal">{num(meal.kcal)} kcal</span>
                <AppIcon name={open ? 'caretUp' : 'caretDown'} size={16} className="body-nt-meal-caret" />
              </button>

              {open && (
                <div className="body-nt-meal-body">
                  {meal.items.length === 0 ? (
                    <span className="body-nt-empty">Chưa ghi món cho bữa này.</span>
                  ) : meal.items.map(m => (
                    <div key={m.id} className="body-nt-item">
                      <span className="body-nt-item-name">{m.name}</span>
                      <span className="body-nt-item-macro">Đ {gram(m.protein)} · B {gram(m.carbs)} · M {gram(m.fat)}</span>
                      <b className="body-nt-item-kcal">{num(m.calories)}</b>
                      <button
                        type="button"
                        className="body-icon-btn body-nt-item-del"
                        onClick={() => deleteMealLog(m.id)}
                        title="Xóa món"
                        aria-label={`Xóa món ${m.name}`}
                      >
                        <AppIcon name="trash" size={14} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="body-card-link body-nt-meal-more" onClick={() => openAdd(meal.key)}>
                    + Thêm món vào {meal.label.toLowerCase()}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );

  const weekCard = (
    <section className="body-card body-nt-week">
      <div className="body-card-head">
        <h3 className="body-card-title">7 ngày qua</h3>
        <span className="body-card-sub">TB {weekAvg != null ? num(weekAvg) : '—'} kcal</span>
      </div>
      <div className="body-nt-week-chart">
        <div className="body-nt-week-plot">
          {goalKcal != null && (
            <span className="body-nt-week-goal" style={{ bottom: `${(goalKcal / weekMax) * 100}%` }} aria-hidden="true" />
          )}
          {week.map(d => {
            const color = d.date === today ? 'var(--body-accent)'
              : isHit(d.kcal) ? 'var(--body-green)'
              : goalKcal != null ? 'var(--body-amber)' : 'var(--body-blue)';
            return (
              <span key={d.date} className="body-nt-week-col" title={`${ddmm(d.date)}: ${num(d.kcal)} kcal`}>
                <i style={{ height: `${(d.kcal / weekMax) * 100}%`, '--dc': color }} />
              </span>
            );
          })}
        </div>
        <div className="body-nt-week-days">
          {week.map(d => (
            <span key={d.date} className={d.date === today ? 'is-today' : undefined}>{weekdayOf(d.date)}</span>
          ))}
        </div>
      </div>
      <span className="body-card-sub">
        {goalKcal != null
          ? `${weekHits} / 7 ngày đạt mục tiêu ${num(goalKcal)} kcal`
          : 'Chưa có mục tiêu kcal để so sánh'}
      </span>
    </section>
  );

  const checkinCard = (
    <section className="body-card body-nt-next">
      <div className="body-card-head">
        <h3 className="body-card-title">Check-in tuần</h3>
        <span className={`body-pill ${thisWeekDone ? 'is-green' : 'is-amber'}`}>
          <i />Tuần {currentWeekNumber} {thisWeekDone ? 'đã xong' : 'chưa làm'}
        </span>
      </div>
      <div className="body-nt-next-date">
        <span className="body-nt-next-ic"><AppIcon name="calendar" size={18} /></span>
        <span>
          <b>{weekdayOf(nextCheckin)} {ddmm(nextCheckin)}</b>
          <small>{daysLeft === 0 ? 'Hôm nay' : `Còn ${daysLeft} ngày`}</small>
        </span>
      </div>
      {lastCheckin && (
        <span className="body-card-sub">
          Lần trước: Tuần {lastCheckin.week_number}
          {lastCheckin.weight_avg ? ` · ${lastCheckin.weight_avg} kg` : ''}
          {lastCheckin.waist_cm ? ` · Eo ${lastCheckin.waist_cm} cm` : ''}
        </span>
      )}
      <button type="button" className="body-btn" onClick={() => setActiveTab('checkin')}>Mở check-in</button>
    </section>
  );

  return (
    <div className="body-nt">
      {/* ── THANH TRÊN: tiêu đề, tab, ngày ───────────────────────── */}
      <div className="body-nt-top">
        <h2 className="body-nt-title">Dinh dưỡng & Check-in</h2>
        <div className="body-nt-tabs" role="tablist" aria-label="Dinh dưỡng">
          <button type="button" role="tab" className="body-chip" aria-selected={activeTab === 'daily'} onClick={() => setActiveTab('daily')}>
            Nhật ký
          </button>
          <button type="button" role="tab" className="body-chip" aria-selected={activeTab === 'checkin'} onClick={() => setActiveTab('checkin')}>
            Check-in tuần
          </button>
        </div>
        {activeTab === 'daily' && (
          <input
            type="date"
            className="body-input body-nt-date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            aria-label="Chọn ngày"
          />
        )}
      </div>

      {/* ── TAB 1: NHẬT KÝ ─────────────────────────────────────── */}
      {activeTab === 'daily' && (
        <div className="body-nt-daily">
          {energyCard}
          {mealsCard}
          <div className="body-nt-side">
            {weekCard}
            {checkinCard}
          </div>
        </div>
      )}

      {/* ── TAB 2: CHECK-IN TUẦN ─────────────────────────────────── */}
      {activeTab === 'checkin' && (
        <section className="body-card body-nt-checkin">
          <div className="body-nt-checkin-head">
            <span className="body-pill is-accent">TUẦN {currentWeekNumber} · NĂM {currentYear}</span>
            <h3 className="body-card-title">Đánh giá tuần & Cân đo định kỳ</h3>
            <span className="body-card-sub">Ghi nhận cảm nhận thể trạng và chỉ số vòng eo để theo dõi tái cấu trúc cơ thể</span>
          </div>

          <form onSubmit={handleSaveWeekly} className="body-nt-checkin-form">
            <div className="body-nt-fields">
              <label className="body-nt-field">
                <span>Cân nặng TB tuần (kg)</span>
                <input
                  type="number"
                  step="0.1"
                  className="body-input body-nt-mono-input"
                  placeholder="Ví dụ: 64.9"
                  value={checkinWeight}
                  onChange={e => setCheckinWeight(e.target.value)}
                />
              </label>
              <label className="body-nt-field">
                <span>Vòng eo sáng sớm (cm)</span>
                <input
                  type="number"
                  step="0.5"
                  className="body-input body-nt-mono-input"
                  placeholder="Ví dụ: 75.5"
                  value={checkinWaist}
                  onChange={e => setCheckinWaist(e.target.value)}
                />
              </label>
            </div>

            <div className="body-nt-feels">
              <span className="body-nt-label">Cảm nhận thể trạng trong tuần (1–5 sao)</span>
              <div className="body-nt-feel-grid">
                {[
                  { label: 'Mức năng lượng', val: feelEnergy, set: setFeelEnergy, icon: 'lightning' },
                  { label: 'Chất lượng giấc ngủ', val: feelSleep, set: setFeelSleep, icon: 'moon' },
                  { label: 'Kiểm soát cơn đói', val: feelHunger, set: setFeelHunger, icon: 'bowlFood' },
                  { label: 'Mức độ hồi cơ', val: feelSoreness, set: setFeelSoreness, icon: 'heart' }
                ].map(f => (
                  <div key={f.label} className="body-tile body-nt-feel">
                    <span className="body-nt-feel-name"><AppIcon name={f.icon} size={15} />{f.label}</span>
                    <span className="body-nt-stars" role="group" aria-label={f.label}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          className={star <= f.val ? 'is-on' : undefined}
                          onClick={() => f.set(star)}
                          aria-label={`${star} sao`}
                          aria-pressed={star === f.val}
                        >
                          <AppIcon name="star" size={16} weight={star <= f.val ? 'fill' : 'regular'} />
                        </button>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <label className="body-nt-field">
              <span>Ghi chú tổng kết tuần</span>
              <textarea
                className="body-input body-nt-notes"
                value={checkinNotes}
                onChange={e => setCheckinNotes(e.target.value)}
                placeholder="Ghi lại tiến độ tập luyện, cảm xúc, chế độ ăn thâm hụt hoặc những điều cần cải thiện..."
                rows={3}
              />
            </label>

            <div className="body-nt-checkin-actions">
              <button type="submit" className="body-btn body-btn-primary">
                Lưu check-in tuần {currentWeekNumber}
              </button>
              {checkinSaved && (
                <span className="body-nt-saved"><AppIcon name="checkCircle" size={15} />Đã lưu thành công vào cơ sở dữ liệu</span>
              )}
            </div>
          </form>

          {/* Lịch sử checkin đã lưu */}
          {weeklyCheckins.length > 0 && (
            <div className="body-nt-history">
              <h4>Lịch sử các tuần trước</h4>
              {weeklyCheckins.map(c => (
                <div key={`${c.year}-${c.week_number}`} className="body-nt-history-row">
                  <b>Tuần {c.week_number} · Năm {c.year}</b>
                  <span>{c.weight_avg ? `${c.weight_avg} kg` : ''} {c.waist_cm ? `· Eo ${c.waist_cm} cm` : ''}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── MODAL THÊM MÓN ─────────────────────────────────────── */}
      {showAddModal && (
        <div className="body-modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div
            className="body-modal-panel body-nt-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Thêm món vào nhật ký"
            onClick={e => e.stopPropagation()}
          >
            <div className="body-nt-modal-head">
              <h3 className="body-card-title">Thêm món vào nhật ký</h3>
              <button type="button" className="body-icon-btn" onClick={() => setShowAddModal(false)} aria-label="Đóng" autoFocus>
                <AppIcon name="x" size={16} />
              </button>
            </div>

            <div className="body-nt-modal-body">
              {/* Bữa đặt trước để áp cho cả món chọn nhanh lẫn món nhập tay */}
              <div className="body-nt-field">
                <span>Bữa ăn</span>
                <div className="body-nt-seg" role="group" aria-label="Bữa ăn">
                  {MEAL_TYPES.map(t => (
                    <button key={t.key} type="button" className="body-chip" aria-pressed={mealType === t.key} onClick={() => setMealType(t.key)}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {savedMeals && savedMeals.length > 0 && (
                <div className="body-nt-field">
                  {/* Món gợi ý mặc định không có id (chưa phải món bạn lưu) */}
                  <span>{savedMeals.some(m => m.id) ? 'Món đã lưu (bấm để chọn nhanh)' : 'Gợi ý món phổ biến (bấm để chọn nhanh)'}</span>
                  <div className="body-nt-saved-list">
                    {savedMeals.map(t => (
                      <button key={t.name} type="button" className="body-chip body-nt-saved-chip" onClick={() => handlePickSaved(t)}>
                        <AppIcon name="plus" size={12} />{t.name}<span className="body-chip-count">{t.calories || t.kcal} kcal</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form id="body-nt-add-form" onSubmit={handleAddMeal} className="body-nt-add-form">
                <label className="body-nt-field">
                  <span>Tên món ăn *</span>
                  <input
                    type="text"
                    required
                    className="body-input"
                    placeholder="Ví dụ: Cơm ức gà nướng"
                    value={mealName}
                    onChange={e => setMealName(e.target.value)}
                  />
                </label>
                <div className="body-nt-fields is-4">
                  <label className="body-nt-field">
                    <span>Calories (kcal) *</span>
                    <input type="number" required className="body-input body-nt-mono-input" placeholder="350" value={mealKcal} onChange={e => setMealKcal(e.target.value)} />
                  </label>
                  <label className="body-nt-field">
                    <span>Đạm (g)</span>
                    <input type="number" step="0.5" className="body-input body-nt-mono-input" placeholder="30" value={mealProtein} onChange={e => setMealProtein(e.target.value)} />
                  </label>
                  <label className="body-nt-field">
                    <span>Carb (g)</span>
                    <input type="number" step="0.5" className="body-input body-nt-mono-input" placeholder="45" value={mealCarbs} onChange={e => setMealCarbs(e.target.value)} />
                  </label>
                  <label className="body-nt-field">
                    <span>Béo (g)</span>
                    <input type="number" step="0.5" className="body-input body-nt-mono-input" placeholder="10" value={mealFat} onChange={e => setMealFat(e.target.value)} />
                  </label>
                </div>
                <label className="body-nt-check">
                  <input type="checkbox" checked={saveAsTemplate} onChange={e => setSaveAsTemplate(e.target.checked)} />
                  Lưu vào danh sách món mẫu để chọn nhanh lần sau
                </label>
              </form>
            </div>

            <div className="body-nt-modal-foot">
              <button type="button" className="body-btn" onClick={() => setShowAddModal(false)}>Hủy</button>
              <button type="submit" form="body-nt-add-form" className="body-btn body-btn-primary">Ghi món</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
