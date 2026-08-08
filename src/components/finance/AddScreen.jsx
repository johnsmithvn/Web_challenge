import { useEffect, useMemo, useState } from 'react';
import { useUserTasks } from '../../hooks/useUserTasks';
import { parseCurrencyInput, sanitizeDigits } from '../../utils/currencyUtils';
import { matchCategory, deriveNecessity, currentMonthPeriod, cardBalance, billAmountEstimate } from '../../utils/financeLogic';
import {
  money, catInfo, subLabel, NECESSITY_META, Segmented, TaskPicker, FinanceIcon,
} from './parts';
import AppIcon from '../AppIcon';

const TYPE_OPTS = [
  { value: 'expense', label: 'Chi' },
  { value: 'income', label: 'Thu' },
  { value: 'saving', label: 'Để dành' },
];

const AMOUNT_STEPS = [10000, 20000, 50000, 100000, 200000];
const QUICK_STEPS = [5000, 10000, 20000, 50000, 100000];
const NEED_ICONS = { must: 'lock', need: 'checkCircle', want: 'sparkle' };

function shiftDate(ymd, days) {
  const date = new Date(`${ymd}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function amountStepLabel(value) {
  return `+${value >= 1000000 ? `${value / 1000000}tr` : `${value / 1000}k`}`;
}

export default function AddScreen({ fin, nav }) {
  const { pendingTasks } = useUserTasks();
  const cats = fin.cats;
  const [nl, setNl] = useState('');
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('food');
  const [incomeCategoryId, setIncomeCategoryId] = useState('luong');
  const [subId, setSubId] = useState('');
  const [necessity, setNecessity] = useState('');
  const [sourceCardId, setSourceCardId] = useState('');
  const [savingGoalId, setSavingGoalId] = useState('');
  const [savingDepositId, setSavingDepositId] = useState('');
  const [savingDir, setSavingDir] = useState('in');
  const [note, setNote] = useState('');
  const [taskId, setTaskId] = useState(null);
  const [occurredAt, setOccurredAt] = useState(fin.today);
  const [merchant, setMerchant] = useState('');
  const [draftItems, setDraftItems] = useState([]);
  const [showMore, setShowMore] = useState(false);
  const [quickAmount, setQuickAmount] = useState('');
  const [armedShortcutId, setArmedShortcutId] = useState(null);
  const [shortcutEditing, setShortcutEditing] = useState(false);

  useEffect(() => {
    if (nav.handoff?.kind !== 'tx') return;
    if (nav.handoff.title) setNl(nav.handoff.title);
    if (nav.handoff.amount) setAmount(String(nav.handoff.amount));
  }, [nav.handoff]);

  const expenseGroup = cats.expenseGroups.find(group => group.key === categoryId);
  const parsedAmount = parseCurrencyInput(amount);
  const autoNecessity = deriveNecessity(categoryId, subId, cats);
  const appliedNecessity = necessity || autoNecessity;
  const nlGuess = useMemo(() => matchCategory(nl), [nl]);
  const currentMonth = currentMonthPeriod(fin.today);
  const currentPeriodKey = currentMonth.from.slice(0, 7);
  const selectedGoal = fin.goals.find(goal => goal.id === savingGoalId);
  const selectedDeposit = fin.deposits.find(deposit => deposit.id === savingDepositId);

  const selectedCard = fin.cards.find(card => card.id === sourceCardId);
  const selectedCardUsed = selectedCard ? cardBalance(selectedCard.id, fin.transactions) : 0;

  const estimateFor = (billId) => {
    const estimate = billAmountEstimate(fin.bills.find(bill => bill.id === billId) || {}, fin.transactions);
    return estimate ? String(estimate) : '';
  };

  const pendingBills = useMemo(() => {
    const paidIds = new Set(fin.transactions
      .filter(tx => tx.bill_period === currentPeriodKey && tx.bill_id)
      .map(tx => tx.bill_id));
    const todayDate = new Date(`${fin.today}T12:00:00`);
    const lastDay = Number(currentMonth.to.slice(-2));
    return fin.bills
      .filter(bill => bill.enabled && !bill.finished_at && !paidIds.has(bill.id)
        && !(bill.skipped_periods || []).includes(currentPeriodKey))
      .map(bill => {
        const day = Math.min(lastDay, Math.max(1, Number(bill.due_day) || 1));
        const dueDate = `${currentPeriodKey}-${String(day).padStart(2, '0')}`;
        const days = Math.round((new Date(`${dueDate}T12:00:00`) - todayDate) / 86400000);
        return { ...bill, dueDate, days };
      })
      .sort((a, b) => a.days - b.days);
  }, [fin.transactions, fin.bills, currentPeriodKey, currentMonth.to, fin.today]);

  const shortcuts = useMemo(() => {
    const defaults = cats.shortcutSeed.map((shortcut, index) => ({
      ...shortcut, id: `seed-${index}`, seed: true, recent_amounts: [], use_count: 0,
      necessity: deriveNecessity(shortcut.category_id, shortcut.subcategory_id, cats),
    }));
    if (!fin.shortcuts.length) return defaults;
    const savedPaths = new Set(fin.shortcuts.map(shortcut => `${shortcut.category_id}:${shortcut.subcategory_id || ''}`));
    return [...fin.shortcuts, ...defaults.filter(shortcut => !savedPaths.has(`${shortcut.category_id}:${shortcut.subcategory_id || ''}`))];
  }, [fin.shortcuts, cats]);

  const duplicateBill = type === 'expense' && subId
    ? fin.bills.find(bill => bill.enabled && bill.subcategory_id === subId)
    : null;

  const applyNl = () => {
    if (nlGuess) {
      setCategoryId(nlGuess.categoryId);
      setSubId(nlGuess.subId);
      setType('expense');
    }
    const parsed = parseCurrencyInput(nl);
    if (parsed) setAmount(String(parsed));
    if (!note) setNote(nl.replace(/\d[\d.,]*\s*[kKmM]?/g, '').trim());
  };

  const addAmount = (setter, raw, step) => {
    const next = (parseCurrencyInput(raw) || 0) + step;
    setter(String(next));
  };

  const updateDraftItem = (index, key, value) => {
    const normalized = key === 'qty' ? sanitizeDigits(value, 3)
      : key === 'price' ? sanitizeDigits(value) : value;
    const next = draftItems.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: normalized } : item);
    setDraftItems(next);
    const total = next.reduce((sum, item) => sum
      + (Math.max(1, Number(item.qty) || 1) * (parseCurrencyInput(item.price) || 0)), 0);
    if (total > 0) setAmount(String(total));
  };

  const reset = () => {
    setNl('');
    setAmount('');
    setNote('');
    setSubId('');
    setNecessity('');
    setSourceCardId('');
    setSavingGoalId('');
    setSavingDepositId('');
    setSavingDir('in');
    setTaskId(null);
    setOccurredAt(fin.today);
    setMerchant('');
    setDraftItems([]);
    setShowMore(false);
  };

  const saveTransaction = async (stayOnForm = false) => {
    if (!parsedAmount || parsedAmount <= 0) {
      nav.showToast('Nhập số tiền trước đã');
      return;
    }

    let tx = null;
    if (type === 'saving') {
      if (!selectedGoal || !selectedDeposit) return;
      const request = selectedGoal.withdrawal_request;
      const requestReady = request
        && request.deposit_id === selectedDeposit.id
        && new Date(request.available_at).getTime() <= Date.now();
      if (savingDir === 'out' && selectedGoal.lock_mode === 'term' && !requestReady) {
        const created = await fin.requestSavingWithdrawal(selectedGoal.id, selectedDeposit.id, parsedAmount);
        if (created) {
          nav.showToast('Đã tạo yêu cầu rút — có thể hoàn tất sau 48 giờ', { icon: 'clock' });
          reset();
        }
        return;
      }
      tx = await fin.moveSaving(selectedGoal, selectedDeposit, savingDir, {
        amount: parsedAmount, occurredAt, note: note || null, taskId,
      });
    } else {
      const row = {
        type,
        amount: parsedAmount,
        occurred_at: occurredAt,
        note: note || null,
        merchant: merchant || null,
        items: draftItems
          .filter(item => item.name?.trim() || parseCurrencyInput(item.price))
          .map(item => ({
            name: item.name?.trim() || 'Mục chưa đặt tên',
            qty: Math.max(1, Number(item.qty) || 1),
            price: parseCurrencyInput(item.price) || 0,
          })),
        inbox_item_id: nav.handoff?.kind === 'tx' ? nav.handoff.inboxId : null,
        task_id: taskId,
      };
      if (type === 'expense') Object.assign(row, {
        category_id: categoryId,
        subcategory_id: subId || null,
        necessity: appliedNecessity,
        source_card_id: sourceCardId || null,
      });
      if (type === 'income') row.category_id = incomeCategoryId;
      tx = await fin.addTransaction(row);
    }

    if (!tx) return;
    nav.showToast(
      type === 'income' ? 'Đã ghi khoản thu — không đưa vào tỉ lệ chi'
        : type === 'saving' ? `Đã ${savingDir === 'out' ? 'rút khỏi' : 'gửi vào'} quỹ`
          : 'Đã ghi chi tiêu — báo cáo kỳ này đã cập nhật',
      { icon: 'checkCircle' },
    );
    if (nav.handoff?.kind === 'tx' && nav.handoff.inboxId) {
      try {
        const { supabase } = await import('../../lib/supabase');
        await supabase.from('collections').delete().eq('id', nav.handoff.inboxId);
      } catch { /* best-effort handoff cleanup */ }
    }
    nav.clearHandoff();
    reset();
    if (!stayOnForm) nav.go('overview');
  };

  const payPendingBill = async (bill, rawAmount) => {
    const value = parseCurrencyInput(rawAmount);
    if (!value) return;
    const tx = await fin.payBill(bill, { amount: value });
    if (tx) nav.showToast(`Đã thanh toán ${bill.name} và cập nhật báo cáo`, { icon: 'checkCircle' });
  };

  const recordShortcut = async (shortcut, rawAmount = quickAmount) => {
    const value = parseCurrencyInput(rawAmount);
    if (!value) {
      setArmedShortcutId(shortcut.id);
      setCategoryId(shortcut.category_id);
      setSubId(shortcut.subcategory_id || '');
      setNecessity(shortcut.necessity || '');
      setSourceCardId(shortcut.source_card_id || '');
      return;
    }
    const tx = await fin.addTransaction({
      type: 'expense', amount: value, occurred_at: fin.today,
      category_id: shortcut.category_id, subcategory_id: shortcut.subcategory_id || null,
      necessity: shortcut.necessity || deriveNecessity(shortcut.category_id, shortcut.subcategory_id, cats),
      source_card_id: shortcut.source_card_id || null,
      shortcut_id: shortcut.seed ? null : shortcut.id,
      note: shortcut.name,
    });
    if (!tx) return;
    if (!shortcut.seed) {
      const recent = [value, ...(shortcut.recent_amounts || []).filter(item => item !== value)].slice(0, 3);
      await fin.updateShortcut(shortcut.id, { recent_amounts: recent, use_count: (shortcut.use_count || 0) + 1 });
    }
    nav.showToast(`Đã ghi ${shortcut.name} · ${money(value)}`, { icon: 'lightning' });
    setQuickAmount('');
    setArmedShortcutId(null);
  };

  const openShortcutInForm = (shortcut) => {
    setType('expense');
    setCategoryId(shortcut.category_id);
    setSubId(shortcut.subcategory_id || '');
    setNecessity(shortcut.necessity || '');
    setSourceCardId(shortcut.source_card_id || '');
    if (parseCurrencyInput(quickAmount)) setAmount(String(parseCurrencyInput(quickAmount)));
    setArmedShortcutId(null);
  };

  const pinCurrentShortcut = async () => {
    if (type !== 'expense') return;
    const name = subLabel(subId, cats) || catInfo(categoryId, cats).label;
    const duplicate = fin.shortcuts.some(shortcut => shortcut.name.toLowerCase() === name.toLowerCase()
      && shortcut.category_id === categoryId && (shortcut.subcategory_id || '') === subId);
    if (duplicate) {
      nav.showToast(`${name} đã có trong Shortcut`);
      return;
    }
    const shortcut = await fin.addShortcut({
      name, category_id: categoryId, subcategory_id: subId || null,
      necessity: appliedNecessity, source_card_id: sourceCardId || null,
      recent_amounts: parsedAmount ? [parsedAmount] : [],
      sort_order: fin.shortcuts.length,
    });
    if (shortcut) nav.showToast(`Đã ghim ${name} vào Shortcut`, { icon: 'pushPin' });
  };

  const categoryOptions = type === 'income'
    ? cats.incomeGroups.filter(group => !group.hidden)
    : cats.expenseGroups.filter(group => !group.hidden);
  const activeCategoryId = type === 'income' ? incomeCategoryId : categoryId;
  const selectedNeedMeta = NECESSITY_META[appliedNecessity] || NECESSITY_META.need;
  const yesterday = shiftDate(fin.today, -1);

  return (
    <div className="fin-add">
      {pendingBills.length > 0 && (
        <section className={`fin-pending-bills${pendingBills.some(bill => bill.days < 0) ? ' fin-pending-bills--late' : ''}`}>
          <div className="fin-pending-bills__head">
            <AppIcon name="receipt" size={16} weight="fill" />
            <strong>{pendingBills.length} hóa đơn đang chờ bạn ghi{pendingBills.some(bill => bill.days < 0) ? ' · có khoản quá hạn' : ''}</strong>
            <button type="button" onClick={() => nav.go('recurring')}>Xem tất cả <AppIcon name="caretRight" size={12} /></button>
          </div>
          <div className="fin-pending-bills__list">
            {pendingBills.slice(0, 5).map(bill => (
              <PendingBillRow key={bill.id} bill={bill} estimate={estimateFor(bill.id)}
                cats={cats} onPay={payPendingBill}
                onDismiss={async () => {
                  const skipped = await fin.skipBillPeriod(bill.id, currentPeriodKey);
                  if (skipped) nav.showToast(`Đã bỏ qua ${bill.name} trong ${currentPeriodKey}`, { icon: 'calendar' });
                }} />
            ))}
          </div>
        </section>
      )}

      <div className="fin-add-grid">
        <form className="fin-card fin-entry-card" onSubmit={(event) => { event.preventDefault(); saveTransaction(false); }}>
          <div className="fin-entry-card__head">
            <span>Một khoản mới</span>
            <Segmented options={TYPE_OPTS} value={type} onChange={setType} />
          </div>

          <div className="fin-smart-input">
            <AppIcon name="sparkle" size={17} weight="fill" />
            <input value={nl} onChange={event => setNl(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); applyNl(); } }}
              placeholder="Gõ tự nhiên: “nước ép 45k”, “xăng 50 nghìn”, “netflix 260k”…" />
          </div>
          {(nlGuess || parseCurrencyInput(nl) > 0) && (
            <button type="button" className="fin-smart-result" onClick={applyNl}>
              <span>Hiểu là</span>
              {parseCurrencyInput(nl) > 0 && <b>{money(parseCurrencyInput(nl))}</b>}
              {nlGuess && <b><FinanceIcon categoryId={nlGuess.categoryId} cats={cats} size={13} /> {subLabel(nlGuess.subId, cats) || catInfo(nlGuess.categoryId, cats).label}</b>}
              <small>chạm để điền form</small>
            </button>
          )}

          <section className="fin-entry-section fin-amount-field">
            <label>Số tiền</label>
            <div><input autoFocus inputMode="numeric" pattern="[0-9]*" placeholder="0" value={amount}
              onChange={event => setAmount(sanitizeDigits(event.target.value))} /><span>₫</span></div>
            <div className="fin-step-row">
              {AMOUNT_STEPS.map(step => <button key={step} type="button" onClick={() => addAmount(setAmount, amount, step)}>{amountStepLabel(step)}</button>)}
            </div>
          </section>

          {type !== 'saving' && (
            <>
              <section className="fin-entry-section">
                <div className="fin-field-heading"><label>{type === 'income' ? 'Nhóm thu' : 'Nhóm'}</label><small>{categoryOptions.length} nhóm, xếp theo cách bạn dùng</small></div>
                <div className="fin-category-picker">
                  {categoryOptions.map(category => (
                    <button key={category.key} type="button"
                      className={activeCategoryId === category.key ? 'is-active' : ''}
                      style={{ '--cat-color': category.color }}
                      onClick={() => type === 'income' ? setIncomeCategoryId(category.key) : (setCategoryId(category.key), setSubId(''))}>
                      <FinanceIcon name={category.icon} cats={cats} size={16} weight={activeCategoryId === category.key ? 'fill' : 'regular'} />
                      <span>{category.label}</span>
                    </button>
                  ))}
                </div>
              </section>

              {type === 'expense' && (
                <section className="fin-entry-section">
                  <div className="fin-field-heading"><label>Danh mục con</label><small>bỏ qua cũng được — thống kê vẫn chạy ở cấp nhóm</small></div>
                  <div className="fin-subcategory-picker">
                    {(expenseGroup?.subs || []).map(sub => (
                      <button key={sub.key} type="button" className={subId === sub.key ? 'is-active' : ''}
                        onClick={() => setSubId(current => current === sub.key ? '' : sub.key)}>
                        <AppIcon name={NEED_ICONS[sub.necessity || deriveNecessity(categoryId, sub.key, cats)]} size={11} />
                        {sub.label}
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {type === 'expense' && (
            <>
              <section className="fin-necessity-picker">
                <AppIcon name={NEED_ICONS[appliedNecessity]} size={16} style={{ color: selectedNeedMeta.color }} />
                <span><strong>{selectedNeedMeta.label}</strong><small>{necessity ? 'Bạn đã chỉnh cho khoản này' : 'Tự suy từ danh mục con; chỉ sửa khi thấy chưa đúng'}</small></span>
                <div>
                  {Object.entries(NECESSITY_META).map(([key, meta]) => (
                    <button key={key} type="button" title={meta.label}
                      className={appliedNecessity === key ? 'is-active' : ''}
                      style={{ '--need-color': meta.color }} onClick={() => setNecessity(key)}>
                      <AppIcon name={NEED_ICONS[key]} size={14} weight={appliedNecessity === key ? 'fill' : 'regular'} />
                    </button>
                  ))}
                </div>
              </section>

              <section className="fin-entry-section">
                <div className="fin-field-heading"><label>Trả bằng</label><small>tiền có sẵn hết là hết — thẻ thì dịch ngày phải trả</small></div>
                <div className="fin-source-picker">
                  <button type="button" className={!sourceCardId ? 'is-active' : ''} onClick={() => setSourceCardId('')}>
                    <AppIcon name="cash" size={15} /> Tiền có sẵn
                  </button>
                  {fin.cards.map(card => (
                    <button key={card.id} type="button" className={sourceCardId === card.id ? 'is-active' : ''}
                      onClick={() => setSourceCardId(card.id)}><AppIcon name="creditCard" size={15} /> {card.name}{card.last4 ? ` ••${card.last4}` : ''}</button>
                  ))}
                </div>
                <div className="fin-source-card">
                  <AppIcon name={selectedCard ? 'creditCard' : 'wallet'} size={16} />
                  {selectedCard ? <div><strong>Còn {money(Math.max(0, selectedCard.credit_limit - selectedCardUsed))}</strong><span>Hạn mức {money(selectedCard.credit_limit)} · chốt ngày {selectedCard.statement_day} · đến hạn ngày {selectedCard.due_day}</span></div>
                    : <div><strong>Tiền có sẵn</strong><span>Khoản này trừ ngay khỏi số tiền bạn đang có, không tạo ngày phải trả.</span></div>}
                </div>
              </section>

              {duplicateBill && <div className="fin-recurring-match"><AppIcon name="arrowsClockwise" size={16} /><span><strong>Có thể trùng {duplicateBill.name}</strong><small>Khoản định kỳ cùng danh mục đang chờ. Thanh toán từ Hóa đơn để gắn đúng kỳ.</small></span><button type="button" onClick={() => nav.go('recurring')}>Mở hóa đơn</button></div>}
            </>
          )}

          {type === 'saving' && (
            <section className="fin-saving-entry">
              <div className="fin-info-strip"><AppIcon name="piggyBank" size={17} /><span>Để dành không phải chi tiêu — tiền chỉ đổi chỗ và đứng ngoài mọi biểu đồ chi.</span></div>
              <div className="fin-saving-dir">
                <button type="button" className={savingDir === 'in' ? 'is-active' : ''} onClick={() => setSavingDir('in')}><AppIcon name="arrowDown" size={15} /> Gửi vào quỹ</button>
                <button type="button" className={savingDir === 'out' ? 'is-active' : ''} onClick={() => setSavingDir('out')}><AppIcon name="arrowUp" size={15} /> Rút khỏi quỹ</button>
              </div>
              <div className="fin-goal-picker">
                {fin.goals.map(goal => {
                  const balance = fin.deposits.filter(deposit => deposit.fund_id === goal.id).reduce((sum, deposit) => sum + deposit.amount, 0);
                  return <button key={goal.id} type="button" className={savingGoalId === goal.id ? 'is-active' : ''}
                    onClick={() => { setSavingGoalId(goal.id); setSavingDepositId(''); }}>
                    <AppIcon name="piggyBank" size={16} /><span><strong>{goal.name}</strong><small>{money(balance)}{goal.goal ? ` / ${money(goal.goal)}` : ''}</small></span>
                  </button>;
                })}
              </div>
              <label className="fin-label">Nơi gửi</label>
              <select className="fin-input" value={savingDepositId} onChange={event => setSavingDepositId(event.target.value)} disabled={!savingGoalId}>
                <option value="">— chọn sổ / nơi giữ —</option>
                {fin.deposits.filter(deposit => deposit.fund_id === savingGoalId).map(deposit => <option key={deposit.id} value={deposit.id}>{deposit.name} · {money(deposit.amount)}</option>)}
              </select>
              {selectedGoal?.lock_mode === 'term' && savingDir === 'out' && <div className="fin-warn fin-inline-message"><AppIcon name="clock" size={15} /> Lệnh rút từ quỹ kỳ hạn phải chờ 48 giờ.</div>}
              {selectedGoal?.lock_mode === 'external' && savingDir === 'out' && <div className="fin-warn fin-inline-message"><AppIcon name="warning" size={15} /> Rút sổ ngoài app trước hạn có thể mất lãi.</div>}
            </section>
          )}

          <div className="fin-entry-meta">
            <div>
              <label>Ngày</label>
              <div className="fin-date-choice">
                <button type="button" className={occurredAt === fin.today ? 'is-active' : ''} onClick={() => setOccurredAt(fin.today)}>Hôm nay</button>
                <button type="button" className={occurredAt === yesterday ? 'is-active' : ''} onClick={() => setOccurredAt(yesterday)}>Hôm qua</button>
                <input type="date" value={occurredAt} max={fin.today} onChange={event => setOccurredAt(event.target.value)} aria-label="Chọn ngày khác" />
              </div>
            </div>
            <div><label>Ghi chú</label><input className="fin-input" value={note} maxLength={200} onChange={event => setNote(event.target.value)} placeholder="Tùy chọn" /></div>
          </div>

          <div className="fin-task-link-row">
            <span><AppIcon name="pushPin" size={15} /> Nhiệm vụ liên quan</span>
            <TaskPicker tasks={pendingTasks} value={taskId} onPick={setTaskId} />
          </div>

          <button type="button" className="fin-more-toggle" onClick={() => setShowMore(current => !current)}>
            <AppIcon name={showMore ? 'caretDown' : 'caretRight'} size={14} /> {showMore ? 'Ẩn thông tin thêm' : 'Thông tin thêm'}
          </button>
          {showMore && (
            <div className="fin-form__more">
              <label className="fin-label">Nơi / người nhận</label>
              <input className="fin-input" value={merchant} onChange={event => setMerchant(event.target.value)} placeholder="Quán nước Bà Ba" />
              <div className="fin-items-editor">
                <div className="fin-items-editor__head"><AppIcon name="listBullets" size={16} /><strong>Chi tiết từng món</strong><small>tổng tự cộng lên số tiền</small></div>
                {draftItems.map((item, index) => (
                  <div className="fin-item-row" key={index}>
                    <input className="fin-input" value={item.name} onChange={event => updateDraftItem(index, 'name', event.target.value)} placeholder="Tên món" />
                    <input className="fin-input" inputMode="numeric" pattern="[0-9]*" value={item.qty} onChange={event => updateDraftItem(index, 'qty', event.target.value)} aria-label="Số lượng" />
                    <input className="fin-input" inputMode="numeric" pattern="[0-9]*" value={item.price} onChange={event => updateDraftItem(index, 'price', event.target.value)} placeholder="Đơn giá" />
                    <button type="button" aria-label="Xóa món" onClick={() => setDraftItems(current => current.filter((_, itemIndex) => itemIndex !== index))}><AppIcon name="x" size={14} /></button>
                  </div>
                ))}
                <button type="button" className="fin-inline-command" onClick={() => setDraftItems(current => [...current, { name: '', qty: '1', price: '' }])}><AppIcon name="plus" size={14} /> Thêm món</button>
              </div>
              <div className="fin-more-actions">
                {type === 'expense' && <button type="button" onClick={pinCurrentShortcut}><AppIcon name="pushPin" size={15} /> Ghim thành shortcut</button>}
                <button type="button" onClick={() => nav.go('recurring')}><AppIcon name="arrowsClockwise" size={15} /> Biến thành khoản định kỳ</button>
              </div>
            </div>
          )}

          <div className="fin-entry-actions">
            <button type="submit" className="fin-btn fin-btn--primary" disabled={!parsedAmount || (type === 'saving' && (!selectedGoal || !selectedDeposit || (savingDir === 'out' && parsedAmount > selectedDeposit.amount)))}><AppIcon name="check" size={16} weight="bold" /> Lưu</button>
            <button type="button" className="fin-btn fin-btn--secondary" disabled={!parsedAmount || (type === 'saving' && (!selectedGoal || !selectedDeposit))} onClick={() => saveTransaction(true)}>Lưu & nhập tiếp</button>
            <small>Enter để lưu · Esc để hủy</small>
          </div>
        </form>

        <aside className="fin-add-aside">
          {type === 'expense' && (
            <section className="fin-card fin-shortcut-panel">
              <div className="fin-shortcut-panel__head"><span><AppIcon name="lightning" size={16} weight="fill" /> Shortcut</span><button type="button" onClick={() => setShortcutEditing(current => !current)}>{shortcutEditing ? 'Xong' : 'Sửa shortcut'}</button></div>
              <div className="fin-quick-amount">
                <div><span>Gõ số một lần rồi chạm khoản bên dưới</span>{quickAmount && <button type="button" onClick={() => setQuickAmount('')}>xóa</button>}</div>
                <label><input inputMode="numeric" pattern="[0-9]*" value={quickAmount} onChange={event => setQuickAmount(sanitizeDigits(event.target.value))} placeholder="0" /><span>₫</span></label>
                <div className="fin-step-row">{QUICK_STEPS.map(step => <button key={step} type="button" onClick={() => addAmount(setQuickAmount, quickAmount, step)}>{amountStepLabel(step)}</button>)}</div>
              </div>
              <div className="fin-shortcut-list">
                {shortcuts.map(shortcut => {
                  const info = catInfo(shortcut.category_id, cats);
                  const need = NECESSITY_META[shortcut.necessity || deriveNecessity(shortcut.category_id, shortcut.subcategory_id, cats)];
                  const armed = armedShortcutId === shortcut.id;
                  return <article key={shortcut.id} className={armed ? 'is-armed' : ''}>
                    <div className="fin-shortcut-row">
                      <button type="button" className="fin-shortcut-main" onClick={() => recordShortcut(shortcut)}>
                        <span className="fin-shortcut-main__icon" style={{ color: info.color }}><FinanceIcon name={info.icon} cats={cats} size={16} /></span>
                        <span><strong>{shortcut.name}<i style={{ color: need.color }}>{need.label}</i></strong><small>{info.label}{subLabel(shortcut.subcategory_id, cats) ? ` › ${subLabel(shortcut.subcategory_id, cats)}` : ''}</small></span>
                        <em>{parseCurrencyInput(quickAmount) ? `ghi ${money(parseCurrencyInput(quickAmount))}` : shortcut.recent_amounts?.[0] ? `thường ${money(shortcut.recent_amounts[0])}` : 'gõ số tiền'}</em>
                      </button>
                      {shortcutEditing && !shortcut.seed && <button type="button" className="fin-shortcut-delete" aria-label={`Xóa ${shortcut.name}`} onClick={() => fin.deleteShortcut(shortcut.id)}><AppIcon name="trash" size={14} /></button>}
                    </div>
                    {armed && <div className="fin-shortcut-armed">
                      <div><input autoFocus inputMode="numeric" pattern="[0-9]*" value={quickAmount} onChange={event => setQuickAmount(sanitizeDigits(event.target.value))} placeholder="Số tiền" /><span>₫</span><button type="button" onClick={() => recordShortcut(shortcut)} disabled={!parseCurrencyInput(quickAmount)}><AppIcon name="check" size={14} /> Ghi</button></div>
                      <footer><span>hay nhập:</span>{(shortcut.recent_amounts || []).map(value => <button type="button" key={value} onClick={() => recordShortcut(shortcut, String(value))}>{money(value)}</button>)}<button type="button" onClick={() => openShortcutInForm(shortcut)}>mở form đầy đủ</button></footer>
                    </div>}
                  </article>;
                })}
              </div>
              <button type="button" className="fin-inline-command" onClick={pinCurrentShortcut}><AppIcon name="plus" size={14} /> Tạo shortcut từ form</button>
            </section>
          )}
          <section className="fin-card fin-entry-help"><strong>Ba cách ghi, chọn cách nào cũng được</strong><p>Gõ tự nhiên một dòng, chạm shortcut, hoặc điền form. Cả ba đều tạo cùng một bản ghi chuẩn và đều có thể gắn với nhiệm vụ.</p></section>
        </aside>
      </div>
    </div>
  );
}

function PendingBillRow({ bill, estimate, cats, onPay, onDismiss }) {
  const [value, setValue] = useState(bill.amount_mode === 'fixed' ? String(bill.amount || '') : estimate);
  const info = catInfo(bill.category_id, cats);
  const status = bill.days < 0 ? `quá hạn ${Math.abs(bill.days)} ngày` : bill.days === 0 ? 'đến hạn hôm nay' : `còn ${bill.days} ngày`;
  return (
    <div className="fin-pending-bill">
      <span className="fin-pending-bill__icon" style={{ color: info.color }}><FinanceIcon name={info.icon} cats={cats} size={14} /></span>
      <span><strong>{bill.name}</strong><small className={bill.days < 0 ? 'is-late' : ''}>{status} · {info.label}{subLabel(bill.subcategory_id, cats) ? ` › ${subLabel(bill.subcategory_id, cats)}` : ''}</small></span>
      {bill.amount_mode === 'ask'
        ? <input inputMode="numeric" pattern="[0-9]*" value={value} onChange={event => setValue(sanitizeDigits(event.target.value))} placeholder={estimate ? `~ ${money(estimate)}` : 'Số tiền'} />
        : <b>{money(bill.amount)}</b>}
      <button type="button" onClick={() => onPay(bill, value)} disabled={!parseCurrencyInput(value)}>Thanh toán</button>
      <button type="button" className="fin-pending-bill__dismiss" onClick={onDismiss} aria-label={`Bỏ ${bill.name} trong kỳ này`}><AppIcon name="x" size={13} /></button>
    </div>
  );
}
