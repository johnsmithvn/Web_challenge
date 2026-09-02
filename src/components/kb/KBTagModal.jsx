import { useState, useRef, useEffect } from 'react';

/**
 * KBTagModal — Quản lý thẻ cho Knowledge Base.
 */
export default function KBTagModal({
  open,
  onClose,
  tags,
  onAddTag,
  onDeleteTag,
}) {
  const [newTagName, setNewTagName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setNewTagName('');
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  if (!open) return null;

  const handleAdd = () => {
    if (!newTagName.trim()) return;
    onAddTag(newTagName.trim());
    setNewTagName('');
  };

  return (
    <div className="kb-overlay" onClick={onClose}>
      <div
        className="kb-palette"
        style={{ width: 'min(520px, 92vw)', marginTop: '12vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--kb-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--kb-mono)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--kb-faint)' }}>
            Quản lý thẻ · {tags.length}
          </div>
          <button className="kb-btn-ghost kb-btn-ghost--small" onClick={onClose}>esc</button>
        </div>

        <div className="kb-palette__list">
          {tags.length === 0 ? (
            <div className="kb-palette__empty">Chưa có thẻ nào</div>
          ) : (
            tags.map(t => (
              <div
                key={t.id || t.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '11px',
                  padding: '9px 18px',
                  borderBottom: '1px solid var(--kb-line)',
                }}
              >
                <span className="kb-badge__dot" style={{ background: t.color || 'var(--kb-dim)' }} />
                <span style={{ flex: 1, fontSize: '0.95rem', fontWeight: 500, color: 'var(--kb-tx)' }}>#{t.name}</span>
                {t.count !== undefined && (
                  <span style={{ fontFamily: 'var(--kb-mono)', fontSize: '0.78rem', color: 'var(--kb-faint)' }}>
                    {t.count} bài
                  </span>
                )}
                {onDeleteTag && (
                  <button
                    className="kb-btn-ghost kb-btn-ghost--small kb-btn-ghost--danger"
                    onClick={() => onDeleteTag(t)}
                    title="Xóa thẻ"
                  >
                    xóa
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Bottom add input */}
        <div style={{ borderTop: '1px solid var(--kb-line)', padding: '11px 18px', display: 'flex', gap: '8px' }}>
          <input
            ref={inputRef}
            className="kb-subheader__search-input"
            style={{ flex: 1 }}
            placeholder="Tên thẻ mới…"
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <button className="kb-btn-primary" onClick={handleAdd}>
            Thêm
          </button>
        </div>
      </div>
    </div>
  );
}
