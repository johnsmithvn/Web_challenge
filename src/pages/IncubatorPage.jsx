import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useIntentions } from '../hooks/useIntentions';
import { useUserTasks } from '../hooks/useUserTasks';
import { useExpenses } from '../hooks/useExpenses';
import { useCustomHabits } from '../hooks/useCustomHabits';
import { useAuth } from '../contexts/AuthContext';
import EXPENSE_DATA from '../data/expense-categories.json';
import { parseCurrencyInput, formatVND } from '../utils/currencyUtils';
import CustomSelect from '../components/CustomSelect';
import '../styles/incubator.css';
import '../styles/collect.css';

function formatDuration(minutes) {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/* ── Timezone-safe local date string (YYYY-MM-DD) ─────────────── */
// NOTE: new Date().toISOString() returns UTC — wrong for Vietnam +07:00.
// Use local date components instead.
function localDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysAgo(dateStr) {
  const now   = new Date();
  const past  = new Date(dateStr);
  // Compare calendar dates in local timezone (not raw ms delta)
  const nowDay  = new Date(now.getFullYear(),  now.getMonth(),  now.getDate());
  const pastDay = new Date(past.getFullYear(), past.getMonth(), past.getDate());
  const diff = Math.round((nowDay - pastDay) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Hôm qua';
  return `${diff} ngày trước`;
}

const TIME_OPTIONS = [
  { value: '', label: '⏱ Tốn khoảng...' },
  { value: '15', label: '15 phút' },
  { value: '30', label: '30 phút' },
  { value: '60', label: '1 tiếng' },
  { value: '90', label: '1.5 tiếng' },
  { value: '120', label: '2 tiếng' },
  { value: '240', label: 'Nửa ngày' },
];

/* ── Custom Time Dropdown (glassmorphic, no native popup) ── */
function TimeDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = TIME_OPTIONS.find(o => o.value === value);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="incubator-dropdown" ref={ref}>
      <button
        type="button"
        className={`incubator-dropdown__trigger${open ? ' incubator-dropdown__trigger--open' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="incubator-dropdown__value">
          {selected?.value ? selected.label : '⏱ Tốn khoảng...'}
        </span>
        <span className={`incubator-dropdown__arrow${open ? ' incubator-dropdown__arrow--up' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="incubator-dropdown__menu">
          {TIME_OPTIONS.filter(o => o.value !== '').map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`incubator-dropdown__item${opt.value === value ? ' incubator-dropdown__item--active' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const DEFER_OPTIONS = [
  { label: '1 tuần', days: 7 },
  { label: '2 tuần', days: 14 },
  { label: '1 tháng', days: 30 },
  { label: '3 tháng', days: 90 },
];

const ACTION_LABELS = {
  created: 'Tạo mới',
  deferred: 'Dời lại',
  executed: 'Thực thi',
  abandoned: 'Bỏ qua',
  reviewed: 'Review',
};

/**
 * Build a rich Markdown description when converting an Incubator intention to a Task.
 * Composes all metadata (cost, time, reason, history, description) into one readable body.
 */
function buildTaskDescription(item, logs = []) {
  const sections = [];

  // 1. Estimates
  const estimates = [];
  if (item.estimated_cost) estimates.push(`💰 Chi phí: ~${formatVND(item.estimated_cost)}`);
  if (item.estimated_time) estimates.push(`⏱ Tốn khoảng: ~${formatDuration(item.estimated_time)}`);
  if (estimates.length) sections.push(estimates.join(' | '));

  // 2. Original reason
  if (item.original_reason) {
    sections.push(`💡 **Lý do ban đầu:**\n${item.original_reason}`);
  }

  // 3. History logs
  if (logs.length > 0) {
    const logLines = logs.map(log => {
      const d = new Date(log.created_at);
      const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      const action = ACTION_LABELS[log.action] || log.action;
      const note = log.reason_note ? `: ${log.reason_note}` : '';
      return `• ${dateStr} — ${action}${note}`;
    });
    sections.push(`📜 **Lịch sử ấp trứng:**\n${logLines.join('\n')}`);
  }

  // 4. Description (long-form content)
  if (item.description) {
    sections.push(`📝 **Mô tả chi tiết:**\n${item.description}`);
  }

  return sections.join('\n\n---\n\n') || '';
}

export default function IncubatorPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    intentions, isLoading, reviewDueCount, fetchIntentions,
    addIntention, updateIntention, deferIntention, executeIntention,
    abandonIntention, restoreIntention, deleteIntention, fetchAbandoned, getLogs,
  } = useIntentions();
  const { addTask } = useUserTasks();
  const { addExpense } = useExpenses();
  const { addHabit } = useCustomHabits();

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [cost, setCost] = useState('');
  const [time, setTime] = useState('');

  // Tab: 'incubating' | 'abandoned'
  const [activeTab, setActiveTab] = useState('incubating');
  const [archivedItems, setArchivedItems] = useState([]);
  const [archivedLoading, setArchivedLoading] = useState(false);

  // Defer modal
  const [deferModal, setDeferModal] = useState(null); // intention object
  const [deferReason, setDeferReason] = useState('');
  const [deferDays, setDeferDays] = useState(7);

  // Execute modal
  const [executeModal, setExecuteModal] = useState(null);
  const [execOptions, setExecOptions] = useState({ expense: false, habit: false, task: false });
  const [expenseCategory, setExpenseCategory] = useState('shopping');
  const [execLogs, setExecLogs] = useState([]);

  // Timeline expand
  const [expandedId, setExpandedId] = useState(null);
  const [timelineLogs, setTimelineLogs] = useState([]);

  // Detail view (replaces old editModal)
  const [detailItem, setDetailItem] = useState(null);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailReason, setDetailReason] = useState('');
  const [detailDescription, setDetailDescription] = useState('');
  const [detailCost, setDetailCost] = useState('');
  const [detailTime, setDetailTime] = useState('');
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailEditing, setDetailEditing] = useState(false);
  const [detailLogs, setDetailLogs] = useState([]);
  const [detailLogsLoading, setDetailLogsLoading] = useState(false);

  const todayStr = localDateStr(); // local date, NOT toISOString() which is UTC

  const toggleExec = (key) => setExecOptions(prev => ({ ...prev, [key]: !prev[key] }));
  const anySelected = execOptions.expense || execOptions.habit || execOptions.task;

  /* ── Add ── */
  const handleAdd = useCallback(async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    await addIntention({
      title: title.trim(),
      originalReason: reason.trim() || null,
      estimatedCost: cost ? parseCurrencyInput(cost) : null,
      estimatedTime: time ? parseInt(time, 10) : null,
    });
    setTitle(''); setReason(''); setCost(''); setTime(''); setShowForm(false);
  }, [title, reason, cost, time, addIntention]);

  /* ── Open Detail View ── */
  const openDetail = useCallback(async (item) => {
    setDetailItem(item);
    setDetailTitle(item.title || '');
    setDetailReason(item.original_reason || '');
    setDetailDescription(item.description || '');
    setDetailCost(item.estimated_cost ? String(item.estimated_cost) : '');
    setDetailTime(item.estimated_time ? String(item.estimated_time) : '');
    setDetailSaving(false);
    setDetailEditing(false);
    // Load timeline logs
    setDetailLogsLoading(true);
    const logs = await getLogs(item.id);
    setDetailLogs(logs);
    setDetailLogsLoading(false);
  }, [getLogs]);

  const closeDetail = useCallback(() => {
    setDetailItem(null);
    setDetailEditing(false);
  }, []);

  /* ── Save Detail Edit ── */
  const handleDetailSave = useCallback(async () => {
    if (!detailItem || !detailTitle.trim()) return;
    setDetailSaving(true);
    const ok = await updateIntention(detailItem.id, {
      title: detailTitle,
      originalReason: detailReason,
      description: detailDescription,
      estimatedCost: detailCost ? parseCurrencyInput(detailCost) : null,
      estimatedTime: detailTime || null,
    });
    setDetailSaving(false);
    if (ok) {
      setDetailItem(prev => prev ? { 
        ...prev, 
        title: detailTitle.trim(), 
        original_reason: detailReason.trim() || null, 
        description: detailDescription.trim() || null,
        estimated_cost: detailCost ? parseCurrencyInput(detailCost) : null, 
        estimated_time: detailTime ? parseInt(detailTime, 10) : null 
      } : null);
      setDetailEditing(false);
    }
  }, [detailItem, detailTitle, detailReason, detailDescription, detailCost, detailTime, updateIntention]);

  /* ── Defer ── */
  const handleDefer = useCallback(async () => {
    if (!deferModal || !deferReason.trim()) return;
    const d = new Date();
    d.setDate(d.getDate() + deferDays);
    const scheduledFor = localDateStr(d); // local date — not UTC
    await deferIntention(deferModal.id, { reason: deferReason, scheduledFor });
    setDeferModal(null); setDeferReason(''); setDeferDays(7);
  }, [deferModal, deferReason, deferDays, deferIntention]);

  /* ── Open Execute Modal (auto-suggest) ── */
  const openExecuteModal = useCallback(async (item) => {
    setExecuteModal(item);
    // Auto-suggest based on intention data
    setExecOptions({
      expense: !!item.estimated_cost,
      habit: !!item.estimated_time,
      task: !item.estimated_cost && !item.estimated_time, // default if no cost/time
    });
    setExpenseCategory('shopping');
    // Fetch logs for rich description when converting to Task
    const logs = await getLogs(item.id);
    setExecLogs(logs);
  }, [getLogs]);

  /* ── Execute (multi-dispatch) ── */
  const handleExecute = useCallback(async () => {
    if (!executeModal || !anySelected) return;

    const convertedTypes = [];
    const convertedIds = {};

    // 1. Expense
    if (execOptions.expense && executeModal.estimated_cost) {
      const exp = await addExpense({
        amount: executeModal.estimated_cost,
        category: expenseCategory,
        note: `Từ Incubator: ${executeModal.title}`,
        date: localDateStr(),
      });
      if (exp) {
        convertedTypes.push('expense');
        convertedIds.expense = exp.id;
      }
    }

    // 2. Habit
    if (execOptions.habit) {
      const hab = await addHabit({
        name: executeModal.title,
        action: executeModal.title,
        durationMin: executeModal.estimated_time || null,
      });
      if (hab) {
        convertedTypes.push('habit');
        convertedIds.habit = hab.id;
      }
    }

    // 3. Task
    if (execOptions.task) {
      const t = await addTask({
        title: executeModal.title,
        description: buildTaskDescription(executeModal, execLogs),
        durationEst: executeModal.estimated_time || null,
      });
      if (t) {
        convertedTypes.push('task');
        convertedIds.task = t.id;
      }
    }

    // Mark intention as executed
    await executeIntention(executeModal.id, { convertedTypes, convertedIds });

    // Navigate to most relevant page
    if (execOptions.task || execOptions.habit) {
      navigate('/tracker');
    } else if (execOptions.expense) {
      navigate('/finance');
    }

    setExecuteModal(null);
    setExecOptions({ expense: false, habit: false, task: false });
  }, [executeModal, execOptions, anySelected, expenseCategory, execLogs,
    addExpense, addHabit, addTask, executeIntention, navigate]);

  /* ── Toggle timeline ── */
  const toggleTimeline = useCallback(async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    const logs = await getLogs(id);
    setTimelineLogs(logs);
    setExpandedId(id);
  }, [expandedId, getLogs]);

  if (!user) {
    return (
      <div className="incubator-page">
        <div className="incubator-empty">🔐 Đăng nhập để sử dụng Incubator</div>
      </div>
    );
  }

  // Switch to abandoned tab
  const handleTabChange = useCallback(async (tab) => {
    setActiveTab(tab);
    if (tab === 'abandoned') {
      setArchivedLoading(true);
      const list = await fetchAbandoned();
      setArchivedItems(list);
      setArchivedLoading(false);
    }
  }, [fetchAbandoned]);

  // Restore abandoned item
  const handleRestore = useCallback(async (id) => {
    const ok = await restoreIntention(id);
    if (ok) {
      setArchivedItems(prev => prev.filter(i => i.id !== id));
    }
  }, [restoreIntention]);

  // Permanent delete
  const handlePermanentDelete = useCallback(async (id) => {
    const ok = await deleteIntention(id);
    if (ok) {
      setArchivedItems(prev => prev.filter(i => i.id !== id));
    }
  }, [deleteIntention]);

  return (
    <>
      {!detailItem && (
      <div className="incubator-page">
        <div className="incubator-page__header">
          <h1 className="incubator-page__title">🥚 Trạm Ấp Trứng</h1>
          <p className="incubator-page__subtitle">
            Nuôi dưỡng dự định — Dời lại phải có lý do
          </p>
        </div>

        {/* Tab bar */}
        <div className="incubator-tabs">
          <button
            className={`incubator-tab${activeTab === 'incubating' ? ' incubator-tab--active' : ''}`}
            onClick={() => handleTabChange('incubating')}
          >
            🥚 Đang ấp{intentions.length > 0 ? ` (${intentions.length})` : ''}
            {reviewDueCount > 0 && <span className="incubator-tab__badge">⚠️ {reviewDueCount}</span>}
          </button>
          <button
            className={`incubator-tab${activeTab === 'abandoned' ? ' incubator-tab--active' : ''}`}
            onClick={() => handleTabChange('abandoned')}
          >
            🗑 Đã bỏ qua{archivedItems.length > 0 ? ` (${archivedItems.length})` : ''}
          </button>
        </div>

        {/* ═══ TAB: Đang ấp ═══ */}
        {activeTab === 'incubating' && (
          <>
            {/* Add button */}
            <button
              className="incubator-add-btn"
              onClick={() => setShowForm(!showForm)}
            >
              {showForm ? '✕ Đóng' : '+ Thêm dự định'}
            </button>

            {/* Add Form */}
            {showForm && (
              <form className="incubator-form" onSubmit={handleAdd}>
                <input
                  className="incubator-form__input"
                  placeholder="Tên dự định *"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                  autoFocus
                />
                <input
                  className="incubator-form__input"
                  placeholder="Lý do ban đầu (tuỳ chọn)"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
                <div className="incubator-form__row">
                  <input
                    className="incubator-form__input incubator-form__input--cost"
                    type="text"
                    placeholder="Chi phí dự kiến (Ví dụ: 50, 50k, 10$)"
                    value={cost}
                    onChange={e => setCost(e.target.value)}
                  />
                  <TimeDropdown value={time} onChange={setTime} />
                </div>
                {cost && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '-0.25rem', marginBottom: '0.75rem', paddingLeft: '0.25rem' }}>
                    Xem trước: <strong style={{ color: 'var(--text-primary)' }}>{formatVND(parseCurrencyInput(cost))}</strong>
                    {/[$]|usd/i.test(cost) && ' (Quy đổi tỷ giá)'}
                  </div>
                )}
                <button type="submit" className="btn btn-primary" disabled={!title.trim()}
                  style={{ justifyContent: 'center' }}>
                  🥚 Thêm vào Trạm Ấp
                </button>
              </form>
            )}

            {/* Cards */}
            {isLoading ? (
              <div className="incubator-empty">⏳ Đang tải...</div>
            ) : intentions.length === 0 ? (
              <div className="incubator-empty">
                <div className="incubator-empty__icon">🥚</div>
                <p>Chưa có dự định nào đang ấp.</p>
                <p style={{ fontSize: '0.78rem' }}>Thêm ý tưởng, kế hoạch mua sắm, hoặc dự án "someday" vào đây.</p>
              </div>
            ) : (
              <div className="incubator-cards">
                {intentions.map(item => {
                  const isReviewDue = item.review_date && item.review_date <= todayStr;
                  return (
                    <div key={item.id}
                      className={`incubator-card${isReviewDue ? ' incubator-card--review' : ''}`}
                    >
                      <div className="incubator-card__body" onClick={() => openDetail(item)}>
                        <div className="incubator-card__title">
                          🥚 {item.title}
                        </div>
                        {item.original_reason && (
                          <div className="incubator-card__reason">
                            💡 "{item.original_reason}"
                          </div>
                        )}
                        <div className="incubator-card__meta">
                          {item.description && (
                            <span className="incubator-card__badge incubator-card__badge--desc">
                              📝 Có mô tả
                            </span>
                          )}
                          {item.estimated_cost && (
                            <span className="incubator-card__badge incubator-card__badge--cost">
                              💰 ~{formatVND(item.estimated_cost)}
                            </span>
                          )}
                          {item.estimated_time && (
                            <span className="incubator-card__badge incubator-card__badge--duration">
                              ⏱ ~{formatDuration(item.estimated_time)}
                            </span>
                          )}
                          {item.review_date && (
                            <span className={`incubator-card__badge ${isReviewDue ? 'incubator-card__badge--review' : 'incubator-card__badge--time'}`}>
                              {isReviewDue ? '⚠️ Cần review!' : `📅 ${(() => { const d = new Date(item.review_date + 'T00:00:00'); return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0'); })()}`}
                            </span>
                          )}
                          <span className="incubator-card__badge incubator-card__badge--age">
                            📅 {daysAgo(item.created_at)}
                          </span>
                        </div>
                      </div>
                      <div className="incubator-card__actions">
                        <button
                          className="incubator-card__btn incubator-card__btn--execute"
                          onClick={(e) => { e.stopPropagation(); openExecuteModal(item); }}
                        >
                          ✅ Thực thi
                        </button>
                        <button
                          className="incubator-card__btn incubator-card__btn--defer"
                          onClick={(e) => { e.stopPropagation(); setDeferModal(item); setDeferReason(''); setDeferDays(7); }}
                        >
                          💤 Dời
                        </button>
                        <button
                          className="incubator-card__btn incubator-card__btn--abandon"
                          onClick={(e) => { e.stopPropagation(); abandonIntention(item.id, 'Không còn cần thiết'); }}
                        >
                          🗑 Bỏ
                        </button>
                        <button
                          className="incubator-card__btn incubator-card__btn--timeline"
                          onClick={(e) => { e.stopPropagation(); toggleTimeline(item.id); }}
                        >
                          {expandedId === item.id ? '▲ Ẩn' : '📜 Lịch sử'}
                        </button>
                      </div>
                      {/* Timeline expand */}
                      {expandedId === item.id && (
                        <div className="incubator-card__timeline">
                          {timelineLogs.length === 0 ? (
                            <div className="incubator-card__timeline-empty">Chưa có lịch sử</div>
                          ) : (
                            timelineLogs.map((log, i) => {
                              const d = new Date(log.created_at);
                              const dateStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
                              return (
                                <div key={i} className="incubator-card__timeline-item">
                                  <span className="incubator-card__timeline-date">{dateStr}</span>
                                  <span className="incubator-card__timeline-action">{ACTION_LABELS[log.action] || log.action}</span>
                                  {log.reason_note && <span className="incubator-card__timeline-note">— {log.reason_note}</span>}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ═══ TAB: Đã bỏ qua ═══ */}
        {activeTab === 'abandoned' && (
          <>
            {archivedLoading ? (
              <div className="incubator-empty">⏳ Đang tải...</div>
            ) : archivedItems.length === 0 ? (
              <div className="incubator-empty">
                <div className="incubator-empty__icon">✨</div>
                <p>Không có dự định nào bị bỏ qua.</p>
              </div>
            ) : (
              <div className="incubator-cards">
                {archivedItems.map(item => (
                  <div key={item.id} className="incubator-card incubator-card--abandoned">
                    <div className="incubator-card__body">
                      <div className="incubator-card__title">
                        🗑 {item.title}
                      </div>
                      {item.original_reason && (
                        <div className="incubator-card__reason">
                          💡 "{item.original_reason}"
                        </div>
                      )}
                      <div className="incubator-card__meta">
                        <span className="incubator-card__badge incubator-card__badge--age">
                          📅 Bỏ: {daysAgo(item.updated_at)}
                        </span>
                      </div>
                    </div>
                    <div className="incubator-card__actions">
                      <button
                        className="incubator-card__btn incubator-card__btn--restore"
                        onClick={() => handleRestore(item.id)}
                      >
                        ♻️ Khôi phục
                      </button>
                      <button
                        className="incubator-card__btn incubator-card__btn--delete"
                        onClick={() => handlePermanentDelete(item.id)}
                      >
                        🗑 Xóa vĩnh viễn
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      )}

      {/* ── Defer Modal (rendered outside page guard so it works from detail view too) ── */}
      {deferModal && (
        <div className="incubator-modal-backdrop" onClick={() => setDeferModal(null)}>
          <div className="incubator-modal" onClick={e => e.stopPropagation()}>
            <div className="incubator-modal__header">
              <span>💤 Dời lại: {deferModal.title}</span>
              <button className="incubator-modal__close" onClick={() => setDeferModal(null)}>✕</button>
            </div>
            <div className="incubator-modal__body">
              <label className="incubator-modal__label">Lý do dời *</label>
              <textarea
                className="incubator-modal__input"
                placeholder="Tại sao bạn muốn dời lại?"
                value={deferReason}
                onChange={e => setDeferReason(e.target.value)}
                rows={2}
                autoFocus
              />
              <label className="incubator-modal__label" style={{ marginTop: '0.5rem' }}>Review lại sau</label>
              <div className="incubator-modal__options">
                {[{l:'1 tuần',d:7},{l:'2 tuần',d:14},{l:'1 tháng',d:30},{l:'3 tháng',d:90}].map(o => (
                  <button key={o.d}
                    className={`incubator-modal__option${deferDays===o.d ? ' incubator-modal__option--active' : ''}`}
                    onClick={() => setDeferDays(o.d)}
                  >{o.l}</button>
                ))}
              </div>
            </div>
            <div className="incubator-modal__footer">
              <button className="btn btn-ghost" onClick={() => setDeferModal(null)}>Huỷ</button>
              <button className="btn btn-primary" onClick={handleDefer} disabled={!deferReason.trim()}>
                💤 Dời lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Execute Modal (Multi-Output) ── */}
      {executeModal && (
        <div className="incubator-modal-backdrop" onClick={() => setExecuteModal(null)}>
          <div className="incubator-modal incubator-modal--execute" onClick={e => e.stopPropagation()}>
            <div className="incubator-modal__header">
              <span>✅ Thực thi: {executeModal.title}</span>
              <button className="incubator-modal__close" onClick={() => setExecuteModal(null)}>✕</button>
            </div>
            <div className="incubator-modal__body">
              <label className="incubator-modal__label">Phân bổ nguồn lực cho dự định này:</label>

              {/* Option: Expense */}
              <div
                className={`incubator-exec-option${execOptions.expense ? ' incubator-exec-option--active' : ''}${!executeModal.estimated_cost ? ' incubator-exec-option--dim' : ''}`}
                onClick={() => toggleExec('expense')}
              >
                <span className="incubator-exec-checkbox">{execOptions.expense ? '✓' : ''}</span>
                <div className="incubator-exec-option__content">
                  <div className="incubator-exec-option__title">💰 Ghi nhận Chi tiêu</div>
                  <div className="incubator-exec-option__info">
                    {executeModal.estimated_cost
                      ? `Tự động điền ${formatVND(executeModal.estimated_cost)}`
                      : 'Không có chi phí ước tính'}
                  </div>
                  {execOptions.expense && executeModal.estimated_cost && (
                    <div className="incubator-exec-option__sub" onClick={e => e.stopPropagation()}>
                      <CustomSelect
                        className="incubator-exec-category"
                        style={{ width: '100%' }}
                        value={expenseCategory}
                        onChange={val => setExpenseCategory(val)}
                        options={EXPENSE_DATA.categories.map(cat => ({ value: cat.key, label: `${cat.icon} ${cat.label}` }))}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Option: Habit */}
              <div
                className={`incubator-exec-option${execOptions.habit ? ' incubator-exec-option--active' : ''}`}
                onClick={() => toggleExec('habit')}
              >
                <span className="incubator-exec-checkbox">{execOptions.habit ? '✓' : ''}</span>
                <div className="incubator-exec-option__content">
                  <div className="incubator-exec-option__title">🔁 Tạo Thói quen</div>
                  <div className="incubator-exec-option__info">
                    "{executeModal.title}"
                    {executeModal.estimated_time ? ` · ⏱ ${formatDuration(executeModal.estimated_time)}/ngày` : ''}
                  </div>
                </div>
              </div>

              {/* Option: Task */}
              <div
                className={`incubator-exec-option${execOptions.task ? ' incubator-exec-option--active' : ''}`}
                onClick={() => toggleExec('task')}
              >
                <span className="incubator-exec-checkbox">{execOptions.task ? '✓' : ''}</span>
                <div className="incubator-exec-option__content">
                  <div className="incubator-exec-option__title">📌 Tạo Công việc</div>
                  <div className="incubator-exec-option__info">
                    Thêm vào danh sách Task hôm nay
                  </div>
                </div>
              </div>
            </div>
            <div className="incubator-modal__footer">
              <button className="btn btn-ghost" onClick={() => setExecuteModal(null)}>Huỷ</button>
              <button
                className="btn btn-primary"
                onClick={handleExecute}
                disabled={!anySelected}
              >
                ✅ Thực thi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DETAIL VIEW — inline, replaces page content (same pattern as InboxPage) ═══ */}
      {detailItem && !detailEditing && (
        <div className="kb-reader">
          {/* Header bar */}
          <div className="kb-reader__bar">
            <button className="kb-back-btn" onClick={closeDetail}>← Quay lại</button>
            <div className="kb-reader__actions">
              {detailSaving && <span className="inbox-detail__saving">Đang lưu...</span>}
              <button className="btn btn-ghost kb-action-btn" onClick={() => { openExecuteModal(detailItem); }} title="Thực thi dự định">✅ Thực thi</button>
              <button className="btn btn-ghost kb-action-btn" onClick={() => { setDeferModal(detailItem); setDeferReason(''); setDeferDays(7); }} title="Dời lại">💤 Dời</button>
              <button className="btn btn-ghost kb-action-btn" onClick={() => setDetailEditing(true)}>✏️ Sửa</button>
              <button className="btn btn-ghost kb-action-btn kb-action-btn--danger" onClick={() => { abandonIntention(detailItem.id, 'Không còn cần thiết'); closeDetail(); }}>🗑 Bỏ</button>
            </div>
          </div>

          <div className="kb-reader__layout">
            <div className="kb-reader__main">
              {/* Hero */}
              <div className="kb-reader__hero">
                <span className="kb-reader__emoji" style={{ '--type-color': '#a78bfa' }}>🥚</span>
                <h1 className="kb-reader__title" title={detailItem.title}>{detailItem.title}</h1>
                <div className="kb-reader__meta">
                  <span style={{ color: '#a78bfa' }}>Incubator</span>
                  <span>·</span>
                  <span>{daysAgo(detailItem.created_at)}</span>
                  {detailItem.review_date && (
                    <>
                      <span>·</span>
                      <span style={{ color: detailItem.review_date <= todayStr ? '#eab308' : 'var(--text-secondary)' }}>
                        Review: {(() => { const d = new Date(detailItem.review_date + 'T00:00:00'); return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0'); })()}
                        {detailItem.review_date <= todayStr && ' ⚠️'}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="kb-reader__divider" />

              {/* Content sections */}
              <div className="kb-prose">
                {/* Reason */}
                {detailItem.original_reason && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>💡 Lý do ban đầu</div>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{detailItem.original_reason}</p>
                  </div>
                )}

                {/* Estimates */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>📊 Thông số ước tính</div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className="incubator-card__badge incubator-card__badge--cost" style={{ fontSize: '0.82rem' }}>
                      💰 {detailItem.estimated_cost ? `~${formatVND(detailItem.estimated_cost)}` : 'Chưa có'}
                    </span>
                    <span className="incubator-card__badge incubator-card__badge--duration" style={{ fontSize: '0.82rem' }}>
                      ⏱ {detailItem.estimated_time ? `~${formatDuration(detailItem.estimated_time)} để làm` : 'Chưa có'}
                    </span>
                    {detailItem.defer_count > 0 && (
                      <span className="incubator-card__badge incubator-card__badge--review" style={{ fontSize: '0.82rem' }}>
                        💤 Đã dời {detailItem.defer_count} lần
                      </span>
                    )}
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>📜 Lịch sử</div>
                  {detailLogsLoading ? (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>⏳ Đang tải...</p>
                  ) : detailLogs.length === 0 ? (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Chưa có lịch sử</p>
                  ) : (
                    <div className="incubator-timeline" style={{ marginTop: 0 }}>
                      {detailLogs.map(log => (
                        <div key={log.id} className="incubator-timeline__item">
                          <span className={`incubator-timeline__action incubator-timeline__action--${log.action}`}>
                            {ACTION_LABELS[log.action] || log.action}
                          </span>
                          {log.reason_note && (
                            <span className="incubator-timeline__note">{log.reason_note}</span>
                          )}
                          <span className="incubator-timeline__date">
                            {(() => {
                              const d = new Date(log.created_at);
                              const now = new Date();
                              const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                              const nDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                              const diff = Math.round((nDay - dDay) / 864e5);
                              if (diff === 0) return 'Hôm nay';
                              if (diff === 1) return 'Hôm qua';
                              return `${String(d.getDate()).padStart(2,'0')} Th.${d.getMonth()+1}`;
                            })()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Description */}
                {detailItem.description && (
                  <>
                    <div className="kb-reader__divider" style={{ margin: '1.5rem 0' }} />
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>📝 Mô tả chi tiết</div>
                      <div className="kb-prose" style={{ padding: 0 }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{detailItem.description}</ReactMarkdown>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EDIT MODE — inline, same pattern as InboxPage ═══ */}
      {detailItem && detailEditing && (
        <div className="kb-editor">
          <div className="kb-editor__bar">
            <button className="kb-back-btn" onClick={() => {
              setDetailEditing(false);
              setDetailTitle(detailItem.title || '');
              setDetailReason(detailItem.original_reason || '');
              setDetailDescription(detailItem.description || '');
              setDetailCost(detailItem.estimated_cost ? String(detailItem.estimated_cost) : '');
              setDetailTime(detailItem.estimated_time ? String(detailItem.estimated_time) : '');
            }}>← Hủy</button>
            <button
              className="btn btn-primary kb-save-btn"
              onClick={handleDetailSave}
              disabled={!detailTitle.trim() || detailSaving}
            >
              {detailSaving ? '⏳ Đang lưu...' : '💾 Lưu'}
            </button>
          </div>

          <div className="kb-editor__meta">
            <input
              className="kb-editor__title"
              value={detailTitle}
              onChange={(e) => setDetailTitle(e.target.value)}
              placeholder="Tên dự định..."
              autoFocus
            />
          </div>

          <div className="kb-editor__body">
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Reason */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>💡 Lý do ban đầu</label>
                <textarea
                  className="incubator-modal__input"
                  rows={2}
                  value={detailReason}
                  onChange={e => setDetailReason(e.target.value)}
                  placeholder="Tại sao bạn muốn làm điều này?"
                />
              </div>

              {/* Cost & Time */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>📊 Thông số ước tính</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    className="incubator-modal__input"
                    type="text"
                    placeholder="Chi phí (Ví dụ: 50, 50k, 10$)"
                    value={detailCost}
                    onChange={e => setDetailCost(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <TimeDropdown value={detailTime} onChange={setDetailTime} />
                </div>
                {detailCost && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem', paddingLeft: '0.25rem' }}>
                    Xem trước: <strong style={{ color: 'var(--text-primary)' }}>{formatVND(parseCurrencyInput(detailCost))}</strong>
                    {/[$]|usd/i.test(detailCost) && ' (Quy đổi tỷ giá)'}
                  </div>
                )}
                </div>

              {/* Description */}
              <div className="kb-split">
                <div className="kb-split__panes" style={{ height: '300px' }}>
                  <div className="kb-split__pane kb-split__pane--write">
                    <div className="kb-split__label">✍️ Viết Mô tả chi tiết</div>
                    <textarea
                      className="kb-split__textarea"
                      value={detailDescription}
                      onChange={(e) => setDetailDescription(e.target.value)}
                      placeholder="Viết mô tả, ghi chú chi tiết bằng Markdown..."
                      spellCheck={false}
                    />
                  </div>
                  <div className="kb-split__pane kb-split__pane--preview">
                    <div className="kb-split__label">👁 Preview</div>
                    <div className="kb-prose kb-split__preview" style={{ padding: '0.75rem' }}>
                      {detailDescription ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{detailDescription}</ReactMarkdown>
                      ) : (
                        <p className="kb-prose__empty">Preview sẽ hiện ở đây...</p>
                      )}
                    </div>
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

