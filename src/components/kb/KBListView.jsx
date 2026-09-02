import { useMemo } from 'react';
import { TYPE_GLYPHS, readTime, isTiptapBody, tiptapToPlainText, markdownToPlainText, safeHostname, parseWikiLinks } from '../../utils/kbDeriveUtils';
import { formatDate } from '../../utils/dateUtils';

/* ── Sort segmented ────────────────────────────────────────── */
const SORT_ITEMS = [
  { key: 'new', label: 'Mới nhất' },
  { key: 'old', label: 'Cũ nhất' },
  { key: 'long', label: 'Dài nhất' },
];

/* ── ListRow — single article row ──────────────────────────── */
function ListRow({ item, isCursor, isBulk, isChecked, onToggleCheck, onClick, onEdit, onDelete }) {
  const meta = TYPE_GLYPHS[item.type] || TYPE_GLYPHS.note;
  const isTiptap = isTiptapBody(item);

  let plainText = item.body_text || '';
  if (!plainText && isTiptap) plainText = tiptapToPlainText(item.body);
  else if (!plainText) plainText = markdownToPlainText(item.body || '');

  const mins = item.word_count ? Math.max(1, Math.ceil(item.word_count / 220)) : readTime(plainText);
  const excerpt = plainText.slice(0, 200);
  const tags = item._tags || [];
  const linkCount = parseWikiLinks(item.body || '').length;
  const taskCount = item._linkedTaskCount || 0;
  const noteCount = item._noteCount || 0;

  return (
    <article
      className={`kb-row${isCursor ? ' kb-row--cursor' : ''}`}
      onClick={() => onClick(item)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick(item)}
    >
      {isBulk && (
        <label className="kb-row__check" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => onToggleCheck(item.id)}
            className="kb-row__checkbox"
          />
          {isChecked && <span className="kb-row__checkmark">✓</span>}
        </label>
      )}

      {/* Icon box */}
      <div className="kb-row__icon" style={{ color: `var(${meta.hueVar})`, borderColor: isCursor ? 'var(--kb-brass)' : undefined }}>
        {meta.glyph}
      </div>

      {/* Content */}
      <div className="kb-row__content">
        {/* Metadata line */}
        <div className="kb-row__meta">
          <span style={{ color: `var(${meta.hueVar})` }}>{meta.label}</span>
          {item.url && <><span className="kb-row__sep">·</span><span>{safeHostname(item.url)}</span></>}
          <span className="kb-row__sep">·</span>
          <span>{formatDate(item.created_at)}</span>
          <span className="kb-row__sep">·</span>
          <span>{mins} phút</span>
        </div>

        {/* Title */}
        <h3 className="kb-row__title">{item.title}</h3>

        {/* Excerpt */}
        {excerpt && (
          <p className="kb-row__excerpt">
            {excerpt}{plainText.length > 200 ? '…' : ''}
          </p>
        )}

        {/* Badges */}
        <div className="kb-row__badges">
          {tags.map(t => {
            const name = typeof t === 'string' ? t : t.name;
            const color = typeof t === 'string' ? 'var(--kb-dim)' : (t.color || 'var(--kb-dim)');
            return (
              <span key={name} className="kb-badge kb-badge--tag">
                <span className="kb-badge__dot" style={{ background: color }} />
                {name}
              </span>
            );
          })}
          {linkCount > 0 && (
            <span className="kb-badge kb-badge--link">↔ {linkCount} liên kết</span>
          )}
          {taskCount > 0 && (
            <span className="kb-badge kb-badge--task">◇ {taskCount} nhiệm vụ</span>
          )}
          {noteCount > 0 && (
            <span className="kb-badge kb-badge--note">✎ {noteCount} ghi chú</span>
          )}
        </div>
      </div>

      {/* Action buttons (desktop) */}
      <div className="kb-row__actions kb-hide">
        <button className="kb-row__action-btn" onClick={e => { e.stopPropagation(); onEdit(item); }} title="Sửa">✎</button>
        <button className="kb-row__action-btn kb-row__action-btn--danger" onClick={e => { e.stopPropagation(); onDelete(item); }} title="Xóa">⌫</button>
      </div>
    </article>
  );
}

/* ── KBListView ────────────────────────────────────────────── */
export default function KBListView({
  articles, allTags, cursor,
  typeFilter, onTypeFilter,
  activeTagIds, onToggleTag,
  sort, onSort,
  bulk, onToggleBulk, picked, onTogglePick, onSelectAll, onDeselectAll,
  onBulkTag, onBulkDelete,
  onOpenReader, onOpenEditor, onDelete,
  hasFilter, onClearFilter,
}) {
  // Type counts based on current filtered set (before type filter)
  const typeCounts = useMemo(() => {
    const counts = {};
    articles.forEach(a => {
      if (a.type !== 'inbox' && a.status !== 'archived') {
        counts[a.type] = (counts[a.type] || 0) + 1;
      }
    });
    return counts;
  }, [articles]);

  const totalCount = Object.values(typeCounts).reduce((s, n) => s + n, 0);

  // Tag counts for display
  const tagCounts = useMemo(() => {
    const counts = {};
    articles.forEach(a => {
      if (a.type === 'inbox' || a.status === 'archived') return;
      (a._tags || []).forEach(t => {
        const id = typeof t === 'string' ? t : t.id;
        counts[id] = (counts[id] || 0) + 1;
      });
    });
    return counts;
  }, [articles]);

  return (
    <div className="kb-list-view" style={{ animation: 'kb-in .22s ease' }}>
      {/* Type filter row */}
      <div className="kb-type-row">
        <div className="kb-type-chips">
          <button
            className={`kb-type-chip${!typeFilter ? ' kb-type-chip--active' : ''}`}
            onClick={() => onTypeFilter('')}
          >
            Tất cả <span className="kb-type-chip__count">{totalCount}</span>
          </button>
          {Object.entries(TYPE_GLYPHS).map(([key, meta]) => {
            const count = typeCounts[key] || 0;
            if (count === 0) return null;
            return (
              <button
                key={key}
                className={`kb-type-chip${typeFilter === key ? ' kb-type-chip--active' : ''}`}
                onClick={() => onTypeFilter(typeFilter === key ? '' : key)}
              >
                <span className="kb-type-chip__dot" style={{ background: `var(${meta.hueVar})` }} />
                {meta.label}
                <span className="kb-type-chip__count">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Sort segmented */}
        <div className="kb-segmented kb-segmented--small">
          {SORT_ITEMS.map(s => (
            <button
              key={s.key}
              className={`kb-segmented__item${sort === s.key ? ' kb-segmented__item--active' : ''}`}
              onClick={() => onSort(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Bulk toggle */}
        <button
          className={`kb-btn-ghost kb-btn-ghost--small${bulk ? ' kb-btn-ghost--active' : ''}`}
          onClick={onToggleBulk}
        >
          {bulk ? '✕ Thoát' : '☐ Chọn'}
        </button>
      </div>

      {/* Tag filter row */}
      {allTags.length > 0 && (
        <div className="kb-tag-row">
          <span className="kb-tag-row__label">Thẻ</span>
          {allTags.map(t => (
            <button
              key={t.id}
              className={`kb-tag-chip${activeTagIds.includes(t.id) ? ' kb-tag-chip--active' : ''}`}
              onClick={() => onToggleTag(t.id)}
            >
              <span className="kb-badge__dot" style={{ background: t.color || 'var(--kb-dim)' }} />
              {t.name}
              {tagCounts[t.id] > 0 && <span className="kb-tag-chip__count">{tagCounts[t.id]}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Active filter bar */}
      {hasFilter && (
        <div className="kb-filter-bar">
          <span className="kb-filter-bar__text">Bộ lọc đang bật</span>
          <button className="kb-filter-bar__clear" onClick={onClearFilter}>
            Xóa lọc · Esc
          </button>
        </div>
      )}

      {/* Bulk action bar */}
      {bulk && (
        <div className="kb-bulk-bar">
          <button className="kb-btn-ghost kb-btn-ghost--small" onClick={picked.length >= articles.length ? onDeselectAll : onSelectAll}>
            {picked.length >= articles.length ? 'Bỏ chọn' : 'Chọn tất cả'}
          </button>
          <span className="kb-bulk-bar__count">đã chọn {picked.length}</span>
          <div className="kb-bulk-bar__spacer" />
          {picked.length > 0 && (
            <>
              <button className="kb-btn-ghost kb-btn-ghost--small" onClick={onBulkTag}>Gắn thẻ</button>
              <button className="kb-btn-ghost kb-btn-ghost--small kb-btn-ghost--danger" onClick={onBulkDelete}>
                Xóa {picked.length}
              </button>
            </>
          )}
        </div>
      )}

      {/* Article list */}
      <div className="kb-rows">
        {articles.length === 0 ? (
          <div className="kb-empty-state">
            <span className="kb-empty-state__icon">◌</span>
            <h2 className="kb-empty-state__title">Không có bài nào khớp</h2>
            <p className="kb-empty-state__desc">Thử bỏ một thẻ, hoặc xóa từ khóa tìm kiếm.</p>
            <button className="kb-btn-ghost" onClick={onClearFilter}>Xóa mọi bộ lọc</button>
          </div>
        ) : (
          articles.map((item, idx) => (
            <ListRow
              key={item.id}
              item={item}
              isCursor={idx === cursor}
              isBulk={bulk}
              isChecked={picked.includes(item.id)}
              onToggleCheck={onTogglePick}
              onClick={onOpenReader}
              onEdit={onOpenEditor}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
