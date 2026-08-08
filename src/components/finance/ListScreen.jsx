import { useState, useMemo, useEffect } from 'react';
import { useUserTasks } from '../../hooks/useUserTasks';
import { useTags } from '../../hooks/useTags';
import { parseCurrencyInput } from '../../utils/currencyUtils';
import { periodTotals, groupByDate } from '../../utils/financeLogic';
import {
  money, catInfo, subLabel, NECESSITY_META, PeriodPicker, TaskPicker, Segmented,
} from './parts';

const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'expense', label: 'Chi' },
  { value: 'income', label: 'Thu' },
  { value: 'saving', label: 'Để dành' },
];

function dayLabel(dateStr, today) {
  const yesterday = new Date(new Date(today + 'T00:00:00').getTime() - 86400000)
    .toISOString().slice(0, 10);
  if (dateStr === today) return 'Hôm nay';
  if (dateStr === yesterday) return 'Hôm qua';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('vi-VN',
    { weekday: 'long', day: '2-digit', month: '2-digit' });
}

export default function ListScreen({ fin, nav }) {
  const { pendingTasks } = useUserTasks();
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState(null);
  const period = nav.period;

  const inPeriod = useMemo(
    () => fin.transactions.filter(t => t.occurred_at >= period.from && t.occurred_at <= period.to),
    [fin.transactions, period]);
  const totals = useMemo(() => periodTotals(fin.transactions, period), [fin.transactions, period]);

  const filtered = useMemo(() => inPeriod.filter(t => {
    if (filter !== 'all' && t.type !== filter) return false;
    if (q) {
      const hay = `${t.note || ''} ${catInfo(t.category_id).label} ${subLabel(t.subcategory_id) || ''}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [inPeriod, filter, q]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);
  const selected = fin.transactions.find(t => t.id === selId) || null;

  return (
    <div className="fin-list">
      <div className="fin-list__main">
        <PeriodPicker options={nav.periodOptions} value={nav.periodKey} onChange={nav.setPeriodKey} />
        <div className="fin-list__toolbar">
          <input className="fin-input fin-input--sm" placeholder="Tìm ghi chú, danh mục…"
            value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <Segmented options={FILTERS} value={filter} onChange={setFilter} />
        <div className="fin-list__summary">
          {filtered.length} khoản · chi {money(totals.total)}
          {totals.income > 0 && ` · thu ${money(totals.income)}`}
        </div>

        {groups.length === 0 && <div className="fin-empty">Không có giao dịch trong kỳ</div>}
        {groups.map(({ date, items }) => (
          <div key={date} className="fin-daygroup">
            <div className="fin-daygroup__label">{dayLabel(date, fin.today)}</div>
            {items.map(t => {
              const info = catInfo(t.category_id);
              const auto = t.bill_id || t.loan_id || t.card_id;
              const sign = t.type === 'income' ? '+' : t.type === 'saving' ? '→' : '-';
              return (
                <button key={t.id} className={`fin-txrow${selId === t.id ? ' fin-txrow--sel' : ''}`}
                  onClick={() => setSelId(t.id)}>
                  <span className="fin-txrow__ico">{t.type === 'income' ? '💰' : t.type === 'saving' ? '🏦' : info.icon}</span>
                  <div className="fin-txrow__mid">
                    <div className="fin-txrow__note">
                      {t.note || subLabel(t.subcategory_id) || info.label}
                      {auto && <span className="fin-badge">auto</span>}
                      {t.excluded && <span className="fin-badge fin-badge--muted">ngoài tổng</span>}
                    </div>
                    <div className="fin-txrow__src">
                      {t.source_card_id ? (fin.cards.find(c => c.id === t.source_card_id)?.name || 'Thẻ') : 'Tiền mặt'}
                    </div>
                  </div>
                  <span className={`fin-txrow__amt fin-txrow__amt--${t.type}`}>{sign}{money(t.amount)}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Cột chi tiết (ẩn <760px qua CSS) */}
      <aside className={`fin-list__detail${selected ? ' fin-list__detail--open' : ''}`}>
        {selected
          ? <TxDetail key={selected.id} tx={selected} fin={fin} nav={nav} tasks={pendingTasks} onClose={() => setSelId(null)} />
          : <div className="fin-empty">Chọn một giao dịch để xem chi tiết</div>}
      </aside>
    </div>
  );
}

function TxDetail({ tx, fin, nav, tasks, onClose }) {
  const { tags, addTag, linkTag, unlinkTag, getTagsForEntity } = useTags();
  const [amount, setAmount] = useState(String(tx.amount));
  const [note, setNote] = useState(tx.note || '');
  const [occurredAt, setOccurredAt] = useState(tx.occurred_at);
  const [necessity, setNecessity] = useState(tx.necessity || '');
  const [txTags, setTxTags] = useState([]);
  const info = catInfo(tx.category_id);

  useEffect(() => { getTagsForEntity(tx.id, 'finance').then(setTxTags); }, [tx.id, getTagsForEntity]);

  const save = async () => {
    const amt = parseCurrencyInput(amount);
    await fin.updateTransaction(tx.id, {
      amount: amt || tx.amount, note: note || null, occurred_at: occurredAt,
      necessity: necessity || null,
    });
    nav.showToast('Đã cập nhật — báo cáo tự tính lại', { icon: '✅' });
  };

  const toggleTag = async (tag) => {
    const has = txTags.some(t => t.id === tag.id);
    if (has) { await unlinkTag(tx.id, tag.id, 'finance'); setTxTags(p => p.filter(t => t.id !== tag.id)); }
    else { await linkTag(tx.id, tag.id, 'finance'); setTxTags(p => [...p, tag]); }
  };
  const addAndLink = async (name) => {
    const tag = await addTag(name);
    if (tag && !txTags.some(t => t.id === tag.id)) { await linkTag(tx.id, tag.id, 'finance'); setTxTags(p => [...p, tag]); }
  };

  const linkedInbox = tx.inbox_item_id;

  return (
    <div className="fin-detail">
      <div className="fin-detail__head">
        <span className="fin-detail__ico">{info.icon}</span>
        <div>
          <div className="fin-detail__cat">{info.label}{subLabel(tx.subcategory_id) ? ` · ${subLabel(tx.subcategory_id)}` : ''}</div>
          <div className="fin-detail__type">{tx.type === 'income' ? 'Khoản thu' : tx.type === 'saving' ? 'Để dành' : 'Chi tiêu'}{tx.excluded ? ' · ngoài tổng chi' : ''}</div>
        </div>
        <button className="fin-detail__close" onClick={onClose}>✕</button>
      </div>

      <label className="fin-label">Số tiền</label>
      <input className="fin-input" value={amount} onChange={e => setAmount(e.target.value)} />
      <label className="fin-label">Ngày</label>
      <input className="fin-input" type="date" value={occurredAt} onChange={e => setOccurredAt(e.target.value)} />
      <label className="fin-label">Ghi chú</label>
      <input className="fin-input" value={note} onChange={e => setNote(e.target.value)} maxLength={200} />

      {tx.type === 'expense' && !tx.excluded && (
        <>
          <label className="fin-label">Mức cần thiết</label>
          <select className="fin-input" value={necessity} onChange={e => setNecessity(e.target.value)}>
            <option value="">— chưa đặt —</option>
            {Object.entries(NECESSITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </>
      )}

      <label className="fin-label">Nhiệm vụ liên quan</label>
      <TaskPicker tasks={tasks} value={tx.task_id}
        onPick={(id) => fin.updateTransaction(tx.id, { task_id: id })} />

      {linkedInbox && <div className="fin-hint">🔗 Tạo từ một mục Inbox</div>}

      <label className="fin-label">Tag</label>
      <div className="fin-tags">
        {txTags.map(t => (
          <button key={t.id} className="fin-tag" style={{ '--tc': t.color }} onClick={() => toggleTag(t)}>#{t.name} ✕</button>
        ))}
        <TagAdd tags={tags} txTags={txTags} onAdd={addAndLink} />
      </div>

      <div className="fin-detail__actions">
        <button className="fin-btn fin-btn--primary" onClick={save}>Lưu</button>
        <button className="fin-btn fin-btn--danger" onClick={async () => { await fin.deleteTransaction(tx.id); onClose(); }}>Xóa</button>
      </div>
    </div>
  );
}

function TagAdd({ tags, txTags, onAdd }) {
  const [v, setV] = useState('');
  const avail = tags.filter(t => !txTags.some(x => x.id === t.id));
  return (
    <span className="fin-tagadd">
      <input className="fin-input fin-input--sm" list="fin-tag-list" placeholder="+ tag"
        value={v} onChange={e => setV(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && v.trim()) { e.preventDefault(); onAdd(v.trim()); setV(''); } }} />
      <datalist id="fin-tag-list">{avail.map(t => <option key={t.id} value={t.name} />)}</datalist>
    </span>
  );
}
