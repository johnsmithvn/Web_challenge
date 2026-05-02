import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollections } from '../hooks/useCollections';
import { useUserTasks } from '../hooks/useUserTasks';
import { useExpenses } from '../hooks/useExpenses';
import { useIntentions } from '../hooks/useIntentions';
import { useActivityLog } from '../hooks/useActivityLog';
import { useAuth } from '../contexts/AuthContext';
import EXPENSE_DATA from '../data/expense-categories.json';
import { useLinkMeta } from '../hooks/useLinkMeta';
import '../styles/inbox.css';

const CATEGORIES = EXPENSE_DATA.categories;

const TYPES = [
  { key: 'link',  label: '🔗 Link',    desc: 'Bài viết, video, repo' },
  { key: 'quote', label: '💬 Quote',   desc: 'Câu nói hay' },
  { key: 'want',  label: '🛒 Muốn mua',desc: 'Đồ cần mua / sửa' },
  { key: 'learn', label: '📚 Học',     desc: 'Khóa học, bài tập' },
  { key: 'idea',  label: '💡 Ý tưởng', desc: 'Ý tưởng cá nhân' },
];

/**
 * Extract amount from Vietnamese-style text.
 * "Mua cafe 50k" → 50000
 * "Ăn trưa 120.000" → 120000
 * "Grab 35K" → 35000
 */
function extractAmount(text) {
  const m = text.match(/(\d[\d.,]*)[\s]*([kKmM]?)/);
  if (!m) return '';
  let n = parseFloat(m[1].replace(/[.,]/g, ''));
  if (/[kK]/.test(m[2])) n *= 1000;
  if (/[mM]/.test(m[2])) n *= 1000000;
  return isNaN(n) ? '' : n;
}

function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
}

export default function InboxPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { items, isLoading, fetchItems, classifyItem, deleteItem, addItem, snoozeItem, getSnoozedCount, fetchSnoozedItems } = useCollections();
  const { addTask } = useUserTasks();
  const { addExpense } = useExpenses();
  const { addIntention } = useIntentions();
  const { logActivity } = useActivityLog();
  const [quickText, setQuickText] = useState('');
  const [classifying, setClassifying] = useState(null);
  const [snoozeMenu, setSnoozeMenu] = useState(null); // item.id or null
  const [snoozedCount, setSnoozedCount] = useState(0);
  const [showSnoozed, setShowSnoozed] = useState(false);
  const [snoozedItems, setSnoozedItems] = useState([]);
  const [overflowMenu, setOverflowMenu] = useState(null); // item.id or null
  const [filter, setFilter] = useState('all'); // 'all' | 'has_url' | 'recent'
  const { getMeta, metaCache } = useLinkMeta();

  // Quick Expense modal state
  const [expenseModal, setExpenseModal] = useState(null); // { item, amount, category, note }

  // Close overflow menu on click outside
  useEffect(() => {
    if (!overflowMenu) return;
    const handler = (e) => {
      if (!e.target.closest('.inbox-overflow-wrap')) setOverflowMenu(null);
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [overflowMenu]);

  // Load inbox items on mount
  useEffect(() => {
    if (user) {
      fetchItems({ type: 'inbox' });
      getSnoozedCount().then(c => setSnoozedCount(c));
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const SNOOZE_OPTIONS = [
    { label: '1 tuần', days: 7 },
    { label: '2 tuần', days: 14 },
    { label: '1 tháng', days: 30 },
    { label: '3 tháng', days: 90 },
  ];

  const handleSnooze = async (itemId, days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const until = d.toISOString().split('T')[0];
    await snoozeItem(itemId, until);
    setSnoozeMenu(null);
    setSnoozedCount(prev => prev + 1);
  };

  const handleToggleSnoozed = async () => {
    if (!showSnoozed) {
      const list = await fetchSnoozedItems();
      setSnoozedItems(list);
    }
    setShowSnoozed(v => !v);
  };

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    console.log('[InboxPage] handleQuickAdd fired, quickText:', quickText);
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

  // Open Quick Expense modal — pre-fill from text
  const handleToExpense = (item) => {
    const amount = extractAmount(item.title);
    setExpenseModal({
      item,
      amount: amount || '',
      category: 'food',
      note: item.title,
    });
  };

  // Save expense from modal
  const handleExpenseSave = async () => {
    if (!expenseModal) return;
    const { item, amount, category, note } = expenseModal;
    const parsedAmount = parseInt(amount, 10);
    if (!parsedAmount || parsedAmount <= 0) return;

    const cat = CATEGORIES.find(c => c.key === category);
    const result = await addExpense({ amount: parsedAmount, category, note });
    if (result) {
      logActivity('expense_add', `${formatVND(parsedAmount)} ${cat?.label || category}`, parsedAmount, { category, source: 'inbox' });
      await deleteItem(item.id);
      fetchItems({ type: 'inbox' });
      setExpenseModal(null);
    }
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h1 className="inbox-page__title">📥 Inbox</h1>
          {snoozedCount > 0 && (
            <button
              onClick={handleToggleSnoozed}
              style={{
                fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)',
                background: showSnoozed ? 'rgba(234,179,8,0.25)' : 'rgba(234,179,8,0.12)',
                color: '#eab308', fontWeight: 600, border: 'none', cursor: 'pointer',
              }}
            >
              🕔 {snoozedCount} snoozed {showSnoozed ? '▲' : '▼'}
            </button>
          )}
        </div>
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

      {/* Filter chips */}
      {items.length > 0 && (
        <div className="inbox-filter-chips">
          {[
            { key: 'all', label: 'Tất cả', icon: '📥' },
            { key: 'has_url', label: 'Có URL', icon: '🔗' },
            { key: 'recent', label: 'Gần đây (7 ngày)', icon: '🗓' },
          ].map(f => (
            <button
              key={f.key}
              className={`inbox-filter-chip${filter === f.key ? ' inbox-filter-chip--active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.icon} {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Snoozed items panel */}
      {showSnoozed && (
        <div style={{
          margin: '0.75rem 0',
          border: '1px solid rgba(234,179,8,0.2)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          background: 'rgba(234,179,8,0.04)',
        }}>
          <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid rgba(234,179,8,0.1)', fontSize: '0.78rem', color: '#eab308', fontWeight: 600 }}>
            🕔 Đang tạm hoãn ({snoozedItems.length})
          </div>
          {snoozedItems.length === 0 ? (
            <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>Không có item nào đang snooze</div>
          ) : (
            snoozedItems.map(item => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.6rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.04)',
                gap: '0.75rem',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#eab308', marginTop: '0.15rem' }}>
                    Hiện lại: {new Date(item.snoozed_until).toLocaleDateString('vi-VN')}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    await snoozeItem(item.id, null);
                    setSnoozedItems(prev => prev.filter(s => s.id !== item.id));
                    setSnoozedCount(prev => Math.max(0, prev - 1));
                    fetchItems({ type: 'inbox' });
                  }}
                  style={{
                    fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: 'var(--radius-full)',
                    background: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)',
                    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >
                  Bỏ hoãn
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Quick Expense Modal */}
      {expenseModal && (
        <div className="inbox-expense-modal-backdrop" onClick={() => setExpenseModal(null)}>
          <div className="inbox-expense-modal" onClick={e => e.stopPropagation()}>
            <div className="inbox-expense-modal__header">
              <span>💸 Chi tiêu nhanh</span>
              <button className="inbox-expense-modal__close" onClick={() => setExpenseModal(null)}>✕</button>
            </div>
            <div className="inbox-expense-modal__body">
              <label className="inbox-expense-modal__label">Ghi chú</label>
              <input
                className="inbox-expense-modal__input"
                type="text"
                value={expenseModal.note}
                onChange={e => setExpenseModal(prev => ({ ...prev, note: e.target.value }))}
                maxLength={200}
              />

              <label className="inbox-expense-modal__label">Số tiền (VNĐ)</label>
              <input
                className="inbox-expense-modal__input inbox-expense-modal__input--amount"
                type="number"
                value={expenseModal.amount}
                onChange={e => setExpenseModal(prev => ({ ...prev, amount: e.target.value }))}
                min="1000"
                step="1000"
                placeholder="50000"
                autoFocus
              />
              {expenseModal.amount > 0 && (
                <div className="inbox-expense-modal__preview">
                  {formatVND(parseInt(expenseModal.amount, 10) || 0)}
                </div>
              )}

              <label className="inbox-expense-modal__label">Danh mục</label>
              <div className="inbox-expense-modal__categories">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.key}
                    type="button"
                    className={`inbox-expense-modal__cat-btn${expenseModal.category === cat.key ? ' inbox-expense-modal__cat-btn--active' : ''}`}
                    onClick={() => setExpenseModal(prev => ({ ...prev, category: cat.key }))}
                    style={{ '--cat-color': cat.color }}
                  >
                    {cat.icon} {cat.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="inbox-expense-modal__footer">
              <button className="btn btn-ghost" onClick={() => setExpenseModal(null)}>Huỷ</button>
              <button
                className="btn btn-primary"
                onClick={handleExpenseSave}
                disabled={!expenseModal.amount || parseInt(expenseModal.amount, 10) <= 0}
              >
                💸 Lưu chi tiêu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Items list */}
      {isLoading ? (
        <div className="inbox-page__loading">Đang tải...</div>
      ) : (() => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString();

        const filtered = items.filter(item => {
          if (filter === 'has_url') return !!item.url;
          if (filter === 'recent') return item.created_at >= sevenDaysAgoStr;
          return true;
        });

        return filtered.length === 0 ? (
        <div className="inbox-page__empty-state">
          <div className="inbox-page__empty-icon">{items.length === 0 ? '📭' : '🔍'}</div>
          <p>{items.length === 0 ? 'Inbox trống — rất tốt!' : `Không có mục nào khớp bộ lọc "${filter === 'has_url' ? 'Có URL' : 'Gần đây'}"`}</p>
          {items.length > 0 && (
            <button className="btn btn-ghost" style={{ marginTop: '0.5rem', fontSize: '0.82rem' }} onClick={() => setFilter('all')}>
              Xem tất cả ({items.length})
            </button>
          )}
          <p className="inbox-page__empty-hint">
            Dùng nút <strong>+</strong> hoặc form trên để ghi nhanh
          </p>
        </div>
      ) : (
        <div className="inbox-items">
          <div className="inbox-items__count">{filtered.length}{filtered.length !== items.length ? `/${items.length}` : ''} mục chưa phân loại</div>
          {filtered.map(item => (
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
                {/* Link preview (v4.0.0) */}
                {item.url && (() => {
                  const meta = metaCache[item.url];
                  if (!meta) { getMeta(item.url); return null; }
                  if (meta.loading) return (
                    <div className="inbox-item__meta-preview" style={{ opacity: 0.5 }}>
                      ⏳ Đang tải preview...
                    </div>
                  );
                  if (meta.blocked || (!meta.title && !meta.desc)) return null;
                  return (
                    <div className="inbox-item__meta-preview">
                      {meta.image && <img src={meta.image} alt="" className="inbox-item__meta-img" />}
                      <div className="inbox-item__meta-text">
                        {meta.title && <div className="inbox-item__meta-title">{meta.title}</div>}
                        {meta.desc && <div className="inbox-item__meta-desc">{meta.desc}</div>}
                      </div>
                    </div>
                  );
                })()}
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
                ) : snoozeMenu === item.id ? (
                  <div className="inbox-item__snooze-menu">
                    {SNOOZE_OPTIONS.map(opt => (
                      <button
                        key={opt.days}
                        className="inbox-item__snooze-option"
                        onClick={() => handleSnooze(item.id, opt.days)}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <button
                      className="inbox-item__snooze-option inbox-item__snooze-option--cancel"
                      onClick={() => setSnoozeMenu(null)}
                    >
                      ✕ Huỷ
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Primary actions */}
                    <button
                      className="inbox-item__action-btn"
                      onClick={() => handleToTask(item)}
                      title="Chuyển thành Task"
                    >
                      📌 Task
                    </button>
                    <button
                      className="inbox-item__action-btn inbox-item__action-btn--delete"
                      onClick={() => handleDelete(item.id)}
                      title="Xóa"
                    >
                      🗑
                    </button>

                    {/* Overflow menu trigger */}
                    <div className="inbox-overflow-wrap">
                      <button
                        className="inbox-item__action-btn inbox-overflow-trigger"
                        onClick={() => setOverflowMenu(overflowMenu === item.id ? null : item.id)}
                        title="Thêm hành động"
                      >
                        ···
                      </button>
                      {overflowMenu === item.id && (
                        <div className="inbox-overflow-menu">
                          <button className="inbox-overflow-item" onClick={() => { setClassifying(item.id); setOverflowMenu(null); }}>
                            📂 Phân loại
                          </button>
                          <button className="inbox-overflow-item" onClick={() => { handleToExpense(item); setOverflowMenu(null); }}>
                            💸 Chi tiêu
                          </button>
                          <button className="inbox-overflow-item" onClick={() => { handleToSub(item); setOverflowMenu(null); }}>
                            🔄 Đăng ký
                          </button>
                          <button className="inbox-overflow-item" onClick={async () => {
                            await addIntention({ title: item.title });
                            await deleteItem(item.id);
                            fetchItems({ type: 'inbox' });
                            setOverflowMenu(null);
                          }}>
                            🥚 Ấp Trứng
                          </button>
                          <button className="inbox-overflow-item" onClick={() => { setSnoozeMenu(item.id); setOverflowMenu(null); }}>
                            🕔 Snooze
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      );
      })()}
    </div>
  );
}
