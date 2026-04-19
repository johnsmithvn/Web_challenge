import { useState, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import PROGRAMS_LOCAL from '../../data/programs.json';

/**
 * ProgramBrowser
 * Shows system template programs. User can start one or create a custom journey.
 *
 * Props:
 *   onStart        — (program) => void   where program = { title, programId, targetDays, habits }
 *   onCustom       — () => void          open CustomJourneyModal
 *   hasActiveJourney — boolean           warn user if switching
 *   starting       — boolean            loading state
 */

const CATEGORY_COLOR = {
  health:       { bg: 'rgba(249,115,22,0.15)',  text: '#fb923c' },
  learning:     { bg: 'rgba(6,182,212,0.15)',   text: '#22d3ee' },
  mindfulness:  { bg: 'rgba(139,92,246,0.15)',  text: '#a78bfa' },
  productivity: { bg: 'rgba(255,215,0,0.15)',   text: '#fbbf24' },
  other:        { bg: 'rgba(107,114,128,0.15)', text: '#9ca3af' },
};

export default function ProgramBrowser({ onStart, onCustom, hasActiveJourney, starting }) {
  const { isAuthenticated } = useAuth();
  const [programs, setPrograms]     = useState(PROGRAMS_LOCAL.templates);
  const [categories]                = useState(PROGRAMS_LOCAL.categories);
  const [activeCategory, setActive] = useState('all');
  const [startingId, setStartingId] = useState(null);

  // ── Load from Supabase if available ──────────────────────
  useEffect(() => {
    if (!isSupabaseEnabled || !isAuthenticated) return;
    supabase
      .from('programs')
      .select('*, program_habits(*)')           // ← join habits from program_habits table
      .eq('is_template', true)
      .order('created_at')
      .then(({ data, error }) => {
        if (!error && data?.length) {
          // Normalize: Supabase returns program_habits[], local JSON uses habits[]
          const normalized = data.map(p => ({
            ...p,
            habits: (p.program_habits || []).map(h => ({
              name:     h.name,
              action:   h.action || h.name,
              icon:     h.icon || '✅',
              color:    h.color || '#8b5cf6',
              category: h.category || 'other',
            })),
          }));
          setPrograms(normalized);
        }
      });
  }, [isAuthenticated]);

  const filtered = activeCategory === 'all'
    ? programs
    : programs.filter(p => p.category === activeCategory);

  const handleStart = async (prog) => {
    setStartingId(prog.id);
    await onStart({
      title:       prog.title,
      programId:   prog.id,
      targetDays:  prog.duration_days || prog.duration || 21,
      description: prog.description || null,
      habits:      prog.habits || [],
    });
    setStartingId(null);
  };

  return (
    <div className="program-browser">
      {/* Category filter */}
      <div className="program-category-tabs">
        {categories.map(cat => (
          <button
            key={cat.key}
            className={`program-cat-btn ${activeCategory === cat.key ? 'active' : ''}`}
            onClick={() => setActive(cat.key)}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Active journey warning */}
      {hasActiveJourney && (
        <div style={{
          padding: '0.75rem 1rem',
          background: 'rgba(251,191,36,0.08)',
          border: '1px solid rgba(251,191,36,0.25)',
          borderRadius: '10px',
          fontSize: '0.83rem',
          color: '#fbbf24',
        }}>
          ⚠️ Bạn đang có lộ trình active. Chọn template mới sẽ archive lộ trình cũ và lưu vào Lịch Sử.
        </div>
      )}

      {/* Program grid */}
      <div className="program-grid">
        {filtered.map(prog => {
          const catStyle = CATEGORY_COLOR[prog.category] || CATEGORY_COLOR.other;
          const isThis   = startingId === prog.id;

          return (
            <div key={prog.id} className="program-card">
              <div className="program-card-header">
                <div
                  className="program-icon"
                  style={{ background: catStyle.bg }}
                >
                  {prog.icon}
                </div>
                <h3>{prog.title}</h3>
              </div>

              <p className="program-desc">{prog.description}</p>

              {/* Habits preview (local data only) */}
              {prog.habits?.length > 0 && (
                <div className="program-habits-preview">
                  {prog.habits.slice(0, 3).map((h, i) => (
                    <div key={i} className="program-habit-row">
                      <span className="ph-icon">{h.icon}</span>
                      <span>{h.name}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="program-card-meta">
                <span className="program-duration-badge">
                  📅 {prog.duration_days || prog.duration || 21} ngày
                </span>
                <span
                  className="program-cat-badge"
                  style={{ background: catStyle.bg, color: catStyle.text }}
                >
                  {prog.category}
                </span>
              </div>

              <button
                className="btn-start-program"
                onClick={() => handleStart(prog)}
                disabled={starting && isThis}
              >
                {starting && isThis ? '⏳ Đang khởi tạo...' : '🚀 Bắt Đầu'}
              </button>
            </div>
          );
        })}

        {/* Custom journey card */}
        <div className="program-card" style={{ justifyContent: 'center', minHeight: '220px' }}>
          <button className="btn-custom-journey" onClick={onCustom}>
            ✏️ Tự tạo lộ trình riêng
          </button>
        </div>
      </div>
    </div>
  );
}
