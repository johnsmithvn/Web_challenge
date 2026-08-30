import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCollections } from '../hooks/useCollections';
import { useUserTasks } from '../hooks/useUserTasks';

import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import KNOWLEDGE_DATA from '../data/knowledge.json';
import QuoteWidget from '../components/QuoteWidget';
import CustomSelect from '../components/CustomSelect';
import AppIcon from '../components/AppIcon';
import { parseCurrencyInput } from '../utils/currencyUtils';
import { toDateStr } from '../utils/dateUtils';
import SkeletonList from '../components/SkeletonList';
import '../styles/inbox.css';
import '../styles/collect.css';

const TYPES = KNOWLEDGE_DATA.types;

/**
 * Extract amount from Vietnamese-style text.
 * "Mua cafe 50k" → 50000
 * "Ăn trưa 120.000" → 120000
 * "Grab 35K" → 35000
 */
function extractAmount(text) {
  // Dùng chung parser để Inbox và Finance hiểu decimal/k/triệu y như nhau, nhưng
  // TẮT auto-K: ghi chú Inbox là câu người dùng đã viết ra, không phải ô nhập nhanh.
  // "đổ xăng 5000" phải thành 5.000đ; nhân thêm 1.000 ở đây là sửa số của họ.
  // Muốn 50 nghìn thì viết "50k" / "50 nghìn" — parser vẫn hiểu.
  const m = text.match(/\d[\d.,]*\s*[kKmM]?/);
  if (!m) return '';
  const n = parseCurrencyInput(m[0], { autoK: false });
  return n || '';
}

export default function InboxPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { items, isLoading, fetchItems, classifyItem, deleteItem, addItem, updateItem, snoozeItem, getSnoozedCount, fetchSnoozedItems } = useCollections();
  const { addTask } = useUserTasks();

  const [quickText, setQuickText] = useState('');
  const [classifying, setClassifying] = useState(null);
  const [snoozeMenu, setSnoozeMenu] = useState(null); // item.id or null
  const [snoozedCount, setSnoozedCount] = useState(0);
  const [showSnoozed, setShowSnoozed] = useState(false);
  const [snoozedItems, setSnoozedItems] = useState([]);
  const [overflowMenu, setOverflowMenu] = useState(null); // item.id or null
  const [filter, setFilter] = useState('all'); // 'all' | 'has_url' | 'recent'

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
    const until = toDateStr(d);
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
    const trimmed = quickText.trim();
    if (!trimmed) return;

    const isUrl = /^https?:\/\//i.test(trimmed);
    const words = trimmed.split(/\s+/);
    const isLong = words.length > 25 || trimmed.length > 100;

    // Auto-split: long text → truncated title + full body
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

  const finalizeConversion = useCallback(async (created, itemId, targetLabel) => {
    if (!created) {
      showToast(`Không thể tạo ${targetLabel}. Mục Inbox vẫn được giữ.`, { icon: 'warning' });
      return false;
    }
    const deleted = await deleteItem(itemId);
    if (!deleted) {
      showToast(`${targetLabel} đã được tạo nhưng mục Inbox chưa xóa được.`, { icon: 'warning' });
      return false;
    }
    return true;
  }, [deleteItem, showToast]);

  const convertToTask = useCallback(async (item, { description, completed = false } = {}) => {
    const created = await addTask({
      title: item.title,
      description: description ?? item.body ?? item.url ?? '',
      ...(completed ? { completed: true, completedAt: new Date().toISOString() } : {}),
    });
    return finalizeConversion(created, item.id, completed ? 'Task đã hoàn thành' : 'Task');
  }, [addTask, finalizeConversion]);

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
    closeDetail();
    fetchItems({ type: 'inbox' });
  }, [detailItem, classifyItem, closeDetail, fetchItems]);

  const handleDetailToTask = useCallback(async () => {
    if (!detailItem) return;
    const converted = await convertToTask(detailItem, { description: detailBody || detailItem.url || '' });
    if (!converted) return;
    closeDetail();
  }, [detailItem, detailBody, convertToTask, closeDetail]);

  const handleDetailQuickDone = useCallback(async () => {
    if (!detailItem) return;
    const converted = await convertToTask(detailItem, {
      description: detailBody || detailItem.url || '',
      completed: true,
    });
    if (!converted) return;
    closeDetail();
  }, [detailItem, detailBody, convertToTask, closeDetail]);

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
    await convertToTask(item);
  };

  // Convert inbox item → Completed Task today immediately
  const handleQuickDone = async (item) => {
    await convertToTask(item, { completed: true });
  };




  // Inbox → Giao dịch: sang module Chi tiêu, prefill form Nhập nhanh. Module xoá
  // mục Inbox sau khi ghi thành công (mang theo inboxId qua sessionStorage).
  const handleToExpense = (item) => {
    sessionStorage.setItem('lh_inbox_to_finance', JSON.stringify({
      kind: 'tx', title: item.title, amount: extractAmount(item.title) || undefined, inboxId: item.id,
    }));
    navigate('/finance');
  };

  // Inbox → Hóa đơn/Quy tắc: sang Chi tiêu › Hóa đơn (segment Phải trả), prefill tên.
  const handleToRule = (item) => {
    sessionStorage.setItem('lh_inbox_to_finance', JSON.stringify({
      kind: 'out', title: item.title, inboxId: item.id,
    }));
    navigate('/finance');
  };

  if (!user) {
    return (
      <div className="inbox-page">
        <div className="inbox-page__empty">
          <AppIcon name="lock" size={18} /> Đăng nhập để sử dụng Inbox
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
          <h1 className="inbox-page__title"><AppIcon name="inbox" size={27} weight="duotone" /> Inbox</h1>
          {snoozedCount > 0 && (
            <button
              onClick={handleToggleSnoozed}
              style={{
                fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)',
                background: showSnoozed ? 'rgba(234,179,8,0.25)' : 'rgba(234,179,8,0.12)',
                color: '#eab308', fontWeight: 600, border: 'none', cursor: 'pointer',
              }}
            >
              <AppIcon name="clock" size={13} /> {snoozedCount} snoozed <AppIcon name={showSnoozed ? 'caretDown' : 'caretRight'} size={11} />
            </button>
          )}
          {items.length > 0 && (
            <button
              onClick={() => { setBulkMode(v => !v); setBulkSelected(new Set()); setBulkClassifyMenu(false); }}
              className={`inbox-filter-chip${bulkMode ? ' inbox-filter-chip--active' : ''}`}
              style={{ marginLeft: '0.25rem' }}
            >
              <AppIcon name={bulkMode ? 'x' : 'checkSquare'} size={14} /> {bulkMode ? 'Thoát' : 'Chọn nhiều'}
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
            aria-label="Ghi nhanh vào Inbox"
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
            <AppIcon name="plus" size={15} /> Thêm
          </button>
        </div>

      </form>

      {/* Filter chips */}
      {items.length > 0 && (
        <div className="inbox-filter-chips">
          {[
            { key: 'all', label: 'Tất cả', icon: 'inbox' },
            { key: 'has_url', label: 'Có URL', icon: 'link' },
            { key: 'recent', label: 'Gần đây (7 ngày)', icon: 'calendar' },
          ].map(f => (
            <button
              key={f.key}
              className={`inbox-filter-chip${filter === f.key ? ' inbox-filter-chip--active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              <AppIcon name={f.icon} size={14} /> {f.label}
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
            <AppIcon name="clock" size={14} /> Đang tạm hoãn ({snoozedItems.length})
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

      {/* Daily quote */}
      <QuoteWidget pageKey="inbox" />

      {/* Items list */}
      {isLoading ? (
        <SkeletonList rows={5} label="Đang tải hộp thư" />
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
          <div className="inbox-page__empty-icon"><AppIcon name={items.length === 0 ? 'inbox' : 'search'} size={34} weight="duotone" /></div>
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
              <span style={{ color: 'var(--purple-light)', marginRight: '0.5rem' }}><AppIcon name="check" size={13} /> {bulkSelected.size} đã chọn</span>
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
                <AppIcon name={bulkSelected.size >= filtered.length ? 'square' : 'checkSquare'} size={14} /> {bulkSelected.size >= filtered.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </button>
              {bulkSelected.size > 0 && (
                <>
                  <button
                    className="inbox-bulk-bar__btn inbox-bulk-bar__btn--classify"
                    onClick={() => setBulkClassifyMenu(v => !v)}
                  >
                    <AppIcon name="folder" size={14} /> Phân loại ({bulkSelected.size})
                  </button>
                  <button
                    className="inbox-bulk-bar__btn inbox-bulk-bar__btn--delete"
                    onClick={async () => {
                      for (const id of bulkSelected) {
                        await deleteItem(id);
                      }
                      setBulkSelected(new Set());
                      setBulkMode(false);
                      fetchItems({ type: 'inbox' });
                    }}
                  >
                    <AppIcon name="trash" size={14} /> Xóa ({bulkSelected.size})
                  </button>
                </>
              )}
              {bulkClassifyMenu && bulkSelected.size > 0 && (
                <div className="inbox-bulk-classify-menu" style={{ padding: '0.2rem' }}>
                  <CustomSelect
                    className="kb-type-select"
                    value=""
                    placeholder="-- Chọn phân loại --"
                    options={TYPES.map(t => ({ value: t.key, label: t.label, icon: t.icon }))}
                    onChange={async (newType) => {
                      if (!newType) return;
                      for (const id of bulkSelected) {
                        await classifyItem(id, newType);
                      }
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
                      <AppIcon name="link" size={13} /> {item.title}
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
                      options={TYPES.map(t => ({ value: t.key, label: t.label, icon: t.icon }))}
                      onChange={(newType) => {
                        if (newType) handleClassify(item.id, newType);
                      }}
                    />
                    <button
                      className="inbox-item__classify-btn inbox-item__classify-btn--cancel"
                      style={{ marginLeft: '0.5rem' }}
                      onClick={() => setClassifying(null)}
                    >
                      <AppIcon name="x" size={13} /> Huỷ
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
                      <AppIcon name="x" size={13} /> Huỷ
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
                      <AppIcon name="check" size={14} /> Xong
                    </button>
                    <button
                      className="inbox-item__action-btn"
                      onClick={() => handleToTask(item)}
                      title="Chuyển thành Task"
                    >
                      <AppIcon name="pushPin" size={14} /> Task
                    </button>
                    <button
                      className="inbox-item__action-btn inbox-item__action-btn--delete"
                      onClick={() => handleDelete(item.id)}
                      title="Xóa"
                      aria-label={`Xóa: ${item.title}`}
                      style={{ color: '#ef4444' }}
                    >
                      <AppIcon name="trash" size={14} />
                    </button>

                    {/* Overflow menu trigger */}
                    <div className="inbox-overflow-wrap">
                      <button
                        className="inbox-item__action-btn inbox-overflow-trigger"
                        onClick={() => setOverflowMenu(overflowMenu === item.id ? null : item.id)}
                        title="Thêm hành động"
                        aria-label={`Thêm hành động cho: ${item.title}`}
                        aria-haspopup="menu"
                        aria-expanded={overflowMenu === item.id}
                      >
                        <AppIcon name="dots" size={17} />
                      </button>
                      {overflowMenu === item.id && (
                        <div className="inbox-overflow-menu">
                          <button className="inbox-overflow-item" onClick={() => { setClassifying(item.id); setOverflowMenu(null); }}>
                            <AppIcon name="folder" size={14} /> Phân loại
                          </button>
                          <button className="inbox-overflow-item" onClick={() => { handleToExpense(item); setOverflowMenu(null); }}>
                            <AppIcon name="handCoins" size={14} /> Giao dịch
                          </button>
                          <button className="inbox-overflow-item" onClick={() => { handleToRule(item); setOverflowMenu(null); }}>
                            <AppIcon name="refresh" size={14} /> Hóa đơn
                          </button>

                          <button className="inbox-overflow-item" onClick={() => { setSnoozeMenu(item.id); setOverflowMenu(null); }}>
                            <AppIcon name="clock" size={14} /> Snooze
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
            <button className="kb-back-btn" onClick={closeDetail}><AppIcon name="back" size={15} /> Quay lại</button>
            <div className="kb-reader__actions">
              {detailSaving && <span className="inbox-detail__saving">Đang lưu...</span>}
              <button className="btn btn-ghost kb-action-btn" onClick={handleDetailQuickDone} title="Làm xong luôn" style={{ color: 'var(--green)' }}><AppIcon name="check" size={15} /> Xong</button>
              <button className="btn btn-ghost kb-action-btn" onClick={handleDetailToTask} title="Chuyển thành Task"><AppIcon name="pushPin" size={15} /> Task</button>
              <button className="btn btn-ghost kb-action-btn" onClick={() => setIsEditing(true)}><AppIcon name="pencil" size={15} /> Sửa</button>
              <button className="btn btn-ghost kb-action-btn kb-action-btn--danger" onClick={handleDetailDelete} style={{ color: '#ef4444' }}><AppIcon name="trash" size={15} /> Xóa</button>
            </div>
          </div>

          <div className="kb-reader__layout">
            <div className="kb-reader__main">
              {/* Hero */}
              <div className="kb-reader__hero">
                <span className="kb-reader__emoji" style={{ '--type-color': '#8b5cf6' }}><AppIcon name="inbox" size={32} weight="duotone" /></span>
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
                    placeholder="Phân loại"
                    options={TYPES.map(t => ({ value: t.key, label: t.label, icon: t.icon }))}
                    onChange={(newType) => {
                      if (newType) handleDetailClassify(newType);
                    }}
                  />
                </div>
                {detailItem.url && (
                  <a href={detailItem.url} target="_blank" rel="noopener noreferrer" className="kb-reader__source">
                    <AppIcon name="external" size={14} /> Xem nguồn: {detailItem.url}
                  </a>
                )}
              </div>

              <div className="kb-reader__divider" />

              {/* Body */}
              <div className="kb-prose">
                {detailItem.body ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{detailItem.body}</ReactMarkdown>
                ) : (
                  <p className="kb-prose__empty">Chưa có nội dung. Chọn Sửa để thêm mô tả.</p>
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
            <button className="kb-back-btn" onClick={() => setIsEditing(false)}><AppIcon name="back" size={15} /> Hủy</button>
            <button
              className="btn btn-primary kb-save-btn"
              onClick={handleDetailSave}
              disabled={!detailTitle.trim() || detailSaving}
            >
              <AppIcon name={detailSaving ? 'clock' : 'save'} size={15} /> {detailSaving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>

          {/* Title */}
          <div className="kb-editor__meta">
            <input
              className="kb-editor__title"
              aria-label="Tiêu đề"
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
                  <div className="kb-split__label"><AppIcon name="pencil" size={14} /> Viết</div>
                  <textarea
                    className="kb-split__textarea"
                    aria-label="Nội dung Markdown"
                    value={detailBody}
                    onChange={(e) => handleDetailBodyChange(e.target.value)}
                    placeholder="Viết mô tả, ghi chú chi tiết bằng Markdown..."
                    spellCheck={false}
                  />
                </div>
                <div className="kb-split__pane kb-split__pane--preview">
                  <div className="kb-split__label"><AppIcon name="eye" size={14} /> Preview</div>
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
