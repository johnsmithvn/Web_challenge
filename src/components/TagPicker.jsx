import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import AppIcon from './AppIcon';

/**
 * TagPicker — Searchable dropdown for selecting/creating tags.
 * Rendered via createPortal to prevent overflow clipping in modals and stacking context issues.
 * Supports smart positioning (flips upward when close to bottom edge).
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
  const [coords, setCoords] = useState(null);

  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const inputRef = useRef(null);

  // Tính toán vị trí thông minh (smart dropup/dropdown)
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const POPOVER_WIDTH = Math.max(220, Math.min(320, rect.width || 220));
    const POPOVER_HEIGHT = 220;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < POPOVER_HEIGHT && spaceAbove > spaceBelow;

    let top = openUpward
      ? Math.max(8, rect.top - POPOVER_HEIGHT - 4)
      : Math.min(window.innerHeight - POPOVER_HEIGHT - 8, rect.bottom + 4);

    let left = rect.left;
    if (left + POPOVER_WIDTH > window.innerWidth - 10) {
      left = window.innerWidth - POPOVER_WIDTH - 10;
    }
    if (left < 10) left = 10;

    setCoords({ top, left, width: POPOVER_WIDTH, openUpward });
  }, []);

  // Cập nhật vị trí khi scroll hoặc resize
  useEffect(() => {
    if (!open) return;
    updatePosition();

    const handleUpdate = () => updatePosition();
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [open, updatePosition]);

  // Đóng khi click ngoài
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Đóng khi nhấn Escape (không nổi lên làm đóng modal cha)
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [open]);

  // Focus ô tìm kiếm khi mở
  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  const filtered = tags.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));
  const canCreate = search.trim() && !tags.some((t) => t.name.toLowerCase() === search.trim().toLowerCase());

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

  const selectedTags = tags.filter((t) => selected.includes(t.id));
  const sz = compact ? '0.68rem' : '0.75rem';

  return (
    <div style={{ position: 'relative' }}>
      {/* Selected badges + trigger */}
      <div
        ref={triggerRef}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.25rem',
          alignItems: 'center',
          cursor: 'pointer',
          padding: '0.3rem 0',
          minHeight: compact ? '24px' : '28px',
        }}
        onClick={(e) => {
          e.stopPropagation();
          updatePosition();
          setOpen((prev) => !prev);
        }}
      >
        {selectedTags.length > 0 ? (
          selectedTags.map((t) => (
            <span
              key={t.id}
              style={{
                fontSize: sz,
                padding: '0.12rem 0.45rem',
                borderRadius: '99px',
                background: `${t.color}20`,
                color: t.color,
                border: `1px solid ${t.color}40`,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <AppIcon name="tag" size={12} /> {t.name}
            </span>
          ))
        ) : (
          <span
            style={{
              fontSize: sz,
              color: 'var(--text-muted)',
              opacity: 0.85,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.12rem 0.45rem',
              borderRadius: '99px',
              border: '1px dashed var(--border-glass, rgba(255,255,255,0.15))',
            }}
          >
            + Tag
          </span>
        )}
      </div>

      {/* Dropdown qua createPortal */}
      {open && coords && createPortal(
        <div
          ref={popoverRef}
          className="tag-picker-popover"
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            zIndex: 999999,
            background: 'var(--bg-secondary, #1a1a2e)',
            border: '1px solid var(--border-glass, rgba(255,255,255,0.14))',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            boxShadow: '0 14px 40px rgba(0,0,0,0.45)',
            animation: 'fadeIn 0.15s ease',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search input */}
          <div style={{ padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border-glass, rgba(255,255,255,0.08))' }}>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tìm hoặc tạo tag..."
              style={{
                width: '100%',
                padding: '0.35rem 0.4rem',
                fontSize: '0.78rem',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Tag list */}
          <div style={{ maxHeight: '160px', overflowY: 'auto', padding: '0.25rem 0' }}>
            {filtered.map((t) => {
              const isSelected = selected.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onToggle(t.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    width: '100%',
                    padding: '0.35rem 0.6rem',
                    fontSize: '0.78rem',
                    background: isSelected ? 'rgba(139,92,246,0.12)' : 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.08)')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = isSelected ? 'rgba(139,92,246,0.12)' : 'transparent')
                  }
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: t.color,
                      flexShrink: 0,
                      border: isSelected ? '2px solid #fff' : 'none',
                    }}
                  />
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  width: '100%',
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.78rem',
                  background: 'rgba(6,182,212,0.08)',
                  border: 'none',
                  borderTop: '1px solid var(--border-glass, rgba(255,255,255,0.06))',
                  color: '#22d3ee',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                }}
              >
                + Tạo "{search.trim()}"
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

