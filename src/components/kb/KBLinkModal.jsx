import { useState, useRef, useEffect } from 'react';

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
        onClick={e => e.stopPropagation()}
      >
        <div className="kb-palette__head">
          <div>
            <div className="kb-palette__kicker">Liên kết bài viết</div>
            <div className="kb-palette__heading">{currentArticle?.title || 'Bài đang soạn'}</div>
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
                  <span className="kb-dot" style={a._topic ? { '--kb-topic': a._topic.color } : undefined} />
                  <span className="kb-palette__label">{a.title}</span>
                  <span className={`kb-palette__state${isLinked ? ' is-on' : ''}`}>
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
