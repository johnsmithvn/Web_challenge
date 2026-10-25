import { useRef, useEffect } from 'react';
import AppIcon from '../AppIcon';

/**
 * KBSidebar — cột trái của Knowledge: tìm, viết bài, chế độ xem, chủ đề.
 * Chủ đề lọc mọi kiểu xem. Điện thoại: CSS biến cột thành thanh trên + hàng cuộn ngang.
 */

const VIEW_ITEMS = [
  { key: 'overview', label: 'Tổng quan', icon: 'houseSimple', keys: 'G T' },
  { key: 'list',     label: 'Danh sách', icon: 'listBullets', keys: 'G L' },
  { key: 'gallery',  label: 'Gallery',   icon: 'squares',     keys: 'G Q' },
  { key: 'graph',    label: 'Sơ đồ',     icon: 'moonStars',   keys: 'G G' },
  { key: 'canvas',   label: 'Canvas',    icon: 'kanban',      keys: 'G C' },
];

function NavItem({ active, onClick, dot, label, count, title, dim = false, className = '' }) {
  return (
    <button
      className={`kb-side__item${active ? ' is-active' : ''}${dim ? ' is-dim' : ''} ${className}`}
      onClick={onClick}
      aria-pressed={active}
      title={title}
    >
      {dot}
      <span className="kb-side__label">{label}</span>
      <span className="kb-side__count">{count}</span>
    </button>
  );
}

export default function KBSidebar({
  view, onViewChange, search, onSearchChange,
  articleCount, linkCount, onNewArticle,
  topics, topicFilter, mineOnly, onTopicFilter, onOpenMine, topicCounts, mineCount,
  onManageTopics,
}) {
  const searchRef = useRef(null);

  // "/" nhảy vào ô tìm
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey &&
          !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) &&
          !e.target.isContentEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <aside className="kb-side">
      <div className="kb-side__brand">
        <h1 className="kb-side__title">Kho Tàng Kiến Thức</h1>
        <p className="kb-side__stats">{articleCount} bài · {linkCount} liên kết</p>
      </div>

      <div className="kb-side__actions">
        <label className="kb-search">
          <AppIcon name="search" size={15} />
          <input
            ref={searchRef}
            type="text"
            className="kb-search__input"
            placeholder="Tìm bài, #thẻ…"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            aria-label="Tìm bài viết"
          />
          {search
            ? <button className="kb-search__clear" onClick={() => onSearchChange('')} aria-label="Xoá tìm kiếm">✕</button>
            : <kbd className="kb-kbd">/</kbd>}
        </label>
        <button className="kb-btn-primary kb-side__new" onClick={onNewArticle}>
          <AppIcon name="plus" size={15} weight="bold" />
          <span>Viết bài mới</span>
        </button>
      </div>

      <nav className="kb-side__group" aria-label="Chế độ xem">
        <span className="kb-side__heading">Chế độ xem</span>
        <div className="kb-side__list">
          {VIEW_ITEMS.map(v => (
            <button
              key={v.key}
              className={`kb-side__item kb-side__item--view${view === v.key ? ' is-active' : ''}`}
              onClick={() => onViewChange(v.key)}
              aria-pressed={view === v.key}
            >
              <AppIcon name={v.icon} size={17} />
              <span className="kb-side__label">{v.label}</span>
              <kbd className="kb-side__keys">{v.keys}</kbd>
            </button>
          ))}
        </div>
      </nav>

      <nav className="kb-side__group" aria-label="Lọc theo chủ đề">
        <span className="kb-side__heading">
          Chủ đề
          <button className="kb-link" onClick={onManageTopics}>{topics.length ? 'Quản lý' : '＋ Tạo'}</button>
        </span>
        <div className="kb-side__list kb-side__list--topics">
          <NavItem
            active={!topicFilter && !mineOnly}
            onClick={() => onTopicFilter('')}
            dot={<span className="kb-side__dot kb-side__dot--all" />}
            label="Tất cả bài"
            count={topicCounts.all}
          />
          {topicCounts.none > 0 && (
            <NavItem
              active={topicFilter === 'none'}
              onClick={() => onTopicFilter(topicFilter === 'none' ? '' : 'none')}
              dot={<span className="kb-side__dot kb-side__dot--none" />}
              label="Chưa xếp"
              count={topicCounts.none}
              className="kb-side__item--unsorted"
            />
          )}
          {topics.map(t => {
            const n = topicCounts[t.id] || 0;
            return (
              <NavItem
                key={t.id}
                active={topicFilter === t.id}
                onClick={() => onTopicFilter(topicFilter === t.id ? '' : t.id)}
                dot={<span className="kb-side__dot" style={{ '--kb-topic': t.color }} />}
                label={t.name}
                count={n}
                title={t.description}
                dim={n === 0}
              />
            );
          })}
          {mineCount > 0 && (
            <NavItem
              active={mineOnly}
              onClick={onOpenMine}
              dot={<AppIcon name="pencil" size={13} className="kb-side__mine-icon" />}
              label="Ghi chú của tôi"
              count={mineCount}
            />
          )}
        </div>
      </nav>
    </aside>
  );
}
