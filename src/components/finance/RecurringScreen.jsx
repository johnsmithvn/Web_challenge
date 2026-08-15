import { useState, useEffect, useRef } from 'react';
import { parseCurrencyInput, sanitizeDecimal, sanitizeDigits } from '../../utils/currencyUtils';
import { useUserTasks } from '../../hooks/useUserTasks';
import {
  billAmountEstimate, cardBalance, cardStatementSummary, floatInterest, loanSchedule,
  currentMonthPeriod, dueDateInMonth, daysUntilDue, addDaysStr,
} from '../../utils/financeLogic';
import { money, Segmented, FinanceIcon, TaskPicker, Toggle } from './parts';
import AppIcon from '../AppIcon';

const SEGMENTS = [
  { value: 'out',  label: 'Phải trả',   addLabel: 'Thêm hóa đơn', editLabel: 'Sửa hóa đơn' },
  { value: 'in',   label: 'Sẽ nhận',    addLabel: 'Thêm khoản thu', editLabel: 'Sửa khoản thu' },
  { value: 'loan', label: 'Khoản vay',  addLabel: 'Thêm khoản vay', editLabel: 'Sửa khoản vay' },
  { value: 'card', label: 'Thẻ tín dụng', addLabel: 'Thêm thẻ', editLabel: 'Sửa thẻ' },
];

/**
 * Mẫu chỉ điền TÊN + NHÓM + kiểu số tiền để đỡ gõ. Không mẫu nào điền sẵn số tiền:
 * số tiền là thứ duy nhất người dùng buộc phải tự quyết.
 */
const BILL_TEMPLATES = [
  { label: 'Tiền điện',      category_id: 'housing', subcategory_id: 'housing.electric', amount_mode: 'ask' },
  { label: 'Tiền nước',      category_id: 'housing', subcategory_id: 'housing.water', amount_mode: 'ask' },
  { label: 'Internet',       category_id: 'housing', subcategory_id: 'housing.internet', amount_mode: 'fixed' },
  { label: 'Điện thoại & 4G', category_id: 'housing', subcategory_id: 'housing.mobile', amount_mode: 'fixed' },
  { label: 'Tiền thuê nhà',  category_id: 'housing', subcategory_id: 'housing.rent', amount_mode: 'fixed' },
  { label: 'Phí quản lý',    category_id: 'housing', subcategory_id: 'housing.management', amount_mode: 'fixed' },
  { label: 'Netflix',        category_id: 'subscription', subcategory_id: 'subscription.streaming', amount_mode: 'fixed' },
  { label: 'Gói phần mềm',   category_id: 'subscription', subcategory_id: 'subscription.software', amount_mode: 'fixed' },
  { label: 'Trả góp',        category_id: 'finance', subcategory_id: 'finance.installment', amount_mode: 'fixed' },
  { label: 'Bảo hiểm',       category_id: 'health', subcategory_id: 'health.insurance', amount_mode: 'fixed' },
  { label: 'Học phí',        category_id: 'family', subcategory_id: 'family.tuition', amount_mode: 'fixed' },
];

/**
 * Sáu trạng thái của một dòng nghĩa vụ. Chỉ màu vạch trái và dòng chữ đổi —
 * cấu trúc dòng giữ nguyên để mắt không phải học lại bố cục mỗi lần.
 * `neverLate`: khoản thu chưa nhận thì chỉ là chưa tới, không tô đỏ.
 */
function dueState({ days, enabled = true, done = false, doneText, skipped = false, neverLate = false }) {
  if (!enabled) return { tone: 'off', text: 'đang tắt' };
  if (done) return { tone: 'paid', text: doneText || 'đã trả kỳ này' };
  if (skipped) return { tone: 'off', text: 'đã bỏ kỳ này' };
  if (days == null) return { tone: 'soon', text: '' };
  if (days > 0) return { tone: 'soon', text: `còn ${days} ngày` };
  if (days === 0) return { tone: 'today', text: 'tới hạn hôm nay' };
  return neverLate
    ? { tone: 'soon', text: 'chưa nhận' }
    : { tone: 'over', text: `quá hạn ${Math.abs(days)} ngày` };
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

/** Thanh tiến độ dùng chung: trả góp của hóa đơn, kỳ vay, hạn mức thẻ. */
function RuleProgress({ pct, label }) {
  return (
    <div className="fin-progress">
      <div><i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
      <small>{label}</small>
    </div>
  );
}

/**
 * Khung dòng dùng chung cho cả 4 segment: icon · tên + phụ đề · số tiền + trạng thái ·
 * nút sửa/công tắc/xóa. Mọi thứ mở thêm (khối trả, form sửa, lịch sử) là children,
 * nằm NGAY dưới dòng đó nên danh sách không nhảy chỗ.
 */
function RuleCard({
  tone = 'soon', off, icon, categoryId, cats, title, badge, meta, amount, state, hasNote,
  onOpen, openTitle = 'Xem lịch sử', onEdit, enabled, onToggle, onDelete, children,
}) {
  return (
    <article className={`fin-rule${off ? ' fin-rule--off' : ''}`} data-tone={tone}>
      <div className="fin-rule__line">
        <button type="button" className="fin-rule__ico" onClick={onOpen} title={openTitle} aria-label={`${openTitle} — ${title}`}>
          {categoryId
            ? <FinanceIcon categoryId={categoryId} cats={cats} size={17} weight="fill" />
            : <AppIcon name={icon} size={17} weight="fill" />}
        </button>
        <button type="button" className="fin-rule__main" onClick={onOpen}>
          <span className="fin-rule__name">{title}
            {badge && <span className="fin-badge">{badge}</span>}
            {hasNote && <AppIcon name="note" size={13} className="fin-rule__notedot" aria-label="Có ghi chú" />}</span>
          <span className="fin-rule__meta">{meta}</span>
        </button>
        <div className="fin-rule__right">
          <span className="fin-rule__amt">{amount}</span>
          {state?.text && <span className={`fin-rule__state fin-rule__state--${state.tone}`}>{state.text}</span>}
        </div>
        <div className="fin-rule__tools">
          {onEdit && <button type="button" className="fin-icon-btn" title="Sửa" onClick={onEdit}><AppIcon name="pencil" size={14} /></button>}
          {onToggle && <Toggle on={enabled} onChange={onToggle} />}
          {onDelete && <button type="button" className="fin-icon-btn" title="Xóa" onClick={onDelete}><AppIcon name="trash" size={14} /></button>}
        </div>
      </div>
      {children}
    </article>
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
  const overdueBills = unpaidBills.filter(bill => daysUntilDue(bill.due_day, fin.today) < 0);
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

      {adding && <RuleForm seg={seg} fin={fin} nav={nav} onDone={() => setAdding(false)} />}

      {seg === 'out'  && <BillsList fin={fin} nav={nav} tasks={pendingTasks} />}
      {seg === 'in'   && <IncomeList fin={fin} nav={nav} tasks={pendingTasks} />}
      {seg === 'loan' && <LoansList fin={fin} nav={nav} tasks={pendingTasks} />}
      {seg === 'card' && <CardsList fin={fin} nav={nav} tasks={pendingTasks} />}
    </div>
  );
}

// ── Form thêm / sửa (cùng một form, khác nhau ở `initial`) ────────────────────
function RuleForm({ seg, fin, nav, initial, focusNote = false, onDone }) {
  const editing = Boolean(initial?.id);
  const noteRef = useRef(null);
  const [f, setF] = useState(() => (initial
    ? Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, v == null ? '' : v]))
    : { name: nav.handoff?.kind === seg ? nav.handoff.title || '' : '' }));
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const setDigits = (k, maxLength = 18) => (e) => setF(p => ({ ...p, [k]: sanitizeDigits(e.target.value, maxLength) }));
  const setDecimal = (k, maxIntegerDigits = 3, maxFractionDigits = 4) => (e) => setF(p => ({
    ...p, [k]: sanitizeDecimal(e.target.value, maxIntegerDigits, maxFractionDigits),
  }));
  useEffect(() => { if (!editing && nav.handoff?.kind === seg) nav.clearHandoff(); }, []); // eslint-disable-line
  // Mở từ link "Thêm ghi chú" thì con trỏ nhảy thẳng vào ô ghi chú.
  useEffect(() => { if (focusNote) noteRef.current?.focus(); }, [focusNote]);

  const applyTemplate = (t) => setF(p => ({
    ...p, name: t.label, category_id: t.category_id, subcategory_id: t.subcategory_id,
    amount_mode: t.amount_mode, amount: t.amount_mode === 'ask' ? '' : p.amount || '',
  }));

  const submit = async (e) => {
    e.preventDefault();
    if (!f.name?.trim()) return;
    const dueDay = Number(f.due_day);
    const positiveDay = Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31;
    let payload;
    if (seg === 'out') {
      const amountMode = f.amount_mode || 'fixed';
      const billAmount = parseCurrencyInput(f.amount);
      if (!positiveDay || (amountMode === 'fixed' && !billAmount)) {
        nav.showToast('Hóa đơn cần ngày trả hợp lệ và số tiền dương');
        return;
      }
      payload = {
        name: f.name.trim(), provider: f.provider || null, customer_code: f.customer_code || null,
        category_id: f.category_id || 'housing', subcategory_id: f.subcategory_id || null,
        amount_mode: amountMode, amount: amountMode === 'ask' ? null : billAmount,
        rrule: { type: 'monthly', day: dueDay }, due_day: dueDay,
        term_total: Number(f.term_total) || null,
        note: f.note?.trim() || null,
      };
    } else if (seg === 'in') {
      const incomeAmount = parseCurrencyInput(f.amount);
      if (!positiveDay || !incomeAmount) {
        nav.showToast('Khoản thu cần ngày nhận hợp lệ và số tiền dương');
        return;
      }
      payload = {
        name: f.name.trim(), source: f.source || null, category_id: f.category_id || 'luong',
        amount: incomeAmount, rrule: { type: 'monthly', day: dueDay }, due_day: dueDay,
      };
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
      payload = {
        name: f.name.trim(), lender: f.lender || null, principal,
        rate: Number(f.rate) || 0, kind: f.kind || 'amort', term,
        pay_day: payDay, opened_at: f.opened_at || fin.today, due_at: f.due_at || null,
      };
    } else if (seg === 'card') {
      const statementDay = Number(f.statement_day);
      const cardDueDay = Number(f.due_day);
      if (!Number.isInteger(statementDay) || statementDay < 1 || statementDay > 31
        || !Number.isInteger(cardDueDay) || cardDueDay < 1 || cardDueDay > 31
        || (f.last4 && !/^\d{4}$/.test(f.last4))) {
        nav.showToast('Thẻ cần ngày chốt, ngày đến hạn và 4 số cuối hợp lệ');
        return;
      }
      payload = {
        name: f.name.trim(), bank: f.bank || null, last4: f.last4 || null,
        credit_limit: parseCurrencyInput(f.credit_limit) || 0,
        statement_day: statementDay, due_day: cardDueDay,
        grace: Number(f.grace) || null, annual_fee: parseCurrencyInput(f.annual_fee) || 0,
        cash_advance_fee: parseCurrencyInput(f.cash_advance_fee) || 0, min_pct: Number(f.min_pct) || 0,
      };
    }
    const save = {
      out: editing ? (p) => fin.updateBill(initial.id, p) : fin.addBill,
      in: editing ? (p) => fin.updateIncomeRule(initial.id, p) : fin.addIncomeRule,
      loan: editing ? (p) => fin.updateLoan(initial.id, p) : fin.addLoan,
      card: editing ? (p) => fin.updateCard(initial.id, p) : fin.addCard,
    }[seg];
    const ok = await save(payload);
    if (!ok) {
      nav.showToast('Không lưu được. Kiểm tra dữ liệu Finance rồi thử lại.', { icon: 'warning' });
      return;
    }
    nav.showToast(
      editing ? 'Số mới áp dụng từ kỳ sau — các kỳ đã ghi giữ nguyên'
      : seg === 'loan' ? 'Đã tạo khoản vay — mỗi tháng app nhắc trả lãi, tách gốc riêng khỏi chi tiêu'
      : seg === 'card' ? 'Đã thêm thẻ — app theo dõi ngày chốt, đến hạn và số ngày float'
      : seg === 'in' ? 'Đã thêm khoản thu — app chỉ nhắc, không tô đỏ khi chưa nhận'
      : 'Đã thêm hóa đơn — tới ngày app hiện nút để bạn ghi', { icon: 'checkCircle' });
    onDone();
  };

  const grp = fin.cats.expenseGroups.find(g => g.key === (f.category_id || 'housing'));
  const segMeta = SEGMENTS.find(s => s.value === seg);

  return (
    <form className={`fin-card fin-form fin-ruleform${editing ? ' fin-ruleform--edit' : ''}`} onSubmit={submit}>
      <div className="fin-ruleform__head">
        <strong>{editing ? segMeta.editLabel : segMeta.addLabel}</strong>
        {editing && <button type="button" className="fin-icon-btn" onClick={onDone} aria-label="Đóng"><AppIcon name="x" size={15} /></button>}
      </div>

      {seg === 'out' && !editing && (
        <div className="fin-templates">
          <small>Mẫu — chỉ điền tên và nhóm, không điền số tiền</small>
          <div>{BILL_TEMPLATES.map(t => (
            <button type="button" key={t.label} className={f.name === t.label ? 'is-active' : ''}
              onClick={() => applyTemplate(t)}>{t.label}</button>
          ))}</div>
        </div>
      )}

      <label className="fin-field"><span>Tên</span>
        <input className="fin-input" placeholder="Tiền điện, Netflix, Trả góp máy giặt…" value={f.name || ''} onChange={set('name')} autoFocus={!focusNote} /></label>

      {seg === 'out' && (<>
        <div className="fin-form__row">
          <label className="fin-field"><span>Nhà cung cấp</span>
            <input className="fin-input" placeholder="EVN, FPT…" value={f.provider || ''} onChange={set('provider')} /></label>
          <label className="fin-field"><span>Mã khách hàng</span>
            <input className="fin-input" placeholder="Phân biệt khi có nhiều đồng hồ" value={f.customer_code || ''} onChange={set('customer_code')} /></label>
        </div>
        <div className="fin-form__row">
          <label className="fin-field"><span>Nhóm</span>
            <select className="fin-input" value={f.category_id || 'housing'} onChange={set('category_id')}>
              {fin.cats.expenseGroups.filter(g => !g.hidden).map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select></label>
          <label className="fin-field"><span>Danh mục con</span>
            <select className="fin-input" value={f.subcategory_id || ''} onChange={set('subcategory_id')}>
              <option value="">— không chọn —</option>
              {(grp?.subs || []).map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select></label>
        </div>
        <div className="fin-form__row">
          <label className="fin-field"><span>Kiểu số tiền</span>
            <select className="fin-input" value={f.amount_mode || 'fixed'} onChange={set('amount_mode')}>
              <option value="fixed">Số tiền cố định</option>
              <option value="ask">Hỏi mỗi kỳ (điện/nước)</option>
            </select></label>
          <label className="fin-field"><span>Số tiền</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder={f.amount_mode === 'ask' ? 'app hỏi mỗi kỳ' : 'vd 220000'}
              value={f.amount || ''} onChange={setDigits('amount')} disabled={f.amount_mode === 'ask'} /></label>
        </div>
        <div className="fin-form__row">
          <label className="fin-field"><span>Ngày trả trong tháng</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="1–31" value={f.due_day || ''} onChange={setDigits('due_day', 2)} /></label>
          <label className="fin-field"><span>Số kỳ trả góp</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="để trống nếu chạy vô hạn" value={f.term_total || ''} onChange={setDigits('term_total', 3)} /></label>
        </div>
        <label className="fin-field"><span>Ghi chú</span>
          <textarea ref={noteRef} className="fin-input fin-textarea" rows={3}
            placeholder="Số công tơ, ai đứng tên, cách chia tiền với bạn cùng phòng…"
            value={f.note || ''} onChange={set('note')} />
          <small className="fin-field__hint">Ghi chú nằm ở hóa đơn, không rơi xuống từng giao dịch.</small></label>
      </>)}

      {seg === 'in' && (<>
        <label className="fin-field"><span>Nhóm thu</span>
          <select className="fin-input" value={f.category_id || 'luong'} onChange={set('category_id')}>
            {fin.cats.incomeGroups.filter(g => !g.hidden).map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select></label>
        <div className="fin-form__row">
          <label className="fin-field"><span>Nguồn</span>
            <input className="fin-input" placeholder="công ty, người thuê…" value={f.source || ''} onChange={set('source')} /></label>
          <label className="fin-field"><span>Số tiền</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="vd 15000000" value={f.amount || ''} onChange={setDigits('amount')} /></label>
        </div>
        <label className="fin-field"><span>Ngày nhận trong tháng</span>
          <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="1–31" value={f.due_day || ''} onChange={setDigits('due_day', 2)} /></label>
      </>)}

      {seg === 'loan' && (<>
        <div className="fin-form__row">
          <label className="fin-field"><span>Bên cho vay</span>
            <input className="fin-input" placeholder="ngân hàng, người thân…" value={f.lender || ''} onChange={set('lender')} /></label>
          <label className="fin-field"><span>Số tiền gốc</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="vd 200000000" value={f.principal || ''} onChange={setDigits('principal')} /></label>
        </div>
        <div className="fin-form__row">
          <label className="fin-field"><span>Kiểu trả</span>
            <select className="fin-input" value={f.kind || 'amort'} onChange={set('kind')}>
              <option value="amort">Trả đều gốc + lãi</option>
              <option value="interest">Chỉ trả lãi, gốc cuối kỳ</option>
            </select></label>
          <label className="fin-field"><span>Lãi %/năm</span>
            <input className="fin-input" inputMode="decimal" placeholder="vd 9.5" value={f.rate || ''} onChange={setDecimal('rate')} /></label>
        </div>
        <div className="fin-form__row">
          <label className="fin-field"><span>Số kỳ (tháng)</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="vd 24" value={f.term || ''} onChange={setDigits('term', 3)} /></label>
          <label className="fin-field"><span>Ngày trả trong tháng</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="1–31" value={f.pay_day || ''} onChange={setDigits('pay_day', 2)} /></label>
        </div>
        <div className="fin-form__row">
          <label className="fin-field"><span>Mở ngày</span>
            <input className="fin-input" type="date" value={f.opened_at || ''} onChange={set('opened_at')} /></label>
          <label className="fin-field"><span>Tất toán gốc</span>
            <input className="fin-input" type="date" value={f.due_at || ''} onChange={set('due_at')} /></label>
        </div>
        <p className="fin-form__note"><AppIcon name="lightbulb" size={14} /> Lãi là chi tiêu, gốc thì không — khoản gốc vẫn hiện ở Giao dịch nhưng đứng ngoài mọi tổng chi.</p>
      </>)}

      {seg === 'card' && (<>
        <div className="fin-form__row">
          <label className="fin-field"><span>Ngân hàng</span>
            <input className="fin-input" placeholder="VIB, TPBank…" value={f.bank || ''} onChange={set('bank')} /></label>
          <label className="fin-field"><span>4 số cuối</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="1234" value={f.last4 || ''} onChange={setDigits('last4', 4)} /></label>
        </div>
        <label className="fin-field"><span>Hạn mức</span>
          <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="vd 50000000" value={f.credit_limit || ''} onChange={setDigits('credit_limit')} /></label>
        <div className="fin-form__row">
          <label className="fin-field"><span>Ngày chốt sao kê</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="1–31" value={f.statement_day || ''} onChange={setDigits('statement_day', 2)} /></label>
          <label className="fin-field"><span>Ngày đến hạn</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="1–31" value={f.due_day || ''} onChange={setDigits('due_day', 2)} /></label>
        </div>
        <div className="fin-form__row">
          <label className="fin-field"><span>Ân hạn (ngày)</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="vd 15" value={f.grace || ''} onChange={setDigits('grace', 3)} /></label>
          <label className="fin-field"><span>Phí thường niên</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="vd 500000" value={f.annual_fee || ''} onChange={setDigits('annual_fee')} /></label>
        </div>
        <div className="fin-form__row">
          <label className="fin-field"><span>Phí rút tiền mặt</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="vd 100000" value={f.cash_advance_fee || ''} onChange={setDigits('cash_advance_fee')} /></label>
          <label className="fin-field"><span>% trả tối thiểu</span>
            <input className="fin-input" inputMode="decimal" placeholder="vd 5" value={f.min_pct || ''} onChange={setDecimal('min_pct')} /></label>
        </div>
        <p className="fin-form__note"><AppIcon name="lightbulb" size={14} /> Ngày chốt và ngày đến hạn là hai ngày khác nhau — khoảng giữa chúng là số ngày tiền ngân hàng nằm trong tay bạn.</p>
      </>)}

      {editing && (seg === 'out' || seg === 'in') && (
        <p className="fin-warn fin-form__warn"><AppIcon name="warning" size={14} weight="fill" /> Số mới áp dụng từ kỳ sau — các kỳ đã ghi giữ nguyên số cũ.</p>
      )}

      <div className="fin-ruleform__actions">
        {editing && <button type="button" className="fin-btn fin-btn--ghost fin-btn--sm" onClick={onDone}>Hủy</button>}
        <button type="submit" className="fin-btn fin-btn--primary fin-btn--sm"><AppIcon name="save" size={15} /> Lưu</button>
      </div>
    </form>
  );
}

// ── Khối ghi một kỳ ──────────────────────────────────────────────────────────
// Mở ngay dưới dòng, không đẩy sang màn khác và không mở modal: người dùng
// thường trả liền ba bốn khoản, rời danh sách mỗi lần là hỏng nhịp.
function PayBlock({ fin, tasks = [], defaultAmount, dueDay, allowSource = false,
  confirmLabel = 'Xác nhận thanh toán', onPay, onCancel }) {
  const amountRef = useRef(null);
  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount) : '');
  const [occurredAt, setOccurredAt] = useState(fin.today);
  const [sourceCardId, setSourceCardId] = useState('');
  const [taskId, setTaskId] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { amountRef.current?.select(); }, []);

  const yesterday = addDaysStr(fin.today, -1);
  const dueDate = dueDateInMonth(dueDay, fin.today);
  const quickDates = [
    { key: fin.today, label: 'Hôm nay' },
    { key: yesterday, label: 'Hôm qua' },
    ...(dueDate && dueDate < yesterday ? [{ key: dueDate, label: `Đúng hạn ${dueDate.slice(8)}/${dueDate.slice(5, 7)}` }] : []),
  ];
  const card = fin.cards.find(c => c.id === sourceCardId);

  const confirm = async () => {
    setBusy(true);
    const result = await onPay({ amount: parseCurrencyInput(amount), occurredAt, sourceCardId: sourceCardId || null, taskId });
    setBusy(false);
    if (result !== false) onCancel();
  };

  return (
    <div className="fin-payblock">
      <div className="fin-payblock__grid">
        <label className="fin-field"><span>Số tiền đã trả</span>
          <input ref={amountRef} className="fin-input" inputMode="numeric" pattern="[0-9]*" autoFocus
            placeholder="chưa có kỳ nào để gợi ý" value={amount} onChange={e => setAmount(sanitizeDigits(e.target.value))} /></label>
        <div className="fin-field"><span>Ngày đã trả thật</span>
          <div className="fin-payblock__dates">
            <input className="fin-input" type="date" max={fin.today} value={occurredAt} onChange={e => setOccurredAt(e.target.value)} />
            {quickDates.map(d => (
              <button type="button" key={d.key} className={occurredAt === d.key ? 'is-active' : ''}
                onClick={() => setOccurredAt(d.key)}>{d.label}</button>
            ))}
          </div>
        </div>
      </div>

      {allowSource && (
        <div className="fin-field"><span>Trả bằng</span>
          <div className="fin-source-picker">
            <button type="button" className={!sourceCardId ? 'is-active' : ''} onClick={() => setSourceCardId('')}>
              <AppIcon name="wallet" size={14} /> Tiền có sẵn
            </button>
            {fin.cards.map(c => (
              <button type="button" key={c.id} className={sourceCardId === c.id ? 'is-active' : ''} onClick={() => setSourceCardId(c.id)}>
                <AppIcon name="creditCard" size={14} /> {c.name}{c.last4 ? ` ••${c.last4}` : ''}
              </button>
            ))}
          </div>
          <small className="fin-payblock__hint">{card
            ? `Ghi vào sao kê ${card.name} — trả sao kê sau không bị tính là khoản chi mới.`
            : 'Tính thẳng vào chi tiêu của ngày bạn chọn.'}</small>
        </div>
      )}

      <div className="fin-payblock__foot">
        <TaskPicker tasks={tasks} value={taskId} onPick={setTaskId} />
        <button type="button" className="fin-btn fin-btn--ghost fin-btn--sm" onClick={onCancel}>Hủy</button>
        <button type="button" className="fin-btn fin-btn--primary fin-btn--sm" disabled={busy || !parseCurrencyInput(amount)} onClick={confirm}>
          <AppIcon name="check" size={14} /> {confirmLabel}
        </button>
      </div>
    </div>
  );
}

// ── out: Phải trả ─────────────────────────────────────────────────────────────
function BillsList({ fin, nav, tasks }) {
  // Sắp theo NGÀY TRONG THÁNG, không theo mức khẩn: vị trí một hóa đơn không đổi
  // từ ngày này sang ngày khác, chỉ màu vạch và dòng chữ đổi.
  const active = fin.bills.filter(b => !b.finished_at).sort((a, b) => (a.due_day || 99) - (b.due_day || 99));
  const finished = fin.bills.filter(b => b.finished_at);
  const [openId, setOpenId] = useState(null);   // đang mở lịch sử
  const [editId, setEditId] = useState(null);   // đang sửa
  const [noteFocus, setNoteFocus] = useState(false); // mở form sửa từ link "Thêm ghi chú"
  const [payId, setPayId] = useState(null);     // mỗi lúc chỉ một khối trả
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
  const remove = async (bill) => {
    const kept = fin.transactions.filter(t => t.bill_id === bill.id).length;
    const ok = await nav.confirmDelete(`hóa đơn “${bill.name}”`,
      `Hóa đơn chỉ là quy tắc nhắc. ${kept > 0 ? `${kept} giao dịch đã ghi vẫn được giữ lại ở màn Giao dịch.` : 'Chưa có giao dịch nào sinh ra từ hóa đơn này.'}`);
    if (ok) await fin.deleteBill(bill.id);
  };

  return (
    <div className="fin-rules">
      {active.length === 0 && <RulesEmpty icon="receipt" title="Chưa có hóa đơn"
        description="Thêm hóa đơn để theo dõi ngày đến hạn và lịch sử thanh toán." />}
      {active.map(b => {
        const d = daysUntilDue(b.due_day, fin.today);
        const paidTx = fin.transactions.find(t => t.bill_id === b.id && t.bill_period === currentPeriod);
        const paid = Boolean(paidTx);
        const skipped = (b.skipped_periods || []).includes(currentPeriod);
        const estimate = billAmountEstimate(b, fin.transactions);
        const state = dueState({
          days: d, enabled: b.enabled, done: paid, skipped,
          doneText: paidTx ? `đã trả ${paidTx.occurred_at.slice(8)}/${paidTx.occurred_at.slice(5, 7)}` : null,
        });
        // Hóa đơn tắt, đã trả hoặc đã bỏ kỳ thì không có thao tác thanh toán.
        // Trả SỚM thì được: nút có mặt từ đầu kỳ, không đợi tới ngày đến hạn.
        const actionable = b.enabled && !paid && !skipped;
        const left = b.term_total ? Math.max(0, b.term_total - (b.term_done || 0)) : 0;
        return (
          <RuleCard key={b.id} tone={state.tone} off={!b.enabled} categoryId={b.category_id} cats={fin.cats}
            title={b.name} badge={b.term_total ? `${b.term_done || 0}/${b.term_total}` : null}
            meta={[b.provider, b.customer_code, b.due_day ? `mỗi tháng ngày ${b.due_day}` : null].filter(Boolean).join(' · ')}
            amount={b.amount_mode === 'ask' ? (estimate ? `~ ${money(estimate)}` : 'hỏi mỗi kỳ') : money(b.amount)}
            state={state}
            onOpen={() => setOpenId(openId === b.id ? null : b.id)}
            onEdit={() => { setEditId(editId === b.id ? null : b.id); setNoteFocus(false); setPayId(null); }}
            enabled={b.enabled} onToggle={(enabled) => toggle(b, enabled)}
            onDelete={() => remove(b)}
            hasNote={!!b.note}>

            {b.term_total > 0 && <RuleProgress pct={(b.term_done || 0) / b.term_total * 100}
              label={`Đã trả ${b.term_done || 0}/${b.term_total} kỳ · còn ${left} kỳ ≈ ${money(left * estimate)}`} />}

            {actionable && payId !== b.id && (
              <div className="fin-rule__foot">
                <button type="button" className="fin-btn fin-btn--secondary fin-btn--sm" onClick={() => { setPayId(b.id); setEditId(null); }}>
                  <AppIcon name="checkCircle" size={15} /> {b.term_total ? `Thanh toán kỳ ${(b.term_done || 0) + 1}/${b.term_total}` : 'Thanh toán'}
                </button>
                <button type="button" className="fin-btn fin-btn--ghost fin-btn--sm" onClick={() => skip(b)}>
                  <AppIcon name="skip" size={14} /> Bỏ kỳ này
                </button>
              </div>
            )}
            {payId === b.id && <PayBlock fin={fin} tasks={tasks} allowSource dueDay={b.due_day}
              defaultAmount={estimate || ''} onCancel={() => setPayId(null)} onPay={(payload) => pay(b, payload)} />}
            {editId === b.id && <RuleForm seg="out" fin={fin} nav={nav} initial={b} focusNote={noteFocus}
              onDone={() => { setEditId(null); setNoteFocus(false); }} />}
            {openId === b.id && <>
              <BillNote bill={b} onEdit={() => { setEditId(b.id); setNoteFocus(true); setPayId(null); }} />
              <BillHistory bill={b} transactions={fin.transactions} />
            </>}
          </RuleCard>
        );
      })}
      {finished.length > 0 && (
        <details className="fin-archived">
          <summary><AppIcon name="tray" size={15} /> {finished.length} quy tắc đã kết thúc</summary>
          <p>Các kỳ đã trả vẫn ở Giao dịch và không thể bật lại quy tắc đã hoàn tất.</p>
          {finished.map(b => <div key={b.id} className="fin-archived__row"><span>{b.name}</span><strong>{b.term_done}/{b.term_total} kỳ</strong></div>)}
        </details>
      )}
    </div>
  );
}

/**
 * Ghi chú của hóa đơn — chuyện của hợp đồng (số công tơ, ai đứng tên), không phải
 * của một lần trả tiền, nên nó ở đây chứ không sao chép xuống từng giao dịch.
 */
function BillNote({ bill, onEdit }) {
  if (!bill.note) {
    return (
      <button type="button" className="fin-inline-command" onClick={onEdit}>
        <AppIcon name="note" size={14} /> Thêm ghi chú
      </button>
    );
  }
  return (
    <div className="fin-billnote">
      <AppIcon name="note" size={15} />
      <p>{bill.note}</p>
      <button type="button" className="fin-icon-btn" title="Sửa ghi chú" onClick={onEdit}><AppIcon name="pencil" size={13} /></button>
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
        <small className="fin-bill-history__note">Sửa hoặc xóa một kỳ ở màn Giao dịch — xóa xong hóa đơn tự quay về “chưa trả”.</small>
      </>}
    </div>
  );
}

// ── in: Sẽ nhận (không quá hạn) ──────────────────────────────────────────────
function IncomeList({ fin, nav, tasks }) {
  const period = currentMonthPeriod(fin.today).key.slice(0, 7);
  const [editId, setEditId] = useState(null);
  const [payId, setPayId] = useState(null);
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
        const state = dueState({
          days: daysUntilDue(r.due_day, fin.today), enabled: r.enabled,
          done: received, doneText: 'đã nhận kỳ này', neverLate: true,
        });
        return (
          <RuleCard key={r.id} tone={state.tone} off={!r.enabled} icon="money" title={r.name}
            meta={[r.source, r.due_day ? `mỗi tháng ngày ${r.due_day}` : null].filter(Boolean).join(' · ')}
            amount={money(r.amount)} state={state} openTitle="Sửa khoản thu"
            onOpen={() => setEditId(editId === r.id ? null : r.id)}
            onEdit={() => { setEditId(editId === r.id ? null : r.id); setPayId(null); }}
            enabled={r.enabled} onToggle={(enabled) => toggle(r, enabled)}
            onDelete={async () => { if (await nav.confirmDelete(`khoản thu “${r.name}”`)) await fin.deleteIncomeRule(r.id); }}>
            {r.enabled && !received && payId !== r.id && (
              <div className="fin-rule__foot">
                <button type="button" className="fin-btn fin-btn--secondary fin-btn--sm" onClick={() => { setPayId(r.id); setEditId(null); }}>
                  <AppIcon name="checkCircle" size={15} /> Đã nhận
                </button>
              </div>
            )}
            {payId === r.id && <PayBlock fin={fin} tasks={tasks} dueDay={r.due_day} defaultAmount={r.amount}
              confirmLabel="Xác nhận đã nhận" onCancel={() => setPayId(null)} onPay={(payload) => receive(r, payload)} />}
            {editId === r.id && <RuleForm seg="in" fin={fin} nav={nav} initial={r} onDone={() => setEditId(null)} />}
          </RuleCard>
        );
      })}
    </div>
  );
}

// ── loan: Khoản vay ───────────────────────────────────────────────────────────
function LoansList({ fin, nav, tasks }) {
  const period = fin.today.slice(0, 7);
  const [editId, setEditId] = useState(null);
  const [payId, setPayId] = useState(null);
  return (
    <div className="fin-rules">
      {fin.loans.length === 0 && <RulesEmpty icon="bank" title="Chưa có khoản vay"
        description="Thêm khoản vay để tách phần gốc và lãi trong mỗi lần trả." />}
      {fin.loans.map(l => {
        const sch = loanSchedule(l);
        const d = daysUntilDue(l.pay_day, fin.today);
        const paidInterest = fin.transactions.some(t => t.loan_id === l.id && t.loan_period === period && t.loan_part === 'interest');
        const paidPrincipal = fin.transactions.some(t => t.loan_id === l.id && t.loan_period === period && t.loan_part === 'principal');
        const donePeriod = sch.kind === 'interest' ? paidInterest : paidPrincipal;
        const principalDue = l.due_at && l.due_at <= fin.today;
        const state = dueState({ days: d, done: donePeriod, doneText: 'đã ghi kỳ này' });
        const dueAmount = sch.kind === 'interest' ? sch.monthlyInterest : sch.monthlyPayment;
        return (
          <RuleCard key={l.id} tone={state.tone} icon="bank" title={l.name}
            badge={`${sch.progress.done}/${sch.progress.total} kỳ`}
            meta={[l.lender, `gốc ${money(l.principal)}`, `${l.rate}%/năm`,
              sch.kind === 'interest' ? 'chỉ trả lãi' : 'trả đều gốc + lãi'].filter(Boolean).join(' · ')}
            amount={money(dueAmount)} state={state} openTitle="Sửa khoản vay"
            onOpen={() => setEditId(editId === l.id ? null : l.id)}
            onEdit={() => { setEditId(editId === l.id ? null : l.id); setPayId(null); }}
            onDelete={async () => { if (await nav.confirmDelete(`khoản vay “${l.name}”`)) await fin.deleteLoan(l.id); }}>

            <RuleProgress pct={sch.progress.total ? sch.progress.done / sch.progress.total * 100 : 0}
              label={`Kỳ ${Math.min(sch.progress.done + 1, sch.progress.total)}/${sch.progress.total} · trả ngày ${l.pay_day} hằng tháng · còn ${Math.max(0, sch.progress.total - sch.progress.done)} kỳ`} />

            <div className="fin-loan-split">
              {sch.kind === 'interest' ? <>
                <span>Lãi mỗi kỳ <strong>{money(sch.monthlyInterest)}</strong></span>
                <span>Gốc tất toán <strong>{l.due_at || '—'}</strong></span>
              </> : <>
                <span>Lãi kỳ tới <strong>{money(sch.interestPart)}</strong></span>
                <span>Gốc kỳ tới <strong>{money(sch.principalPart)}</strong></span>
                <span>Dư nợ gốc <strong>~{money(sch.principalRemaining)}</strong></span>
              </>}
            </div>

            {sch.kind === 'interest' && !paidPrincipal && l.due_at && (
              <div className={`fin-inline-message${principalDue ? ' fin-inline-message--warn' : ''}`}>
                <AppIcon name={principalDue ? 'warning' : 'calendar'} size={15} weight="fill" />
                <span>{principalDue
                  ? `Đã tới ngày tất toán gốc ${l.due_at} — ${money(sch.principalDue)} chưa ghi.`
                  : `Gốc ${money(sch.principalDue)} tất toán một lần vào ${l.due_at}.`}</span>
              </div>
            )}

            {payId !== l.id && (!donePeriod || (principalDue && !paidPrincipal && sch.kind === 'interest')) && (
              <div className="fin-rule__foot">
                {!donePeriod && <button type="button" className="fin-btn fin-btn--secondary fin-btn--sm"
                  onClick={() => { setPayId(l.id); setEditId(null); }}>
                  <AppIcon name="handCoins" size={15} /> {sch.kind === 'interest' ? 'Trả lãi kỳ này' : 'Trả kỳ này'}
                </button>}
                {sch.kind === 'interest' && principalDue && !paidPrincipal && (
                  <button type="button" className="fin-btn fin-btn--ghost fin-btn--sm"
                    onClick={() => { setPayId(`${l.id}:principal`); setEditId(null); }}>
                    <AppIcon name="bank" size={14} /> Tất toán gốc
                  </button>
                )}
              </div>
            )}

            {payId === l.id && <PayBlock fin={fin} tasks={tasks} dueDay={l.pay_day} defaultAmount={dueAmount}
              onCancel={() => setPayId(null)} onPay={async (payload) => {
                if (sch.kind === 'interest') {
                  const tx = await fin.payLoanInterest(l, { ...payload, period });
                  nav.showToast(tx ? 'Đã ghi lãi vay — tính vào chi tiêu' : 'Không thể ghi lãi vay. Kiểm tra dữ liệu Finance rồi thử lại.', { icon: tx ? 'handCoins' : 'warning' });
                  return !!tx;
                }
                const result = await fin.payLoanInstallment(l, { ...payload, period });
                if (result) nav.showToast(`Đã tách ${money(result.interest)} lãi và ${money(result.principal)} gốc`, { icon: 'handCoins' });
                else nav.showToast('Không thể ghi kỳ vay. Kiểm tra dữ liệu Finance rồi thử lại.', { icon: 'warning' });
                return !!result;
              }} />}

            {payId === `${l.id}:principal` && <PayBlock fin={fin} tasks={tasks} defaultAmount={sch.principalDue}
              confirmLabel="Xác nhận tất toán gốc" onCancel={() => setPayId(null)} onPay={async (payload) => {
                const tx = await fin.payLoanPrincipal(l, { ...payload, period });
                nav.showToast(tx ? 'Đã tất toán gốc — đứng ngoài tổng chi' : 'Không thể tất toán gốc. Kiểm tra dữ liệu Finance rồi thử lại.', { icon: tx ? 'bank' : 'warning' });
                return !!tx;
              }} />}

            {editId === l.id && <RuleForm seg="loan" fin={fin} nav={nav} initial={l} onDone={() => setEditId(null)} />}
          </RuleCard>
        );
      })}
    </div>
  );
}

// ── card: Thẻ tín dụng ────────────────────────────────────────────────────────
function CardsList({ fin, nav, tasks }) {
  const [editId, setEditId] = useState(null);
  const [payId, setPayId] = useState(null);
  return (
    <div className="fin-rules">
      {fin.cards.length === 0 && <RulesEmpty icon="creditCard" title="Chưa có thẻ tín dụng"
        description="Thêm thẻ để theo dõi hạn mức, sao kê và ngày đến hạn." />}
      {fin.cards.map(c => {
        const cyc = cardStatementSummary(c, fin.transactions, fin.today);
        const balance = cardBalance(c.id, fin.transactions);
        const est = floatInterest(cyc.outstanding, cyc.floatDaysTotal, fin.blendedRate);
        const usedPct = c.credit_limit ? Math.round((balance / c.credit_limit) * 100) : 0;
        const state = dueState({
          days: daysUntilDue(c.due_day, fin.today),
          done: cyc.outstanding <= 0, doneText: 'sao kê đã trả',
        });
        return (
          <RuleCard key={c.id} tone={state.tone} icon="creditCard"
            title={`${c.name}${c.last4 ? ` ••${c.last4}` : ''}`}
            meta={[c.bank, `chốt ngày ${c.statement_day}`, `đến hạn ngày ${c.due_day}`].filter(Boolean).join(' · ')}
            amount={money(cyc.outstanding)} state={state} openTitle="Sửa thẻ"
            onOpen={() => setEditId(editId === c.id ? null : c.id)}
            onEdit={() => { setEditId(editId === c.id ? null : c.id); setPayId(null); }}
            onDelete={async () => { if (await nav.confirmDelete(`thẻ “${c.name}”`)) await fin.deleteCard(c.id); }}>

            <RuleProgress pct={usedPct} label={`Đã dùng ${money(balance)}/${money(c.credit_limit)} (${usedPct}%)`} />

            <div className="fin-loan-split">
              <span>Sao kê kỳ này <strong>{money(cyc.statementTotal)}</strong></span>
              <span>Đã trả <strong>{money(cyc.paid)}</strong></span>
              <span>Còn phải trả <strong>{money(cyc.outstanding)}</strong></span>
            </div>

            {est > 0 && <div className="fin-inline-message">
              <AppIcon name="sparkle" size={15} weight="fill" />
              <span>Float đang kiếm ~{money(est)} lãi (lãi gửi bình quân {fin.blendedRate}%/năm).</span>
            </div>}
            {c.cash_advance_fee > 0 && <div className="fin-inline-message fin-inline-message--warn">
              <AppIcon name="warning" size={15} weight="fill" />
              <span>Rút tiền mặt mất phí {money(c.cash_advance_fee)} — tránh.{c.annual_fee > 0 ? ` Phí thường niên ${money(c.annual_fee)}.` : ''}</span>
            </div>}

            {cyc.outstanding > 0 && payId !== c.id && (
              <div className="fin-rule__foot">
                <button type="button" className="fin-btn fin-btn--secondary fin-btn--sm" onClick={() => { setPayId(c.id); setEditId(null); }}>
                  <AppIcon name="creditCard" size={15} /> Trả sao kê
                </button>
              </div>
            )}
            {payId === c.id && <PayBlock fin={fin} tasks={tasks} dueDay={c.due_day} defaultAmount={cyc.outstanding}
              confirmLabel="Xác nhận trả sao kê" onCancel={() => setPayId(null)} onPay={async (payload) => {
                const tx = await fin.payCardStatement(c, { ...payload, period: cyc.period });
                nav.showToast(tx ? 'Đã ghi trả sao kê — không phải chi mới, chỉ để lịch sử' : 'Không thể ghi trả sao kê. Kiểm tra dữ liệu Finance rồi thử lại.', { icon: tx ? 'creditCard' : 'warning' });
                return !!tx;
              }} />}
            {editId === c.id && <RuleForm seg="card" fin={fin} nav={nav} initial={c} onDone={() => setEditId(null)} />}
          </RuleCard>
        );
      })}
    </div>
  );
}
