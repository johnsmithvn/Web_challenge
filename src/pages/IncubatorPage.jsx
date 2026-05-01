import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntentions } from '../hooks/useIntentions';
import { useUserTasks } from '../hooks/useUserTasks';
import { useExpenses } from '../hooks/useExpenses';
import { useCustomHabits } from '../hooks/useCustomHabits';
import { useAuth } from '../contexts/AuthContext';
import EXPENSE_DATA from '../data/expense-categories.json';
import '../styles/incubator.css';

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

function daysAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
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
    addIntention, deferIntention, executeIntention, abandonIntention, getLogs,
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

  const todayStr = new Date().toISOString().split('T')[0];

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

  /* ── Defer ── */
  const handleDefer = useCallback(async () => {
    if (!deferModal || !deferReason.trim()) return;
    const d = new Date();
    d.setDate(d.getDate() + deferDays);
    const scheduledFor = d.toISOString().split('T')[0];
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
            const isExpanded = expandedId === item.id;

            return (
              <div key={item.id} className={`incubator-card${isReviewDue ? ' incubator-card--review' : ''}`}>
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
                    <span className="incubator-card__badge incubator-card__badge--duration">
                      ⏱ {formatDuration(item.estimated_time)}
                    </span>
                  )}
                  {item.review_date && (
                    <span className={`incubator-card__badge ${isReviewDue ? 'incubator-card__badge--review' : 'incubator-card__badge--time'}`}>
                      {isReviewDue ? '⚠️ Cần review!' : `📅 Review: ${new Date(item.review_date + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`}
                    </span>
                  )}
                  <span className="incubator-card__badge incubator-card__badge--age">
                    🕐 {daysAgo(item.created_at)}
                  </span>
                </div>

                <div className="incubator-card__actions">
                  <button
                    className="incubator-card__btn incubator-card__btn--execute"
                    onClick={() => openExecuteModal(item)}
                  >
                    ✅ Thực thi ngay
                  </button>
                  <button
                    className="incubator-card__btn incubator-card__btn--defer"
                    onClick={() => { setDeferModal(item); setDeferReason(''); setDeferDays(7); }}
                  >
                    💤 Dời lại
                  </button>
                  <button
                    className="incubator-card__btn incubator-card__btn--timeline"
                    onClick={() => toggleTimeline(item.id)}
                  >
                    {isExpanded ? '▾ Timeline' : '▸ Timeline'}
                  </button>
                  <button
                    className="incubator-card__btn incubator-card__btn--abandon"
                    onClick={() => abandonIntention(item.id, 'Không còn cần thiết')}
                  >
                    🗑
                  </button>
                </div>

                {/* Timeline logs */}
                {isExpanded && (
                  <div className="incubator-timeline">
                    {timelineLogs.length === 0 ? (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Chưa có lịch sử</div>
                    ) : (
                      timelineLogs.map(log => (
                        <div key={log.id} className="incubator-timeline__item">
                          <span className={`incubator-timeline__action incubator-timeline__action--${log.action}`}>
                            {ACTION_LABELS[log.action] || log.action}
                          </span>
                          {log.reason_note && (
                            <span className="incubator-timeline__note">{log.reason_note}</span>
                          )}
                          <span className="incubator-timeline__date">
                            {new Date(log.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
              <label className="incubator-modal__label">Lý do hoãn *</label>
              <textarea
                className="incubator-modal__input"
                rows={2}
                value={deferReason}
                onChange={e => setDeferReason(e.target.value)}
                placeholder="Tại sao chưa làm ngay? (bắt buộc)"
                autoFocus
              />
              <label className="incubator-modal__label">Nhắc lại sau</label>
              <div className="incubator-modal__options">
                {DEFER_OPTIONS.map(opt => (
                  <button
                    key={opt.days}
                    type="button"
                    className={`incubator-modal__option${deferDays === opt.days ? ' incubator-modal__option--active' : ''}`}
                    onClick={() => setDeferDays(opt.days)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="incubator-modal__footer">
              <button className="btn btn-ghost" onClick={() => setDeferModal(null)}>Huỷ</button>
              <button
                className="btn btn-primary"
                onClick={handleDefer}
                disabled={!deferReason.trim()}
              >
                💤 Xác nhận Dời lại
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
                        {EXPENSE_DATA.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
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
  );
}
