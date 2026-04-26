import { useState, useEffect, useMemo, useRef } from 'react';
import { useExpenses } from '../hooks/useExpenses';
import { useSubscriptions } from '../hooks/useSubscriptions';
import { useActivityLog } from '../hooks/useActivityLog';
import { useAuth } from '../contexts/AuthContext';
import EXPENSE_DATA from '../data/expense-categories.json';
import '../styles/finance.css';

const CATEGORIES = EXPENSE_DATA.categories;
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

/* ── Custom Select Dropdown ───────────────────────────────── */
function CustomSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="custom-select" ref={ref}>
      <button
        type="button"
        className={`custom-select__trigger${open ? ' custom-select__trigger--open' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="custom-select__value">
          {selected ? <>{selected.icon && <span className="custom-select__icon">{selected.icon}</span>}{selected.label}</> : placeholder}
        </span>
        <span className={`custom-select__arrow${open ? ' custom-select__arrow--up' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="custom-select__dropdown">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`custom-select__option${opt.value === value ? ' custom-select__option--active' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.icon && <span className="custom-select__icon">{opt.icon}</span>}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
}

// Get current month date range
function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  return { start, end };
}

// Get last 7 days labels
function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      key: d.toISOString().split('T')[0],
      label: d.toLocaleDateString('vi-VN', { weekday: 'short' }).replace('Th ', 'T'),
    });
  }
  return days;
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

/* ── Inline SVG 7-Day Bar Chart ───────────────────────────── */
function WeekBarChart({ expenses }) {
  const days = getLast7Days();
  const dayTotals = days.map(day => {
    const total = expenses
      .filter(e => e.date === day.key)
      .reduce((sum, e) => sum + e.amount, 0);
    return { ...day, total };
  });

  const max = Math.max(...dayTotals.map(d => d.total), 1);
  const barW = 28;
  const gap = 8;
  const chartW = days.length * (barW + gap);
  const chartH = 80;

  return (
    <div className="finance-bar-chart">
      <div className="finance-bar-chart__title">📊 7 ngày gần đây</div>
      <svg width={chartW} height={chartH + 24} viewBox={`0 0 ${chartW} ${chartH + 24}`}>
        {dayTotals.map((d, i) => {
          const barH = max > 0 ? (d.total / max) * (chartH - 10) : 0;
          const x = i * (barW + gap);
          const y = chartH - barH;
          const isToday = d.key === new Date().toISOString().split('T')[0];
          return (
            <g key={d.key}>
              {barH > 0 && (
                <>
                  <rect
                    x={x} y={y} width={barW} height={barH}
                    rx="4" fill={isToday ? 'var(--purple)' : 'rgba(139,92,246,0.35)'}
                  />
                  <text x={x + barW / 2} y={y - 3} textAnchor="middle"
                    fill="var(--text-muted)" fontSize="7" fontWeight="600">
                    {d.total >= 1000000 ? Math.round(d.total / 1000000) + 'M' :
                     d.total >= 1000 ? Math.round(d.total / 1000) + 'K' : d.total}
                  </text>
                </>
              )}
              <text x={x + barW / 2} y={chartH + 14} textAnchor="middle"
                fill={isToday ? 'var(--purple-light)' : 'var(--text-muted)'} fontSize="8"
                fontWeight={isToday ? '700' : '400'}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function FinancePage() {
  const { user } = useAuth();
  const { expenses, isLoading: expLoading, fetchExpenses, addExpense, deleteExpense, getTotal, getByCategory } = useExpenses();
  const { subs, isLoading: subLoading, fetchSubs, addSub, deleteSub, toggleActive, getMonthlyCost, getUpcoming } = useSubscriptions();
  const { logActivity } = useActivityLog();

  const [tab, setTab] = useState('expense');
  const [showAddExp, setShowAddExp] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);

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

  // Auto-calculate next due date from today based on cycle
  const calcNextDue = (cycle) => {
    const d = new Date();
    if (cycle === 'monthly')    d.setMonth(d.getMonth() + 1);
    else if (cycle === '3month') d.setMonth(d.getMonth() + 3);
    else if (cycle === '6month') d.setMonth(d.getMonth() + 6);
    else if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  };

  // Load data on mount
  useEffect(() => {
    if (!user) return;
    const { start, end } = getMonthRange();
    fetchExpenses(start, end);
    fetchSubs();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddExpense = async (e) => {
    e.preventDefault();
    const amount = parseInt(expAmount, 10);
    if (!amount || amount <= 0) return;

    const cat = CAT_MAP[expCategory];
    const result = await addExpense({ amount, category: expCategory, note: expNote });
    if (result) {
      logActivity('expense_add', `${formatVND(amount)} ${cat?.label || expCategory}`, amount, {
        category: expCategory,
      });
      setExpAmount('');
      setExpNote('');
      setShowAddExp(false);
    }
  };

  const handleAddSub = async (e) => {
    e.preventDefault();
    const amount = parseInt(subAmount, 10);
    if (!subName || !amount || !subDue) return;

    const result = await addSub({ name: subName, amount, cycle: subCycle, next_due: subDue, icon: subIcon });
    if (result) {
      logActivity('subscription_add', `${subName} — ${formatVND(amount)}/${subCycle}`, amount, {
        cycle: subCycle,
      });
      setSubName('');
      setSubAmount('');
      setSubDue('');
      setSubIcon('📦');
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
                  type="number"
                  placeholder="Số tiền (VNĐ)"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  min="1000"
                  step="1000"
                  required
                />
                <CustomSelect
                  value={expCategory}
                  onChange={setExpCategory}
                  options={CATEGORIES.map(c => ({ value: c.key, label: c.label, icon: c.icon }))}
                />
              </div>
              <input
                className="finance-form__input"
                type="text"
                placeholder="Ghi chú (tùy chọn)"
                value={expNote}
                onChange={(e) => setExpNote(e.target.value)}
                maxLength={200}
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

          {/* 7-day bar chart */}
          <WeekBarChart expenses={expenses} />

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
                  type="number"
                  placeholder="Số tiền (VNĐ)"
                  value={subAmount}
                  onChange={(e) => setSubAmount(e.target.value)}
                  min="1000"
                  step="1000"
                  required
                />
              </div>
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
  );
}
