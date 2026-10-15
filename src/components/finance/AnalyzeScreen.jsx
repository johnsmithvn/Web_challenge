import { useState, useMemo } from 'react';
import { useUserTasks } from '../../hooks/useUserTasks';
import { parseCurrencyInput, sanitizeDecimal, sanitizeDigits, groupDigits } from '../../utils/currencyUtils';
import { formatDate } from '../../utils/dateUtils';
import {
  periodTotals,
  monthStart, monthEnd, parseYmd, maturityWarn,
  guessDepositType, canDepositTopUp, maturityInterest, settleMaturity,
} from '../../utils/financeLogic';
import { money, catInfo, Segmented, TaskPicker, FinanceIcon, DateField, BankSelect } from './parts';
import AppIcon from '../AppIcon';
import ReportScreen from './ReportScreen';

function lastNMonths(refStr, n) {
  const ref = parseYmd(refStr);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const y = d.getFullYear(), m = d.getMonth();
    out.push({ key: `${y}-${String(m + 1).padStart(2, '0')}`, label: `${m + 1}/${String(y).slice(-2)}`,
      from: monthStart(y, m), to: monthEnd(y, m) });
  }
  return out;
}

function compactMoney(value) {
  const amount = Number(value) || 0;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tr`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000).toLocaleString('vi-VN')} k`;
  return money(amount);
}

export default function AnalyzeScreen({ fin, nav, lead, footer }) {
  return <ReportScreen fin={fin} nav={nav} lead={lead} footer={footer} />;
}

const DEPOSIT_TYPES = [
  { id: 'cd', label: 'Chứng chỉ tiền gửi (CD)', icon: 'certificate', hint: 'Khóa cứng đến đáo hạn, không rút sớm' },
  { id: 'term', label: 'Sổ tiết kiệm', icon: 'bank', hint: 'Rút trước hạn mất lãi kỳ hạn (~0.1%/năm)' },
  { id: 'flex', label: 'Tích lũy linh hoạt', icon: 'deviceMobile', hint: 'Không kỳ hạn · rút bất cứ lúc nào' },
];

const QUICK_TERMS = ['1', '2', '3', '6', '12', '24'];

export function DepositForm({ fin, nav, goal, deposit, activeGoals = [], onDone }) {
  const [depositType, setDepositType] = useState(() => guessDepositType(deposit));
  const [selectedGoalId, setSelectedGoalId] = useState(() => goal?.id || deposit?.fund_id || '');
  const [isNameCustomized, setIsNameCustomized] = useState(() => !!deposit?.name);
  const [showAdvanced, setShowAdvanced] = useState(() => !!deposit?.account_no);
  const [form, setForm] = useState(() => {
    if (deposit) return { ...deposit, amount: deposit.amount ? String(deposit.amount) : '', rate: deposit.rate ? String(deposit.rate) : '', term: deposit.term ? String(deposit.term) : '' };
    return { name: '', bank: '', account_no: '', amount: '', rate: '', term: '1', opened_at: fin.today, closed_on: '' };
  });
  const [isSaving, setIsSaving] = useState(false);

  const maturity = projectedMaturity(form.opened_at, Number(form.term));
  const warning = maturity ? maturityWarn(maturity, fin.today) : null;

  const updateAutoName = (bank, typeId, term) => {
    if (isNameCustomized) return;
    const typeObj = DEPOSIT_TYPES.find(t => t.id === typeId) || DEPOSIT_TYPES[0];
    const typeLabel = typeObj.id === 'cd' ? 'Chứng chỉ tiền gửi' : typeObj.id === 'term' ? 'Sổ tiết kiệm' : 'Tích lũy linh hoạt';
    const termSuffix = typeId === 'flex' || !term ? '' : ` ${term}T`;
    const bankPrefix = bank ? bank : 'Ngân hàng';
    setForm(prev => ({ ...prev, name: `${bankPrefix} · ${typeLabel}${termSuffix}` }));
  };

  const handleTypeChange = (typeId) => {
    setDepositType(typeId);
    let newTerm = form.term;
    if (typeId === 'flex') {
      newTerm = '';
    } else if (typeId === 'cd' && (!newTerm || newTerm === '0')) {
      newTerm = '1';
    } else if (typeId === 'term' && (!newTerm || newTerm === '0')) {
      newTerm = '12';
    }
    setForm(prev => ({ ...prev, term: newTerm }));
    updateAutoName(form.bank, typeId, newTerm);
  };

  const handleBankChange = (bank) => {
    setForm(prev => ({ ...prev, bank }));
    updateAutoName(bank, depositType, form.term);
  };

  const handleTermChange = (term) => {
    const cleanTerm = sanitizeDigits(term, 3);
    setForm(prev => ({ ...prev, term: cleanTerm }));
    updateAutoName(form.bank, depositType, cleanTerm);
  };

  const field = (key, sanitize = value => value) => e => {
    if (key === 'name') setIsNameCustomized(true);
    setForm(prev => ({ ...prev, [key]: sanitize(e.target.value) }));
  };

  const save = async (e) => {
    e.preventDefault();
    const finalName = form.name?.trim() || `${form.bank || 'Ngân hàng'} · ${depositType === 'cd' ? 'Chứng chỉ tiền gửi' : depositType === 'term' ? 'Sổ tiết kiệm' : 'Tích lũy'}`;
    if (!finalName || (Number(form.term) > 0 && !form.opened_at) || isSaving) return;

    let targetFundId = selectedGoalId || deposit?.fund_id || goal?.id;
    if (!targetFundId) {
      const existing = fin.goals[0];
      if (existing) {
        targetFundId = existing.id;
      } else {
        setIsSaving(true);
        const createdGoal = await fin.addGoal({
          name: 'Tích lũy & Tiết kiệm',
          goal: 0,
          lock_mode: 'soft',
          in_wallet: false,
        });
        if (!createdGoal) {
          setIsSaving(false);
          nav.showToast('Không thể lưu nơi gửi. Vui lòng thử lại.', { icon: 'warning' });
          return;
        }
        targetFundId = createdGoal.id;
      }
    }

    setIsSaving(true);
    const row = {
      fund_id: targetFundId,
      name: finalName,
      bank: form.bank || null,
      account_no: form.account_no || null,
      amount: parseCurrencyInput(form.amount) || 0,
      rate: Number(form.rate) || 0,
      term: depositType === 'flex' ? null : (Number(form.term) || null),
      opened_at: form.opened_at || null,
      closed_on: form.closed_on || null,
    };
    const ok = deposit ? await fin.updateDeposit(deposit.id, row) : await fin.addDeposit(row);
    setIsSaving(false);
    if (ok) {
      nav.showToast(deposit ? `Đã cập nhật nơi gửi “${finalName}”` : `Đã thêm nơi gửi “${finalName}”`, { icon: 'bank' });
      onDone();
    } else {
      nav.showToast('Không thể lưu nơi gửi. Kiểm tra lại dữ liệu rồi thử lại.', { icon: 'warning' });
    }
  };

  return (
    <form className="fin-editor" onSubmit={save}>
      <div className="fin-editor__title">
        <strong>{deposit ? `Sửa nơi gửi · ${deposit.name}` : 'Thêm nơi gửi tiền'}</strong>
        <button type="button" className="fin-icon-btn" aria-label="Đóng form nơi gửi" onClick={onDone}>
          <AppIcon name="x" size={14} />
        </button>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <span className="fin-label" style={{ marginBottom: '6px', display: 'block' }}>Loại hình tiền gửi</span>
        <div className="fin-type-picker">
          {DEPOSIT_TYPES.map(t => (
            <button
              key={t.id}
              type="button"
              className={`fin-type-picker__btn ${depositType === t.id ? 'is-active' : ''}`}
              onClick={() => handleTypeChange(t.id)}
            >
              <div className="fin-type-picker__head">
                <AppIcon name={t.icon} size={15} />
                <span>{t.label}</span>
              </div>
              <span className="fin-type-picker__hint">{t.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="fin-form__row">
        <label className="fin-label" style={{ flex: 1 }}>
          Ngân hàng / Ứng dụng
          <BankSelect
            value={form.bank || ''}
            onChange={handleBankChange}
            placeholder="Chọn ngân hàng / ví / app"
          />
        </label>
        <label className="fin-label" style={{ flex: 1 }}>
          Số tiền gửi (VNĐ)
          <input
            className="fin-input"
            inputMode="numeric"
            pattern="[0-9]*"
            value={form.amount || ''}
            onChange={field('amount', sanitizeDigits)}
            aria-label="Số tiền đang gửi"
            placeholder="Ví dụ: 50.000.000"
            autoFocus={!deposit}
            required
          />
        </label>
      </div>

      <div className="fin-form__row">
        <label className="fin-label" style={{ flex: 1 }}>
          Lãi suất · %/năm
          <input
            className="fin-input"
            inputMode="decimal"
            value={form.rate || ''}
            onChange={field('rate', value => sanitizeDecimal(value, 3, 4))}
            placeholder="Ví dụ: 5,2"
          />
        </label>
        {depositType !== 'flex' ? (
          <label className="fin-label" style={{ flex: 1 }}>
            Kỳ hạn (tháng)
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                className="fin-input"
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.term || ''}
                onChange={e => handleTermChange(e.target.value)}
                placeholder="Ví dụ: 1, 2, 6, 12..."
                style={{ width: '100%', paddingRight: form.term ? '52px' : '12px' }}
                required
              />
              {form.term ? (
                <span style={{ position: 'absolute', right: '12px', fontSize: '12px', color: 'var(--n-txt3, #888)', pointerEvents: 'none' }}>
                  tháng
                </span>
              ) : null}
            </div>
            <div className="fin-term-quick">
              {QUICK_TERMS.map(qt => (
                <button
                  key={qt}
                  type="button"
                  className={`fin-term-chip ${form.term === qt ? 'is-active' : ''}`}
                  onClick={() => handleTermChange(qt)}
                >
                  {qt} tháng
                </button>
              ))}
            </div>
          </label>
        ) : (
          <label className="fin-label" style={{ flex: 1 }}>
            Kỳ hạn
            <span className="fin-input fin-input--readonly" style={{ color: 'var(--n-good)' }}>
              Không kỳ hạn · rút bất cứ lúc nào
            </span>
          </label>
        )}
      </div>

      <div className="fin-form__row">
        <label className="fin-label" style={{ flex: 1 }}>
          Ngày gửi
          <DateField value={form.opened_at || fin.today} onChange={(v) => setForm(p => ({ ...p, opened_at: v }))} />
        </label>
        <label className="fin-label" style={{ flex: 1 }}>
          Ngày đáo hạn
          <div className="fin-input fin-input--readonly" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span>{maturity ? formatDate(maturity) : 'Không kỳ hạn · rút linh hoạt'}</span>
            {maturity && warning && (
              <span className={`fin-due-badge ${warning.days <= 0 ? 'fin-due-badge--urgent' : warning.days <= 7 ? 'fin-due-badge--soon' : 'fin-due-badge--normal'}`}>
                {warning.days === 0 ? 'Đáo hạn hôm nay' : warning.days < 0 ? `Quá hạn ${Math.abs(warning.days)} ngày` : `Còn ${warning.days} ngày`}
              </span>
            )}
          </div>
        </label>
      </div>

      {parseCurrencyInput(form.amount) > 0 && Number(form.rate) > 0 && (
        <div style={{
          padding: '8px 12px',
          borderRadius: '8px',
          background: 'rgba(72, 179, 162, 0.1)',
          border: '1px solid rgba(72, 179, 162, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: 'var(--n-txt1)'
        }}>
          <span>
            {depositType !== 'flex' && form.term ? `Lãi thực nhận khi đáo hạn (${form.term} tháng):` : 'Lãi ước tính 1 năm:'}
            <strong className="is-positive" style={{ marginLeft: '6px' }}>
              + {money(depositType !== 'flex' && Number(form.term)
                ? Math.round(parseCurrencyInput(form.amount) * Number(form.rate) / 100 * (Number(form.term) / 12))
                : Math.round(parseCurrencyInput(form.amount) * Number(form.rate) / 100))}
            </strong>
          </span>
          <span style={{ color: 'var(--n-txt2)' }}>
            Tổng nhận về: <strong>
              {money(parseCurrencyInput(form.amount) + (depositType !== 'flex' && Number(form.term)
                ? Math.round(parseCurrencyInput(form.amount) * Number(form.rate) / 100 * (Number(form.term) / 12))
                : Math.round(parseCurrencyInput(form.amount) * Number(form.rate) / 100)))}
            </strong>
          </span>
        </div>
      )}

      <div className="fin-form__row">
        {activeGoals.length > 0 && (
          <label className="fin-label" style={{ flex: 1 }}>
            Thuộc quỹ mục tiêu (tùy chọn)
            <select
              className="fin-input"
              value={selectedGoalId}
              onChange={e => setSelectedGoalId(e.target.value)}
            >
              <option value="">Không gắn mục tiêu (Tích lũy chung)</option>
              {activeGoals.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </label>
        )}
        <label className="fin-label" style={{ flex: 1 }}>
          Tên gợi nhớ / Tên sổ
          <input
            className="fin-input"
            value={form.name || ''}
            onChange={field('name')}
            placeholder={form.bank ? `${form.bank} · ${depositType === 'cd' ? 'Chứng chỉ tiền gửi' : depositType === 'term' ? 'Sổ tiết kiệm' : 'Tích lũy'}` : 'Ví dụ: ABBank · Chứng chỉ tiền gửi 1T'}
          />
        </label>
      </div>

      {deposit && (
        <label className="fin-label">
          Ngày tất toán (nếu đã rút / đóng sổ)
          <DateField value={form.closed_on} onChange={(v) => setForm(p => ({ ...p, closed_on: v }))} />
        </label>
      )}

      <div>
        {!showAdvanced ? (
          <button
            type="button"
            className="fin-btn fin-btn--ghost fin-btn--sm"
            style={{ padding: '4px 0', fontSize: '11px', color: 'var(--n-txt3)' }}
            onClick={() => setShowAdvanced(true)}
          >
            + Thêm số tài khoản / mã hợp đồng tra cứu
          </button>
        ) : (
          <div className="fin-form__row" style={{ marginTop: '6px' }}>
            <label className="fin-label" style={{ flex: 1 }}>
              Số tài khoản / Mã sổ (tùy chọn)
              <input
                className="fin-input"
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.account_no || ''}
                onChange={field('account_no', value => sanitizeDigits(value, 32))}
                placeholder="Để tra cứu đối chiếu khi cần"
              />
            </label>
          </div>
        )}
      </div>

      <div className="fin-editor__actions" style={{ marginTop: '8px' }}>
        <button className="fin-btn fin-btn--primary fin-btn--sm" disabled={isSaving}>
          <AppIcon name="save" size={14} /> {isSaving ? 'Đang lưu...' : 'Lưu nơi gửi'}
        </button>
        {deposit && (
          <button
            type="button"
            className="fin-btn fin-btn--danger fin-btn--sm"
            onClick={async () => {
              if (await nav.confirmDelete(`nơi gửi “${deposit.name}”`) && await fin.deleteDeposit(deposit.id)) onDone();
            }}
          >
            <AppIcon name="trash" size={14} /> Xóa
          </button>
        )}
      </div>
    </form>
  );
}

const SETTLE_MODES = [
  { id: 'withdraw', label: 'Rút về', icon: 'arrowUp', hint: 'Đóng sổ · gốc + lãi về tài khoản thường' },
  { id: 'renew', label: 'Gửi lại · chỉ gốc', icon: 'arrowsClockwise', hint: 'Rút lãi, gốc gửi tiếp kỳ mới' },
  { id: 'renew_interest', label: 'Gửi lại · gốc + lãi', icon: 'arrowsClockwise', hint: 'Lãi nhập gốc, gửi tiếp kỳ mới' },
];

export function MaturityForm({ fin, nav, deposit, onDone }) {
  const [mode, setMode] = useState('withdraw');
  const [interest, setInterest] = useState(() => String(maturityInterest(deposit)));
  const [on, setOn] = useState(deposit.matures_at);
  const [rate, setRate] = useState(deposit.rate ? String(deposit.rate) : '');
  const [isSaving, setIsSaving] = useState(false);
  const plan = settleMaturity(deposit, { mode, interest: parseCurrencyInput(interest), on, rate });

  const save = async (e) => {
    e.preventDefault();
    if (isSaving || !on) return;
    setIsSaving(true);
    // ponytail: 3 lệnh ghi rời, không atomic; gộp thành RPC nếu hay gặp lỗi giữa chừng.
    let ok = await fin.updateDeposit(deposit.id, { closed_on: plan.closedOn });
    const next = ok && plan.next ? await fin.addDeposit(plan.next) : null;
    if (ok && plan.next && !next) {
      // Mở sổ mới hỏng → mở lại sổ cũ, không để tiền biến khỏi quỹ.
      await fin.updateDeposit(deposit.id, { closed_on: null });
      ok = false;
    }
    if (!ok) {
      setIsSaving(false);
      nav.showToast('Không xử lý được sổ đáo hạn. Thử lại.', { icon: 'warning' });
      return;
    }
    const tx = plan.income ? await fin.addTransaction(plan.income) : null;
    setIsSaving(false);
    const undo = async () => {
      if (tx) await fin.deleteTransaction(tx.id);
      if (next) await fin.deleteDeposit(next.id);
      await fin.updateDeposit(deposit.id, { closed_on: null });
      nav.showToast(`Đã hoàn tác · “${deposit.name}” trở lại như cũ`, { icon: 'bank' });
    };
    nav.showToast(
      plan.income && !tx ? 'Đã đóng sổ nhưng chưa ghi được giao dịch lãi.'
        : mode === 'withdraw' ? `Đã tất toán “${deposit.name}”` : `Đã gửi lại “${deposit.name}” kỳ mới`,
      { icon: plan.income && !tx ? 'warning' : 'bank', actionLabel: 'Hoàn tác', onAction: undo },
    );
    onDone();
  };

  return (
    <form className="fin-editor" onSubmit={save}>
      <div className="fin-editor__title">
        <strong>Xử lý đáo hạn · {deposit.name}</strong>
        <button type="button" className="fin-icon-btn" aria-label="Đóng form xử lý đáo hạn" onClick={onDone}>
          <AppIcon name="x" size={14} />
        </button>
      </div>

      <div className="fin-type-picker" style={{ marginBottom: '10px' }}>
        {SETTLE_MODES.map(m => (
          <button key={m.id} type="button" aria-pressed={mode === m.id}
            className={`fin-type-picker__btn ${mode === m.id ? 'is-active' : ''}`} onClick={() => setMode(m.id)}>
            <div className="fin-type-picker__head"><AppIcon name={m.icon} size={15} /><span>{m.label}</span></div>
            <span className="fin-type-picker__hint">{m.hint}</span>
          </button>
        ))}
      </div>

      <div className="fin-form__row">
        <label className="fin-label" style={{ flex: 1 }}>
          Lãi thực nhận (VNĐ)
          <input
            className="fin-input"
            inputMode="numeric"
            pattern="[0-9.]*"
            value={interest ? groupDigits(interest) : ''}
            onChange={e => setInterest(sanitizeDigits(e.target.value))}
            placeholder="0"
            autoFocus
          />
          <small style={{ color: 'var(--n-txt3)', fontSize: '11px' }}>Điền sẵn theo lãi suất · sửa theo số ngân hàng trả thật. Ghi thành Thu › Lãi tiết kiệm.</small>
        </label>
        <label className="fin-label" style={{ flex: 1 }}>
          {mode === 'withdraw' ? 'Ngày rút' : 'Ngày gửi lại'}
          <DateField value={on} onChange={setOn} />
        </label>
      </div>

      {plan.next && (
        <div className="fin-form__row">
          <label className="fin-label" style={{ flex: 1 }}>
            Lãi suất kỳ mới · %/năm
            <input className="fin-input" inputMode="decimal" value={rate}
              onChange={e => setRate(sanitizeDecimal(e.target.value, 3, 4))} placeholder={String(deposit.rate || 0)} />
          </label>
          <label className="fin-label" style={{ flex: 1 }}>
            Sổ mới
            <span className="fin-input fin-input--readonly">
              {money(plan.next.amount)} · {plan.next.term} tháng · đáo hạn {formatDate(projectedMaturity(plan.next.opened_at, Number(plan.next.term)))}
            </span>
          </label>
        </div>
      )}

      <small style={{ color: 'var(--n-txt3)', display: 'block', margin: '4px 0 8px' }}>
        {plan.next
          ? 'Sổ cũ chuyển vào Lịch sử sổ đã tất toán; kỳ mới là một dòng sổ riêng.'
          : `Nhận về ${money((deposit.amount || 0) + (plan.income?.amount || 0))} · sổ chuyển vào Lịch sử sổ đã tất toán.`}
      </small>

      <div className="fin-editor__actions">
        <button className="fin-btn fin-btn--primary fin-btn--sm" disabled={isSaving || !on}>
          <AppIcon name="checkCircle" size={14} /> {isSaving ? 'Đang lưu...' : 'Xác nhận'}
        </button>
        <button type="button" className="fin-btn fin-btn--secondary fin-btn--sm" onClick={onDone}>Hủy</button>
      </div>
    </form>
  );
}

function projectedMaturity(openedAt, term) {
  if (!openedAt || !term) return '';
  const [year, month, day] = openedAt.split('-').map(Number);
  const targetMonth = month - 1 + term;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = targetMonth % 12;
  const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  return `${targetYear}-${String(normalizedMonth + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

export function SavingMoveForm({ fin, goal, dir, onDone, onOpenNewDeposit }) {
  const { pendingTasks } = useUserTasks();
  const deposits = fin.deposits.filter(d => d.fund_id === goal.id && !d.closed_on);
  const flexDeposits = deposits.filter(d => canDepositTopUp(d));
  const hasFlex = flexDeposits.length > 0;

  const request = goal.withdrawal_request;
  const effectiveLock = goal.lock_mode === 'term' && goal.lock_until && goal.lock_until <= fin.today ? 'soft' : goal.lock_mode;

  const [depositId, setDepositId] = useState(() => {
    if (request?.deposit_id) return request.deposit_id;
    if (dir === 'in' && hasFlex) return flexDeposits[0].id;
    return deposits[0]?.id || '';
  });
  const [amount, setAmount] = useState(request?.amount ? String(request.amount) : '');
  const [occurredAt, setOccurredAt] = useState(fin.today);
  const [note, setNote] = useState('');
  const [taskId, setTaskId] = useState(null);
  const [openedAt] = useState(() => Date.now());

  const deposit = deposits.find(d => d.id === depositId);
  const ready = request && openedAt >= new Date(request.available_at).getTime();

  // Chiều GỬI THÊM nhưng quỹ KHÔNG có nơi gửi linh hoạt (toàn bộ là sổ kỳ hạn / CD đã khóa gốc)
  if (dir === 'in' && !hasFlex) {
    return (
      <div className="fin-editor">
        <div className="fin-editor__title">
          <strong>Gửi thêm · {goal.name}</strong>
          <button type="button" className="fin-icon-btn" aria-label="Đóng form" onClick={onDone}>
            <AppIcon name="x" size={14} />
          </button>
        </div>
        <div className="fin-info-strip" style={{ marginBottom: '12px', alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--n-accent, #9184d9)', marginTop: '2px', flexShrink: 0 }}>
            <AppIcon name="lock" size={18} />
          </span>
          <div>
            <strong style={{ display: 'block', marginBottom: '3px' }}>Không thể nạp thêm vào sổ tiết kiệm có kỳ hạn</strong>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--n-txt2)', lineHeight: 1.5 }}>
              Quỹ này hiện chỉ có <strong>Sổ tiết kiệm kỳ hạn</strong> hoặc <strong>Chứng chỉ tiền gửi</strong>. Tiền gốc của các sổ này đã được cố định theo hợp đồng ngân hàng, không thể nạp thêm tiền vào sổ cũ.
            </p>
          </div>
        </div>
        <div style={{ background: 'var(--n-card)', border: '1px solid var(--n-border)', borderRadius: 'var(--n-r)', padding: '12px', marginBottom: '12px' }}>
          <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--n-txt)', lineHeight: 1.5 }}>
            Để để dành thêm tiền vào quỹ <strong>{goal.name}</strong>, bạn hãy <strong>tạo một sổ tiết kiệm mới</strong> (hoặc thêm nơi gửi <em>Tích lũy linh hoạt</em> để nạp rút tự do bất kỳ lúc nào).
          </p>
        </div>
        <div className="fin-editor__actions">
          <button
            type="button"
            className="fin-btn fin-btn--primary fin-btn--sm"
            onClick={() => (onOpenNewDeposit ? onOpenNewDeposit(goal) : onDone())}
          >
            <AppIcon name="plus" size={14} /> Mở sổ mới cho quỹ này
          </button>
          <button type="button" className="fin-btn fin-btn--secondary fin-btn--sm" onClick={onDone}>
            Đóng
          </button>
        </div>
      </div>
    );
  }

  const parsedAmount = parseCurrencyInput(amount);
  const isDepositLocked = dir === 'in' && deposit && !canDepositTopUp(deposit);
  const isOutExceeded = dir === 'out' && parsedAmount > (deposit?.amount || 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!deposit || !parsedAmount || isDepositLocked || isOutExceeded) return;
    if (dir === 'out' && effectiveLock === 'term' && !ready) {
      const created = await fin.requestSavingWithdrawal(goal.id, deposit.id, parsedAmount);
      if (created) onDone();
      return;
    }
    const tx = await fin.moveSaving(goal, deposit, dir, { amount: parsedAmount, occurredAt, note, taskId });
    if (tx) onDone();
  };

  return (
    <form className="fin-editor" onSubmit={submit}>
      <div className="fin-editor__title">
        <strong>{dir === 'in' ? `Gửi thêm vào · ${goal.name}` : `Rút khỏi · ${goal.name}`}</strong>
        <button type="button" className="fin-icon-btn" aria-label="Đóng form gửi/rút" onClick={onDone}>
          <AppIcon name="x" size={14} />
        </button>
      </div>

      <div className="fin-form__row">
        <label className="fin-label" style={{ flex: 1 }}>
          {dir === 'in' ? 'Nơi nhận tiền (Tích lũy linh hoạt)' : 'Sổ / Nơi rút tiền'}
          <select
            className="fin-input"
            aria-label={dir === 'in' ? 'Chọn nơi nhận tiền' : 'Chọn nơi rút tiền'}
            value={depositId}
            onChange={e => setDepositId(e.target.value)}
          >
            {deposits.map(d => {
              const isLocked = dir === 'in' && !canDepositTopUp(d);
              return (
                <option key={d.id} value={d.id} disabled={isLocked}>
                  {d.name} · {money(d.amount)}{isLocked ? ' (Đã khóa gốc · Không thể nạp thêm)' : ''}
                </option>
              );
            })}
          </select>
        </label>

        <label className="fin-label" style={{ flex: 1 }}>
          {dir === 'in' ? 'Số tiền gửi thêm (VNĐ)' : 'Số tiền rút (VNĐ)'}
          <input
            className="fin-input"
            inputMode="numeric"
            pattern="[0-9.]*"
            value={amount ? groupDigits(amount) : ''}
            onChange={e => setAmount(sanitizeDigits(e.target.value))}
            aria-label="Số tiền"
            placeholder={dir === 'out' && deposit ? `Tối đa ${money(deposit.amount)}` : 'Ví dụ: 5.000.000'}
            autoFocus
            required
          />
        </label>
      </div>

      {dir === 'in' && onOpenNewDeposit && (
        <div style={{ margin: '-4px 0 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
          <small style={{ color: 'var(--n-txt3)', fontSize: '11.5px' }}>
            * Chỉ tài khoản tích lũy không kỳ hạn mới có thể nạp thêm.
          </small>
          <button
            type="button"
            className="fin-icon-btn"
            style={{ fontSize: '12px', color: 'var(--n-accent, #9184d9)', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            onClick={() => onOpenNewDeposit(goal)}
          >
            <AppIcon name="plus" size={12} /> Muốn gửi kỳ hạn? Tạo sổ mới
          </button>
        </div>
      )}

      <div className="fin-form__row">
        <label className="fin-label" style={{ flex: 1 }}>
          Ngày thực hiện
          <DateField value={occurredAt} onChange={setOccurredAt} />
        </label>
        <label className="fin-label" style={{ flex: 1 }}>
          Tiêu đề
          <input
            className="fin-input"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={dir === 'in' ? 'VD: Trích lương tháng này, Tiết kiệm thêm...' : 'Tùy chọn'}
          />
        </label>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <span className="fin-label" style={{ marginBottom: '6px', display: 'block' }}>Task liên quan</span>
        <TaskPicker tasks={pendingTasks} value={taskId} onPick={setTaskId} />
      </div>

      {dir === 'out' && effectiveLock === 'term' && !ready && (
        <div className="fin-warn fin-inline-message" style={{ marginBottom: '10px' }}>
          <AppIcon name="clock" size={15} /> Rút sớm cần một yêu cầu và chờ 48 giờ để bạn có thời gian đổi ý.
        </div>
      )}
      {dir === 'out' && effectiveLock === 'external' && (
        <div className="fin-warn fin-inline-message" style={{ marginBottom: '10px' }}>
          <AppIcon name="warning" size={15} /> Đây là sổ thật ngoài app. Rút trước hạn có thể mất toàn bộ lãi.
        </div>
      )}

      <div className="fin-editor__actions">
        <button type="button" className="fin-btn fin-btn--secondary fin-btn--sm" onClick={onDone}>
          Hủy
        </button>
        <button
          className="fin-btn fin-btn--primary fin-btn--sm"
          disabled={!deposit || !parsedAmount || isDepositLocked || isOutExceeded}
        >
          <AppIcon name={dir === 'in' ? 'arrowDown' : 'arrowUp'} size={14} />
          {dir === 'out' && effectiveLock === 'term' && !ready ? 'Gửi yêu cầu rút' : 'Xác nhận'}
        </button>
      </div>
    </form>
  );
}

// ── Tab Thống kê ──────────────────────────────────────────────────────────────
function StatsTab({ fin, nav }) {
  const [range, setRange] = useState(6);
  const [mode, setMode] = useState('category');
  const [group, setGroup] = useState(nav.analyzeParams.group || 'food');
  const [billId, setBillId] = useState('');
  const months = useMemo(() => lastNMonths(fin.today, range), [fin.today, range]);

  const monthTotals = useMemo(
    () => months.map(m => ({ m, t: periodTotals(fin.transactions, m) })),
    [months, fin.transactions]);

  const maxMonth = Math.max(1, ...monthTotals.map(x => x.t.total));
  const expenseGroups = fin.cats.expenseGroups.filter(item => !item.hidden);
  const groupInfo = catInfo(group, fin.cats);
  const selectedSeries = monthTotals.map(item => ({
    label: item.m.label,
    amount: item.t.byCategory[group] || 0,
  }));
  const selectedTotal = selectedSeries.reduce((sum, item) => sum + item.amount, 0);
  const selectedAverage = selectedSeries.length ? Math.round(selectedTotal / selectedSeries.length) : 0;
  const selectedPeak = selectedSeries.reduce((peak, item) => item.amount > peak.amount ? item : peak,
    selectedSeries[0] || { label: '—', amount: 0 });
  const previousAmount = selectedSeries.at(-2)?.amount || 0;
  const latestAmount = selectedSeries.at(-1)?.amount || 0;
  const trend = previousAmount ? Math.round((latestAmount - previousAmount) / previousAmount * 100) : null;
  const subcategoryRows = (expenseGroups.find(item => item.key === group)?.subs || []).map(item => ({
    ...item,
    amount: fin.transactions.filter(transaction => transaction.subcategory_id === item.key
      && transaction.type === 'expense' && !transaction.excluded
      && transaction.occurred_at >= months[0].from
      && transaction.occurred_at <= months[months.length - 1].to)
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  })).sort((a, b) => b.amount - a.amount);

  return (
    <div className="fin-stats">
      <div className="fin-stats__controls">
        <div className="fin-stats__bar">
          <Segmented options={[
            { value: 'category', label: 'Theo danh mục' }, { value: 'compare', label: 'So sánh' },
            { value: 'bill', label: 'Theo hóa đơn' }, { value: 'card', label: 'Theo thẻ' }]}
            value={mode} onChange={setMode} ariaLabel="Kiểu thống kê" />
          <div className="fin-stats__range">
            <span>Khoảng</span>
            <Segmented ariaLabel="Khoảng thống kê"
              options={[{ value: 3, label: '3 tháng' }, { value: 6, label: '6 tháng' }, { value: 12, label: '12 tháng' }]}
              value={range} onChange={setRange} />
          </div>
        </div>
        {mode === 'category' && <div className="fin-stats__categories" aria-label="Danh mục chi tiêu">
          {expenseGroups.map(item => <button key={item.key} type="button"
            className={group === item.key ? 'is-active' : ''} style={{ '--cat': item.color }}
            aria-pressed={group === item.key} onClick={() => setGroup(item.key)}>
            <span /><FinanceIcon name={item.icon} cats={fin.cats} size={13} />{item.label}
          </button>)}
        </div>}
      </div>

      {mode === 'category' && (
        <>
          <div className="fin-stats__metrics">
            <article><small>Tổng {range} tháng</small><strong>{compactMoney(selectedTotal)}</strong><span>{groupInfo.label}</span></article>
            <article><small>Trung bình mỗi tháng</small><strong>{compactMoney(selectedAverage)}</strong><span>trên {range} tháng</span></article>
            <article><small>Tháng cao nhất</small><strong>{compactMoney(selectedPeak.amount)}</strong><span>{selectedPeak.label}</span></article>
          </div>
          <section className="fin-card fin-stats-chart">
            <div className="fin-card__head"><div className="fin-card__title">{groupInfo.label} theo tháng</div><small>{trend == null ? 'Chưa đủ dữ liệu để so tháng' : trend === 0 ? 'tháng này không đổi so với tháng trước' : `tháng này ${trend > 0 ? 'tăng' : 'giảm'} ${Math.abs(trend)}% so với tháng trước`}</small></div>
            <MonthBars data={selectedSeries} color={groupInfo.color} />
          </section>
          <section className="fin-card fin-substats">
            <div className="fin-card__head"><div className="fin-card__title">Danh mục con</div><small>Đếm thật từ giao dịch trong khoảng đang chọn</small></div>
            {subcategoryRows.map(item => {
              const pct = selectedTotal ? Math.round(item.amount / selectedTotal * 100) : 0;
              return <div key={item.key} className="fin-substats__item">
                <div className="fin-substats__row"><span>{item.label}</span><small>{pct}%</small><strong>{compactMoney(item.amount)}</strong></div>
                <div className="fin-substats__bar"><i style={{ width: `${pct}%`, background: groupInfo.color }} /></div>
              </div>;
            })}
            {!subcategoryRows.length && <div className="fin-empty">Danh mục này chưa có danh mục con.</div>}
          </section>
        </>
      )}

      {mode === 'compare' && (
        <div className="fin-card">
          <div className="fin-comparechart">
            {monthTotals.map(x => (
              <div key={x.m.key} className="fin-comparecol">
                <div className="fin-comparecol__stack">
                  {fin.cats.expenseGroups.filter(g => !g.hidden).map(g => {
                    const amt = x.t.byCategory[g.key] || 0;
                    if (!amt) return null;
                    return <div key={g.key} title={`${g.label}: ${money(amt)}`}
                      style={{ height: `${(amt / maxMonth) * 140}px`, background: g.color }} />;
                  })}
                </div>
                <span className="fin-comparecol__lbl">{x.m.label}</span>
              </div>
            ))}
          </div>
          <div className="fin-legend fin-legend--wrap">
            {fin.cats.expenseGroups.filter(g => !g.hidden).map(g => (
              <span key={g.key} className="fin-legend__row"><span className="fin-legend__dot" style={{ background: g.color }} /><FinanceIcon name={g.icon} cats={fin.cats} size={14} /> {g.label}</span>
            ))}
          </div>
        </div>
      )}

      {mode === 'bill' && (
        <div className="fin-card">
          <select className="fin-input" aria-label="Chọn hóa đơn để xem theo tháng" value={billId} onChange={e => setBillId(e.target.value)}>
            <option value="">— chọn hóa đơn —</option>
            {fin.bills.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          {billId && <MonthBars color="#48b3a2"
            data={months.map(m => ({ label: m.label,
              amount: fin.transactions.filter(t => t.bill_id === billId && t.occurred_at >= m.from && t.occurred_at <= m.to)
                .reduce((a, t) => a + t.amount, 0) }))} />}
        </div>
      )}

      {mode === 'card' && (
        <div className="fin-card">
          <div className="fin-cardstats">
            {[{ id: '', name: 'Tiền có sẵn', icon: 'money' }, ...fin.cards.map(c => ({ id: c.id, name: c.name, icon: 'creditCard' }))].map(src => {
              const sum = fin.transactions.filter(t => t.type === 'expense' && !t.excluded
                && (src.id ? t.source_card_id === src.id : !t.source_card_id)
                && t.occurred_at >= months[0].from && t.occurred_at <= months[months.length - 1].to)
                .reduce((a, t) => a + t.amount, 0);
              return <div key={src.id || 'cash'} className="fin-substats__row"><span><AppIcon name={src.icon} size={15} /> {src.name}</span><strong>{money(sum)}</strong></div>;
            })}
          </div>
          <p className="fin-note">Chi qua thẻ nhiều hơn tiền mặt thường là dấu hiệu đang dùng thẻ để hoãn trả — kiểm tra float ở tab Thẻ.</p>
        </div>
      )}
    </div>
  );
}

function MonthBars({ data, color }) {
  const max = Math.max(1, ...data.map(d => d.amount));
  return (
    <div className="fin-monthbars">
      {data.map(d => (
        <div key={d.label} className="fin-monthbars__col" title={money(d.amount)}>
          <strong className="fin-monthbars__value">{compactMoney(d.amount)}</strong>
          <div className="fin-monthbars__bar" style={{ height: `${(d.amount / max) * 130}px`, background: color }} />
          <span className="fin-monthbars__lbl">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
