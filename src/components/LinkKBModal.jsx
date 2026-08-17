import { useState, useMemo, useCallback } from 'react';
import AppIcon from './AppIcon';

/**
 * LinkKBModal — Search + checkbox modal to link/unlink Knowledge Base articles to a task.
 *
 * Props:
 *   taskId         — UUID of the task being linked
 *   linkedIds      — Array of already-linked collection IDs
 *   allCollections — Array of all KB collections (from useCollections)
 *   onLink         — (taskId, collectionId) => Promise
 *   onUnlink       — (taskId, collectionId) => Promise
 *   onClose        — () => void
 *
 * @since v4.5.0
 */
const MAX_RESULTS = 10;

export default function LinkKBModal({ taskId, linkedIds = [], allCollections = [], onLink, onUnlink, onClose }) {
  const [search, setSearch] = useState('');

  // Filter collections by search (title + body_text/body), max 10 results
  // Linked items appear first
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    // Exclude inbox items — only show KB articles
    const kbItems = allCollections.filter(c => c.type !== 'inbox');

    let results;
    if (!q) {
      results = kbItems;
    } else {
      results = kbItems.filter(c => {
        const title = (c.title || '').toLowerCase();
        const body  = (c.body_text || c.body || '').toLowerCase();
        return title.includes(q) || body.includes(q);
      });
    }

    // Sort: linked items first, then by title
    const linkedSet = new Set(linkedIds);
    results.sort((a, b) => {
      const aLinked = linkedSet.has(a.id) ? 0 : 1;
      const bLinked = linkedSet.has(b.id) ? 0 : 1;
      if (aLinked !== bLinked) return aLinked - bLinked;
      return (a.title || '').localeCompare(b.title || '');
    });

    return results.slice(0, MAX_RESULTS);
  }, [search, allCollections, linkedIds]);

  const handleToggle = useCallback(async (collectionId) => {
    const isLinked = linkedIds.includes(collectionId);
    // Truyền kèm tiêu đề để activity log ghi được tên bài viết thay vì uuid —
    // sau khi bài viết bị xoá thì không còn cách nào tra ngược tên nữa.
    const title = allCollections.find(c => c.id === collectionId)?.title;
    if (isLinked) {
      await onUnlink(taskId, collectionId, title);
    } else {
      await onLink(taskId, collectionId, title);
    }
  }, [taskId, linkedIds, allCollections, onLink, onUnlink]);

  const linkedSet = new Set(linkedIds);

  const TYPE_ICONS = {
    link: 'link', quote: 'quote', learn: 'book', idea: 'lightbulb',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--card-bg, #1a1a2e)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 'var(--radius-lg, 12px)', padding: '1.25rem',
        width: '100%', maxWidth: '420px', maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            <AppIcon name="link" size={17} /> Liên kết bài viết
          </span>
          <button
            onClick={onClose}
            aria-label="Đóng"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: '1.1rem', padding: '0.2rem',
            }}
          ><AppIcon name="x" size={16} /></button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Tìm bài viết..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="auth-input"
          autoFocus
          style={{ fontSize: '0.85rem', padding: '0.55rem 0.75rem' }}
        />

        {/* Results */}
        <div style={{
          flex: 1, overflowY: 'auto', minHeight: 0,
          display: 'flex', flexDirection: 'column', gap: '0.3rem',
          maxHeight: '50vh',
        }}>
          {filtered.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '1.5rem 0',
              color: 'var(--text-muted)', fontSize: '0.82rem',
            }}>
              {search ? 'Không tìm thấy bài viết phù hợp.' : 'Chưa có bài viết nào.'}
            </div>
          )}

          {filtered.map(item => {
            const isLinked = linkedSet.has(item.id);
            return (
              <button
                key={item.id}
                onClick={() => handleToggle(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.55rem',
                  padding: '0.55rem 0.65rem', borderRadius: 'var(--radius-sm, 6px)',
                  background: isLinked ? 'rgba(6,182,212,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isLinked ? 'rgba(6,182,212,0.25)' : 'rgba(255,255,255,0.06)'}`,
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  transition: 'var(--transition-base, 0.15s ease)',
                }}
              >
                {/* Checkbox */}
                <div style={{
                  width: 20, height: 20, minWidth: 20,
                  borderRadius: 'var(--radius-sm, 4px)',
                  border: `2px solid ${isLinked ? '#22d3ee' : 'rgba(255,255,255,0.2)'}`,
                  background: isLinked ? 'rgba(6,182,212,0.25)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', color: '#22d3ee',
                  transition: 'var(--transition-base, 0.15s ease)',
                }}>
                  {isLinked && <AppIcon name="check" size={12} />}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.82rem', fontWeight: 600,
                    color: isLinked ? '#22d3ee' : 'var(--text-primary)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    <AppIcon name={TYPE_ICONS[item.type] || 'file'} size={14} /> {item.title || '(Không tiêu đề)'}
                  </div>
                  {(item.body_text || item.body) && (
                    <div style={{
                      fontSize: '0.72rem', color: 'var(--text-muted)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      marginTop: '0.15rem',
                    }}>
                      {(item.body_text || item.body || '').slice(0, 80)}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {linkedIds.length} bài đã liên kết
          </span>
          <button
            onClick={onClose}
            className="btn btn-primary"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
          >
            <AppIcon name="check" size={14} /> Xong
          </button>
        </div>
      </div>
    </div>
  );
}
