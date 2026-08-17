import { useState, useRef, useEffect } from 'react';
import AppIcon from './AppIcon';

/**
 * TagPicker — Searchable dropdown for selecting/creating tags.
 *
 * Props:
 *   tags      — Array of all user tags [{id, name, color}]
 *   selected  — Array of selected tag IDs
 *   onToggle  — (tagId) => void — toggle selection
 *   onAdd     — (name) => Promise<tag> — create new tag
 *   compact   — boolean — smaller size for inline use
 */
export default function TagPicker({ tags = [], selected = [], onToggle, onAdd, compact = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const filtered = tags.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  const canCreate = search.trim() && !tags.some(t => t.name.toLowerCase() === search.trim().toLowerCase());

  const handleCreate = async () => {
    if (!canCreate || !onAdd) return;
    const newTag = await onAdd(search.trim());
    if (newTag) {
      onToggle(newTag.id);
      setSearch('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (canCreate) handleCreate();
    }
  };

  const selectedTags = tags.filter(t => selected.includes(t.id));
  const sz = compact ? '0.68rem' : '0.75rem';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Selected badges + trigger */}
      <div
        style={{
          display: 'flex', flexWrap: 'wrap', gap: '0.2rem', alignItems: 'center',
          cursor: 'pointer', padding: '0.3rem 0',
          minHeight: compact ? '24px' : '28px',
        }}
        onClick={() => setOpen(!open)}
      >
        {selectedTags.length > 0 ? (
          selectedTags.map(t => (
            <span key={t.id} style={{
              fontSize: sz, padding: '0.1rem 0.4rem', borderRadius: '99px',
              background: `${t.color}20`, color: t.color, border: `1px solid ${t.color}40`,
              fontWeight: 600, whiteSpace: 'nowrap',
            }}>
              <AppIcon name="tag" size={12} /> {t.name}
            </span>
          ))
        ) : (
          <span style={{ fontSize: sz, color: 'var(--text-muted)', opacity: 0.7 }}>
            + Tag
          </span>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'var(--bg-secondary, #1a1a2e)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 'var(--radius-md)', overflow: 'hidden',
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)', minWidth: '180px',
          animation: 'modalSlideIn 0.15s ease',
        }}>
          {/* Search input */}
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tìm hoặc tạo tag..."
            style={{
              width: '100%', padding: '0.5rem 0.6rem', fontSize: '0.78rem',
              background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)',
              color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
            }}
          />
          {/* Tag list */}
          <div style={{ maxHeight: '160px', overflowY: 'auto', padding: '0.25rem 0' }}>
            {filtered.map(t => {
              const isSelected = selected.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onToggle(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    width: '100%', padding: '0.35rem 0.6rem', fontSize: '0.78rem',
                    background: isSelected ? 'rgba(139,92,246,0.1)' : 'transparent',
                    border: 'none', color: 'var(--text-primary)', cursor: 'pointer',
                    textAlign: 'left', fontFamily: 'inherit',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = isSelected ? 'rgba(139,92,246,0.1)' : 'transparent'}
                >
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%', background: t.color,
                    flexShrink: 0, border: isSelected ? '2px solid #fff' : 'none',
                  }} />
                  <span style={{ flex: 1 }}>{t.name}</span>
                  {isSelected && <AppIcon name="check" size={12} style={{ color: 'var(--green)' }} />}
                </button>
              );
            })}
            {filtered.length === 0 && !canCreate && (
              <div style={{ padding: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Không có tag nào
              </div>
            )}
            {canCreate && (
              <button
                type="button"
                onClick={handleCreate}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                  width: '100%', padding: '0.35rem 0.6rem', fontSize: '0.78rem',
                  background: 'rgba(6,182,212,0.08)', border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)',
                  color: '#22d3ee', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}
              >
                + Tạo "{search.trim()}"
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
