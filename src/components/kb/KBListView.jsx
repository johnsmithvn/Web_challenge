import { useCallback, useState } from 'react';
import {
  KIND_META, contentKind, itemPlainText, readTime, safeHostname, parseWikiLinks,
} from '../../utils/kbDeriveUtils';
import { formatDate } from '../../utils/dateUtils';
import { useToast } from '../../contexts/ToastContext';
import AppIcon from '../AppIcon';
import ActionMenu from '../ActionMenu';
import KBTopicPicker from './KBTopicPicker';

/**
 * KBListView — Danh sách (4a): phần đầu chủ đề, một hàng Nhóm theo · Có liên kết · sắp xếp · Chọn,
 * nhóm thu gọn được, thẻ bài, thanh chọn nhiều nổi ở đáy.
 * Menu thao tác của bài (ActionMenu): nút ⋯ hiện khi rê vào thẻ, hoặc chuột phải vào thẻ.
 * Chống nhảy: hàng thẻ đếm theo phạm vi (tagCounts từ CollectPage), nút bật / tắt không đổi chữ.
 * Lọc / nhóm do CollectPage tính (groups) để J/K và ↑↓ ở trang đọc đi đúng thứ tự đang hiện.
 */

const SORT_ITEMS = [
  { key: 'new', label: 'Mới nhất' },
  { key: 'old', label: 'Cũ nhất' },
  { key: 'long', label: 'Dài nhất' },
];

const GROUP_ITEMS = [
  { key: 'month', label: 'Tháng' },
  { key: 'topic', label: 'Chủ đề' },
  { key: 'none', label: 'Không' },
];

/* ── Row ───────────────────────────────────────────────────── */
function ListRow({ item, showTopic, isCursor, isBulk, isChecked, isMenuOpen, onToggleCheck, onClick, onMenu }) {
  const kind = KIND_META[contentKind(item)];
  const topic = item._topic;
  const plainText = itemPlainText(item);
  const mins = item.word_count ? Math.max(1, Math.ceil(item.word_count / 220)) : readTime(plainText);
  const tags = item._tags || [];
  const linkCount = parseWikiLinks(item.body || '').length;
  const taskCount = item._linkedTaskCount || 0;
  const noteCount = item._noteCount || 0;

  return (
    <article
      className={`kb-row${isCursor ? ' kb-row--cursor' : ''}${isChecked ? ' kb-row--picked' : ''}${isMenuOpen ? ' is-menu' : ''}`}
      onClick={() => (isBulk ? onToggleCheck(item.id) : onClick(item))}
      onContextMenu={e => {
        if (isBulk) return;
        e.preventDefault();
        onMenu(item, e.clientX, e.clientY);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && e.target === e.currentTarget && onClick(item)}
    >
      {isBulk && (
        <input
          type="checkbox"
          className="kb-check"
          checked={isChecked}
          onChange={() => onToggleCheck(item.id)}
          onClick={e => e.stopPropagation()}
          aria-label={`Chọn ${item.title}`}
        />
      )}

      <span className="kb-row__icon"><AppIcon name={kind.icon} size={16} /></span>

      <div className="kb-row__content">
        <div className="kb-row__meta">
          {showTopic && (topic
            ? <span style={{ color: topic.color }}>{topic.name}</span>
            : <span className="kb-row__unsorted">Chưa xếp</span>)}
          <span>{kind.label}</span>
          {item.url && <span>{safeHostname(item.url)}</span>}
          <span>{formatDate(item.created_at)}</span>
          <span>{mins} phút</span>
          {tags.map(t => <span key={t.id || t.name} className="kb-row__tag">#{t.name}</span>)}
        </div>
        <h3 className="kb-row__title">{item.title}</h3>
        {plainText && <p className="kb-row__excerpt">{plainText.slice(0, 220)}</p>}
      </div>

      <div className="kb-row__side">
        {linkCount > 0 && <span className="kb-pill" title={`${linkCount} liên kết [[wiki]]`}>↔ {linkCount}</span>}
        {taskCount > 0 && <span className="kb-pill kb-pill--task" title={`${taskCount} nhiệm vụ`}>◇ {taskCount}</span>}
        {noteCount > 0 && <span className="kb-pill" title={`${noteCount} ghi chú`}>✎ {noteCount}</span>}
        {!isBulk && (
          <span className="kb-row__actions">
            <button
              className="kb-icon-btn"
              // Không cho pointerdown tới window: menu đang mở thì bấm lại ⋯ là đóng (không đóng rồi mở lại)
              onPointerDown={e => e.stopPropagation()}
              onClick={e => {
                e.stopPropagation();
                const r = e.currentTarget.getBoundingClientRect();
                onMenu(item, r.left, r.bottom + 4, true);
              }}
              title="Thao tác"
              aria-label={`Thao tác với ${item.title}`}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
            >
              <AppIcon name="dots" size={16} weight="bold" />
            </button>
          </span>
        )}
      </div>
    </article>
  );
}

/* ── Topic header ──────────────────────────────────────────── */
function TopicHeader({ heading, tags, tagCounts, activeTagIds, onToggleTag, onManageTags, onManageTopics, onQuickSort }) {
  return (
    <header className="kb-topic-head" style={heading.color ? { '--kb-topic': heading.color } : undefined}>
      <div className="kb-topic-head__top">
        <div className="kb-topic-head__text">
          <div className="kb-topic-head__line">
            <h2 className="kb-topic-head__name">{heading.name}</h2>
            <span className="kb-topic-head__count">{heading.count} bài</span>
          </div>
          {heading.description && <p className="kb-topic-head__desc">{heading.description}</p>}
        </div>
        <div className="kb-topic-head__btns">
          {heading.kind === 'none' && <button className="kb-btn-soft" onClick={onQuickSort}>Xếp nhanh</button>}
          {(heading.kind === 'topic' || heading.kind === 'all') && (
            <button className="kb-btn-ghost" onClick={onManageTopics}>Quản lý chủ đề</button>
          )}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="kb-tag-row">
          {tags.map(t => (
            <button
              key={t.id}
              className={`kb-tag-chip${activeTagIds.includes(t.id) ? ' is-active' : ''}`}
              onClick={() => onToggleTag(t.id)}
              aria-pressed={activeTagIds.includes(t.id)}
            >
              #{t.name}
              {tagCounts[t.id] > 0 && <span className="kb-tag-chip__count">{tagCounts[t.id]}</span>}
            </button>
          ))}
          <button className="kb-link" onClick={onManageTags}>Quản lý thẻ</button>
        </div>
      )}
    </header>
  );
}

/* ── Segmented (pill group) ────────────────────────────────── */
function Segmented({ items, value, onChange, label, quiet = false }) {
  return (
    <div className={`kb-seg${quiet ? ' kb-seg--quiet' : ''}`} role="group" aria-label={label}>
      {items.map(i => (
        <button
          key={i.key}
          className={`kb-seg__item${value === i.key ? ' is-active' : ''}`}
          onClick={() => onChange(i.key)}
          aria-pressed={value === i.key}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

/* ── KBListView ────────────────────────────────────────────── */
export default function KBListView({
  groups, total, scopeTags, tagCounts, topics, heading, unsortedCount,
  onManageTopics, onManageTags, onQuickSort, onNewArticle,
  cursorId, activeTagIds, onToggleTag,
  linkedOnly, onToggleLinked, groupBy, onGroupBy, sort, onSort,
  bulk, onToggleBulk, picked, onTogglePick, onSelectAll, onDeselectAll, onBulkAssign, onBulkDelete,
  onOpenReader, onOpenEditor, onDelete, onAssignTopic, onCreateTask,
  filtering, onClearFilter,
}) {
  const { showToast } = useToast();
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [assigning, setAssigning] = useState(false);
  const [menu, setMenu] = useState(null); // { item, x, y, step: 'main' | 'topic' }

  // toggle (nút ⋯): bấm lại đúng bài đang mở menu thì đóng; chuột phải luôn mở tại chỗ con trỏ
  const openMenu = (item, x, y, toggle = false) =>
    setMenu(m => (toggle && m?.item.id === item.id ? null : { item, x, y, step: 'main' }));
  const closeMenu = useCallback(() => setMenu(null), []);

  const copyWikiLink = async (item) => {
    const link = `[[${item.title}]]`;
    try {
      await navigator.clipboard.writeText(link);
      showToast(`Đã chép ${link}`);
    } catch {
      showToast('Không chép được. Thử lại.');
    }
  };

  const menuItems = !menu ? [] : menu.step === 'topic'
    ? [
      { key: 'back', icon: 'caretLeft', label: 'Chuyển chủ đề', keepOpen: true, onSelect: () => setMenu(m => ({ ...m, step: 'main' })) },
      ...[...topics, { id: null, name: 'Chưa xếp', color: 'var(--kb-gold)' }].map((t, i) => ({
        key: t.id || 'none',
        divider: i === 0,
        icon: <span className="kb-dot" style={{ '--kb-topic': t.color }} />,
        label: t.name,
        checked: (menu.item.topic_id || null) === t.id,
        onSelect: () => onAssignTopic(menu.item, t.id),
      })),
    ]
    : [
      { key: 'edit', icon: 'pencil', label: 'Sửa', onSelect: () => onOpenEditor(menu.item) },
      { key: 'topic', icon: 'folder', label: 'Chuyển chủ đề', sub: true, onSelect: () => setMenu(m => ({ ...m, step: 'topic' })) },
      { key: 'task', icon: 'plusCircle', label: 'Tạo việc từ bài', onSelect: () => onCreateTask(menu.item) },
      { key: 'wiki', icon: 'linkSimple', label: 'Chép [[liên kết]]', onSelect: () => copyWikiLink(menu.item) },
      { key: 'delete', icon: 'trash', label: 'Xoá', danger: true, divider: true, onSelect: () => onDelete(menu.item) },
    ];

  // Thẻ có trong phạm vi; thẻ đang bật luôn còn chip để tắt
  const tags = scopeTags.filter(t => tagCounts[t.id] > 0 || activeTagIds.includes(t.id));

  const toggleGroup = key => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const showTopic = heading.kind === 'all' && groupBy !== 'topic';
  const allPicked = total > 0 && picked.length >= total;

  return (
    <div className="kb-list-view" style={{ animation: 'kb-in .22s ease' }}>
      <TopicHeader
        heading={heading}
        tags={tags}
        tagCounts={tagCounts}
        activeTagIds={activeTagIds}
        onToggleTag={onToggleTag}
        onManageTags={onManageTags}
        onManageTopics={onManageTopics}
        onQuickSort={onQuickSort}
      />

      {(total > 0 || filtering) && (
        <div className="kb-list-toolbar">
          <span className="kb-list-toolbar__label">Nhóm theo</span>
          <Segmented items={GROUP_ITEMS} value={groupBy} onChange={onGroupBy} label="Nhóm theo" quiet />
          <div className="kb-seg kb-seg--quiet">
            <button
              className={`kb-seg__item${linkedOnly ? ' is-active' : ''}`}
              onClick={onToggleLinked}
              aria-pressed={linkedOnly}
              title="Chỉ bài có liên kết [[wiki]] tới bài khác hoặc được trỏ về"
            >
              Có liên kết
            </button>
          </div>
          {filtering && (
            <span className="kb-list-toolbar__result">
              {total} kết quả · <button className="kb-link" onClick={onClearFilter}>Xoá lọc</button>
            </span>
          )}
          <span className="kb-spacer" />
          <Segmented items={SORT_ITEMS} value={sort} onChange={onSort} label="Sắp xếp" quiet />
          <button className={`kb-btn-ghost${bulk ? ' kb-btn-ghost--active' : ''}`} onClick={() => { setAssigning(false); onToggleBulk(); }} aria-pressed={bulk}>
            <span className="kb-btn-ghost__box" aria-hidden="true" />
            Chọn
          </button>
        </div>
      )}

      {total === 0 ? (
        filtering ? (
          <div className="kb-empty">
            <h3 className="kb-empty__title">Không có bài nào khớp</h3>
            <p className="kb-empty__desc">Thử bỏ bớt bộ lọc hoặc đổi từ khoá.</p>
            <button className="kb-btn-soft" onClick={onClearFilter}>Xoá lọc</button>
          </div>
        ) : (
          <div className="kb-empty">
            <div className="kb-empty__stars" aria-hidden="true">
              <span /><span className="kb-orb" /><span />
            </div>
            <h3 className="kb-empty__title">
              {heading.kind === 'topic' ? `Chưa có bài nào trong ${heading.name}` : 'Chưa có bài nào ở đây'}
            </h3>
            {heading.kind === 'topic' && (
              <p className="kb-empty__desc">Xếp bài từ mục Chưa xếp vào đây, hoặc viết bài mới ngay trong chủ đề này.</p>
            )}
            <div className="kb-empty__btns">
              {heading.kind === 'topic' && unsortedCount > 0 && (
                <button className="kb-btn-soft" onClick={onQuickSort}>Xếp nhanh · {unsortedCount} bài chờ</button>
              )}
              <button className="kb-btn-ghost" onClick={onNewArticle}>Viết bài mới</button>
            </div>
          </div>
        )
      ) : (
        <div className="kb-groups">
          {groups.map(g => {
            const open = !collapsed.has(g.key);
            return (
              <section key={g.key} className="kb-group">
                {g.label && (
                  <button className={`kb-group__head${open ? '' : ' is-closed'}`} onClick={() => toggleGroup(g.key)} aria-expanded={open}>
                    <AppIcon name="caretDown" size={12} weight="bold" className="kb-group__caret" />
                    {g.color && <span className="kb-dot" style={{ '--kb-topic': g.color }} />}
                    {g.label}
                    <span className="kb-group__count">{g.items.length}</span>
                    <span className="kb-group__line" />
                  </button>
                )}
                {open && (
                  <div className="kb-rows">
                    {g.items.map(item => (
                      <ListRow
                        key={item.id}
                        item={item}
                        showTopic={showTopic}
                        isCursor={item.id === cursorId}
                        isBulk={bulk}
                        isChecked={picked.includes(item.id)}
                        isMenuOpen={menu?.item.id === item.id}
                        onToggleCheck={onTogglePick}
                        onClick={onOpenReader}
                        onMenu={openMenu}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {menu && (
        <ActionMenu
          key={menu.step}
          at={menu}
          items={menuItems}
          onClose={closeMenu}
          label={`Thao tác với ${menu.item.title}`}
        />
      )}

      {/* Thanh chọn nhiều — nổi ở đáy vùng cuộn */}
      {bulk && (
        <div className="kb-bulk">
          {assigning && picked.length > 0 && (
            <div className="kb-bulk__pop">
              <span className="kb-bulk__pop-label">Chuyển {picked.length} bài vào</span>
              <KBTopicPicker
                topics={topics}
                value={undefined}
                onChange={id => { setAssigning(false); onBulkAssign(id); }}
              />
            </div>
          )}
          <div className="kb-bulk__bar">
            <span className="kb-bulk__count">Đã chọn {picked.length}</span>
            <button className="kb-bulk__btn" onClick={allPicked ? onDeselectAll : onSelectAll}>
              {allPicked ? 'Bỏ chọn hết' : 'Chọn tất cả'}
            </button>
            <button
              className={`kb-bulk__btn${assigning ? ' is-on' : ''}`}
              onClick={() => setAssigning(a => !a)}
              disabled={picked.length === 0}
              aria-expanded={assigning}
            >
              Gán chủ đề
            </button>
            <button className="kb-bulk__btn kb-bulk__btn--danger" onClick={onBulkDelete} disabled={picked.length === 0}>Xoá</button>
            <button className="kb-bulk__close" onClick={onToggleBulk} title="Thôi chọn (Esc)" aria-label="Thôi chọn">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
