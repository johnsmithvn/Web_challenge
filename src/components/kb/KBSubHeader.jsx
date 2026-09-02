import { useRef, useEffect } from 'react';

/**
 * KBSubHeader — sub-header cố định cho Knowledge Base.
 * Chứa: tiêu đề, ô tìm kiếm, view switcher, nút ⌘K, nút bài mới.
 */

const VIEW_ITEMS = [
  { key: 'list',    label: 'Danh sách' },
  { key: 'gallery', label: 'Gallery' },
  { key: 'graph',   label: 'Sơ đồ' },
  { key: 'canvas',  label: 'Canvas' },
];

export default function KBSubHeader({
  view, onViewChange, search, onSearchChange,
  articleCount, onNewArticle,
}) {
  const searchRef = useRef(null);

  // Focus search on "/" key (handled by parent, but also allow direct)
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey &&
          !['INPUT', 'TEXTAREA'].includes(e.target.tagName) &&
          !e.target.isContentEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <header className="kb-subheader">
      <div className="kb-subheader__inner">
        {/* Logo + count */}
        <div className="kb-subheader__left">
          <h1 className="kb-subheader__logo">
            Kho Tàng <em>Kiến Thức</em>
          </h1>
          <span className="kb-subheader__count kb-hide">
            {articleCount} bài
          </span>
        </div>

        {/* Spacer */}
        <div className="kb-subheader__spacer" />

        {/* Search */}
        <div className="kb-subheader__search">
          <span className="kb-subheader__search-icon">⌕</span>
          <input
            ref={searchRef}
            type="text"
            className="kb-subheader__search-input"
            placeholder="Tìm bài, nội dung, #thẻ"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            aria-label="Tìm bài viết"
          />
          <kbd className="kb-subheader__search-kbd">/</kbd>
        </div>

        {/* View switcher */}
        <div className="kb-segmented">
          {VIEW_ITEMS.map(v => (
            <button
              key={v.key}
              className={`kb-segmented__item${view === v.key ? ' kb-segmented__item--active' : ''}`}
              onClick={() => onViewChange(v.key)}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* New article */}
        <button className="kb-btn-primary" onClick={onNewArticle}>
          ＋ Bài mới
        </button>
      </div>
    </header>
  );
}
