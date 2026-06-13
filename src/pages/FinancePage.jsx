import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useExpenses } from '../hooks/useExpenses';
import { useSubscriptions } from '../hooks/useSubscriptions';
import { useActivityLog } from '../hooks/useActivityLog';
import { useCollections } from '../hooks/useCollections';
import { useTags } from '../hooks/useTags';
import { useAuth } from '../contexts/AuthContext';
import CashflowBar from '../components/CashflowBar';
import TagPicker from '../components/TagPicker';
import EXPENSE_DATA from '../data/expense-categories.json';
import CustomSelect from '../components/CustomSelect';
import GenericModal from '../components/GenericModal';
import { parseCurrencyInput, formatVND } from '../utils/currencyUtils';
import '../styles/finance.css';

const CATEGORIES = EXPENSE_DATA.categories;
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

// Get current month date range
function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  return { start, end };
}


/* ── Inline SVG Pie Chart ─────────────────────────────────── */
function PieChart({ data, total }) {
  if (!data.length || total === 0) return null;

  const r = 52;
  const cx = 65;
  const cy = 65;
  let cumAngle = -90; // start at top

  const slices = data.map(({ category, total: sliceTotal }) => {
    const cat = CAT_MAP[category] || { color: '#64748b' };
    const pct = sliceTotal / total;
    const angle = pct * 360;
    const startAngle = cumAngle;
    cumAngle += angle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = ((startAngle + angle) * Math.PI) / 180;
    const largeArc = angle > 180 ? 1 : 0;

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);

    const d = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;

    return { d, color: cat.color, pct };
  });

  return (
    <div className="finance-pie">
      <svg width="130" height="130" viewBox="0 0 130 130">
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} stroke="var(--bg-primary)" strokeWidth="1.5" opacity={0.85} />
        ))}
        <circle cx={cx} cy={cy} r="28" fill="var(--bg-primary)" />
        <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--text-primary)" fontSize="11" fontWeight="700">
          {formatVND(total)}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--text-muted)" fontSize="7.5">
          Tổng tháng
        </text>
      </svg>
    </div>
  );
}

export default function FinancePage() {
  const { user } = useAuth();
  const location = useLocation();
  const { expenses, isLoading: expLoading, fetchExpenses, addExpense, updateExpense, deleteExpense, getTotal, getByCategory } = useExpenses();
  const { subs, isLoading: subLoading, fetchSubs, addSub, deleteSub, toggleActive, getMonthlyCost, getUpcoming } = useSubscriptions();
  const { logActivity } = useActivityLog();
  const { deleteItem: deleteInboxItem } = useCollections();
  const { tags, addTag, linkTag } = useTags();

  const [tab, setTab] = useState('expense');
  const [showAddExp, setShowAddExp] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);
  const [pendingInboxId, setPendingInboxId] = useState(null);

  // Expense form state
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('food');
  const [expNote, setExpNote] = useState('');

  // Sub form state
  const [subName, setSubName] = useState('');
  const [subAmount, setSubAmount] = useState('');
  const [subCycle, setSubCycle] = useState('monthly');
  const [subDue, setSubDue] = useState('');
  const [subIcon, setSubIcon] = useState('📦');

  // Tag selection state
  const [expTagIds, setExpTagIds] = useState([]);
  const [subTagIds, setSubTagIds] = useState([]);

  // Edit expense state
  const [editExp, setEditExp] = useState(null); // expense object being edited
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editNote, setEditNote] = useState('');

  // Auto-calculate next due date from today based on cycle
  const calcNextDue = (cycle) => {
    const d = new Date();
    if (cycle === 'monthly')    d.setMonth(d.getMonth() + 1);
    else if (cycle === '3month') d.setMonth(d.getMonth() + 3);
    else if (cycle === '6month') d.setMonth(d.getMonth() + 6);
    else if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  };

  // ── Inbox → Subscription handoff ─────────────────────────
  // location.key changes on every navigation, so this re-runs each visit
  useEffect(() => {
    const raw = sessionStorage.getItem('lh_inbox_to_sub');
    if (!raw) return;
    try {
      const { title, inboxId } = JSON.parse(raw);
      sessionStorage.removeItem('lh_inbox_to_sub');
      setSubName(title);
      setSubDue(calcNextDue('monthly'));
      setTab('subs');
      setShowAddSub(true);
      setPendingInboxId(inboxId);
    } catch {
      // legacy plain-string fallback
      sessionStorage.removeItem('lh_inbox_to_sub');
      setSubName(raw);
      setSubDue(calcNextDue('monthly'));
      setTab('subs');
      setShowAddSub(true);
    }
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load data on mount
  useEffect(() => {
    if (!user) return;
    const { start, end } = getMonthRange();
    fetchExpenses(start, end);
    fetchSubs();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddExpense = async (e) => {
    e.preventDefault();
    const amount = parseCurrencyInput(expAmount);
    if (!amount || amount <= 0) return;

    const cat = CAT_MAP[expCategory];
    
    // Auto-append USD metadata to notes if USD is detected in input
    let finalNote = expNote;
    if (/[$]|usd/i.test(expAmount)) {
      const originalText = expAmount.trim();
      finalNote = expNote ? `${expNote} (${originalText})` : originalText;
    }

    const result = await addExpense({ amount, category: expCategory, note: finalNote });
    if (result) {
      logActivity('expense_add', `${formatVND(amount)} ${cat?.label || expCategory}`, amount, {
        category: expCategory,
      });
      // Link tags
      for (const tagId of expTagIds) {
        await linkTag(result.id, tagId, 'expense');
      }
      setExpAmount('');
      setExpNote('');
      setExpTagIds([]);
      setShowAddExp(false);
    }
  };

  /* ── Edit expense ── */
  const openEditExp = (exp) => {
    setEditExp(exp);
    setEditAmount(String(exp.amount));
    setEditCategory(exp.category);
    setEditNote(exp.note || '');
  };

  const handleEditExpense = async (e) => {
    e.preventDefault();
    const amount = parseCurrencyInput(editAmount);
    if (!editExp || !amount || amount <= 0) return;

    let finalNote = editNote;
    if (/[$]|usd/i.test(editAmount)) {
      const originalText = editAmount.trim();
      finalNote = editNote ? `${editNote} (${originalText})` : originalText;
    }

    const ok = await updateExpense(editExp.id, {
      amount,
      category: editCategory,
      note: finalNote || null,
    });
    if (ok) setEditExp(null);
  };

  const handleAddSub = async (e) => {
    e.preventDefault();
    const amount = parseCurrencyInput(subAmount);
    if (!subName || !amount || !subDue) return;

    let finalName = subName;
    if (/[$]|usd/i.test(subAmount)) {
      const originalText = subAmount.trim();
      finalName = `${subName} (${originalText})`;
    }

    const result = await addSub({ name: finalName, amount, cycle: subCycle, next_due: subDue, icon: subIcon });
    if (result) {
      logActivity('subscription_add', `${finalName} — ${formatVND(amount)}/${subCycle}`, amount, { cycle: subCycle });
      // Link tags
      for (const tagId of subTagIds) {
        await linkTag(result.id, tagId, 'subscription');
      }
      // If this subscription was created from Inbox, delete the inbox item now
      if (pendingInboxId) {
        await deleteInboxItem(pendingInboxId);
        setPendingInboxId(null);
      }
      setSubName('');
      setSubAmount('');
      setSubDue('');
      setSubIcon('📦');
      setSubTagIds([]);
      setShowAddSub(false);
    }
  };

  // Aggregated stats
  const categoryBreakdown = useMemo(() => getByCategory(expenses), [expenses, getByCategory]);
  const monthTotal = useMemo(() => getTotal(expenses), [expenses, getTotal]);
  const monthlySub = useMemo(() => getMonthlyCost(), [getMonthlyCost]);
  const upcoming = useMemo(() => getUpcoming(7), [getUpcoming]);

  if (!user) {
    return (
      <div className="finance-page">
        <div className="finance-page__empty">🔐 Đăng nhập để sử dụng Finance</div>
      </div>
    );
  }

  return (
    <>
    <div className="finance-page">
      <div className="finance-page__header">
        <h1 className="finance-page__title">💰 Finance</h1>
        <p className="finance-page__subtitle">
          Chi tiêu tháng {new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Summary cards */}
      <div className="finance-summary">
        <div className="finance-summary__card">
          <div className="finance-summary__label">Chi tiêu tháng</div>
          <div className="finance-summary__value finance-summary__value--expense">{formatVND(monthTotal)}</div>
        </div>
        <div className="finance-summary__card">
          <div className="finance-summary__label">Đăng ký / tháng</div>
          <div className="finance-summary__value finance-summary__value--sub">{formatVND(monthlySub)}</div>
        </div>
        <div className="finance-summary__card">
          <div className="finance-summary__label">Tổng ước tính</div>
          <div className="finance-summary__value">{formatVND(monthTotal + monthlySub)}</div>
        </div>
      </div>

      {/* Upcoming subs alert */}
      {upcoming.length > 0 && (
        <div className="finance-alert">
          ⚠️ <strong>{upcoming.length}</strong> đăng ký sắp hết hạn trong 7 ngày:
          {upcoming.map(s => (
            <span key={s.id} className="finance-alert__item">
              {s.icon} {s.name} ({new Date(s.next_due).toLocaleDateString('vi-VN')})
            </span>
          ))}
        </div>
      )}

      {/* Cashflow Calendar */}
      <CashflowBar subs={subs} />

      {/* Tabs */}
      <div className="finance-tabs">
        <button className={`finance-tab${tab === 'expense' ? ' finance-tab--active' : ''}`} onClick={() => setTab('expense')}>
          🧾 Chi tiêu
        </button>
        <button className={`finance-tab${tab === 'subs' ? ' finance-tab--active' : ''}`} onClick={() => setTab('subs')}>
          📦 Đăng ký ({subs.filter(s => s.active).length})
        </button>
      </div>

      {/* ── Expense Tab ── */}
      {tab === 'expense' && (
        <div className="finance-section">
          <button className="finance-add-btn" onClick={() => setShowAddExp(v => !v)}>
            {showAddExp ? '✕ Đóng' : '+ Thêm chi tiêu'}
          </button>

          {showAddExp && (
            <form className="finance-form" onSubmit={handleAddExpense}>
              <div className="finance-form__row">
                <input
                  className="finance-form__input finance-form__input--amount"
                  type="text"
                  placeholder="Số tiền (Ví dụ: 50, 50k, 10$)"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  required
                />
                <CustomSelect
                  value={expCategory}
                  onChange={setExpCategory}
                  options={CATEGORIES.map(c => ({ value: c.key, label: c.label, icon: c.icon }))}
                />
              </div>
              {expAmount && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '-0.5rem', marginBottom: '0.75rem', paddingLeft: '0.25rem' }}>
                  Xem trước: <strong style={{ color: 'var(--text-primary)' }}>{formatVND(parseCurrencyInput(expAmount))}</strong>
                  {/[$]|usd/i.test(expAmount) && ' (Quy đổi tỷ giá)'}
                </div>
              )}
              <input
                className="finance-form__input"
                type="text"
                placeholder="Ghi chú (tùy chọn)"
                value={expNote}
                onChange={(e) => setExpNote(e.target.value)}
                maxLength={200}
              />
              <TagPicker
                tags={tags}
                selected={expTagIds}
                onToggle={id => setExpTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                onAdd={addTag}
                compact
              />
              <button type="submit" className="btn btn-primary" disabled={!expAmount}>Lưu</button>
            </form>
          )}

          {/* Category breakdown */}
          {categoryBreakdown.length > 0 && (
            <div className="finance-charts-row">
              <PieChart data={categoryBreakdown} total={monthTotal} />
              <div className="finance-breakdown">
                {categoryBreakdown.map(({ category, total }) => {
                  const cat = CAT_MAP[category] || { icon: '📦', label: category, color: '#64748b' };
                  const pct = monthTotal ? Math.round((total / monthTotal) * 100) : 0;
                  return (
                    <div key={category} className="finance-breakdown__row">
                      <span className="finance-breakdown__icon">{cat.icon}</span>
                      <span className="finance-breakdown__label">{cat.label}</span>
                      <div className="finance-breakdown__bar">
                        <div className="finance-breakdown__fill" style={{ width: `${pct}%`, background: cat.color }} />
                      </div>
                      <span className="finance-breakdown__amount">{formatVND(total)}</span>
                      <span className="finance-breakdown__pct">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}


          {/* Expense list */}
          {expLoading ? (
            <div className="finance-loading">Đang tải...</div>
          ) : expenses.length === 0 ? (
            <div className="finance-empty">Chưa có chi tiêu nào tháng này</div>
          ) : (
            <div className="finance-list">
              {expenses.map(exp => {
                const cat = CAT_MAP[exp.category] || { icon: '📦', label: exp.category };
                return (
                  <div key={exp.id} className="finance-list__item">
                    <span className="finance-list__icon">{cat.icon}</span>
                    <div className="finance-list__info">
                      <div className="finance-list__note">{exp.note || cat.label}</div>
                      <div className="finance-list__date">{new Date(exp.date).toLocaleDateString('vi-VN')}</div>
                    </div>
                    <div className="finance-list__amount">-{formatVND(exp.amount)}</div>
                    <button className="finance-list__edit" onClick={() => openEditExp(exp)} title="Sửa">✏️</button>
                    <button className="finance-list__delete" onClick={() => deleteExpense(exp.id)} title="Xóa">🗑</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Subscriptions Tab ── */}
      {tab === 'subs' && (
        <div className="finance-section">
          <button className="finance-add-btn" onClick={() => setShowAddSub(v => !v)}>
            {showAddSub ? '✕ Đóng' : '+ Thêm đăng ký'}
          </button>

          {showAddSub && (
            <form className="finance-form" onSubmit={handleAddSub}>
              <div className="finance-form__row">
                <input
                  className="finance-form__input"
                  type="text"
                  placeholder="Tên (Netflix, Google AI...)"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  required
                />
                <input
                  className="finance-form__input finance-form__input--amount"
                  type="text"
                  placeholder="Số tiền (Ví dụ: 50, 50k, 10$)"
                  value={subAmount}
                  onChange={(e) => setSubAmount(e.target.value)}
                  required
                />
              </div>
              {subAmount && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '-0.5rem', marginBottom: '0.5rem', paddingLeft: '0.25rem' }}>
                  Xem trước: <strong style={{ color: 'var(--text-primary)' }}>{formatVND(parseCurrencyInput(subAmount))}</strong>
                  {/[$]|usd/i.test(subAmount) && ' (Quy đổi tỷ giá)'}
                </div>
              )}
              <div className="finance-form__row">
                <CustomSelect
                  value={subCycle}
                  onChange={(val) => { setSubCycle(val); setSubDue(calcNextDue(val)); }}
                  options={[
                    { value: 'monthly', label: '1 tháng',  icon: '📅' },
                    { value: '3month',  label: '3 tháng',  icon: '📆' },
                    { value: '6month',  label: '6 tháng',  icon: '🗓' },
                    { value: 'yearly',  label: '1 năm',    icon: '🔁' },
                  ]}
                />
              </div>
              <div className="finance-form__due-row">
                <span className="finance-form__due-label">📅 Ngày gia hạn tiếp theo</span>
                <div className="finance-form__due-actions">
                  <button type="button" className="finance-form__due-auto" onClick={() => setSubDue(calcNextDue(subCycle))}>
                    Tự tính ↻
                  </button>
                  <input
                    className="finance-form__input finance-form__input--date"
                    type="date"
                    value={subDue}
                    onChange={(e) => setSubDue(e.target.value)}
                    required
                  />
                </div>
              </div>
              <TagPicker
                tags={tags}
                selected={subTagIds}
                onToggle={id => setSubTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                onAdd={addTag}
                compact
              />
              <button type="submit" className="btn btn-primary" disabled={!subName || !subAmount || !subDue}>Lưu</button>
            </form>
          )}

          {subLoading ? (
            <div className="finance-loading">Đang tải...</div>
          ) : subs.length === 0 ? (
            <div className="finance-empty">Chưa có đăng ký nào</div>
          ) : (
            <div className="finance-subs">
              {subs.map(sub => {
                const isExpired = new Date(sub.next_due) < new Date();
                const daysUntil = Math.ceil((new Date(sub.next_due) - new Date()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={sub.id} className={`finance-sub-card${!sub.active ? ' finance-sub-card--inactive' : ''}`}>
                    <div className="finance-sub-card__header">
                      <span className="finance-sub-card__icon">{sub.icon}</span>
                      <span className="finance-sub-card__name">{sub.name}</span>
                      <span className={`finance-sub-card__status${isExpired ? ' finance-sub-card__status--expired' : ''}`}>
                        {!sub.active ? 'Tắt' : isExpired ? 'Hết hạn!' : `${daysUntil} ngày`}
                      </span>
                    </div>
                    <div className="finance-sub-card__details">
                      <span className="finance-sub-card__amount" style={{ color: sub.color }}>
                        {formatVND(sub.amount)}/{{ monthly: 'tháng', '3month': '3 tháng', '6month': '6 tháng', yearly: 'năm' }[sub.cycle] || sub.cycle}
                      </span>
                      <span className="finance-sub-card__due">
                        Kỳ tiếp: {new Date(sub.next_due).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    <div className="finance-sub-card__actions">
                      <button onClick={() => toggleActive(sub.id)} title={sub.active ? 'Tắt' : 'Bật'}>
                        {sub.active ? '⏸' : '▶️'}
                      </button>
                      <button onClick={() => deleteSub(sub.id)} title="Xóa">🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>

      {/* ── Edit Expense Modal ── */}
      {editExp && (
        <GenericModal onClose={() => setEditExp(null)} title="✏️ Sửa chi tiêu" maxWidth={380}>
          <form onSubmit={handleEditExpense}>
            <GenericModal.Body>
              <label className="generic-modal__label">Số tiền (VNĐ)</label>
              <input
                className="generic-modal__input"
                type="text"
                placeholder="Ví dụ: 50, 50k, 10$"
                value={editAmount}
                onChange={e => setEditAmount(e.target.value)}
                required
                autoFocus
              />
              {editAmount && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
                  Xem trước: <strong style={{ color: 'var(--text-primary)' }}>{formatVND(parseCurrencyInput(editAmount))}</strong>
                  {/[$]|usd/i.test(editAmount) && ' (Quy đổi tỷ giá)'}
                </div>
              )}
              <label className="generic-modal__label">Danh mục</label>
              <CustomSelect
                value={editCategory}
                onChange={setEditCategory}
                options={CATEGORIES.map(c => ({ value: c.key, label: c.label, icon: c.icon }))}
              />
              <label className="generic-modal__label">Ghi chú</label>
              <input
                className="generic-modal__input"
                type="text"
                value={editNote}
                onChange={e => setEditNote(e.target.value)}
                placeholder="Ghi chú (tùy chọn)"
                maxLength={200}
              />
            </GenericModal.Body>
            <GenericModal.Footer>
              <button type="button" className="btn btn-ghost" onClick={() => setEditExp(null)}>Huỷ</button>
              <button type="submit" className="btn btn-primary" disabled={!editAmount}>💾 Lưu</button>
            </GenericModal.Footer>
          </form>
        </GenericModal>
      )}
    </>
  );
}
