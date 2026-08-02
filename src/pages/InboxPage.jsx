import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCollections } from '../hooks/useCollections';
import { useUserTasks } from '../hooks/useUserTasks';
import { useExpenses } from '../hooks/useExpenses';
import { useIntentions } from '../hooks/useIntentions';
import { useActivityLog } from '../hooks/useActivityLog';
import { ACTIONS } from '../utils/taskFields';
import { useAuth } from '../contexts/AuthContext';
import EXPENSE_DATA from '../data/expense-categories.json';
import KNOWLEDGE_DATA from '../data/knowledge.json';
import QuoteWidget from '../components/QuoteWidget';
import CustomSelect from '../components/CustomSelect';
import GenericModal from '../components/GenericModal';
import { parseCurrencyInput, formatVND } from '../utils/currencyUtils';
import '../styles/inbox.css';
import '../styles/collect.css';

const CATEGORIES = EXPENSE_DATA.categories;
const TYPES = KNOWLEDGE_DATA.types;

/**
 * Extract amount from Vietnamese-style text.
 * "Mua cafe 50k" → 50000
 * "Ăn trưa 120.000" → 120000
 * "Grab 35K" → 35000
 */
function extractAmount(text) {
  // Reuse the canonical parser so Inbox and Finance agree on decimals/k/m/auto-K.
  const m = text.match(/\d[\d.,]*\s*[kKmM]?/);
  if (!m) return '';
  const n = parseCurrencyInput(m[0]);
  return n || '';
}

export default function InboxPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { items, isLoading, fetchItems, classifyItem, deleteItem, addItem, updateItem, snoozeItem, getSnoozedCount, fetchSnoozedItems } = useCollections();
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

  // Quick Expense modal state
  const [expenseModal, setExpenseModal] = useState(null); // { item, amount, category, note }

  // Bulk actions state
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState(new Set());



  // Detail view (v4.6.0)
  const [detailItem, setDetailItem] = useState(null);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailBody, setDetailBody] = useState('');
  const [detailSaving, setDetailSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const saveTimerRef = useRef(null);
  const [bulkClassifyMenu, setBulkClassifyMenu] = useState(false);

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
    logActivity(ACTIONS.INBOX_SNOOZE);
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
    const trimmed = quickText.trim();
    if (!trimmed) return;

    const isUrl = /^https?:\/\//i.test(trimmed);
    const words = trimmed.split(/\s+/);
    const isLong = words.length > 25 || trimmed.length > 100;

    // Auto-split: long text → truncated title + full body
    // TODO: future — AI summarize title from body content
    let title = trimmed;
    let autoBody = '';
    if (isLong && !isUrl) {
      title = words.slice(0, 25).join(' ') + (words.length > 25 ? '…' : '');
      autoBody = trimmed; // full original text preserved in body
    }

    const result = await addItem({
      type: 'inbox',
      title,
      url: isUrl ? trimmed : null,
      body: autoBody,
    });
    if (result) {
      setQuickText('');
    }
  };

  // ── Detail View handlers (v4.6.0) ──────────────────────────
  const openDetail = useCallback((item) => {
    if (bulkMode) return;
    setDetailItem(item);
    setDetailTitle(item.title || '');
    setDetailBody(item.body || '');
  }, [bulkMode]);

  const closeDetail = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setDetailItem(null);
    setDetailTitle('');
    setDetailBody('');
    setIsEditing(false);
    fetchItems({ type: 'inbox' });
  }, [fetchItems]);

  const handleDetailBodyChange = useCallback((val) => {
    setDetailBody(val || '');
  }, []);

  const handleDetailSave = useCallback(async () => {
    if (!detailItem) return;
    setDetailSaving(true);
    const updates = {};
    if (detailTitle.trim() !== (detailItem.title || '')) updates.title = detailTitle.trim();
    if (detailBody !== (detailItem.body || '')) updates.body = detailBody;
    if (Object.keys(updates).length > 0) {
      await updateItem(detailItem.id, updates);
      setDetailItem(prev => prev ? { ...prev, ...updates } : null);
    }
    setDetailSaving(false);
    setIsEditing(false);
  }, [detailItem, detailTitle, detailBody, updateItem]);

  const handleDetailDelete = useCallback(async () => {
    if (!detailItem) return;
    await deleteItem(detailItem.id);
    closeDetail();
    fetchItems({ type: 'inbox' });
  }, [detailItem, deleteItem, closeDetail, fetchItems]);

  const handleDetailClassify = useCallback(async (newType) => {
    if (!detailItem) return;
    await classifyItem(detailItem.id, newType);
    logActivity(ACTIONS.INBOX_CLASSIFY);
    closeDetail();
    fetchItems({ type: 'inbox' });
  }, [detailItem, classifyItem, logActivity, closeDetail, fetchItems]);

  const handleDetailToTask = useCallback(async () => {
    if (!detailItem) return;
    await addTask({ title: detailItem.title, description: detailBody || detailItem.url || '' });
    await deleteItem(detailItem.id);
    closeDetail();
    fetchItems({ type: 'inbox' });
  }, [detailItem, detailBody, addTask, deleteItem, closeDetail, fetchItems]);

  const handleDetailQuickDone = useCallback(async () => {
    if (!detailItem) return;
    const now = new Date().toISOString();
    await addTask({
      title: detailItem.title,
      description: detailBody || detailItem.url || '',
      completed: true,
      completedAt: now,
    });
    logActivity(ACTIONS.INBOX_TASK_DONE);
    await deleteItem(detailItem.id);
    closeDetail();
    fetchItems({ type: 'inbox' });
  }, [detailItem, detailBody, addTask, deleteItem, closeDetail, fetchItems, logActivity]);

  const handleClassify = async (itemId, newType) => {
    await classifyItem(itemId, newType);
    logActivity(ACTIONS.INBOX_CLASSIFY);
    setClassifying(null);
    fetchItems({ type: 'inbox' });
  };

  const handleDelete = async (itemId) => {
    await deleteItem(itemId);
  };

  // Convert inbox item → Task
  const handleToTask = async (item) => {
    await addTask({ title: item.title, description: item.body || item.url || '' });
    await deleteItem(item.id);
    fetchItems({ type: 'inbox' });
  };

  // Convert inbox item → Completed Task today immediately
  const handleQuickDone = async (item) => {
    const now = new Date().toISOString();
    await addTask({
      title: item.title,
      description: item.body || item.url || '',
      completed: true,
      completedAt: now,
    });
    logActivity(ACTIONS.INBOX_TASK_DONE);
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
    const parsedAmount = parseCurrencyInput(amount);
    if (!parsedAmount || parsedAmount <= 0) return;

    // Auto-append USD metadata to notes if USD is detected in input
    let finalNote = note;
    if (/[$]|usd/i.test(amount)) {
      const originalText = amount.trim();
      finalNote = note ? `${note} (${originalText})` : originalText;
    }

    const result = await addExpense({ amount: parsedAmount, category, note: finalNote });
    if (result) {
      logActivity(ACTIONS.EXPENSE_ADD);
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
    <>
      {!detailItem && (
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
          {items.length > 0 && (
            <button
              onClick={() => { setBulkMode(v => !v); setBulkSelected(new Set()); setBulkClassifyMenu(false); }}
              className={`inbox-filter-chip${bulkMode ? ' inbox-filter-chip--active' : ''}`}
              style={{ marginLeft: '0.25rem' }}
            >
              {bulkMode ? '✕ Thoát' : '☑ Chọn nhiều'}
            </button>
          )}
        </div>
        <p className="inbox-page__subtitle">
          Ghi nhanh mọi thứ — phân loại sau
        </p>
      </div>

      {/* Quick add form */}
      <form className="inbox-quick-add" onSubmit={handleQuickAdd}>
        <div className="inbox-quick-add__row">
          <textarea
            className="inbox-quick-add__input"
            placeholder="Nhập nhanh ghi chú, link, ý tưởng..."
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (quickText.trim()) handleQuickAdd(e);
              }
            }}
          />

          <button
            type="submit"
            className="btn btn-primary inbox-quick-add__btn"
            disabled={!quickText.trim()}
          >
            Thêm
          </button>
        </div>

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
        <GenericModal onClose={() => setExpenseModal(null)} title="💸 Chi tiêu nhanh" maxWidth={380}>
          <GenericModal.Body>
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
                type="text"
                placeholder="Ví dụ: 50, 50k, 10$"
                value={expenseModal.amount}
                onChange={e => setExpenseModal(prev => ({ ...prev, amount: e.target.value }))}
                autoFocus
              />
              {expenseModal.amount && (
                <div className="inbox-expense-modal__preview">
                  Xem trước: {formatVND(parseCurrencyInput(expenseModal.amount))}
                  {/[$]|usd/i.test(expenseModal.amount) && ' (Quy đổi tỷ giá)'}
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
          </GenericModal.Body>
          <GenericModal.Footer>
            <button className="btn btn-ghost" onClick={() => setExpenseModal(null)}>Huỷ</button>
            <button
              className="btn btn-primary"
              onClick={handleExpenseSave}
              disabled={!expenseModal.amount || parseCurrencyInput(expenseModal.amount) <= 0}
            >
              💸 Lưu chi tiêu
            </button>
          </GenericModal.Footer>
        </GenericModal>
      )}

      {/* Daily quote */}
      <QuoteWidget pageKey="inbox" />

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
          <div className="inbox-items__count">
            {bulkMode && bulkSelected.size > 0 && (
              <span style={{ color: 'var(--purple-light)', marginRight: '0.5rem' }}>✓ {bulkSelected.size} đã chọn</span>
            )}
            {filtered.length}{filtered.length !== items.length ? `/${items.length}` : ''} mục chưa phân loại
          </div>

          {/* Bulk action bar */}
          {bulkMode && (
            <div className="inbox-bulk-bar">
              <button
                className="inbox-bulk-bar__btn"
                onClick={() => {
                  const filteredIds = new Set(filtered.map(i => i.id));
                  if (bulkSelected.size >= filtered.length) {
                    setBulkSelected(new Set());
                  } else {
                    setBulkSelected(filteredIds);
                  }
                }}
              >
                {bulkSelected.size >= filtered.length ? '☐ Bỏ chọn tất cả' : '☑ Chọn tất cả'}
              </button>
              {bulkSelected.size > 0 && (
                <>
                  <button
                    className="inbox-bulk-bar__btn inbox-bulk-bar__btn--classify"
                    onClick={() => setBulkClassifyMenu(v => !v)}
                  >
                    📂 Phân loại ({bulkSelected.size})
                  </button>
                  <button
                    className="inbox-bulk-bar__btn inbox-bulk-bar__btn--delete"
                    onClick={async () => {
                      for (const id of bulkSelected) {
                        await deleteItem(id);
                      }
                      logActivity(ACTIONS.INBOX_BULK_DELETE);
                      setBulkSelected(new Set());
                      setBulkMode(false);
                      fetchItems({ type: 'inbox' });
                    }}
                  >
                    🗑 Xóa ({bulkSelected.size})
                  </button>
                </>
              )}
              {bulkClassifyMenu && bulkSelected.size > 0 && (
                <div className="inbox-bulk-classify-menu" style={{ padding: '0.2rem' }}>
                  <CustomSelect
                    className="kb-type-select"
                    value=""
                    placeholder="-- Chọn phân loại --"
                    options={TYPES.map(t => ({ value: t.key, label: `${t.emoji} ${t.label}` }))}
                    onChange={async (newType) => {
                      if (!newType) return;
                      for (const id of bulkSelected) {
                        await classifyItem(id, newType);
                      }
                      logActivity(ACTIONS.INBOX_BULK_CLASSIFY);
                      setBulkSelected(new Set());
                      setBulkClassifyMenu(false);
                      setBulkMode(false);
                      fetchItems({ type: 'inbox' });
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {filtered.map(item => (
            <div
              key={item.id}
              className={`inbox-item${bulkMode && bulkSelected.has(item.id) ? ' inbox-item--selected' : ''}`}
            >
              {/* Bulk checkbox */}
              {bulkMode && (
                <label className="inbox-item__checkbox" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={bulkSelected.has(item.id)}
                    onChange={() => {
                      setBulkSelected(prev => {
                        const next = new Set(prev);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      });
                    }}
                  />
                </label>
              )}
              <div 
                className={`inbox-item__content${!bulkMode ? ' inbox-item__content--clickable' : ''}`}
                onClick={() => !bulkMode && openDetail(item)}
              >
                <div className="inbox-item__title">
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="inbox-item__link" onClick={(e) => e.stopPropagation()}>
                      🔗 {item.title}
                    </a>
                  ) : (
                    item.title
                  )}
                </div>
                {/* Body preview (v4.6.0) */}
                {item.body && (
                  <div className="inbox-item__body-preview">
                    {item.body.length > 80 ? item.body.slice(0, 80) + '…' : item.body}
                  </div>
                )}
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
                    <CustomSelect
                      className="kb-type-select"
                      autoFocus
                      value=""
                      placeholder="-- Phân loại nhanh --"
                      options={TYPES.map(t => ({ value: t.key, label: `${t.emoji} ${t.label}` }))}
                      onChange={(newType) => {
                        if (newType) handleClassify(item.id, newType);
                      }}
                    />
                    <button
                      className="inbox-item__classify-btn inbox-item__classify-btn--cancel"
                      style={{ marginLeft: '0.5rem' }}
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
                      className="inbox-item__action-btn inbox-item__action-btn--done"
                      onClick={() => handleQuickDone(item)}
                      title="Làm xong luôn"
                    >
                      ✓ Xong
                    </button>
                    <button
                      className="inbox-item__action-btn"
                      onClick={() => handleToTask(item)}
                      title="Chuyển thành Task"
                    >
                      ⚡ Task
                    </button>
                    <button
                      className="inbox-item__action-btn inbox-item__action-btn--delete"
                      onClick={() => handleDelete(item.id)}
                      title="Xóa"
                      style={{ color: '#ef4444' }}
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
                            await addIntention({ 
                              title: item.title,
                              description: item.body || item.url || null 
                            });
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
      )}

      {/* ═══ DETAIL VIEW (v4.6.0) — inline, replaces page content ═══ */}
      {detailItem && !isEditing && (
        <div className="kb-reader">
          {/* Header bar */}
          <div className="kb-reader__bar">
            <button className="kb-back-btn" onClick={closeDetail}>← Quay lại</button>
            <div className="kb-reader__actions">
              {detailSaving && <span className="inbox-detail__saving">Đang lưu...</span>}
              <button className="btn btn-ghost kb-action-btn" onClick={handleDetailQuickDone} title="Làm xong luôn" style={{ color: 'var(--green)' }}>✓ Xong</button>
              <button className="btn btn-ghost kb-action-btn" onClick={handleDetailToTask} title="Chuyển thành Task">⚡ Task</button>
              <button className="btn btn-ghost kb-action-btn" onClick={() => setIsEditing(true)}>✏️ Sửa</button>
              <button className="btn btn-ghost kb-action-btn kb-action-btn--danger" onClick={handleDetailDelete} style={{ color: '#ef4444' }}>🗑 Xóa</button>
            </div>
          </div>

          <div className="kb-reader__layout">
            <div className="kb-reader__main">
              {/* Hero */}
              <div className="kb-reader__hero">
                <span className="kb-reader__emoji" style={{ '--type-color': '#8b5cf6' }}>📥</span>
                <h1 className="kb-reader__title" title={detailItem.title}>{detailItem.title}</h1>
                <div className="kb-reader__meta">
                  <span style={{ color: '#8b5cf6' }}>Inbox</span>
                  <span>·</span>
                  <span>{new Date(detailItem.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  <span>·</span>
                  <CustomSelect
                    className="kb-type-select"
                    style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}
                    value=""
                    placeholder="📂 Phân loại"
                    options={TYPES.map(t => ({ value: t.key, label: `${t.emoji} ${t.label}` }))}
                    onChange={(newType) => {
                      if (newType) handleDetailClassify(newType);
                    }}
                  />
                </div>
                {detailItem.url && (
                  <a href={detailItem.url} target="_blank" rel="noopener noreferrer" className="kb-reader__source">
                    🔗 Xem nguồn: {detailItem.url}
                  </a>
                )}
              </div>

              <div className="kb-reader__divider" />

              {/* Body */}
              <div className="kb-prose">
                {detailItem.body ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{detailItem.body}</ReactMarkdown>
                ) : (
                  <p className="kb-prose__empty">Chưa có nội dung. Nhấn ✏️ Sửa để thêm mô tả.</p>
                )}
              </div>
            </div>
          </div>

          {/* Classify footer removed - moved to header */}
        </div>
      )}

      {/* ═══ EDIT MODE (v4.6.0) ═══ */}
      {detailItem && isEditing && (
        <div className="kb-editor">
          {/* Top bar */}
          <div className="kb-editor__bar">
            <button className="kb-back-btn" onClick={() => setIsEditing(false)}>← Hủy</button>
            <button
              className="btn btn-primary kb-save-btn"
              onClick={handleDetailSave}
              disabled={!detailTitle.trim() || detailSaving}
            >
              {detailSaving ? '⏳ Đang lưu...' : '💾 Lưu'}
            </button>
          </div>

          {/* Title */}
          <div className="kb-editor__meta">
            <input
              className="kb-editor__title"
              value={detailTitle}
              onChange={(e) => setDetailTitle(e.target.value)}
              placeholder="Tiêu đề..."
              maxLength={500}
            />
          </div>

          {/* Body editor — KB-style split pane */}
          <div className="kb-editor__body">
            <div className="kb-split">
              <div className="kb-split__panes">
                <div className="kb-split__pane kb-split__pane--write">
                  <div className="kb-split__label">✍️ Viết</div>
                  <textarea
                    className="kb-split__textarea"
                    value={detailBody}
                    onChange={(e) => handleDetailBodyChange(e.target.value)}
                    placeholder="Viết mô tả, ghi chú chi tiết bằng Markdown..."
                    spellCheck={false}
                  />
                </div>
                <div className="kb-split__pane kb-split__pane--preview">
                  <div className="kb-split__label">👁 Preview</div>
                  <div className="kb-prose kb-split__preview">
                    {detailBody ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{detailBody}</ReactMarkdown>
                    ) : (
                      <p className="kb-prose__empty">Preview sẽ hiện ở đây...</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
