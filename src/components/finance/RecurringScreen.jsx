import { useState, useEffect } from 'react';
import { parseCurrencyInput } from '../../utils/currencyUtils';
import {
  cardCycle, floatInterest, loanSchedule, currentMonthPeriod,
} from '../../utils/financeLogic';
import { money, catInfo, CATS, Segmented } from './parts';

const SEGMENTS = [
  { value: 'out',  label: 'Phải trả',   addLabel: 'Thêm hóa đơn' },
  { value: 'in',   label: 'Sẽ nhận',    addLabel: 'Thêm khoản thu' },
  { value: 'loan', label: 'Khoản vay',  addLabel: 'Thêm khoản vay' },
  { value: 'card', label: 'Thẻ tín dụng', addLabel: 'Thêm thẻ' },
];

function daysUntilDay(dueDay, today) {
  if (!dueDay) return null;
  const t = new Date(today + 'T00:00:00');
  let due = new Date(t.getFullYear(), t.getMonth(), dueDay);
  if (due < t) due = new Date(t.getFullYear(), t.getMonth() + 1, dueDay);
  return Math.round((due - t) / 86400000);
}

export default function RecurringScreen({ fin, nav }) {
  const seg = nav.recurringSeg;
  const [adding, setAdding] = useState(false);
  const segMeta = SEGMENTS.find(s => s.value === seg);

  return (
    <div className="fin-recurring">
      <div className="fin-recurring__bar">
        <Segmented options={SEGMENTS} value={seg} onChange={(v) => { nav.setRecurringSeg(v); setAdding(false); }} />
        <button className="fin-btn fin-btn--primary fin-btn--sm" onClick={() => setAdding(a => !a)}>
          {adding ? '✕ Đóng' : `+ ${segMeta.addLabel}`}
        </button>
      </div>

      {adding && <AddForm seg={seg} fin={fin} nav={nav} onDone={() => setAdding(false)} />}

      {seg === 'out'  && <BillsList fin={fin} nav={nav} daysUntilDay={daysUntilDay} />}
      {seg === 'in'   && <IncomeList fin={fin} nav={nav} />}
      {seg === 'loan' && <LoansList fin={fin} nav={nav} />}
      {seg === 'card' && <CardsList fin={fin} nav={nav} />}
    </div>
  );
}

// ── Add forms ────────────────────────────────────────────────────────────────
function AddForm({ seg, fin, nav, onDone }) {
  const [f, setF] = useState(() => ({ name: nav.handoff?.kind === seg ? nav.handoff.title || '' : '' }));
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  useEffect(() => { if (nav.handoff?.kind === seg) nav.clearHandoff(); }, []); // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault();
    if (!f.name) return;
    let ok;
    if (seg === 'out') ok = await fin.addBill({
      name: f.name, provider: f.provider || null, customer_code: f.customer_code || null,
      category_id: f.category_id || 'housing', subcategory_id: f.subcategory_id || null,
      amount_mode: f.amount_mode || 'fixed', amount: parseCurrencyInput(f.amount) || null,
      due_day: Number(f.due_day) || null, term_total: Number(f.term_total) || null });
    else if (seg === 'in') ok = await fin.addIncomeRule({
      name: f.name, source: f.source || null, amount: parseCurrencyInput(f.amount) || 0,
      due_day: Number(f.due_day) || null });
    else if (seg === 'loan') ok = await fin.addLoan({
      name: f.name, lender: f.lender || null, principal: parseCurrencyInput(f.principal) || 0,
      rate: Number(f.rate) || 0, kind: f.kind || 'amort', term: Number(f.term) || null,
      pay_day: Number(f.pay_day) || null, opened_at: f.opened_at || null, due_at: f.due_at || null });
    else if (seg === 'card') ok = await fin.addCard({
      name: f.name, bank: f.bank || null, last4: f.last4 || null,
      credit_limit: parseCurrencyInput(f.credit_limit) || 0,
      statement_day: Number(f.statement_day) || null, due_day: Number(f.due_day) || null,
      grace: Number(f.grace) || null, annual_fee: parseCurrencyInput(f.annual_fee) || 0,
      cash_advance_fee: parseCurrencyInput(f.cash_advance_fee) || 0, min_pct: Number(f.min_pct) || 0 });
    if (ok) {
      nav.showToast(
        seg === 'loan' ? 'Đã tạo khoản vay — mỗi tháng app nhắc trả lãi, tách gốc riêng khỏi chi tiêu'
        : seg === 'card' ? 'Đã thêm thẻ — app theo dõi ngày chốt, đến hạn và số ngày float'
        : seg === 'in' ? 'Đã thêm khoản thu — app chỉ nhắc, không tô đỏ khi chưa nhận'
        : 'Đã thêm hóa đơn — tới ngày app hiện nút để bạn ghi', { icon: '✅' });
      onDone();
    }
  };

  const grp = CATS.expenseGroups.find(g => g.key === (f.category_id || 'housing'));

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
            {CATS.expenseGroups.map(g => <option key={g.key} value={g.key}>{g.icon} {g.label}</option>)}
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
          <input className="fin-input" placeholder="Số tiền" value={f.amount || ''} onChange={set('amount')}
            disabled={f.amount_mode === 'ask'} />
        </div>
        <div className="fin-form__row">
          <input className="fin-input" placeholder="Ngày trả trong tháng" value={f.due_day || ''} onChange={set('due_day')} />
          <input className="fin-input" placeholder="Số kỳ (trả góp, để trống nếu vô hạn)" value={f.term_total || ''} onChange={set('term_total')} />
        </div>
      </>)}
      {seg === 'in' && (<>
        <div className="fin-form__row">
          <input className="fin-input" placeholder="Nguồn (công ty, người thuê…)" value={f.source || ''} onChange={set('source')} />
          <input className="fin-input" placeholder="Số tiền" value={f.amount || ''} onChange={set('amount')} />
        </div>
        <input className="fin-input" placeholder="Ngày nhận trong tháng" value={f.due_day || ''} onChange={set('due_day')} />
      </>)}
      {seg === 'loan' && (<>
        <div className="fin-form__row">
          <input className="fin-input" placeholder="Bên cho vay" value={f.lender || ''} onChange={set('lender')} />
          <input className="fin-input" placeholder="Số tiền gốc" value={f.principal || ''} onChange={set('principal')} />
        </div>
        <div className="fin-form__row">
          <select className="fin-input" value={f.kind || 'amort'} onChange={set('kind')}>
            <option value="amort">Trả đều gốc + lãi</option>
            <option value="interest">Chỉ trả lãi, gốc cuối kỳ</option>
          </select>
          <input className="fin-input" placeholder="Lãi %/năm" value={f.rate || ''} onChange={set('rate')} />
        </div>
        <div className="fin-form__row">
          <input className="fin-input" placeholder="Số kỳ (tháng)" value={f.term || ''} onChange={set('term')} />
          <input className="fin-input" placeholder="Ngày trả trong tháng" value={f.pay_day || ''} onChange={set('pay_day')} />
        </div>
        <div className="fin-form__row">
          <label className="fin-label">Mở ngày <input className="fin-input" type="date" value={f.opened_at || ''} onChange={set('opened_at')} /></label>
          <label className="fin-label">Tất toán gốc <input className="fin-input" type="date" value={f.due_at || ''} onChange={set('due_at')} /></label>
        </div>
      </>)}
      {seg === 'card' && (<>
        <div className="fin-form__row">
          <input className="fin-input" placeholder="Ngân hàng" value={f.bank || ''} onChange={set('bank')} />
          <input className="fin-input" placeholder="4 số cuối" value={f.last4 || ''} onChange={set('last4')} />
        </div>
        <input className="fin-input" placeholder="Hạn mức" value={f.credit_limit || ''} onChange={set('credit_limit')} />
        <div className="fin-form__row">
          <input className="fin-input" placeholder="Ngày chốt sao kê" value={f.statement_day || ''} onChange={set('statement_day')} />
          <input className="fin-input" placeholder="Ngày đến hạn" value={f.due_day || ''} onChange={set('due_day')} />
        </div>
        <div className="fin-form__row">
          <input className="fin-input" placeholder="Ân hạn (ngày)" value={f.grace || ''} onChange={set('grace')} />
          <input className="fin-input" placeholder="Phí thường niên" value={f.annual_fee || ''} onChange={set('annual_fee')} />
        </div>
        <div className="fin-form__row">
          <input className="fin-input" placeholder="Phí rút tiền mặt" value={f.cash_advance_fee || ''} onChange={set('cash_advance_fee')} />
          <input className="fin-input" placeholder="% trả tối thiểu" value={f.min_pct || ''} onChange={set('min_pct')} />
        </div>
      </>)}
      <button type="submit" className="fin-btn fin-btn--primary">Lưu</button>
    </form>
  );
}

// ── Pay inline (số tiền + Ghi) ───────────────────────────────────────────────
function PayInline({ defaultAmount, label, onPay }) {
  const [v, setV] = useState(defaultAmount ? String(defaultAmount) : '');
  return (
    <div className="fin-payinline">
      <input className="fin-input fin-input--sm" placeholder="số tiền" value={v} onChange={e => setV(e.target.value)} />
      <button className="fin-btn fin-btn--sm" disabled={!parseCurrencyInput(v)} onClick={() => onPay(parseCurrencyInput(v))}>{label}</button>
    </div>
  );
}

// ── out: Phải trả ─────────────────────────────────────────────────────────────
function BillsList({ fin, nav, daysUntilDay }) {
  const active = fin.bills.filter(b => !b.finished_at);
  const finished = fin.bills.filter(b => b.finished_at);
  const pay = async (bill, amount) => {
    const tx = await fin.payBill(bill, { amount });
    nav.showToast(tx ? `Đã ghi ${bill.name} — giờ là giao dịch bình thường, lên báo cáo` : 'Kỳ này đã trả rồi', { icon: tx ? '📝' : '⚠️' });
  };
  return (
    <div className="fin-rules">
      {active.length === 0 && <div className="fin-empty">Chưa có hóa đơn</div>}
      {active.map(b => {
        const d = daysUntilDay(b.due_day, fin.today);
        return (
          <div key={b.id} className="fin-rule">
            <div className="fin-rule__main">
              <div className="fin-rule__name">{catInfo(b.category_id).icon} {b.name}
                {b.term_total && <span className="fin-badge">{b.term_done || 0}/{b.term_total}</span>}</div>
              <div className="fin-rule__meta">{b.provider || ''}{b.customer_code ? ` · ${b.customer_code}` : ''}
                {d != null && <span className={d <= 3 ? 'fin-due-soon' : ''}> · còn {d} ngày</span>}</div>
            </div>
            <div className="fin-rule__right">
              <div className="fin-rule__amt">{b.amount_mode === 'ask' ? 'hỏi mỗi kỳ' : money(b.amount)}</div>
              <PayInline defaultAmount={b.amount_mode === 'fixed' ? b.amount : ''} label="Thanh toán" onPay={(a) => pay(b, a)} />
              <button className="fin-icon-btn" title="Xóa" onClick={() => fin.deleteBill(b.id)}>🗑</button>
            </div>
          </div>
        );
      })}
      {finished.length > 0 && (
        <div className="fin-archived">🏁 {finished.length} quy tắc đã kết thúc — các kỳ đã trả vẫn ở Giao dịch</div>
      )}
    </div>
  );
}

// ── in: Sẽ nhận (không quá hạn) ──────────────────────────────────────────────
function IncomeList({ fin, nav }) {
  const period = currentMonthPeriod(fin.today).key.slice(0, 7);
  const receive = async (rule, amount) => {
    const tx = await fin.receiveIncome(rule, { amount });
    nav.showToast(tx ? `Đã nhận ${rule.name} — ghi vào khoản thu` : 'Kỳ này đã nhận rồi', { icon: tx ? '💰' : '⚠️' });
  };
  return (
    <div className="fin-rules">
      {fin.incomeRules.length === 0 && <div className="fin-empty">Chưa có khoản thu định kỳ</div>}
      {fin.incomeRules.map(r => {
        const received = (r.received_periods || []).includes(period);
        return (
          <div key={r.id} className="fin-rule">
            <div className="fin-rule__main">
              <div className="fin-rule__name">💵 {r.name}</div>
              <div className="fin-rule__meta">{r.source || ''}{r.due_day ? ` · ngày ${r.due_day}` : ''}</div>
            </div>
            <div className="fin-rule__right">
              <div className="fin-rule__amt">{money(r.amount)}</div>
              {received ? <span className="fin-badge">đã nhận kỳ này</span>
                : <PayInline defaultAmount={r.amount} label="Đã nhận" onPay={(a) => receive(r, a)} />}
              <button className="fin-icon-btn" title="Xóa" onClick={() => fin.deleteIncomeRule(r.id)}>🗑</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── loan: Khoản vay ───────────────────────────────────────────────────────────
function LoansList({ fin, nav }) {
  return (
    <div className="fin-rules">
      {fin.loans.length === 0 && <div className="fin-empty">Chưa có khoản vay</div>}
      {fin.loans.map(l => {
        const sch = loanSchedule(l);
        return (
          <div key={l.id} className="fin-rule fin-rule--col">
            <div className="fin-rule__name">🏦 {l.name} <span className="fin-badge">{sch.progress.done}/{sch.progress.total} kỳ</span></div>
            <div className="fin-rule__meta">{l.lender || ''} · gốc {money(l.principal)} · {l.rate}%/năm</div>
            {sch.kind === 'interest' ? (
              <>
                <div className="fin-rule__meta">Lãi mỗi kỳ {money(sch.monthlyInterest)} · gốc tất toán {l.due_at || '—'}</div>
                <div className="fin-payrow">
                  <PayInline defaultAmount={sch.monthlyInterest} label="Trả lãi" onPay={(a) => { fin.payLoanInterest(l, { amount: a }); nav.showToast('Đã ghi lãi vay — tính vào chi tiêu', { icon: '💸' }); }} />
                  <PayInline defaultAmount={sch.principalDue} label="Trả gốc" onPay={(a) => { fin.payLoanPrincipal(l, { amount: a }); nav.showToast('Đã trả gốc — đứng NGOÀI tổng chi (chuyển nợ thành tài sản)', { icon: '🏦' }); }} />
                </div>
              </>
            ) : (
              <>
                <div className="fin-rule__meta">Trả đều {money(sch.monthlyPayment)}/kỳ · dư nợ gốc ~{money(sch.principalRemaining)}</div>
                <div className="fin-payrow">
                  <PayInline defaultAmount={sch.monthlyPayment} label="Trả kỳ này" onPay={(a) => { fin.payLoanInterest(l, { amount: a }); fin.updateLoan(l.id, { done: (l.done || 0) + 1 }); nav.showToast('Đã ghi kỳ trả góp', { icon: '💸' }); }} />
                </div>
              </>
            )}
            <button className="fin-icon-btn fin-rule__del" title="Xóa" onClick={() => fin.deleteLoan(l.id)}>🗑</button>
          </div>
        );
      })}
    </div>
  );
}

// ── card: Thẻ tín dụng ────────────────────────────────────────────────────────
function CardsList({ fin, nav }) {
  const cur = currentMonthPeriod(fin.today);
  return (
    <div className="fin-rules">
      {fin.cards.length === 0 && <div className="fin-empty">Chưa có thẻ</div>}
      {fin.cards.map(c => {
        const cyc = cardCycle(c, fin.today);
        // Dư nợ kỳ này ~ tổng chi trên thẻ trong tháng đang chạy (ước lượng).
        const balance = fin.transactions
          .filter(t => t.source_card_id === c.id && t.occurred_at >= cur.from && t.occurred_at <= cur.to && !t.excluded)
          .reduce((s, t) => s + t.amount, 0);
        const est = floatInterest(balance, cyc.floatDaysTotal, fin.blendedRate);
        const usedPct = c.credit_limit ? Math.round((balance / c.credit_limit) * 100) : 0;
        return (
          <div key={c.id} className="fin-rule fin-rule--col">
            <div className="fin-rule__name">💳 {c.name} {c.last4 ? `••${c.last4}` : ''}
              {cyc.overdue && <span className="fin-badge fin-badge--danger">quá hạn</span>}</div>
            <div className="fin-rule__meta">{c.bank || ''} · hạn mức {money(c.credit_limit)} ({usedPct}%)</div>
            <div className="fin-cardbar"><div style={{ width: `${Math.min(100, usedPct)}%` }} /></div>
            <div className="fin-rule__meta">
              Sao kê ~{money(balance)} · chốt {cyc.statement} · đến hạn {cyc.due} · còn {cyc.daysUntilDue} ngày · float {cyc.floatDaysTotal} ngày
            </div>
            {est > 0 && <div className="fin-rule__meta fin-good">Float đang kiếm ~{money(est)} lãi (lãi gửi bình quân {fin.blendedRate}%/năm)</div>}
            {c.annual_fee > 0 && <div className="fin-rule__meta">Phí thường niên {money(c.annual_fee)}</div>}
            {c.cash_advance_fee > 0 && <div className="fin-warn">⚠️ Rút tiền mặt mất phí {money(c.cash_advance_fee)} — tránh</div>}
            <div className="fin-payrow">
              <PayInline defaultAmount={balance} label="Trả sao kê" onPay={(a) => { fin.payCardStatement(c, { amount: a }); nav.showToast('Đã ghi trả sao kê — KHÔNG phải chi mới, chỉ để lịch sử', { icon: '💳' }); }} />
            </div>
            <button className="fin-icon-btn fin-rule__del" title="Xóa" onClick={() => fin.deleteCard(c.id)}>🗑</button>
          </div>
        );
      })}
    </div>
  );
}
