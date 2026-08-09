import { useState, useEffect } from 'react';
import { parseCurrencyInput, sanitizeDecimal, sanitizeDigits } from '../../utils/currencyUtils';
import { useUserTasks } from '../../hooks/useUserTasks';
import {
  billAmountEstimate, cardBalance, cardStatementSummary, floatInterest, loanSchedule, currentMonthPeriod,
} from '../../utils/financeLogic';
import { money, Segmented, FinanceIcon, TaskPicker, Toggle } from './parts';
import AppIcon from '../AppIcon';

const SEGMENTS = [
  { value: 'out',  label: 'Phải trả',   addLabel: 'Thêm hóa đơn' },
  { value: 'in',   label: 'Sẽ nhận',    addLabel: 'Thêm khoản thu' },
  { value: 'loan', label: 'Khoản vay',  addLabel: 'Thêm khoản vay' },
  { value: 'card', label: 'Thẻ tín dụng', addLabel: 'Thêm thẻ' },
];

function daysUntilDay(dueDay, today) {
  if (!dueDay) return null;
  const t = new Date(today + 'T00:00:00');
  const due = new Date(t.getFullYear(), t.getMonth(), dueDay);
  return Math.round((due - t) / 86400000);
}

function RulesEmpty({ icon, title, description }) {
  return (
    <div className="fin-rules-empty">
      <span><AppIcon name={icon} size={22} weight="duotone" /></span>
      <strong>{title}</strong>
      <small>{description}</small>
    </div>
  );
}

export default function RecurringScreen({ fin, nav }) {
  const { pendingTasks } = useUserTasks();
  const seg = nav.recurringSeg;
  const [adding, setAdding] = useState(false);
  const segMeta = SEGMENTS.find(s => s.value === seg);
  const period = fin.today.slice(0, 7);
  const unpaidBills = fin.bills.filter(bill => bill.enabled && !bill.finished_at
    && !(bill.skipped_periods || []).includes(period)
    && !fin.transactions.some(tx => tx.bill_id === bill.id && tx.bill_period === period));
  const overdueBills = unpaidBills.filter(bill => daysUntilDay(bill.due_day, fin.today) < 0);
  const billTotal = unpaidBills.reduce((sum, bill) => sum + billAmountEstimate(bill, fin.transactions), 0);
  const overdueTotal = overdueBills.reduce((sum, bill) => sum + billAmountEstimate(bill, fin.transactions), 0);
  const [year, month] = period.split('-');
  const counts = {
    out: fin.bills.filter(bill => !bill.finished_at).length,
    in: fin.incomeRules.length,
    loan: fin.loans.filter(loan => !loan.closed_at).length,
    card: fin.cards.filter(card => !card.closed_at).length,
  };
  const segmentOptions = SEGMENTS.map(option => ({ ...option, label: `${option.label} ${counts[option.value]}` }));

  return (
    <div className="fin-recurring">
      <section className="fin-obligation-summary">
        <div><span>Tháng {Number(month)}/{year} còn phải trả</span><strong>{money(billTotal)}</strong></div>
        {overdueBills.length > 0 && <div className="fin-obligation-summary__overdue">
          <AppIcon name="warning" size={16} weight="fill" />
          <strong>{overdueBills.length} hóa đơn quá hạn · {money(overdueTotal)}</strong>
        </div>}
        <small>Hôm nay {fin.today.split('-').reverse().join('/')}</small>
      </section>
      <div className="fin-recurring__bar">
        <Segmented options={segmentOptions} value={seg} onChange={(v) => { nav.setRecurringSeg(v); setAdding(false); }} />
        <button className="fin-btn fin-btn--primary fin-btn--sm" onClick={() => setAdding(a => !a)}>
          <AppIcon name={adding ? 'x' : 'plus'} size={15} /> {adding ? 'Đóng' : segMeta.addLabel}
        </button>
      </div>

      {adding && <AddForm seg={seg} fin={fin} nav={nav} onDone={() => setAdding(false)} />}

      {seg === 'out'  && <BillsList fin={fin} nav={nav} tasks={pendingTasks} daysUntilDay={daysUntilDay} />}
      {seg === 'in'   && <IncomeList fin={fin} nav={nav} tasks={pendingTasks} />}
      {seg === 'loan' && <LoansList fin={fin} nav={nav} tasks={pendingTasks} />}
      {seg === 'card' && <CardsList fin={fin} nav={nav} tasks={pendingTasks} />}
    </div>
  );
}

// ── Add forms ────────────────────────────────────────────────────────────────
function AddForm({ seg, fin, nav, onDone }) {
  const [f, setF] = useState(() => ({ name: nav.handoff?.kind === seg ? nav.handoff.title || '' : '' }));
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const setDigits = (k, maxLength = 18) => (e) => setF(p => ({ ...p, [k]: sanitizeDigits(e.target.value, maxLength) }));
  const setDecimal = (k, maxIntegerDigits = 3, maxFractionDigits = 4) => (e) => setF(p => ({
    ...p, [k]: sanitizeDecimal(e.target.value, maxIntegerDigits, maxFractionDigits),
  }));
  useEffect(() => { if (nav.handoff?.kind === seg) nav.clearHandoff(); }, []); // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault();
    if (!f.name?.trim()) return;
    const dueDay = Number(f.due_day);
    const positiveDay = Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31;
    let ok;
    if (seg === 'out') {
      const amountMode = f.amount_mode || 'fixed';
      const billAmount = parseCurrencyInput(f.amount);
      if (!positiveDay || (amountMode === 'fixed' && !billAmount)) {
        nav.showToast('Hóa đơn cần ngày trả hợp lệ và số tiền dương');
        return;
      }
      ok = await fin.addBill({
      name: f.name.trim(), provider: f.provider || null, customer_code: f.customer_code || null,
      category_id: f.category_id || 'housing', subcategory_id: f.subcategory_id || null,
      amount_mode: amountMode, amount: amountMode === 'ask' ? null : billAmount,
      rrule: { type: 'monthly', day: dueDay }, due_day: dueDay,
      term_total: Number(f.term_total) || null });
    } else if (seg === 'in') {
      const incomeAmount = parseCurrencyInput(f.amount);
      if (!positiveDay || !incomeAmount) {
        nav.showToast('Khoản thu cần ngày nhận hợp lệ và số tiền dương');
        return;
      }
      ok = await fin.addIncomeRule({
      name: f.name.trim(), source: f.source || null, category_id: f.category_id || 'luong',
      amount: incomeAmount, rrule: { type: 'monthly', day: dueDay }, due_day: dueDay });
    } else if (seg === 'loan') {
      const principal = parseCurrencyInput(f.principal);
      const term = Number(f.term);
      const payDay = Number(f.pay_day);
      if (!principal || !Number.isInteger(term) || term <= 0
        || !Number.isInteger(payDay) || payDay < 1 || payDay > 31
        || Number(f.rate || 0) < 0) {
        nav.showToast('Khoản vay cần số gốc, số kỳ và ngày trả hợp lệ');
        return;
      }
      ok = await fin.addLoan({
      name: f.name.trim(), lender: f.lender || null, principal,
      rate: Number(f.rate) || 0, kind: f.kind || 'amort', term: Number(f.term) || null,
      pay_day: payDay, opened_at: f.opened_at || fin.today, due_at: f.due_at || null });
    } else if (seg === 'card') {
      const statementDay = Number(f.statement_day);
      const cardDueDay = Number(f.due_day);
      if (!Number.isInteger(statementDay) || statementDay < 1 || statementDay > 31
        || !Number.isInteger(cardDueDay) || cardDueDay < 1 || cardDueDay > 31
        || (f.last4 && !/^\d{4}$/.test(f.last4))) {
        nav.showToast('Thẻ cần ngày chốt, ngày đến hạn và 4 số cuối hợp lệ');
        return;
      }
      ok = await fin.addCard({
      name: f.name.trim(), bank: f.bank || null, last4: f.last4 || null,
      credit_limit: parseCurrencyInput(f.credit_limit) || 0,
      statement_day: statementDay, due_day: cardDueDay,
      grace: Number(f.grace) || null, annual_fee: parseCurrencyInput(f.annual_fee) || 0,
      cash_advance_fee: parseCurrencyInput(f.cash_advance_fee) || 0, min_pct: Number(f.min_pct) || 0 });
    }
    if (ok) {
      nav.showToast(
        seg === 'loan' ? 'Đã tạo khoản vay — mỗi tháng app nhắc trả lãi, tách gốc riêng khỏi chi tiêu'
        : seg === 'card' ? 'Đã thêm thẻ — app theo dõi ngày chốt, đến hạn và số ngày float'
        : seg === 'in' ? 'Đã thêm khoản thu — app chỉ nhắc, không tô đỏ khi chưa nhận'
        : 'Đã thêm hóa đơn — tới ngày app hiện nút để bạn ghi', { icon: 'checkCircle' });
      onDone();
    }
  };

  const grp = fin.cats.expenseGroups.find(g => g.key === (f.category_id || 'housing'));

  return (
    <form className="fin-card fin-form" onSubmit={submit}>
      <input className="fin-input" placeholder="Tên" value={f.name || ''} onChange={set('name')} autoFocus />
      {seg === 'out' && (<>
        <div className="fin-form__row">
          <input className="fin-input" placeholder="Nhà cung cấp" value={f.provider || ''} onChange={set('provider')} />
          <input className="fin-input" placeholder="Mã khách hàng" value={f.customer_code || ''} onChange={set('customer_code')} />
        </div>
        <div className="fin-form__row">
          <select className="fin-input" value={f.category_id || 'housing'} onChange={set('category_id')}>
            {fin.cats.expenseGroups.filter(g => !g.hidden).map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
          <select className="fin-input" value={f.subcategory_id || ''} onChange={set('subcategory_id')}>
            <option value="">— danh mục con —</option>
            {(grp?.subs || []).map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <div className="fin-form__row">
          <select className="fin-input" value={f.amount_mode || 'fixed'} onChange={set('amount_mode')}>
            <option value="fixed">Số tiền cố định</option>
            <option value="ask">Hỏi mỗi kỳ (điện/nước)</option>
          </select>
          <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="Số tiền" value={f.amount || ''} onChange={setDigits('amount')}
            disabled={f.amount_mode === 'ask'} />
        </div>
        <div className="fin-form__row">
          <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="Ngày trả trong tháng" value={f.due_day || ''} onChange={setDigits('due_day', 2)} />
          <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="Số kỳ (trả góp, để trống nếu vô hạn)" value={f.term_total || ''} onChange={setDigits('term_total', 3)} />
        </div>
      </>)}
      {seg === 'in' && (<>
        <select className="fin-input" value={f.category_id || 'luong'} onChange={set('category_id')}>
          {fin.cats.incomeGroups.filter(g => !g.hidden).map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
        </select>
        <div className="fin-form__row">
          <input className="fin-input" placeholder="Nguồn (công ty, người thuê…)" value={f.source || ''} onChange={set('source')} />
          <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="Số tiền" value={f.amount || ''} onChange={setDigits('amount')} />
        </div>
        <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="Ngày nhận trong tháng" value={f.due_day || ''} onChange={setDigits('due_day', 2)} />
      </>)}
      {seg === 'loan' && (<>
        <div className="fin-form__row">
          <input className="fin-input" placeholder="Bên cho vay" value={f.lender || ''} onChange={set('lender')} />
          <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="Số tiền gốc" value={f.principal || ''} onChange={setDigits('principal')} />
        </div>
        <div className="fin-form__row">
          <select className="fin-input" value={f.kind || 'amort'} onChange={set('kind')}>
            <option value="amort">Trả đều gốc + lãi</option>
            <option value="interest">Chỉ trả lãi, gốc cuối kỳ</option>
          </select>
          <input className="fin-input" inputMode="decimal" placeholder="Lãi %/năm" value={f.rate || ''} onChange={setDecimal('rate')} />
        </div>
        <div className="fin-form__row">
          <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="Số kỳ (tháng)" value={f.term || ''} onChange={setDigits('term', 3)} />
          <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="Ngày trả trong tháng" value={f.pay_day || ''} onChange={setDigits('pay_day', 2)} />
        </div>
        <div className="fin-form__row">
          <label className="fin-label">Mở ngày <input className="fin-input" type="date" value={f.opened_at || ''} onChange={set('opened_at')} /></label>
          <label className="fin-label">Tất toán gốc <input className="fin-input" type="date" value={f.due_at || ''} onChange={set('due_at')} /></label>
        </div>
      </>)}
      {seg === 'card' && (<>
        <div className="fin-form__row">
          <input className="fin-input" placeholder="Ngân hàng" value={f.bank || ''} onChange={set('bank')} />
          <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="4 số cuối" value={f.last4 || ''} onChange={setDigits('last4', 4)} />
        </div>
        <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="Hạn mức" value={f.credit_limit || ''} onChange={setDigits('credit_limit')} />
        <div className="fin-form__row">
          <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="Ngày chốt sao kê" value={f.statement_day || ''} onChange={setDigits('statement_day', 2)} />
          <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="Ngày đến hạn" value={f.due_day || ''} onChange={setDigits('due_day', 2)} />
        </div>
        <div className="fin-form__row">
          <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="Ân hạn (ngày)" value={f.grace || ''} onChange={setDigits('grace', 3)} />
          <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="Phí thường niên" value={f.annual_fee || ''} onChange={setDigits('annual_fee')} />
        </div>
        <div className="fin-form__row">
          <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="Phí rút tiền mặt" value={f.cash_advance_fee || ''} onChange={setDigits('cash_advance_fee')} />
          <input className="fin-input" inputMode="decimal" placeholder="% trả tối thiểu" value={f.min_pct || ''} onChange={setDecimal('min_pct')} />
        </div>
      </>)}
      <button type="submit" className="fin-btn fin-btn--primary"><AppIcon name="save" size={15} /> Lưu</button>
    </form>
  );
}

// Người dùng chủ động xác nhận ngày và nguồn tiền; app không tự thanh toán hộ.
function PayInline({ defaultAmount, label, onPay, fin, tasks = [], allowSource = false }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(defaultAmount ? String(defaultAmount) : '');
  const [occurredAt, setOccurredAt] = useState(fin.today);
  const [sourceCardId, setSourceCardId] = useState('');
  const [taskId, setTaskId] = useState(null);
  if (!open) return (
    <button className="fin-btn fin-btn--secondary fin-btn--sm" onClick={() => setOpen(true)}>
      <AppIcon name="checkCircle" size={15} /> {label}
    </button>
  );
  return (
    <div className="fin-payinline">
      <input className="fin-input fin-input--sm" inputMode="numeric" pattern="[0-9]*" placeholder="số tiền" value={v} onChange={e => setV(sanitizeDigits(e.target.value))} />
      <input className="fin-input fin-input--sm" type="date" max={fin.today} value={occurredAt} onChange={e => setOccurredAt(e.target.value)} />
      {allowSource && <select className="fin-input fin-input--sm" value={sourceCardId} onChange={e => setSourceCardId(e.target.value)}>
        <option value="">Tiền có sẵn</option>
        {fin.cards.map(c => <option key={c.id} value={c.id}>{c.name} {c.last4 ? `••${c.last4}` : ''}</option>)}
      </select>}
      <TaskPicker tasks={tasks} value={taskId} onPick={setTaskId} />
      <button className="fin-btn fin-btn--primary fin-btn--sm" disabled={!parseCurrencyInput(v)}
        onClick={async () => {
          const result = await onPay({ amount: parseCurrencyInput(v), occurredAt,
            sourceCardId: sourceCardId || null, taskId });
          if (result !== false) setOpen(false);
        }}><AppIcon name="check" size={14} /> Xác nhận</button>
      <button className="fin-icon-btn" onClick={() => setOpen(false)} aria-label="Hủy"><AppIcon name="x" size={14} /></button>
    </div>
  );
}

// ── out: Phải trả ─────────────────────────────────────────────────────────────
function BillsList({ fin, nav, tasks, daysUntilDay }) {
  const active = fin.bills.filter(b => !b.finished_at)
    .sort((a, b) => daysUntilDay(a.due_day, fin.today) - daysUntilDay(b.due_day, fin.today));
  const finished = fin.bills.filter(b => b.finished_at);
  const [openId, setOpenId] = useState(null);
  const currentPeriod = fin.today.slice(0, 7);
  const pay = async (bill, payload) => {
    const tx = await fin.payBill(bill, { ...payload, period: currentPeriod });
    nav.showToast(tx ? `Đã ghi ${bill.name} — giờ là giao dịch bình thường, lên báo cáo` : `Không thể ghi ${bill.name}. Kiểm tra dữ liệu Finance rồi thử lại.`, { icon: tx ? 'note' : 'warning' });
    return !!tx;
  };
  const skip = async (bill) => {
    const skipped = await fin.skipBillPeriod(bill.id, currentPeriod);
    nav.showToast(skipped
      ? `Đã bỏ kỳ này của ${bill.name} — không sinh giao dịch, kỳ sau vẫn nhắc`
      : `Không thể bỏ kỳ này của ${bill.name}. Kiểm tra dữ liệu Finance rồi thử lại.`,
    { icon: skipped ? 'skip' : 'warning' });
  };
  const toggle = async (bill, enabled) => {
    const updated = await fin.updateBill(bill.id, { enabled });
    nav.showToast(updated
      ? enabled ? `Đã bật lại ${bill.name}` : `Đã tắt ${bill.name} — dữ liệu cũ vẫn được giữ nguyên`
      : `Không thể cập nhật ${bill.name}. Kiểm tra dữ liệu Finance rồi thử lại.`,
    { icon: updated ? 'receipt' : 'warning' });
  };
  return (
    <div className="fin-rules">
      {active.length === 0 && <RulesEmpty icon="receipt" title="Chưa có hóa đơn"
        description="Thêm hóa đơn để theo dõi ngày đến hạn và lịch sử thanh toán." />}
      {active.map(b => {
        const d = daysUntilDay(b.due_day, fin.today);
        const paid = fin.transactions.some(t => t.bill_id === b.id && t.bill_period === currentPeriod);
        const skipped = (b.skipped_periods || []).includes(currentPeriod);
        const actionable = b.enabled && !paid && !skipped && d != null && d <= 0;
        const estimate = billAmountEstimate(b, fin.transactions);
        const progress = b.term_total ? Math.min(100, Math.round((b.term_done || 0) / b.term_total * 100)) : 0;
        return (
          <div key={b.id} className="fin-rule-wrap">
            <div className={`fin-rule${b.enabled ? '' : ' fin-rule--off'}`}>
              <button className="fin-rule__expand" onClick={() => setOpenId(openId === b.id ? null : b.id)} aria-label="Xem lịch sử">
                <FinanceIcon categoryId={b.category_id} cats={fin.cats} size={18} weight="fill" />
              </button>
              <div className="fin-rule__main">
                <div className="fin-rule__name">{b.name}
                  {b.term_total && <span className="fin-badge">{b.term_done || 0}/{b.term_total}</span>}</div>
                <div className="fin-rule__meta">{b.provider || ''}{b.customer_code ? ` · ${b.customer_code}` : ''}
                  {b.due_day ? ` · mỗi tháng ngày ${b.due_day}` : ''}
                  {!b.enabled ? <span> · đang tắt</span>
                    : paid ? <span className="fin-good"> · đã trả kỳ này</span>
                    : skipped ? <span> · đã bỏ kỳ này</span>
                    : d != null && <span className={d < 0 ? 'fin-overdue' : d <= 3 ? 'fin-due-soon' : ''}>
                      {d < 0 ? ` · quá hạn ${Math.abs(d)} ngày` : d === 0 ? ' · đến hạn hôm nay' : ` · còn ${d} ngày`}
                    </span>}
                </div>
                {b.term_total && <div className="fin-bill-term">
                  <div><i style={{ width: `${progress}%` }} /></div>
                  <small>Đã trả {b.term_done || 0}/{b.term_total} kỳ · còn {money(Math.max(0, b.term_total - (b.term_done || 0)) * estimate)}</small>
                </div>}
              </div>
              <div className="fin-rule__right">
                <div className="fin-rule__amt">{b.amount_mode === 'ask' ? estimate ? `~ ${money(estimate)}` : 'hỏi mỗi kỳ' : money(b.amount)}</div>
                {actionable && <div className="fin-rule__actions">
                  <PayInline fin={fin} tasks={tasks} allowSource defaultAmount={estimate || ''}
                    label={b.term_total ? `Thanh toán kỳ ${(b.term_done || 0) + 1}/${b.term_total}` : 'Thanh toán'} onPay={(payload) => pay(b, payload)} />
                  <button type="button" className="fin-btn fin-btn--ghost fin-btn--sm" onClick={() => skip(b)}>
                    <AppIcon name="skip" size={14} /> Bỏ kỳ này
                  </button>
                </div>}
                {skipped && <span className="fin-badge fin-badge--muted">Đã bỏ kỳ này</span>}
                <Toggle on={b.enabled} onChange={(enabled) => toggle(b, enabled)} label={b.enabled ? 'Đang bật' : 'Đang tắt'} />
                <button className="fin-icon-btn" title="Xóa" onClick={async () => { if (await nav.confirmDelete(`hóa đơn “${b.name}”`)) await fin.deleteBill(b.id); }}><AppIcon name="trash" size={15} /></button>
              </div>
            </div>
            {openId === b.id && <BillHistory bill={b} transactions={fin.transactions} />}
          </div>
        );
      })}
      {finished.length > 0 && (
        <details className="fin-archived">
          <summary><AppIcon name="archive" size={15} /> {finished.length} quy tắc đã kết thúc</summary>
          <p>Các kỳ đã trả vẫn ở Giao dịch và không thể bật lại quy tắc đã hoàn tất.</p>
          {finished.map(b => <div key={b.id} className="fin-archived__row"><span>{b.name}</span><strong>{b.term_done}/{b.term_total} kỳ</strong></div>)}
        </details>
      )}
    </div>
  );
}

function BillHistory({ bill, transactions }) {
  const history = transactions.filter(t => t.bill_id === bill.id)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  const max = Math.max(1, ...history.map(t => t.amount));
  return (
    <div className="fin-bill-history">
      <div className="fin-bill-history__head"><strong>Lịch sử các kỳ</strong><span>{history.length} lần đã ghi</span></div>
      {history.length === 0 ? <div className="fin-empty">Chưa có kỳ nào được thanh toán</div> : <>
        <div className="fin-bill-chart">
          {history.map(t => <div key={t.id} className="fin-bill-chart__col" title={`${t.occurred_at}: ${money(t.amount)}`}>
            <i style={{ height: `${Math.max(8, t.amount / max * 72)}px` }} /><small>{t.bill_period?.slice(5) || t.occurred_at.slice(5, 7)}</small>
          </div>)}
        </div>
        <div className="fin-bill-history__list">{history.slice().reverse().slice(0, 6).map(t =>
          <div key={t.id}><span>{t.occurred_at}</span><strong>{money(t.amount)}</strong></div>)}</div>
      </>}
    </div>
  );
}

// ── in: Sẽ nhận (không quá hạn) ──────────────────────────────────────────────
function IncomeList({ fin, nav, tasks }) {
  const period = currentMonthPeriod(fin.today).key.slice(0, 7);
  const receive = async (rule, payload) => {
    const tx = await fin.receiveIncome(rule, { ...payload, period });
    nav.showToast(tx ? `Đã nhận ${rule.name} — ghi vào khoản thu` : `Không thể ghi ${rule.name}. Kiểm tra dữ liệu Finance rồi thử lại.`, { icon: tx ? 'money' : 'warning' });
    return !!tx;
  };
  const toggle = async (rule, enabled) => {
    const updated = await fin.updateIncomeRule(rule.id, { enabled });
    nav.showToast(updated
      ? enabled ? `Đã bật lại ${rule.name}` : `Đã tắt ${rule.name} — dữ liệu cũ vẫn được giữ nguyên`
      : `Không thể cập nhật ${rule.name}. Kiểm tra dữ liệu Finance rồi thử lại.`,
    { icon: updated ? 'money' : 'warning' });
  };
  return (
    <div className="fin-rules">
      {fin.incomeRules.length === 0 && <RulesEmpty icon="money" title="Chưa có khoản thu định kỳ"
        description="Khai khoản thu để app nhắc xác nhận theo từng kỳ." />}
      {fin.incomeRules.map(r => {
        const received = (r.received_periods || []).includes(period);
        return (
          <div key={r.id} className={`fin-rule${r.enabled ? '' : ' fin-rule--off'}`}>
            <div className="fin-rule__main">
              <div className="fin-rule__name"><AppIcon name="money" size={17} weight="fill" /> {r.name}</div>
              <div className="fin-rule__meta">{r.source || ''}{r.due_day ? ` · ngày ${r.due_day}` : ''}</div>
            </div>
            <div className="fin-rule__right">
              <div className="fin-rule__amt">{money(r.amount)}</div>
              {!r.enabled ? <span className="fin-badge fin-badge--muted">Đang tắt</span>
                : received ? <span className="fin-badge">đã nhận kỳ này</span>
                : <PayInline fin={fin} tasks={tasks} defaultAmount={r.amount} label="Đã nhận" onPay={(payload) => receive(r, payload)} />}
              <Toggle on={r.enabled} onChange={(enabled) => toggle(r, enabled)} label={r.enabled ? 'Đang bật' : 'Đang tắt'} />
              <button className="fin-icon-btn" title="Xóa" onClick={async () => { if (await nav.confirmDelete(`khoản thu “${r.name}”`)) await fin.deleteIncomeRule(r.id); }}><AppIcon name="trash" size={15} /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── loan: Khoản vay ───────────────────────────────────────────────────────────
function LoansList({ fin, nav, tasks }) {
  const period = fin.today.slice(0, 7);
  return (
    <div className="fin-rules">
      {fin.loans.length === 0 && <RulesEmpty icon="bank" title="Chưa có khoản vay"
        description="Thêm khoản vay để tách phần gốc và lãi trong mỗi lần trả." />}
      {fin.loans.map(l => {
        const sch = loanSchedule(l);
        const d = daysUntilDay(l.pay_day, fin.today);
        const due = d != null && d <= 0;
        const paidInterest = fin.transactions.some(t => t.loan_id === l.id && t.loan_period === period && t.loan_part === 'interest');
        const paidPrincipal = fin.transactions.some(t => t.loan_id === l.id && t.loan_period === period && t.loan_part === 'principal');
        const principalDue = l.due_at && l.due_at <= fin.today;
        return (
          <div key={l.id} className="fin-rule fin-rule--col">
            <div className="fin-rule__name"><AppIcon name="bank" size={17} weight="fill" /> {l.name} <span className="fin-badge">{sch.progress.done}/{sch.progress.total} kỳ</span></div>
            <div className="fin-rule__meta">{l.lender || ''} · gốc {money(l.principal)} · {l.rate}%/năm</div>
            <div className={`fin-rule__meta${d != null && d < 0 ? ' fin-overdue' : d != null && d <= 3 ? ' fin-due-soon' : ''}`}>
              {paidInterest || paidPrincipal ? 'Đã ghi kỳ này' : d == null ? '' : d < 0 ? `Quá hạn ${Math.abs(d)} ngày` : d === 0 ? 'Đến hạn hôm nay' : `Còn ${d} ngày`}
            </div>
            {sch.kind === 'interest' ? (
              <>
                <div className="fin-rule__meta">Lãi mỗi kỳ {money(sch.monthlyInterest)} · gốc tất toán {l.due_at || '—'}</div>
                <div className="fin-payrow">
                  {due && !paidInterest && <PayInline fin={fin} tasks={tasks} defaultAmount={sch.monthlyInterest} label="Trả lãi" onPay={async (payload) => {
                    const tx = await fin.payLoanInterest(l, { ...payload, period });
                    nav.showToast(tx ? 'Đã ghi lãi vay — tính vào chi tiêu' : 'Không thể ghi lãi vay. Kiểm tra dữ liệu Finance rồi thử lại.', { icon: tx ? 'handCoins' : 'warning' });
                    return !!tx; }} />}
                  {paidInterest && <span className="fin-badge">Đã trả lãi kỳ này</span>}
                  {principalDue && !paidPrincipal && <PayInline fin={fin} tasks={tasks} defaultAmount={sch.principalDue} label="Tất toán gốc" onPay={async (payload) => {
                    const tx = await fin.payLoanPrincipal(l, { ...payload, period });
                    nav.showToast(tx ? 'Đã tất toán gốc — đứng ngoài tổng chi' : 'Không thể tất toán gốc. Kiểm tra dữ liệu Finance rồi thử lại.', { icon: tx ? 'bank' : 'warning' });
                    return !!tx; }} />}
                </div>
              </>
            ) : (
              <>
                <div className="fin-rule__meta">Trả đều {money(sch.monthlyPayment)}/kỳ · dư nợ gốc ~{money(sch.principalRemaining)}</div>
                <div className="fin-loan-split"><span>Lãi kỳ tới <strong>{money(sch.interestPart)}</strong></span><span>Gốc kỳ tới <strong>{money(sch.principalPart)}</strong></span></div>
                <div className="fin-payrow">
                  {due && !paidPrincipal ? <PayInline fin={fin} tasks={tasks} defaultAmount={sch.monthlyPayment} label="Trả kỳ này" onPay={async (payload) => {
                    const result = await fin.payLoanInstallment(l, { ...payload, period });
                    if (result) nav.showToast(`Đã tách ${money(result.interest)} lãi và ${money(result.principal)} gốc`, { icon: 'handCoins' });
                    else nav.showToast('Không thể ghi kỳ vay. Kiểm tra dữ liệu Finance rồi thử lại.', { icon: 'warning' });
                    return !!result;
                  }} /> : paidPrincipal ? <span className="fin-badge">Đã trả kỳ này</span> : null}
                </div>
              </>
            )}
            <button className="fin-icon-btn fin-rule__del" title="Xóa" onClick={async () => { if (await nav.confirmDelete(`khoản vay “${l.name}”`)) await fin.deleteLoan(l.id); }}><AppIcon name="trash" size={15} /></button>
          </div>
        );
      })}
    </div>
  );
}

// ── card: Thẻ tín dụng ────────────────────────────────────────────────────────
function CardsList({ fin, nav, tasks }) {
  return (
    <div className="fin-rules">
      {fin.cards.length === 0 && <RulesEmpty icon="creditCard" title="Chưa có thẻ tín dụng"
        description="Thêm thẻ để theo dõi hạn mức, sao kê và ngày đến hạn." />}
      {fin.cards.map(c => {
        const cyc = cardStatementSummary(c, fin.transactions, fin.today);
        const balance = cardBalance(c.id, fin.transactions);
        const est = floatInterest(cyc.outstanding, cyc.floatDaysTotal, fin.blendedRate);
        const usedPct = c.credit_limit ? Math.round((balance / c.credit_limit) * 100) : 0;
        return (
          <div key={c.id} className="fin-rule fin-rule--col">
            <div className="fin-rule__name"><AppIcon name="creditCard" size={17} weight="fill" /> {c.name} {c.last4 ? `••${c.last4}` : ''}
              {cyc.overdue && cyc.outstanding > 0 && <span className="fin-badge fin-badge--danger">quá hạn</span>}</div>
            <div className="fin-rule__meta">{c.bank || ''} · hạn mức {money(c.credit_limit)} ({usedPct}%)</div>
            <div className="fin-cardbar"><div style={{ width: `${Math.min(100, usedPct)}%` }} /></div>
            <div className="fin-rule__meta">
              Sao kê {money(cyc.statementTotal)} · đã trả {money(cyc.paid)} · còn {money(cyc.outstanding)} · đến hạn {cyc.due}
            </div>
            {est > 0 && <div className="fin-rule__meta fin-good">Float đang kiếm ~{money(est)} lãi (lãi gửi bình quân {fin.blendedRate}%/năm)</div>}
            {c.annual_fee > 0 && <div className="fin-rule__meta">Phí thường niên {money(c.annual_fee)}</div>}
            {c.cash_advance_fee > 0 && <div className="fin-warn fin-inline-message"><AppIcon name="warning" size={15} weight="fill" /> Rút tiền mặt mất phí {money(c.cash_advance_fee)} — tránh</div>}
            <div className="fin-payrow">
              {cyc.outstanding > 0 ? <PayInline fin={fin} tasks={tasks} defaultAmount={cyc.outstanding} label="Trả sao kê" onPay={async (payload) => {
                const tx = await fin.payCardStatement(c, { ...payload, period: cyc.period });
                if (tx) nav.showToast('Đã ghi trả sao kê — không phải chi mới, chỉ để lịch sử', { icon: 'creditCard' });
                return !!tx;
              }} /> : <span className="fin-badge">Sao kê đã thanh toán</span>}
            </div>
            <button className="fin-icon-btn fin-rule__del" title="Xóa" onClick={async () => { if (await nav.confirmDelete(`thẻ “${c.name}”`)) await fin.deleteCard(c.id); }}><AppIcon name="trash" size={15} /></button>
          </div>
        );
      })}
    </div>
  );
}
