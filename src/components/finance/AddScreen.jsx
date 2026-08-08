import { useState, useMemo, useEffect } from 'react';
import { useUserTasks } from '../../hooks/useUserTasks';
import { parseCurrencyInput } from '../../utils/currencyUtils';
import { matchCategory, deriveNecessity } from '../../utils/financeLogic';
import {
  money, catInfo, subLabel, NECESSITY_META, CATS, Segmented, TaskPicker,
} from './parts';

const TYPE_OPTS = [
  { value: 'expense', label: 'Chi' },
  { value: 'income', label: 'Thu' },
  { value: 'saving', label: 'Để dành' },
];

export default function AddScreen({ fin, nav }) {
  const { pendingTasks } = useUserTasks();
  const [nl, setNl] = useState('');
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('food');
  const [subId, setSubId] = useState('');
  const [necessity, setNecessity] = useState('');       // '' = auto
  const [sourceCardId, setSourceCardId] = useState('');  // '' = tiền mặt
  const [savingGoalId, setSavingGoalId] = useState('');
  const [note, setNote] = useState('');
  const [taskId, setTaskId] = useState(null);
  const [dismissedAsk, setDismissedAsk] = useState([]);

  // Nhận handoff Inbox kind='tx'.
  useEffect(() => {
    if (nav.handoff?.kind === 'tx') {
      if (nav.handoff.title) setNl(nav.handoff.title);
      if (nav.handoff.amount) setAmount(String(nav.handoff.amount));
    }
  }, [nav.handoff]);

  const group = CATS.expenseGroups.find(g => g.key === categoryId);
  const parsedAmount = parseCurrencyInput(amount);
  const autoNec = deriveNecessity(categoryId, subId, CATS);

  // NL đoán danh mục con → điền form (sửa được).
  const nlGuess = useMemo(() => matchCategory(nl), [nl]);
  const applyNl = () => {
    if (nlGuess) { setCategoryId(nlGuess.categoryId); setSubId(nlGuess.subId); }
    const a = parseCurrencyInput(nl);
    if (a) setAmount(String(a));
    if (!note) setNote(nl.replace(/\d[\d.,]*\s*[kKmM]?/g, '').trim());
  };

  // "Cần bạn ghi": hóa đơn 'ask' đang bật, chưa bỏ qua.
  const askBills = fin.bills.filter(b => b.enabled && b.amount_mode === 'ask' && !b.finished_at
    && !dismissedAsk.includes(b.id));
  const estimateFor = (billId) => {
    const past = fin.transactions.filter(t => t.bill_id === billId).slice(0, 3);
    if (!past.length) return '';
    return String(Math.round(past.reduce((s, t) => s + t.amount, 0) / past.length));
  };

  // Cảnh báo trùng: sub đã có quy tắc định kỳ.
  const dupRule = type === 'expense' && subId && fin.bills.some(b => b.enabled && b.subcategory_id === subId);

  const selectedCard = fin.cards.find(c => c.id === sourceCardId);

  const reset = () => {
    setNl(''); setAmount(''); setNote(''); setSubId(''); setNecessity('');
    setSourceCardId(''); setSavingGoalId(''); setTaskId(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!parsedAmount || parsedAmount <= 0) return;
    const row = {
      type, amount: parsedAmount, note: note || null,
      inbox_item_id: nav.handoff?.kind === 'tx' ? nav.handoff.inboxId : null,
      task_id: taskId,
    };
    if (type === 'expense') {
      Object.assign(row, {
        category_id: categoryId, subcategory_id: subId || null,
        necessity: necessity || undefined, source_card_id: sourceCardId || null,
      });
    } else if (type === 'saving') {
      Object.assign(row, { saving_goal_id: savingGoalId || null, saving_dir: 'in' });
    }
    const tx = await fin.addTransaction(row);
    if (tx) {
      nav.showToast(
        type === 'income' ? 'Đã ghi khoản thu — có lịch sử, nhưng không tính vào tỉ lệ nào'
        : type === 'saving' ? 'Đã để dành — không phải chi, không trừ hạn mức'
        : 'Đã ghi chi tiêu — lên báo cáo kỳ này', { icon: '✅' });
      if (nav.handoff?.kind === 'tx' && nav.handoff.inboxId) {
        // Xoá mục Inbox nguồn sau khi ghi (giữ hành vi cũ).
        try { const { supabase } = await import('../../lib/supabase');
          await supabase.from('collections').delete().eq('id', nav.handoff.inboxId); } catch { /* best-effort */ }
      }
      nav.clearHandoff();
      reset();
    }
  };

  const payAsk = async (bill, amt) => {
    const val = parseCurrencyInput(amt);
    if (!val) return;
    const tx = await fin.payBill(bill, { amount: val });
    if (tx) nav.showToast(`Đã ghi ${bill.name} — giờ là giao dịch bình thường, lên báo cáo`, { icon: '📝' });
  };

  return (
    <div className="fin-add">
      {/* Cần bạn ghi */}
      {askBills.length > 0 && (
        <div className="fin-card fin-ask">
          <div className="fin-card__title">📝 Cần bạn ghi</div>
          {askBills.map(b => <AskRow key={b.id} bill={b} estimate={estimateFor(b.id)}
            onPay={payAsk} onDismiss={() => setDismissedAsk(p => [...p, b.id])} />)}
        </div>
      )}

      {/* Ô ngôn ngữ tự nhiên */}
      <div className="fin-card">
        <input className="fin-input fin-input--nl" placeholder="Gõ nhanh: cà phê 35k, xăng 50k…"
          value={nl} onChange={e => setNl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyNl(); } }} />
        {(nlGuess || parseCurrencyInput(nl) > 0) && (
          <button className="fin-nl-guess" onClick={applyNl}>
            {nlGuess ? `${catInfo(nlGuess.categoryId).icon} ${subLabel(nlGuess.subId) || catInfo(nlGuess.categoryId).label}` : 'Số tiền'}
            {parseCurrencyInput(nl) > 0 && ` · ${money(parseCurrencyInput(nl))}`} — bấm để điền
          </button>
        )}
        <div className="fin-shortcuts">
          {fin.shortcuts.length === 0 && CATS.shortcutSeed.map(s => (
            <button key={s.name} className="fin-shortcut" onClick={() => {
              setType('expense'); setCategoryId(s.category_id); setSubId(s.subcategory_id); }}>
              {catInfo(s.category_id).icon} {s.name}
            </button>
          ))}
          {fin.shortcuts.map(s => (
            <button key={s.id} className="fin-shortcut" onClick={() => {
              setType('expense'); setCategoryId(s.category_id); setSubId(s.subcategory_id || '');
              setNecessity(s.necessity || ''); setSourceCardId(s.source_card_id || ''); }}>
              {catInfo(s.category_id).icon} {s.name}
              {(s.recent_amounts || []).slice(0, 3).map(a => (
                <span key={a} className="fin-shortcut__recent" onClick={(e) => { e.stopPropagation(); setAmount(String(a)); }}>
                  {money(a)}
                </span>
              ))}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <form className="fin-card fin-form" onSubmit={submit}>
        <Segmented options={TYPE_OPTS} value={type} onChange={setType} />

        <label className="fin-label">Số tiền</label>
        <input className="fin-input fin-input--amount" autoFocus placeholder="Ví dụ: 50, 50k, 10$"
          value={amount} onChange={e => setAmount(e.target.value)} />
        {parsedAmount > 0 && <div className="fin-preview">{money(parsedAmount)}</div>}

        {type === 'expense' && (
          <>
            <div className="fin-form__row">
              <div>
                <label className="fin-label">Nhóm</label>
                <select className="fin-input" value={categoryId}
                  onChange={e => { setCategoryId(e.target.value); setSubId(''); }}>
                  {CATS.expenseGroups.map(g => <option key={g.key} value={g.key}>{g.icon} {g.label}</option>)}
                </select>
              </div>
              <div>
                <label className="fin-label">Danh mục con</label>
                <select className="fin-input" value={subId} onChange={e => setSubId(e.target.value)}>
                  <option value="">— chọn —</option>
                  {(group?.subs || []).map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <label className="fin-label">Nguồn tiền</label>
            <select className="fin-input" value={sourceCardId} onChange={e => setSourceCardId(e.target.value)}>
              <option value="">💵 Tiền có sẵn</option>
              {fin.cards.map(c => <option key={c.id} value={c.id}>💳 {c.name} ••{c.last4 || ''}</option>)}
            </select>
            {selectedCard && (
              <div className="fin-hint">Hạn mức {money(selectedCard.credit_limit)} · chốt ngày {selectedCard.statement_day} · đến hạn ngày {selectedCard.due_day}</div>
            )}

            <label className="fin-label">Mức cần thiết</label>
            <select className="fin-input" value={necessity} onChange={e => setNecessity(e.target.value)}>
              <option value="">Tự động ({NECESSITY_META[autoNec].label})</option>
              {Object.entries(NECESSITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>

            {dupRule && <div className="fin-warn">⚠️ Danh mục con này đã có quy tắc định kỳ — có thể bị đếm hai lần.</div>}
          </>
        )}

        {type === 'saving' && (
          <>
            <label className="fin-label">Quỹ</label>
            <select className="fin-input" value={savingGoalId} onChange={e => setSavingGoalId(e.target.value)}>
              <option value="">— chọn quỹ —</option>
              {fin.goals.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </>
        )}

        <label className="fin-label">Ghi chú</label>
        <input className="fin-input" value={note} onChange={e => setNote(e.target.value)} maxLength={200} placeholder="tùy chọn" />

        <label className="fin-label">Nhiệm vụ liên quan</label>
        <TaskPicker tasks={pendingTasks} value={taskId} onPick={setTaskId} />

        <button type="submit" className="fin-btn fin-btn--primary" disabled={!parsedAmount}>Ghi</button>
      </form>
    </div>
  );
}

function AskRow({ bill, estimate, onPay, onDismiss }) {
  const [val, setVal] = useState(estimate || '');
  return (
    <div className="fin-ask__row">
      <span className="fin-ask__name">{bill.name}</span>
      <input className="fin-input fin-input--sm" placeholder="số tiền" value={val} onChange={e => setVal(e.target.value)} />
      <button className="fin-btn fin-btn--sm" onClick={() => onPay(bill, val)} disabled={!parseCurrencyInput(val)}>Ghi</button>
      <button className="fin-btn fin-btn--ghost fin-btn--sm" onClick={onDismiss}>Bỏ kỳ này</button>
    </div>
  );
}
