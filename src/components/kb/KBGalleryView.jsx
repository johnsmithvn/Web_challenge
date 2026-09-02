import { TYPE_GLYPHS, isTiptapBody, tiptapToPlainText, markdownToPlainText } from '../../utils/kbDeriveUtils';
import { formatDate } from '../../utils/dateUtils';

/**
 * KBGalleryView — postcard grid for all article types.
 * Each card shows: type label, pull/excerpt quote, title + date at bottom.
 */

function GalleryCard({ item, onClick }) {
  const meta = TYPE_GLYPHS[item.type] || TYPE_GLYPHS.note;
  const isTiptap = isTiptapBody(item);

  let text = item.body_text || '';
  if (!text && isTiptap) text = tiptapToPlainText(item.body);
  else if (!text) text = markdownToPlainText(item.body || '');

  const displayText = text || item.title;
  const isShort = displayText.length < 120;

  return (
    <article
      className="kb-gallery-card"
      onClick={() => onClick(item)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick(item)}
    >
      {/* Type label */}
      <span className="kb-gallery-card__type" style={{ color: `var(${meta.hueVar})` }}>
        {meta.label}
      </span>

      {/* Pull quote / excerpt */}
      <blockquote className={`kb-gallery-card__pull${isShort ? ' kb-gallery-card__pull--short' : ''}`}>
        {displayText.slice(0, 350)}
      </blockquote>

      {/* Footer */}
      <div className="kb-gallery-card__footer">
        <span className="kb-gallery-card__title">{item.title}</span>
        <span className="kb-gallery-card__date">{formatDate(item.created_at)}</span>
      </div>
    </article>
  );
}

export default function KBGalleryView({ articles, onOpenReader }) {
  if (articles.length === 0) {
    return (
      <div className="kb-empty-state" style={{ animation: 'kb-in .22s ease' }}>
        <span className="kb-empty-state__icon">◌</span>
        <h2 className="kb-empty-state__title">Không có bài nào</h2>
        <p className="kb-empty-state__desc">Thử bỏ bộ lọc hoặc tạo bài mới.</p>
      </div>
    );
  }

  return (
    <div className="kb-gallery-grid" style={{ animation: 'kb-in .22s ease' }}>
      {articles.map(item => (
        <GalleryCard key={item.id} item={item} onClick={onOpenReader} />
      ))}
    </div>
  );
}
