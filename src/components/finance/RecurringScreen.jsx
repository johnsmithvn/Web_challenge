import { useState, useEffect, useRef } from 'react';
import { autoKPreview, groupDigits, parseCurrencyInput, sanitizeDecimal, sanitizeDigits } from '../../utils/currencyUtils';
import { useUserTasks } from '../../hooks/useUserTasks';
import {
  billAmountEstimate, cardBalance, cardStatementSummary, cardCarryOver, floatInterest, loanSchedule,
  loanCycle, lendingInterest, forfeitedInterest,
  dueDateInMonth, daysUntilDue, addDaysStr, daysInclusive, nextAnnualFee,
  billCycle, billSettled, billPeriods, billPeriodForDate,
} from '../../utils/financeLogic';
import { buildHubItems, groupHubItems, hubTotals, calendarDays, weekBounds, shortMoney, periodHistory } from '../../utils/recurringHub';
import { money, Segmented, FinanceIcon, TaskPicker, Toggle, catInfo, DateField, pickableSubs, BankSelect } from './parts';
import AppIcon from '../AppIcon';
import GenericModal from '../GenericModal';
import InfoTip from '../InfoTip';
import SkeletonList from '../SkeletonList';
import { SavingsWorkspace } from './AnalyzeScreen';

// Segment cũ vẫn là hợp đồng deep link (Tổng quan, Dashboard, Inbox handoff) → loại trong hub.
const SEGMENTS = [
  { value: 'out', kind: 'bill' }, { value: 'loan', kind: 'loan' }, { value: 'card', kind: 'card' },
  { value: 'lend', kind: 'lend' }, { value: 'saving', kind: 'save' },
];

/**
 * 20 mẫu chỉ để tiết kiệm gõ chữ: điền TÊN + NHÓM + danh mục con + kiểu số tiền.
 * Không mẫu nào điền sẵn số tiền — bấm qua nhanh mà lưu một con số mặc định thì
 * nó không đúng với ai cả.
 */
const BILL_TEMPLATES = [
  { label: 'Điện',         icon: 'lightning',    category_id: 'housing', subcategory_id: 'housing.electric', amount_mode: 'ask' },
  { label: 'Nước',         icon: 'drop',         category_id: 'housing', subcategory_id: 'housing.water', amount_mode: 'ask' },
  { label: 'Internet',     icon: 'wifi',         category_id: 'subscription', subcategory_id: 'housing.internet', amount_mode: 'fixed' },
  { label: 'Tiền thuê nhà', icon: 'house',       category_id: 'housing', subcategory_id: 'housing.rent', amount_mode: 'fixed' },
  { label: 'Truyền hình',  icon: 'television',   category_id: 'personal', subcategory_id: 'subscription.streaming', amount_mode: 'fixed' },
  { label: 'Điện thoại / 4G', icon: 'deviceMobile', category_id: 'subscription', subcategory_id: 'housing.mobile', amount_mode: 'fixed' },
  { label: 'Phí vệ sinh',  icon: 'trash',        category_id: 'housing', subcategory_id: 'housing.cleaning', amount_mode: 'fixed' },
  { label: 'Phí quản lý chung cư', icon: 'buildings', category_id: 'housing', subcategory_id: 'housing.management', amount_mode: 'fixed' },
  { label: 'Netflix',      icon: 'film',         category_id: 'personal', subcategory_id: 'subscription.streaming', amount_mode: 'fixed' },
  { label: 'Spotify',      icon: 'music',        category_id: 'personal', subcategory_id: 'subscription.streaming', amount_mode: 'fixed' },
  { label: 'YouTube Premium', icon: 'video',     category_id: 'personal', subcategory_id: 'subscription.streaming', amount_mode: 'fixed' },
  { label: 'Google One',   icon: 'cloud',        category_id: 'subscription', subcategory_id: 'subscription.cloud', amount_mode: 'fixed' },
  { label: 'iCloud',       icon: 'cloud',        category_id: 'subscription', subcategory_id: 'subscription.cloud', amount_mode: 'fixed' },
  { label: 'ChatGPT',      icon: 'sparkle',      category_id: 'subscription', subcategory_id: 'subscription.software', amount_mode: 'fixed' },
  { label: 'Học phí',      icon: 'graduation',   category_id: 'family', subcategory_id: 'family.tuition', amount_mode: 'fixed' },
  { label: 'Bảo hiểm',     icon: 'certificate',  category_id: 'finance', subcategory_id: 'finance.insurance', amount_mode: 'fixed' },
  { label: 'Trả góp',      icon: 'receipt',      category_id: 'finance', subcategory_id: 'finance.installment', amount_mode: 'fixed' },
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
 */
function dueState({ days, enabled = true, done = false, doneText, skipped = false }) {
  if (!enabled) return { tone: 'off', text: 'đang tắt' };
  if (done) return { tone: 'paid', text: doneText || 'đã trả kỳ này' };
  if (skipped) return { tone: 'off', text: 'đã bỏ kỳ này' };
  if (days == null) return { tone: 'wait', text: '' };
  if (days > 0) return { tone: 'wait', text: `còn ${days} ngày` };
  if (days === 0) return { tone: 'due', text: 'tới hạn hôm nay' };
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
    due_day: bill.due_day, rrule: bill.rrule, anchor_date: bill.anchor_date,
    term_total: bill.term_total, note: bill.note,
  };
}

const everyOf = (bill) => Math.max(1, Number(bill.rrule?.every) || 1);

/** "mỗi 3 tháng ngày 20" — nhãn chu kỳ dùng chung cho dòng hóa đơn. */
function cycleLabel(bill) {
  const every = everyOf(bill);
  const when = every === 1 ? 'mỗi tháng' : every === 12 ? 'mỗi năm' : `mỗi ${every} tháng`;
  return bill.due_day ? `${when} ngày ${bill.due_day}` : when;
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

/**
 * Máy tính lãi mất do rút sổ trước hạn — cho sổ KHÔNG khai trong app (sổ đã khai thì
 * đã có nút "Rút {tên sổ}" điền sẵn, không cần gõ lại ba số).
 *
 * State cục bộ và KHÔNG đi vào payload: đây là giấy nháp để ra một con số, không phải
 * dữ liệu của khoản cho vay. Muốn app nhớ sổ thì khai ở màn Quỹ tiết kiệm.
 */
function ForfeitCalc({ withdrawOn, today, defaultAmount, onUse }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [openedAt, setOpenedAt] = useState('');
  // Ngày rút mặc định BÁM ngày đưa tiền (rút xong đưa luôn là ca thường gặp) nhưng phải
  // sửa được: app không có cách nào biết bạn đập sổ hôm nào, và đoán sớm/muộn vài ngày
  // là lệch tiền thật. Để trống thì theo ngày đưa tiền, gõ vào thì ưu tiên số bạn gõ.
  const [brokeOn, setBrokeOn] = useState('');

  if (!open) {
    return (
      <button type="button" className="fin-inline-command"
        onClick={() => { setOpen(true); if (!amount && defaultAmount) setAmount(String(defaultAmount)); }}>
        <AppIcon name="calculator" size={14} /> Tự tính từ ngày gửi và lãi suất của sổ
      </button>
    );
  }

  const on = brokeOn || withdrawOn;
  const deposit = { amount: parseCurrencyInput(amount) || 0, rate: Number(rate) || 0, opened_at: openedAt || null };
  const lost = forfeitedInterest(deposit, on);
  const days = openedAt && on > openedAt ? daysInclusive(openedAt, on) - 1 : 0;

  return (
    <div className="fin-payblock">
      <div className="fin-ruleform__grid">
        <label className="fin-field"><span>Số tiền đã gửi</span>
          <input className="fin-input" inputMode="numeric" pattern="[0-9.]*" placeholder="100.000.000" autoFocus
            value={groupDigits(amount)} onChange={e => setAmount(sanitizeDigits(e.target.value))} />
          {autoKPreview(amount) && <small className="fin-amount-auto">Tính trên <strong>{autoKPreview(amount)} ₫</strong> · Auto-K</small>}</label>
        <label className="fin-field"><span>Lãi của sổ · %/năm</span>
          <input className="fin-input" inputMode="decimal" placeholder="9"
            value={rate} onChange={e => setRate(sanitizeDecimal(e.target.value, 3, 4))} /></label>
        <label className="fin-field"><span>Ngày gửi</span>
          <DateField value={openedAt} onChange={setOpenedAt} max={on} /></label>
        <label className="fin-field"><span>Ngày rút sổ</span>
          <DateField value={on} onChange={setBrokeOn} max={today} /></label>
      </div>
      <small className="fin-payblock__hint">{lost > 0
        ? <>Gửi từ {dmy(openedAt)} tới ngày rút {dmy(on)} là <strong>{days} ngày</strong> → lãi đã tích <strong>{money(lost)}</strong>. Rút trước hạn thì ngân hàng chỉ trả lãi không kỳ hạn (~0,1%/năm) nên coi như mất cả — nếu vẫn được trả một ít thì trừ ra ở ô trên theo giấy rút.</>
        : <>Điền số của sổ tiết kiệm, app đếm ngày từ <strong>ngày gửi</strong> tới <strong>ngày rút</strong>. Ngày rút để mặc định bằng ngày đưa tiền ({dmy(withdrawOn)}) — đập sổ hôm khác thì sửa lại, app không tự biết được.</>}</small>
      <div className="fin-payblock__foot">
        <button type="button" className="fin-btn fin-btn--primary fin-btn--sm" disabled={!lost}
          onClick={() => { onUse(lost); setOpen(false); }}>
          <AppIcon name="check" size={14} /> Dùng {money(lost)}
        </button>
        <button type="button" className="fin-btn fin-btn--ghost fin-btn--sm" onClick={() => setOpen(false)}>Đóng</button>
      </div>
    </div>
  );
}

// ── Hộp thoại Thêm / Sửa nguồn chi ───────────────────────────────────────────
// Một hộp thoại cho cả 5 loại (bản chốt): trường nhập đổi theo loại, chân hộp xem trước
// dòng sẽ hiện ra. Validation và payload giữ nguyên của form cũ — đổi vỏ, không đổi luật.
const KIND_WORD = { bill: 'hóa đơn', card: 'thẻ', loan: 'khoản vay', save: 'quỹ', lend: 'khoản cho vay' };
const NAME_META = {
  bill: ['Tên hóa đơn', 'Ví dụ: Tiền điện nhà ngoại'], card: ['Tên thẻ', 'Ví dụ: VIB Online Plus'],
  loan: ['Tên khoản vay', 'Ví dụ: Vay mua xe'], save: ['Tên quỹ', 'Ví dụ: Quỹ du lịch Tết'], lend: ['Người mượn', 'Tên người mượn'],
};
const REPEAT_OPTIONS = [
  { value: 1, label: 'Hằng tháng' }, { value: 3, label: 'Mỗi 3 tháng' },
  { value: 6, label: 'Mỗi 6 tháng' }, { value: 12, label: 'Mỗi năm' },
];

/** State phẳng cho form từ một dòng DB (null → '' để input có kiểm soát). */
function formFrom(kind, initial, nav) {
  if (!initial) {
    const name = nav.handoff?.kind === KIND_TO_SEG[kind] ? nav.handoff.title || '' : '';
    return kind === 'save' ? { name, plan: 'monthly', auto_day: '5' } : { name, every: 1 };
  }
  const flat = Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, v == null ? '' : v]));
  // `every` (số tháng một kỳ) sống trong rrule dưới DB, kéo lên thành field phẳng cho form.
  if (kind === 'bill') flat.every = initial.rrule?.every || 1;
  if (kind === 'save') {
    flat.plan = initial.auto_deposit?.amount ? 'monthly' : 'manual';
    flat.auto_amount = initial.auto_deposit?.amount ? String(initial.auto_deposit.amount) : '';
    flat.auto_day = String(initial.auto_deposit?.day || 5);
  }
  return flat;
}

function SmField({ label, wide, hint, children }) {
  return (
    <div className={`fin-sm__field${wide ? ' is-wide' : ''}`}>
      {label && <span className="fin-sm__label">{label}</span>}
      {children}
      {hint && <small className="fin-sm__hint">{hint}</small>}
    </div>
  );
}

/** Ô nhập có hậu tố (₫, %/năm, ngày). Nhãn đọc qua aria-label vì ô nằm trong khung tự vẽ. */
function SmInput({ suffix, label, ...props }) {
  return (
    <label className={`fin-sm__input${props.disabled ? ' is-disabled' : ''}`}>
      <input aria-label={label} {...props} />
      {suffix && <span>{suffix}</span>}
    </label>
  );
}

function SmMoney({ value, onChange, label, opts, placeholder = '0', ...props }) {
  return (<>
    <SmInput label={label} inputMode="numeric" pattern="[0-9.]*" placeholder={placeholder} suffix="₫"
      value={groupDigits(value || '')} onChange={e => onChange(sanitizeDigits(e.target.value))} {...props} />
    {/* Auto-K nhân 1.000 cho số dưới 10.000 — ô hiện "5.000" mà lưu 5.000.000₫. */}
    {autoKPreview(value, opts) && <small className="fin-amount-auto">Sẽ lưu <strong>{autoKPreview(value, opts)} ₫</strong> · Auto-K</small>}
  </>);
}

function SmSeg({ value, options, onChange, label }) {
  return (
    <div className="fin-sm__seg" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button type="button" key={o.value} role="radio" aria-checked={value === o.value}
          className={value === o.value ? 'is-on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

function SmToggle({ on, onChange, label, hint }) {
  return (
    <button type="button" className="fin-sm__toggle" aria-pressed={on} onClick={() => onChange(!on)}>
      <span><strong>{label}</strong>{hint && <small>{hint}</small>}</span>
      <i className={on ? 'is-on' : ''}><b /></i>
    </button>
  );
}

const SmNote = ({ children }) => (
  <p className="fin-sm__note"><AppIcon name="question" size={15} /><span>{children}</span></p>
);

function SourceModal({ kind: startKind, fin, nav, initial, focusNote = false, onDirty, onClose, onSaved }) {
  const editing = Boolean(initial?.id);
  const [kind, setKind] = useState(startKind);
  const seg = KIND_TO_SEG[kind];
  // Form SỬA được điền sẵn bằng số ĐÃ LƯU, nên auto-K parse lại là nhân thêm 1.000 lần nữa
  // (8.000đ → 8.000.000đ) chỉ vì mở form ra bấm Lưu. Lúc THÊM MỚI vẫn để auto-K theo preference.
  const amountOpts = editing ? { autoK: false } : undefined;
  const noteRef = useRef(null);
  const formRef = useRef(null);
  const [hasTerm, setHasTerm] = useState(() => Boolean(initial?.term_total));
  const [f, setF] = useState(() => formFrom(startKind, initial, nav));
  const [iconOpen, setIconOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const setVal = (k) => (v) => setF(p => ({ ...p, [k]: v }));
  const setDigits = (k, maxLength = 18) => (e) => setF(p => ({ ...p, [k]: sanitizeDigits(e.target.value, maxLength) }));
  const setDecimal = (k, maxIntegerDigits = 3, maxFractionDigits = 4) => (e) => setF(p => ({
    ...p, [k]: sanitizeDecimal(e.target.value, maxIntegerDigits, maxFractionDigits),
  }));
  useEffect(() => { if (!editing && nav.handoff?.kind === seg) nav.clearHandoff(); }, []); // eslint-disable-line
  // "Đã gõ gì chưa" = so với ảnh chụp lúc mở form.
  const pristine = useRef();
  if (pristine.current === undefined) pristine.current = JSON.stringify(f);
  useEffect(() => { onDirty?.(JSON.stringify(f) !== pristine.current); }, [f]); // eslint-disable-line
  // Mở từ link "Thêm ghi chú" thì con trỏ nhảy thẳng vào ô ghi chú.
  useEffect(() => { if (focusNote) noteRef.current?.focus(); }, [focusNote]);

  const switchKind = (k) => {
    if (k === kind) return;
    setKind(k); setF(formFrom(k, null, nav)); setHasTerm(false); setIconOpen(false);
  };
  const applyTemplate = (t) => setF(p => ({
    ...p, name: t.label, category_id: t.category_id, subcategory_id: t.subcategory_id, icon: t.icon,
    amount_mode: t.amount_mode, amount: t.amount_mode === 'ask' ? '' : p.amount || '',
  }));
  const onDone = (saved) => (saved ? onSaved() : onClose());

  const submit = async (e) => {
    e.preventDefault();
    if (!f.name?.trim()) return;
    const dueDay = Number(f.due_day);
    const positiveDay = Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31;
    let payload;
    if (seg === 'out') {
      const amountMode = f.amount_mode || 'fixed';
      const billAmount = parseCurrencyInput(f.amount, amountOpts);
      const every = Math.max(1, Number(f.every) || 1);
      const anchor = f.anchor_date || null;
      // Ngày cố định thắng ngày bắt đầu; bỏ trống ô ngày thì lấy ngày của mốc bắt đầu.
      const billDay = positiveDay ? dueDay : (anchor ? Number(anchor.slice(8, 10)) : 0);
      if (every > 1 && !anchor) {
        nav.showToast('Hóa đơn nhiều tháng một lần cần ngày bắt đầu để biết tháng nào tới lượt');
        return;
      }
      if (!billDay || (amountMode === 'fixed' && !billAmount)) {
        nav.showToast('Hóa đơn cần ngày trả hợp lệ và số tiền dương');
        return;
      }
      payload = {
        name: f.name.trim(), provider: f.provider || null, customer_code: f.customer_code || null,
        category_id: f.category_id || 'housing', subcategory_id: f.subcategory_id || null,
        amount_mode: amountMode, amount: amountMode === 'ask' ? null : billAmount,
        rrule: { type: 'monthly', day: billDay, ...(every > 1 ? { every } : {}) },
        due_day: billDay, anchor_date: anchor,
        icon: f.icon || null,
        term_total: hasTerm ? Number(f.term_total) || null : null,
        // Chỉ gửi `term_offset` (kỳ đã trả trước khi dùng app). `term_done` là số THUẦN
        // SUY RA — trigger DB tính `term_offset + số giao dịch` — nên client gõ vào đó
        // là bị ghi đè ngay lần thanh toán kế tiếp.
        term_offset: hasTerm
          ? Math.min(Number(f.term_offset) || 0, Number(f.term_total) || 0)
          : 0,
        note: f.note?.trim() || null,
      };
    } else if (seg === 'loan') {
      const principal = parseCurrencyInput(f.principal, amountOpts);
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
      const principal = parseCurrencyInput(f.principal, amountOpts);
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
        forfeited_interest: parseCurrencyInput(f.forfeited_interest, amountOpts) || 0,
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
        credit_limit: parseCurrencyInput(f.credit_limit, amountOpts) || 0,
        statement_day: statementDay, due_day: cardDueDay,
        grace: Number(f.grace) || null, annual_fee: parseCurrencyInput(f.annual_fee, amountOpts) || 0,
        annual_fee_on: f.annual_fee_on || null,
        cash_advance_fee: parseCurrencyInput(f.cash_advance_fee, amountOpts) || 0, min_pct: Number(f.min_pct) || 0,
      };
    }
    if (seg === 'saving') {
      const monthly = f.plan === 'monthly';
      const autoAmount = parseCurrencyInput(f.auto_amount, amountOpts);
      const autoDay = Number(f.auto_day);
      if (monthly && (!autoAmount || !Number.isInteger(autoDay) || autoDay < 1 || autoDay > 31)) {
        nav.showToast('Góp hằng tháng cần số tiền và ngày góp hợp lệ');
        return;
      }
      // Khóa, ví hay ngoài ví giữ mặc định của DB — chỉnh ở Quản lý quỹ.
      payload = { name: f.name.trim(), goal: parseCurrencyInput(f.goal, amountOpts) || 0,
        auto_deposit: monthly ? { amount: autoAmount, day: autoDay } : null };
    }
    const save = {
      out: editing ? (p) => fin.updateBill(initial.id, p) : fin.addBill,
      loan: editing ? (p) => fin.updateLoan(initial.id, p) : fin.addLoan,
      card: editing ? (p) => fin.updateCard(initial.id, p) : fin.addCard,
      lend: editing ? (p) => fin.updateLending(initial.id, p) : fin.addLending,
      saving: editing ? (p) => fin.updateGoal(initial.id, p) : fin.addGoal,
    }[seg];
    const ok = await save(payload);
    if (!ok) {
      nav.showToast('Không lưu được. Kiểm tra dữ liệu Finance rồi thử lại.', { icon: 'warning' });
      return;
    }
    nav.showToast(
      editing ? (seg === 'out' ? 'Số mới áp dụng từ kỳ sau — các kỳ đã ghi giữ nguyên' : 'Đã lưu thay đổi')
      : seg === 'saving' ? 'Đã tạo quỹ — khai nơi gửi trong Quản lý quỹ để bắt đầu góp'
      : seg === 'loan' ? 'Đã tạo khoản vay — mỗi tháng app nhắc trả lãi, tách gốc riêng khỏi chi tiêu'
      : seg === 'card' ? 'Đã thêm thẻ — app theo dõi ngày chốt, đến hạn và số ngày float'
      : seg === 'lend' ? 'Đã ghi khoản cho vay — tiền rời ví nhưng không tính là chi tiêu'
      : 'Đã thêm hóa đơn — tới ngày app hiện nút để bạn ghi', { icon: 'checkCircle' });
    onDone(true);   // đã lưu → đóng thẳng, không hỏi "bỏ nội dung?"
  };


  // Nhóm cha có thể BIẾN MẤT khỏi taxonomy (v6.11.0 xóa `entertainment`). Select
  // native không có option khớp thì trình duyệt hiện option ĐẦU TIÊN trong khi state
  // vẫn giữ khóa cũ — bấm Lưu là ghi một khóa chết mà người dùng tưởng đã chọn đúng.
  // Cùng luật với pickableSubs: luôn giữ lại giá trị dòng đang sửa làm một option.
  const catId = f.category_id || 'housing';
  const catOptions = fin.cats.expenseGroups.filter(g => !g.hidden || g.key === catId);
  if (!catOptions.some(g => g.key === catId)) catOptions.push(catInfo(catId, fin.cats));
  // Xem trước lãi khoản cho vay: chạy lại mỗi lần gõ số tiền, đổi ngày đưa hay ngày hẹn.
  const lendMath = seg === 'lend' ? lendingInterest({
    principal: parseCurrencyInput(f.principal, amountOpts) || 0, rate: Number(f.rate) || 0,
    lent_on: f.lent_on || fin.today, due_on: f.due_on || null,
    forfeited_interest: parseCurrencyInput(f.forfeited_interest, amountOpts) || 0,
  }, [], fin.today) : null;
  // Sổ tiết kiệm đang mở, có ngày gửi và có lãi → đập cái nào cũng mất một cục lãi.
  // Bấm để điền sẵn số đó; giấy rút của ngân hàng mới là số cuối nên ô vẫn sửa được.
  const brokenDeposits = seg === 'lend'
    ? fin.deposits.filter(d => !d.closed_on && d.opened_at && d.rate > 0 && d.amount > 0)
      .map(d => ({ d, lost: forfeitedInterest(d, f.lent_on || fin.today) }))
      .filter(x => x.lost > 0)
    : [];


  const meta = KIND_META[kind];
  const catColor = catInfo(catId, fin.cats).color;
  const parse = (v) => parseCurrencyInput(v, amountOpts) || 0;
  const pvAmount = kind === 'bill' ? (f.amount_mode === 'ask' ? 'hỏi mỗi kỳ' : parse(f.amount) ? money(parse(f.amount)) : '—')
    : kind === 'card' ? (parse(f.credit_limit) ? money(parse(f.credit_limit)) : '—')
    : kind === 'save' ? (f.plan === 'monthly' && parse(f.auto_amount) ? money(parse(f.auto_amount)) : parse(f.goal) ? money(parse(f.goal)) : '—')
    : parse(f.principal) ? money(parse(f.principal)) : '—';
  // Dòng xem trước: dòng mới sẽ rơi vào nhóm nào của danh sách.
  const where = (() => {
    if (editing) return kind === 'bill' ? 'Số mới áp dụng từ kỳ sau. Các kỳ đã ghi giữ nguyên.' : 'Lưu đè thông tin hiện tại.';
    if (kind === 'lend') return f.due_on ? `Hẹn trả ${dmy(f.due_on)}` : 'Chưa có ngày hẹn trả';
    if (kind === 'card') return Number(f.due_day) ? `Đến hạn ngày ${f.due_day} hằng tháng` : 'Nhập ngày chốt và ngày đến hạn';
    if (kind === 'save' && f.plan !== 'monthly') return 'Gửi tay · không nhắc theo lịch';
    const day = Number(kind === 'loan' ? f.pay_day : kind === 'save' ? f.auto_day : f.due_day);
    if (!day || day > 31) return 'Nhập ngày để xếp vào lịch chi';
    const every = kind === 'bill' ? Number(f.every) || 1 : 1;
    const first = billCycle({ due_day: day, rrule: { every }, anchor_date: every > 1 ? f.anchor_date || null : null }, fin.today)?.due;
    if (!first) return 'Nhập ngày để xếp vào lịch chi';
    if (first.slice(0, 7) !== fin.today.slice(0, 7)) return `Kỳ đầu ${dmy(first)}`;
    if (first < fin.today) return `Kỳ ${dmy(first)} đã qua — hiện ở nhóm Quá hạn, bấm Bỏ kỳ nếu đã trả`;
    const wb = weekBounds(fin.today);
    const group = first <= wb.thisWeekEnd ? 'tuần này' : wb.nextWeekEnd && first <= wb.nextWeekEnd ? 'tuần sau' : 'cuối tháng';
    return `Kỳ đầu ${dmy(first)} · xếp vào nhóm ${group}`;
  })();

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); formRef.current?.requestSubmit(); }
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  return (
    <GenericModal onClose={onClose} maxWidth={680} className="fin-sm-modal">
      <form ref={formRef} className="fin-sm" style={{ '--k': meta.color, '--k-soft': meta.soft }}
        onSubmit={async (e) => { setBusy(true); await submit(e); setBusy(false); }} onKeyDown={onKeyDown}>
        <div className="fin-sm__grab" aria-hidden="true"><span /></div>
        <div className="fin-sm__head">
          <div className="fin-sm__titlebar">
            <h2>{editing ? `Sửa ${KIND_WORD[kind]}` : 'Thêm nguồn chi'}</h2>
            <button type="button" className="fin-sm__close" aria-label="Đóng" onClick={onClose}><AppIcon name="x" size={18} /></button>
          </div>
          {!editing && (
            <div className="fin-sm__kinds" role="tablist" aria-label="Loại nguồn chi">
              {ADD_KINDS.map(k => (
                <button type="button" key={k} role="tab" aria-selected={k === kind} className={k === kind ? 'is-on' : ''}
                  style={{ '--k': KIND_META[k].color, '--k-soft': KIND_META[k].soft }} onClick={() => switchKind(k)}>
                  <AppIcon name={KIND_META[k].icon} size={19} /><span>{KIND_META[k].label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="fin-sm__body">
          {kind === 'bill' && !editing && (
            <div className="fin-sm__field">
              <span className="fin-sm__label">Chọn mẫu để điền sẵn</span>
              <div className="fin-sm__chips">{BILL_TEMPLATES.map(t => (
                <button type="button" key={t.label} className={f.name === t.label ? 'is-on' : ''}
                  onClick={() => applyTemplate(t)}><AppIcon name={t.icon} size={14} /> {t.label}</button>
              ))}</div>
              <small className="fin-sm__hint">Mẫu chỉ điền sẵn tên, danh mục và kiểu số tiền — số tiền vẫn do bạn nhập.</small>
            </div>
          )}

          <div className="fin-sm__field">
            <span className="fin-sm__label">{NAME_META[kind][0]}</span>
            <div className="fin-sm__name">
              {kind === 'bill' ? (
                <button type="button" className="fin-sm__icon" title="Đổi icon" aria-label="Đổi icon" aria-expanded={iconOpen}
                  style={{ '--k': catColor }} onClick={() => setIconOpen(v => !v)}>
                  {f.icon ? <AppIcon name={f.icon} size={22} weight="fill" /> : <FinanceIcon categoryId={catId} cats={fin.cats} size={22} weight="fill" />}
                  <span><AppIcon name="pencil" size={10} /></span>
                </button>
              ) : <span className="fin-sm__icon is-static"><AppIcon name={meta.icon} size={22} /></span>}
              <input className="fin-sm__nameinput" aria-label={NAME_META[kind][0]} placeholder={NAME_META[kind][1]}
                value={f.name || ''} onChange={set('name')} autoFocus={!focusNote} />
            </div>
            {iconOpen && (
              <div className="fin-sm__icons">
                {/* aria-pressed để biết icon nào đang chọn, vì tín hiệu duy nhất là màu. */}
                {BILL_ICONS.map(name => (
                  <button type="button" key={name} aria-label={`Chọn icon ${name}`} aria-pressed={(f.icon || '') === name}
                    className={(f.icon || '') === name ? 'is-on' : ''} style={{ '--k': catColor }}
                    onClick={() => { setF(p => ({ ...p, icon: p.icon === name ? '' : name })); setIconOpen(false); }}>
                    <AppIcon name={name} size={18} weight="fill" />
                  </button>
                ))}
                <small className="fin-sm__hint">Bỏ chọn thì dùng icon của nhóm. Màu icon luôn theo nhóm để donut và danh sách khớp nhau.</small>
              </div>
            )}
          </div>

          <div className="fin-sm__grid">
            {kind === 'bill' && (<>
              <SmField label="Số tiền mỗi kỳ">
                {f.amount_mode === 'ask'
                  ? <SmInput label="Số tiền mỗi kỳ" disabled placeholder="hỏi mỗi kỳ" suffix="₫" value="" />
                  : <SmMoney label="Số tiền mỗi kỳ" value={f.amount} onChange={setVal('amount')} opts={amountOpts} />}
              </SmField>
              <SmField label="Ngày trả hằng tháng">
                <SmInput label="Ngày trả hằng tháng" inputMode="numeric" pattern="[0-9]*" placeholder="15" value={f.due_day || ''} onChange={setDigits('due_day', 2)} />
              </SmField>
              <SmField wide>
                <SmToggle on={f.amount_mode === 'ask'} label="Số tiền thay đổi mỗi kỳ"
                  hint="App ghi dấu ~ trước số tiền và gợi ý bằng trung bình 3 kỳ gần nhất khi bạn trả."
                  onChange={(on) => setF(p => ({ ...p, amount_mode: on ? 'ask' : 'fixed', amount: on ? '' : p.amount }))} />
              </SmField>
              <SmField label="Lặp lại" wide>
                <SmSeg label="Lặp lại" value={Number(f.every) || 1} onChange={setVal('every')}
                  options={Number(f.every) === 2 ? [...REPEAT_OPTIONS.slice(0, 1), { value: 2, label: 'Mỗi 2 tháng' }, ...REPEAT_OPTIONS.slice(1)] : REPEAT_OPTIONS} />
              </SmField>
              {Number(f.every) > 1 && (
                <SmField label="Ngày bắt đầu trả" wide
                  hint="Chỉ để đếm tháng nào tới lượt; ngày trong tháng vẫn theo ô Ngày trả. Bỏ trống ô đó thì lấy ngày của mốc này. Netflix bắt đầu 20/08, 3 tháng/lần → kỳ sau 20/11.">
                  <DateField value={f.anchor_date} onChange={setVal('anchor_date')} ariaLabel="Ngày bắt đầu trả" />
                </SmField>
              )}
              <SmField label="Nhà cung cấp">
                <SmInput label="Nhà cung cấp" placeholder="EVN, VNPT…" value={f.provider || ''} onChange={set('provider')} />
              </SmField>
              <SmField label="Mã khách hàng · tùy chọn">
                <SmInput label="Mã khách hàng" placeholder="PD07…" value={f.customer_code || ''} onChange={set('customer_code')} />
              </SmField>
              <SmField label="Danh mục" wide>
                {/* Một ô cho cả nhóm › danh mục con. Nhóm có thể BIẾN MẤT khỏi taxonomy:
                    catOptions luôn giữ khóa dòng đang sửa, pickableSubs giữ sub đang chọn. */}
                <label className="fin-sm__input fin-sm__select">
                  <AppIcon name="tag" size={15} />
                  <select aria-label="Danh mục" value={`${catId}|${f.subcategory_id || ''}`}
                    onChange={e => { const [c, sub] = e.target.value.split('|'); setF(p => ({ ...p, category_id: c, subcategory_id: sub })); }}>
                    {catOptions.map(g => (
                      <optgroup key={g.key} label={g.label}>
                        <option value={`${g.key}|`}>{g.label}</option>
                        {pickableSubs(fin.cats.expenseGroups.find(x => x.key === g.key), g.key === catId ? f.subcategory_id : null, fin.cats)
                          .map(sub => <option key={sub.key} value={`${g.key}|${sub.key}`}>{g.label} › {sub.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </label>
              </SmField>
              <SmField wide>
                <SmToggle on={hasTerm} label="Có số kỳ hữu hạn" hint="Trả góp, trả nợ: trả đủ kỳ cuối thì hóa đơn tự dừng và chuyển xuống mục đã kết thúc."
                  onChange={(on) => { setHasTerm(on); if (!on) setF(p => ({ ...p, term_total: '', term_offset: '', total_debt: '' })); }} />
              </SmField>
              {hasTerm && (<>
                <SmField label="Tổng số kỳ">
                  <SmInput label="Tổng số kỳ" inputMode="numeric" pattern="[0-9]*" placeholder="12" suffix="kỳ" autoFocus
                    value={f.term_total || ''} onChange={setDigits('term_total', 3)} />
                </SmField>
                <SmField label="Đã trả trước khi dùng app">
                  <SmInput label="Đã trả trước khi dùng app" inputMode="numeric" pattern="[0-9]*" placeholder="0" suffix="kỳ"
                    value={f.term_offset ?? ''} onChange={setDigits('term_offset', 3)} />
                </SmField>
                <SmField label="Tổng nợ · tùy chọn" wide hint={f.total_debt && Number(f.term_total) > 0
                  ? `Chia đều ${Number(f.term_total)} kỳ → ${money(Math.round(Number(f.total_debt) / Number(f.term_total)))}/kỳ, đã điền vào ô Số tiền. App lưu số mỗi kỳ, không lưu tổng.`
                  : 'Gõ tổng nợ để app chia ra số tiền mỗi kỳ — hoặc bỏ trống nếu đã biết số mỗi kỳ.'}>
                  <SmInput label="Tổng nợ" inputMode="numeric" pattern="[0-9.]*" placeholder="10.056.000" suffix="₫"
                    value={groupDigits(f.total_debt || '')} onChange={(e) => {
                      const digits = sanitizeDigits(e.target.value);
                      const terms = Number(f.term_total);
                      // Nhớ tổng để hiện lại, nhưng thứ được LƯU vẫn là số mỗi kỳ.
                      setF(p => ({ ...p, total_debt: digits,
                        ...(digits && terms > 0 ? { amount: String(Math.round(Number(digits) / terms)) } : {}) }));
                    }} />
                </SmField>
              </>)}
              <SmField label="Ghi chú · tùy chọn" wide>
                <textarea ref={noteRef} className="fin-sm__textarea" rows={2} aria-label="Ghi chú"
                  placeholder="Số công tơ, mật khẩu trang thanh toán, ai đứng tên, cách chia tiền…"
                  value={f.note || ''} onChange={set('note')} />
              </SmField>
            </>)}

            {kind === 'card' && (<>
              <SmField label="Ngân hàng phát hành">
                <BankSelect value={f.bank || ''} onChange={setVal('bank')} placeholder="Chọn ngân hàng" />
              </SmField>
              <SmField label="4 số cuối · tùy chọn">
                <SmInput label="4 số cuối" inputMode="numeric" pattern="[0-9]*" placeholder="8544" value={f.last4 || ''} onChange={setDigits('last4', 4)} />
              </SmField>
              <SmField label="Hạn mức" wide>
                <SmMoney label="Hạn mức" value={f.credit_limit} onChange={setVal('credit_limit')} opts={amountOpts} />
              </SmField>
              <SmField label="Ngày chốt sao kê">
                <SmInput label="Ngày chốt sao kê" inputMode="numeric" pattern="[0-9]*" placeholder="4" value={f.statement_day || ''} onChange={setDigits('statement_day', 2)} />
              </SmField>
              <SmField label="Ngày đến hạn">
                <SmInput label="Ngày đến hạn" inputMode="numeric" pattern="[0-9]*" placeholder="15" value={f.due_day || ''} onChange={setDigits('due_day', 2)} />
              </SmField>
              <SmField wide>
                <SmNote>Ngày chốt và ngày đến hạn là hai ngày khác nhau. Khoảng giữa hai ngày là số ngày bạn giữ tiền mà không mất lãi.</SmNote>
              </SmField>
              <SmField label="Số ngày miễn lãi">
                <SmInput label="Số ngày miễn lãi" inputMode="numeric" pattern="[0-9]*" placeholder="45" suffix="ngày" value={f.grace || ''} onChange={setDigits('grace', 3)} />
              </SmField>
              <SmField label="Trả tối thiểu">
                <SmInput label="Trả tối thiểu" inputMode="decimal" placeholder="5" suffix="%" value={f.min_pct || ''} onChange={setDecimal('min_pct')} />
              </SmField>
              <SmField label="Phí thường niên · tùy chọn">
                <SmMoney label="Phí thường niên" value={f.annual_fee} onChange={setVal('annual_fee')} opts={amountOpts} />
              </SmField>
              <SmField label="Ngày thu phí">
                <DateField value={f.annual_fee_on} onChange={setVal('annual_fee_on')} ariaLabel="Ngày thu phí thường niên" />
              </SmField>
              <SmField label="Phí rút tiền mặt · tùy chọn" wide>
                <SmMoney label="Phí rút tiền mặt" value={f.cash_advance_fee} onChange={setVal('cash_advance_fee')} opts={amountOpts} />
              </SmField>
            </>)}

            {kind === 'loan' && (<>
              <SmField label="Bên cho vay / Ngân hàng" wide>
                <BankSelect value={f.lender || ''} onChange={setVal('lender')} placeholder="Chọn ngân hàng hoặc nhập tên" />
              </SmField>
              <SmField label="Dư nợ gốc">
                <SmMoney label="Dư nợ gốc" value={f.principal} onChange={setVal('principal')} opts={amountOpts} />
              </SmField>
              <SmField label="Lãi suất">
                <SmInput label="Lãi suất" inputMode="decimal" placeholder="4,8" suffix="%/năm" value={f.rate || ''} onChange={setDecimal('rate')} />
              </SmField>
              <SmField label="Ngày trả hằng tháng">
                <SmInput label="Ngày trả hằng tháng" inputMode="numeric" pattern="[0-9]*" placeholder="2" value={f.pay_day || ''} onChange={setDigits('pay_day', 2)} />
              </SmField>
              <SmField label="Kỳ hạn">
                <SmInput label="Kỳ hạn" inputMode="numeric" pattern="[0-9]*" placeholder="12" suffix="tháng" value={f.term || ''} onChange={setDigits('term', 3)} />
              </SmField>
              <SmField label="Cách trả" wide>
                <SmSeg label="Cách trả" value={f.kind || 'amort'} onChange={setVal('kind')}
                  options={[{ value: 'interest', label: 'Chỉ trả lãi' }, { value: 'amort', label: 'Gốc + lãi đều' }]} />
              </SmField>
              <SmField label="Ngày vay">
                <DateField value={f.opened_at} onChange={setVal('opened_at')} ariaLabel="Ngày vay" />
              </SmField>
              <SmField label="Hạn tất toán">
                <DateField value={f.due_at} onChange={setVal('due_at')} ariaLabel="Hạn tất toán" />
              </SmField>
              <SmField wide>
                <SmNote>Trả góp mua đồ — số tiền như nhau mỗi kỳ, không tính lãi riêng — thì thêm như một <strong>Hóa đơn</strong> có số kỳ, không phải khoản vay.</SmNote>
              </SmField>
            </>)}

            {kind === 'save' && (<>
              <SmField label="Cách góp" wide>
                <SmSeg label="Cách góp" value={f.plan} onChange={setVal('plan')}
                  options={[{ value: 'monthly', label: 'Hằng tháng' }, { value: 'manual', label: 'Gửi tay' }]} />
              </SmField>
              {f.plan === 'monthly' && (<>
                <SmField label="Góp mỗi kỳ">
                  <SmMoney label="Góp mỗi kỳ" value={f.auto_amount} onChange={setVal('auto_amount')} opts={amountOpts} />
                </SmField>
                <SmField label="Ngày góp hằng tháng">
                  <SmInput label="Ngày góp hằng tháng" inputMode="numeric" pattern="[0-9]*" placeholder="5" value={f.auto_day || ''} onChange={setDigits('auto_day', 2)} />
                </SmField>
              </>)}
              <SmField label="Mục tiêu · tùy chọn" wide>
                <SmMoney label="Mục tiêu" value={f.goal} onChange={setVal('goal')} opts={amountOpts} />
              </SmField>
              <SmField wide>
                <SmNote>App chỉ nhắc ngày góp, không tự chuyển tiền. Nơi gửi (sổ tiết kiệm, ví) và khóa quỹ khai trong <strong>Quản lý quỹ</strong> — phải có ít nhất một nơi gửi mới ghi được tiền góp.</SmNote>
              </SmField>
            </>)}

            {kind === 'lend' && (<>
              <SmField label="Số tiền cho mượn">
                <SmMoney label="Số tiền cho mượn" value={f.principal} onChange={setVal('principal')} opts={amountOpts} />
              </SmField>
              <SmField label="Lãi suất · để trống nếu không tính">
                <SmInput label="Lãi suất" inputMode="decimal" placeholder="0" suffix="%/năm" value={f.rate || ''} onChange={setDecimal('rate')} />
                {/* Lãi suất gửi bình quân là chi phí cơ hội thật: rút ra cho vay là mất đúng mức đó. */}
                {fin.blendedRate > 0 && Number(f.rate || 0) !== fin.blendedRate && (
                  <button type="button" className="fin-inline-command" onClick={() => setF(p => ({ ...p, rate: String(fin.blendedRate) }))}>
                    Dùng lãi gửi bình quân · {fin.blendedRate}%/năm
                  </button>
                )}
              </SmField>
              <SmField label="Ngày đưa">
                <DateField value={f.lent_on || fin.today} onChange={setVal('lent_on')} max={fin.today} ariaLabel="Ngày đưa tiền" />
              </SmField>
              <SmField label="Hẹn trả">
                <DateField value={f.due_on} onChange={setVal('due_on')} ariaLabel="Ngày hẹn trả" />
              </SmField>
              <SmField label="Lãi mất do rút tiết kiệm sớm · tùy chọn" wide
                hint="Đập sổ trước hạn để có tiền cho vay thì mất toàn bộ lãi đã tích — tổn thất đó không nằm trong lãi %/năm, khai riêng ở đây. Nó cộng thẳng vào tổng phải thu.">
                <SmMoney label="Lãi mất do rút sớm" value={f.forfeited_interest} onChange={setVal('forfeited_interest')} opts={amountOpts} />
                {brokenDeposits.length > 0 && (
                  <div className="fin-source-picker">
                    {brokenDeposits.map(({ d, lost }) => (
                      <button type="button" key={d.id}
                        className={(parseCurrencyInput(f.forfeited_interest, amountOpts) || 0) === lost ? 'is-active' : ''}
                        onClick={() => setF(p => ({ ...p, forfeited_interest: String(lost) }))}>
                        <AppIcon name="piggyBank" size={14} /> Rút {d.name} · mất {money(lost)}
                      </button>
                    ))}
                  </div>
                )}
                <ForfeitCalc withdrawOn={f.lent_on || fin.today} today={fin.today} defaultAmount={parseCurrencyInput(f.principal, amountOpts) || 0}
                  onUse={(lost) => setF(p => ({ ...p, forfeited_interest: String(lost) }))} />
              </SmField>
              {lendMath && lendMath.total > 0 && (
                <SmField wide>
                  <div className="fin-loan-split">
                    <span>{f.due_on && lendMath.to <= f.due_on ? 'Tổng sẽ nhận' : 'Tổng nếu trả hôm nay'} <strong>{money(lendMath.total)}</strong>
                      <small>{!f.due_on ? 'chưa hẹn ngày trả — tính tới hôm nay'
                        : lendMath.to > f.due_on ? `quá hẹn ${dmy(f.due_on)} — lãi tính tới hôm nay` : `tới hẹn ${dmy(f.due_on)}`}</small></span>
                    <span>Tiền lãi <strong className={lendMath.expected > 0 ? 'is-accent' : ''}>{money(lendMath.expected)}</strong>
                      <small>{lendMath.rate > 0 ? `${lendMath.rate}%/năm × ${lendMath.days} ngày` : 'không tính lãi'}</small></span>
                    {lendMath.forfeited > 0 && <span>Bù lãi mất <strong className="is-accent">{money(lendMath.forfeited)}</strong><small>một cục, không theo ngày</small></span>}
                  </div>
                </SmField>
              )}
              <SmField label="Ghi chú · tùy chọn" wide>
                <SmInput label="Ghi chú" placeholder="Sửa nhà · hẹn miệng" value={f.note || ''} onChange={set('note')} />
              </SmField>
              <SmField wide>
                <SmNote>Khoản này <strong>không sinh giao dịch chi</strong> — cho mượn chỉ đổi tiền trong ví thành khoản phải thu. Lãi tính theo ngày (lãi đơn, năm 365 ngày) trên gốc còn lại.</SmNote>
              </SmField>
            </>)}
          </div>
        </div>

        <div className="fin-sm__foot">
          <div className="fin-sm__preview">
            <span className="fin-sm__icon is-static is-sm" style={kind === 'bill' ? { '--k': catColor } : undefined}>
              {kind === 'bill' && !f.icon ? <FinanceIcon categoryId={catId} cats={fin.cats} size={17} weight="fill" />
                : <AppIcon name={kind === 'bill' ? f.icon : meta.icon} size={17} />}
            </span>
            <span className="fin-sm__pv-text">
              <strong className={f.name?.trim() ? '' : 'is-empty'}>{f.name?.trim() || NAME_META[kind][0]}</strong>
              <small>{where}</small>
            </span>
            <b>{pvAmount}</b>
          </div>
          <button type="button" className="fin-btn fin-btn--ghost fin-sm__cancel" onClick={onClose}>Hủy</button>
          <button type="submit" className="fin-btn fin-btn--primary" disabled={busy || !f.name?.trim()}>
            <AppIcon name={editing ? 'check' : 'plus'} size={15} /> {editing ? 'Lưu thay đổi' : 'Thêm'}
          </button>
        </div>
      </form>
    </GenericModal>
  );
}

// ── Khối ghi một kỳ ──────────────────────────────────────────────────────────
// Mở ngay dưới dòng, không đẩy sang màn khác và không mở modal: người dùng
// thường trả liền ba bốn khoản, rời danh sách mỗi lần là hỏng nhịp.
function PayBlock({ fin, tasks = [], defaultAmount, dueDay, allowSource = false, amountLabel = 'Số tiền đã trả',
  quickAmount = null, interestQuick = null, note = null, periods = null, periodForDate = null,
  confirmLabel = 'Xác nhận thanh toán', onPay, onCancel }) {
  const amountRef = useRef(null);
  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount) : '');
  // Ô tiền lãi chỉ hiện cho khoản cho vay có lãi (`interestQuick != null`). Mặc định
  // TRỐNG: đoán sẵn một số lãi rồi tách sai thì tiền vào nhầm loại mà không ai thấy.
  const [interest, setInterest] = useState('');
  const [occurredAt, setOccurredAt] = useState(fin.today);
  const [sourceCardId, setSourceCardId] = useState('');
  const [taskId, setTaskId] = useState(null);
  // Kỳ CHẠY THEO ngày trả cho tới khi người dùng tự bấm chọn một kỳ khác. Trước đây
  // nó chốt cứng lúc mở khối: khai hóa đơn hôm nay rồi lùi ngày về 25/07 thì tiền
  // vẫn bị ghi vào kỳ sắp tới, hóa đơn báo quá hạn dù đã trả — không có gì báo cho biết.
  const [pickedPeriod, setPickedPeriod] = useState(null);
  // Kỳ suy ra mà đã ghi rồi thì bỏ qua — `unique_finance_tx_bill_period` sẽ chặn ở DB,
  // thà lùi về kỳ chưa trả còn hơn để người dùng bấm rồi ăn một lỗi khó hiểu.
  const derived = periodForDate?.(occurredAt) || null;
  const autoPeriod = periods?.find(p => p.key === derived)?.done ? null : derived;
  const period = pickedPeriod || autoPeriod || periods?.find(p => !p.done)?.key || periods?.[0]?.key || null;
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
    const paid = parseCurrencyInput(amount);
    const result = await onPay({ amount: paid, interest: Math.min(parseCurrencyInput(interest) || 0, paid),
      occurredAt, sourceCardId: sourceCardId || null, taskId, period });
    setBusy(false);
    if (result !== false) onCancel();
  };

  return (
    <div className="fin-payblock">
      <div className="fin-payblock__grid">
        <label className="fin-field"><span>{amountLabel}</span>
          <input ref={amountRef} className="fin-input" inputMode="numeric" pattern="[0-9.]*" autoFocus
            placeholder="chưa có kỳ nào để gợi ý" value={groupDigits(amount)} onChange={e => setAmount(sanitizeDigits(e.target.value))} />
          {/* Auto-K nhân 1.000 cho số dưới 10.000 — ô hiện "5.000" mà ghi 5.000.000₫. */}
          {autoKPreview(amount) && <small className="fin-amount-auto">Sẽ ghi <strong>{autoKPreview(amount)} ₫</strong> · Auto-K</small>}
          {quickAmount > 0 && <button type="button" className="fin-inline-command" onClick={() => {
            setAmount(String(quickAmount));
            if (interestQuick != null) setInterest(String(interestQuick));   // trả hết = gốc còn lại + lãi
          }}>
            Trả hết · {money(quickAmount)}
          </button>}</label>
        <div className="fin-field"><span>Ngày đã trả thật</span>
          <div className="fin-payblock__dates">
            <DateField value={occurredAt} onChange={setOccurredAt} max={fin.today} />
            {quickDates.map(d => (
              <button type="button" key={d.key} className={occurredAt === d.key ? 'is-active' : ''}
                onClick={() => setOccurredAt(d.key)}>{d.label}</button>
            ))}
          </div>
        </div>
      </div>

      {interestQuick != null && (
        <label className="fin-field"><span>Trong đó tiền lãi</span>
          <input className="fin-input" inputMode="numeric" pattern="[0-9.]*" placeholder="0"
            value={groupDigits(interest)} onChange={e => setInterest(sanitizeDigits(e.target.value))} />
          {interestQuick > 0 && <button type="button" className="fin-inline-command" onClick={() => setInterest(String(interestQuick))}>
            Lãi nợ tới hôm nay · {money(interestQuick)}
          </button>}
          <small className="fin-field__hint">Phần lãi là <strong>thu nhập thật</strong> — ghi thành giao dịch thu Đầu tư · Lãi tiết kiệm. Phần còn lại trừ vào gốc và không tính là thu nhập. Để 0 nếu lần này họ chỉ trả gốc.</small>
        </label>
      )}

      {periods && periods.length > 1 && (
        <div className="fin-field"><span>Ghi vào kỳ</span>
          <div className="fin-source-picker">
            {periods.map(p => (
              <button type="button" key={p.key} disabled={p.done}
                className={period === p.key ? 'is-active' : ''}
                title={p.done ? 'Kỳ này đã ghi rồi' : undefined}
                onClick={() => setPickedPeriod(p.key)}>{p.label}</button>
            ))}
          </div>
          <small className="fin-payblock__hint">{pickedPeriod
            ? 'Bạn đang tự chọn kỳ — đổi ngày trả không làm nó nhảy nữa.'
            : 'Kỳ tự chạy theo ngày trả bên trên (mốc kỳ gần ngày đó nhất), nên lùi ngày về lúc trả thật là kỳ tự đúng. Bấm một kỳ khác nếu muốn tự quyết.'}</small>
        </div>
      )}

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
      <button type="button" className="fin-icon-btn" title="Sửa ghi chú" aria-label={`Sửa ghi chú của ${bill.name}`} onClick={onEdit}><AppIcon name="pencil" size={13} /></button>
    </div>
  );
}

// ── Hub: một màn cho cả 5 loại nguồn chi ──────────────────────────────────────
// `nav.recurringSeg` (Tổng quan, Dashboard, Inbox handoff đều mở theo nó) giữ nguyên
// làm hợp đồng; ở đây nó chỉ là giá trị khởi tạo của bộ lọc.
const SEG_TO_KIND = Object.fromEntries(SEGMENTS.map(s => [s.value, s.kind]));
const KIND_TO_SEG = Object.fromEntries(SEGMENTS.map(s => [s.kind, s.value]));

const KIND_META = {
  all:  { label: 'Tất cả', cat: '', icon: 'squares', color: 'var(--n-kind-all)', soft: 'var(--n-kind-all-soft)' },
  bill: { label: 'Hóa đơn', cat: 'HÓA ĐƠN', icon: 'receipt', color: 'var(--n-kind-bill)', soft: 'var(--n-kind-bill-soft)' },
  card: { label: 'Thẻ tín dụng', cat: 'THẺ TÍN DỤNG', icon: 'creditCard', color: 'var(--n-kind-card)', soft: 'var(--n-kind-card-soft)' },
  loan: { label: 'Khoản vay', cat: 'KHOẢN VAY', icon: 'bank', color: 'var(--n-kind-loan)', soft: 'var(--n-kind-loan-soft)' },
  save: { label: 'Quỹ tiết kiệm', cat: 'QUỸ TIẾT KIỆM', icon: 'piggyBank', color: 'var(--n-kind-save)', soft: 'var(--n-kind-save-soft)' },
  lend: { label: 'Cho vay', cat: 'CHO VAY', icon: 'handCoins', color: 'var(--n-kind-lend)', soft: 'var(--n-kind-lend-soft)' },
};
const ADD_KINDS = ['bill', 'card', 'loan', 'save', 'lend'];
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const daysTo = (today, iso) => daysInclusive(today, iso) - 1;
const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

/** Khoản vay đã xong: trả đều đủ kỳ, hoặc chỉ-trả-lãi đủ kỳ VÀ đã tất toán gốc. */
function loanCompleted(loan, txs) {
  if (loan.closed_at) return true;
  const sch = loanSchedule(loan);
  if (!sch.progress.total || sch.progress.done < sch.progress.total) return false;
  return sch.kind === 'amort' || txs.some(t => t.loan_id === loan.id && t.loan_part === 'principal');
}

/**
 * Những dòng không có nghĩa vụ trong tháng nhưng vẫn phải mở được để sửa, bật lại,
 * xem lịch sử hoặc xóa — bản cũ có đủ, rơi mất ở đây là mất luôn đường xóa.
 */
function archivedSections(fin) {
  const row = (kind, source, name, note) => ({ id: source.id, kind, name, sub: '', note, source, ev: null, progress: null, main: null });
  const lendLeft = (l) => l.principal - fin.transactions.filter(t => t.lending_id === l.id).reduce((s, t) => s + t.amount, 0);
  return [
    { key: 'off', label: 'Hóa đơn đang tắt', items: fin.bills.filter(b => !b.finished_at && !b.enabled)
      .map(b => row('bill', b, b.name, 'đang tắt')) },
    { key: 'finished', label: 'Hóa đơn đã kết thúc', items: fin.bills.filter(b => b.finished_at)
      .map(b => row('bill', b, b.name, `hoàn tất ${dmy(b.finished_at.slice(0, 10))}`)) },
    { key: 'loanDone', label: 'Khoản vay đã tất toán', items: fin.loans.filter(l => loanCompleted(l, fin.transactions))
      .map(l => row('loan', l, l.name, 'đã tất toán')) },
    { key: 'lendDone', label: 'Cho vay đã thu xong', items: fin.lendings.filter(l => lendLeft(l) <= 0)
      .map(l => row('lend', l, l.name, 'đã thu đủ gốc')) },
  ].filter(s => s.items.length);
}

/** Một dòng danh sách: ngày · icon · tên + tiến độ · số tiền + trạng thái. */
function HubRow({ item, today, selected, onPick, rowRef }) {
  const meta = KIND_META[item.kind];
  const { ev } = item;
  const st = ev?.state;
  const done = st === 'paid' || st === 'skip' || !ev && !item.main;
  const verb = item.kind === 'lend' ? 'Đã đưa' : item.kind === 'save' ? 'Đã góp' : 'Đã trả';
  const due = st === 'due' ? dueState({ days: daysTo(today, ev.due) }) : null;
  const stText = !ev ? item.note
    : st === 'paid' ? (ev.paidOn ? `${verb} ${ev.paidOn}` : verb)
    : st === 'skip' ? 'Bỏ kỳ này' : due.text;
  const tone = st === 'paid' ? 'paid' : due?.tone || 'wait';
  // Hạn ngoài tháng đang xem (sao kê chốt cuối tháng, kỳ lỡ từ tháng trước) thì dòng
  // dưới ghi THÁNG thay cho thứ — "5 · T4" đọc như mùng 5 tháng này.
  const sameMonth = ev && ev.due.slice(0, 7) === today.slice(0, 7);
  return (
    <button type="button" ref={rowRef} onClick={onPick}
      className={`fin-hub__row${selected ? ' is-selected' : ''}${done ? ' is-done' : ''}`}
      style={{ '--tile-color': meta.color, '--tile-soft': meta.soft }}
      aria-current={selected ? 'true' : undefined}>
      <div className="fin-hub__row-date">
        <span className="fin-hub__row-day">{ev ? ev.day : '—'}</span>
        <span className="fin-hub__row-wd">{!ev ? '' : sameMonth
          ? WEEKDAYS[new Date(`${ev.due}T00:00:00`).getDay()] : `T${Number(ev.due.slice(5, 7))}`}</span>
      </div>
      <span className="fin-hub__row-icon">
        <AppIcon name={item.kind === 'bill' ? item.source.icon || meta.icon : meta.icon} size={16} />
      </span>
      <div className="fin-hub__row-meta">
        <span className="fin-hub__row-name">{item.name}</span>
        <span className="fin-hub__row-sub">{item.sub}</span>
      </div>
      <div className="fin-hub__row-prog">
        {item.progress && <>
          <div className="fin-hub__row-prog-track">
            <span className={`fin-hub__row-prog-fill${item.progress.tone ? ` is-${item.progress.tone}` : ''}`} style={{ width: `${item.progress.pct || 0}%` }} />
          </div>
          <span className="fin-hub__row-prog-text">{item.progress.label}</span>
        </>}
      </div>
      <div className="fin-hub__row-amt">
        <span className="fin-hub__row-val">{ev
          ? `${ev.approx ? '~ ' : ''}${money(ev.amount)}`
          : item.main ? money(item.main) : ''}</span>
        <span className={`fin-hub__row-state fin-hub__row-state--${tone}`}>
          {st === 'due' && <span className="fin-hub__row-stdate">{dmy(ev.due).slice(0, 5)} · </span>}{stText}</span>
      </div>
    </button>
  );
}

export default function RecurringScreen({ fin, nav }) {
  const { pendingTasks } = useUserTasks();
  const [filter, setFilter] = useState(() => SEG_TO_KIND[nav.recurringSeg] || 'all');
  // Deep link đổi segment khi màn đang mở (Dashboard → tab Thẻ) thì bộ lọc theo luôn.
  const [prevSeg, setPrevSeg] = useState(nav.recurringSeg);
  if (nav.recurringSeg !== prevSeg) {
    setPrevSeg(nav.recurringSeg);
    if (SEG_TO_KIND[nav.recurringSeg]) setFilter(SEG_TO_KIND[nav.recurringSeg]);
  }
  const [selectedId, setSelectedId] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [openArchive, setOpenArchive] = useState(null);
  // Hộp thoại Thêm/Sửa: { kind, initial, focusNote }. Nhân bản = Thêm với `initial` là bản
  // nháp chỉ chép QUY TẮC (billDraft), chưa ghi gì xuống DB.
  const [modal, setModal] = useState(null);
  // Form đang gõ dở: đóng nó phải hỏi trước, bấm nhầm một cái là mất sạch.
  const [dirty, setDirty] = useState(false);
  const [payId, setPayId] = useState(null);   // mỗi lúc chỉ một khối trả
  const [openSavings, setOpenSavings] = useState(false);
  const rowRefs = useRef(new Map());

  const items = buildHubItems(fin);
  const totals = hubTotals(items, fin.today.slice(0, 7));
  const calDays = calendarDays(items, fin.today);
  const groups = groupHubItems(items, fin.today, filter);
  const archive = archivedSections(fin).map(s => ({
    ...s, items: filter === 'all' ? s.items : s.items.filter(i => i.kind === filter),
  })).filter(s => s.items.length);
  const visible = groups.filter(g => g.key !== 'done' || showDone).flatMap(g => g.items);
  const selected = [...items, ...archive.flatMap(s => s.items)].find(i => i.id === selectedId) || visible[0] || null;
  const sheetOpen = Boolean(selectedId);

  const openModal = (next) => { setDirty(false); setModal(next); };
  const closeModal = async () => {
    if (dirty && !await nav.confirmDiscard()) return;
    setModal(null); setDirty(false);
  };
  const pick = (id) => { setSelectedId(id); setPayId(null); };
  const closeSheet = () => { setSelectedId(null); setPayId(null); };

  // Sheet mobile: Escape đóng như mọi lớp phủ khác. Desktop thì panel là cột cố định,
  // Escape ở đó chỉ làm mất khối trả đang gõ dở. Hộp thoại tự lo Escape của nó.
  useEffect(() => {
    if (!sheetOpen || modal) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && isMobile()) closeSheet(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Kỳ KHÔNG phải lúc nào cũng là tháng đang chạy: `billCycle` là chỗ duy nhất biết.
  const cycleOf = (bill) => billCycle(bill, fin.today, billSettled(bill, fin.transactions));
  const periodOf = (bill) => cycleOf(bill).period;

  // ── Hành động. Bốn lệnh xóa đều qua modal dùng chung (contract test đếm đủ 4). ──
  const act = {
    periodsFor: (bill) => billPeriods(bill, periodOf(bill)).map((key, i) => ({
      key,
      label: i === 0 ? `Kỳ này · ${key.slice(5)}/${key.slice(2, 4)}` : `${key.slice(5)}/${key.slice(2, 4)}`,
      done: fin.transactions.some(t => t.bill_id === bill.id && t.bill_period === key),
    })),
    payBill: async (bill, payload) => {
      const tx = await fin.payBill(bill, { ...payload, period: payload.period || periodOf(bill) });
      nav.showToast(tx ? `Đã ghi ${bill.name} — giờ là giao dịch bình thường, lên báo cáo` : `Không thể ghi ${bill.name}. Kiểm tra dữ liệu Finance rồi thử lại.`, { icon: tx ? 'note' : 'warning' });
      return !!tx;
    },
    skipBill: async (bill) => {
      const skipped = await fin.skipBillPeriod(bill.id, periodOf(bill));
      nav.showToast(skipped
        ? `Đã bỏ kỳ này của ${bill.name} — không sinh giao dịch, kỳ sau vẫn nhắc`
        : `Không thể bỏ kỳ này của ${bill.name}. Kiểm tra dữ liệu Finance rồi thử lại.`,
      { icon: skipped ? 'skip' : 'warning' });
    },
    // RPC finance_skip_bill_period chỉ THÊM kỳ vào skipped_periods — đường gỡ duy nhất là đây.
    unskipBill: async (bill) => {
      const rest = (bill.skipped_periods || []).filter(p => p !== periodOf(bill));
      const updated = await fin.updateBill(bill.id, { skipped_periods: rest });
      nav.showToast(updated
        ? `Đã bỏ đánh dấu — ${bill.name} hiện lại nút Thanh toán cho kỳ này`
        : `Không thể bỏ đánh dấu ${bill.name}. Kiểm tra dữ liệu Finance rồi thử lại.`,
      { icon: updated ? 'refresh' : 'warning' });
    },
    toggleBill: async (bill, enabled) => {
      const updated = await fin.updateBill(bill.id, { enabled });
      nav.showToast(updated
        ? enabled ? `Đã bật lại ${bill.name}` : `Đã tắt ${bill.name} — dữ liệu cũ vẫn được giữ nguyên`
        : `Không thể cập nhật ${bill.name}. Kiểm tra dữ liệu Finance rồi thử lại.`,
      { icon: updated ? 'receipt' : 'warning' });
    },
    duplicateBill: (bill) => {
      setPayId(null); openModal({ kind: 'bill', initial: billDraft(bill) });
      nav.showToast(`Đã chép quy tắc của ${bill.name} — sửa rồi bấm Tạo hóa đơn. Lịch sử các kỳ không chép theo.`, { icon: 'copy' });
    },
    removeBill: async (bill) => {
      const kept = fin.transactions.filter(t => t.bill_id === bill.id).length;
      const ok = await nav.confirmDelete(`hóa đơn “${bill.name}”`,
        `Hóa đơn chỉ là quy tắc nhắc. ${kept > 0 ? `${kept} giao dịch đã ghi vẫn được giữ lại ở màn Giao dịch.` : 'Chưa có giao dịch nào sinh ra từ hóa đơn này.'}`);
      if (!ok) return;
      // Từ v6.9.0 giao dịch chỉ bị gỡ khỏi hóa đơn (bill_id/bill_period về NULL), không bị xóa.
      if (!await fin.deleteBill(bill.id)) {
        nav.showToast(`Không thể xóa ${bill.name}. Kiểm tra dữ liệu Finance rồi thử lại.`, { icon: 'warning' });
      } else setSelectedId(null);
    },
    removeLoan: async (l) => {
      const kept = fin.transactions.filter(t => t.loan_id === l.id).length;
      if (!await nav.confirmDelete(`khoản vay “${l.name}”`,
        kept > 0 ? `${kept} giao dịch đã ghi vẫn được giữ lại ở màn Giao dịch.` : 'Chưa có kỳ nào được ghi.')) return;
      if (!await fin.deleteLoan(l.id)) {
        nav.showToast(`Không thể xóa ${l.name}. Kiểm tra dữ liệu Finance rồi thử lại.`, { icon: 'warning' });
      } else setSelectedId(null);
    },
    removeCard: async (c) => {
      const kept = fin.transactions.filter(t => t.card_id === c.id || t.source_card_id === c.id).length;
      // Khoản đã quẹt bằng thẻ mất `source_card_id` nên `source_kind` tự về 'cash' — nói trước.
      if (!await nav.confirmDelete(`thẻ “${c.name}”`,
        kept > 0 ? `${kept} giao dịch vẫn được giữ lại; khoản đã quẹt bằng thẻ này sẽ tính là chi tiền mặt.`
          : 'Chưa có giao dịch nào gắn với thẻ này.')) return;
      if (!await fin.deleteCard(c.id)) {
        nav.showToast(`Không thể xóa ${c.name}. Kiểm tra dữ liệu Finance rồi thử lại.`, { icon: 'warning' });
      } else setSelectedId(null);
    },
    // Giao dịch thu về là income + excluded, DB chỉ cho cặp đó khi còn lending_id —
    // khoản đã có lần thu KHÔNG xóa được; nói thẳng thay vì hứa suông.
    removeLending: async (l, kept) => {
      if (!await nav.confirmDelete(`khoản cho vay “${l.name}”`,
        kept > 0 ? `${kept} giao dịch thu về đang gắn với khoản này. Phải xóa chúng ở màn Giao dịch trước, không thì database từ chối lệnh xóa.`
          : 'Chưa có lần thu nào được ghi.')) return;
      if (!await fin.deleteLending(l.id)) {
        nav.showToast(kept > 0
          ? `Chưa xóa được ${l.name} vì còn ${kept} giao dịch thu về. Xóa các giao dịch đó trước.`
          : `Không thể xóa ${l.name}. Kiểm tra dữ liệu Finance rồi thử lại.`, { icon: 'warning' });
      } else setSelectedId(null);
    },
    /**
     * Một lần họ trả có thể gồm cả gốc và lãi — hai loại tiền khác nhau nên đi hai đường:
     * gốc qua RPC (income + excluded, gắn `lending_id`), lãi là THU NHẬP THẬT nên đứng riêng.
     * ponytail: lãi chưa gắn `lending_id` → chưa tổng được "đã thu lãi bao nhiêu";
     * cần con số đó thì nới `finance_tx_lending_scope` bằng một migration mới.
     */
    recordLending: async (l, { amount, interest = 0, occurredAt, taskId }) => {
      const interestPart = Math.min(interest, amount);
      const principalPart = amount - interestPart;
      if (principalPart > 0 && !await fin.recordLendingRepayment(l, { amount: principalPart, occurredAt, taskId })) {
        nav.showToast(`Không thể ghi khoản thu về từ ${l.name}. Kiểm tra dữ liệu Finance rồi thử lại.`, { icon: 'warning' });
        return false;
      }
      // Hai lệnh ghi không cùng transaction: gốc xong mà lãi lỗi thì nói thẳng số còn thiếu.
      if (interestPart > 0 && !await fin.addTransaction({
        type: 'income', amount: interestPart, occurred_at: occurredAt, task_id: taskId || null,
        category_id: 'dautu', subcategory_id: 'dautu.interest', note: `Lãi cho vay · ${l.name}`,
      })) {
        nav.showToast(`Đã ghi ${money(principalPart)} tiền gốc nhưng chưa ghi được ${money(interestPart)} tiền lãi — thêm tay ở màn Giao dịch.`, { icon: 'warning' });
        return false;
      }
      nav.showToast(interestPart > 0
        ? `Đã ghi ${money(amount)} từ ${l.name} — ${money(interestPart)} lãi tính là thu nhập, ${money(principalPart)} gốc thì không`
        : `Đã ghi ${money(amount)} thu về từ ${l.name} — không tính là thu nhập`, { icon: 'handCoins' });
      return true;
    },
  };


  // Tải xong mới biết có bao nhiêu dòng; dùng `hasLoaded` chứ không phải `isLoading`.
  if (!fin.hasLoaded) return <SkeletonList rows={5} label="Đang tải nghĩa vụ" />;

  if (openSavings) {
    return (
      <div className="fin-hub fin-hub--savings">
        <button type="button" className="fin-btn fin-btn--ghost fin-btn--sm fin-hub__back" onClick={() => setOpenSavings(false)}>
          <AppIcon name="caretLeft" size={14} /> Định kỳ & Quỹ
        </button>
        <SavingsWorkspace fin={fin} nav={nav} />
      </div>
    );
  }

  const [yStr, mStr] = fin.today.split('-');
  const pickFilter = (k) => {
    setFilter(k);
    if (KIND_TO_SEG[k]) nav.setRecurringSeg(KIND_TO_SEG[k]);
  };
  const startAdd = () => openModal({ kind: filter === 'all' ? 'bill' : filter, initial: null });
  const doneCount = groups.find(g => g.key === 'done')?.items.length || 0;
  const detailProps = { fin, nav, tasks: pendingTasks, act, payId, setPayId, onClose: closeSheet,
    onEdit: (focusNote = false) => { setPayId(null); openModal({ kind: selected.kind, initial: selected.source, focusNote }); } };

  return (
    <div className="fin-hub">
      {/* 6 ô vừa là số liệu vừa là bộ lọc */}
      <div className="fin-hub__tiles">
        {Object.entries(KIND_META).map(([k, meta]) => {
          const t = totals[k];
          return (
            <button type="button" key={k} className={`fin-hub__tile${filter === k ? ' is-active' : ''}`}
              style={{ '--tile-color': meta.color, '--tile-soft': meta.soft }}
              aria-pressed={filter === k} onClick={() => pickFilter(k)}>
              <div className="fin-hub__tile-top">
                <span className="fin-hub__tile-icon"><AppIcon name={meta.icon} size={14} /></span>
                <span className="fin-hub__tile-label">{meta.label}</span>
                <span className="fin-hub__tile-count">{t.count}</span>
              </div>
              <div className="fin-hub__tile-body">
                <span className="fin-hub__tile-value">{money(t.value)}</span>
                <span className="fin-hub__tile-sub">{t.sub}</span>
              </div>
              <div className="fin-hub__tile-foot">
                <span className="fin-hub__tile-progress">
                  <span className="fin-hub__tile-progress-bar" style={{ width: `${Math.round(t.pct * 100)}%` }} />
                </span>
                <span className="fin-hub__tile-cap">{t.cap}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Lịch chi tháng — chỉ tiền ra. Bản chốt bỏ thanh tiêu đề trang: tháng và nút Thêm
          nằm ở đây. Mũi tên đổi tháng chưa có: mọi phép tính kỳ đang neo vào hôm nay. */}
      <div className="fin-hub__cal">
        <div className="fin-hub__cal-head">
          <span className="fin-hub__month"><span className="fin-hub__month-pre">Lịch chi </span>tháng {Number(mStr)}/{yStr}</span>
          <span className="fin-hub__cal-sub">{totals.all.dueCount} kỳ cần trả · {money(totals.all.value)}</span>
          <div className="fin-hub__cal-legend">
            <span className="fin-hub__cal-legend-item"><span className="fin-hub__cal-swatch fin-hub__cal-swatch--due" /> Cần trả</span>
            <span className="fin-hub__cal-legend-item"><span className="fin-hub__cal-swatch fin-hub__cal-swatch--paid" /> Đã xong</span>
            <span className="fin-hub__cal-legend-item"><span className="fin-hub__cal-swatch fin-hub__cal-swatch--skip" /> Bỏ kỳ</span>
          </div>
          <span className="fin-hub__cal-divider" />
          <button type="button" className="fin-btn fin-btn--primary fin-btn--sm fin-hub__add" aria-label="Thêm nguồn chi" onClick={startAdd}>
            <AppIcon name="plus" size={14} /><span>Thêm nguồn chi</span>
          </button>
        </div>
        <div className="fin-hub__cal-grid" style={{ gridTemplateColumns: `repeat(${calDays.length}, minmax(0, 1fr))` }}>
          {calDays.map(dy => (
            <div key={dy.day} className={`fin-hub__cal-day${dy.isToday ? ' is-today' : ''}${dy.isPast ? ' is-past' : ''}`}>
              <div className="fin-hub__cal-chips">
                {dy.chips.map(chip => {
                  const chipMeta = KIND_META[chip.kind];
                  const stLabel = chip.state === 'paid' ? 'đã xong' : chip.state === 'skip' ? 'bỏ kỳ' : 'cần trả';
                  return (
                    <button type="button" key={chip.id}
                      className={`fin-hub__cal-chip fin-hub__cal-chip--${chip.state}${selected?.id === chip.id ? ' is-selected' : ''}`}
                      style={{ '--chip-color': chipMeta.color, opacity: filter === 'all' || chip.kind === filter ? 1 : 0.22 }}
                      title={`${chip.name} · ${money(chip.amount)}`}
                      aria-label={`${chip.name} · ${money(chip.amount)} · ${stLabel}`}
                      onClick={() => {
                        pick(chip.id);
                        rowRefs.current.get(chip.id)?.scrollIntoView({ block: 'nearest' });
                      }}>
                      <AppIcon name={chip.kind === 'bill' ? items.find(i => i.id === chip.id)?.source.icon || chipMeta.icon : chipMeta.icon} size={11} />
                    </button>
                  );
                })}
              </div>
              <div className="fin-hub__cal-date">
                <span>{dy.day}</span><span className="fin-hub__cal-weekday">{dy.weekday}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="fin-hub__body">
        <div className="fin-hub__list">
          {items.length === 0 && archive.length === 0 && (
            <RulesEmpty icon="calendar" title="Chưa có nguồn chi nào"
              description="Thêm hóa đơn, thẻ, khoản vay, cho vay hoặc quỹ để theo dõi ngày đến hạn trong tháng." />
          )}
          {groups.filter(g => g.key !== 'done' || showDone).map(g => (
            <div key={g.key} className="fin-hub__group">
              <div className="fin-hub__group-head">
                <span className="fin-hub__group-label">{g.label}</span>
                {g.total > 0 && <span className="fin-hub__group-sum">{money(g.total)}</span>}
              </div>
              <div className="fin-hub__group-items">
                {g.items.map(it => (
                  <HubRow key={it.id} item={it} today={fin.today} selected={selected?.id === it.id}
                    rowRef={el => rowRefs.current.set(it.id, el)} onPick={() => pick(it.id)} />
                ))}
              </div>
            </div>
          ))}
          {doneCount > 0 && (
            <button type="button" className="fin-hub__toggle-done" aria-expanded={showDone} onClick={() => setShowDone(v => !v)}>
              <AppIcon name={showDone ? 'caretUp' : 'caretDown'} size={14} />
              {showDone ? 'Ẩn khoản đã xong' : `Xem ${doneCount} khoản đã xong tháng này`}
            </button>
          )}
          {archive.map(s => (
            <div key={s.key} className="fin-history-section fin-hub__archive">
              <button type="button" className="fin-history-section__toggle" aria-expanded={openArchive === s.key}
                onClick={() => setOpenArchive(v => (v === s.key ? null : s.key))}>
                <div className="fin-history-section__left">
                  <AppIcon name={openArchive === s.key ? 'caretDown' : 'caretRight'} size={14} />
                  <span className="fin-history-section__title">{s.label}</span>
                  <span className="fin-history-section__badge">{s.items.length}</span>
                </div>
              </button>
              {openArchive === s.key && (
                <div className="fin-history-section__content">
                  {s.items.map(it => (
                    <HubRow key={it.id} item={it} today={fin.today} selected={selected?.id === it.id}
                      rowRef={el => rowRefs.current.set(it.id, el)} onPick={() => pick(it.id)} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className={`fin-hub__detail${sheetOpen ? ' is-open' : ''}`}>
          <div className="fin-hub__detail-handle" />
          {!selected ? (
            <RulesEmpty icon="calendar" title="Chưa chọn nguồn chi" description="Chọn một dòng ở danh sách để xem chi tiết và thao tác." />
          ) : (<>
            {selected.kind === 'bill' && <BillDetail key={selected.id} bill={selected.source} {...detailProps} />}
            {selected.kind === 'card' && <CardDetail key={selected.id} card={selected.source} {...detailProps} />}
            {selected.kind === 'loan' && <LoanDetail key={selected.id} loan={selected.source} {...detailProps} />}
            {selected.kind === 'lend' && <LendDetail key={selected.id} lending={selected.source} {...detailProps} />}
            {selected.kind === 'save' && <SaveDetail key={selected.id} goal={selected.source} {...detailProps}
              onOpenSavings={() => setOpenSavings(true)} />}
          </>)}
        </div>
      </div>
      <div className={`fin-hub__detail-backdrop${sheetOpen ? ' is-open' : ''}`} onClick={closeSheet} />

      {modal && <SourceModal key={`${modal.kind}:${modal.initial?.id || 'new'}`} kind={modal.kind} initial={modal.initial}
        focusNote={modal.focusNote} fin={fin} nav={nav} onDirty={setDirty} onClose={closeModal}
        onSaved={() => { setModal(null); setDirty(false); }} />}
    </div>
  );
}

// ── Khung chi tiết dùng chung ────────────────────────────────────────────────
function DetailHead({ kind, icon, title, sub, hasNote, onEdit, onClose }) {
  const meta = KIND_META[kind];
  return (
    <div className="fin-hub__detail-head">
      <span className="fin-hub__detail-icon" style={{ background: meta.soft, color: meta.color }}>
        <AppIcon name={icon || meta.icon} size={21} />
      </span>
      <div className="fin-hub__detail-titlebox">
        <span className="fin-hub__detail-cat" style={{ color: meta.color }}>{meta.cat}</span>
        <span className="fin-hub__detail-name">{title}
          {/* aria-label trên AppIcon là vô hiệu (AppIcon tự aria-hidden) — chữ phải ở node thật. */}
          {hasNote && <><AppIcon name="note" size={13} className="fin-rule__notedot" /><span className="sr-only">Có ghi chú</span></>}</span>
        {sub && <span className="fin-hub__detail-sub">{sub}</span>}
      </div>
      {onEdit && (
        <button type="button" className="fin-hub__detail-edit" aria-label={`Sửa ${title}`} onClick={() => onEdit()}>
          <AppIcon name="pencil" size={13} /><span>Sửa</span>
        </button>
      )}
      <button type="button" className="fin-icon-btn fin-hub__detail-close" aria-label="Đóng" onClick={onClose}>
        <AppIcon name="x" size={15} />
      </button>
    </div>
  );
}

function AmountBox({ caption, value, state, note }) {
  const icon = { paid: 'checkCircle', off: 'skip', wait: 'clock', due: 'clock', late: 'warning', over: 'warning' }[state?.tone] || 'calendar';
  return (
    <div className="fin-hub__detail-amtbox">
      <span className="fin-hub__detail-amt-cap">{caption}{note && <InfoTip label="Cách app tính các số này">{note}</InfoTip>}</span>
      <span className="fin-hub__detail-amt-val">{value}</span>
      {state?.text && (
        <span className={`fin-hub__detail-amt-state fin-hub__row-state--${state.tone}`}>
          <AppIcon name={icon} size={14} /> {state.text}
        </span>
      )}
    </div>
  );
}

/** Khối tiến độ: nhãn + % · thanh · hai mốc hai đầu. */
function ProgressBox({ label, pct, left, right }) {
  const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
  return (
    <div className="fin-hub__progbox">
      <div className="fin-hub__progbox-head"><span>{label}</span><b>{p}%</b></div>
      <span className="fin-hub__progbox-bar"><span style={{ width: `${p}%` }} /></span>
      <div className="fin-hub__progbox-foot"><span>{left}</span><span>{right}</span></div>
    </div>
  );
}

/**
 * 6 kỳ gần nhất. Kỳ ĐỨNG TRƯỚC ngày ghi trong tooltip: gắn nhầm kỳ là hóa đơn báo
 * quá hạn dù tiền đã ra khỏi ví — sửa kỳ ở màn Giao dịch, mục "Thuộc kỳ".
 */
function HistoryChart({ history }) {
  if (!history) return null;
  const max = Math.max(1, ...history.bars.map(b => b.amount));
  return (
    <div className="fin-hub__hist">
      <div className="fin-hub__hist-head"><strong>{history.bars.length} kỳ gần nhất</strong><span>Trung bình {money(history.avg)}</span></div>
      <div className="fin-hub__hist-bars">
        {history.bars.map((b, i) => (
          <div key={b.period} className={`fin-hub__hist-col${i === history.bars.length - 1 ? ' is-last' : ''}`}
            title={`Kỳ ${b.period.slice(5)}/${b.period.slice(0, 4)} · ${money(b.amount)}`}>
            <span>{shortMoney(b.amount)}</span>
            <i style={{ height: `${Math.max(8, Math.round(b.amount / max * 64))}px` }} />
            <small>{b.label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

const KV = ({ rows }) => (
  <div className="fin-hub__kv-table">
    {rows.filter(Boolean).map(([k, v], i) => (
      <div key={i} className="fin-hub__kv-row"><span className="fin-hub__kv-key">{k}</span><span className="fin-hub__kv-val">{v}</span></div>
    ))}
  </div>
);

const weekdayOf = (iso) => WEEKDAYS[new Date(`${iso}T00:00:00`).getDay()];

// ── Hóa đơn ──────────────────────────────────────────────────────────────────
function BillDetail({ fin, tasks, act, bill: b, payId, setPayId, onEdit, onClose }) {
  const isFinished = Boolean(b.finished_at);
  const cyc = billCycle(b, fin.today, billSettled(b, fin.transactions));
  const paidTx = cyc && fin.transactions.find(t => t.bill_id === b.id && t.bill_period === cyc.period);
  const paid = Boolean(paidTx);
  const skipped = Boolean(cyc) && (b.skipped_periods || []).includes(cyc.period);
  const estimate = billAmountEstimate(b, fin.transactions);
  const state = isFinished
    ? { tone: 'paid', text: `đã hoàn tất ${dmy(b.finished_at.slice(0, 10))}` }
    : dueState({
        days: cyc?.days, enabled: b.enabled, done: paid, skipped,
        doneText: paidTx ? `Đã trả ngày ${dmy(paidTx.occurred_at)}` : null,
      });
  // Hóa đơn tắt, đã trả hoặc đã bỏ kỳ thì không có thao tác thanh toán.
  const actionable = b.enabled && !paid && !skipped;
  // Trả SỚM thì được: nút có mặt từ đầu kỳ, không đợi tới ngày đến hạn.
  const canPay = actionable && !isFinished && Boolean(cyc);
  const left = b.term_total ? Math.max(0, b.term_total - (b.term_done || 0)) : 0;
  const periodLabel = cyc ? `${cyc.period.slice(5)}/${cyc.period.slice(0, 4)}` : '';

  return (
    <>
      <DetailHead kind="bill" icon={b.icon} title={b.name} hasNote={!!b.note}
        sub={[b.provider, b.customer_code].filter(Boolean).join(' · ') || cycleLabel(b)}
        onEdit={isFinished ? null : onEdit} onClose={onClose} />

      <AmountBox caption={cyc ? `${cyc.thisMonth ? 'Kỳ' : cyc.days < 0 ? 'Kỳ lỡ' : 'Kỳ sau'} ${periodLabel}` : 'Hóa đơn'}
        value={b.amount_mode === 'ask' ? (estimate ? `~ ${money(estimate)}` : 'hỏi mỗi kỳ') : money(b.amount)}
        state={state} />

      {canPay && payId !== b.id && (
        <div className="fin-hub__detail-actions">
          <button type="button" className="fin-btn fin-btn--primary fin-hub__primary" onClick={() => setPayId(b.id)}>
            <AppIcon name="checkCircle" size={16} /> {b.term_total ? `Thanh toán kỳ ${(b.term_done || 0) + 1}/${b.term_total}` : `Thanh toán kỳ ${periodLabel}`}
          </button>
          <button type="button" className="fin-btn fin-btn--ghost fin-hub__secondary" onClick={() => act.skipBill(b)}>Bỏ kỳ này</button>
        </div>
      )}
      {/* RPC bỏ kỳ chỉ THÊM vào skipped_periods — không có nút này thì bấm nhầm là kẹt tới tháng sau.
          Đã TRẢ thì không có nút gỡ: hủy một lần trả là xóa giao dịch, làm ở màn Giao dịch. */}
      {skipped && b.enabled && !isFinished && (
        <button type="button" className="fin-btn fin-btn--ghost fin-btn--sm fin-hub__undo" onClick={() => act.unskipBill(b)}>
          <AppIcon name="refresh" size={13} /> Bỏ đánh dấu
        </button>
      )}
      {payId === b.id && <PayBlock fin={fin} tasks={tasks} allowSource dueDay={b.due_day} periods={act.periodsFor(b)}
        periodForDate={(date) => billPeriodForDate(b, date)}
        defaultAmount={estimate || ''} onCancel={() => setPayId(null)} onPay={(payload) => act.payBill(b, payload)}
        note={b.amount_mode === 'ask'
          ? 'Số điền sẵn là mức trung bình 3 kỳ gần nhất — sửa lại theo hóa đơn thật trước khi xác nhận.'
          : 'Số cố định theo hóa đơn — sửa nếu kỳ này khác. Ngày mặc định là hôm nay; nếu bạn đã trả từ mấy ngày trước thì chọn đúng ngày đó để báo cáo không lệch tháng.'} />}

      {b.term_total > 0 && <ProgressBox label={`Kỳ ${b.term_done || 0} / ${b.term_total}`} pct={(b.term_done || 0) / b.term_total * 100}
        left={`Đã trả ${money((b.term_done || 0) * estimate)}${b.term_offset ? ` · ${b.term_offset} kỳ trước khi dùng app` : ''}`}
        right={`Còn ${money(left * estimate)}`} />}

      <HistoryChart history={periodHistory({ id: b.id, kind: 'bill' }, fin.transactions)} />
      <BillNote bill={b} onEdit={() => onEdit(true)} />

      <KV rows={[
        b.provider && ['Nhà cung cấp', b.provider],
        b.customer_code && ['Mã khách hàng', b.customer_code],
        cyc && ['Ngày', `${dmy(cyc.due)} · ${weekdayOf(cyc.due)}`],
        ['Lặp lại', everyOf(b) === 1 ? 'Hằng tháng' : everyOf(b) === 12 ? 'Mỗi năm' : `Mỗi ${everyOf(b)} tháng`],
        ['Danh mục', catInfo(b.category_id, fin.cats).label],
      ]} />

      <div className="fin-hub__detail-tools">
        <button type="button" className="fin-btn fin-btn--ghost fin-btn--sm" onClick={() => act.duplicateBill(b)}>
          <AppIcon name="copy" size={14} /> Nhân bản
        </button>
        {!isFinished && <Toggle on={b.enabled} onChange={(on) => act.toggleBill(b, on)} ariaLabel={`Bật ${b.name}`} />}
        <button type="button" className="fin-btn fin-btn--ghost fin-btn--sm fin-hub__danger" onClick={() => act.removeBill(b)}>
          <AppIcon name="trash" size={14} /> Xóa
        </button>
      </div>

      <details className="fin-explain">
        <summary><AppIcon name="question" size={14} /> “Kỳ” được tính thế nào</summary>
        <ul>
          <li><strong>Kỳ là khoảng nghĩa vụ, không phải ngày bạn trả.</strong> Hóa đơn hằng tháng thì mỗi
            tháng một kỳ. Hóa đơn 2/3/6/12 tháng thì <em>Ngày bắt đầu trả</em> quyết định tháng nào tới
            lượt, còn <em>Ngày trả</em> quyết định ngày trong tháng đó.</li>
          <li><strong>Ghi tiền: kỳ tự chạy theo ngày trả</strong> — app chọn mốc kỳ gần ngày đó nhất. Bấm
            một kỳ trong hàng <em>Ghi vào kỳ</em> nếu muốn tự quyết.</li>
          <li><strong>Trả xong một kỳ thì im tới kỳ kế</strong>. Nhưng kỳ bị <em>lỡ</em> thì vẫn nằm ở nhóm
            Quá hạn cho tới khi trả hoặc bấm “Bỏ kỳ này”.</li>
          <li><strong>Lỡ ghi nhầm kỳ?</strong> Vào Giao dịch, mở khoản đó, bấm Sửa rồi đổi ô
            <em>Thuộc kỳ</em> — không cần xóa đi ghi lại.</li>
        </ul>
      </details>
    </>
  );
}

// ── Thẻ tín dụng ─────────────────────────────────────────────────────────────
function CardDetail({ fin, nav, tasks, act, card: c, payId, setPayId, onEdit, onClose }) {
  // Sao kê cần trả = kỳ vừa chốt + nợ kỳ cũ còn treo, không chỉ kỳ mới nhất.
  const cyc = cardStatementSummary(c, fin.transactions, fin.today);
  const carry = cardCarryOver(c, fin.transactions, fin.today);
  const balance = cardBalance(c.id, fin.transactions);
  const est = floatInterest(cyc.outstanding, cyc.floatDaysTotal, fin.blendedRate);
  const fee = nextAnnualFee(c.annual_fee_on, fin.today);
  const owed = cyc.outstanding + (carry?.amount || 0);
  const billed = owed > 0;
  const state = carry ? dueState({ days: carry.days })
    : cyc.outstanding > 0 ? dueState({ days: daysUntilDue(c.due_day, fin.today) })
    : balance > 0 ? { tone: 'wait', text: cyc.daysUntilNextStatement === 0 ? 'chốt hôm nay' : `chốt sau ${cyc.daysUntilNextStatement} ngày` }
    : { tone: 'paid', text: 'sao kê đã trả' };
  const periodLabel = `${cyc.period.slice(5)}/${cyc.period.slice(2, 4)}`;

  return (
    <>
      <DetailHead kind="card" title={`${c.name}${c.last4 ? ` ••${c.last4}` : ''}`}
        sub={[c.bank, `chốt ngày ${c.statement_day}`, `đến hạn ngày ${c.due_day}`].filter(Boolean).join(' · ')}
        onEdit={onEdit} onClose={onClose} />

      {/* Float = khoảng ngân hàng cho bạn giữ tiền từ lúc quẹt tới hạn trả. Con số ước lượng
          ở đây chỉ để hiểu, nên nằm trong ô giải thích chứ không chiếm một dải riêng. */}
      <AmountBox caption={billed ? 'Sao kê cần trả' : 'Tạm tính kỳ mới'} value={money(billed ? owed : cyc.unbilled || balance)} state={state}
        note={`Trả đủ sao kê ĐÚNG HẠN thì không mất lãi — trễ một ngày là ngân hàng tính lãi trên toàn bộ sao kê.${est > 0
          ? ` Giữ tiền tới ngày đến hạn thay vì trả ngay, với lãi gửi bình quân ${fin.blendedRate}%/năm, tiền đó sinh thêm ~${money(est)}.` : ''}`} />

      {(billed || balance > 0) && payId !== c.id && (
        <div className="fin-hub__detail-actions">
          <button type="button" className="fin-btn fin-btn--primary fin-hub__primary" onClick={() => setPayId(c.id)}>
            <AppIcon name="checkCircle" size={16} /> {billed ? 'Trả sao kê' : 'Trả sớm dư nợ'}
          </button>
        </div>
      )}
      {payId === c.id && <PayBlock fin={fin} tasks={tasks} dueDay={c.due_day} defaultAmount={billed ? owed : balance}
        confirmLabel={billed ? 'Xác nhận trả sao kê' : 'Xác nhận trả sớm'} onCancel={() => setPayId(null)}
        onPay={async (payload) => {
          const tx = await fin.payCardStatement(c, { ...payload, period: cyc.period });
          nav.showToast(tx ? 'Đã ghi trả sao kê — không phải chi mới, chỉ để lịch sử' : 'Không thể ghi trả sao kê. Kiểm tra dữ liệu Finance rồi thử lại.', { icon: tx ? 'creditCard' : 'warning' });
          return !!tx;
        }} />}

      <ProgressBox label="Hạn mức đã dùng" pct={c.credit_limit ? balance / c.credit_limit * 100 : 0}
        left={`Đã dùng ${money(balance)}`} right={`Hạn mức ${money(c.credit_limit)}`} />

      {carry && <div className="fin-inline-message fin-inline-message--warn">
        <AppIcon name="warning" size={15} weight="fill" />
        <span>Sao kê kỳ {carry.period.slice(5)}/{carry.period.slice(2, 4)} còn nợ {money(carry.amount)} — hạn {dmy(carry.due)} đã qua.
          Khoản trả nào cũng trừ vào nợ cũ trước.</span>
      </div>}

      <KV rows={[
        [`Sao kê kỳ ${periodLabel}`, money(cyc.statementTotal)],
        ['Đã trả', money(cyc.paid)],
        !billed && balance > 0 && ['Tạm tính kỳ mới', `${money(cyc.unbilled || balance)} · chốt ${dmy(cyc.nextStatement)}`],
        c.min_pct > 0 && billed && [`Trả tối thiểu (${c.min_pct}%)`, money(owed * c.min_pct / 100)],
        c.grace > 0 && ['Số ngày miễn lãi', `${c.grace} ngày`],
        c.annual_fee > 0 && ['Phí thường niên', `${money(c.annual_fee)}${fee ? ` · thu ${dmy(fee.date)}${fee.days <= 30 ? ` (còn ${fee.days} ngày)` : ''}` : ''}`],
        c.cash_advance_fee > 0 && ['Phí rút tiền mặt', `${money(c.cash_advance_fee)} — tránh`],
      ]} />

      <div className="fin-hub__detail-tools">
        <button type="button" className="fin-btn fin-btn--ghost fin-btn--sm fin-hub__danger" onClick={() => act.removeCard(c)}>
          <AppIcon name="trash" size={14} /> Xóa thẻ
        </button>
      </div>
    </>
  );
}

// ── Khoản vay ────────────────────────────────────────────────────────────────
function LoanDetail({ fin, nav, tasks, act, loan: l, payId, setPayId, onEdit, onClose }) {
  const sch = loanSchedule(l);
  // Kỳ tháng trước còn nợ thì bám nó (Dashboard đọc cùng hàm). null = đã đủ số kỳ.
  const cycle = loanCycle(l, fin.today, fin.transactions);
  const period = cycle?.period || fin.today.slice(0, 7);
  const d = cycle ? cycle.days : daysUntilDue(l.pay_day, fin.today);
  const paidInterest = fin.transactions.some(t => t.loan_id === l.id && t.loan_period === period && t.loan_part === 'interest');
  const paidPrincipal = fin.transactions.some(t => t.loan_id === l.id && t.loan_period === period && t.loan_part === 'principal');
  const donePeriod = cycle ? cycle.done : (sch.kind === 'interest' ? paidInterest : paidPrincipal);
  const principalDue = l.due_at && l.due_at <= fin.today;
  const isCompleted = loanCompleted(l, fin.transactions);
  const paidTx = cycle?.done && fin.transactions.find(t => t.loan_id === l.id && t.loan_period === period);
  const state = isCompleted ? { tone: 'paid', text: 'đã tất toán' }
    : !cycle && sch.kind === 'interest' ? { tone: principalDue ? 'late' : 'wait', text: principalDue ? 'tới hạn tất toán gốc' : 'đủ kỳ lãi · chờ tất toán gốc' }
    : dueState({ days: d, done: donePeriod, doneText: paidTx ? `Đã trả ngày ${dmy(paidTx.occurred_at)}` : 'đã ghi kỳ này' });
  const dueAmount = sch.kind === 'interest' ? sch.monthlyInterest : sch.monthlyPayment;
  const paidInterestTotal = fin.transactions.filter(t => t.loan_id === l.id && t.loan_part === 'interest').reduce((sum, t) => sum + t.amount, 0);
  // Lãi cả đời khoản vay: lãi-only trả đều mỗi kỳ; amort thì bằng tổng trả trừ gốc.
  const totalInterest = sch.kind === 'interest'
    ? sch.monthlyInterest * sch.progress.total
    : Math.max(0, sch.monthlyPayment * sch.progress.total - l.principal);
  const canSettle = sch.kind === 'interest' && principalDue && !paidPrincipal && !isCompleted;
  const canPayPeriod = Boolean(cycle) && !donePeriod && !isCompleted;

  return (
    <>
      <DetailHead kind="loan" title={l.name}
        sub={[l.lender, `gốc ${shortMoney(l.principal)}`, `${l.rate}%/năm`, sch.kind === 'interest' ? 'chỉ trả lãi' : 'trả đều gốc + lãi'].filter(Boolean).join(' · ')}
        onEdit={onEdit} onClose={onClose} />

      <AmountBox caption={cycle ? `Kỳ ${period.slice(5)}/${period.slice(0, 4)} · ngày ${l.pay_day}` : 'Mỗi kỳ'} value={money(dueAmount)} state={state}
        note="Khoản vay không phải hóa đơn: mỗi kỳ tách thành hai phần. Lãi là chi phí thật — ghi vào Tài chính & Nợ › Lãi & phí ngân hàng, lên báo cáo. Trả gốc không phải chi tiêu — nó chỉ chuyển tiền từ ví sang giảm dư nợ." />

      {payId !== l.id && payId !== `${l.id}:principal` && (canPayPeriod || canSettle) && (
        <div className="fin-hub__detail-actions">
          {canPayPeriod && <button type="button" className="fin-btn fin-btn--primary fin-hub__primary" onClick={() => setPayId(l.id)}>
            <AppIcon name="checkCircle" size={16} /> {sch.kind === 'interest' ? 'Trả lãi kỳ này' : 'Trả kỳ này'}
          </button>}
          {canSettle && <button type="button" className="fin-btn fin-btn--ghost fin-hub__secondary" onClick={() => setPayId(`${l.id}:principal`)}>
            Tất toán gốc
          </button>}
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

      <ProgressBox label={`Kỳ ${sch.progress.done} / ${sch.progress.total}`}
        pct={sch.progress.total ? sch.progress.done / sch.progress.total * 100 : 0}
        left={`Lãi đã trả ${money(paidInterestTotal)}`}
        right={l.due_at ? `Tất toán ${dmy(l.due_at)}` : `Còn ${Math.max(0, sch.progress.total - sch.progress.done)} kỳ`} />

      {sch.kind === 'interest' && !paidPrincipal && l.due_at && !isCompleted && principalDue && (
        <div className="fin-inline-message fin-inline-message--warn">
          <AppIcon name="warning" size={15} weight="fill" />
          <span>Đã tới ngày tất toán gốc {dmy(l.due_at)} — {money(sch.principalDue)} chưa ghi.</span>
        </div>
      )}

      <HistoryChart history={periodHistory({ id: l.id, kind: 'loan' }, fin.transactions)} />

      <KV rows={[
        [sch.kind === 'interest' ? 'Dư nợ gốc' : 'Dư nợ gốc còn lại', money(sch.kind === 'interest' ? sch.principalDue : sch.principalRemaining)],
        sch.kind === 'interest' ? ['Lãi mỗi kỳ', money(sch.monthlyInterest)] : ['Mỗi kỳ', `gốc ${money(sch.principalPart)} + lãi ${money(sch.interestPart)}`],
        ['Ngày trả', `Ngày ${l.pay_day} hằng tháng`],
        ['Tổng lãi cả khoản', `~${money(totalInterest)}`],
        ['Gốc', sch.kind === 'interest' ? 'Trả một lần khi tất toán' : 'Trả dần mỗi kỳ'],
        l.opened_at && ['Ngày vay', dmy(l.opened_at)],
      ]} />

      <div className="fin-hub__detail-tools">
        <button type="button" className="fin-btn fin-btn--ghost fin-btn--sm fin-hub__danger" onClick={() => act.removeLoan(l)}>
          <AppIcon name="trash" size={14} /> Xóa khoản vay
        </button>
      </div>
    </>
  );
}

// ── Cho vay (khoản phải thu) ─────────────────────────────────────────────────
// Cho mượn KHÔNG phải chi tiêu, họ trả lại KHÔNG phải thu nhập — chỉ đổi chỗ của tiền.
function LendDetail({ fin, tasks, act, lending: l, payId, setPayId, onEdit, onClose }) {
  const repayments = fin.transactions.filter(t => t.lending_id === l.id)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  const got = Math.min(l.principal, repayments.reduce((sum, t) => sum + t.amount, 0));
  const left = Math.max(0, l.principal - got);
  const done = left === 0;
  const days = l.due_on ? daysInclusive(fin.today, l.due_on) - 1 : null;
  const math = lendingInterest(l, repayments, fin.today);
  const overdue = days != null && days < 0;
  const state = done ? { tone: 'paid', text: `thu xong ${dmy(repayments.at(-1)?.occurred_at)}` }
    : days == null ? { tone: 'wait', text: 'không hẹn ngày' }
    : days <= -4 ? { tone: 'over', text: `quá hẹn ${Math.abs(days)} ngày` }
    : days < 0 ? { tone: 'late', text: `quá hẹn ${Math.abs(days)} ngày` }
    : days === 0 ? { tone: 'due', text: 'đến hẹn hôm nay' }
    : { tone: days <= 14 ? 'late' : 'wait', text: `hẹn ${dmy(l.due_on)} · còn ${days} ngày` };

  return (
    <>
      <DetailHead kind="lend" icon={done ? 'checkCircle' : null} title={l.name}
        sub={[l.note, `cho mượn ${dmy(l.lent_on)}`, l.rate > 0 ? `${l.rate}%/năm` : 'không lãi'].filter(Boolean).join(' · ')}
        onEdit={onEdit} onClose={onClose} />

      <AmountBox caption={done ? 'Đã thu đủ gốc' : 'Còn phải thu'} value={money(done ? l.principal : left)} state={state}
        note="Cho mượn không phải chi tiêu — tiền rời ví nhưng đổi thành khoản phải thu. Khi họ trả, tiền về ví và số này giảm đúng bằng đó — không tính là thu nhập. Chỉ phần lãi, nếu có, mới là thu nhập thật. Lãi tính theo NGÀY trên gốc còn lại." />

      {!done && payId !== l.id && (
        <div className="fin-hub__detail-actions">
          <button type="button" className="fin-btn fin-btn--primary fin-hub__primary" onClick={() => setPayId(l.id)}>
            <AppIcon name="checkCircle" size={16} /> Ghi khoản họ trả
          </button>
        </div>
      )}
      {payId === l.id && <PayBlock fin={fin} tasks={tasks} defaultAmount=""
        quickAmount={left + math.dueNow}
        interestQuick={l.rate > 0 || math.forfeited > 0 ? math.dueNow : null}
        amountLabel="Họ vừa trả bao nhiêu" confirmLabel="Ghi nhận"
        onCancel={() => setPayId(null)} onPay={(payload) => act.recordLending(l, payload)} />}

      <ProgressBox label="Đã thu lại" pct={l.principal ? got / l.principal * 100 : 0}
        left={money(got)} right={money(l.principal)} />

      <KV rows={[
        ['Hẹn trả', l.due_on ? `${dmy(l.due_on)}${days != null && days >= 0 ? ` · còn ${days} ngày` : ''}` : 'Chưa hẹn'],
        ['Lãi', l.rate > 0 ? `${l.rate}%/năm` : 'Không tính'],
        // Không hẹn ngày thì mốc là HÔM NAY — nhãn phải nói đúng thế.
        l.rate > 0 && [l.due_on && !overdue ? 'Lãi sẽ nhận' : 'Lãi tới hôm nay',
          `${money(math.expected)} · ${math.days} ngày${math.earned < math.expected ? ` · đã phát sinh ${money(math.earned)}` : ''}`],
        math.forfeited > 0 && ['Bù lãi mất', `${money(math.forfeited)} · lãi sổ bị đập, một cục`],
        (l.rate > 0 || math.forfeited > 0) && [l.due_on && !overdue ? 'Tổng sẽ nhận' : 'Tổng nếu trả hôm nay', money(math.total)],
        ...repayments.map((t, i) => [`Lần trả ${i + 1} · ${dmy(t.occurred_at)}`, money(t.amount)]),
      ]} />

      <div className="fin-hub__detail-tools">
        <button type="button" className="fin-btn fin-btn--ghost fin-btn--sm fin-hub__danger" onClick={() => act.removeLending(l, repayments.length)}>
          <AppIcon name="trash" size={14} /> Xóa khoản cho vay
        </button>
      </div>
    </>
  );
}

// ── Quỹ tiết kiệm ────────────────────────────────────────────────────────────
// Nạp/rút/nơi gửi sống ở SavingsWorkspace; hub cho thấy và mở nó.
function SaveDetail({ fin, goal: g, onEdit, onClose, onOpenSavings }) {
  const deps = fin.deposits.filter(d => d.fund_id === g.id && !d.closed_on);
  const bal = deps.reduce((s, d) => s + (d.amount || 0), 0);
  const plan = g.auto_deposit?.amount ? g.auto_deposit : null;
  const month = fin.today.slice(0, 7);
  const depositTx = fin.transactions.find(t => t.saving_goal_id === g.id && t.saving_dir === 'in' && t.occurred_at?.slice(0, 7) === month);
  const state = !plan ? { tone: 'wait', text: 'Gửi tay' } : depositTx
    ? { tone: 'paid', text: `Đã góp ngày ${dmy(depositTx.occurred_at)}` }
    : dueState({ days: daysUntilDue(plan.day, fin.today) });
  // "Dự kiến đủ" = số tháng còn thiếu chia cho mức góp mỗi tháng.
  const monthsLeft = plan && g.goal > bal ? Math.ceil((g.goal - bal) / plan.amount) : null;
  const doneAt = monthsLeft != null ? new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + monthsLeft, 1) : null;

  return (
    <>
      <DetailHead kind="save" title={g.name}
        sub={plan ? `Góp ${shortMoney(plan.amount)} · ngày ${plan.day} hằng tháng` : `${deps.length} nơi gửi · gửi tay`}
        onEdit={onEdit} onClose={onClose} />
      <AmountBox caption={plan ? `Góp kỳ ${month.slice(5)}/${month.slice(0, 4)}` : 'Đang gửi'}
        value={money(plan ? plan.amount : bal)} state={state} />
      <div className="fin-hub__detail-actions">
        <button type="button" className="fin-btn fin-btn--primary fin-hub__primary" onClick={onOpenSavings}>
          <AppIcon name="piggyBank" size={16} /> {plan && !depositTx ? 'Góp tiền · mở quản lý quỹ' : 'Mở quản lý quỹ'}
        </button>
      </div>
      {!deps.length && plan && <div className="fin-inline-message fin-inline-message--warn">
        <AppIcon name="warning" size={15} weight="fill" />
        <span>Chưa khai nơi gửi nào — phải có ít nhất một nơi gửi thì mới ghi được tiền góp vào quỹ.</span>
      </div>}
      {g.goal > 0 && <ProgressBox label="Mục tiêu" pct={bal / g.goal * 100} left={`Đang gửi ${money(bal)}`} right={`Mục tiêu ${money(g.goal)}`} />}
      <HistoryChart history={periodHistory({ id: g.id, kind: 'save' }, fin.transactions)} />
      <KV rows={[
        ['Góp mỗi kỳ', plan ? money(plan.amount) : 'Gửi tay'],
        doneAt && ['Dự kiến đủ', `Tháng ${doneAt.getMonth() + 1}/${doneAt.getFullYear()}`],
        ['Nơi gửi', deps.length ? deps.map(d => `${d.name} ${shortMoney(d.amount)}`).join(' · ') : 'Chưa gắn sổ nào'],
        ['Khóa', g.lock_mode === 'term' ? `Khóa tới ${dmy(g.lock_until)}` : g.lock_mode === 'external' ? 'Tiền nằm ngoài ví' : 'Khóa mềm · rút một chạm'],
      ]} />
    </>
  );
}
