/**
 * MyJourneys
 * Shows user's past journeys with ability to restart them.
 * Fetches journey_habits snapshot to rebuild habit list on restart.
 *
 * Props:
 *   history      — user_journeys[] (all past journeys)
 *   onRestart    — ({ title, habits, programId, targetDays, description }) => void
 *   restarting   — boolean (loading state)
 */

import { useState, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../../lib/supabase';

const STATUS_ICON = {
  completed: '🏆',
  archived:  '📁',
  extended:  '📈',
};

const STATUS_LABEL = {
  completed: 'Hoàn Thành',
  archived:  'Đã Dừng',
  extended:  'Mở Rộng',
};

export default function MyJourneys({ history = [], onRestart, restarting = false }) {
  const [loadingId, setLoadingId] = useState(null);

  // Deduplicate by title — keep the LATEST journey per title
  const uniqueByTitle = [];
  const seen = new Set();
  for (const j of history) {
    const key = j.title?.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueByTitle.push(j);
  }

  const handleRestart = useCallback(async (journey) => {
    if (!isSupabaseEnabled || restarting) return;
    setLoadingId(journey.id);

    try {
      // Fetch the journey_habits snapshot for this journey
      const { data: snaps } = await supabase
        .from('journey_habits')
        .select('name, action, icon, color')
        .eq('journey_id', journey.id)
        .order('sort_order');

      const habits = (snaps || []).map(s => ({
        name:   s.name,
        action: s.action || s.name,
        icon:   s.icon || '✅',
        color:  s.color || '#8b5cf6',
      }));

      await onRestart({
        title:       journey.title,
        programId:   journey.program_id || null,
        targetDays:  journey.target_days || 21,
        description: journey.description || null,
        habits,
      });
    } catch (err) {
      console.warn('[MyJourneys] restart error:', err.message);
    } finally {
      setLoadingId(null);
    }
  }, [onRestart, restarting]);

  if (!uniqueByTitle.length) {
    return (
      <div className="journey-history-empty">
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📂</div>
        <div>Chưa có lộ trình nào.</div>
        <div style={{ marginTop: '0.4rem', fontSize: '0.82rem', color: '#6b7280' }}>
          Bắt đầu từ tab Khám Phá, lộ trình sẽ xuất hiện ở đây!
        </div>
      </div>
    );
  }

  return (
    <div className="journey-history">
      <div style={{
        fontSize: '0.82rem',
        color: 'var(--text-muted)',
        marginBottom: '1rem',
        padding: '0 0.25rem',
      }}>
        Chọn lộ trình đã từng sử dụng để bắt đầu lại với cùng bộ habits.
      </div>

      {uniqueByTitle.map(j => {
        const statusKey = j.status || 'archived';
        const icon = STATUS_ICON[statusKey] || '📁';
        const cycleLabel = j.cycle > 1 ? ` · ${j.cycle} chu kỳ` : '';
        const isLoading = loadingId === j.id;

        const startLabel = new Date(j.started_at).toLocaleDateString('vi-VN', {
          day: '2-digit', month: '2-digit', year: 'numeric',
        });

        return (
          <div key={j.id} className="journey-history-card" style={{ cursor: 'default' }}>
            <span className="journey-history-icon">{icon}</span>

            <div className="journey-history-info" style={{ flex: 1 }}>
              <h4>{j.title}</h4>
              <div className="journey-history-dates">
                {startLabel}{cycleLabel}
                {' · '}
                <span style={{ color: '#a78bfa' }}>{j.target_days || 21} ngày</span>
                {' · '}
                <span className={`journey-status-badge ${statusKey}`} style={{ display: 'inline' }}>
                  {STATUS_LABEL[statusKey]}
                </span>
              </div>
              {j.description && (
                <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  {j.description}
                </div>
              )}
            </div>

            <button
              className="btn-journey-primary"
              onClick={() => handleRestart(j)}
              disabled={restarting || isLoading}
              style={{
                fontSize: '0.82rem',
                padding: '0.5rem 1rem',
                whiteSpace: 'nowrap',
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading ? '⏳ Đang tạo...' : '🔄 Bắt đầu lại'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
