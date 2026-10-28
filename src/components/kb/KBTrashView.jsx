import { KIND_META, contentKind, safeHostname } from '../../utils/kbDeriveUtils';
import { formatDate } from '../../utils/dateUtils';
import AppIcon from '../AppIcon';

/**
 * KBTrashView — Thùng rác: bài đã xoá (status archived), bỏ gần nhất trước.
 * Khôi phục trả bài về nguyên vẹn; Xoá vĩnh viễn / Dọn sạch do CollectPage hỏi xác nhận.
 */
export default function KBTrashView({ items, onRestore, onDelete, onEmpty }) {
  return (
    <div className="kb-list-view" style={{ animation: 'kb-in .22s ease' }}>
      <header className="kb-topic-head">
        <div className="kb-topic-head__top">
          <div className="kb-topic-head__text">
            <div className="kb-topic-head__line">
              <h2 className="kb-topic-head__name">Thùng rác</h2>
              <span className="kb-topic-head__count">{items.length} bài</span>
            </div>
          </div>
          {items.length > 0 && (
            <div className="kb-topic-head__btns">
              <button className="kb-btn-ghost kb-btn-ghost--danger" onClick={onEmpty}>Dọn sạch</button>
            </div>
          )}
        </div>
      </header>

      {items.length === 0 ? (
        <div className="kb-empty">
          <h3 className="kb-empty__title">Thùng rác trống</h3>
        </div>
      ) : (
        <div className="kb-rows">
          {items.map(item => {
            const kind = KIND_META[contentKind(item)];
            return (
              <article key={item.id} className="kb-row kb-row--trash">
                <span className="kb-row__icon"><AppIcon name={kind.icon} size={16} /></span>
                <div className="kb-row__content">
                  <div className="kb-row__meta">
                    <span>{kind.label}</span>
                    {item.url && <span>{safeHostname(item.url)}</span>}
                    <span>Xoá {formatDate(item.updated_at)}</span>
                  </div>
                  <h3 className="kb-row__title">{item.title}</h3>
                </div>
                <div className="kb-row__side">
                  <button className="kb-btn-ghost kb-btn-ghost--small" onClick={() => onRestore(item)}>Khôi phục</button>
                  <button
                    className="kb-icon-btn kb-icon-btn--danger"
                    onClick={() => onDelete(item)}
                    title="Xoá vĩnh viễn"
                    aria-label={`Xoá vĩnh viễn ${item.title}`}
                  >
                    <AppIcon name="trash" size={14} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
