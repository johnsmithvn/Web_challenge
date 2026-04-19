import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * JourneyDetailPage — /journey/:id
 * Full-page stats view for a completed/archived journey.
 *
 * Queries (date-scoped to journey.started_at → journey.ended_at):
 *  - habit_logs    → completion %, days completed
 *  - focus_sessions → total focus hours
 *  - xp_logs       → XP earned in this journey
 *  - mood_logs     → mood distribution
 *  - journey_habits → which habits were in this journey
 */

const MOOD_LABELS  = ['😤','😟','😐','😊','🤩'];
const MOOD_NAMES   = ['Rất Tệ','Tệ','Bình Thường','Tốt','Xuất Sắc'];
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

  useEffect(() => {
    if (!isSupabaseEnabled || !user || !id) return;
    loadAll();
  }, [id, user?.id]);

  async function loadAll() {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Load the journey record
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

      const habitIds = (hSnaps || []).map(h => h.habit_id).filter(Boolean);
      const totalHabits = habitIds.length;

      // 3. Habit logs in range
      let completedDays = 0;
      let completedDaysList = [];
      if (habitIds.length) {
        const { data: logs } = await supabase
          .from('habit_logs')
          .select('habit_id, log_date')
          .eq('user_id', user.id)
          .in('habit_id', habitIds)
          .gte('log_date', startDate)
          .lte('log_date', endDate)
          .eq('status', 'completed');

        const byDate = {};
        (logs || []).forEach(({ habit_id, log_date }) => {
          if (!byDate[log_date]) byDate[log_date] = new Set();
          byDate[log_date].add(habit_id);
        });
        completedDaysList = Object.entries(byDate)
          .filter(([, s]) => s.size >= totalHabits)
          .map(([d]) => d)
          .sort();
        completedDays = completedDaysList.length;
      }

      // 4. Focus sessions in range
      const { data: focusSessions } = await supabase
        .from('focus_sessions')
        .select('duration_min, date')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

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

      const moodDist = [0, 0, 0, 0, 0];
      (moodRows || []).forEach(r => { if (r.mood >= 1 && r.mood <= 5) moodDist[r.mood - 1]++; });

      const targetDays = j.target_days || 21;
      const pct = totalHabits ? Math.round((completedDays / targetDays) * 100) : 0;

      setStats({
        completedDays,
        targetDays,
        pct,
        totalFocusMin,
        totalXp,
        moodDist,
        focusSessionCount: (focusSessions || []).length,
        completedDaysList,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

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
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* Back */}
        <button
          className="btn btn-ghost"
          onClick={() => navigate('/journey')}
          style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}
        >
          ← Lộ Trình
        </button>

        {/* Header */}
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
                <circle cx="55" cy="55" r={radius}
                  fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                <circle cx="55" cy="55" r={radius}
                  fill="none" stroke="url(#detailGrad)" strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  transform="rotate(-90 55 55)"
                />
              </svg>
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>{pct}%</span>
              </div>
            </div>

            {/* Info */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{journey.title}</h1>
                <span style={{
                  padding: '0.2rem 0.6rem', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700,
                  background: statusInfo.bg, color: statusInfo.color,
                }}>
                  {statusInfo.label}
                </span>
                {journey.cycle > 1 && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Chu kỳ {journey.cycle}
                  </span>
                )}
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

        {/* Stats grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}>
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
                <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.3rem' }}>
                  {s.unit}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Habits in this journey */}
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

        {/* Mood distribution */}
        {stats.moodDist.some(v => v > 0) && (
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem' }}>😊 Mood Trong Lộ Trình</h3>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {stats.moodDist.map((count, i) => (
                count > 0 && (
                  <div key={i} style={{ textAlign: 'center', minWidth: 54 }}>
                    <div style={{ fontSize: '1.5rem' }}>{MOOD_LABELS[i]}</div>
                    <div style={{
                      fontWeight: 700, color: 'var(--text-primary)',
                      fontSize: '1.1rem', lineHeight: 1,
                    }}>{count}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {MOOD_NAMES[i]}
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        )}

        {/* Completed days list */}
        {stats.completedDaysList.length > 0 && (
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem' }}>📅 Các Ngày Đã Hoàn Thành</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {stats.completedDaysList.map(d => (
                <span key={d} style={{
                  padding: '0.25rem 0.6rem', borderRadius: 6,
                  background: 'rgba(0,255,136,0.1)',
                  border: '1px solid rgba(0,255,136,0.2)',
                  color: '#00ff88', fontSize: '0.8rem',
                }}>
                  {new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
