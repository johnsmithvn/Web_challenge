import { useState, useMemo } from 'react';
import { useUserTasks } from '../../hooks/useUserTasks';
import { parseCurrencyInput, sanitizeDecimal, sanitizeDigits } from '../../utils/currencyUtils';
import {
  periodTotals, currentMonthPeriod,
  monthStart, monthEnd, parseYmd, fundBalance, maturityWarn,
} from '../../utils/financeLogic';
import { money, catInfo, Segmented, TaskPicker, FinanceIcon, DateField, BankSelect } from './parts';
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

export default function AnalyzeScreen({ fin, nav }) {
  return (
    <div className="fin-analyze">
      <StatsTab fin={fin} nav={nav} />
    </div>
  );
}

export function SavingsWorkspace({ fin, nav, addingGoal, onDoneGoal }) {
  const [panel, setPanel] = useState(null);
  const close = () => {
    setPanel(null);
    if (onDoneGoal) onDoneGoal();
  };
  const activeGoals = useMemo(() => fin.goals.filter(goal => !goal.closed_at), [fin.goals]);
  const activeDeposits = useMemo(() => fin.deposits.filter(deposit => !deposit.closed_on), [fin.deposits]);
  const yearlyInterest = activeDeposits.reduce((sum, deposit) => sum + deposit.amount * (deposit.rate || 0) / 100, 0);
  const banks = new Set(activeDeposits.map(deposit => deposit.bank).filter(Boolean)).size;

  const cur = useMemo(() => currentMonthPeriod(fin.today), [fin.today]);
  const monthTotals = useMemo(
    () => periodTotals(fin.transactions, cur),
    [fin.transactions, cur],
  );
  const total = useMemo(
    () => fundBalance(activeDeposits),
    [activeDeposits],
  );
  return (
    <section className="fin-savings-workspace">
      <div className="fin-savings__header">
        <div><h2>Quỹ tiết kiệm</h2><p>Đã để dành tháng này <strong>{money(monthTotals.savingIn)}</strong> · tổng quỹ {money(total.total)}</p></div>
        <button className="fin-btn fin-btn--secondary fin-btn--sm" onClick={() => setPanel({ kind: 'goal' })}><AppIcon name="plus" size={14} /> Tạo quỹ mới</button>
      </div>

      {(panel?.kind === 'goal' || addingGoal) && <GoalForm fin={fin} nav={nav} goal={panel?.goal} onDone={close} />}
      {panel?.kind === 'deposit' && <DepositForm fin={fin} nav={nav} goal={panel.goal} deposit={panel.deposit} activeGoals={activeGoals} onDone={close} />}
      {panel?.kind === 'move' && <SavingMoveForm fin={fin} goal={panel.goal} dir={panel.dir} onDone={close} />}

      <div className="fin-deposit-ledger">
        <div className="fin-deposit-ledger__head">
          <div>
            <h3>Tiền đang gửi ở đâu</h3>
            <p>{activeDeposits.length} nơi · {banks} ngân hàng</p>
          </div>
          <button
            type="button"
            className="fin-btn fin-btn--secondary fin-btn--sm"
            onClick={() => setPanel({ kind: 'deposit', goal: activeGoals[0] || null })}
          >
            <AppIcon name="plus" size={14} /> Thêm nơi gửi
          </button>
        </div>
        <div className="fin-deposit-metrics">
          <span><small>Tổng đang gửi</small><strong>{money(total.total)}</strong></span>
          <span><small>Lãi dự kiến một năm</small><strong className="is-positive">~ {money(yearlyInterest)}</strong></span>
          <span><small>Lãi suất bình quân</small><strong>{total.weightedRate}%/năm</strong></span>
        </div>
        <div className="fin-data-table-wrap">
          <table className="fin-data-table fin-deposit-table">
            <thead>
              <tr><th>Nơi gửi</th><th>Thuộc quỹ</th><th>Số tiền</th><th>Lãi suất</th><th>Kỳ hạn</th><th>Đáo hạn</th><th>Lãi/năm</th></tr>
            </thead>
            <tbody>
              {activeDeposits.map(deposit => {
                const goal = activeGoals.find(item => item.id === deposit.fund_id) || fin.goals.find(item => item.id === deposit.fund_id);
                const warning = maturityWarn(deposit.matures_at, fin.today);
                const yearly = Math.round(deposit.amount * (deposit.rate || 0) / 100);
                const openDeposit = () => setPanel({ kind: 'deposit', goal, deposit });
                return (
                  <tr key={deposit.id} onClick={openDeposit} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') openDeposit(); }} tabIndex="0" role="button">
                    <td><strong>{deposit.name}</strong><small>{[deposit.bank, deposit.account_no].filter(Boolean).join(' · ') || 'Chưa ghi ngân hàng'}</small></td>
                    <td>{goal?.name || 'Quỹ đã đóng'}</td><td>{money(deposit.amount)}</td><td>{deposit.rate || 0}%/năm</td><td>{deposit.term ? `${deposit.term} tháng` : 'Không kỳ hạn'}</td>
                    <td className={warning?.warn ? 'fin-due-soon' : ''}>{deposit.matures_at || 'Không kỳ hạn'}<small>{warning ? `còn ${warning.days} ngày` : 'rút lúc nào cũng được'}</small></td><td className="is-positive">+ {money(yearly)}</td>
                  </tr>
                );
              })}
              {!activeDeposits.length && (
                <tr>
                  <td colSpan="7">
                    <div className="fin-table-empty">
                      <AppIcon name="bank" size={19} />
                      <span>Chưa có nơi gửi. Khai báo sổ tiết kiệm hoặc tài khoản đang giữ tiền.</span>
                      <button
                        type="button"
                        className="fin-btn fin-btn--primary fin-btn--sm"
                        style={{ marginTop: '8px' }}
                        onClick={() => setPanel({ kind: 'deposit', goal: activeGoals[0] || null })}
                      >
                        <AppIcon name="plus" size={14} /> Thêm nơi gửi
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <small>Một quỹ có thể chia ra nhiều sổ ở nhiều ngân hàng. Lãi nhận về ghi là Thu › Đầu tư › Lãi tiết kiệm; tiền gốc quay lại không phải thu nhập.</small>
      </div>

      {activeGoals.length === 0 && (
        <div className="fin-empty fin-empty--saving">
          <AppIcon name="piggyBank" size={22} />
          <strong>Chưa có quỹ tiết kiệm</strong>
          <span>Tạo quỹ mục tiêu trước, hoặc thêm nơi gửi tiền ở trên để tự động tạo quỹ.</span>
          <button
            type="button"
            className="fin-btn fin-btn--primary fin-btn--sm"
            style={{ marginTop: '8px' }}
            onClick={() => setPanel({ kind: 'goal' })}
          >
            <AppIcon name="plus" size={14} /> Tạo quỹ mục tiêu
          </button>
        </div>
      )}
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
              <button className="fin-icon-btn" onClick={() => setPanel({ kind: 'goal', goal })} aria-label={`Sửa quỹ ${goal.name}`}><AppIcon name="pencil" size={15} /></button>
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

export function GoalForm({ fin, nav, goal, onDone }) {
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
    <div className="fin-editor__title"><strong>{goal ? 'Sửa quỹ' : 'Thêm quỹ'}</strong><button type="button" className="fin-icon-btn" aria-label="Đóng form quỹ" onClick={onDone}><AppIcon name="x" size={14} /></button></div>
    <div className="fin-form__row"><label className="fin-label">Tên quỹ<input className="fin-input" value={name} onChange={e => setName(e.target.value)} placeholder="Du lịch Nhật" autoFocus required /></label><label className="fin-label">Mục tiêu<input className="fin-input" inputMode="numeric" pattern="[0-9]*" value={target} onChange={e => setTarget(sanitizeDigits(e.target.value))} placeholder="40.000.000" /></label></div>
    <div className="fin-form__row"><label className="fin-label">Gửi định kỳ mỗi tháng · tùy chọn<input className="fin-input" inputMode="numeric" pattern="[0-9]*" value={autoAmount} onChange={e => setAutoAmount(sanitizeDigits(e.target.value))} placeholder="500.000" /></label><label className="fin-label">Ngày nhắc gửi<input className="fin-input" inputMode="numeric" pattern="[0-9]*" min="1" max="31" value={autoDay} onChange={e => { const digits = sanitizeDigits(e.target.value, 2); setAutoDay(digits ? String(Math.min(31, Math.max(1, Number(digits)))) : ''); }} /></label></div>
    <div className="fin-form__row"><label className="fin-label">Mức ma sát khi rút<select className="fin-input" value={lockMode} onChange={e => setLockMode(e.target.value)}><option value="soft">Mềm · rút một chạm</option><option value="term">Có kỳ hạn · rút sớm chờ 48 giờ</option><option value="external">Ngoài app · cảnh báo mất lãi</option></select></label>{lockMode === 'term' && <label className="fin-label">Ngày mở khóa<DateField value={lockUntil} onChange={setLockUntil} /></label>}</div>
    <label className="fin-check-row"><input type="checkbox" checked={inWallet} onChange={e => setInWallet(e.target.checked)} /><span><strong>Tiền còn ở tài khoản thường</strong><small>Dùng để giải thích phần đã để dành nhưng chưa chuyển vào sổ kỳ hạn.</small></span></label>
    <p className="fin-note">Tạo quỹ chưa cần biết tiền nằm ở đâu. Khi gửi thật vào sổ hoặc tài khoản nào, hãy thêm nơi gửi ở bảng bên dưới.</p>
    <div className="fin-editor__actions"><button className="fin-btn fin-btn--primary fin-btn--sm"><AppIcon name="save" size={14} /> Lưu</button>{goal && <button type="button" className="fin-btn fin-btn--danger fin-btn--sm" onClick={async () => { if (await nav.confirmDelete(`quỹ “${goal.name}”`) && await fin.deleteGoal(goal.id)) onDone(); }}><AppIcon name="trash" size={14} /> Xóa quỹ</button>}</div>
  </form>;
}

function DepositForm({ fin, nav, goal, deposit, activeGoals = [], onDone }) {
  const [selectedGoalId, setSelectedGoalId] = useState(() => goal?.id || deposit?.fund_id || activeGoals[0]?.id || '__new__');
  const [newGoalName, setNewGoalName] = useState('Quỹ tiết kiệm chung');
  const [form, setForm] = useState(() => deposit || { name: '', bank: '', account_no: '', amount: '', rate: '', term: '', opened_at: '', closed_on: '' });
  const [isSaving, setIsSaving] = useState(false);

  const isCreatingNewGoal = selectedGoalId === '__new__' || (!activeGoals.length && !deposit);
  const field = (key, sanitize = value => value) => e => setForm(prev => ({ ...prev, [key]: sanitize(e.target.value) }));
  const maturity = projectedMaturity(form.opened_at, Number(form.term));

  const save = async (e) => {
    e.preventDefault();
    if (!form.name?.trim() || (Number(form.term) > 0 && !form.opened_at) || isSaving) return;

    let targetFundId = selectedGoalId;
    if (isCreatingNewGoal) {
      if (!newGoalName.trim()) {
        nav.showToast('Vui lòng nhập tên Quỹ tiết kiệm cho nơi gửi này.', { icon: 'warning' });
        return;
      }
      setIsSaving(true);
      const createdGoal = await fin.addGoal({
        name: newGoalName.trim(),
        goal: 0,
        lock_mode: 'soft',
        in_wallet: false,
      });
      if (!createdGoal) {
        setIsSaving(false);
        nav.showToast('Không thể tạo quỹ tiết kiệm. Vui lòng thử lại.', { icon: 'warning' });
        return;
      }
      targetFundId = createdGoal.id;
    }

    if (!targetFundId || targetFundId === '__new__') {
      nav.showToast('Vui lòng chọn hoặc tạo quỹ tiết kiệm.', { icon: 'warning' });
      return;
    }

    setIsSaving(true);
    const row = {
      fund_id: targetFundId,
      name: form.name.trim(),
      bank: form.bank || null,
      account_no: form.account_no || null,
      amount: parseCurrencyInput(form.amount) || 0,
      rate: Number(form.rate) || 0,
      term: Number(form.term) || null,
      opened_at: form.opened_at || null,
      closed_on: form.closed_on || null,
    };
    const ok = deposit ? await fin.updateDeposit(deposit.id, row) : await fin.addDeposit(row);
    setIsSaving(false);
    if (ok) {
      nav.showToast(deposit ? `Đã cập nhật nơi gửi “${form.name.trim()}”` : `Đã thêm nơi gửi “${form.name.trim()}”`, { icon: 'bank' });
      onDone();
    } else {
      nav.showToast('Không thể lưu nơi gửi. Kiểm tra lại dữ liệu rồi thử lại.', { icon: 'warning' });
    }
  };

  const currentGoalName = activeGoals.find(g => g.id === selectedGoalId)?.name;

  return (
    <form className="fin-editor" onSubmit={save}>
      <div className="fin-editor__title">
        <strong>{deposit ? `Sửa nơi gửi · ${deposit.name}` : (currentGoalName ? `Thêm nơi gửi · ${currentGoalName}` : 'Thêm nơi gửi tiền')}</strong>
        <button type="button" className="fin-icon-btn" aria-label="Đóng form nơi gửi" onClick={onDone}>
          <AppIcon name="x" size={14} />
        </button>
      </div>

      {!deposit && (
        <div className="fin-form__row">
          {activeGoals.length > 0 ? (
            <label className="fin-label" style={{ flex: 1 }}>
              Thuộc quỹ tiết kiệm
              <select
                className="fin-input"
                value={selectedGoalId}
                onChange={e => setSelectedGoalId(e.target.value)}
              >
                {activeGoals.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
                <option value="__new__">+ Tạo quỹ mới...</option>
              </select>
            </label>
          ) : (
            <label className="fin-label" style={{ flex: 1 }}>
              Tạo quỹ mới (để giữ nơi gửi)
              <input
                className="fin-input"
                value={newGoalName}
                onChange={e => setNewGoalName(e.target.value)}
                placeholder="Ví dụ: Quỹ tiết kiệm chung, Quỹ khẩn cấp"
                required
              />
            </label>
          )}

          {activeGoals.length > 0 && selectedGoalId === '__new__' && (
            <label className="fin-label" style={{ flex: 1 }}>
              Tên quỹ mới
              <input
                className="fin-input"
                value={newGoalName}
                onChange={e => setNewGoalName(e.target.value)}
                placeholder="Tên quỹ tiết kiệm mới"
                required
                autoFocus
              />
            </label>
          )}
        </div>
      )}

      {deposit && activeGoals.length > 1 && (
        <div className="fin-form__row">
          <label className="fin-label" style={{ flex: 1 }}>
            Thuộc quỹ tiết kiệm
            <select
              className="fin-input"
              value={selectedGoalId}
              onChange={e => setSelectedGoalId(e.target.value)}
            >
              {activeGoals.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="fin-form__row">
        <label className="fin-label" style={{ flex: 1 }}>
          Tên sổ / tài khoản
          <input
            className="fin-input"
            value={form.name || ''}
            onChange={field('name')}
            aria-label="Tên sổ / tài khoản"
            placeholder="Ví dụ: Sổ tiết kiệm 6T, Tài khoản tích lũy"
            autoFocus={!isCreatingNewGoal}
            required
          />
        </label>
        <label className="fin-label" style={{ flex: 1 }}>
          Ngân hàng
          <BankSelect
            value={form.bank || ''}
            onChange={val => setForm(p => ({ ...p, bank: val }))}
            placeholder="Chọn ngân hàng"
          />
        </label>
      </div>

      <div className="fin-form__row">
        <label className="fin-label" style={{ flex: 1 }}>
          Số tài khoản / Số sổ
          <input
            className="fin-input"
            inputMode="numeric"
            pattern="[0-9]*"
            value={form.account_no || ''}
            onChange={field('account_no', value => sanitizeDigits(value, 32))}
            aria-label="Số tài khoản"
            placeholder="Tùy chọn"
          />
        </label>
        <label className="fin-label" style={{ flex: 1 }}>
          Số tiền đang gửi (VNĐ)
          <input
            className="fin-input"
            inputMode="numeric"
            pattern="[0-9]*"
            value={form.amount || ''}
            onChange={field('amount', sanitizeDigits)}
            aria-label="Số tiền đang gửi"
            placeholder="Ví dụ: 50.000.000"
          />
        </label>
      </div>

      <div className="fin-form__row">
        <label className="fin-label">
          Lãi suất · %/năm
          <input
            className="fin-input"
            inputMode="decimal"
            value={form.rate || ''}
            onChange={field('rate', value => sanitizeDecimal(value, 3, 4))}
            placeholder="5,2"
          />
        </label>
        <label className="fin-label">
          Kỳ hạn
          <select className="fin-input" value={form.term || ''} onChange={field('term')}>
            <option value="">Không kỳ hạn</option>
            <option value="1">1 tháng</option>
            <option value="3">3 tháng</option>
            <option value="6">6 tháng</option>
            <option value="12">12 tháng</option>
            <option value="18">18 tháng</option>
            <option value="24">24 tháng</option>
            <option value="36">36 tháng</option>
          </select>
        </label>
      </div>

      <div className="fin-form__row">
        <label className="fin-label">
          Ngày gửi
          <DateField value={form.opened_at} onChange={(v) => setForm(p => ({ ...p, opened_at: v }))} />
        </label>
        <label className="fin-label">
          Ngày đáo hạn
          <span className="fin-input fin-input--readonly">{maturity || 'Không kỳ hạn · rút lúc nào cũng được'}</span>
        </label>
      </div>

      {deposit && (
        <label className="fin-label">
          Ngày tất toán
          <DateField value={form.closed_on} onChange={(v) => setForm(p => ({ ...p, closed_on: v }))} />
        </label>
      )}

      <p className="fin-note">Ngày đáo hạn được tự tính từ ngày gửi và kỳ hạn, không nhập tay để tránh dữ liệu lệch.</p>

      <div className="fin-editor__actions">
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
    <div className="fin-editor__title"><strong>{dir === 'in' ? `Gửi thêm · ${goal.name}` : `Rút khỏi · ${goal.name}`}</strong><button type="button" className="fin-icon-btn" aria-label="Đóng form gửi/rút" onClick={onDone}><AppIcon name="x" size={14} /></button></div>
    <select className="fin-input" aria-label="Chọn nơi gửi" value={depositId} onChange={e => setDepositId(e.target.value)}>{deposits.map(d => <option key={d.id} value={d.id}>{d.name} · {money(d.amount)}</option>)}</select>
    <input className="fin-input" inputMode="numeric" pattern="[0-9]*" value={amount} onChange={e => setAmount(sanitizeDigits(e.target.value))} aria-label="Số tiền" placeholder="Số tiền" />
    <div className="fin-form__row"><label className="fin-label">Ngày thực hiện<DateField value={occurredAt} onChange={setOccurredAt} /></label><label className="fin-label">Tiêu đề<input className="fin-input" value={note} onChange={e => setNote(e.target.value)} placeholder="Tùy chọn" /></label></div>
    <label className="fin-label">Task liên quan</label><TaskPicker tasks={pendingTasks} value={taskId} onPick={setTaskId} />
    {dir === 'out' && effectiveLock === 'term' && !ready && <div className="fin-warn fin-inline-message"><AppIcon name="clock" size={15} /> Rút sớm cần một yêu cầu và chờ 48 giờ để bạn có thời gian đổi ý.</div>}
    {dir === 'out' && effectiveLock === 'external' && <div className="fin-warn fin-inline-message"><AppIcon name="warning" size={15} /> Đây là sổ thật ngoài app. Rút trước hạn có thể mất toàn bộ lãi.</div>}
    <button className="fin-btn fin-btn--primary fin-btn--sm" disabled={!deposit || !parseCurrencyInput(amount) || (dir === 'out' && parseCurrencyInput(amount) > (deposit?.amount || 0))}><AppIcon name={dir === 'in' ? 'arrowDown' : 'arrowUp'} size={14} /> {dir === 'out' && effectiveLock === 'term' && !ready ? 'Gửi yêu cầu rút' : 'Xác nhận'}</button>
  </form>;
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
