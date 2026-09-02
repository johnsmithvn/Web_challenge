import { useState, useRef, useEffect } from 'react';
import { TYPE_GLYPHS } from '../../utils/kbDeriveUtils';

/**
 * KBLinkModal — Modal liên kết bài viết.
 * Hiển thị danh sách các bài viết có thể nối `[[...]]`.
 */
export default function KBLinkModal({
  open,
  onClose,
  currentArticle,
  allArticles,
  onToggleLink,
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  if (!open) return null;

  const currentBody = currentArticle?.body || '';

  const filtered = allArticles.filter(a =>
    a.id !== currentArticle?.id &&
    (!query || a.title.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="kb-overlay" onClick={onClose}>
      <div
        className="kb-palette"
        style={{ width: 'min(560px, 92vw)', marginTop: '13vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--kb-line)' }}>
          <div style={{ fontFamily: 'var(--kb-mono)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--kb-faint)' }}>
            Liên kết bài viết
          </div>
          <div style={{ fontFamily: 'var(--kb-serif)', fontSize: '1.2rem', fontWeight: 500, marginTop: '6px', color: 'var(--kb-tx)' }}>
            {currentArticle?.title || 'Bài đang soạn'}
          </div>
        </div>

        <input
          ref={inputRef}
          className="kb-palette__input"
          placeholder="Tìm bài để nối…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        <div className="kb-palette__list">
          {filtered.length === 0 ? (
            <div className="kb-palette__empty">Không tìm thấy bài viết</div>
          ) : (
            filtered.map(a => {
              const meta = TYPE_GLYPHS[a.type] || TYPE_GLYPHS.note;
              const isLinked = currentBody.includes(`[[${a.title}]]`);
              return (
                <button
                  key={a.id}
                  className="kb-palette__row"
                  onClick={() => {
                    onToggleLink(a);
                    onClose();
                  }}
                >
                  <span className="kb-badge__dot" style={{ background: `var(${meta.hueVar})` }} />
                  <span className="kb-palette__label">{a.title}</span>
                  <span
                    style={{
                      fontFamily: 'var(--kb-mono)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '.06em',
                      color: isLinked ? 'var(--kb-brass)' : 'var(--kb-faint)',
                    }}
                  >
                    {isLinked ? 'đã nối' : 'nối'}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="kb-palette__footer">
          <span>esc đóng</span>
        </div>
      </div>
    </div>
  );
}
