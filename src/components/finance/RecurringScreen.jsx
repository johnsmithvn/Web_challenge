import { useState, useEffect, useRef } from 'react';
import { parseCurrencyInput, sanitizeDecimal, sanitizeDigits } from '../../utils/currencyUtils';
import { useUserTasks } from '../../hooks/useUserTasks';
import {
  billAmountEstimate, cardBalance, cardStatementSummary, floatInterest, loanSchedule,
  currentMonthPeriod, dueDateInMonth, daysUntilDue, addDaysStr, daysInclusive, nextAnnualFee,
} from '../../utils/financeLogic';
import { money, Segmented, FinanceIcon, TaskPicker, Toggle, catInfo } from './parts';
import AppIcon from '../AppIcon';

const SEGMENTS = [
  { value: 'out',  label: 'Phải trả',   addLabel: 'Thêm hóa đơn', editLabel: 'Sửa hóa đơn', createLabel: 'Tạo hóa đơn' },
  { value: 'in',   label: 'Sẽ nhận',    addLabel: 'Thêm khoản thu', editLabel: 'Sửa khoản thu', createLabel: 'Tạo khoản thu' },
  { value: 'loan', label: 'Khoản vay',  addLabel: 'Thêm khoản vay', editLabel: 'Sửa khoản vay', createLabel: 'Tạo khoản vay' },
  { value: 'card', label: 'Thẻ tín dụng', addLabel: 'Thêm thẻ', editLabel: 'Sửa thẻ', createLabel: 'Tạo thẻ' },
  { value: 'lend', label: 'Cho vay',   addLabel: 'Thêm khoản cho vay', editLabel: 'Sửa khoản cho vay', createLabel: 'Ghi khoản cho vay' },
];

/**
 * 20 mẫu chỉ để tiết kiệm gõ chữ: điền TÊN + NHÓM + danh mục con + kiểu số tiền.
 * Không mẫu nào điền sẵn số tiền — bấm qua nhanh mà lưu một con số mặc định thì
 * nó không đúng với ai cả.
 */
const BILL_TEMPLATES = [
  { label: 'Điện',         icon: 'lightning',    category_id: 'housing', subcategory_id: 'housing.electric', amount_mode: 'ask' },
  { label: 'Nước',         icon: 'drop',         category_id: 'housing', subcategory_id: 'housing.water', amount_mode: 'ask' },
  { label: 'Internet',     icon: 'wifi',         category_id: 'housing', subcategory_id: 'housing.internet', amount_mode: 'fixed' },
  { label: 'Tiền thuê nhà', icon: 'house',       category_id: 'housing', subcategory_id: 'housing.rent', amount_mode: 'fixed' },
  { label: 'Truyền hình',  icon: 'television',   category_id: 'subscription', subcategory_id: 'subscription.streaming', amount_mode: 'fixed' },
  { label: 'Điện thoại / 4G', icon: 'deviceMobile', category_id: 'housing', subcategory_id: 'housing.mobile', amount_mode: 'fixed' },
  { label: 'Phí vệ sinh',  icon: 'trash',        category_id: 'housing', subcategory_id: 'housing.cleaning', amount_mode: 'fixed' },
  { label: 'Phí quản lý chung cư', icon: 'buildings', category_id: 'housing', subcategory_id: 'housing.management', amount_mode: 'fixed' },
  { label: 'Netflix',      icon: 'film',         category_id: 'subscription', subcategory_id: 'subscription.streaming', amount_mode: 'fixed' },
  { label: 'Spotify',      icon: 'music',        category_id: 'subscription', subcategory_id: 'subscription.streaming', amount_mode: 'fixed' },
  { label: 'YouTube Premium', icon: 'video',     category_id: 'subscription', subcategory_id: 'subscription.streaming', amount_mode: 'fixed' },
  { label: 'Google One',   icon: 'cloud',        category_id: 'subscription', subcategory_id: 'subscription.cloud', amount_mode: 'fixed' },
  { label: 'iCloud',       icon: 'cloud',        category_id: 'subscription', subcategory_id: 'subscription.cloud', amount_mode: 'fixed' },
  { label: 'ChatGPT',      icon: 'sparkle',      category_id: 'subscription', subcategory_id: 'subscription.software', amount_mode: 'fixed' },
  { label: 'Học phí',      icon: 'graduation',   category_id: 'family', subcategory_id: 'family.tuition', amount_mode: 'fixed' },
  { label: 'Bảo hiểm',     icon: 'certificate',  category_id: 'health', subcategory_id: 'health.insurance', amount_mode: 'fixed' },
  { label: 'Trả góp',      icon: 'receipt',      category_id: 'finance', subcategory_id: 'finance.installment', amount_mode: 'fixed' },
  { label: 'Trả nợ',       icon: 'handCoins',    category_id: 'finance', subcategory_id: 'finance.debt', amount_mode: 'fixed' },
  { label: 'Gửi xe tháng', icon: 'gas',          category_id: 'transport', subcategory_id: 'transport.parking', amount_mode: 'fixed' },
  { label: 'Khác',         icon: 'dots',         category_id: 'other', subcategory_id: 'other.unclassified', amount_mode: 'fixed' },
];

/** Icon người dùng chọn được cho hóa đơn. Không mở toàn bộ bộ Phosphor:
 *  danh sách ngắn chọn nhanh hơn, và mỗi cái phải nhận ra được ở cỡ 17px. */
const BILL_ICONS = [
  'lightning', 'drop', 'wifi', 'house', 'television', 'deviceMobile', 'trash', 'buildings',
  'film', 'music', 'video', 'cloud', 'sparkle', 'robot', 'graduation', 'certificate',
  'receipt', 'handCoins', 'bank', 'creditCard', 'gas', 'piggyBank', 'bowlFood', 'coffee',
  'firstAid', 'heart', 'game', 'shopping', 'gift', 'plant', 'key', 'package',
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
  if (days == null) return { tone: 'wait', text: '' };
  if (days > 0) return { tone: 'wait', text: `còn ${days} ngày` };
  if (days === 0) return { tone: 'due', text: 'tới hạn hôm nay' };
  if (neverLate) return { tone: 'wait', text: 'chưa nhận' };
  // Trễ 1–3 ngày là vàng, từ 4 ngày mới đỏ: đỏ mà dùng cho cả trễ một ngày thì
  // nhìn mãi thành quen, tới lúc trễ thật không còn tác dụng cảnh báo.
  return { tone: days <= -4 ? 'over' : 'late', text: `quá hạn ${Math.abs(days)} ngày` };
}

/**
 * Bản sao của một hóa đơn: chép QUY TẮC, không chép lịch sử.
 * Tiến độ trả góp, các kỳ đã bỏ và mốc kết thúc đều về mặc định — các kỳ đã ghi
 * là giao dịch của hóa đơn CŨ, chúng giữ nguyên `bill_id` cũ và không theo sang.
 */
function billDraft(bill) {
  return {
    name: `${bill.name} (bản sao)`,
    provider: bill.provider, customer_code: bill.customer_code,
    category_id: bill.category_id, subcategory_id: bill.subcategory_id,
    amount_mode: bill.amount_mode, amount: bill.amount, icon: bill.icon,
    due_day: bill.due_day, term_total: bill.term_total, note: bill.note,
  };
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

const dmy = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');

/** Dải tổng đầu tab (Khoản vay, Cho vay) + câu giải thích cách tiền được tính. */
function SummaryStrip({ items, note }) {
  return (
    <section className="fin-summary-strip">
      <div>{items.map(item => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong className={item.tone ? `is-${item.tone}` : ''}>{item.value}</strong>
        </div>
      ))}</div>
      {note && <p>{note}</p>}
    </section>
  );
}

/** Thanh tiến độ dùng chung: trả góp của hóa đơn, kỳ vay, hạn mức thẻ. */
function RuleProgress({ pct, label, right, color }) {
  return (
    <div className="fin-progress">
      <div className="fin-progress__labels"><span>{label}</span>{right && <span>{right}</span>}</div>
      <div><i style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color || undefined }} /></div>
    </div>
  );
}

/**
 * Khung dòng dùng chung cho cả 4 segment: icon · tên + phụ đề · số tiền + trạng thái ·
 * nút sửa/công tắc/xóa. Mọi thứ mở thêm (khối trả, form sửa, lịch sử) là children,
 * nằm NGAY dưới dòng đó nên danh sách không nhảy chỗ.
 */
function RuleCard({
  tone = 'wait', off, icon, iconColor, categoryId, cats, title, badge, meta, amount, state, hasNote,
  onOpen, openTitle = 'Xem lịch sử', onEdit, onDuplicate, enabled, onToggle, onDelete, children,
}) {
  return (
    <article className={`fin-rule${off ? ' fin-rule--off' : ''}`} data-tone={tone}>
      <div className="fin-rule__line">
        <button type="button" className="fin-rule__ico" onClick={onOpen} title={openTitle}
          aria-label={`${openTitle} — ${title}`} style={iconColor ? { color: iconColor } : undefined}>
          {icon
            ? <AppIcon name={icon} size={17} weight="fill" />
            : <FinanceIcon categoryId={categoryId} cats={cats} size={17} weight="fill" />}
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
          {onDuplicate && <button type="button" className="fin-icon-btn" title="Nhân bản" onClick={onDuplicate}><AppIcon name="copy" size={14} /></button>}
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
  // Bản nháp điền sẵn khi bấm Nhân bản: chỉ chép QUY TẮC, chưa ghi gì xuống DB.
  const [draft, setDraft] = useState(null);
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
    lend: fin.lendings.filter(l => !l.closed_at).length,
  };
  // Số đếm là `hint` để nó xám nhạt như tab Danh mục/Schema, không dính liền vào nhãn.
  const segmentOptions = SEGMENTS.map(option => ({ ...option, hint: String(counts[option.value]) }));

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
        <Segmented options={segmentOptions} value={seg} onChange={(v) => { nav.setRecurringSeg(v); setAdding(false); setDraft(null); }} />
        <button className="fin-btn fin-btn--primary fin-btn--sm" onClick={() => { setAdding(a => !a); setDraft(null); }}>
          <AppIcon name={adding ? 'x' : 'plus'} size={15} /> {adding ? 'Đóng' : segMeta.addLabel}
        </button>
      </div>

      {adding && <RuleForm seg={seg} fin={fin} nav={nav} initial={draft}
        onDone={() => { setAdding(false); setDraft(null); }} />}

      {seg === 'out'  && <BillsList fin={fin} nav={nav} tasks={pendingTasks}
        onDuplicate={(bill) => { setDraft(billDraft(bill)); setAdding(true); }} />}
      {seg === 'in'   && <IncomeList fin={fin} nav={nav} tasks={pendingTasks} />}
      {seg === 'loan' && <LoansList fin={fin} nav={nav} tasks={pendingTasks} />}
      {seg === 'card' && <CardsList fin={fin} nav={nav} tasks={pendingTasks} />}
      {seg === 'lend' && <LendsList fin={fin} nav={nav} tasks={pendingTasks} />}
    </div>
  );
}

// ── Form thêm / sửa (cùng một form, khác nhau ở `initial`) ────────────────────
function RuleForm({ seg, fin, nav, initial, focusNote = false, onDone }) {
  const editing = Boolean(initial?.id);
  const noteRef = useRef(null);
  const [hasTerm, setHasTerm] = useState(() => Boolean(initial?.term_total));
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
    ...p, name: t.label, category_id: t.category_id, subcategory_id: t.subcategory_id, icon: t.icon,
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
        icon: f.icon || null,
        term_total: hasTerm ? Number(f.term_total) || null : null,
        term_done: hasTerm ? Number(f.term_done) || 0 : 0,
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
    } else if (seg === 'lend') {
      const principal = parseCurrencyInput(f.principal);
      const lentOn = f.lent_on || fin.today;
      if (!principal || Number(f.rate || 0) < 0) {
        nav.showToast('Khoản cho vay cần số tiền dương và lãi suất không âm');
        return;
      }
      if (f.due_on && f.due_on < lentOn) {
        nav.showToast('Ngày hẹn trả phải sau ngày đưa tiền');
        return;
      }
      payload = {
        name: f.name.trim(), note: f.note?.trim() || null, principal,
        rate: Number(f.rate) || 0, lent_on: lentOn, due_on: f.due_on || null,
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
        annual_fee_on: f.annual_fee_on || null,
        cash_advance_fee: parseCurrencyInput(f.cash_advance_fee) || 0, min_pct: Number(f.min_pct) || 0,
      };
    }
    const save = {
      out: editing ? (p) => fin.updateBill(initial.id, p) : fin.addBill,
      in: editing ? (p) => fin.updateIncomeRule(initial.id, p) : fin.addIncomeRule,
      loan: editing ? (p) => fin.updateLoan(initial.id, p) : fin.addLoan,
      card: editing ? (p) => fin.updateCard(initial.id, p) : fin.addCard,
      lend: editing ? (p) => fin.updateLending(initial.id, p) : fin.addLending,
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
      : seg === 'lend' ? 'Đã ghi khoản cho vay — tiền rời ví nhưng không tính là chi tiêu'
      : seg === 'in' ? 'Đã thêm khoản thu — app chỉ nhắc, không tô đỏ khi chưa nhận'
      : 'Đã thêm hóa đơn — tới ngày app hiện nút để bạn ghi', { icon: 'checkCircle' });
    onDone();
  };

  const grp = fin.cats.expenseGroups.find(g => g.key === (f.category_id || 'housing'));
  const segMeta = SEGMENTS.find(s => s.value === seg);

  return (
    <form className={`fin-card fin-form fin-ruleform${editing ? ' fin-ruleform--edit' : ''}`} onSubmit={submit}>
      {seg === 'out' && !editing && (
        <div className="fin-templates">
          <div className="fin-templates__head">
            <strong>Chọn loại hóa đơn</strong>
            <small>Mẫu chỉ điền sẵn tên, danh mục và chu kỳ — số tiền vẫn do bạn nhập</small>
          </div>
          <div className="fin-templates__chips">{BILL_TEMPLATES.map(t => (
            <button type="button" key={t.label} className={f.name === t.label ? 'is-active' : ''}
              onClick={() => applyTemplate(t)}><AppIcon name={t.icon} size={14} /> {t.label}</button>
          ))}</div>
        </div>
      )}
      {(seg !== 'out' || editing) && (
        <div className="fin-ruleform__head">
          <strong>{editing ? segMeta.editLabel : segMeta.addLabel}</strong>
          {editing && <button type="button" className="fin-icon-btn" onClick={onDone} aria-label="Đóng"><AppIcon name="x" size={15} /></button>}
        </div>
      )}

      {seg === 'out' && (<>
        <div className="fin-ruleform__grid">
          <label className="fin-field"><span>Tên hóa đơn</span>
            <input className="fin-input" placeholder="Tiền điện" value={f.name || ''} onChange={set('name')} autoFocus={!focusNote} /></label>
          <label className="fin-field"><span>Nhà cung cấp</span>
            <input className="fin-input" placeholder="EVN Hà Nội" value={f.provider || ''} onChange={set('provider')} /></label>
          <label className="fin-field"><span>Mã khách hàng · tùy chọn</span>
            <input className="fin-input" placeholder="PD07000018579" value={f.customer_code || ''} onChange={set('customer_code')} /></label>
          <label className="fin-field"><span>Danh mục</span>
            <select className="fin-input" value={f.category_id || 'housing'} onChange={set('category_id')}>
              {fin.cats.expenseGroups.filter(g => !g.hidden).map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select></label>
          <label className="fin-field"><span>Danh mục con</span>
            <select className="fin-input" value={f.subcategory_id || ''} onChange={set('subcategory_id')}>
              <option value="">— không chọn —</option>
              {(grp?.subs || []).map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select></label>
          <label className="fin-field"><span>Lặp lại</span>
            <select className="fin-input" value="monthly" onChange={() => {}}>
              <option value="monthly">Mỗi tháng</option>
            </select></label>
          <label className="fin-field"><span>Vào ngày</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="5" value={f.due_day || ''} onChange={setDigits('due_day', 2)} /></label>
        </div>

        <div className="fin-field"><span>Icon</span>
          <div className="fin-iconpick">
            {BILL_ICONS.map(name => (
              <button type="button" key={name} title={name}
                className={(f.icon || '') === name ? 'is-active' : ''}
                style={{ '--c': catInfo(f.category_id || 'housing', fin.cats).color }}
                onClick={() => setF(p => ({ ...p, icon: p.icon === name ? '' : name }))}>
                <AppIcon name={name} size={16} weight="fill" />
              </button>
            ))}
          </div>
          <small className="fin-field__hint">Bỏ chọn thì dùng icon của nhóm. Màu icon luôn theo nhóm để donut và danh sách khớp nhau.</small>
        </div>

        <label className="fin-field"><span>Ghi chú · tùy chọn</span>
          <textarea ref={noteRef} className="fin-input fin-textarea" rows={3}
            placeholder="Số công tơ, mật khẩu trang thanh toán, ai đứng tên, cách chia tiền với người khác…"
            value={f.note || ''} onChange={set('note')} /></label>
        <small className="fin-field__hint">Chỗ để mọi thứ không có trường riêng. Ghi chú đi theo hóa đơn, hiện ở đầu màn chi tiết — không rơi vào từng giao dịch.</small>

        <div className="fin-field"><span>Số tiền</span>
          <Segmented ariaLabel="Kiểu số tiền" value={f.amount_mode || 'fixed'}
            onChange={(v) => setF(p => ({ ...p, amount_mode: v, amount: v === 'ask' ? '' : p.amount }))}
            options={[{ value: 'fixed', label: 'Cố định' }, { value: 'ask', label: 'Thay đổi từng kỳ' }]} />
          {f.amount_mode !== 'ask' && <input className="fin-input fin-ruleform__amount" inputMode="numeric" pattern="[0-9]*"
            placeholder="220.000" value={f.amount || ''} onChange={setDigits('amount')} />}
          <small className="fin-field__hint">{f.amount_mode === 'ask'
            ? 'Tới ngày, app hỏi số tiền và gợi ý bằng trung bình 3 kỳ gần nhất — chưa có kỳ nào thì để trống.'
            : 'Tới ngày, nút Thanh toán điền sẵn số này — bạn chỉ cần bấm.'}</small>
        </div>

        <div className="fin-ruleform__section">
          <button type="button" className={`fin-checkline${hasTerm ? ' is-on' : ''}`}
            aria-pressed={hasTerm}
            onClick={() => { setHasTerm(on => { if (on) setF(p => ({ ...p, term_total: '', term_done: '' })); return !on; }); }}>
            <span><AppIcon name="check" size={10} weight="bold" /></span>
            Hóa đơn này có số kỳ hữu hạn (trả góp, trả nợ)
          </button>
        {hasTerm && (<>
          <div className="fin-form__row">
            <label className="fin-field"><span>Tổng số kỳ</span>
              <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="12" autoFocus
                value={f.term_total || ''} onChange={setDigits('term_total', 3)} /></label>
            <label className="fin-field"><span>Đã trả bao nhiêu kỳ</span>
              <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="0"
                value={f.term_done ?? ''} onChange={setDigits('term_done', 3)} /></label>
          </div>
          <small className="fin-field__hint">Trả đủ kỳ cuối thì hóa đơn tự dừng và chuyển xuống mục đã kết thúc.</small>
        </>)}
        </div>
      </>)}

      {seg === 'in' && (<>
        <div className="fin-ruleform__grid">
          <label className="fin-field"><span>Tên khoản thu</span>
            <input className="fin-input" placeholder="Lương tháng" value={f.name || ''} onChange={set('name')} autoFocus /></label>
          <label className="fin-field"><span>Nguồn thu</span>
            <select className="fin-input" value={f.category_id || 'luong'} onChange={set('category_id')}>
              {fin.cats.incomeGroups.filter(g => !g.hidden).map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select></label>
          <label className="fin-field"><span>Nơi trả · tùy chọn</span>
            <input className="fin-input" placeholder="Công ty ABC" value={f.source || ''} onChange={set('source')} /></label>
          <label className="fin-field"><span>Lặp lại</span>
            <select className="fin-input" value="monthly" onChange={() => {}}>
              <option value="monthly">Mỗi tháng</option>
            </select></label>
          <label className="fin-field"><span>Vào ngày</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="3" value={f.due_day || ''} onChange={setDigits('due_day', 2)} /></label>
          <label className="fin-field"><span>Số tiền</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="20.000.000" value={f.amount || ''} onChange={setDigits('amount')} /></label>
        </div>
        <small className="fin-field__hint">Tới ngày, khoản này hiện nút <strong>Đã nhận</strong> ở danh sách dưới. Bấm mới sinh giao dịch — app không tự ghi thay bạn.</small>
      </>)}

      {seg === 'loan' && (<>
        <div className="fin-ruleform__grid">
          <label className="fin-field"><span>Tên khoản vay</span>
            <input className="fin-input" placeholder="Vay ngân hàng" value={f.name || ''} onChange={set('name')} autoFocus /></label>
          <label className="fin-field"><span>Bên cho vay</span>
            <input className="fin-input" placeholder="VPBank" value={f.lender || ''} onChange={set('lender')} /></label>
          <label className="fin-field"><span>Số tiền gốc</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="100.000.000" value={f.principal || ''} onChange={setDigits('principal')} /></label>
          <label className="fin-field"><span>Lãi suất · %/năm</span>
            <input className="fin-input" inputMode="decimal" placeholder="4,8" value={f.rate || ''} onChange={setDecimal('rate')} /></label>
          <label className="fin-field"><span>Kiểu trả</span>
            <select className="fin-input" value={f.kind || 'amort'} onChange={set('kind')}>
              <option value="amort">Trả đều gốc + lãi</option>
              <option value="interest">Chỉ trả lãi · gốc cuối kỳ</option>
            </select></label>
          <label className="fin-field"><span>Ngày vay</span>
            <input className="fin-input" type="date" value={f.opened_at || ''} onChange={set('opened_at')} /></label>
          <label className="fin-field"><span>Hạn tất toán</span>
            <input className="fin-input" type="date" value={f.due_at || ''} onChange={set('due_at')} /></label>
          <label className="fin-field"><span>Số kỳ (tháng)</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="12" value={f.term || ''} onChange={setDigits('term', 3)} /></label>
          <label className="fin-field"><span>Ngày trả trong tháng</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="15" value={f.pay_day || ''} onChange={setDigits('pay_day', 2)} /></label>
        </div>
        <small className="fin-field__hint">Trả góp mua đồ — số tiền như nhau mỗi kỳ, không tính lãi riêng — thì để ở <strong>Phải trả</strong> như một hóa đơn có số kỳ, không phải khoản vay.</small>
      </>)}

      {seg === 'card' && (<>
        <div className="fin-ruleform__grid">
          <label className="fin-field"><span>Tên thẻ</span>
            <input className="fin-input" placeholder="VIB Cash Back" value={f.name || ''} onChange={set('name')} autoFocus /></label>
          <label className="fin-field"><span>Ngân hàng</span>
            <input className="fin-input" placeholder="VIB" value={f.bank || ''} onChange={set('bank')} /></label>
          <label className="fin-field"><span>4 số cuối · tùy chọn</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="4602" value={f.last4 || ''} onChange={setDigits('last4', 4)} /></label>
          <label className="fin-field"><span>Hạn mức</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="50.000.000" value={f.credit_limit || ''} onChange={setDigits('credit_limit')} /></label>
          <label className="fin-field"><span>Ngày chốt sao kê</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="5" value={f.statement_day || ''} onChange={setDigits('statement_day', 2)} /></label>
          <label className="fin-field"><span>Ngày đến hạn</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="20" value={f.due_day || ''} onChange={setDigits('due_day', 2)} /></label>
          <label className="fin-field"><span>Số ngày miễn lãi</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="45" value={f.grace || ''} onChange={setDigits('grace', 3)} /></label>
          <label className="fin-field"><span>Phí thường niên</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="500.000" value={f.annual_fee || ''} onChange={setDigits('annual_fee')} /></label>
          <label className="fin-field"><span>Ngày thu phí · tùy chọn</span>
            <input className="fin-input" type="date" value={f.annual_fee_on || ''} onChange={set('annual_fee_on')} /></label>
          <label className="fin-field"><span>Phí rút tiền mặt</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="100.000" value={f.cash_advance_fee || ''} onChange={setDigits('cash_advance_fee')} /></label>
          <label className="fin-field"><span>% trả tối thiểu</span>
            <input className="fin-input" inputMode="decimal" placeholder="5" value={f.min_pct || ''} onChange={setDecimal('min_pct')} /></label>
        </div>
        <small className="fin-field__hint">Ngày chốt và ngày đến hạn là <strong>hai ngày khác nhau</strong> — khoảng giữa chúng là số ngày tiền của ngân hàng nằm trong tay bạn mà không mất lãi.</small>
      </>)}

      {seg === 'lend' && (<>
        <div className="fin-ruleform__grid">
          <label className="fin-field"><span>Cho ai mượn</span>
            <input className="fin-input" placeholder="Em trai" value={f.name || ''} onChange={set('name')} autoFocus /></label>
          <label className="fin-field"><span>Số tiền</span>
            <input className="fin-input" inputMode="numeric" pattern="[0-9]*" placeholder="100.000.000" value={f.principal || ''} onChange={setDigits('principal')} /></label>
          <label className="fin-field"><span>Ngày đưa tiền</span>
            <input className="fin-input" type="date" max={fin.today} value={f.lent_on || fin.today} onChange={set('lent_on')} /></label>
          <label className="fin-field"><span>Hẹn trả ngày</span>
            <input className="fin-input" type="date" value={f.due_on || ''} onChange={set('due_on')} /></label>
          <label className="fin-field"><span>Lãi · %/năm</span>
            <input className="fin-input" inputMode="decimal" placeholder="0 nếu không tính lãi" value={f.rate || ''} onChange={setDecimal('rate')} /></label>
        </div>
        <label className="fin-field"><span>Ghi chú</span>
          <input className="fin-input" placeholder="Sửa nhà · hẹn miệng" value={f.note || ''} onChange={set('note')} /></label>
        <small className="fin-field__hint">Khoản này <strong>không sinh giao dịch chi</strong> — cho mượn chỉ đổi tiền trong ví thành khoản phải thu, donut và hạn mức nhóm không đổi.</small>
      </>)}

      {editing && (seg === 'out' || seg === 'in') && (
        <p className="fin-warn fin-form__warn"><AppIcon name="warning" size={14} weight="fill" /> Số mới áp dụng từ kỳ sau — các kỳ đã ghi giữ nguyên số cũ.</p>
      )}

      <div className="fin-ruleform__actions">
        <button type="submit" className="fin-btn fin-btn--primary fin-btn--sm">
          {editing ? <><AppIcon name="save" size={15} /> Lưu thay đổi</> : segMeta.createLabel}
        </button>
        <button type="button" className="fin-btn fin-btn--ghost fin-btn--sm" onClick={onDone}>Hủy</button>
      </div>
    </form>
  );
}

// ── Khối ghi một kỳ ──────────────────────────────────────────────────────────
// Mở ngay dưới dòng, không đẩy sang màn khác và không mở modal: người dùng
// thường trả liền ba bốn khoản, rời danh sách mỗi lần là hỏng nhịp.
function PayBlock({ fin, tasks = [], defaultAmount, dueDay, allowSource = false, amountLabel = 'Số tiền đã trả',
  quickAmount = null, note = null, confirmLabel = 'Xác nhận thanh toán', onPay, onCancel }) {
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
        <label className="fin-field"><span>{amountLabel}</span>
          <input ref={amountRef} className="fin-input" inputMode="numeric" pattern="[0-9]*" autoFocus
            placeholder="chưa có kỳ nào để gợi ý" value={amount} onChange={e => setAmount(sanitizeDigits(e.target.value))} />
          {quickAmount > 0 && <button type="button" className="fin-inline-command" onClick={() => setAmount(String(quickAmount))}>
            Trả hết · {money(quickAmount)}
          </button>}</label>
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

      {note && <small className="fin-payblock__hint">{note}</small>}

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
function BillsList({ fin, nav, tasks, onDuplicate }) {
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
  // RPC finance_skip_bill_period chỉ THÊM kỳ vào skipped_periods, không bao giờ gỡ.
  // Đường gỡ duy nhất trong DB là finance_pay_bill — mà nút Thanh toán lại bị ẩn khi đã
  // bỏ kỳ, nên nếu không có nút này thì bấm nhầm là kẹt tới tháng sau.
  const unskip = async (bill) => {
    const rest = (bill.skipped_periods || []).filter(p => p !== currentPeriod);
    const updated = await fin.updateBill(bill.id, { skipped_periods: rest });
    nav.showToast(updated
      ? `Đã bỏ đánh dấu — ${bill.name} hiện lại nút Thanh toán cho kỳ này`
      : `Không thể bỏ đánh dấu ${bill.name}. Kiểm tra dữ liệu Finance rồi thử lại.`,
    { icon: updated ? 'refresh' : 'warning' });
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
            icon={b.icon || null} iconColor={catInfo(b.category_id, fin.cats).color}
            title={b.name} badge={b.term_total ? `${b.term_done || 0}/${b.term_total}` : null}
            meta={[b.provider, b.customer_code, b.due_day ? `mỗi tháng ngày ${b.due_day}` : null].filter(Boolean).join(' · ')}
            amount={b.amount_mode === 'ask' ? (estimate ? `~ ${money(estimate)}` : 'hỏi mỗi kỳ') : money(b.amount)}
            state={state}
            onOpen={() => setOpenId(openId === b.id ? null : b.id)}
            onEdit={() => { setEditId(editId === b.id ? null : b.id); setNoteFocus(false); setPayId(null); }}
            onDuplicate={() => {
              onDuplicate(b);
              nav.showToast(`Đã chép quy tắc của ${b.name} — sửa rồi bấm Tạo hóa đơn. Lịch sử các kỳ không chép theo.`, { icon: 'copy' });
            }}
            enabled={b.enabled} onToggle={(enabled) => toggle(b, enabled)}
            onDelete={() => remove(b)}
            hasNote={!!b.note}>

            {b.term_total > 0 && <RuleProgress pct={(b.term_done || 0) / b.term_total * 100}
              color={catInfo(b.category_id, fin.cats).color}
              label={`kỳ ${Math.min((b.term_done || 0) + 1, b.term_total)}/${b.term_total}`}
              right={`còn ${money(left * estimate)}`} />}

            {actionable && payId !== b.id && (
              <div className="fin-rule__foot">
                <button type="button" className="fin-btn fin-btn--outline fin-btn--sm" onClick={() => { setPayId(b.id); setEditId(null); }}>
                  <AppIcon name="checkCircle" size={15} /> {b.term_total ? `Thanh toán kỳ ${(b.term_done || 0) + 1}/${b.term_total}` : 'Thanh toán'}
                </button>
                <button type="button" className="fin-btn fin-btn--ghost fin-btn--sm" onClick={() => skip(b)}>
                  <AppIcon name="skip" size={14} /> Bỏ kỳ này
                </button>
              </div>
            )}
            {skipped && b.enabled && (
              <div className="fin-rule__foot">
                <button type="button" className="fin-btn fin-btn--ghost fin-btn--sm" onClick={() => unskip(b)}>
                  <AppIcon name="refresh" size={14} /> Bỏ đánh dấu · trả lại kỳ này
                </button>
              </div>
            )}
            {payId === b.id && <PayBlock fin={fin} tasks={tasks} allowSource dueDay={b.due_day}
              defaultAmount={estimate || ''} onCancel={() => setPayId(null)} onPay={(payload) => pay(b, payload)}
              note={b.amount_mode === 'ask'
                ? 'Số điền sẵn là mức trung bình 3 kỳ gần nhất — sửa lại theo hóa đơn thật trước khi xác nhận.'
                : 'Số cố định theo hóa đơn — sửa nếu kỳ này khác. Ngày mặc định là hôm nay; nếu bạn đã trả từ mấy ngày trước thì chọn đúng ngày đó để báo cáo không lệch tháng.'} />}
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
      <SummaryStrip
        items={[
          { label: 'Sẽ nhận tháng này', value: money(fin.incomeRules.filter(r => r.enabled && !(r.received_periods || []).includes(period)).reduce((sum, r) => sum + r.amount, 0)) },
          { label: 'Đã nhận', value: money(fin.incomeRules.filter(r => (r.received_periods || []).includes(period)).reduce((sum, r) => sum + r.amount, 0)), tone: 'good' },
        ]}
        note="Tiền vào — không phải hóa đơn, nên không có gì để trả và không bao giờ tô đỏ. Bấm Đã nhận sinh một giao dịch loại Thu mang đúng nguồn thu, ngày là ngày bạn chọn."
      />
      {fin.incomeRules.length === 0 && <RulesEmpty icon="money" title="Chưa có khoản thu định kỳ"
        description="Khai khoản thu để app nhắc xác nhận theo từng kỳ." />}
      {fin.incomeRules.map(r => {
        const received = (r.received_periods || []).includes(period);
        const state = dueState({
          days: daysUntilDue(r.due_day, fin.today), enabled: r.enabled,
          done: received, doneText: 'đã nhận kỳ này', neverLate: true,
        });
        return (
          <RuleCard key={r.id} tone={state.tone} off={!r.enabled} icon="money" iconColor="#7fc060" title={r.name}
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
  const openLoans = fin.loans.filter(l => !l.closed_at);
  const monthlyInterest = openLoans.reduce((sum, l) => {
    const sch = loanSchedule(l);
    return sum + (sch.kind === 'interest' ? sch.monthlyInterest : sch.interestPart);
  }, 0);
  const nextSettle = openLoans.filter(l => l.due_at).sort((a, b) => a.due_at.localeCompare(b.due_at))[0];

  return (
    <div className="fin-rules">
      <SummaryStrip
        items={[
          { label: 'Tổng dư nợ gốc', value: money(openLoans.reduce((sum, l) => {
            const sch = loanSchedule(l);
            return sum + (sch.kind === 'interest' ? sch.principalDue : sch.principalRemaining);
          }, 0)) },
          { label: 'Lãi phải trả tháng này', value: money(monthlyInterest) },
          { label: 'Hạn tất toán gần nhất', value: nextSettle ? dmy(nextSettle.due_at) : '—' },
        ]}
        note="Khoản vay không phải hóa đơn: mỗi kỳ tách thành hai phần khác nhau. Lãi là chi phí thật — ghi vào Tài chính & Nợ › Lãi & phí ngân hàng, lên báo cáo. Trả gốc không phải chi tiêu — nó chỉ chuyển tiền từ ví sang giảm dư nợ, nên không tính vào hạn mức tháng."
      />
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
        const paidInterestTotal = fin.transactions
          .filter(t => t.loan_id === l.id && t.loan_part === 'interest')
          .reduce((sum, t) => sum + t.amount, 0);
        // Lãi cả đời khoản vay: lãi-only trả đều mỗi kỳ; amort thì bằng tổng trả trừ gốc.
        const totalInterest = sch.kind === 'interest'
          ? sch.monthlyInterest * sch.progress.total
          : Math.max(0, sch.monthlyPayment * sch.progress.total - l.principal);
        return (
          <RuleCard key={l.id} tone={state.tone} icon="bank" iconColor="#9184d9" title={l.name}
            badge={`${sch.progress.done}/${sch.progress.total} kỳ`}
            meta={[l.lender, `gốc ${money(l.principal)}`, `${l.rate}%/năm`,
              sch.kind === 'interest' ? 'chỉ trả lãi' : 'trả đều gốc + lãi'].filter(Boolean).join(' · ')}
            amount={money(dueAmount)} state={state} openTitle="Sửa khoản vay"
            onOpen={() => setEditId(editId === l.id ? null : l.id)}
            onEdit={() => { setEditId(editId === l.id ? null : l.id); setPayId(null); }}
            onDelete={async () => { if (await nav.confirmDelete(`khoản vay “${l.name}”`)) await fin.deleteLoan(l.id); }}>

            <RuleProgress pct={sch.progress.total ? sch.progress.done / sch.progress.total * 100 : 0}
              label={`kỳ ${Math.min(sch.progress.done + 1, sch.progress.total)}/${sch.progress.total} · trả ngày ${l.pay_day} hằng tháng`}
              right={`còn ${Math.max(0, sch.progress.total - sch.progress.done)} kỳ`} />

            <div className="fin-loan-split">
              <span>{sch.kind === 'interest' ? 'Dư nợ gốc' : 'Dư nợ gốc còn lại'}
                <strong>{money(sch.kind === 'interest' ? sch.principalDue : sch.principalRemaining)}</strong>
                <small>{sch.kind === 'interest' ? 'gốc chưa giảm đồng nào cho tới khi tất toán' : `đã trả ${sch.progress.done}/${sch.progress.total} kỳ`}</small></span>
              <span>Phải trả ngày {l.pay_day} tháng này
                <strong className="is-accent">{money(dueAmount)}</strong>
                <small>{sch.kind === 'interest'
                  ? `toàn bộ là lãi — gốc vẫn nguyên ${money(sch.principalDue)}`
                  : `gốc ${money(sch.principalPart)} + lãi ${money(sch.interestPart)}`}</small></span>
              <span>Lãi đã trả đến giờ
                <strong>{money(paidInterestTotal)}</strong>
                <small>cả khoản vay ~{money(totalInterest)}</small></span>
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

// ── lend: Cho vay (khoản phải thu) ───────────────────────────────────────────
// Cho mượn KHÔNG phải chi tiêu, họ trả lại KHÔNG phải thu nhập — cả hai chỉ đổi
// chỗ của tiền. Giao dịch thu về mang cờ excluded nên đứng ngoài mọi tổng.
function LendsList({ fin, nav, tasks }) {
  const [editId, setEditId] = useState(null);
  const [payId, setPayId] = useState(null);
  const [histId, setHistId] = useState(null);

  const rows = fin.lendings.map(l => {
    const repayments = fin.transactions.filter(t => t.lending_id === l.id)
      .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
    const got = Math.min(l.principal, repayments.reduce((sum, t) => sum + t.amount, 0));
    const left = Math.max(0, l.principal - got);
    const done = left === 0;
    const days = l.due_on ? daysInclusive(fin.today, l.due_on) - 1 : null;
    return { l, repayments, got, left, done, days };
  }).sort((a, b) => (a.l.due_on || '9999').localeCompare(b.l.due_on || '9999'));

  const open = rows.filter(r => !r.done);
  const nextDue = open.filter(r => r.l.due_on)[0];

  const record = async (l, payload) => {
    const tx = await fin.recordLendingRepayment(l, payload);
    nav.showToast(tx
      ? `Đã ghi ${money(payload.amount)} thu về từ ${l.name} — không tính là thu nhập`
      : `Không thể ghi khoản thu về từ ${l.name}. Kiểm tra dữ liệu Finance rồi thử lại.`,
    { icon: tx ? 'handCoins' : 'warning' });
    return !!tx;
  };

  return (
    <div className="fin-rules">
      <SummaryStrip
        items={[
          { label: 'Đang cho vay · chưa thu', value: money(rows.reduce((s, r) => s + r.left, 0)) },
          { label: 'Đã thu về', value: money(rows.reduce((s, r) => s + r.got, 0)), tone: 'good' },
          { label: 'Hẹn gần nhất', value: nextDue ? dmy(nextDue.l.due_on) : '—' },
        ]}
        note="Cho mượn không phải chi tiêu — tiền rời ví nhưng đổi thành khoản phải thu, nên donut, hạn mức nhóm và mức 50/30/20 không đổi. Khi họ trả, tiền về ví và số này giảm đúng bằng đó — không tính là thu nhập, nếu tính thì tháng đó thu nhập vọt lên ảo và tỉ lệ tiết kiệm sai. Chỉ phần lãi, nếu có, mới là thu nhập thật."
      />

      {rows.length === 0 && <RulesEmpty icon="handCoins" title="Chưa cho ai mượn tiền"
        description="Ghi khoản cho vay để biết ai còn nợ bao nhiêu và hẹn trả ngày nào." />}

      {rows.map(({ l, repayments, got, left, done, days }) => {
        const state = done ? { tone: 'paid', text: `thu xong ${dmy(repayments.at(-1)?.occurred_at)}` }
          : days == null ? { tone: 'wait', text: 'không hẹn ngày' }
          : days <= -4 ? { tone: 'over', text: `quá hẹn ${Math.abs(days)} ngày` }
          : days < 0 ? { tone: 'late', text: `quá hẹn ${Math.abs(days)} ngày` }
          : days === 0 ? { tone: 'due', text: 'đến hẹn hôm nay' }
          : { tone: days <= 14 ? 'late' : 'wait', text: `còn ${days} ngày` };
        return (
          <RuleCard key={l.id} tone={state.tone} icon={done ? 'checkCircle' : 'handCoins'}
            iconColor={done ? '#7fc060' : '#9184d9'}
            title={l.name} badge={l.rate > 0 ? `${l.rate}%/năm` : 'không lãi'}
            meta={[l.note, `cho mượn ${dmy(l.lent_on)}`, l.due_on ? `hẹn trả ${dmy(l.due_on)}` : null].filter(Boolean).join(' · ')}
            amount={done ? money(l.principal) : money(left)} state={state} openTitle="Sửa khoản cho vay"
            onOpen={() => setEditId(editId === l.id ? null : l.id)}
            onEdit={() => { setEditId(editId === l.id ? null : l.id); setPayId(null); }}
            onDelete={async () => {
              const kept = repayments.length;
              if (await nav.confirmDelete(`khoản cho vay “${l.name}”`,
                kept > 0 ? `${kept} giao dịch thu về vẫn được giữ lại ở màn Giao dịch.` : 'Chưa có lần thu nào được ghi.')) {
                await fin.deleteLending(l.id);
              }
            }}>

            <div className="fin-loan-split">
              <span>{done ? 'Đã thu đủ' : 'Còn phải thu'} <strong className={done ? 'is-good' : ''}>{money(done ? l.principal : left)}</strong></span>
              <span>Cho mượn <strong>{money(l.principal)}</strong></span>
              <span>Hẹn trả <strong>{dmy(l.due_on)}</strong></span>
            </div>

            <RuleProgress pct={l.principal ? got / l.principal * 100 : 0}
              label="Đã thu" right={`${money(got)} / ${money(l.principal)}`} />

            {payId !== l.id && (
              <div className="fin-rule__foot">
                {!done && <button type="button" className="fin-btn fin-btn--secondary fin-btn--sm"
                  onClick={() => { setPayId(l.id); setEditId(null); }}>
                  <AppIcon name="handCoins" size={15} /> Ghi khoản họ trả
                </button>}
                <button type="button" className="fin-btn fin-btn--ghost fin-btn--sm"
                  onClick={() => setHistId(histId === l.id ? null : l.id)}>
                  <AppIcon name="clock" size={14} /> {repayments.length ? `Lịch sử · ${repayments.length} lần` : 'Chưa có lần trả nào'}
                </button>
              </div>
            )}

            {payId === l.id && <PayBlock fin={fin} tasks={tasks} defaultAmount="" quickAmount={left}
              amountLabel="Họ vừa trả bao nhiêu" confirmLabel="Ghi nhận"
              onCancel={() => setPayId(null)} onPay={(payload) => record(l, payload)} />}

            {histId === l.id && repayments.length > 0 && (
              <div className="fin-bill-history">
                <div className="fin-bill-history__list">
                  {repayments.map((t, i) => (
                    <div key={t.id}><span>Lần {i + 1} · {dmy(t.occurred_at)}</span><strong>{money(t.amount)}</strong></div>
                  ))}
                </div>
                <small className="fin-bill-history__note">Mỗi lần nhận là một giao dịch không tính vào thu nhập ở màn Giao dịch — xóa khoản cho vay không xóa lịch sử này.</small>
              </div>
            )}

            {editId === l.id && <RuleForm seg="lend" fin={fin} nav={nav} initial={l} onDone={() => setEditId(null)} />}
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
      <SummaryStrip
        items={[
          { label: 'Đang nợ thẻ', value: money(fin.cards.reduce((sum, c) => sum + cardStatementSummary(c, fin.transactions, fin.today).outstanding, 0)) },
          { label: 'Tổng hạn mức', value: money(fin.cards.reduce((sum, c) => sum + (c.credit_limit || 0), 0)) },
          { label: 'Lãi suất gửi bình quân', value: `${fin.blendedRate}%/năm` },
        ]}
        note="Lãi suất gửi bình quân là mốc để đối chiếu phần tiền hoãn trả: giữ tiền tới ngày đến hạn rồi trả đủ thì phần lãi đó là thật, nhưng chỉ khi trả ĐÚNG HẠN — trễ một ngày là ngân hàng tính lãi trên toàn bộ sao kê, ăn đứt mọi khoản kiếm được."
      />
      {fin.cards.length === 0 && <RulesEmpty icon="creditCard" title="Chưa có thẻ tín dụng"
        description="Thêm thẻ để theo dõi hạn mức, sao kê và ngày đến hạn." />}
      {fin.cards.map(c => {
        const cyc = cardStatementSummary(c, fin.transactions, fin.today);
        const balance = cardBalance(c.id, fin.transactions);
        const est = floatInterest(cyc.outstanding, cyc.floatDaysTotal, fin.blendedRate);
        const usedPct = c.credit_limit ? Math.round((balance / c.credit_limit) * 100) : 0;
        const fee = nextAnnualFee(c.annual_fee_on, fin.today);
        const feeSoon = fee && fee.days <= 30;
        const state = dueState({
          days: daysUntilDue(c.due_day, fin.today),
          done: cyc.outstanding <= 0, doneText: 'sao kê đã trả',
        });
        return (
          <RuleCard key={c.id} tone={state.tone} icon="creditCard" iconColor="#9184d9"
            title={`${c.name}${c.last4 ? ` ••${c.last4}` : ''}`}
            meta={[c.bank, `chốt ngày ${c.statement_day}`, `đến hạn ngày ${c.due_day}`].filter(Boolean).join(' · ')}
            amount={money(cyc.outstanding)} state={state} openTitle="Sửa thẻ"
            onOpen={() => setEditId(editId === c.id ? null : c.id)}
            onEdit={() => { setEditId(editId === c.id ? null : c.id); setPayId(null); }}
            onDelete={async () => { if (await nav.confirmDelete(`thẻ “${c.name}”`)) await fin.deleteCard(c.id); }}>

            <RuleProgress pct={usedPct} label={`Đã dùng ${money(balance)} / ${money(c.credit_limit)}`} right={`${usedPct}%`} />

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
              <span>Rút tiền mặt mất phí {money(c.cash_advance_fee)} — tránh.</span>
            </div>}
            {c.annual_fee > 0 && <div className={`fin-inline-message${feeSoon ? ' fin-inline-message--warn' : ''}`}>
              <AppIcon name={feeSoon ? 'warning' : 'calendar'} size={15} weight="fill" />
              <span>Phí thường niên {money(c.annual_fee)}{fee
                ? ` · thu ngày ${dmy(fee.date)}, ${fee.days === 0 ? 'đúng hôm nay' : `còn ${fee.days} ngày`}.`
                : ' · chưa có ngày thu nên app không nhắc trước được.'}</span>
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
