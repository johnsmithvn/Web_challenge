import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollections } from '../hooks/useCollections';
import { useUserTasks } from '../hooks/useUserTasks';
import { useAuth } from '../contexts/AuthContext';
import '../styles/inbox.css';

const TYPES = [
  { key: 'link',  label: '🔗 Link',    desc: 'Bài viết, video, repo' },
  { key: 'quote', label: '💬 Quote',   desc: 'Câu nói hay' },
  { key: 'want',  label: '🛒 Muốn mua',desc: 'Đồ cần mua / sửa' },
  { key: 'learn', label: '📚 Học',     desc: 'Khóa học, bài tập' },
  { key: 'idea',  label: '💡 Ý tưởng', desc: 'Ý tưởng cá nhân' },
];

export default function InboxPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { items, isLoading, fetchItems, classifyItem, deleteItem, addItem } = useCollections();
  const { addTask } = useUserTasks();
  const [quickText, setQuickText] = useState('');
  const [classifying, setClassifying] = useState(null);

  // Load inbox items on mount
  useEffect(() => {
    if (user) fetchItems({ type: 'inbox' });
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    const trimmed = quickText.trim();
    if (!trimmed) return;

    const isUrl = /^https?:\/\//i.test(trimmed);
    const result = await addItem({
      type: 'inbox',
      title: trimmed,
      url: isUrl ? trimmed : null,
    });
    if (result) {
      setQuickText('');
    }
  };

  const handleClassify = async (itemId, newType) => {
    await classifyItem(itemId, newType);
    setClassifying(null);
    fetchItems({ type: 'inbox' });
  };

  const handleDelete = async (itemId) => {
    await deleteItem(itemId);
  };

  // Convert inbox item → Task
  const handleToTask = async (item) => {
    await addTask({ title: item.title, description: item.url || '' });
    await deleteItem(item.id);
    fetchItems({ type: 'inbox' });
  };

  // Navigate to Finance to create a subscription from inbox item
  // NOTE: do NOT delete item here — Finance will delete it only after successful save
  const handleToSub = (item) => {
    sessionStorage.setItem('lh_inbox_to_sub', JSON.stringify({ title: item.title, inboxId: item.id }));
    navigate('/finance');
  };

  if (!user) {
    return (
      <div className="inbox-page">
        <div className="inbox-page__empty">
          🔐 Đăng nhập để sử dụng Inbox
        </div>
      </div>
    );
  }

  return (
    <div className="inbox-page">
      <div className="inbox-page__header">
        <h1 className="inbox-page__title">📥 Inbox</h1>
        <p className="inbox-page__subtitle">
          Ghi nhanh mọi thứ — phân loại sau
        </p>
      </div>

      {/* Quick add form */}
      <form className="inbox-quick-add" onSubmit={handleQuickAdd}>
        <input
          className="inbox-quick-add__input"
          type="text"
          placeholder="Nhập nhanh ghi chú, link, ý tưởng..."
          value={quickText}
          onChange={(e) => setQuickText(e.target.value)}
          maxLength={500}
        />
        <button
          type="submit"
          className="btn btn-primary inbox-quick-add__btn"
          disabled={!quickText.trim()}
        >
          Thêm
        </button>
      </form>

      {/* Items list */}
      {isLoading ? (
        <div className="inbox-page__loading">Đang tải...</div>
      ) : items.length === 0 ? (
        <div className="inbox-page__empty-state">
          <div className="inbox-page__empty-icon">📭</div>
          <p>Inbox trống — rất tốt!</p>
          <p className="inbox-page__empty-hint">
            Dùng nút <strong>+</strong> hoặc form trên để ghi nhanh
          </p>
        </div>
      ) : (
        <div className="inbox-items">
          <div className="inbox-items__count">{items.length} mục chưa phân loại</div>
          {items.map(item => (
            <div key={item.id} className="inbox-item">
              <div className="inbox-item__content">
                <div className="inbox-item__title">
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="inbox-item__link">
                      🔗 {item.title}
                    </a>
                  ) : (
                    item.title
                  )}
                </div>
                <div className="inbox-item__time">
                  {new Date(item.created_at).toLocaleString('vi-VN', {
                    hour: '2-digit', minute: '2-digit',
                    day: '2-digit', month: '2-digit',
                  })}
                </div>
              </div>

              <div className="inbox-item__actions">
                {classifying === item.id ? (
                  <div className="inbox-item__classify-menu">
                    {TYPES.map(t => (
                      <button
                        key={t.key}
                        className="inbox-item__classify-btn"
                        onClick={() => handleClassify(item.id, t.key)}
                        title={t.desc}
                      >
                        {t.label}
                      </button>
                    ))}
                    <button
                      className="inbox-item__classify-btn inbox-item__classify-btn--cancel"
                      onClick={() => setClassifying(null)}
                    >
                      ✕ Huỷ
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      className="inbox-item__action-btn"
                      onClick={() => setClassifying(item.id)}
                      title="Phân loại vào Collect"
                    >
                      📂 Phân loại
                    </button>
                    <button
                      className="inbox-item__action-btn"
                      onClick={() => handleToTask(item)}
                      title="Chuyển thành Task"
                    >
                      📌 Task
                    </button>
                    <button
                      className="inbox-item__action-btn"
                      onClick={() => handleToSub(item)}
                      title="Tạo Đăng ký (Finance)"
                    >
                      🔄 Đăng ký
                    </button>
                    <button
                      className="inbox-item__action-btn inbox-item__action-btn--delete"
                      onClick={() => handleDelete(item.id)}
                      title="Xóa"
                    >
                      🗑 Xóa
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
