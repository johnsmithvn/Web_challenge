import { useMemo, useRef, useState, useEffect } from 'react';
import { useUserTasks } from '../../hooks/useUserTasks';
import { groupDigits, parseCurrencyInput, sanitizeDigits } from '../../utils/currencyUtils';
import { formatDate, toDateStr } from '../../utils/dateUtils';
import { periodTotals, groupByDate, billPeriods } from '../../utils/financeLogic';
import {
  money, catInfo, subLabel, pickableSubs, NECESSITY_META, PeriodPicker, TaskPicker, FinanceIcon, DateField,
} from './parts';
import SkeletonList from '../SkeletonList';
import AppIcon from '../AppIcon';

const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'expense', label: 'Chi' },
  { value: 'income', label: 'Thu' },
  { value: 'must', label: 'Phải trả' },
  { value: 'want', label: 'Tùy chọn' },
  { value: 'auto', label: 'Do định kỳ sinh' },
];

const EMPTY_FILTER = { cat: '', sub: '', from: '', to: '' };

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
  const [localQ, setLocalQ] = useState('');
  const q = nav.searchQuery !== undefined ? nav.searchQuery : localQ;
  const setQ = nav.setSearchQuery || setLocalQ;
  const [flt, setFlt] = useState(EMPTY_FILTER);
  const [selId, setSelId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const period = nav.period;

  const inPeriod = useMemo(
    () => fin.transactions.filter(tx => tx.occurred_at >= period.from && tx.occurred_at <= period.to),
    [fin.transactions, period]);
  const totals = useMemo(
    () => periodTotals(fin.transactions, period),
    [fin.transactions, period],
  );

  const filtered = useMemo(() => inPeriod.filter(tx => {
    if (filter === 'auto' && !(tx.bill_id || tx.loan_id || tx.card_id)) return false;
    if (filter === 'must' && tx.necessity !== 'must') return false;
    if (filter === 'want' && tx.necessity !== 'want') return false;
    if (filter === 'expense' && tx.type !== 'expense') return false;
    if (filter === 'income' && tx.type !== 'income') return false;
    if (q) {
      const haystack = [tx.note, tx.description, tx.merchant, catInfo(tx.category_id, fin.cats).label,
        subLabel(tx.subcategory_id, fin.cats)].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q.toLowerCase())) return false;
    }
    // Bộ lọc phễu cộng dồn (AND) với chip loại và ô tìm: chọn thêm điều kiện là thu hẹp
    // dần, không điều kiện nào thay điều kiện nào.
    if (flt.cat && tx.category_id !== flt.cat) return false;
    if (flt.sub && tx.subcategory_id !== flt.sub) return false;
    if (flt.from && tx.occurred_at < flt.from) return false;
    if (flt.to && tx.occurred_at > flt.to) return false;
    return true;
  }), [inPeriod, filter, q, flt, fin.cats]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);
  const selected = filtered.find(tx => tx.id === selId) || null;
  // Một cờ duy nhất cho "đang lọc": empty state phải nói đúng lý do list rỗng, và nút
  // Xóa bộ lọc phải xóa HẾT — sót một điều kiện là bấm xong list vẫn trống.
  const hasFilter = Boolean(q || filter !== 'all' || flt.cat || flt.from || flt.to);
  const clearFilters = () => { setQ(''); setFilter('all'); setFlt(EMPTY_FILTER); };
  // `totals` là số của CẢ KỲ (dùng chung với Tổng quan), không phải của phần đang lọc.
  // Đứng cạnh "3 khoản" nó đọc như tổng của 3 khoản đó, nên khi có lọc phải nói thêm
  // tổng thật của phần đang xem. Cùng công thức với tổng mỗi ngày ở dưới.
  const shownTotal = useMemo(() => filtered
    .filter(tx => tx.type === 'expense' && !tx.excluded)
    .reduce((sum, tx) => sum + tx.amount, 0), [filtered]);

  const exportCsv = () => {
    if (!filtered.length) return;
    const headers = ['Ngày', 'Loại', 'Số tiền', 'Nhóm', 'Danh mục con', 'Mức cắt được', 'Nguồn tiền', 'Tiêu đề', 'Ghi chú', 'Nơi / người nhận'];
    const rows = filtered.map(tx => [
      tx.occurred_at,
      tx.type,
      tx.amount,
      catInfo(tx.category_id, fin.cats).label,
      subLabel(tx.subcategory_id, fin.cats) || '',
      NECESSITY_META[tx.necessity]?.label || '',
      tx.source_card_id ? (fin.cards.find(card => card.id === tx.source_card_id)?.name || 'Thẻ') : 'Tiền có sẵn',
      tx.note || '',
      tx.description || '',
      tx.merchant || '',
    ]);
    const csv = `\uFEFF${[headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `finance-${period.label.replaceAll(' ', '-').toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`fin-list${selected ? ' fin-list--detail' : ''}`}>
      <div className="fin-list__main">
        <div className="fin-list__toolbar">
          <PeriodPicker
            options={nav.periodOptions}
            period={nav.period}
            value={nav.periodKey}
            onChange={nav.setPeriodKey}
            dataFrom={nav.dataFrom}
            compact
          />
          <span className="fin-toolbar-sep" aria-hidden="true" />
          <FilterPop cats={fin.cats} value={flt} onChange={setFlt} />
          <div className="fin-filter-chips">
            {FILTERS.map(item => <button key={item.value} type="button"
              className={filter === item.value ? 'is-active' : ''}
              onClick={() => setFilter(item.value)}>{item.label}</button>)}
          </div>
          <button type="button" className="fin-export" onClick={exportCsv} disabled={!filtered.length}>
            <AppIcon name="upload" size={15} /> Xuất CSV
          </button>
        </div>

        {/* Điều kiện đang bật phải HIỆN RA ở đây. Bộ lọc nằm trong popover: đóng lại
            rồi thì "26 khoản" tụt xuống "3 khoản" mà không có gì giải thích. */}
        <div className="fin-list__summary">
          {filtered.length} khoản · chi {money(totals.total)}
          {totals.income > 0 && ` · thu ${money(totals.income)}`}
          {hasFilter && ` · phần đang lọc: chi ${money(shownTotal)}`}
          {flt.cat && ` · ${catInfo(flt.cat, fin.cats).label}${flt.sub ? ` › ${subLabel(flt.sub, fin.cats)}` : ''}`}
          {(flt.from || flt.to) && ` · ${flt.from ? formatDate(flt.from) : '…'} → ${flt.to ? formatDate(flt.to) : '…'}`}
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
            <strong>{hasFilter ? 'Không tìm thấy giao dịch phù hợp' : 'Chưa có giao dịch trong kỳ này'}</strong>
            <p>{hasFilter ? 'Thử đổi bộ lọc hoặc từ khóa tìm kiếm.' : 'Ghi khoản đầu tiên để bắt đầu theo dõi tháng này.'}</p>
            {hasFilter
              ? <button type="button" onClick={clearFilters}>Xóa bộ lọc</button>
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
                    onClick={() => { setSelId(tx.id); setIsEditing(false); }}>
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
            onClose={() => { setSelId(null); setIsEditing(false); }}
            onSelect={(id) => { setSelId(id); setIsEditing(false); }}
            isEditing={isEditing} onEditingChange={setIsEditing} />
        </aside>
      )}
    </div>
  );
}

/**
 * Bộ lọc chi tiết của màn Giao dịch: nhóm · danh mục con · khoảng ngày.
 *
 * Danh mục con CHỈ chọn được sau khi chọn nhóm cha. Key của con mang tiền tố nhóm
 * (`transport.parking`) và chỉ nhóm CHI mới có con, nên một danh sách con phẳng vừa dài
 * vừa mơ hồ. Đổi nhóm là bỏ luôn con đang chọn: giữ lại thì bộ lọc mô tả một cặp
 * cha–con không tồn tại và list rỗng mà không ai hiểu tại sao.
 *
 * Khoảng ngày lọc TRONG kỳ đang xem ở trên chứ không thay kỳ đó — kỳ dùng chung với
 * Tổng quan qua `nav`, sửa từ đây là đổi số của màn khác.
 */
function FilterPop({ cats, value, onChange }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const subs = cats.expenseGroups.find(group => group.key === value.cat)?.subs || [];
  const count = [value.cat, value.sub, value.from, value.to].filter(Boolean).length;

  useEffect(() => {
    if (!open) return undefined;
    const close = event => {
      if (event.key === 'Escape' || (event.type === 'mousedown' && !rootRef.current?.contains(event.target))) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const patch = next => onChange({ ...value, ...next });

  return (
    <div className="fin-filterpop" ref={rootRef}>
      <button type="button" className={`fin-filterpop__btn${count ? ' is-active' : ''}${open ? ' is-open' : ''}`}
        aria-expanded={open} aria-label={count ? `Bộ lọc · ${count} điều kiện đang bật` : 'Bộ lọc'}
        onClick={() => setOpen(o => !o)}>
        <AppIcon name="funnel" size={15} weight={count ? 'fill' : 'regular'} />
        <span>Lọc</span>
        {count > 0 && <b>{count}</b>}
      </button>
      {open && (
        <div className="fin-filterpop__panel">
          <label className="fin-label" htmlFor="fin-flt-cat">Nhóm</label>
          <select id="fin-flt-cat" className="fin-input" value={value.cat}
            onChange={event => patch({ cat: event.target.value, sub: '' })}>
            <option value="">Tất cả nhóm</option>
            <optgroup label="Chi">
              {cats.expenseGroups.filter(group => !group.hidden)
                .map(group => <option key={group.key} value={group.key}>{group.label}</option>)}
            </optgroup>
            <optgroup label="Thu">
              {cats.incomeGroups.filter(group => !group.hidden)
                .map(group => <option key={group.key} value={group.key}>{group.label}</option>)}
            </optgroup>
          </select>

          <label className="fin-label" htmlFor="fin-flt-sub">Danh mục con</label>
          <select id="fin-flt-sub" className="fin-input" value={value.sub} disabled={!subs.length}
            onChange={event => patch({ sub: event.target.value })}>
            <option value="">{!value.cat ? 'Chọn nhóm trước'
              : subs.length ? 'Tất cả danh mục con' : 'Nhóm này không có danh mục con'}</option>
            {subs.map(sub => <option key={sub.key} value={sub.key}>{sub.label}</option>)}
          </select>

          <div className="fin-filterpop__dates">
            {/* Hai ô ngày cạnh nhau: DateField mặc định tự đọc là "Ngày" nên phải đặt tên
                riêng, không thì screen reader đọc hai ô y như nhau. */}
            <div><label className="fin-label">Từ ngày</label>
              <DateField value={value.from} ariaLabel="Lọc từ ngày, dạng ngày/tháng/năm"
                onChange={iso => patch({ from: iso, ...(value.to && iso > value.to ? { to: '' } : {}) })} /></div>
            <div><label className="fin-label">Đến ngày</label>
              <DateField value={value.to} ariaLabel="Lọc đến ngày, dạng ngày/tháng/năm"
                onChange={iso => patch({ to: iso, ...(value.from && iso < value.from ? { from: '' } : {}) })} /></div>
          </div>
          <small className="fin-field__hint">Khoảng ngày lọc trong kỳ đang xem ở trên, không thay kỳ đó. Chọn ngược thứ tự thì ô kia được bỏ để bộ lọc không rỗng một cách vô hình.</small>

          <div className="fin-filterpop__foot">
            <button type="button" className="fin-btn fin-btn--secondary fin-btn--sm" disabled={!count}
              onClick={() => onChange(EMPTY_FILTER)}>Xóa lọc</button>
            <button type="button" className="fin-btn fin-btn--primary fin-btn--sm"
              onClick={() => setOpen(false)}>Xong</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TxDetail({ tx, fin, nav, tasks, onClose, onSelect, isEditing, onEditingChange }) {
  const [amount, setAmount] = useState(String(tx.amount));
  const [note, setNote] = useState(tx.note || '');
  const [description, setDescription] = useState(tx.description || '');
  const [occurredAt, setOccurredAt] = useState(tx.occurred_at);
  const [necessity, setNecessity] = useState(tx.necessity || '');
  const [categoryId, setCategoryId] = useState(tx.category_id || (tx.type === 'income' ? 'luong' : 'other'));
  const [subcategoryId, setSubcategoryId] = useState(tx.subcategory_id || '');
  const [sourceCardId, setSourceCardId] = useState(tx.source_card_id || '');
  const [billPeriod, setBillPeriod] = useState(tx.bill_period || '');
  const [merchant, setMerchant] = useState(tx.merchant || '');
  const [draftItems, setDraftItems] = useState(() =>
    Array.isArray(tx.items)
      ? tx.items.map(item => ({
          name: item.name || '',
          qty: String(item.qty || 1),
          price: String(item.price || ''),
        }))
      : [],
  );
  // Giao dịch sinh từ hóa đơn: cho sửa KỲ ngay tại đây. Gắn nhầm kỳ là hóa đơn báo
  // quá hạn dù đã trả, mà trước đó đường sửa duy nhất là xóa rồi ghi lại từ đầu.
  const linkedBill = tx.bill_id ? fin.bills.find(bill => bill.id === tx.bill_id) : null;
  const periodChoices = linkedBill
    ? Array.from(new Set([...billPeriods(linkedBill, tx.bill_period || fin.today.slice(0, 7), 8),
      tx.bill_period].filter(Boolean))).sort().reverse()
    : [];
  const info = catInfo(categoryId, fin.cats);
  const categoryOptions = tx.type === 'income' ? fin.cats.incomeGroups : fin.cats.expenseGroups;
  const subOptions = pickableSubs(fin.cats.expenseGroups.find(group => group.key === categoryId), tx.subcategory_id, fin.cats);
  const source = tx.source_card_id ? (fin.cards.find(card => card.id === tx.source_card_id)?.name || 'Thẻ') : 'Tiền có sẵn';
  const typeLabel = tx.type === 'income' ? 'Thu' : tx.type === 'saving' ? 'Để dành' : 'Chi';

  const updateDraftItem = (index, key, value) => {
    const normalized = key === 'qty' ? sanitizeDigits(value, 3)
      : key === 'price' ? sanitizeDigits(value) : value;
    const next = draftItems.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: normalized } : item);
    setDraftItems(next);
    const total = next.reduce((sum, item) => sum
      + (Math.max(1, Number(item.qty) || 1) * (parseCurrencyInput(item.price) || 0)), 0);
    if (total > 0) setAmount(String(total));
  };

  const cancelEdit = () => {
    setAmount(String(tx.amount));
    setNote(tx.note || '');
    setDescription(tx.description || '');
    setOccurredAt(tx.occurred_at);
    setNecessity(tx.necessity || '');
    setCategoryId(tx.category_id || (tx.type === 'income' ? 'luong' : 'other'));
    setSubcategoryId(tx.subcategory_id || '');
    setSourceCardId(tx.source_card_id || '');
    setBillPeriod(tx.bill_period || '');
    setMerchant(tx.merchant || '');
    setDraftItems(Array.isArray(tx.items) ? tx.items.map(item => ({ name: item.name || '', qty: String(item.qty || 1), price: String(item.price || '') })) : []);
    onEditingChange(false);
  };

  const save = async () => {
    const parsed = parseCurrencyInput(amount, { autoK: false });
    const cleanItems = draftItems
      .filter(item => item.name?.trim() || parseCurrencyInput(item.price))
      .map(item => ({
        name: item.name?.trim() || 'Mục chưa đặt tên',
        qty: Math.max(1, Number(item.qty) || 1),
        price: parseCurrencyInput(item.price) || 0,
      }));

    await fin.updateTransaction(tx.id, {
      amount: parsed || tx.amount,
      note: note || null,
      description: description.trim() || null,
      merchant: merchant.trim() || null,
      items: cleanItems,
      occurred_at: occurredAt,
      necessity: necessity || null,
      category_id: categoryId || null,
      subcategory_id: subcategoryId || null,
      source_card_id: sourceCardId || null,
      ...(linkedBill && billPeriod !== tx.bill_period ? { bill_period: billPeriod } : {}),
    });
    nav.showToast('Đã cập nhật — báo cáo tự tính lại', { icon: 'checkCircle' });
    onEditingChange(false);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isEditing) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          save();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelEdit();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const duplicate = async () => {
    const copy = await fin.addTransaction({
      type: tx.type, amount: tx.amount, occurred_at: fin.today,
      category_id: tx.category_id, subcategory_id: tx.subcategory_id,
      source_card_id: tx.source_card_id, excluded: tx.excluded,
      necessity: tx.necessity, is_fixed: false,
      note: tx.note ? `${tx.note} · bản sao` : null,
      description: tx.description || null,
      merchant: tx.merchant, items: tx.items || [], task_id: tx.task_id,
      saving_goal_id: tx.saving_goal_id, saving_dir: tx.saving_dir,
    });
    if (copy) {
      nav.showToast('Đã nhân bản giao dịch', { icon: 'copy' });
      onSelect(copy.id);
    }
  };

  const deleteTx = async () => {
    if (!await nav.confirmDelete('giao dịch')) return;
    if (await fin.deleteTransaction(tx.id)) onClose();
  };

  if (isEditing) {
    return (
      <div className="fin-drawer-overlay">
        <div className="fin-drawer-backdrop" onClick={cancelEdit} aria-hidden="true" />
        <div className="fin-slide-drawer" role="dialog" aria-modal="true" aria-label="Sửa giao dịch">
          <div className="fin-slide-drawer__head">
            <div className="fin-detail__head-title">
              <AppIcon name="pencil" size={17} />
              <strong>Sửa giao dịch</strong>
            </div>
            <button className="fin-detail__close" onClick={cancelEdit} aria-label="Đóng chỉnh sửa"><AppIcon name="x" size={15} /></button>
          </div>

          <div className="fin-slide-drawer__body">
            <div className="fin-edit-grid">
              <div className="fin-edit-field fin-edit-field--full">
                <label className="fin-label">Tiêu đề</label>
                <input className="fin-input" aria-label="Tiêu đề giao dịch" value={note} onChange={event => setNote(event.target.value)} maxLength={200} placeholder="Ví dụ: Xăng xe, Cơm trưa, Siêu thị..." />
              </div>

              <div className="fin-edit-field">
                <label className="fin-label">Số tiền</label>
                <div className="fin-input-money">
                  <input className="fin-input" aria-label="Số tiền" inputMode="numeric" pattern="[0-9]*" value={groupDigits(amount)} onChange={event => setAmount(sanitizeDigits(event.target.value))} />
                  <span>₫</span>
                </div>
              </div>

              <div className="fin-edit-field">
                <label className="fin-label">Ngày</label>
                <DateField value={occurredAt} onChange={setOccurredAt} />
              </div>

              {tx.type !== 'saving' && (
                <div className="fin-edit-field">
                  <label className="fin-label">{tx.type === 'income' ? 'Nguồn thu' : 'Nhóm'}</label>
                  <select className="fin-input" aria-label="Nhóm" value={categoryId} onChange={event => { setCategoryId(event.target.value); setSubcategoryId(''); }}>
                    {categoryOptions.filter(group => !group.hidden).map(group => <option key={group.key} value={group.key}>{group.label}</option>)}
                  </select>
                </div>
              )}

              {tx.type === 'expense' && (
                <div className="fin-edit-field">
                  <label className="fin-label">Danh mục con</label>
                  <select className="fin-input" aria-label="Danh mục con" value={subcategoryId} onChange={event => setSubcategoryId(event.target.value)}>
                    <option value="">— chưa chọn —</option>
                    {subOptions.map(sub => <option key={sub.key} value={sub.key}>{sub.label}</option>)}
                  </select>
                </div>
              )}

              {tx.type === 'expense' && (
                <div className="fin-edit-field">
                  <label className="fin-label">Nguồn tiền</label>
                  <div className="fin-source-picker" role="group" aria-label="Nguồn tiền">
                    <button
                      type="button"
                      className={!sourceCardId ? 'is-active' : ''}
                      onClick={() => setSourceCardId('')}
                    >
                      <AppIcon name="wallet" size={14} />
                      <span>Tiền có sẵn</span>
                    </button>
                    {fin.cards.map(card => (
                      <button
                        key={card.id}
                        type="button"
                        className={sourceCardId === card.id ? 'is-active' : ''}
                        onClick={() => setSourceCardId(card.id)}
                      >
                        <AppIcon name="creditCard" size={14} />
                        <span>{card.name}{card.last4 ? ` ••${card.last4}` : ''}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tx.type === 'expense' && !tx.excluded && (
                <div className="fin-edit-field">
                  <label className="fin-label">Mức cắt được</label>
                  <div className="fin-necessity-toggle" role="group" aria-label="Mức cắt được">
                    {Object.entries(NECESSITY_META).map(([key, value]) => (
                      <button
                        key={key}
                        type="button"
                        className={`fin-necessity-toggle__btn${necessity === key ? ' is-active' : ''}`}
                        style={{ '--need-color': value.color }}
                        onClick={() => setNecessity(key)}
                      >
                        <span className="fin-necessity-toggle__dot" style={{ backgroundColor: value.color }} />
                        <span>{value.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {linkedBill && (
                <div className="fin-edit-field fin-edit-field--full">
                  <label className="fin-label">Thuộc kỳ của {linkedBill.name}</label>
                  <select className="fin-input" aria-label={`Kỳ của ${linkedBill.name}`} value={billPeriod} onChange={event => setBillPeriod(event.target.value)}>
                    {periodChoices.map(key => <option key={key} value={key}>{key.slice(5)}/{key.slice(0, 4)}</option>)}
                  </select>
                  <small className="fin-field__hint">Kỳ tách khỏi ngày trả: trả kỳ tháng 7 vào tháng 8 thì kỳ vẫn là 07.</small>
                </div>
              )}

              <div className="fin-edit-field fin-edit-field--full">
                <label className="fin-label">Nhiệm vụ liên quan</label>
                <TaskPicker tasks={tasks} value={tx.task_id} onPick={id => fin.updateTransaction(tx.id, { task_id: id })} />
              </div>
            </div>

            <div className="fin-edit-section">
              <div className="fin-edit-section__title">
                <AppIcon name="receipt" size={15} />
                <span>Chi tiết bổ sung & món hàng</span>
              </div>

              <div className="fin-edit-field">
                <label className="fin-label">Nơi / người nhận</label>
                <input className="fin-input" aria-label="Nơi / người nhận" value={merchant} onChange={event => setMerchant(event.target.value)} placeholder="Quán nước Bà Ba, Shopee, Cửa hàng xăng dầu..." />
              </div>

              <div className="fin-edit-field">
                <label className="fin-label">Ghi chú (Note tự do)</label>
                <textarea className="fin-input fin-textarea" aria-label="Ghi chú tự do" value={description} onChange={event => setDescription(event.target.value)} placeholder="Ghi chú tự do (nhiều dòng, lưu ý chi tiết...)" rows={3} />
              </div>

              <div className="fin-items-editor">
                <div className="fin-items-editor__head">
                  <AppIcon name="listBullets" size={16} />
                  <strong>Chi tiết từng món</strong>
                  <small>tổng tự cộng lên số tiền</small>
                </div>
                {draftItems.length > 0 && (
                  <div className="fin-items-editor__col-labels">
                    <span>Tên món / dịch vụ</span>
                    <span>SL</span>
                    <span>Đơn giá</span>
                    <span></span>
                  </div>
                )}
                {draftItems.map((item, index) => (
                  <div className="fin-item-row" key={index}>
                    <input className="fin-input" aria-label={`Tên món thứ ${index + 1}`} value={item.name} onChange={event => updateDraftItem(index, 'name', event.target.value)} placeholder="Tên món (bảo dưỡng, dầu nhớt...)" />
                    <input className="fin-input fin-item-qty" inputMode="numeric" pattern="[0-9]*" value={item.qty} onChange={event => updateDraftItem(index, 'qty', event.target.value)} aria-label="Số lượng" placeholder="1" />
                    <div className="fin-item-price-wrap">
                      <input className="fin-input" inputMode="numeric" pattern="[0-9.]*" aria-label="Đơn giá" value={groupDigits(item.price)} onChange={event => updateDraftItem(index, 'price', event.target.value)} placeholder="0" />
                      <span>₫</span>
                    </div>
                    <button type="button" className="fin-item-del-btn" aria-label="Xóa món" onClick={() => setDraftItems(current => current.filter((_, itemIndex) => itemIndex !== index))}><AppIcon name="x" size={14} /></button>
                  </div>
                ))}
                <button type="button" className="fin-inline-command" onClick={() => setDraftItems(current => [...current, { name: '', qty: '1', price: '' }])}><AppIcon name="plus" size={14} /> Thêm món</button>
              </div>
            </div>
          </div>

          <div className="fin-slide-drawer__foot">
            <button className="fin-btn fin-btn--secondary" onClick={cancelEdit}>Hủy (Esc)</button>
            <button className="fin-btn fin-btn--primary" onClick={save}><AppIcon name="save" size={15} /> Lưu thay đổi (Ctrl+Enter)</button>
          </div>
        </div>
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
      {tx.description && (
        <div className="fin-detail__desc">
          <strong>Ghi chú</strong>
          <p>{tx.description}</p>
        </div>
      )}
      {(tx.items || []).length > 0 && <div className="fin-detail__items"><strong>Chi tiết {tx.items.length} món</strong>{tx.items.map((item, index) => <div key={`${item.name}-${index}`}><span>{item.qty > 1 ? `${item.qty} × ` : ''}{item.name}</span><b>{money((item.qty || 1) * (item.price || 0))}</b></div>)}</div>}
      {tx.task_id && <div className="fin-detail__linked"><AppIcon name="pushPin" size={14} /> Đã gắn với một nhiệm vụ</div>}
      <div className="fin-detail__actions fin-detail__actions--view">
        <button className="fin-btn fin-btn--secondary" onClick={() => onEditingChange(true)}><AppIcon name="pencil" size={15} /> Sửa</button>
        {tx.type !== 'saving' && <button className="fin-btn fin-btn--secondary" onClick={duplicate}><AppIcon name="copy" size={15} /> Nhân bản</button>}
        <button className="fin-btn fin-btn--secondary fin-detail__delete" aria-label="Xóa giao dịch" onClick={deleteTx}><AppIcon name="trash" size={15} /></button>
      </div>
    </div>
  );
}
