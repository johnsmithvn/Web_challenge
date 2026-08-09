import { useState, useMemo } from 'react';
import { useUserTasks } from '../../hooks/useUserTasks';
import { parseCurrencyInput, sanitizeDecimal, sanitizeDigits } from '../../utils/currencyUtils';
import {
  periodTotals, budgetBreakdown, currentMonthPeriod, suggestedDailySpend,
  monthStart, monthEnd, parseYmd, fundBalance, maturityWarn,
} from '../../utils/financeLogic';
import { money, catInfo, NECESSITY_META, Segmented, TaskPicker, FinanceIcon } from './parts';
import AppIcon from '../AppIcon';

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

function Ring({ pct, color = '#9184d9', size = 148 }) {
  const r = 58, c = 2 * Math.PI * r, p = Math.min(100, pct || 0);
  return (
    <svg width={size} height={size} viewBox="0 0 148 148" className="fin-ring" role="img" aria-label={`Đã dùng ${pct ?? 0}% hạn mức`}>
      <circle cx="74" cy="74" r={r} fill="none" stroke="#4b4e5b" strokeWidth="14" />
      <circle cx="74" cy="74" r={r} fill="none" stroke={color} strokeWidth="14" strokeLinecap="butt"
        strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} transform="rotate(-90 74 74)" />
      <text x="74" y="72" textAnchor="middle" fill="#fff" fontSize="24" fontWeight="600">{pct == null ? '—' : `${pct}%`}</text>
      <text x="74" y="91" textAnchor="middle" fill="#b2b6ca" fontSize="10">đã dùng</text>
    </svg>
  );
}

export default function AnalyzeScreen({ fin, nav, mode = 'budget' }) {
  return (
    <div className="fin-analyze">
      {mode === 'budget' ? <BudgetTab fin={fin} nav={nav} /> : <StatsTab fin={fin} nav={nav} />}
    </div>
  );
}

// ── Tab Ngân sách (ghim tháng đang chạy) ─────────────────────────────────────
function BudgetTab({ fin, nav }) {
  const [editingBudgets, setEditingBudgets] = useState(false);
  const cur = currentMonthPeriod(fin.today);
  const totals = useMemo(
    () => periodTotals(fin.transactions, cur, { savingAsExpense: nav.savingAsExpense }),
    [fin.transactions, cur, nav.savingAsExpense],
  );
  const bb = useMemo(() => budgetBreakdown(totals, fin.budgets, fin.cats), [totals, fin.budgets, fin.cats]);
  const daily = suggestedDailySpend(bb.totalLimit, bb.totalSpent, fin.today, cur.to);
  const fund = fundBalance(fin.deposits.filter(deposit => !deposit.closed_on));

  return (
    <div className="fin-budget">
      <p className="fin-note">Ngân sách luôn tính cho <strong>tháng đang chạy</strong> ({cur.label}) — là công cụ điều khiển, không phải báo cáo.</p>

      <div className="fin-budget-overview">
        <section className="fin-budget-hero">
          <div className="fin-budget-hero__month">{cur.label}</div>
          <Ring pct={bb.pct} />
          <div className="fin-budget-hero__figures"><strong>{money(bb.totalSpent)}</strong><span>/ {money(bb.totalLimit)}</span></div>
          <p>Hạn mức luôn tính cho tháng đang chạy, không đổi theo kỳ báo cáo ở Tổng quan.</p>
          <div className="fin-budget-hero__metrics">
            <span><strong>{daily.daysLeft}</strong><small>ngày còn lại</small></span>
            <span><strong>{money(daily.perDay)}</strong><small>nên tiêu / ngày</small></span>
          </div>
        </section>

        <section className="fin-budget-limits">
          <div className="fin-budget-limits__head"><div><h2>Hạn mức theo nhóm</h2><p>Tổng hạn mức hiện tại {money(bb.totalLimit)}</p></div><button className="fin-btn fin-btn--ghost fin-btn--sm" onClick={() => setEditingBudgets(v => !v)}><AppIcon name={editingBudgets ? 'check' : 'gear'} size={14} /> {editingBudgets ? 'Xong' : 'Chỉnh hạn mức'}</button></div>
          <div className="fin-budget-limits__rows">
            {bb.categories.map(c => <BudgetRow key={c.categoryId} cat={c} cats={fin.cats} editing={editingBudgets} onSave={(v) => fin.upsertBudget(c.categoryId, v)} />)}
          </div>
        </section>
      </div>

      <section className="fin-necessity-budget">
        <div className="fin-necessity-budget__head"><div><h2>Hạn mức theo mức cần thiết <span>50 / 30 / 20</span></h2></div><p>Tỉ trọng thực tế của tháng đang chạy so với mục tiêu tính trên tổng hạn mức tự đặt, không dùng thu nhập làm gốc.</p></div>
        <div className="fin-necessity-budget__grid">
          {['must', 'need', 'want'].map((key, index) => {
            const level = bb.levels[key];
            const pct = level.limit ? Math.round(level.spent / level.limit * 100) : 0;
            const over = level.spent > level.limit;
            return <article key={key} style={{ '--c': NECESSITY_META[key].color }}>
              <div className="fin-necessity-budget__title"><AppIcon name={key === 'must' ? 'lock' : key === 'need' ? 'checkCircle' : 'sparkle'} size={15} /><strong>{NECESSITY_META[key].label}</strong><span>{over ? `Vượt ${money(level.spent - level.limit)}` : 'Trong mức'}</span></div>
              <div className="fin-level__bar"><div style={{ width: `${Math.min(100, pct)}%`, background: NECESSITY_META[key].color }} /></div>
              <div className="fin-necessity-budget__figures"><span>{money(level.spent)} / {money(level.limit)}</span><span>{[50, 30, 20][index]}% hạn mức</span></div>
              <p>{needCopyFor(key)}</p>
            </article>;
          })}
        </div>
        <small>Nếu tháng này cần thắt lưng, phần Muốn có là nhóm nên cắt trước. Các khoản Bắt buộc không được lấy làm “khoảng trống” giả.</small>
      </section>

      <SavingsWorkspace fin={fin} nav={nav} total={fund} monthTotals={totals} />
      <BudgetFit fin={fin} bb={bb} />
    </div>
  );
}

function needCopyFor(key) {
  if (key === 'must') return 'Không trả thì mất chỗ ở, mất việc, bị phạt. Tiền nhà, điện nước, trả góp, xăng đi làm.';
  if (key === 'need') return 'Phải chi nhưng số tiền tùy mình. Ăn uống hằng ngày, thuốc, quần áo cơ bản.';
  return 'Bỏ được mà không ảnh hưởng gì. Quán nước, giải trí, đồ công nghệ mới.';
}

function BudgetRow({ cat, cats, editing, onSave }) {
  const [v, setV] = useState(cat.limit ? String(cat.limit) : '');
  const pct = cat.pct || 0;
  const over = cat.limit > 0 && cat.spent > cat.limit;
  return (
    <div className="fin-budgetrow">
      <div className="fin-budgetrow__head"><span className="fin-budgetrow__lbl"><FinanceIcon name={cat.icon} cats={cats} size={15} /> {cat.label}</span>{over && <span className="fin-budgetrow__state">Vượt {money(cat.spent - cat.limit)}</span>}<span>{money(cat.spent)} / {money(cat.limit)}</span></div>
      <div className="fin-budgetrow__bar"><div style={{ width: `${Math.min(100, pct)}%`, background: over ? '#b5abfc' : cat.color }} /></div>
      {editing && <input className="fin-input fin-input--sm" inputMode="numeric" pattern="[0-9]*" placeholder="Nhập hạn mức" value={v}
          onChange={e => setV(sanitizeDigits(e.target.value))}
          onBlur={() => onSave(parseCurrencyInput(v) || 0)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onSave(parseCurrencyInput(v) || 0); e.target.blur(); } }} />}
    </div>
  );
}

function SavingsWorkspace({ fin, nav, total, monthTotals }) {
  const [panel, setPanel] = useState(null);
  const close = () => setPanel(null);
  const activeGoals = fin.goals.filter(goal => !goal.closed_at);
  const activeDeposits = fin.deposits.filter(deposit => !deposit.closed_on);
  const yearlyInterest = activeDeposits.reduce((sum, deposit) => sum + deposit.amount * (deposit.rate || 0) / 100, 0);
  const banks = new Set(activeDeposits.map(deposit => deposit.bank).filter(Boolean)).size;
  return (
    <section className="fin-savings-workspace">
      <div className="fin-savings__header">
        <div><h2>Quỹ tiết kiệm</h2><p>Đã để dành tháng này <strong>{money(monthTotals.savingIn)}</strong> · tổng quỹ {money(total.total)}</p></div>
        <button className="fin-btn fin-btn--secondary fin-btn--sm" onClick={() => setPanel({ kind: 'goal' })}><AppIcon name="plus" size={14} /> Tạo quỹ mới</button>
      </div>

      {panel?.kind === 'goal' && <GoalForm fin={fin} nav={nav} goal={panel.goal} onDone={close} />}
      {panel?.kind === 'deposit' && <DepositForm fin={fin} nav={nav} goal={panel.goal} deposit={panel.deposit} onDone={close} />}
      {panel?.kind === 'move' && <SavingMoveForm fin={fin} goal={panel.goal} dir={panel.dir} onDone={close} />}

      <label className="fin-saving-toggle">
        <span className="fin-saving-toggle__icon"><AppIcon name="piggyBank" size={19} weight="duotone" /></span>
        <span className="fin-saving-toggle__copy"><strong>Tính tiền để dành như một khoản chi</strong><small>{nav.savingAsExpense ? 'Đang bật: tiền gửi vào quỹ được tính là Bắt buộc; tiền rút ra không bị tính lại.' : 'Đang tắt: để dành nằm ngoài biểu đồ chi. Bật nếu bạn theo cách “trả cho mình trước”.'}</small></span>
        <input type="checkbox" checked={nav.savingAsExpense} onChange={e => nav.setSavingAsExpense(e.target.checked)} /><span className="fin-switch" aria-hidden="true" />
      </label>

      <div className="fin-deposit-ledger">
        <div className="fin-deposit-ledger__head"><div><h3>Tiền đang gửi ở đâu</h3><p>{activeDeposits.length} nơi · {banks} ngân hàng</p></div><button className="fin-btn fin-btn--secondary fin-btn--sm" disabled={!activeGoals.length} onClick={() => setPanel({ kind: 'deposit', goal: activeGoals[0] })}><AppIcon name="plus" size={14} /> Thêm nơi gửi</button></div>
        <div className="fin-deposit-metrics">
          <span><small>Tổng đang gửi</small><strong>{money(total.total)}</strong></span>
          <span><small>Lãi dự kiến một năm</small><strong className="is-positive">~ {money(yearlyInterest)}</strong></span>
          <span><small>Lãi suất bình quân</small><strong>{total.weightedRate}%/năm</strong></span>
        </div>
        <div className="fin-data-table-wrap"><table className="fin-data-table fin-deposit-table"><thead><tr><th>Nơi gửi</th><th>Thuộc quỹ</th><th>Số tiền</th><th>Lãi suất</th><th>Kỳ hạn</th><th>Đáo hạn</th><th>Lãi/năm</th></tr></thead><tbody>
          {activeDeposits.map(deposit => {
            const goal = activeGoals.find(item => item.id === deposit.fund_id) || fin.goals.find(item => item.id === deposit.fund_id);
            const warning = maturityWarn(deposit.matures_at, fin.today);
            const yearly = Math.round(deposit.amount * (deposit.rate || 0) / 100);
            const openDeposit = () => goal && setPanel({ kind: 'deposit', goal, deposit });
            return <tr key={deposit.id} onClick={openDeposit} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') openDeposit(); }} tabIndex="0" role="button">
              <td><strong>{deposit.name}</strong><small>{[deposit.bank, deposit.account_no].filter(Boolean).join(' · ') || 'Chưa ghi ngân hàng'}</small></td>
              <td>{goal?.name || 'Quỹ đã đóng'}</td><td>{money(deposit.amount)}</td><td>{deposit.rate || 0}%/năm</td><td>{deposit.term ? `${deposit.term} tháng` : 'Không kỳ hạn'}</td>
              <td className={warning?.warn ? 'fin-due-soon' : ''}>{deposit.matures_at || 'Không kỳ hạn'}<small>{warning ? `còn ${warning.days} ngày` : 'rút lúc nào cũng được'}</small></td><td className="is-positive">+ {money(yearly)}</td>
            </tr>;
          })}
          {!activeDeposits.length && <tr><td colSpan="7"><div className="fin-table-empty"><AppIcon name="bank" size={19} /><span>Chưa có nơi gửi. Tạo quỹ rồi khai sổ hoặc tài khoản đang giữ tiền.</span></div></td></tr>}
        </tbody></table></div>
        <small>Một quỹ có thể chia ra nhiều sổ ở nhiều ngân hàng. Lãi nhận về ghi là Thu › Đầu tư › Lãi tiết kiệm; tiền gốc quay lại không phải thu nhập.</small>
      </div>

      {activeGoals.length === 0 && <div className="fin-empty fin-empty--saving"><AppIcon name="piggyBank" size={22} /><strong>Chưa có quỹ tiết kiệm</strong><span>Tạo quỹ mục tiêu trước, sau đó thêm nơi tiền thật đang nằm.</span></div>}
      <div className="fin-fund-grid">{activeGoals.map(goal => {
        const deposits = fin.deposits.filter(d => d.fund_id === goal.id && !d.closed_on);
        const balance = fundBalance(deposits);
        const progress = goal.goal ? Math.min(100, Math.round(balance.total / goal.goal * 100)) : 0;
        const request = goal.withdrawal_request;
        const effectiveLock = goal.lock_mode === 'term' && goal.lock_until && goal.lock_until <= fin.today ? 'soft' : goal.lock_mode;
        const lockLabel = effectiveLock === 'soft' ? 'Khóa mềm · rút một chạm' : goal.lock_mode === 'term' ? `Khóa kỳ hạn${goal.lock_until ? ` · mở ${goal.lock_until}` : ''}` : 'Khóa thật · ngoài app';
        const plan = goal.auto_deposit?.amount ? `+${money(goal.auto_deposit.amount)} / tháng` : 'gửi tay';
        return (
          <section key={goal.id} className="fin-fund">
            <div className="fin-fund__head">
              <span className="fin-fund__icon"><AppIcon name="piggyBank" size={18} weight="fill" /></span>
              <div><strong>{goal.name}</strong></div><span className="fin-fund__pct">{progress}%</span>
              <button className="fin-icon-btn" onClick={() => setPanel({ kind: 'goal', goal })} aria-label="Sửa quỹ"><AppIcon name="pencil" size={15} /></button>
            </div>
            {goal.goal > 0 && <div className="fin-fund__progress"><i style={{ width: `${progress}%` }} /></div>}
            <div className="fin-fund__figures"><span>{money(balance.total)} / {money(goal.goal)}</span><span>{plan}</span></div>
            <span className="fin-fund__lock"><AppIcon name={effectiveLock === 'soft' ? 'key' : 'lock'} size={12} /> {lockLabel}</span>
            <div className="fin-fund__details"><span><AppIcon name="mapPin" size={12} />{deposits.length ? `${deposits.length} nơi gửi · ${new Set(deposits.map(d => d.bank).filter(Boolean)).size} ngân hàng` : 'Chưa khai nơi gửi'}</span><span><AppIcon name="arrowsClockwise" size={12} />{goal.auto_deposit?.amount ? `Nhắc gửi ngày ${goal.auto_deposit.day} hằng tháng` : 'Chưa đặt gửi định kỳ'}</span><span><AppIcon name="warning" size={12} />{goal.break_count ? `Đã rút giữa chừng ${goal.break_count} lần` : 'Chưa lần nào rút giữa chừng'}</span></div>
            <div className="fin-fund__actions">
              <button className="fin-btn fin-btn--primary fin-btn--sm" disabled={!deposits.length} onClick={() => setPanel({ kind: 'move', goal, dir: 'in' })}><AppIcon name="plus" size={14} /> Gửi thêm</button>
              <button className="fin-btn fin-btn--secondary fin-btn--sm" disabled={!balance.total} onClick={() => setPanel({ kind: 'move', goal, dir: 'out' })}>{effectiveLock === 'term' ? 'Yêu cầu rút · chờ 48h' : effectiveLock === 'external' ? 'Rút trước hạn' : 'Rút ra'}</button>
            </div>
            {request && <div className="fin-withdraw-request"><AppIcon name="clock" size={15} /> Yêu cầu rút {money(request.amount)} sẵn sàng lúc {new Date(request.available_at).toLocaleString('vi-VN')}</div>}
          </section>
        );
      })}</div>
    </section>
  );
}

function GoalForm({ fin, nav, goal, onDone }) {
  const [name, setName] = useState(goal?.name || '');
  const [target, setTarget] = useState(goal?.goal ? String(goal.goal) : '');
  const [lockMode, setLockMode] = useState(goal?.lock_mode || 'soft');
  const [lockUntil, setLockUntil] = useState(goal?.lock_until || '');
  const [inWallet, setInWallet] = useState(goal?.in_wallet ?? true);
  const [autoAmount, setAutoAmount] = useState(goal?.auto_deposit?.amount ? String(goal.auto_deposit.amount) : '');
  const [autoDay, setAutoDay] = useState(goal?.auto_deposit?.day ? String(goal.auto_deposit.day) : '5');
  const save = async (e) => {
    e.preventDefault();
    if (!name.trim() || (lockMode === 'term' && !lockUntil)) return;
    const recurringAmount = parseCurrencyInput(autoAmount);
    const row = { name: name.trim(), goal: parseCurrencyInput(target) || 0, lock_mode: lockMode,
      lock_until: lockMode === 'term' ? lockUntil : null, in_wallet: inWallet,
      auto_deposit: recurringAmount ? { amount: recurringAmount, day: Number(autoDay) || 5 } : null };
    const ok = goal ? await fin.updateGoal(goal.id, row) : await fin.addGoal(row);
    if (ok) onDone();
  };
  return <form className="fin-editor" onSubmit={save}>
    <div className="fin-editor__title"><strong>{goal ? 'Sửa quỹ' : 'Thêm quỹ'}</strong><button type="button" className="fin-icon-btn" onClick={onDone}><AppIcon name="x" size={14} /></button></div>
    <div className="fin-form__row"><label className="fin-label">Tên quỹ<input className="fin-input" value={name} onChange={e => setName(e.target.value)} placeholder="Du lịch Nhật" autoFocus required /></label><label className="fin-label">Mục tiêu<input className="fin-input" inputMode="numeric" pattern="[0-9]*" value={target} onChange={e => setTarget(sanitizeDigits(e.target.value))} placeholder="40.000.000" /></label></div>
    <div className="fin-form__row"><label className="fin-label">Gửi định kỳ mỗi tháng · tùy chọn<input className="fin-input" inputMode="numeric" pattern="[0-9]*" value={autoAmount} onChange={e => setAutoAmount(sanitizeDigits(e.target.value))} placeholder="500.000" /></label><label className="fin-label">Ngày nhắc gửi<input className="fin-input" inputMode="numeric" pattern="[0-9]*" min="1" max="31" value={autoDay} onChange={e => { const digits = sanitizeDigits(e.target.value, 2); setAutoDay(digits ? String(Math.min(31, Math.max(1, Number(digits)))) : ''); }} /></label></div>
    <div className="fin-form__row"><label className="fin-label">Mức ma sát khi rút<select className="fin-input" value={lockMode} onChange={e => setLockMode(e.target.value)}><option value="soft">Mềm · rút một chạm</option><option value="term">Có kỳ hạn · rút sớm chờ 48 giờ</option><option value="external">Ngoài app · cảnh báo mất lãi</option></select></label>{lockMode === 'term' && <label className="fin-label">Ngày mở khóa<input className="fin-input" type="date" value={lockUntil} onChange={e => setLockUntil(e.target.value)} required /></label>}</div>
    <label className="fin-check-row"><input type="checkbox" checked={inWallet} onChange={e => setInWallet(e.target.checked)} /><span><strong>Tiền còn ở tài khoản thường</strong><small>Dùng để giải thích phần đã để dành nhưng chưa chuyển vào sổ kỳ hạn.</small></span></label>
    <p className="fin-note">Tạo quỹ chưa cần biết tiền nằm ở đâu. Khi gửi thật vào sổ hoặc tài khoản nào, hãy thêm nơi gửi ở bảng bên dưới.</p>
    <div className="fin-editor__actions"><button className="fin-btn fin-btn--primary fin-btn--sm"><AppIcon name="save" size={14} /> Lưu</button>{goal && <button type="button" className="fin-btn fin-btn--danger fin-btn--sm" onClick={async () => { if (await nav.confirmDelete(`quỹ “${goal.name}”`) && await fin.deleteGoal(goal.id)) onDone(); }}><AppIcon name="trash" size={14} /> Xóa quỹ</button>}</div>
  </form>;
}

function DepositForm({ fin, nav, goal, deposit, onDone }) {
  const [form, setForm] = useState(() => deposit || { name: '', bank: '', account_no: '', amount: '', rate: '', term: '', opened_at: '', closed_on: '' });
  const field = (key, sanitize = value => value) => e => setForm(prev => ({ ...prev, [key]: sanitize(e.target.value) }));
  const maturity = projectedMaturity(form.opened_at, Number(form.term));
  const save = async (e) => {
    e.preventDefault();
    if (!form.name?.trim() || (Number(form.term) > 0 && !form.opened_at)) return;
    const row = { fund_id: goal.id, name: form.name.trim(), bank: form.bank || null,
      account_no: form.account_no || null, amount: parseCurrencyInput(form.amount) || 0,
      rate: Number(form.rate) || 0, term: Number(form.term) || null,
      opened_at: form.opened_at || null, closed_on: form.closed_on || null };
    const ok = deposit ? await fin.updateDeposit(deposit.id, row) : await fin.addDeposit(row);
    if (ok) onDone();
  };
  return <form className="fin-editor" onSubmit={save}>
    <div className="fin-editor__title"><strong>{deposit ? 'Sửa nơi gửi' : `Thêm nơi gửi · ${goal.name}`}</strong><button type="button" className="fin-icon-btn" onClick={onDone}><AppIcon name="x" size={14} /></button></div>
    <div className="fin-form__row"><input className="fin-input" value={form.name || ''} onChange={field('name')} placeholder="Tên sổ / tài khoản" autoFocus /><input className="fin-input" value={form.bank || ''} onChange={field('bank')} placeholder="Ngân hàng" /></div>
    <div className="fin-form__row"><input className="fin-input" inputMode="numeric" pattern="[0-9]*" value={form.account_no || ''} onChange={field('account_no', value => sanitizeDigits(value, 32))} placeholder="Số tài khoản" /><input className="fin-input" inputMode="numeric" pattern="[0-9]*" value={form.amount || ''} onChange={field('amount', sanitizeDigits)} placeholder="Số tiền đang gửi" /></div>
    <div className="fin-form__row"><label className="fin-label">Lãi suất · %/năm<input className="fin-input" inputMode="decimal" value={form.rate || ''} onChange={field('rate', value => sanitizeDecimal(value, 3, 4))} placeholder="5,2" /></label><label className="fin-label">Kỳ hạn<select className="fin-input" value={form.term || ''} onChange={field('term')}><option value="">Không kỳ hạn</option><option value="3">3 tháng</option><option value="6">6 tháng</option><option value="12">12 tháng</option><option value="24">24 tháng</option></select></label></div>
    <div className="fin-form__row"><label className="fin-label">Ngày gửi<input className="fin-input" type="date" value={form.opened_at || ''} onChange={field('opened_at')} required={Number(form.term) > 0} /></label><label className="fin-label">Ngày đáo hạn<span className="fin-input fin-input--readonly">{maturity || 'Không kỳ hạn · rút lúc nào cũng được'}</span></label></div>
    {deposit && <label className="fin-label">Ngày tất toán<input className="fin-input" type="date" value={form.closed_on || ''} onChange={field('closed_on')} /></label>}
    <p className="fin-note">Ngày đáo hạn được tự tính từ ngày gửi và kỳ hạn, không nhập tay để tránh dữ liệu lệch.</p>
    <div className="fin-editor__actions"><button className="fin-btn fin-btn--primary fin-btn--sm"><AppIcon name="save" size={14} /> Lưu</button>{deposit && <button type="button" className="fin-btn fin-btn--danger fin-btn--sm" onClick={async () => { if (await nav.confirmDelete(`nơi gửi “${deposit.name}”`) && await fin.deleteDeposit(deposit.id)) onDone(); }}><AppIcon name="trash" size={14} /> Xóa</button>}</div>
  </form>;
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

function SavingMoveForm({ fin, goal, dir, onDone }) {
  const { pendingTasks } = useUserTasks();
  const deposits = fin.deposits.filter(d => d.fund_id === goal.id);
  const request = goal.withdrawal_request;
  const [depositId, setDepositId] = useState(request?.deposit_id || deposits[0]?.id || '');
  const [amount, setAmount] = useState(request?.amount ? String(request.amount) : '');
  const [occurredAt, setOccurredAt] = useState(fin.today);
  const [note, setNote] = useState('');
  const [taskId, setTaskId] = useState(null);
  const [openedAt] = useState(() => Date.now());
  const deposit = deposits.find(d => d.id === depositId);
  const ready = request && openedAt >= new Date(request.available_at).getTime();
  const effectiveLock = goal.lock_mode === 'term' && goal.lock_until && goal.lock_until <= fin.today ? 'soft' : goal.lock_mode;
  const submit = async (e) => {
    e.preventDefault();
    const parsed = parseCurrencyInput(amount);
    if (!deposit || !parsed) return;
    if (dir === 'out' && effectiveLock === 'term' && !ready) {
      const created = await fin.requestSavingWithdrawal(goal.id, deposit.id, parsed);
      if (created) onDone();
      return;
    }
    const tx = await fin.moveSaving(goal, deposit, dir, { amount: parsed, occurredAt, note, taskId });
    if (tx) onDone();
  };
  return <form className="fin-editor" onSubmit={submit}>
    <div className="fin-editor__title"><strong>{dir === 'in' ? `Gửi thêm · ${goal.name}` : `Rút khỏi · ${goal.name}`}</strong><button type="button" className="fin-icon-btn" onClick={onDone}><AppIcon name="x" size={14} /></button></div>
    <select className="fin-input" value={depositId} onChange={e => setDepositId(e.target.value)}>{deposits.map(d => <option key={d.id} value={d.id}>{d.name} · {money(d.amount)}</option>)}</select>
    <input className="fin-input" inputMode="numeric" pattern="[0-9]*" value={amount} onChange={e => setAmount(sanitizeDigits(e.target.value))} placeholder="Số tiền" />
    <div className="fin-form__row"><label className="fin-label">Ngày thực hiện<input className="fin-input" type="date" value={occurredAt} onChange={e => setOccurredAt(e.target.value)} /></label><label className="fin-label">Ghi chú<input className="fin-input" value={note} onChange={e => setNote(e.target.value)} placeholder="Tùy chọn" /></label></div>
    <label className="fin-label">Task liên quan</label><TaskPicker tasks={pendingTasks} value={taskId} onPick={setTaskId} />
    {dir === 'out' && effectiveLock === 'term' && !ready && <div className="fin-warn fin-inline-message"><AppIcon name="clock" size={15} /> Rút sớm cần một yêu cầu và chờ 48 giờ để bạn có thời gian đổi ý.</div>}
    {dir === 'out' && effectiveLock === 'external' && <div className="fin-warn fin-inline-message"><AppIcon name="warning" size={15} /> Đây là sổ thật ngoài app. Rút trước hạn có thể mất toàn bộ lãi.</div>}
    <button className="fin-btn fin-btn--primary fin-btn--sm" disabled={!deposit || !parseCurrencyInput(amount) || (dir === 'out' && parseCurrencyInput(amount) > (deposit?.amount || 0))}><AppIcon name={dir === 'in' ? 'arrowDown' : 'arrowUp'} size={14} /> {dir === 'out' && effectiveLock === 'term' && !ready ? 'Gửi yêu cầu rút' : 'Xác nhận'}</button>
  </form>;
}

function BudgetFit({ fin, bb }) {
  const months = useMemo(() => lastNMonths(fin.today, 6).slice(0, 5), [fin.today]);
  const rows = useMemo(() => bb.categories.map(category => {
    const values = months.map(month => periodTotals(fin.transactions, month).byCategory[category.categoryId] || 0);
    const hasData = values.some(Boolean);
    const average = hasData ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
    const limit = category.limit;
    const max = Math.max(average, limit, 1);
    let verdict = 'Sát thực tế', tone = 'good';
    if (!hasData) { verdict = 'Chưa đủ dữ liệu'; tone = 'neutral'; }
    else if (!limit) { verdict = 'Cần đặt hạn mức'; tone = 'warn'; }
    else if (average > limit * 1.08) { verdict = `Nên nới ${money(average - limit)}`; tone = 'bad'; }
    else if (average < limit * 0.55) { verdict = 'Có thể siết'; tone = 'warn'; }
    return { ...category, average, avgWidth: average / max * 100, limitAt: limit / max * 100, verdict, tone };
  }), [bb.categories, fin.transactions, months]);

  return <section className="fin-budget-fit">
    <div className="fin-budget-fit__head"><div><h2>Hạn mức có sát thực chi không</h2><p>Hạn mức quá cao không cản được gì; quá thấp thì tháng nào cũng báo vượt.</p></div><span>So với trung bình 5 tháng đã trọn</span></div>
    <div className="fin-budget-fit__rows">{rows.map(row => <article key={row.categoryId}>
      <div><span className="fin-legend__dot" style={{ background: row.color }} /><strong>{row.label}</strong><span>TB <b>{money(row.average)}</b></span><span>hạn mức <b>{money(row.limit)}</b></span><em className={`is-${row.tone}`}>{row.verdict}</em></div>
      <div className="fin-budget-fit__bar"><i style={{ width: `${row.avgWidth}%`, background: row.color }} /><b style={{ left: `${row.limitAt}%` }} /></div>
    </article>)}</div>
    <small>Vạch trắng là hạn mức, dải màu là mức chi trung bình. Chỉ đưa khuyến nghị khi đã có dữ liệu thực tế.</small>
  </section>;
}

// ── Tab Thống kê ──────────────────────────────────────────────────────────────
function StatsTab({ fin, nav }) {
  const [range, setRange] = useState(6);
  const [mode, setMode] = useState('category');
  const [group, setGroup] = useState(nav.analyzeParams.group || 'food');
  const [billId, setBillId] = useState('');
  const months = useMemo(() => lastNMonths(fin.today, range), [fin.today, range]);

  const monthTotals = useMemo(
    () => months.map(m => ({ m, t: periodTotals(fin.transactions, m,
      { savingAsExpense: nav.savingAsExpense }) })),
    [months, fin.transactions, nav.savingAsExpense]);

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
        <div className="fin-stats__range"><span>Khoảng</span><Segmented ariaLabel="Khoảng thống kê"
          options={[{ value: 3, label: '3 tháng' }, { value: 6, label: '6 tháng' }, { value: 12, label: 'Tất cả 12 tháng' }]}
          value={range} onChange={setRange} /></div>
        <Segmented options={[
          { value: 'category', label: 'Theo danh mục' }, { value: 'compare', label: 'So sánh' },
          { value: 'bill', label: 'Theo hóa đơn' }, { value: 'card', label: 'Theo thẻ' }]}
          value={mode} onChange={setMode} ariaLabel="Kiểu thống kê" />
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
          <select className="fin-input" value={billId} onChange={e => setBillId(e.target.value)}>
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
