import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntentions } from '../hooks/useIntentions';
import { useUserTasks } from '../hooks/useUserTasks';
import { useExpenses } from '../hooks/useExpenses';
import { useCustomHabits } from '../hooks/useCustomHabits';
import { useAuth } from '../contexts/AuthContext';
import EXPENSE_DATA from '../data/expense-categories.json';
import '../styles/incubator.css';
import '../styles/collect.css';

function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
}

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

export default function IncubatorPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    intentions, isLoading, reviewDueCount,
    addIntention, updateIntention, deferIntention, executeIntention,
    abandonIntention, deleteIntention, fetchAbandoned, getLogs,
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

  // Defer modal
  const [deferModal, setDeferModal] = useState(null); // intention object
  const [deferReason, setDeferReason] = useState('');
  const [deferDays, setDeferDays] = useState(7);

  // Execute modal
  const [executeModal, setExecuteModal] = useState(null);
  const [execOptions, setExecOptions] = useState({ expense: false, habit: false, task: false });
  const [expenseCategory, setExpenseCategory] = useState('shopping');

  // Timeline expand
  const [expandedId, setExpandedId] = useState(null);
  const [timelineLogs, setTimelineLogs] = useState([]);

  // Detail view (replaces old editModal)
  const [detailItem, setDetailItem] = useState(null);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailReason, setDetailReason] = useState('');
  const [detailCost, setDetailCost] = useState('');
  const [detailTime, setDetailTime] = useState('');
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailEditing, setDetailEditing] = useState(false);
  const [detailLogs, setDetailLogs] = useState([]);
  const [detailLogsLoading, setDetailLogsLoading] = useState(false);

  const todayStr = localDateStr(); // local date, NOT toISOString() which is UTC

  // Archive (abandoned) view
  const [showArchive, setShowArchive] = useState(false);
  const [archivedItems, setArchivedItems] = useState([]);

  const toggleExec = (key) => setExecOptions(prev => ({ ...prev, [key]: !prev[key] }));
  const anySelected = execOptions.expense || execOptions.habit || execOptions.task;

  /* ── Add ── */
  const handleAdd = useCallback(async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    await addIntention({
      title: title.trim(),
      originalReason: reason.trim() || null,
      estimatedCost: cost ? parseInt(cost, 10) : null,
      estimatedTime: time ? parseInt(time, 10) : null,
    });
    setTitle(''); setReason(''); setCost(''); setTime(''); setShowForm(false);
  }, [title, reason, cost, time, addIntention]);

  /* ── Open Detail View ── */
  const openDetail = useCallback(async (item) => {
    setDetailItem(item);
    setDetailTitle(item.title || '');
    setDetailReason(item.original_reason || '');
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
      estimatedCost: detailCost || null,
      estimatedTime: detailTime || null,
    });
    setDetailSaving(false);
    if (ok) {
      setDetailItem(prev => prev ? { ...prev, title: detailTitle.trim(), original_reason: detailReason.trim() || null, estimated_cost: detailCost ? parseInt(detailCost, 10) : null, estimated_time: detailTime ? parseInt(detailTime, 10) : null } : null);
      setDetailEditing(false);
    }
  }, [detailItem, detailTitle, detailReason, detailCost, detailTime, updateIntention]);

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
  const openExecuteModal = useCallback((item) => {
    setExecuteModal(item);
    // Auto-suggest based on intention data
    setExecOptions({
      expense: !!item.estimated_cost,
      habit: !!item.estimated_time,
      task: !item.estimated_cost && !item.estimated_time, // default if no cost/time
    });
    setExpenseCategory('shopping');
  }, []);

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
        date: todayStr,
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
        description: executeModal.original_reason || '',
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
  }, [executeModal, execOptions, anySelected, expenseCategory, todayStr,
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

  return (
    <>
      {!detailItem && (
      <div className="incubator-page">
        <div className="incubator-page__header">
          <h1 className="incubator-page__title">🥚 Trạm Ấp Trứng</h1>
          <p className="incubator-page__subtitle">
            Nuôi dưỡng dự định — Dời lại phải có lý do
          </p>
          <div className="incubator-page__stats">
            {intentions.length > 0 && (
              <span className="incubator-page__stat incubator-page__stat--count">
                {intentions.length} đang ấp
              </span>
            )}
            {reviewDueCount > 0 && (
              <span className="incubator-page__stat incubator-page__stat--review">
                ⚠️ {reviewDueCount} cần review
              </span>
            )}
          </div>
        </div>

        {/* Add button */}
        <button
          className="incubator-card__btn"
          onClick={() => setShowForm(!showForm)}
          style={{ width: '100%', marginBottom: '0.75rem', padding: '0.5rem', justifyContent: 'center',
            background: 'rgba(139,92,246,0.06)', borderColor: 'rgba(139,92,246,0.15)', color: 'var(--purple-light)' }}
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
                type="number"
                placeholder="Chi phí dự kiến"
                value={cost}
                onChange={e => setCost(e.target.value)}
                min="0"
              />
              <TimeDropdown value={time} onChange={setTime} />
            </div>
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
                  className={`incubator-card${isReviewDue ? ' incubator-card--review' : ''} incubator-card--clickable`}
                  onClick={() => openDetail(item)}
                >
                  <div className="incubator-card__title">
                    🥚 {item.title}
                  </div>
                  {item.original_reason && (
                    <div className="incubator-card__reason">
                      💡 "{item.original_reason}"
                    </div>
                  )}
                  <div className="incubator-card__meta">
                    {item.estimated_cost && (
                      <span className="incubator-card__badge incubator-card__badge--cost">
                        💰 ~{formatVND(item.estimated_cost)}
                      </span>
                    )}
                    {item.estimated_time && (
                      <span className="incubator-card__badge incubator-card__badge--duration" title="Thời gian ước tính để thực hiện">
                        ⏱ ~{formatDuration(item.estimated_time)} để làm
                      </span>
                    )}
                    {item.review_date && (
                      <span className={`incubator-card__badge ${isReviewDue ? 'incubator-card__badge--review' : 'incubator-card__badge--time'}`}>
                        {isReviewDue ? '⚠️ Cần review!' : `📅 Review: ${(() => { const d = new Date(item.review_date + 'T00:00:00'); return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0'); })()}`}
                      </span>
                    )}
                    <span className="incubator-card__badge incubator-card__badge--age" title="Ngày tạo dự định">
                      📅 Tạo: {daysAgo(item.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Archive */}
        <button
          className="incubator-card__btn"
          onClick={async () => {
            if (!showArchive) {
              const list = await fetchAbandoned();
              setArchivedItems(list);
            }
            setShowArchive(v => !v);
          }}
          style={{ width: '100%', marginTop: '1rem', padding: '0.5rem', justifyContent: 'center',
            background: 'transparent', borderColor: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}
        >
          {showArchive ? '▲ Ẩn dự định đã bỏ qua' : '▼ Xem dự định đã bỏ qua'}
        </button>
        {showArchive && (
          <div className="incubator-cards" style={{ marginTop: '0.5rem' }}>
            {archivedItems.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '1rem' }}>
                Chưa có dự định nào bị bỏ qua
              </div>
            ) : (
              archivedItems.map(item => (
                <div key={item.id} className="incubator-card" style={{ opacity: 0.5 }}>
                  <div className="incubator-card__title">🗑 {item.title}</div>
                  {item.original_reason && (
                    <div className="incubator-card__reason">💡 "{item.original_reason}"</div>
                  )}
                  <div className="incubator-card__meta">
                    <span className="incubator-card__badge incubator-card__badge--age">
                      📅 Bỏ: {daysAgo(item.updated_at)}
                    </span>
                  </div>
                  <div className="incubator-card__actions">
                    <button
                      className="incubator-card__btn incubator-card__btn--abandon"
                      style={{ opacity: 1, color: '#f87171' }}
                      onClick={() => deleteIntention(item.id).then(() => setArchivedItems(prev => prev.filter(i => i.id !== item.id)))}
                    >
                      🗑 Xóa vĩnh viễn
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Defer Modal ── */}
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
                        <select
                          className="incubator-exec-category"
                          value={expenseCategory}
                          onChange={e => setExpenseCategory(e.target.value)}
                        >
                          {EXPENSE_DATA.categories.map(cat => (
                            <option key={cat.key} value={cat.key}>{cat.icon} {cat.label}</option>
                          ))}
                        </select>
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
                    type="number"
                    placeholder="Chi phí (₫)"
                    value={detailCost}
                    onChange={e => setDetailCost(e.target.value)}
                    min="0"
                    style={{ flex: 1 }}
                  />
                  <div style={{ flex: 1 }}>
                    <TimeDropdown value={detailTime} onChange={setDetailTime} />
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

