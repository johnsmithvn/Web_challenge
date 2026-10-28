import { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../AppIcon';
import { KBTopicSelect } from './KBTopicPicker';

/**
 * KBSidebar — cột trái của Knowledge: tìm, viết bài, chế độ xem, chủ đề.
 * Chủ đề lọc mọi kiểu xem. Máy tính bảng hẹp (≤860px): CSS biến cột thành thanh trên + hàng cuộn ngang.
 * Điện thoại (isMobile, ≤768px): một hàng trên trong suốt (tìm · viên chủ đề · viết) + tab đáy riêng
 * (Home · 5 kiểu xem) như Finance; thanh Life Hub + tab đáy chung của app ẩn ở /collect.
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

function SearchBox({ inputRef, search, onSearchChange }) {
  return (
    <label className="kb-search">
      <AppIcon name="search" size={15} />
      <input
        ref={inputRef}
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
  );
}

export default function KBSidebar({ isMobile,
  view, onViewChange, search, onSearchChange,
  articleCount, linkCount, onNewArticle,
  topics, topicFilter, onTopicFilter, topicCounts,
  trashCount, trashOpen, onOpenTrash, onManageTopics,
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

  if (isMobile) {
    return (
      <>
        <header className="kb-mbar">
          <SearchBox inputRef={searchRef} search={search} onSearchChange={onSearchChange} />
          {/* 'all' = Tất cả bài (topicFilter ''), 'none' = Chưa xếp, 'trash' = Thùng rác */}
          <KBTopicSelect
            options={[
              { value: 'all', label: 'Tất cả bài' },
              ...(topicCounts.none > 0 || topicFilter === 'none' ? [{ value: 'none', label: 'Chưa xếp', color: 'var(--kb-gold)' }] : []),
              ...topics.map(t => ({ value: t.id, label: t.name, color: t.color })),
              ...(trashCount > 0 || trashOpen ? [{ value: 'trash', label: 'Thùng rác', color: 'var(--kb-faint)' }] : []),
            ]}
            value={trashOpen ? 'trash' : topicFilter || 'all'}
            onChange={v => (v === 'trash' ? onOpenTrash() : onTopicFilter(v === 'all' ? '' : v))}
            ariaLabel="Chủ đề"
          />
          <button className="kb-btn-primary kb-mbar__new" onClick={onNewArticle} title="Viết bài mới" aria-label="Viết bài mới">
            <AppIcon name="plus" size={18} weight="bold" />
          </button>
        </header>

        <nav className="kb-tabbar" aria-label="Chế độ xem">
          <Link to="/" className="kb-tabbar__item kb-tabbar__item--home" title="Về Life Hub" aria-label="Về Life Hub">
            <AppIcon name="house" size={20} />
          </Link>
          {VIEW_ITEMS.map(v => (
            <button
              key={v.key}
              className={`kb-tabbar__item${view === v.key ? ' is-active' : ''}`}
              onClick={() => onViewChange(v.key)}
              aria-pressed={view === v.key}
            >
              <AppIcon name={v.icon} size={20} weight={view === v.key ? 'fill' : 'regular'} />
              <span>{v.label}</span>
            </button>
          ))}
        </nav>
      </>
    );
  }

  return (
    <aside className="kb-side">
      <div className="kb-side__brand">
        <h1 className="kb-side__title">Kho Tàng <em className="kb-em">Kiến Thức</em></h1>
        <p className="kb-side__stats">{articleCount} bài · {linkCount} liên kết</p>
      </div>

      <div className="kb-side__actions">
        <SearchBox inputRef={searchRef} search={search} onSearchChange={onSearchChange} />
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
            active={!topicFilter && !trashOpen}
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
          {(trashCount > 0 || trashOpen) && (
            <NavItem
              active={trashOpen}
              onClick={onOpenTrash}
              dot={<AppIcon name="trash" size={13} className="kb-side__trash-icon" />}
              label="Thùng rác"
              count={trashCount}
            />
          )}
        </div>
      </nav>
    </aside>
  );
}
