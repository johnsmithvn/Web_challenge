import { useMemo, useState, useEffect } from 'react';
import { useUserTasks } from '../../hooks/useUserTasks';
import { useTags } from '../../hooks/useTags';
import { parseCurrencyInput, sanitizeDigits } from '../../utils/currencyUtils';
import { toDateStr } from '../../utils/dateUtils';
import { periodTotals, groupByDate, billPeriods } from '../../utils/financeLogic';
import {
  money, catInfo, subLabel, NECESSITY_META, PeriodPicker, TaskPicker, FinanceIcon, DateField,
} from './parts';
import SkeletonList from '../SkeletonList';
import AppIcon from '../AppIcon';

const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'expense', label: 'Chi' },
  { value: 'income', label: 'Thu' },
  { value: 'must', label: 'Phải trả' },
  { value: 'want', label: 'Không bắt buộc' },
  { value: 'auto', label: 'Do định kỳ sinh' },
];

function dayLabel(dateStr, today) {
  // toDateStr, KHÔNG toISOString: ở GMT+7 toISOString lùi thêm 1 ngày nữa nên
  // nhãn "Hôm qua" rơi vào hôm-trước-hôm-qua. Xem dateUtils.test.js case 00:30.
  const yesterday = toDateStr(new Date(new Date(`${today}T00:00:00`).getTime() - 86400000));
  if (dateStr === today) return `Hôm nay · ${new Date(`${dateStr}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}`;
  if (dateStr === yesterday) return `Hôm qua · ${new Date(`${dateStr}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}`;
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('vi-VN',
    { weekday: 'long', day: '2-digit', month: '2-digit' });
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export default function ListScreen({ fin, nav }) {
  const { pendingTasks } = useUserTasks();
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState(null);
  const period = nav.period;

  const inPeriod = useMemo(
    () => fin.transactions.filter(tx => tx.occurred_at >= period.from && tx.occurred_at <= period.to),
    [fin.transactions, period]);
  const totals = useMemo(
    () => periodTotals(fin.transactions, period, { savingAsExpense: nav.savingAsExpense }),
    [fin.transactions, period, nav.savingAsExpense],
  );

  const filtered = useMemo(() => inPeriod.filter(tx => {
    if (filter === 'auto' && !(tx.bill_id || tx.loan_id || tx.card_id)) return false;
    if (filter === 'must' && tx.necessity !== 'must') return false;
    if (filter === 'want' && tx.necessity !== 'want') return false;
    if (filter === 'expense' && tx.type !== 'expense') return false;
    if (filter === 'income' && tx.type !== 'income') return false;
    if (q) {
      const haystack = [tx.note, tx.merchant, catInfo(tx.category_id, fin.cats).label,
        subLabel(tx.subcategory_id, fin.cats)].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [inPeriod, filter, q, fin.cats]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);
  const selected = filtered.find(tx => tx.id === selId) || null;

  const exportCsv = () => {
    if (!filtered.length) return;
    const headers = ['Ngày', 'Loại', 'Số tiền', 'Nhóm', 'Danh mục con', 'Mức cắt được', 'Nguồn tiền', 'Nơi / người nhận', 'Tiêu đề'];
    const rows = filtered.map(tx => [
      tx.occurred_at,
      tx.type,
      tx.amount,
      catInfo(tx.category_id, fin.cats).label,
      subLabel(tx.subcategory_id, fin.cats) || '',
      NECESSITY_META[tx.necessity]?.label || '',
      tx.source_card_id ? (fin.cards.find(card => card.id === tx.source_card_id)?.name || 'Thẻ') : 'Tiền có sẵn',
      tx.merchant || '',
      tx.note || '',
    ]);
    const csv = `\uFEFF${[headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `giao-dich-${period.key}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`fin-list${selected ? ' fin-list--detail' : ''}`}>
      <div className="fin-list__main">
        <PeriodPicker options={nav.periodOptions} period={nav.period} value={nav.periodKey} onChange={nav.setPeriodKey} dataFrom={nav.dataFrom} />

        <div className="fin-list__controls">
          <label className="fin-list__search">
            <AppIcon name="search" size={15} />
            {/* <label> bọc ngoài chỉ chứa AppIcon (đã aria-hidden) nên ô này KHÔNG có
                tên nào — screen reader đọc ra "edit text" trống trơn. */}
            <input aria-label="Tìm giao dịch" placeholder="Tìm theo tên, nơi, tag…" value={q} onChange={event => setQ(event.target.value)} />
          </label>
          <div className="fin-filter-chips">
            {FILTERS.map(item => <button key={item.value} type="button"
              className={filter === item.value ? 'is-active' : ''}
              onClick={() => setFilter(item.value)}>{item.label}</button>)}
          </div>
          <button type="button" className="fin-export" onClick={exportCsv} disabled={!filtered.length}>
            <AppIcon name="upload" size={15} /> Xuất CSV
          </button>
        </div>

        <div className="fin-list__summary">
          {filtered.length} khoản · chi {money(totals.total)}
          {totals.income > 0 && ` · thu ${money(totals.income)}`}
        </div>

        {/* Đang tải thì giữ chỗ bằng skeleton, KHÔNG hiện "chưa có giao dịch" — báo
            trống rồi một giây sau bật ra 20 dòng là kiểu nói dối khó chịu nhất.
            Điều kiện phải là `hasLoaded`, không phải `isLoading`: fetch chạy trong
            effect nên frame ĐẦU có isLoading=false và list rỗng, đủ để empty state
            kịp nháy ra một cái. */}
        {!fin.hasLoaded && groups.length === 0 && <SkeletonList rows={5} gap="6px" label="Đang tải giao dịch" />}

        {fin.hasLoaded && groups.length === 0 && (
          <section className="fin-list-empty">
            <span><AppIcon name="receipt" size={24} /></span>
            <strong>{q || filter !== 'all' ? 'Không tìm thấy giao dịch phù hợp' : 'Chưa có giao dịch trong kỳ này'}</strong>
            <p>{q || filter !== 'all' ? 'Thử đổi bộ lọc hoặc từ khóa tìm kiếm.' : 'Ghi khoản đầu tiên để bắt đầu theo dõi tháng này.'}</p>
            {q || filter !== 'all'
              ? <button type="button" onClick={() => { setQ(''); setFilter('all'); }}>Xóa bộ lọc</button>
              : <button type="button" onClick={() => nav.go('add')}><AppIcon name="plus" size={15} /> Thêm giao dịch</button>}
          </section>
        )}

        <div className="fin-timeline">
          {groups.map(({ date, items }) => {
            const groupTotal = items.filter(tx => tx.type === 'expense' && !tx.excluded)
              .reduce((sum, tx) => sum + tx.amount, 0);
            return <section key={date} className="fin-daygroup">
              <div className="fin-daygroup__label"><strong>{dayLabel(date, fin.today)}</strong><i /><span>{money(groupTotal)}</span></div>
              {items.map(tx => {
                const info = catInfo(tx.category_id, fin.cats);
                // Hóa đơn cho phép chọn icon riêng; giao dịch nó sinh ra phải theo cùng,
                // không thì đổi icon ở màn Hóa đơn xong sang đây vẫn thấy icon của nhóm.
                const billIcon = tx.bill_id ? fin.bills.find(b => b.id === tx.bill_id)?.icon : null;
                const automated = tx.bill_id || tx.loan_id || tx.card_id;
                const sign = tx.type === 'income' ? '+' : tx.type === 'saving' ? '→ ' : '-';
                const source = tx.source_card_id ? (fin.cards.find(card => card.id === tx.source_card_id)?.name || 'Thẻ') : 'Tiền có sẵn';
                return (
                  <button key={tx.id} className={`fin-txrow${selected?.id === tx.id ? ' fin-txrow--sel' : ''}`}
                    onClick={() => setSelId(tx.id)}>
                    <span className="fin-txrow__ico" style={{ color: info.color }}>
                      <FinanceIcon name={tx.type === 'income' ? 'money' : tx.type === 'saving' ? 'bank' : (billIcon || info.icon)} cats={fin.cats} size={17} weight="fill" />
                    </span>
                    <span className="fin-txrow__mid">
                      <span className="fin-txrow__note">
                        {tx.note || subLabel(tx.subcategory_id, fin.cats) || info.label}
                        {automated && <AppIcon name="arrowsClockwise" size={12} />}
                        {tx.excluded && <span className="fin-badge fin-badge--muted">ngoài tổng</span>}
                      </span>
                      <span className="fin-txrow__src">{info.label}{subLabel(tx.subcategory_id, fin.cats) ? ` › ${subLabel(tx.subcategory_id, fin.cats)}` : ''} · {tx.merchant || source}</span>
                    </span>
                    <span className={`fin-txrow__amt fin-txrow__amt--${tx.type}`}>{sign}{money(tx.amount)}</span>
                  </button>
                );
              })}
            </section>;
          })}
        </div>
      </div>

      {selected && (
        <aside className="fin-list__detail">
          <TxDetail key={selected.id} tx={selected} fin={fin} nav={nav} tasks={pendingTasks}
            onClose={() => setSelId(null)} onSelect={(id) => setSelId(id)} />
        </aside>
      )}
    </div>
  );
}

function TxDetail({ tx, fin, nav, tasks, onClose, onSelect }) {
  const { tags, addTag, linkTag, unlinkTag, getTagsForEntity } = useTags();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(tx.amount));
  const [note, setNote] = useState(tx.note || '');
  const [occurredAt, setOccurredAt] = useState(tx.occurred_at);
  const [necessity, setNecessity] = useState(tx.necessity || '');
  const [categoryId, setCategoryId] = useState(tx.category_id || (tx.type === 'income' ? 'luong' : 'other'));
  const [subcategoryId, setSubcategoryId] = useState(tx.subcategory_id || '');
  const [sourceCardId, setSourceCardId] = useState(tx.source_card_id || '');
  const [billPeriod, setBillPeriod] = useState(tx.bill_period || '');
  const [txTags, setTxTags] = useState([]);
  // Giao dịch sinh từ hóa đơn: cho sửa KỲ ngay tại đây. Gắn nhầm kỳ là hóa đơn báo
  // quá hạn dù đã trả, mà trước đó đường sửa duy nhất là xóa rồi ghi lại từ đầu.
  const linkedBill = tx.bill_id ? fin.bills.find(bill => bill.id === tx.bill_id) : null;
  const periodChoices = linkedBill
    ? Array.from(new Set([...billPeriods(linkedBill, tx.bill_period || fin.today.slice(0, 7), 8),
      tx.bill_period].filter(Boolean))).sort().reverse()
    : [];
  const info = catInfo(categoryId, fin.cats);
  const categoryOptions = tx.type === 'income' ? fin.cats.incomeGroups : fin.cats.expenseGroups;
  const subOptions = fin.cats.expenseGroups.find(group => group.key === categoryId)?.subs || [];
  const source = tx.source_card_id ? (fin.cards.find(card => card.id === tx.source_card_id)?.name || 'Thẻ') : 'Tiền có sẵn';
  const typeLabel = tx.type === 'income' ? 'Thu' : tx.type === 'saving' ? 'Để dành' : 'Chi';

  useEffect(() => { getTagsForEntity(tx.id, 'finance').then(setTxTags); }, [tx.id, getTagsForEntity]);

  const save = async () => {
    const parsed = parseCurrencyInput(amount);
    await fin.updateTransaction(tx.id, {
      amount: parsed || tx.amount, note: note || null, occurred_at: occurredAt,
      necessity: necessity || null, category_id: categoryId || null,
      subcategory_id: subcategoryId || null, source_card_id: sourceCardId || null,
      ...(linkedBill && billPeriod !== tx.bill_period ? { bill_period: billPeriod } : {}),
    });
    nav.showToast('Đã cập nhật — báo cáo tự tính lại', { icon: 'checkCircle' });
    setEditing(false);
  };

  const duplicate = async () => {
    const copy = await fin.addTransaction({
      type: tx.type, amount: tx.amount, occurred_at: fin.today,
      category_id: tx.category_id, subcategory_id: tx.subcategory_id,
      source_card_id: tx.source_card_id, excluded: tx.excluded,
      necessity: tx.necessity, is_fixed: false,
      note: tx.note ? `${tx.note} · bản sao` : null,
      merchant: tx.merchant, items: tx.items || [], task_id: tx.task_id,
      saving_goal_id: tx.saving_goal_id, saving_dir: tx.saving_dir,
    });
    if (copy) {
      nav.showToast('Đã nhân bản giao dịch', { icon: 'copy' });
      onSelect(copy.id);
    }
  };

  const toggleTag = async (tag) => {
    const hasTag = txTags.some(item => item.id === tag.id);
    if (hasTag) {
      await unlinkTag(tx.id, tag.id, 'finance');
      setTxTags(current => current.filter(item => item.id !== tag.id));
    } else {
      await linkTag(tx.id, tag.id, 'finance');
      setTxTags(current => [...current, tag]);
    }
  };

  const addAndLink = async (name) => {
    const tag = await addTag(name);
    if (tag && !txTags.some(item => item.id === tag.id)) {
      await linkTag(tx.id, tag.id, 'finance');
      setTxTags(current => [...current, tag]);
    }
  };

  const deleteTx = async () => {
    if (!await nav.confirmDelete('giao dịch')) return;
    if (await fin.deleteTransaction(tx.id)) onClose();
  };

  if (editing) {
    return (
      <div className="fin-detail fin-detail--editing">
        <div className="fin-detail__head"><strong>Sửa giao dịch</strong><button className="fin-detail__close" onClick={() => setEditing(false)} aria-label="Đóng chỉnh sửa"><AppIcon name="x" size={15} /></button></div>
        {/* Các <label> ở đây là anh em kề chứ không bọc control và không có htmlFor,
            nên chúng chỉ là chữ trang trí với AT — mỗi control phải tự mang nhãn. */}
        <label className="fin-label">Số tiền</label><input className="fin-input" aria-label="Số tiền" inputMode="numeric" pattern="[0-9]*" value={amount} onChange={event => setAmount(sanitizeDigits(event.target.value))} />
        <label className="fin-label">Ngày</label><DateField value={occurredAt} onChange={setOccurredAt} />
        <label className="fin-label">Tiêu đề</label><input className="fin-input" aria-label="Tiêu đề giao dịch" value={note} onChange={event => setNote(event.target.value)} maxLength={200} />
        {tx.type !== 'saving' && <><label className="fin-label">Nhóm</label><select className="fin-input" aria-label="Nhóm" value={categoryId} onChange={event => { setCategoryId(event.target.value); setSubcategoryId(''); }}>{categoryOptions.filter(group => !group.hidden).map(group => <option key={group.key} value={group.key}>{group.label}</option>)}</select></>}
        {tx.type === 'expense' && <>
          <label className="fin-label">Danh mục con</label><select className="fin-input" aria-label="Danh mục con" value={subcategoryId} onChange={event => setSubcategoryId(event.target.value)}><option value="">— chưa chọn —</option>{subOptions.map(sub => <option key={sub.key} value={sub.key}>{sub.label}</option>)}</select>
          <label className="fin-label">Nguồn tiền</label><select className="fin-input" aria-label="Nguồn tiền" value={sourceCardId} onChange={event => setSourceCardId(event.target.value)}><option value="">Tiền có sẵn</option>{fin.cards.map(card => <option key={card.id} value={card.id}>{card.name} {card.last4 ? `••${card.last4}` : ''}</option>)}</select>
          {!tx.excluded && <><label className="fin-label">Mức cắt được</label><select className="fin-input" aria-label="Mức cắt được" value={necessity} onChange={event => setNecessity(event.target.value)}><option value="">— chưa đặt —</option>{Object.entries(NECESSITY_META).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></>}
        </>}
        {linkedBill && <>
          <label className="fin-label">Thuộc kỳ của {linkedBill.name}</label>
          <select className="fin-input" aria-label={`Kỳ của ${linkedBill.name}`} value={billPeriod} onChange={event => setBillPeriod(event.target.value)}>
            {periodChoices.map(key => <option key={key} value={key}>{key.slice(5)}/{key.slice(0, 4)}</option>)}
          </select>
          <small className="fin-field__hint">Kỳ tách khỏi ngày trả: trả kỳ tháng 7 vào tháng 8 thì kỳ vẫn là 07. Gắn sai kỳ thì hóa đơn báo quá hạn dù tiền đã ra khỏi ví.</small>
        </>}
        <label className="fin-label">Nhiệm vụ liên quan</label><TaskPicker tasks={tasks} value={tx.task_id} onPick={id => fin.updateTransaction(tx.id, { task_id: id })} />
        <label className="fin-label">Tag</label><div className="fin-tags">{txTags.map(tag => <button key={tag.id} className="fin-tag" style={{ '--tc': tag.color }} onClick={() => toggleTag(tag)}>#{tag.name} <AppIcon name="x" size={11} /></button>)}<TagAdd tags={tags} txTags={txTags} onAdd={addAndLink} /></div>
        <div className="fin-detail__actions"><button className="fin-btn fin-btn--primary" onClick={save}><AppIcon name="save" size={15} /> Lưu thay đổi</button><button className="fin-btn fin-btn--secondary" onClick={() => setEditing(false)}>Hủy</button></div>
      </div>
    );
  }

  const meta = [
    ['Ngày', new Date(`${tx.occurred_at}T00:00:00`).toLocaleDateString('vi-VN')],
    ['Nơi', tx.merchant || '—'],
    ['Loại', typeLabel],
    ['Mức cắt được', NECESSITY_META[tx.necessity]?.label || '—'],
    ['Tính chất', tx.is_fixed ? 'Cố định' : 'Biến đổi'],
    ['Trả bằng', source],
    ['Nguồn tạo', tx.bill_id ? 'Hóa đơn định kỳ' : tx.loan_id ? 'Khoản vay' : tx.card_id ? 'Sao kê thẻ' : tx.shortcut_id ? 'Shortcut' : tx.inbox_item_id ? 'Inbox' : 'Nhập tay'],
  ];
  // Kỳ nghĩa vụ tách khỏi ngày ghi (trả hóa đơn tháng 7 vào tháng 8 vẫn thuộc kỳ 7).
  // Không hiện ra thì không có cách nào biết một khoản đã trả đang gắn nhầm kỳ nào.
  const period = tx.bill_period || tx.income_period || tx.loan_period || tx.card_period;
  if (period) meta.push(['Thuộc kỳ', `${period.slice(5)}/${period.slice(0, 4)}`]);

  return (
    <div className="fin-detail">
      <div className="fin-detail__hero">
        <span className="fin-detail__ico" style={{ color: info.color }}><FinanceIcon name={info.icon} cats={fin.cats} size={19} weight="fill" /></span>
        <span><strong>{tx.note || subLabel(tx.subcategory_id, fin.cats) || info.label}</strong><small>{info.label}{subLabel(tx.subcategory_id, fin.cats) ? ` › ${subLabel(tx.subcategory_id, fin.cats)}` : ''}</small></span>
        <button className="fin-detail__close" onClick={onClose} aria-label="Đóng chi tiết"><AppIcon name="x" size={15} /></button>
      </div>
      <div className={`fin-detail__amount fin-detail__amount--${tx.type}`}>{tx.type === 'income' ? '+' : tx.type === 'saving' ? '' : '-'}{money(tx.amount)}</div>
      <div className="fin-detail__meta">{meta.map(([key, value]) => <div key={key}><span>{key}</span><strong>{value}</strong></div>)}</div>
      {(tx.items || []).length > 0 && <div className="fin-detail__items"><strong>Chi tiết {tx.items.length} món</strong>{tx.items.map((item, index) => <div key={`${item.name}-${index}`}><span>{item.qty > 1 ? `${item.qty} × ` : ''}{item.name}</span><b>{money((item.qty || 1) * (item.price || 0))}</b></div>)}</div>}
      {txTags.length > 0 && <div className="fin-tags">{txTags.map(tag => <span key={tag.id} className="fin-tag" style={{ '--tc': tag.color }}>#{tag.name}</span>)}</div>}
      {tx.task_id && <div className="fin-detail__linked"><AppIcon name="pushPin" size={14} /> Đã gắn với một nhiệm vụ</div>}
      <div className="fin-detail__actions fin-detail__actions--view">
        <button className="fin-btn fin-btn--secondary" onClick={() => setEditing(true)}><AppIcon name="pencil" size={15} /> Sửa</button>
        {tx.type !== 'saving' && <button className="fin-btn fin-btn--secondary" onClick={duplicate}><AppIcon name="copy" size={15} /> Nhân bản</button>}
        <button className="fin-btn fin-btn--secondary fin-detail__delete" aria-label="Xóa giao dịch" onClick={deleteTx}><AppIcon name="trash" size={15} /></button>
      </div>
    </div>
  );
}

function TagAdd({ tags, txTags, onAdd }) {
  const [value, setValue] = useState('');
  const available = tags.filter(tag => !txTags.some(item => item.id === tag.id));
  return (
    <span className="fin-tagadd">
      <input className="fin-input fin-input--sm" list="fin-tag-list" placeholder="+ tag" aria-label="Thêm tag cho giao dịch"
        value={value} onChange={event => setValue(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter' && value.trim()) { event.preventDefault(); onAdd(value.trim()); setValue(''); } }} />
      <datalist id="fin-tag-list">{available.map(tag => <option key={tag.id} value={tag.name} />)}</datalist>
    </span>
  );
}
