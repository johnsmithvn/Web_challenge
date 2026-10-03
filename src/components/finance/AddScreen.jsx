import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUserTasks } from '../../hooks/useUserTasks';
import { autoKPreview, groupDigits, parseCurrencyInput, sanitizeDigits, stripAmountWords } from '../../utils/currencyUtils';
import { matchCategory, deriveNecessity, cardBalance, billAmountEstimate, billCycle, billSettled, canDepositTopUp } from '../../utils/financeLogic';
import {
  money, catInfo, subLabel, pickableSubs, NECESSITY_META, Segmented, TaskPicker, FinanceIcon, DateField,
} from './parts';
import AppIcon from '../AppIcon';

const TYPE_OPTS = [
  { value: 'expense', label: 'Chi' },
  { value: 'income', label: 'Thu' },
  { value: 'saving', label: 'Để dành' },
];

const HIDDEN_SEEDS_KEY = 'lh_fin_hidden_seed_shortcuts';
const seedPath = (shortcut) => `${shortcut.category_id}:${shortcut.subcategory_id || ''}`;

function readHiddenSeeds() {
  try { return JSON.parse(localStorage.getItem(HIDDEN_SEEDS_KEY) || '[]'); } catch { return []; }
}

const QUICK_CHIPS = [10000, 20000, 50000, 100000];
const NEED_ICONS = { must: 'lock', want: 'sparkle' };

function shiftDate(ymd, days) {
  const date = new Date(`${ymd}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function AddScreen({ fin, nav }) {
  const { pendingTasks } = useUserTasks();
  const cats = fin.cats;

  // Form states
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
  const [description, setDescription] = useState('');
  const [draftItems, setDraftItems] = useState([]);
  const [showMore, setShowMore] = useState(false);
  const [pendingBillId, setPendingBillId] = useState(null);

  // Popover bills state
  const [billsOpen, setBillsOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // Shortcut accordion state
  const [expandedShortcutId, setExpandedShortcutId] = useState(null);
  const [shortcutAmount, setShortcutAmount] = useState('');
  const [shortcutEditing, setShortcutEditing] = useState(false);
  const [hiddenSeeds, setHiddenSeeds] = useState(readHiddenSeeds);

  // Mobile view state
  const [mobileView, setMobileView] = useState('quick'); // 'quick' | 'form'

  // Undo Toast state
  const [undoToast, setUndoToast] = useState(null);
  const undoTimerRef = useRef(null);

  const shortcutInputRef = useRef(null);

  const setHidden = (next) => {
    setHiddenSeeds(next);
    try { localStorage.setItem(HIDDEN_SEEDS_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  };

  const showUndoToast = (text, txId) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast({ text, txId });
    undoTimerRef.current = setTimeout(() => {
      setUndoToast(null);
    }, 6000);
  };

  const handleUndo = async () => {
    if (!undoToast?.txId) return;
    const id = undoToast.txId;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast(null);
    const ok = await fin.deleteTransaction(id);
    if (ok) {
      nav.showToast('Đã hoàn tác giao dịch vừa ghi', { icon: 'arrowCounterClockwise' });
    }
  };

  // Focus ô nhập tiền của shortcut khi mở accordion
  useEffect(() => {
    if (expandedShortcutId && shortcutInputRef.current) {
      shortcutInputRef.current.focus();
    }
  }, [expandedShortcutId]);

  // Handoff từ Inbox (bảo toàn an toàn)
  useEffect(() => {
    if (nav.handoff?.kind !== 'tx') return;
    const text = nav.handoff.title || '';
    if (text) {
      setNote(stripAmountWords(text) || text);
      setType('expense');
      const guess = matchCategory(text);
      setCategoryId(guess ? guess.categoryId : 'other');
      setSubId(guess ? guess.subId : 'other.unclassified');
    }
    const amountFromText = parseCurrencyInput(text, { autoK: false });
    if (nav.handoff.amount) setAmount(String(nav.handoff.amount));
    else if (amountFromText) setAmount(String(amountFromText));
  }, [nav.handoff]);

  const expenseGroup = cats.expenseGroups.find(group => group.key === categoryId);
  const fromInbox = nav.handoff?.kind === 'tx';
  const parseOpts = fromInbox ? { autoK: false } : undefined;
  const parsedAmount = parseCurrencyInput(amount, parseOpts);
  const autoNecessity = deriveNecessity(categoryId, subId, cats);
  const appliedNecessity = necessity || autoNecessity;
  const selectedGoal = fin.goals.find(goal => goal.id === savingGoalId);
  const selectedDeposit = fin.deposits.find(deposit => deposit.id === savingDepositId);

  const selectedCard = fin.cards.find(card => card.id === sourceCardId);
  const selectedCardUsed = selectedCard ? cardBalance(selectedCard.id, fin.transactions) : 0;

  const estimateFor = (billId) => {
    const estimate = billAmountEstimate(fin.bills.find(bill => bill.id === billId) || {}, fin.transactions);
    return estimate ? String(estimate) : '';
  };

  const pendingBills = useMemo(() => {
    return fin.bills
      .filter(bill => bill.enabled && !bill.finished_at)
      .map(bill => ({ bill, cyc: billCycle(bill, fin.today, billSettled(bill, fin.transactions)) }))
      .filter(({ bill, cyc }) => cyc && (cyc.thisMonth || cyc.days < 0)
        && !billSettled(bill, fin.transactions)(cyc.period))
      .map(({ bill, cyc }) => ({ ...bill, dueDate: cyc.due, days: cyc.days, period: cyc.period }))
      .sort((a, b) => a.days - b.days);
  }, [fin.transactions, fin.bills, fin.today]);

  const urgentBills = pendingBills.filter(bill => bill.days <= 1).length;
  const overdueBills = pendingBills.filter(bill => bill.days < 0).length;
  const billTotal = pendingBills.reduce((sum, b) => {
    const val = b.amount_mode === 'fixed' ? b.amount : parseCurrencyInput(estimateFor(b.id));
    return sum + (Number(val) || 0);
  }, 0);

  // Tách số + đuôi để mobile ẩn chữ "hóa đơn" (design 4b: "3 hết hạn ngày mai").
  const [pillCount, pillRest] = overdueBills > 0
    ? [overdueBills, 'quá hạn']
    : urgentBills > 0
      ? [urgentBills, 'hết hạn ngày mai']
      : [pendingBills.length, 'sắp đến hạn'];

  const shortcuts = useMemo(() => {
    const defaults = cats.shortcutSeed
      .filter(shortcut => !hiddenSeeds.includes(seedPath(shortcut)))
      .map((shortcut, index) => ({
        ...shortcut, id: `seed-${index}`, seed: true, recent_amounts: [], use_count: 0,
        necessity: deriveNecessity(shortcut.category_id, shortcut.subcategory_id, cats),
      }));
    if (!fin.shortcuts.length) return defaults;
    const savedPaths = new Set(fin.shortcuts.map(seedPath));
    return [...fin.shortcuts, ...defaults.filter(shortcut => !savedPaths.has(seedPath(shortcut)))];
  }, [fin.shortcuts, cats, hiddenSeeds]);

  const duplicateBill = type === 'expense' && subId
    ? fin.bills.find(bill => bill.enabled && bill.subcategory_id === subId)
    : null;

  const addAmount = (setter, raw, step, opts) => {
    const next = (parseCurrencyInput(raw, opts) || 0) + step;
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
    setDescription('');
    setDraftItems([]);
    setShowMore(false);
    setPendingBillId(null);
  };

  const saveTransaction = async () => {
    if (!parsedAmount || parsedAmount <= 0) {
      nav.showToast('Nhập số tiền trước đã');
      return;
    }

    let tx = null;
    if (type === 'saving') {
      if (!selectedGoal || !selectedDeposit) return;
      if (savingDir === 'in' && !canDepositTopUp(selectedDeposit)) {
        nav.showToast('Sổ kỳ hạn đã khóa gốc, không thể nạp thêm', { icon: 'lock' });
        return;
      }
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
        amount: parsedAmount, occurredAt, note: note || null, description: description.trim() || null, taskId,
      });
    } else {
      const row = {
        type,
        amount: parsedAmount,
        occurred_at: occurredAt,
        note: note || null,
        description: description.trim() || null,
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
        bill_id: pendingBillId || null,
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

    const toastMsg = type === 'income'
      ? `Đã ghi khoản thu · ${money(parsedAmount)}`
      : type === 'saving'
        ? `Đã ${savingDir === 'out' ? 'rút khỏi' : 'gửi vào'} quỹ · ${money(parsedAmount)}`
        : `Đã ghi ${note.trim() || subLabel(subId, cats) || catInfo(categoryId, cats).label} · ${money(parsedAmount)}`;

    showUndoToast(toastMsg, tx.id);

    if (nav.handoff?.kind === 'tx' && nav.handoff.inboxId) {
      try {
        const { supabase } = await import('../../lib/supabase');
        await supabase.from('collections').delete().eq('id', nav.handoff.inboxId);
      } catch { /* best-effort handoff cleanup */ }
    }
    nav.clearHandoff();
    reset();
  };

  const payPendingBill = async (bill, rawAmount) => {
    const value = parseCurrencyInput(rawAmount);
    if (!value) return;
    const tx = await fin.payBill(bill, { amount: value, period: bill.period });
    if (tx) {
      showUndoToast(`Đã thanh toán ${bill.name} · ${money(value)}`, tx.id);
      setBillsOpen(false);
      setMobileSheetOpen(false);
    }
  };

  const fillBillIntoForm = (bill) => {
    setType('expense');
    setNote(bill.name);
    const est = bill.amount_mode === 'fixed' ? String(bill.amount || '') : estimateFor(bill.id);
    if (est) setAmount(String(est));
    setCategoryId(bill.category_id);
    setSubId(bill.subcategory_id || '');
    setPendingBillId(bill.id);
    setBillsOpen(false);
    setMobileSheetOpen(false);
    setMobileView('form');
  };

  const recordShortcut = async (shortcut, customAmount) => {
    const value = parseCurrencyInput(customAmount || shortcutAmount)
      || (customAmount === undefined && !shortcutAmount && shortcut.recent_amounts?.[0] ? shortcut.recent_amounts[0] : 0);

    if (!value) {
      setExpandedShortcutId(shortcut.id);
      setShortcutAmount('');
      return;
    }

    const tx = await fin.addTransaction({
      type: 'expense',
      amount: value,
      occurred_at: fin.today,
      category_id: shortcut.category_id,
      subcategory_id: shortcut.subcategory_id || null,
      necessity: shortcut.necessity || deriveNecessity(shortcut.category_id, shortcut.subcategory_id, cats),
      source_card_id: shortcut.source_card_id || null,
      shortcut_id: shortcut.seed ? null : shortcut.id,
      note: shortcut.name,
    });

    if (!tx) return;

    if (shortcut.seed) {
      await fin.addShortcut({
        name: shortcut.name,
        category_id: shortcut.category_id,
        subcategory_id: shortcut.subcategory_id || null,
        necessity: shortcut.necessity || deriveNecessity(shortcut.category_id, shortcut.subcategory_id, cats),
        source_card_id: shortcut.source_card_id || null,
        recent_amounts: [value],
        sort_order: fin.shortcuts.length,
      });
    } else {
      const recent = [value, ...(shortcut.recent_amounts || []).filter(item => item !== value)].slice(0, 4);
      await fin.updateShortcut(shortcut.id, {
        recent_amounts: recent,
        use_count: (shortcut.use_count || 0) + 1,
      });
    }

    showUndoToast(`Đã ghi ${shortcut.name} · ${money(value)}`, tx.id);
    setShortcutAmount('');
    setExpandedShortcutId(null);
  };

  const openShortcutInForm = (shortcut) => {
    setType('expense');
    setNote(shortcut.name);
    setCategoryId(shortcut.category_id);
    setSubId(shortcut.subcategory_id || '');
    // Chỉ khóa khi shortcut lưu phân loại KHÁC giá trị tự đoán; trùng thì để auto
    // để đổi nhóm/danh mục con trong form vẫn tự đoán lại (design: full() để cls = null).
    const autoNeed = deriveNecessity(shortcut.category_id, shortcut.subcategory_id, cats);
    setNecessity(shortcut.necessity && shortcut.necessity !== autoNeed ? shortcut.necessity : '');
    setSourceCardId(shortcut.source_card_id || '');
    const amtToFill = parseCurrencyInput(shortcutAmount) || (shortcut.recent_amounts?.[0] ? shortcut.recent_amounts[0] : null);
    if (amtToFill) setAmount(String(amtToFill));
    setExpandedShortcutId(null);
    setShortcutAmount('');
    setMobileView('form');
  };

  const pinCurrentShortcut = async () => {
    if (type !== 'expense') {
      nav.showToast('Shortcut chỉ dùng cho khoản Chi', { icon: 'warning' });
      return;
    }
    const name = note.trim() || subLabel(subId, cats) || catInfo(categoryId, cats).label;
    const duplicate = fin.shortcuts.some(shortcut => shortcut.name.toLowerCase() === name.toLowerCase()
      && shortcut.category_id === categoryId && (shortcut.subcategory_id || '') === subId);
    if (duplicate) {
      nav.showToast(`${name} đã có trong Shortcut`);
      return;
    }
    const shortcut = await fin.addShortcut({
      name,
      category_id: categoryId,
      subcategory_id: subId || null,
      necessity: appliedNecessity,
      source_card_id: sourceCardId || null,
      recent_amounts: parsedAmount ? [parsedAmount] : [],
      sort_order: fin.shortcuts.length,
    });
    if (shortcut) nav.showToast(`Đã ghim ${name} vào Shortcut`, { icon: 'pushPin' });
  };

  const categoryOptions = type === 'income'
    ? cats.incomeGroups.filter(group => !group.hidden)
    : cats.expenseGroups.filter(group => !group.hidden);
  const activeCategoryId = type === 'income' ? incomeCategoryId : categoryId;
  const yesterday = shiftDate(fin.today, -1);
  // Có gì đang gõ dở thì rời màn phải hỏi trước, không mất trắng.
  const isDirty = Boolean(amount || note.trim() || merchant || description || draftItems.length || taskId);

  return (
    <div className="fin-add">
      {/* ── Pill Hóa đơn: portal lên header chung của Finance (design: 1 thanh tiêu đề + pill) ── */}
      {nav.headerSlot && createPortal(
      <div className="fin-add__topbar">
        {pendingBills.length > 0 ? (
          <button
            type="button"
            className="fin-bill-pill fin-bill-pill--pending"
            onClick={() => {
              if (window.innerWidth <= 960) setMobileSheetOpen(current => !current);
              else setBillsOpen(current => !current);
            }}
          >
            <span className="fin-bill-pill__bell">
              <AppIcon name="bellRinging" size={17} weight="fill" />
              <span className="fin-bill-pill__dot"></span>
            </span>
            <span className="fin-bill-pill__text">
              {pillCount} <span className="fin-bill-pill__noun">hóa đơn </span>{pillRest}
            </span>
            <span className="fin-bill-pill__count">{pendingBills.length}</span>
            <AppIcon name={billsOpen ? 'caretUp' : 'caretDown'} size={13} className="fin-bill-pill__caret" />
          </button>
        ) : (
          <span className="fin-bill-pill fin-bill-pill--empty">
            <AppIcon name="checkCircle" size={16} />
            Đã trả hết hóa đơn
          </span>
        )}

        {/* ── Desktop Popover Hóa đơn đến hạn ── */}
        {billsOpen && pendingBills.length > 0 && (
          <div className="fin-bills-popover">
            <div className="fin-bills-popover__head">
              <strong>{pendingBills.length} hóa đơn đến hạn</strong>
              <span className="fin-bills-popover__total">{money(billTotal)}</span>
              <button
                type="button"
                className="fin-bills-popover__close"
                onClick={() => setBillsOpen(false)}
                aria-label="Đóng bảng hóa đơn"
              >
                <AppIcon name="x" size={15} />
              </button>
            </div>
            <div className="fin-bills-popover__list">
              {pendingBills.map(bill => (
                <PendingBillItem
                  key={bill.id}
                  bill={bill}
                  estimate={estimateFor(bill.id)}
                  cats={cats}
                  onPay={payPendingBill}
                  onFill={fillBillIntoForm}
                  onSkip={async () => {
                    const skipped = await fin.skipBillPeriod(bill.id, bill.period);
                    if (skipped) nav.showToast(`Đã bỏ qua ${bill.name} trong ${bill.period}`, { icon: 'calendar' });
                  }}
                />
              ))}
            </div>
            <div className="fin-bills-popover__foot">
              Thanh toán ghi ngay vào hôm nay, trả bằng Tiền có sẵn. Bấm tên để sửa thêm trong form.
            </div>
          </div>
        )}
      </div>,
      nav.headerSlot)}

      {/* ── Mobile (design 4b): màn đầu là Shortcut, form mở bằng "Ghi khoản khác", quay lại bằng ← ── */}
      {mobileView === 'form' && (
        <div className="fin-mobile-bar">
          <button type="button" className="fin-mobile-bar__back" onClick={() => setMobileView('quick')} aria-label="Quay lại Shortcut">
            <AppIcon name="back" size={20} />
          </button>
          <span className="fin-mobile-bar__title">Ghi khoản mới</span>
        </div>
      )}

      {/* ── 2-Cột Layout Grid: Form Trái, Shortcut Phải ── */}
      <div className="fin-add-grid">
        {/* CỘT TRÁI: FORM CHÍNH */}
        <div className={`fin-add-main ${mobileView === 'quick' ? 'fin-hide-mobile' : ''}`}>
          <form
            className="fin-card fin-entry-card"
            onSubmit={(event) => { event.preventDefault(); saveTransaction(); }}
          >
            {/* Hàng 1: Segmented Loại & Phân loại Phải trả / Tùy chọn */}
            <div className="fin-entry-card__top">
              <Segmented options={TYPE_OPTS} value={type} onChange={setType} />

              {type === 'expense' && (
                <div className="fin-cls-picker">
                  <span className="fin-cls-picker__label">Phân loại</span>
                  <div className="fin-cls-picker__opts">
                    <button
                      type="button"
                      className={`fin-cls-picker__btn ${appliedNecessity === 'must' ? 'is-active-must' : ''}`}
                      onClick={() => setNecessity('must')}
                    >
                      Phải trả
                    </button>
                    <button
                      type="button"
                      className={`fin-cls-picker__btn ${appliedNecessity === 'want' ? 'is-active-want' : ''}`}
                      onClick={() => setNecessity('want')}
                    >
                      Tùy chọn
                    </button>
                  </div>
                  <button
                    type="button"
                    className={`fin-cls-picker__lock ${necessity ? 'is-locked' : ''}`}
                    title={necessity ? 'Bạn đã chọn tay · bấm để app tự đoán lại' : 'App tự đoán theo danh mục con'}
                    onClick={() => setNecessity('')}
                    aria-label={necessity ? 'Đặt lại phân loại tự động' : 'Tự động đoán phân loại'}
                  >
                    <AppIcon name={necessity ? 'lock' : 'sparkle'} size={15} />
                  </button>
                </div>
              )}
            </div>

            {/* Hàng 2: Grid 2 cột: Tiêu đề & Số tiền */}
            <div className="fin-entry-head-grid">
              <div className="fin-entry-title-field">
                <label htmlFor="fin-tx-title">Tiêu đề</label>
                <input
                  id="fin-tx-title"
                  value={note}
                  maxLength={200}
                  autoComplete="off"
                  onChange={event => setNote(event.target.value)}
                  placeholder={subLabel(subId, cats) || 'Cà phê sữa, xăng, Netflix…'}
                />
              </div>

              <div className="fin-amount-field">
                <div className="fin-amount-field__head">
                  <label htmlFor="fin-tx-amount">Số tiền</label>
                  <div className="fin-amount-field__quick">
                    {QUICK_CHIPS.map(step => (
                      <button
                        key={step}
                        type="button"
                        className="fin-amount-field__quick-btn"
                        onClick={() => addAmount(setAmount, amount, step, parseOpts)}
                      >
                        +{step / 1000}k
                      </button>
                    ))}
                  </div>
                </div>
                <div className="fin-amount-field__box">
                  <input
                    id="fin-tx-amount"
                    autoFocus
                    autoComplete="off"
                    inputMode="numeric"
                    pattern="[0-9.]*"
                    placeholder="0"
                    value={groupDigits(amount)}
                    onChange={event => setAmount(sanitizeDigits(event.target.value))}
                  />
                  <span>₫</span>
                </div>
                {autoKPreview(amount, parseOpts) && (
                  <small className="fin-amount-auto" aria-live="polite">
                    Sẽ lưu <strong>{autoKPreview(amount, parseOpts)} ₫</strong> · Auto-K tự thêm 3 số 0
                  </small>
                )}
                {fromInbox && <small className="fin-entry-hint">Số lấy nguyên từ Inbox — không áp Auto-K</small>}
              </div>
            </div>

            {/* Hàng 3: Nhóm (Chi tiêu hoặc Thu nhập) */}
            {type !== 'saving' && (
              <>
                <div className="fin-entry-section">
                  <div className="fin-field-heading">
                    <label>{type === 'income' ? 'Nhóm thu' : 'Nhóm'}</label>
                    <small>{categoryOptions.length} nhóm, xếp theo cách bạn dùng</small>
                  </div>
                  <div className="fin-groups-grid">
                    {categoryOptions.map(category => (
                      <button
                        key={category.key}
                        type="button"
                        className={activeCategoryId === category.key ? 'is-active' : ''}
                        style={{
                          '--cat-color': category.color,
                        }}
                        onClick={() => type === 'income'
                          ? setIncomeCategoryId(category.key)
                          : (setCategoryId(category.key), setSubId(''))}
                      >
                        <FinanceIcon
                          name={category.icon}
                          cats={cats}
                          size={16}
                          style={{ color: category.color, flex: 'none' }}
                          weight={activeCategoryId === category.key ? 'fill' : 'regular'}
                        />
                        <span>{category.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hàng 4: Danh mục con (khi type === 'expense') */}
                {type === 'expense' && (
                  <div className="fin-entry-section">
                    <div className="fin-field-heading">
                      <label>
                        Danh mục con <span style={{ fontWeight: 400, color: 'var(--n-txt3)' }}>· {expenseGroup?.label}</span>
                      </label>
                      <small>bỏ qua cũng được — thống kê vẫn chạy ở cấp nhóm</small>
                    </div>
                    <div className="fin-subs-strip">
                      {pickableSubs(expenseGroup, subId, cats).map(sub => {
                        const subNeed = sub.necessity || deriveNecessity(categoryId, sub.key, cats);
                        return (
                          <button
                            key={sub.key}
                            type="button"
                            className={subId === sub.key ? 'is-active' : ''}
                            onClick={() => setSubId(current => current === sub.key ? '' : sub.key)}
                          >
                            <span>{sub.label}</span>
                            <span
                              className="fin-sub-dot"
                              style={{ background: subNeed === 'must' ? '#7FB0D6' : '#E7A9B6' }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Hàng 5: Trả bằng (Nguồn tiền) */}
            {type === 'expense' && (
              <div className="fin-entry-section">
                <label className="fin-entry-section__label">Trả bằng</label>
                <div className="fin-chips-row">
                  <button
                    type="button"
                    className={!sourceCardId ? 'is-active' : ''}
                    onClick={() => setSourceCardId('')}
                  >
                    <AppIcon name="cash" size={15} /> Tiền có sẵn
                  </button>
                  {fin.cards.map(card => (
                    <button
                      key={card.id}
                      type="button"
                      className={sourceCardId === card.id ? 'is-active' : ''}
                      onClick={() => setSourceCardId(card.id)}
                    >
                      <AppIcon name="creditCard" size={15} />
                      {card.name}{card.last4 ? ` ••${card.last4}` : ''}
                    </button>
                  ))}
                </div>
                <div className="fin-source-card-info">
                  <AppIcon name={selectedCard ? 'creditCard' : 'wallet'} size={15} />
                  {selectedCard ? (
                    <span>
                      Còn {money(Math.max(0, selectedCard.credit_limit - selectedCardUsed))} · Hạn mức {money(selectedCard.credit_limit)} · Chốt ngày {selectedCard.statement_day} · Đến hạn ngày {selectedCard.due_day}
                    </span>
                  ) : (
                    <span>Trừ ngay khỏi số tiền bạn đang có, không tạo ngày phải trả.</span>
                  )}
                </div>
                {duplicateBill && (
                  <div className="fin-recurring-match">
                    <AppIcon name="arrowsClockwise" size={16} />
                    <span>
                      <strong>Có thể trùng {duplicateBill.name}</strong>
                      <small>Khoản định kỳ cùng danh mục đang chờ. Thanh toán từ Hóa đơn để gắn đúng kỳ.</small>
                    </span>
                    <button type="button" onClick={() => nav.go('recurring')}>Mở hóa đơn</button>
                  </div>
                )}
              </div>
            )}

            {/* Khi type === 'saving' (Quỹ tiết kiệm) */}
            {type === 'saving' && (
              <section className="fin-saving-entry">
                <div className="fin-info-strip">
                  <AppIcon name="piggyBank" size={17} />
                  <span>Để dành không phải chi tiêu — tiền chỉ đổi chỗ và đứng ngoài mọi biểu đồ chi.</span>
                </div>
                <div className="fin-saving-dir">
                  <button
                    type="button"
                    className={savingDir === 'in' ? 'is-active' : ''}
                    onClick={() => setSavingDir('in')}
                  >
                    <AppIcon name="arrowDown" size={15} /> Gửi vào quỹ
                  </button>
                  <button
                    type="button"
                    className={savingDir === 'out' ? 'is-active' : ''}
                    onClick={() => setSavingDir('out')}
                  >
                    <AppIcon name="arrowUp" size={15} /> Rút khỏi quỹ
                  </button>
                </div>
                <div className="fin-goal-picker">
                  {fin.goals.map(goal => {
                    const balance = fin.deposits.filter(deposit => deposit.fund_id === goal.id).reduce((sum, deposit) => sum + deposit.amount, 0);
                    return (
                      <button
                        key={goal.id}
                        type="button"
                        className={savingGoalId === goal.id ? 'is-active' : ''}
                        onClick={() => { setSavingGoalId(goal.id); setSavingDepositId(''); }}
                      >
                        <AppIcon name="piggyBank" size={16} />
                        <span>
                          <strong>{goal.name}</strong>
                          <small>{money(balance)}{goal.goal ? ` / ${money(goal.goal)}` : ''}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <label className="fin-label">
                  {savingDir === 'in' ? 'Nơi nhận tiền (Tích lũy linh hoạt)' : 'Sổ / Nơi rút tiền'}
                </label>
                <select
                  className="fin-input"
                  aria-label="Nơi gửi"
                  value={savingDepositId}
                  onChange={event => setSavingDepositId(event.target.value)}
                  disabled={!savingGoalId}
                >
                  <option value="">— chọn sổ / nơi giữ —</option>
                  {fin.deposits.filter(deposit => deposit.fund_id === savingGoalId).map(deposit => {
                    const isLocked = savingDir === 'in' && !canDepositTopUp(deposit);
                    return (
                      <option key={deposit.id} value={deposit.id} disabled={isLocked}>
                        {deposit.name} · {money(deposit.amount)}{isLocked ? ' (Đã khóa gốc · Không thể nạp thêm)' : ''}
                      </option>
                    );
                  })}
                </select>
                {savingDir === 'in' && savingGoalId && fin.deposits.filter(d => d.fund_id === savingGoalId && canDepositTopUp(d)).length === 0 && (
                  <div className="fin-warn fin-inline-message" style={{ marginTop: '8px' }}>
                    <AppIcon name="lock" size={15} /> Quỹ này chỉ có sổ kỳ hạn đã khóa gốc. Sổ kỳ hạn không thể nạp thêm — hãy vào mục Tiền gửi để tạo sổ mới.
                  </div>
                )}
                {selectedGoal?.lock_mode === 'term' && savingDir === 'out' && (
                  <div className="fin-warn fin-inline-message">
                    <AppIcon name="clock" size={15} /> Lệnh rút từ quỹ kỳ hạn phải chờ 48 giờ.
                  </div>
                )}
                {selectedGoal?.lock_mode === 'external' && savingDir === 'out' && (
                  <div className="fin-warn fin-inline-message">
                    <AppIcon name="warning" size={15} /> Rút sổ ngoài app trước hạn có thể mất lãi.
                  </div>
                )}
              </section>
            )}

            {/* Hàng 6: Ngày */}
            <div className="fin-entry-section">
              <label className="fin-entry-section__label">Ngày</label>
              <div className="fin-chips-row">
                <button
                  type="button"
                  className={occurredAt === fin.today ? 'is-active' : ''}
                  onClick={() => setOccurredAt(fin.today)}
                >
                  Hôm nay
                </button>
                <button
                  type="button"
                  className={occurredAt === yesterday ? 'is-active' : ''}
                  onClick={() => setOccurredAt(yesterday)}
                >
                  Hôm qua
                </button>
                <DateField value={occurredAt} onChange={setOccurredAt} max={fin.today} />
              </div>
            </div>
            <div className="fin-divider"></div>

            {/* Hàng 7: Collapsible "Thêm chi tiết" (chỉ có nút, không có text phụ) */}
            <button
              type="button"
              className="fin-details-toggle"
              onClick={() => setShowMore(current => !current)}
            >
              <AppIcon name={showMore ? 'caretDown' : 'plus'} size={14} />
              <span>{showMore ? 'Ẩn chi tiết' : 'Thêm chi tiết'}</span>
            </button>

            {showMore && (
              <div className="fin-details-box">
                <div className="fin-details-grid">
                  <div className="fin-details-field">
                    <label htmlFor="fin-merchant">Nơi / người nhận</label>
                    <input
                      id="fin-merchant"
                      value={merchant}
                      autoComplete="off"
                      onChange={event => setMerchant(event.target.value)}
                      placeholder="Quán nước Bà Ba, Shopee, cửa hàng…"
                    />
                  </div>

                  <div className="fin-details-field">
                    <span>Nhiệm vụ liên quan</span>
                    <TaskPicker tasks={pendingTasks} value={taskId} onPick={setTaskId} />
                  </div>
                </div>

                <div className="fin-details-field">
                  <label htmlFor="fin-desc">Ghi chú</label>
                  <textarea
                    id="fin-desc"
                    value={description}
                    onChange={event => setDescription(event.target.value)}
                    placeholder="Ghi chú tự do (nhiều dòng, diễn giải chi tiết)…"
                    rows={2}
                  />
                </div>

                <div className="fin-items-editor">
                  <div className="fin-items-editor__head">
                    <strong>
                      <AppIcon name="listBullets" size={16} style={{ color: 'var(--n-accent, #6366F1)' }} />
                      Chi tiết từng món
                    </strong>
                    <small>
                      {draftItems.length > 0
                        ? `tổng ${money(draftItems.reduce((s, it) => s + (Number(it.qty) || 1) * (parseCurrencyInput(it.price) || 0), 0))} · tự cộng lên Số tiền`
                        : 'tổng tự cộng lên Số tiền'}
                    </small>
                  </div>
                  {draftItems.map((item, index) => (
                    <div className="fin-item-row" key={index}>
                      <input
                        aria-label={`Tên món thứ ${index + 1}`}
                        value={item.name}
                        onChange={event => updateDraftItem(index, 'name', event.target.value)}
                        placeholder="Tên món"
                      />
                      <input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={item.qty}
                        onChange={event => updateDraftItem(index, 'qty', event.target.value)}
                        aria-label="Số lượng"
                        placeholder="1"
                      />
                      <input
                        inputMode="numeric"
                        pattern="[0-9.]*"
                        aria-label="Đơn giá"
                        value={groupDigits(item.price)}
                        onChange={event => updateDraftItem(index, 'price', event.target.value)}
                        placeholder="Đơn giá"
                      />
                      <button
                        type="button"
                        aria-label="Xóa món"
                        onClick={() => setDraftItems(current => current.filter((_, itemIndex) => itemIndex !== index))}
                      >
                        <AppIcon name="x" size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="fin-inline-command"
                    onClick={() => setDraftItems(current => [...current, { name: '', qty: '1', price: '' }])}
                  >
                    <AppIcon name="plus" size={14} /> Thêm món
                  </button>
                </div>

                <button
                  type="button"
                  className="fin-recurring-btn"
                  onClick={async () => {
                    if (!isDirty || await nav.confirmDiscard()) nav.go('recurring');
                  }}
                >
                  <AppIcon name="arrowsClockwise" size={14} />
                  Biến thành khoản định kỳ
                </button>
              </div>
            )}

            {/* Hàng 8: Chân Form Submit */}
            <div className="fin-entry-foot">
              {/* --kbd: gợi ý phím, ẩn trên mobile; hint hóa đơn thì luôn hiện */}
              <span className={`fin-entry-foot__hint${pendingBillId ? '' : ' fin-entry-foot__hint--kbd'}`}>
                {pendingBillId ? 'Lưu xong sẽ gỡ hóa đơn này khỏi danh sách chờ' : 'Enter để lưu'}
              </span>
              <button
                type="submit"
                className="fin-entry-foot__btn"
                disabled={!parsedAmount || (type === 'saving' && (!selectedGoal || !selectedDeposit || (savingDir === 'out' && parsedAmount > selectedDeposit.amount)))}
              >
                <AppIcon name="check" size={16} weight="bold" />
                <span>
                  {pendingBillId
                    ? 'Lưu & thanh toán'
                    : type === 'income'
                      ? 'Lưu khoản thu'
                      : type === 'saving'
                        ? 'Lưu khoản để dành'
                        : 'Lưu khoản chi'}
                </span>
                <span className="fin-kbd">Enter</span>
              </button>
            </div>
          </form>
        </div>

        {/* CỘT PHẢI: SHORTCUT ACCORDION PANEL — luôn hiện (design 4a/4b); mobile là màn đầu */}
        <aside className={`fin-add-aside ${mobileView === 'form' ? 'fin-hide-mobile' : ''}`}>
            <section className="fin-shortcut-card">
              <div className="fin-shortcut-card__head">
                <span className="fin-shortcut-card__head-title">
                  <AppIcon name="lightning" size={16} weight="fill" style={{ color: 'var(--n-accent, #6366F1)' }} />
                  Shortcut
                </span>
                <div className="fin-shortcut-card__head-actions">
                  <button type="button" onClick={pinCurrentShortcut}>+ Tạo từ form</button>
                  <button type="button" onClick={() => setShortcutEditing(current => !current)}>
                    {shortcutEditing ? 'Xong' : 'Sửa'}
                  </button>
                </div>
              </div>

              <div className="fin-shortcut-list">
                {!fin.hasLoaded ? (
                  <div className="fin-shortcut-loading">
                    <AppIcon name="lightning" size={14} /> Đang tải shortcut…
                  </div>
                ) : (
                  shortcuts.map(shortcut => {
                    const info = catInfo(shortcut.category_id, cats);
                    const need = NECESSITY_META[shortcut.necessity || deriveNecessity(shortcut.category_id, shortcut.subcategory_id, cats)];
                    const isOpen = expandedShortcutId === shortcut.id;
                    const usual = shortcut.recent_amounts?.[0] ? money(shortcut.recent_amounts[0]) : null;

                    return (
                      <div key={shortcut.id} className="fin-shortcut-item">
                        {/* Khi đóng: dòng gọn 44px */}
                        {!isOpen && (
                          <button
                            type="button"
                            className="fin-sc-row-closed"
                            onClick={() => {
                              setExpandedShortcutId(shortcut.id);
                              setShortcutAmount('');
                            }}
                          >
                            <span className="fin-sc-row-closed__icon">
                              <FinanceIcon name={info.icon} cats={cats} size={15} style={{ color: info.color }} />
                            </span>
                            <span className="fin-sc-row-closed__name">
                              <strong>{shortcut.name}</strong>
                              <small>{subLabel(shortcut.subcategory_id, cats) || info.label}</small>
                            </span>
                            <span className={`fin-sc-tag ${need.label === 'Phải trả' ? 'fin-sc-tag--must' : 'fin-sc-tag--want'}`}>
                              {need.label}
                            </span>
                            {shortcutEditing && (shortcut.seed ? (
                              <button
                                type="button"
                                className="fin-sc-delete-btn"
                                title="Ẩn shortcut mặc định này"
                                aria-label={`Ẩn ${shortcut.name}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setHidden([...hiddenSeeds, seedPath(shortcut)]);
                                }}
                              >
                                <AppIcon name="eyeSlash" size={14} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="fin-sc-delete-btn"
                                aria-label={`Xóa ${shortcut.name}`}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (await nav.confirmDelete(`shortcut “${shortcut.name}”`)) {
                                    await fin.deleteShortcut(shortcut.id);
                                  }
                                }}
                              >
                                <AppIcon name="trash" size={14} />
                              </button>
                            ))}
                          </button>
                        )}

                        {/* Khi mở: Box viền tím bo tròn */}
                        {isOpen && (
                          <div className="fin-sc-box-open">
                            <button
                              type="button"
                              className="fin-sc-box-open__head"
                              onClick={() => setExpandedShortcutId(null)}
                            >
                              <div className="fin-sc-box-open__icon">
                                <FinanceIcon name={info.icon} cats={cats} size={17} style={{ color: info.color }} />
                              </div>
                              <div className="fin-sc-box-open__meta">
                                <div className="fin-sc-box-open__meta-row">
                                  <strong>{shortcut.name}</strong>
                                  <span className={`fin-sc-tag ${need.label === 'Phải trả' ? 'fin-sc-tag--must' : 'fin-sc-tag--want'}`}>
                                    {need.label}
                                  </span>
                                </div>
                                <span className="fin-sc-box-open__path">
                                  {info.label} › {subLabel(shortcut.subcategory_id, cats) || shortcut.name} · Tiền có sẵn
                                </span>
                              </div>
                              {usual && <span className="fin-sc-box-open__usual">{usual}</span>}
                            </button>

                            <div className="fin-sc-box-open__input-row">
                              <div className="fin-sc-box-open__input-wrap">
                                <input
                                  ref={shortcutInputRef}
                                  autoComplete="off"
                                  inputMode="numeric"
                                  pattern="[0-9.]*"
                                  placeholder={usual ? usual : 'Số tiền'}
                                  value={groupDigits(shortcutAmount)}
                                  onChange={e => setShortcutAmount(sanitizeDigits(e.target.value))}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') recordShortcut(shortcut);
                                    if (e.key === 'Escape') setExpandedShortcutId(null);
                                  }}
                                />
                                <span>₫</span>
                              </div>
                              <button
                                type="button"
                                className="fin-sc-box-open__btn-rec"
                                onClick={() => recordShortcut(shortcut)}
                              >
                                <AppIcon name="check" size={15} weight="bold" />
                                Ghi
                              </button>
                            </div>

                            <div className="fin-sc-box-open__chips-row">
                              <span className="fin-sc-box-open__chips-label">hay nhập:</span>
                              {(shortcut.recent_amounts || []).map(val => (
                                <span
                                  key={val}
                                  className="fin-sc-recent-chip"
                                  title="Bấm để ghi luôn"
                                  onClick={() => recordShortcut(shortcut, String(val))}
                                >
                                  {money(val)}
                                  <button
                                    type="button"
                                    className="fin-sc-recent-chip__x"
                                    aria-label={`Bỏ mức ${money(val)}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      fin.updateShortcut(shortcut.id, {
                                        recent_amounts: (shortcut.recent_amounts || []).filter(item => item !== val),
                                      });
                                    }}
                                  >
                                    <AppIcon name="x" size={10} />
                                  </button>
                                </span>
                              ))}
                              {(!shortcut.recent_amounts || shortcut.recent_amounts.length === 0) && (
                                <span style={{ fontSize: '11.5px', color: 'var(--n-txt3)' }}>
                                  chưa có, ghi lần đầu sẽ nhớ
                                </span>
                              )}
                              <button
                                type="button"
                                className="fin-sc-box-open__link-full"
                                onClick={() => openShortcutInForm(shortcut)}
                              >
                                mở form đầy đủ
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {hiddenSeeds.length > 0 && (
                <div style={{ padding: '8px 16px' }}>
                  <button
                    type="button"
                    className="fin-inline-command"
                    onClick={() => setHidden([])}
                  >
                    <AppIcon name="arrowsClockwise" size={14} /> Hiện lại {hiddenSeeds.length} shortcut mặc định
                  </button>
                </div>
              )}
            </section>
          </aside>
      </div>

      {/* ── Mobile Nút "Ghi khoản khác" cố định chân trang ── */}
      {mobileView === 'quick' && (
        <div className="fin-mobile-fixed-footer">
          <button type="button" onClick={() => setMobileView('form')}>
            <AppIcon name="plus" size={17} /> Ghi khoản khác
          </button>
        </div>
      )}

      {/* ── Mobile Bottom Sheet Hóa đơn ── */}
      {mobileSheetOpen && pendingBills.length > 0 && (
        <div className="fin-bills-sheet-backdrop" onClick={() => setMobileSheetOpen(false)}>
          <div className="fin-bills-sheet-panel" onClick={e => e.stopPropagation()}>
            <div className="fin-bills-sheet-handle">
              <span></span>
            </div>
            <div className="fin-bills-popover__head">
              <strong>{pendingBills.length} hóa đơn đến hạn</strong>
              <span className="fin-bills-popover__total">{money(billTotal)}</span>
              <button
                type="button"
                className="fin-bills-popover__close"
                onClick={() => setMobileSheetOpen(false)}
                aria-label="Đóng bảng hóa đơn"
              >
                <AppIcon name="x" size={16} />
              </button>
            </div>
            <div className="fin-bills-popover__list">
              {pendingBills.map(bill => (
                <PendingBillItem
                  key={bill.id}
                  bill={bill}
                  estimate={estimateFor(bill.id)}
                  cats={cats}
                  onPay={payPendingBill}
                  onFill={fillBillIntoForm}
                  onSkip={async () => {
                    const skipped = await fin.skipBillPeriod(bill.id, bill.period);
                    if (skipped) nav.showToast(`Đã bỏ qua ${bill.name} trong ${bill.period}`, { icon: 'calendar' });
                  }}
                />
              ))}
            </div>
            <div className="fin-bills-popover__foot">
              Thanh toán ghi ngay vào hôm nay, trả bằng Tiền có sẵn. Chạm tên để sửa thêm trong form.
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Hoàn tác (Undo) nổi ở đáy ── */}
      {undoToast && (
        <div className="fin-undo-toast" role="alert">
          <AppIcon name="checkCircle" size={18} weight="fill" className="fin-undo-toast__icon" />
          <span className="fin-undo-toast__text">{undoToast.text}</span>
          <button type="button" className="fin-undo-toast__btn" onClick={handleUndo}>
            Hoàn tác
          </button>
        </div>
      )}
    </div>
  );
}

function PendingBillItem({ bill, estimate, cats, onPay, onFill, onSkip }) {
  const [value, setValue] = useState(bill.amount_mode === 'fixed' ? String(bill.amount || '') : estimate);
  const info = catInfo(bill.category_id, cats);

  const statusBadge = bill.days < 0 ? (
    <span className="fin-bills-popover__badge fin-bills-popover__badge--late">
      quá hạn {Math.abs(bill.days)} ngày
    </span>
  ) : bill.days === 0 ? (
    <span className="fin-bills-popover__badge fin-bills-popover__badge--soon">hôm nay</span>
  ) : bill.days === 1 ? (
    <span className="fin-bills-popover__badge fin-bills-popover__badge--soon">ngày mai</span>
  ) : (
    <span className="fin-bills-popover__badge fin-bills-popover__badge--normal">
      còn {bill.days} ngày
    </span>
  );

  return (
    <div className="fin-bills-popover__row">
      {statusBadge}
      <button
        type="button"
        className="fin-bills-popover__name"
        onClick={() => onFill(bill)}
        title="Đưa vào form"
      >
        <strong>{bill.name}</strong>
        <small>{info.label}{subLabel(bill.subcategory_id, cats) ? ` › ${subLabel(bill.subcategory_id, cats)}` : ''}</small>
      </button>

      {bill.amount_mode === 'ask' ? (
        <input
          className="fin-bills-popover__input"
          inputMode="numeric"
          pattern="[0-9.]*"
          value={groupDigits(value)}
          onChange={e => setValue(sanitizeDigits(e.target.value))}
          placeholder={estimate ? `~ ${money(estimate)}` : 'Số tiền'}
          aria-label={`Số tiền trả cho ${bill.name}`}
        />
      ) : (
        <span className="fin-bills-popover__fixed">{money(bill.amount)}</span>
      )}

      <button
        type="button"
        className="fin-bills-popover__pay"
        onClick={() => onPay(bill, value)}
        disabled={!parseCurrencyInput(value)}
      >
        Thanh toán
      </button>

      <button
        type="button"
        className="fin-bills-popover__skip"
        onClick={onSkip}
        title="Bỏ qua kỳ này"
        aria-label={`Bỏ ${bill.name} trong kỳ này`}
      >
        <AppIcon name="x" size={13} />
      </button>
    </div>
  );
}

