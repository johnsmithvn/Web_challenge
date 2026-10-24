import { useRef, useEffect } from 'react';

/**
 * KBSubHeader — sub-header cố định cho Knowledge Base.
 * Hàng 1: tiêu đề, ô tìm kiếm, view switcher, nút bài mới.
 * Hàng 2: chip chủ đề — lọc mọi kiểu xem; "…" mở Quản lý chủ đề.
 */

const VIEW_ITEMS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'list',    label: 'Danh sách' },
  { key: 'gallery', label: 'Gallery' },
  { key: 'graph',   label: 'Sơ đồ' },
  { key: 'canvas',  label: 'Canvas' },
];

function TopicChip({ active, onClick, label, count, color, title, quiet = false }) {
  return (
    <button
      className={`kb-chip${quiet ? ' kb-chip--quiet' : ''}${active ? ' kb-chip--active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
      title={title}
    >
      {color && <span className="kb-chip__dot" style={{ background: color }} />}
      {label}
      <span className="kb-chip__count">{count}</span>
    </button>
  );
}

export default function KBSubHeader({
  view, onViewChange, search, onSearchChange,
  articleCount, onNewArticle,
  topics, topicFilter, onTopicFilter, topicCounts, onManageTopics,
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

      {/* Topic chips */}
      <nav className="kb-topic-row" aria-label="Lọc theo chủ đề">
        <TopicChip active={!topicFilter} onClick={() => onTopicFilter('')} label="Tất cả" count={topicCounts.all} />
        {topics.map(t => (
          <TopicChip
            key={t.id}
            active={topicFilter === t.id}
            onClick={() => onTopicFilter(topicFilter === t.id ? '' : t.id)}
            label={t.name}
            count={topicCounts[t.id] || 0}
            color={t.color}
            title={t.description}
          />
        ))}
        {topicCounts.none > 0 && (
          <TopicChip
            active={topicFilter === 'none'}
            onClick={() => onTopicFilter(topicFilter === 'none' ? '' : 'none')}
            label="Chưa xếp"
            count={topicCounts.none}
            quiet
          />
        )}
        <button className="kb-chip kb-chip--quiet" onClick={onManageTopics} title="Quản lý chủ đề">
          {topics.length === 0 ? '＋ Tạo chủ đề' : '⋯'}
        </button>
      </nav>
    </header>
  );
}
