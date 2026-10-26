import { KIND_META, contentKind, itemPlainText, safeHostname, parseWikiLinks } from '../../utils/kbDeriveUtils';
import { formatDate } from '../../utils/dateUtils';

/**
 * KBGalleryView — lưới thẻ so le (CSS columns): tiêu đề lên đầu, trích đoạn tối đa 4 dòng,
 * chân thẻ là chủ đề. Trích dẫn có dấu “ lớn, bài có link hiện tên nguồn.
 */

function GalleryCard({ item, onClick }) {
  const kind = contentKind(item);
  const text = itemPlainText(item);
  const topic = item._topic;
  const links = parseWikiLinks(item.body || '').length;

  return (
    <article
      className="kb-gallery-card"
      onClick={() => onClick(item)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick(item)}
    >
      <div className="kb-gallery-card__meta">
        <span>{KIND_META[kind].label}</span>
        <span>{formatDate(item.created_at)}</span>
      </div>
      {kind === 'quote' && <div className="kb-gallery-card__quote-mark" aria-hidden="true">“</div>}
      {item.url && kind !== 'quote' && (
        <div className="kb-gallery-card__source">
          <span className="kb-gallery-card__favicon" aria-hidden="true">{safeHostname(item.url).replace(/^www\./, '').charAt(0).toUpperCase()}</span>
          {safeHostname(item.url).replace(/^www\./, '')}
        </div>
      )}
      <h3 className="kb-gallery-card__title">{item.title}</h3>
      {text && <p className="kb-gallery-card__excerpt">{text.slice(0, 400)}</p>}
      <div className="kb-gallery-card__footer">
        <span className={`kb-gallery-card__topic${topic ? '' : ' is-unsorted'}`} style={topic ? { '--kb-topic': topic.color } : undefined}>
          {topic ? topic.name : 'Chưa xếp'}
        </span>
        {links > 0 && <span className="kb-gallery-card__links">↔ {links}</span>}
      </div>
    </article>
  );
}

export default function KBGalleryView({ articles, onOpenReader }) {
  if (articles.length === 0) {
    return (
      <div className="kb-empty kb-empty--page" style={{ animation: 'kb-in .22s ease' }}>
        <h2 className="kb-empty__title">Không có bài nào</h2>
        <p className="kb-empty__desc">Thử bỏ bộ lọc hoặc viết bài mới.</p>
      </div>
    );
  }

  return (
    <div className="kb-gallery" style={{ animation: 'kb-in .22s ease' }}>
      <header className="kb-view-head">
        <h1 className="kb-view-head__title">Gallery</h1>
        <p className="kb-view-head__sub">{articles.length} bài</p>
      </header>
      <div className="kb-gallery-grid">
        {articles.map(item => (
          <GalleryCard key={item.id} item={item} onClick={onOpenReader} />
        ))}
      </div>
    </div>
  );
}
