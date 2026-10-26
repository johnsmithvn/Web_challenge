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
        onClick={e => e.stopPropagation()}
      >
        <div className="kb-palette__head">
          <div className="kb-palette__heading">Quản lý thẻ <span className="kb-palette__count">{tags.length}</span></div>
          <button className="kb-btn-ghost kb-btn-ghost--small" onClick={onClose}>Đóng <kbd className="kb-kbd">Esc</kbd></button>
        </div>

        <div className="kb-palette__list">
          {tags.length === 0 ? (
            <div className="kb-palette__empty">Chưa có thẻ nào</div>
          ) : (
            tags.map(t => (
              <div key={t.id || t.name} className="kb-palette__item">
                <span className="kb-dot" style={t.color ? { '--kb-topic': t.color } : undefined} />
                <span className="kb-palette__label">#{t.name}</span>
                {t.count !== undefined && <span className="kb-palette__count">{t.count} bài</span>}
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
        <div className="kb-palette__add">
          <input
            ref={inputRef}
            className="kb-input"
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
