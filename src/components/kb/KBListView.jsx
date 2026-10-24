import { useMemo, useState } from 'react';
import {
  KIND_META, PROGRESS_META, contentKind, progressOf, itemPlainText, readTime, safeHostname, parseWikiLinks,
} from '../../utils/kbDeriveUtils';
import { formatDate } from '../../utils/dateUtils';
import KBTopicPicker from './KBTopicPicker';

/* ── Sort segmented ────────────────────────────────────────── */
const SORT_ITEMS = [
  { key: 'new', label: 'Mới nhất' },
  { key: 'old', label: 'Cũ nhất' },
  { key: 'long', label: 'Dài nhất' },
];

/* ── ListRow — single article row ──────────────────────────── */
function ListRow({ item, pendingTaskIds, isCursor, isBulk, isChecked, onToggleCheck, onClick, onEdit, onDelete }) {
  const kind = KIND_META[contentKind(item)];
  const topic = item._topic;
  const progress = PROGRESS_META[progressOf(item, pendingTaskIds)];

  const plainText = itemPlainText(item);
  const mins = item.word_count ? Math.max(1, Math.ceil(item.word_count / 220)) : readTime(plainText);
  const excerpt = plainText.slice(0, 200);
  const tags = item._tags || [];
  const linkCount = parseWikiLinks(item.body || '').length;

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

      {/* Kind mark, tinted with the topic colour */}
      <div className="kb-row__icon" style={{ color: topic?.color || 'var(--kb-faint)', borderColor: isCursor ? 'var(--kb-brass)' : undefined }}>
        {kind.glyph}
      </div>

      {/* Content */}
      <div className="kb-row__content">
        <div className="kb-row__meta">
          {topic
            ? <span style={{ color: topic.color }}>{topic.name}</span>
            : <span>Chưa xếp</span>}
          <span className="kb-row__sep">·</span>
          <span>{kind.label}</span>
          {item.url && <><span className="kb-row__sep">·</span><span>{safeHostname(item.url)}</span></>}
          <span className="kb-row__sep">·</span>
          <span>{formatDate(item.created_at)}</span>
          <span className="kb-row__sep">·</span>
          <span>{mins} phút</span>
        </div>

        <h3 className="kb-row__title">{item.title}</h3>

        {excerpt && (
          <p className="kb-row__excerpt">
            {excerpt}{plainText.length > 200 ? '…' : ''}
          </p>
        )}

        <div className="kb-row__badges">
          {progress && (
            <span className={`kb-badge kb-badge--${progress.tone}`}>{progress.glyph} {progress.label}</span>
          )}
          {tags.map(t => (
            <span key={t.id || t.name} className="kb-badge kb-badge--tag">
              <span className="kb-badge__dot" style={{ background: t.color || 'var(--kb-dim)' }} />
              {t.name}
            </span>
          ))}
          {linkCount > 0 && (
            <span className="kb-badge kb-badge--link">↔ {linkCount} liên kết</span>
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
  articles, allTags, topics, heading, onManageTopics, pendingTaskIds, cursor,
  activeTagIds, onToggleTag,
  sort, onSort,
  bulk, onToggleBulk, picked, onTogglePick, onSelectAll, onDeselectAll,
  onBulkTag, onBulkAssign, onBulkDelete,
  onOpenReader, onOpenEditor, onDelete,
  hasFilter, onClearFilter,
}) {
  const [assigning, setAssigning] = useState(false);

  // Tag counts within the current list
  const tagCounts = useMemo(() => {
    const counts = {};
    articles.forEach(a => (a._tags || []).forEach(t => { counts[t.id] = (counts[t.id] || 0) + 1; }));
    return counts;
  }, [articles]);

  return (
    <div className="kb-list-view" style={{ animation: 'kb-in .22s ease' }}>
      {/* Heading: topic page, or a preset (Đọc dở / Ghi chú của tôi) */}
      {heading && (
        <div className="kb-topic-head">
          <div className="kb-topic-head__text">
            <h2 className="kb-topic-head__name">
              {heading.color && <span className="kb-chip__dot" style={{ background: heading.color }} />}
              {heading.name}
            </h2>
            {heading.description && <p className="kb-topic-head__desc">{heading.description}</p>}
          </div>
          {heading.manage && (
            <button className="kb-btn-ghost kb-btn-ghost--small" onClick={onManageTopics} title="Quản lý chủ đề">⋯</button>
          )}
        </div>
      )}

      {/* Sort + bulk */}
      <div className="kb-list-toolbar">
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

        <button
          className={`kb-btn-ghost kb-btn-ghost--small${bulk ? ' kb-btn-ghost--active' : ''}`}
          onClick={() => { setAssigning(false); onToggleBulk(); }}
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
              <button
                className={`kb-btn-ghost kb-btn-ghost--small${assigning ? ' kb-btn-ghost--active' : ''}`}
                onClick={() => setAssigning(a => !a)}
                aria-expanded={assigning}
              >
                Gán chủ đề
              </button>
              <button className="kb-btn-ghost kb-btn-ghost--small" onClick={onBulkTag}>Gắn thẻ</button>
              <button className="kb-btn-ghost kb-btn-ghost--small kb-btn-ghost--danger" onClick={onBulkDelete}>
                Xóa {picked.length}
              </button>
            </>
          )}
        </div>
      )}
      {bulk && assigning && picked.length > 0 && (
        <div className="kb-bulk-assign">
          <span className="kb-bulk-assign__label">Chuyển {picked.length} bài vào</span>
          <KBTopicPicker
            topics={topics}
            value={undefined}
            onChange={id => { setAssigning(false); onBulkAssign(id); }}
          />
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
              pendingTaskIds={pendingTaskIds}
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
