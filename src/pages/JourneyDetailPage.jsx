import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * JourneyDetailPage — /journey/:id
 * Full dashboard for a single journey (active or completed).
 *
 * Sections:
 *  1. Header card with progress ring
 *  2. Stats grid (completion%, focus hours, XP, sessions)
 *  3. Journey Calendar (month view, color-coded per day)
 *  4. DayDetailModal (click day → popup with habits, mood, focus, challenge)
 *  5. Habits list, mood distribution, completed days
 */

const MOOD_LABELS = ['😤','😟','😐','😊','🤩'];
const MOOD_NAMES  = ['Rất Tệ','Tệ','Bình Thường','Tốt','Xuất Sắc'];
const STATUS_COLOR = {
  completed: { bg: 'rgba(0,255,136,0.12)', color: '#00ff88', label: '✅ Hoàn Thành' },
  archived:  { bg: 'rgba(107,114,128,0.12)', color: '#9ca3af', label: '🏳 Đã Bỏ' },
  extended:  { bg: 'rgba(6,182,212,0.12)', color: '#22d3ee', label: '⏩ Đã Mở Rộng' },
  active:    { bg: 'rgba(139,92,246,0.12)', color: '#a78bfa', label: '🟣 Đang Chạy' },
};

export default function JourneyDetailPage() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { user }     = useAuth();

  const [journey,      setJourney]      = useState(null);
  const [habitSnaps,   setHabitSnaps]   = useState([]);
  const [stats,        setStats]        = useState(null);
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState(null);

  // Calendar + day detail
  const [allLogs,      setAllLogs]      = useState([]);
  const [allFocus,     setAllFocus]     = useState([]);
  const [allMoods,     setAllMoods]     = useState([]);
  const [selectedDay,  setSelectedDay]  = useState(null);

  useEffect(() => {
    if (!isSupabaseEnabled || !user || !id) return;
    loadAll();
  }, [id, user?.id]);

  async function loadAll() {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Journey record
      const { data: j, error: jErr } = await supabase
        .from('user_journeys')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
      if (jErr) throw new Error('Không tìm thấy lộ trình');
      setJourney(j);

      const startDate = j.started_at;
      const endDate   = j.ended_at || new Date().toISOString().split('T')[0];

      // 2. Journey habits snapshot
      const { data: hSnaps } = await supabase
        .from('journey_habits')
        .select('id, name, icon, color, habit_id')
        .eq('journey_id', id)
        .order('sort_order');
      setHabitSnaps(hSnaps || []);

      const habitIds   = (hSnaps || []).map(h => h.habit_id).filter(Boolean);
      const totalHabits = habitIds.length;

      // 3. Habit logs in range (ALL — for calendar)
      let logs = [];
      if (habitIds.length) {
        const { data: logData } = await supabase
          .from('habit_logs')
          .select('habit_id, log_date, status')
          .eq('user_id', user.id)
          .in('habit_id', habitIds)
          .gte('log_date', startDate)
          .lte('log_date', endDate);
        logs = logData || [];
      }
      setAllLogs(logs);

      // Compute completed days
      const byDate = {};
      logs.filter(l => l.status === 'completed').forEach(({ habit_id, log_date }) => {
        if (!byDate[log_date]) byDate[log_date] = new Set();
        byDate[log_date].add(habit_id);
      });
      const completedDaysList = Object.entries(byDate)
        .filter(([, s]) => s.size >= totalHabits && totalHabits > 0)
        .map(([d]) => d)
        .sort();
      const completedDays = completedDaysList.length;

      // 4. Focus sessions in range
      const { data: focusSessions } = await supabase
        .from('focus_sessions')
        .select('duration_min, date, completed_at, habit_id')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);
      setAllFocus(focusSessions || []);
      const totalFocusMin = (focusSessions || []).reduce((s, r) => s + (r.duration_min || 0), 0);

      // 5. XP logs in range
      const { data: xpRows } = await supabase
        .from('xp_logs')
        .select('amount, created_at')
        .eq('user_id', user.id)
        .gte('created_at', `${startDate}T00:00:00Z`)
        .lte('created_at', `${endDate}T23:59:59Z`);
      const totalXp = (xpRows || []).reduce((s, r) => s + (r.amount || 0), 0);

      // 6. Mood logs in range
      const { data: moodRows } = await supabase
        .from('mood_logs')
        .select('mood, logged_at')
        .eq('user_id', user.id)
        .gte('logged_at', `${startDate}T00:00:00Z`)
        .lte('logged_at', `${endDate}T23:59:59Z`);
      setAllMoods(moodRows || []);

      const moodDist = [0, 0, 0, 0, 0];
      (moodRows || []).forEach(r => { if (r.mood >= 1 && r.mood <= 5) moodDist[r.mood - 1]++; });

      const targetDays = j.target_days || 21;
      const pct = totalHabits ? Math.round((completedDays / targetDays) * 100) : 0;

      setStats({
        completedDays, targetDays, pct,
        totalFocusMin, totalXp,
        moodDist,
        focusSessionCount: (focusSessions || []).length,
        completedDaysList,
        byDate, totalHabits,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  // ── Loading / Error states ──────────────────────────────
  if (isLoading) return (
    <div style={{ paddingTop: '6rem', textAlign: 'center', color: 'var(--text-muted)' }}>
      ⏳ Đang tải thống kê lộ trình...
    </div>
  );

  if (error || !journey) return (
    <div style={{ paddingTop: '6rem', textAlign: 'center' }}>
      <p style={{ color: 'var(--red)' }}>⚠️ {error || 'Không tìm thấy lộ trình'}</p>
      <button className="btn btn-ghost" onClick={() => navigate('/journey')} style={{ marginTop: '1rem' }}>
        ← Quay lại
      </button>
    </div>
  );

  const statusInfo = STATUS_COLOR[journey.status] || STATUS_COLOR.archived;
  const pct = stats?.pct ?? 0;
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(pct, 100) / 100) * circumference;

  return (
    <div className="container" style={{ paddingTop: '6rem', paddingBottom: '4rem' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Back */}
        <button
          className="btn btn-ghost"
          onClick={() => navigate('/journey')}
          style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}
        >← Lộ Trình</button>

        {/* ══ Header Card ══ */}
        <div className="card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', flexWrap: 'wrap' }}>
            {/* Progress ring */}
            <div style={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
              <svg width="110" height="110" viewBox="0 0 110 110">
                <defs>
                  <linearGradient id="detailGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
                <circle cx="55" cy="55" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                <circle cx="55" cy="55" r={radius} fill="none" stroke="url(#detailGrad)" strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circumference} strokeDashoffset={offset}
                  transform="rotate(-90 55 55)" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>{pct}%</span>
              </div>
            </div>
            {/* Info */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{journey.title}</h1>
                <span style={{ padding: '0.2rem 0.6rem', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700, background: statusInfo.bg, color: statusInfo.color }}>
                  {statusInfo.label}
                </span>
                {journey.cycle > 1 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Chu kỳ {journey.cycle}</span>}
              </div>
              <p style={{ color: 'var(--text-muted)', margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
                📅 {new Date(journey.started_at).toLocaleDateString('vi-VN')}
                {journey.ended_at && ` → ${new Date(journey.ended_at).toLocaleDateString('vi-VN')}`}
              </p>
              <p style={{ color: 'var(--text-primary)', fontSize: '1.05rem', margin: 0 }}>
                <strong>{stats.completedDays}</strong>/{stats.targetDays} ngày hoàn thành
              </p>
            </div>
          </div>
        </div>

        {/* ══ Stats Grid ══ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { icon: '✅', label: 'Ngày Hoàn Thành', value: stats.completedDays, unit: `/ ${stats.targetDays}` },
            { icon: '⏱', label: 'Tổng Focus', value: Math.round(stats.totalFocusMin / 60 * 10) / 10, unit: 'giờ' },
            { icon: '🎯', label: 'Sessions Focus', value: stats.focusSessionCount, unit: 'lần' },
            { icon: '⚡', label: 'XP Kiếm Được', value: stats.totalXp, unit: 'XP' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{s.icon}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {s.value}
                <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.3rem' }}>{s.unit}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ══ Month Summary Cards ══ */}
        <MonthSummary journey={journey} stats={stats} />

        {/* ══ Journey Calendar ══ */}
        <JourneyCalendar
          journey={journey}
          stats={stats}
          habitSnaps={habitSnaps}
          allLogs={allLogs}
          onSelectDay={setSelectedDay}
        />

        {/* ══ Day Detail Modal ══ */}
        {selectedDay && (
          <DayDetailModal
            dateKey={selectedDay}
            habitSnaps={habitSnaps}
            allLogs={allLogs}
            allFocus={allFocus}
            allMoods={allMoods}
            onClose={() => setSelectedDay(null)}
          />
        )}

        {/* ══ Habits in this journey ══ */}
        {habitSnaps.length > 0 && (
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem' }}>📋 Habits Trong Lộ Trình</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {habitSnaps.map(h => (
                <span key={h.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.35rem 0.8rem', borderRadius: 99,
                  background: `${h.color || '#8b5cf6'}22`,
                  border: `1px solid ${h.color || '#8b5cf6'}44`,
                  color: h.color || '#c4b5fd', fontSize: '0.85rem',
                }}>
                  {h.icon || '✅'} {h.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ══ Mood Distribution ══ */}
        {stats.moodDist.some(v => v > 0) && (
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem' }}>😊 Mood Trong Lộ Trình</h3>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {stats.moodDist.map((count, i) => (
                count > 0 && (
                  <div key={i} style={{ textAlign: 'center', minWidth: 54 }}>
                    <div style={{ fontSize: '1.5rem' }}>{MOOD_LABELS[i]}</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.1rem', lineHeight: 1 }}>{count}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{MOOD_NAMES[i]}</div>
                  </div>
                )
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════
   MonthSummary — progress ring per month (like Tracker page)
   ══════════════════════════════════════════════════════════ */
function MonthSummary({ journey, stats }) {
  if (!stats || !stats.targetDays) return null;

  const startDate = new Date(journey.started_at);
  const endDate   = journey.ended_at ? new Date(journey.ended_at) : new Date();
  const today     = new Date().toISOString().split('T')[0];

  // Group journey days by month
  const months = {};
  const d = new Date(startDate);
  while (d <= endDate && d.toISOString().split('T')[0] <= today) {
    const k = d.toISOString().split('T')[0];
    const monthKey = k.substring(0, 7); // "2026-04"
    if (!months[monthKey]) months[monthKey] = { total: 0, done: 0, partial: 0, missed: 0 };
    months[monthKey].total++;

    const daySet = stats.byDate?.[k];
    const done = daySet?.size || 0;
    if (done >= stats.totalHabits && stats.totalHabits > 0) months[monthKey].done++;
    else if (done > 0) months[monthKey].partial++;
    else months[monthKey].missed++;

    d.setDate(d.getDate() + 1);
  }

  // Future days remaining
  const endStr = journey.ended_at || (() => {
    const e = new Date(startDate);
    e.setDate(e.getDate() + (stats.targetDays - 1));
    return e.toISOString().split('T')[0];
  })();
  const futureD = new Date(today);
  futureD.setDate(futureD.getDate() + 1);
  const endD = new Date(endStr);
  let futureDays = 0;
  while (futureD <= endD) {
    const monthKey = futureD.toISOString().split('T')[0].substring(0, 7);
    if (!months[monthKey]) months[monthKey] = { total: 0, done: 0, partial: 0, missed: 0 };
    futureDays++;
    futureD.setDate(futureD.getDate() + 1);
  }

  const sortedMonths = Object.entries(months).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
      {sortedMonths.map(([monthKey, m]) => {
        const total = m.total || 1;
        const pct = Math.round((m.done / total) * 100);
        const r = 40;
        const circ = 2 * Math.PI * r;
        const off = circ - (pct / 100) * circ;
        const label = new Date(monthKey + '-01').toLocaleDateString('vi-VN', { month: 'long' });

        // Future count for the last month
        const remaining = monthKey === sortedMonths[sortedMonths.length - 1]?.[0] ? futureDays : 0;

        return (
          <div key={monthKey} className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
              🎯 {label}
            </div>

            {/* Progress ring */}
            <div style={{ position: 'relative', width: 96, height: 96, margin: '0 auto 0.75rem' }}>
              <svg width="96" height="96" viewBox="0 0 96 96">
                <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                <circle cx="48" cy="48" r={r} fill="none"
                  stroke={pct >= 80 ? '#00ff88' : pct >= 40 ? '#ffd700' : '#f97316'}
                  strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={circ} strokeDashoffset={off}
                  transform="rotate(-90 48 48)"
                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '1.3rem', fontWeight: 800, color: pct >= 80 ? '#00ff88' : pct >= 40 ? '#ffd700' : '#f97316' }}>{pct}%</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{label}</span>
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--green)' }}>{m.done}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Hoàn thành</div>
              </div>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f97316' }}>{m.missed + m.partial}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Bỏ qua</div>
              </div>
              {remaining > 0 && (
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-secondary)' }}>{remaining}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Còn lại</div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════
   Journey Calendar — month view scoped to journey dates
   ══════════════════════════════════════════════════════════ */
function JourneyCalendar({ journey, stats, habitSnaps, allLogs, onSelectDay }) {
  const startDate = new Date(journey.started_at);
  const endDate   = journey.ended_at ? new Date(journey.ended_at) : new Date();

  // Build all months that the journey spans
  const months = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (cursor <= endDate) {
    months.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const today      = new Date().toISOString().split('T')[0];
  const startKey   = journey.started_at;
  const endKey     = journey.ended_at || today;
  const habitIds   = habitSnaps.map(h => h.habit_id).filter(Boolean);
  const totalHabits = habitIds.length;

  // Pre-compute per-day status
  const dayStatus = {}; // key: date string, value: 'full' | 'partial' | 'none'
  if (totalHabits > 0) {
    const completedLogs = allLogs.filter(l => l.status === 'completed');
    const byDate = {};
    completedLogs.forEach(({ habit_id, log_date }) => {
      if (!byDate[log_date]) byDate[log_date] = new Set();
      byDate[log_date].add(habit_id);
    });
    // Walk all days in range
    const d = new Date(startDate);
    while (d.toISOString().split('T')[0] <= endKey && d.toISOString().split('T')[0] <= today) {
      const k = d.toISOString().split('T')[0];
      const done = byDate[k]?.size || 0;
      dayStatus[k] = done >= totalHabits ? 'full' : done > 0 ? 'partial' : 'none';
      d.setDate(d.getDate() + 1);
    }
  }

  const STATUS_STYLES = {
    full:    { background: 'rgba(0,255,136,0.25)', border: '1px solid rgba(0,255,136,0.4)', color: '#00ff88' },
    partial: { background: 'rgba(255,215,0,0.18)', border: '1px solid rgba(255,215,0,0.3)', color: '#ffd700' },
    none:    { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)' },
    outside: { background: 'transparent', border: '1px solid transparent', color: 'rgba(255,255,255,0.1)' },
    future:  { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.15)' },
  };

  const DOW_LABELS = ['T2','T3','T4','T5','T6','T7','CN'];

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <h3 style={{ margin: '0 0 0.5rem' }}>📅 Lịch Lộ Trình</h3>
      <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(0,255,136,0.4)' }} /> Hoàn thành</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(255,215,0,0.35)' }} /> Một phần</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }} /> Bỏ lỡ</span>
      </div>

      {months.map(monthDate => {
        const year  = monthDate.getFullYear();
        const month = monthDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDow    = (new Date(year, month, 1).getDay() + 6) % 7; // Monday=0

        const cells = [];
        for (let i = 0; i < firstDow; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);

        return (
          <div key={`${year}-${month}`} style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              {monthDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' }}>
              {DOW_LABELS.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, paddingBottom: '0.25rem' }}>{d}</div>
              ))}
              {cells.map((day, i) => {
                if (day === null) return <div key={`e${i}`} />;
                const k = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const inRange = k >= startKey && k <= endKey;
                const isFuture = k > today;
                const status = !inRange ? 'outside' : isFuture ? 'future' : (dayStatus[k] || 'none');
                const style = STATUS_STYLES[status];
                const isClickable = inRange && !isFuture && totalHabits > 0;

                return (
                  <div
                    key={k}
                    onClick={isClickable ? () => onSelectDay(k) : undefined}
                    title={inRange ? `${k} · ${status === 'full' ? 'Hoàn thành' : status === 'partial' ? 'Một phần' : isFuture ? 'Chưa đến' : 'Bỏ lỡ'}` : ''}
                    style={{
                      ...style,
                      textAlign: 'center',
                      padding: '0.4rem 0',
                      borderRadius: 6,
                      fontSize: '0.78rem',
                      fontWeight: k === today ? 800 : 500,
                      cursor: isClickable ? 'pointer' : 'default',
                      transition: 'all 0.15s ease',
                      boxShadow: k === today ? '0 0 0 2px rgba(139,92,246,0.5)' : 'none',
                    }}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════
   DayDetailModal — popup showing per-day details
   ══════════════════════════════════════════════════════════ */
function DayDetailModal({ dateKey, habitSnaps, allLogs, allFocus, allMoods, onClose }) {
  const habitIds = habitSnaps.map(h => h.habit_id).filter(Boolean);

  // Habits done/missed for this day
  const logsToday = allLogs.filter(l => l.log_date === dateKey && l.status === 'completed');
  const doneIds   = new Set(logsToday.map(l => l.habit_id));

  // Focus sessions for this day
  const focusToday = allFocus.filter(f => f.date === dateKey);
  const totalFocusMin = focusToday.reduce((s, f) => s + (f.duration_min || 0), 0);

  // Mood for this day
  const moodToday = allMoods.find(m => m.logged_at && m.logged_at.startsWith(dateKey));

  const dateLabel = new Date(dateKey).toLocaleDateString('vi-VN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const doneCount = habitSnaps.filter(h => doneIds.has(h.habit_id)).length;

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="auth-modal card" style={{ maxWidth: 480, maxHeight: '85vh', overflowY: 'auto' }}>
        <button className="auth-modal__close" onClick={onClose}>✕</button>

        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>
          📅 {dateLabel}
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          {doneCount}/{habitSnaps.length} thói quen hoàn thành
        </div>

        {/* Habits */}
        {habitSnaps.length > 0 && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
              Thói Quen
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {habitSnaps.map(h => {
                const done = doneIds.has(h.habit_id);
                return (
                  <div key={h.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 8,
                    background: done ? 'rgba(0,255,136,0.06)' : 'rgba(239,68,68,0.06)',
                    border: `1px solid ${done ? 'rgba(0,255,136,0.2)' : 'rgba(239,68,68,0.15)'}`,
                  }}>
                    <span style={{ fontSize: '1.1rem' }}>{done ? '✅' : '❌'}</span>
                    <span style={{ fontSize: '1rem' }}>{h.icon || '✅'}</span>
                    <span style={{
                      fontSize: '0.88rem', flex: 1,
                      color: done ? 'var(--text-primary)' : 'var(--text-muted)',
                      textDecoration: done ? 'none' : 'line-through',
                    }}>
                      {h.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Mood */}
        {moodToday && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
              Tâm Trạng
            </div>
            <div style={{
              padding: '0.6rem 1rem', borderRadius: 8,
              background: 'rgba(139,92,246,0.08)',
              border: '1px solid rgba(139,92,246,0.2)',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <span style={{ fontSize: '1.5rem' }}>
                {MOOD_LABELS[moodToday.mood - 1] || '😐'}
              </span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                {MOOD_NAMES[moodToday.mood - 1] || 'Bình Thường'}
              </span>
            </div>
          </div>
        )}

        {/* Focus Sessions */}
        {focusToday.length > 0 && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
              Focus Sessions — {totalFocusMin} phút
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {focusToday.map((f, i) => (
                <div key={i} style={{
                  padding: '0.5rem 0.75rem', borderRadius: 8,
                  background: 'rgba(6,182,212,0.06)',
                  border: '1px solid rgba(6,182,212,0.15)',
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  fontSize: '0.85rem', color: 'var(--text-secondary)',
                }}>
                  <span>⏱</span>
                  <span style={{ flex: 1 }}>{f.duration_min} phút</span>
                  {f.completed_at && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {new Date(f.completed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No data fallback */}
        {!moodToday && focusToday.length === 0 && doneCount === 0 && (
          <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Không có dữ liệu cho ngày này
          </div>
        )}
      </div>
    </div>
  );
}
