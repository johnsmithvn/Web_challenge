import { useState, useEffect, useMemo } from 'react';
import { useCollections } from '../hooks/useCollections';
import { useAuth } from '../contexts/AuthContext';
import '../styles/collect.css';

const TABS = [
  { key: 'all',   label: '🗂 Tất cả' },
  { key: 'link',  label: '🔗 Links' },
  { key: 'quote', label: '💬 Quotes' },
  { key: 'want',  label: '🛒 Muốn' },
  { key: 'learn', label: '📚 Học' },
  { key: 'idea',  label: '💡 Ý tưởng' },
];

const STATUS_BADGE = {
  unread:   { label: 'Chưa đọc', color: 'var(--cyan)' },
  read:     { label: 'Đã đọc',   color: 'var(--text-muted)' },
  starred:  { label: '⭐ Starred', color: 'var(--yellow, #eab308)' },
  archived: { label: 'Archived',  color: 'var(--text-muted)' },
};

export default function CollectPage() {
  const { user } = useAuth();
  const { items, isLoading, fetchItems, updateItem, deleteItem, toggleStar, archiveItem } = useCollections();
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');

  // Fetch all non-inbox items on mount
  useEffect(() => {
    if (user) fetchItems({});
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter: exclude inbox items, apply tab + search
  const filtered = useMemo(() => {
    return items
      .filter(item => item.type !== 'inbox')
      .filter(item => activeTab === 'all' || item.type === activeTab)
      .filter(item => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          (item.body || '').toLowerCase().includes(q) ||
          (item.tags || []).some(t => t.toLowerCase().includes(q))
        );
      });
  }, [items, activeTab, search]);

  const handleToggleRead = async (item) => {
    const newStatus = item.status === 'read' ? 'unread' : 'read';
    await updateItem(item.id, { status: newStatus });
  };

  if (!user) {
    return (
      <div className="collect-page">
        <div className="collect-page__empty">🔐 Đăng nhập để sử dụng Collect</div>
      </div>
    );
  }

  return (
    <div className="collect-page">
      <div className="collect-page__header">
        <h1 className="collect-page__title">📓 Collect</h1>
        <p className="collect-page__subtitle">
          Kho lưu trữ kiến thức đã phân loại
        </p>
      </div>

      {/* Search */}
      <div className="collect-search">
        <input
          className="collect-search__input"
          type="text"
          placeholder="🔍 Tìm kiếm..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <div className="collect-tabs">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`collect-tab${activeTab === tab.key ? ' collect-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Items grid */}
      {isLoading ? (
        <div className="collect-page__loading">Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div className="collect-page__empty-state">
          <div className="collect-page__empty-icon">📭</div>
          <p>Chưa có mục nào {activeTab !== 'all' ? `loại "${TABS.find(t => t.key === activeTab)?.label}"` : ''}</p>
          <p className="collect-page__empty-hint">
            Phân loại từ <strong>Inbox</strong> hoặc dùng nút <strong>+</strong> để thêm
          </p>
        </div>
      ) : (
        <div className="collect-grid">
          {filtered.map(item => (
            <div key={item.id} className={`collect-card collect-card--${item.type}`}>
              <div className="collect-card__header">
                <span className="collect-card__type-badge">{
                  TABS.find(t => t.key === item.type)?.label || item.type
                }</span>
                {item.status && STATUS_BADGE[item.status] && (
                  <span className="collect-card__status" style={{ color: STATUS_BADGE[item.status].color }}>
                    {STATUS_BADGE[item.status].label}
                  </span>
                )}
              </div>

              <div className="collect-card__title">
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="collect-card__link">
                    {item.title}
                  </a>
                ) : (
                  item.title
                )}
              </div>

              {item.body && (
                <div className="collect-card__body">{item.body}</div>
              )}

              {item.tags?.length > 0 && (
                <div className="collect-card__tags">
                  {item.tags.map(tag => (
                    <span key={tag} className="collect-card__tag">#{tag}</span>
                  ))}
                </div>
              )}

              {item.source && (
                <div className="collect-card__source">📌 {item.source}</div>
              )}

              <div className="collect-card__footer">
                <span className="collect-card__date">
                  {new Date(item.created_at).toLocaleDateString('vi-VN')}
                </span>
                <div className="collect-card__actions">
                  <button
                    className="collect-card__action"
                    onClick={() => toggleStar(item.id, item.status)}
                    title={item.status === 'starred' ? 'Bỏ star' : 'Star'}
                  >
                    {item.status === 'starred' ? '⭐' : '☆'}
                  </button>
                  <button
                    className="collect-card__action"
                    onClick={() => handleToggleRead(item)}
                    title={item.status === 'read' ? 'Đánh chưa đọc' : 'Đánh đã đọc'}
                  >
                    {item.status === 'read' ? '📖' : '📕'}
                  </button>
                  <button
                    className="collect-card__action"
                    onClick={() => archiveItem(item.id)}
                    title="Archive"
                  >
                    📦
                  </button>
                  <button
                    className="collect-card__action collect-card__action--delete"
                    onClick={() => deleteItem(item.id)}
                    title="Xóa"
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
