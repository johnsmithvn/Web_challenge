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

  // Switch mode modal state
  const [switchModal, setSwitchModal] = useState(null); // prog to start
  const [habitMode, setHabitMode]     = useState('replace'); // 'replace' | 'append'

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
    // If user has active journey → show switch mode modal first
    if (hasActiveJourney) {
      setSwitchModal(prog);
      setHabitMode('replace');
      return;
    }
    // No active journey → start directly
    setStartingId(prog.id);
    await onStart({
      title:       prog.title,
      programId:   prog.id,
      targetDays:  prog.duration_days || prog.duration || 21,
      description: prog.description || null,
      habits:      prog.habits || [],
      habitMode:   'replace',
    });
    setStartingId(null);
  };

  const handleConfirmSwitch = async () => {
    if (!switchModal) return;
    const prog = switchModal;
    setSwitchModal(null);
    setStartingId(prog.id);
    await onStart({
      title:       prog.title,
      programId:   prog.id,
      targetDays:  prog.duration_days || prog.duration || 21,
      description: prog.description || null,
      habits:      prog.habits || [],
      habitMode,
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
          ⚠️ Bạn đang có lộ trình active. Chọn template mới sẽ lưu lộ trình cũ vào Lịch Sử.
        </div>
      )}

      {/* Switch mode modal */}
      {switchModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setSwitchModal(null)}>
          <div className="auth-modal card" style={{ maxWidth: 420, padding: '1.5rem' }}>
            <button className="auth-modal__close" onClick={() => setSwitchModal(null)}>✕</button>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>🔄 Đổi Lộ Trình</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 1rem' }}>
              Bạn sắp chuyển sang <strong style={{ color: 'var(--text-primary)' }}>{switchModal.title}</strong>.
              Lộ trình cũ sẽ được lưu vào Lịch Sử.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                padding: '0.75rem', borderRadius: 10,
                background: habitMode === 'replace' ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${habitMode === 'replace' ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <input type="radio" name="habitMode" value="replace" checked={habitMode === 'replace'}
                  onChange={() => setHabitMode('replace')} style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>🔄 Thay thế toàn bộ habits</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Xoá habits cũ, chỉ dùng habits của lộ trình mới</div>
                </div>
              </label>

              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                padding: '0.75rem', borderRadius: 10,
                background: habitMode === 'append' ? 'rgba(6,182,212,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${habitMode === 'append' ? 'rgba(6,182,212,0.4)' : 'rgba(255,255,255,0.08)'}`,
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <input type="radio" name="habitMode" value="append" checked={habitMode === 'append'}
                  onChange={() => setHabitMode('append')} style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>➕ Ghi thêm habits</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Giữ habits cũ + thêm habits mới từ lộ trình</div>
                </div>
              </label>
            </div>

            <div style={{ padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '1rem', fontSize: '0.78rem', color: '#f87171' }}>
              ⚠️ Trạng thái tick hôm nay sẽ được reset. Lịch sử lộ trình cũ vẫn được lưu.
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-ghost" onClick={() => setSwitchModal(null)} style={{ flex: 1 }}>
                Huỷ
              </button>
              <button className="btn btn-primary" onClick={handleConfirmSwitch}
                disabled={starting} style={{ flex: 1 }}>
                {starting ? '⏳ Đang xử lý...' : '🚀 Xác nhận đổi'}
              </button>
            </div>
          </div>
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
