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
import '../../styles/finance-list.css';

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
  const [quickFilter, setQuickFilter] = useState('all'); // 'all' | 'today' | 'yesterday' | '7d'
  const [selectedDay, setSelectedDay] = useState(null);
  const [expandedClusters, setExpandedClusters] = useState(() => new Set());
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

  // Quick filter helpers
  const yesterday = useMemo(() => {
    return toDateStr(new Date(new Date(`${fin.today}T00:00:00`).getTime() - 86400000));
  }, [fin.today]);

  const sevenDaysAgo = useMemo(() => {
    return toDateStr(new Date(new Date(`${fin.today}T00:00:00`).getTime() - 6 * 86400000));
  }, [fin.today]);

  const filtered = useMemo(() => inPeriod.filter(tx => {
    // Quick time filter
    if (quickFilter === 'today' && tx.occurred_at !== fin.today) return false;
    if (quickFilter === 'yesterday' && tx.occurred_at !== yesterday) return false;
    if (quickFilter === '7d' && (tx.occurred_at < sevenDaysAgo || tx.occurred_at > fin.today)) return false;

    // Single day click filter from sparkline
    if (selectedDay && tx.occurred_at !== selectedDay) return false;

    // Search query
    if (q) {
      const haystack = [tx.note, tx.description, tx.merchant, catInfo(tx.category_id, fin.cats).label,
        subLabel(tx.subcategory_id, fin.cats)].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q.toLowerCase())) return false;
    }

    // FilterPop conditions
    if (flt.cat && tx.category_id !== flt.cat) return false;
    if (flt.sub && tx.subcategory_id !== flt.sub) return false;
    if (flt.from && tx.occurred_at < flt.from) return false;
    if (flt.to && tx.occurred_at > flt.to) return false;

    return true;
  }), [inPeriod, quickFilter, selectedDay, q, flt, fin.cats, fin.today, yesterday, sevenDaysAgo]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);
  const selected = fin.transactions.find(tx => tx.id === selId) || null;

  const hasFilter = Boolean(q || quickFilter !== 'all' || selectedDay || flt.cat || flt.sub || flt.from || flt.to);
  const clearFilters = () => {
    setQ('');
    setQuickFilter('all');
    setSelectedDay(null);
    setFlt(EMPTY_FILTER);
  };

  const shownTotal = useMemo(() => filtered
    .filter(tx => tx.type === 'expense' && !tx.excluded)
    .reduce((sum, tx) => sum + tx.amount, 0), [filtered]);

  // Days list for period daily sparkline
  const dayList = useMemo(() => {
    if (!period?.from || !period?.to) return [];
    const list = [];
    let cur = new Date(`${period.from}T00:00:00`);
    const end = new Date(`${period.to}T00:00:00`);
    while (cur <= end) {
      list.push(toDateStr(cur));
      cur = new Date(cur.getTime() + 86400000);
    }
    return list;
  }, [period.from, period.to]);

  const dailyTotals = useMemo(() => {
    const map = {};
    for (const tx of inPeriod) {
      if (tx.type === 'expense' && !tx.excluded) {
        map[tx.occurred_at] = (map[tx.occurred_at] || 0) + tx.amount;
      }
    }
    return map;
  }, [inPeriod]);

  const maxDailyExpense = useMemo(() => {
    const values = Object.values(dailyTotals);
    return values.length ? Math.max(1, ...values) : 1;
  }, [dailyTotals]);

  // Active days count & avg
  const activeDays = useMemo(() => {
    const set = new Set();
    for (const tx of filtered) {
      if (tx.type === 'expense' && !tx.excluded) set.add(tx.occurred_at);
    }
    return set.size;
  }, [filtered]);

  const avgPerDay = useMemo(() => {
    return Math.round(shownTotal / (activeDays || 1));
  }, [shownTotal, activeDays]);


  // Notable Insight card (ĐÁNG CHÚ Ý)
  const insight = useMemo(() => {
    if (!inPeriod.length || shownTotal === 0) {
      return { text: 'Chưa có biến động chi tiêu nổi bật trong kỳ này.' };
    }
    let maxDay = '';
    let maxDayAmt = 0;
    for (const [d, amt] of Object.entries(dailyTotals)) {
      if (amt > maxDayAmt) {
        maxDayAmt = amt;
        maxDay = d;
      }
    }
    if (!maxDayAmt) {
      return { text: 'Các khoản chi tiêu kỳ này đều ở mức ổn định.' };
    }
    const pct = Math.round((maxDayAmt / shownTotal) * 100);
    const dayStr = maxDay.slice(8) + '/' + maxDay.slice(5, 7);
    const txsOnMaxDay = inPeriod.filter(t => t.occurred_at === maxDay && t.type === 'expense' && !t.excluded);
    const topCatId = txsOnMaxDay[0]?.category_id;
    const catName = topCatId ? catInfo(topCatId, fin.cats).label : 'Chi tiêu';
    return {
      text: `${catName} ngày ${dayStr} cộng lại ${money(maxDayAmt)} — bằng ${pct}% cả kỳ.`,
    };
  }, [inPeriod, shownTotal, dailyTotals, fin.cats]);

  const exportCsv = () => {
    if (!filtered.length) return;
    const headers = ['Ngày', 'Loại', 'Số tiền', 'Nhóm', 'Danh mục con', 'Mức cần thiết', 'Nguồn tiền', 'Tiêu đề', 'Ghi chú', 'Nơi / người nhận'];
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

  const toggleCluster = (txId, e) => {
    e.stopPropagation();
    setExpandedClusters(prev => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId);
      else next.add(txId);
      return next;
    });
  };

  return (
    <div className="fin-nhipchi">
      {/* 1. Header: Title, CSV, Add button */}
      <div className="fin-nhipchi__header">
        <div className="fin-nhipchi__header-title-wrap">
          <span className="fin-nhipchi__header-title">Giao dịch</span>
          <span className="fin-nhipchi__header-sub">
            {filtered.length} khoản chi · {period.label}
          </span>
        </div>
        <div className="fin-nhipchi__header-actions">
          <button type="button" className="fin-canvas-btn fin-canvas-btn--outline" onClick={exportCsv} disabled={!filtered.length}>
            <AppIcon name="upload" size={14} /> Xuất CSV
          </button>
          <button type="button" className="fin-canvas-btn fin-canvas-btn--primary" onClick={() => nav.go('add')}>
            <AppIcon name="plus" size={14} /> Ghi một khoản
          </button>
        </div>
      </div>

      {/* 2. Exactly 1-Row Filter Bar (Like Image 2) */}
      <div className="fin-nhipchi__bar">
        {/* Month Navigator */}
        <div className="fin-nhipchi__period-wrap">
          <PeriodPicker
            options={nav.periodOptions}
            period={nav.period}
            value={nav.periodKey}
            onChange={nav.setPeriodKey}
            dataFrom={nav.dataFrom}
            compact
          />
        </div>

        <span className="fin-nhipchi__sep" aria-hidden="true" />

        {/* Filter Popover Button */}
        <FilterPop cats={fin.cats} value={flt} onChange={setFlt} />

        {/* Quick Time Tabs */}
        <div className="fin-nhipchi__quicktabs" role="group" aria-label="Lọc thời gian nhanh">
          <button
            type="button"
            className={`fin-nhipchi__quicktab${quickFilter === 'all' && !selectedDay ? ' is-active' : ''}`}
            onClick={() => { setQuickFilter('all'); setSelectedDay(null); }}
          >
            Tất cả
          </button>
          <button
            type="button"
            className={`fin-nhipchi__quicktab${quickFilter === 'today' ? ' is-active' : ''}`}
            onClick={() => { setQuickFilter('today'); setSelectedDay(null); }}
          >
            Hôm nay
          </button>
          <button
            type="button"
            className={`fin-nhipchi__quicktab${quickFilter === 'yesterday' ? ' is-active' : ''}`}
            onClick={() => { setQuickFilter('yesterday'); setSelectedDay(null); }}
          >
            Hôm qua
          </button>
          <button
            type="button"
            className={`fin-nhipchi__quicktab${quickFilter === '7d' ? ' is-active' : ''}`}
            onClick={() => { setQuickFilter('7d'); setSelectedDay(null); }}
          >
            7 ngày
          </button>
        </div>

        {/* Compact Search Input */}
        <div className="fin-nhipchi__search">
          <AppIcon name="magnifyingGlass" size={14} />
          <input
            type="text"
            placeholder="Tìm khoản chi…"
            value={q}
            onChange={e => setQ(e.target.value)}
            aria-label="Tìm kiếm khoản chi"
          />
          {q && (
            <button type="button" className="fin-nhipchi__search-clear" onClick={() => setQ('')} aria-label="Xóa tìm kiếm">
              <AppIcon name="x" size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 3. Daily Sparkline Bar Chart & 4 Stat Cards */}
      <div className="fin-nhipchi__spark-section">
        <div className="fin-nhipchi__bars" role="region" aria-label="Biểu đồ chi tiêu theo ngày">
          {dayList.map(d => {
            const amt = dailyTotals[d] || 0;
            const hPct = amt > 0 ? Math.max(8, Math.round((amt / maxDailyExpense) * 100)) : 3;
            const isToday = d === fin.today;
            const isSelDay = selectedDay === d;
            const dayNum = d.slice(8);
            const showLbl = dayNum === '01' || dayNum === '05' || dayNum === '10' || dayNum === '15' || dayNum === '20' || dayNum === '25' || dayNum === '30' || d === period.to;

            let bgColor = '#E8E5DF';
            if (isSelDay) bgColor = '#6C5CE7';
            else if (isToday) bgColor = '#1C1917';
            else if (amt > 0) bgColor = '#D6D0C7';

            return (
              <div
                key={d}
                className="fin-nhipchi__bar-col"
                onClick={() => setSelectedDay(prev => prev === d ? null : d)}
                title={`${formatDate(d)}: ${money(amt)}`}
              >
                <span
                  className="fin-nhipchi__bar-fill"
                  style={{
                    height: `${hPct}%`,
                    backgroundColor: bgColor,
                  }}
                />
                <span className="fin-nhipchi__bar-lbl" style={{ color: isToday ? '#1C1917' : isSelDay ? '#6C5CE7' : undefined, fontWeight: (isToday || isSelDay) ? 600 : 400 }}>
                  {showLbl ? dayNum : ''}
                </span>
              </div>
            );
          })}
        </div>

        {/* 4 Stat Cards */}
        <div className="fin-nhipchi__stat-cards">
          {/* Card 1 */}
          <div className="fin-nhipchi__stat-card">
            <span className="fin-nhipchi__stat-label">ĐÃ CHI KỲ NÀY</span>
            <div className="fin-nhipchi__stat-val">{money(shownTotal)}</div>
            <span className="fin-nhipchi__stat-sub">
              {filtered.filter(tx => tx.type === 'expense' && !tx.excluded).length} khoản trong {activeDays} ngày
            </span>
          </div>

          {/* Card 2 */}
          <div className="fin-nhipchi__stat-card">
            <span className="fin-nhipchi__stat-label">BÌNH QUÂN MỖI NGÀY</span>
            <div className="fin-nhipchi__stat-val">{money(avgPerDay)}</div>
            <span className="fin-nhipchi__stat-sub">tính trên {activeDays} ngày có chi</span>
          </div>


          {/* Card 4 (Dark Notable Insight) */}
          <div className="fin-nhipchi__stat-card fin-nhipchi__stat-card--dark">
            <span className="fin-nhipchi__stat-label">ĐÁNG CHÚ Ý</span>
            <div className="fin-nhipchi__stat-insight">{insight.text}</div>
          </div>
        </div>
      </div>

      {/* 4. Main Body: Left Transactions List & Right 352px Detail Pane */}
      <div className="fin-nhipchi__body">
        {/* Left Transactions List */}
        <div className="fin-nhipchi__left">
          {!fin.hasLoaded && groups.length === 0 && <SkeletonList rows={5} gap="6px" label="Đang tải giao dịch" />}

          {fin.hasLoaded && groups.length === 0 && (
            <section className="fin-nhipchi__empty">
              <span className="fin-nhipchi__empty-icon"><AppIcon name="receipt" size={26} /></span>
              <strong>{hasFilter ? 'Không tìm thấy giao dịch phù hợp' : 'Chưa có giao dịch trong kỳ này'}</strong>
              <p>{hasFilter ? 'Thử đổi bộ lọc hoặc từ khóa tìm kiếm.' : 'Ghi khoản đầu tiên để bắt đầu theo dõi tháng này.'}</p>
              {hasFilter
                ? <button type="button" className="fin-canvas-btn fin-canvas-btn--outline" onClick={clearFilters}>Xóa bộ lọc</button>
                : <button type="button" className="fin-canvas-btn fin-canvas-btn--primary" onClick={() => nav.go('add')}><AppIcon name="plus" size={14} /> Thêm giao dịch</button>}
            </section>
          )}

          {groups.map(({ date, items }) => {
            const groupTotal = items
              .filter(tx => tx.type === 'expense' && !tx.excluded)
              .reduce((sum, tx) => sum + tx.amount, 0);

            return (
              <section key={date} className="fin-nhipchi__day-group">
                <div className="fin-nhipchi__day-header">
                  <span className="fin-nhipchi__day-title">{dayLabel(date, fin.today)}</span>
                  <span className="fin-nhipchi__day-sep" />
                  <span className="fin-nhipchi__day-total">{money(groupTotal)}</span>
                </div>

                <div className="fin-nhipchi__tx-card">
                  {items.map(tx => {
                    const info = catInfo(tx.category_id, fin.cats);
                    const isAutomated = Boolean(tx.bill_id || tx.loan_id || tx.card_id);
                    const isCluster = Array.isArray(tx.items) && tx.items.length > 0;
                    const isExpanded = expandedClusters.has(tx.id);
                    const source = tx.source_card_id ? (fin.cards.find(card => card.id === tx.source_card_id)?.name || 'Thẻ') : 'Tiền có sẵn';
                    const sign = tx.type === 'income' ? '+' : tx.type === 'saving' ? '' : '-';

                    return (
                      <div key={tx.id}>
                        <div
                          className={`fin-nhipchi__row${selected?.id === tx.id ? ' is-selected' : ''}`}
                          onClick={() => { setSelId(tx.id); setIsEditing(false); }}
                        >
                          {/* Color stripe */}
                          <span className="fin-nhipchi__stripe" style={{ backgroundColor: info.color || '#A8A29E' }} />

                          {/* Info */}
                          <div className="fin-nhipchi__row-content">
                            <div className="fin-nhipchi__row-title-line">
                              <span className="fin-nhipchi__row-title">
                                {tx.note || subLabel(tx.subcategory_id, fin.cats) || info.label}
                              </span>
                              {isAutomated && <span className="fin-nhipchi__badge">ĐỊNH KỲ</span>}
                              {isCluster && (
                                <span className="fin-nhipchi__badge fin-nhipchi__badge--cluster" onClick={e => toggleCluster(tx.id, e)}>
                                  GOM CỤM {tx.items.length}
                                </span>
                              )}
                              {tx.excluded && <span className="fin-nhipchi__badge">ngoài tổng</span>}
                            </div>
                            <div className="fin-nhipchi__row-sub">
                              {info.label}
                              {subLabel(tx.subcategory_id, fin.cats) ? ` · ${subLabel(tx.subcategory_id, fin.cats)}` : ''}
                              ` · ${tx.merchant || source}`
                            </div>
                          </div>

                          {/* Hover quick action buttons */}
                          <div className="fin-nhipchi__row-actions" onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              className="fin-nhipchi__row-act-btn"
                              onClick={() => { setSelId(tx.id); setIsEditing(true); }}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="fin-nhipchi__row-act-btn"
                              onClick={() => { setSelId(tx.id); setIsEditing(false); }}
                            >
                              Chi tiết
                            </button>
                          </div>

                          {/* Amount */}
                          <span className={`fin-nhipchi__row-amount fin-nhipchi__row-amount--${tx.type}`}>
                            {sign}{money(tx.amount)}
                          </span>

                          {/* Chevron / Cluster toggle */}
                          {isCluster ? (
                            <span className="fin-nhipchi__caret" onClick={e => toggleCluster(tx.id, e)} title="Mở rộng chi tiết gom cụm">
                              <AppIcon name={isExpanded ? 'caretDown' : 'caretRight'} size={12} />
                            </span>
                          ) : (
                            <span className="fin-nhipchi__caret">›</span>
                          )}
                        </div>

                        {/* Expanded Cluster Items */}
                        {isCluster && isExpanded && (
                          <div className="fin-nhipchi__cluster-kids">
                            {tx.items.map((item, idx) => (
                              <div key={idx} className="fin-nhipchi__cluster-kid">
                                <span className="fin-nhipchi__cluster-kid-name">{item.name || 'Mục chưa đặt tên'}</span>
                                <span className="fin-nhipchi__cluster-kid-qty">
                                  {item.qty > 1 ? `${item.qty} × ` : ''}{item.price ? money(item.price) : ''}
                                </span>
                                <span className="fin-nhipchi__cluster-kid-val">
                                  {money((Math.max(1, Number(item.qty) || 1)) * (parseCurrencyInput(item.price, { autoK: false }) || 0))}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* Right 352px Desktop Detail Pane */}
        {selected && !isEditing && (
          <aside className="fin-nhipchi__right">
            <TxDetail
              key={selected.id}
              tx={selected}
              fin={fin}
              nav={nav}
              tasks={pendingTasks}
              inPeriod={inPeriod}
              onClose={() => { setSelId(null); setIsEditing(false); }}
              onSelect={id => { setSelId(id); setIsEditing(false); }}
              isEditing={false}
              onEditingChange={setIsEditing}
              onFilterCat={catKey => setFlt(prev => ({ ...prev, cat: prev.cat === catKey ? '' : catKey }))}
            />
          </aside>
        )}
      </div>

      {/* Edit Drawer (shown on both Desktop & Mobile when isEditing is true) */}
      {selected && isEditing && (
        <TxDetail
          key={`edit-${selected.id}`}
          tx={selected}
          fin={fin}
          nav={nav}
          tasks={pendingTasks}
          inPeriod={inPeriod}
          onClose={() => { setSelId(null); setIsEditing(false); }}
          onSelect={id => { setSelId(id); setIsEditing(false); }}
          isEditing={true}
          onEditingChange={setIsEditing}
          onFilterCat={catKey => setFlt(prev => ({ ...prev, cat: prev.cat === catKey ? '' : catKey }))}
        />
      )}

      {/* Mobile Bottom Sheet (shown when item selected on mobile screens and not editing) */}
      {selected && !isEditing && (
        <div className="fin-nhipchi-sheet-overlay" onClick={() => { setSelId(null); setIsEditing(false); }}>
          <div
            className="fin-nhipchi-sheet"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Chi tiết giao dịch"
          >
            <span className="fin-nhipchi-sheet__handle" />
            <TxDetail
              key={selected.id}
              tx={selected}
              fin={fin}
              nav={nav}
              tasks={pendingTasks}
              inPeriod={inPeriod}
              isMobileSheet
              onClose={() => { setSelId(null); setIsEditing(false); }}
              onSelect={id => { setSelId(id); setIsEditing(false); }}
              isEditing={false}
              onEditingChange={setIsEditing}
              onFilterCat={catKey => {
                setFlt(prev => ({ ...prev, cat: prev.cat === catKey ? '' : catKey }));
                setSelId(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * FilterPop Component
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
      <button
        type="button"
        className={`fin-filterpop__btn${count ? ' is-active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={`Bộ lọc chi tiết, có ${count} điều kiện đang bật`}
      >
        <AppIcon name="funnel" size={14} />
        <span>Lọc</span>
        {count > 0 && <span className="fin-filterpop__badge">{count}</span>}
      </button>

      {open && (
        <div className="fin-filterpop__panel" role="dialog" aria-label="Bộ lọc giao dịch">
          <div>
            <label className="fin-label">Nhóm chi</label>
            <select
              className="fin-input"
              value={value.cat}
              onChange={event => patch({ cat: event.target.value, sub: '' })}
              aria-label="Lọc theo nhóm chi"
            >
              <option value="">Tất cả các nhóm chi</option>
              {cats.expenseGroups.filter(group => !group.hidden).map(group => (
                <option key={group.key} value={group.key}>{group.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="fin-label">Danh mục con</label>
            <select
              className="fin-input"
              disabled={!value.cat || !subs.length}
              value={value.sub}
              onChange={event => patch({ sub: event.target.value })}
              aria-label="Lọc theo danh mục con"
            >
              <option value="">
                {!value.cat
                  ? '— Chọn nhóm trước —'
                  : subs.length ? 'Tất cả danh mục con' : 'Nhóm này không có danh mục con'}
              </option>
              {subs.map(sub => <option key={sub.key} value={sub.key}>{sub.label}</option>)}
            </select>
          </div>

          <div className="fin-filterpop__dates">
            <div>
              <label className="fin-label">Từ ngày</label>
              <DateField
                value={value.from}
                ariaLabel="Lọc từ ngày, dạng ngày/tháng/năm"
                onChange={iso => patch({ from: iso, ...(value.to && iso > value.to ? { to: '' } : {}) })}
              />
            </div>
            <div>
              <label className="fin-label">Đến ngày</label>
              <DateField
                value={value.to}
                ariaLabel="Lọc đến ngày, dạng ngày/tháng/năm"
                onChange={iso => patch({ to: iso, ...(value.from && iso < value.from ? { from: '' } : {}) })}
              />
            </div>
          </div>
          <small className="fin-field__hint">Khoảng ngày lọc trong kỳ đang xem ở trên, không thay kỳ đó.</small>

          <div className="fin-filterpop__foot">
            <button
              type="button"
              className="fin-btn fin-btn--secondary fin-btn--sm"
              disabled={!count}
              onClick={() => onChange(EMPTY_FILTER)}
            >
              Xóa lọc
            </button>
            <button
              type="button"
              className="fin-btn fin-btn--primary fin-btn--sm"
              onClick={() => setOpen(false)}
            >
              Xong
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * TxDetail Component (Desktop & Mobile Sheet & Edit Drawer)
 */
function TxDetail({ tx, fin, nav, tasks, inPeriod = [], isMobileSheet = false, onClose, onSelect, isEditing, onEditingChange, onFilterCat }) {
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

  // 6-Month Historical Sparkline for this category
  const sixMonthsHistory = useMemo(() => {
    const curMonthKey = nav.periodKey && /^\d{4}-\d{2}$/.test(nav.periodKey) ? nav.periodKey : fin.today.slice(0, 7);
    const parts = curMonthKey.split('-').map(Number);
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(parts[0], parts[1] - 1 - i, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `T${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ mStr, label });
    }
    const cat = tx.category_id;
    const hist = months.map(({ mStr, label }) => {
      const sum = fin.transactions
        .filter(t => t.type === 'expense' && !t.excluded && t.category_id === cat && t.occurred_at.startsWith(mStr))
        .reduce((s, t) => s + t.amount, 0);
      return { mStr, label, sum };
    });
    const max = Math.max(1, ...hist.map(h => h.sum));
    return hist.map(h => ({
      ...h,
      percent: h.sum > 0 ? Math.max(10, Math.round((h.sum / max) * 100)) : 4,
    }));
  }, [tx.category_id, fin.transactions, nav.periodKey, fin.today]);

  const trendText = useMemo(() => {
    if (sixMonthsHistory.length < 2) return '';
    const cur = sixMonthsHistory[sixMonthsHistory.length - 1]?.sum || 0;
    const prev = sixMonthsHistory[sixMonthsHistory.length - 2]?.sum || 0;
    if (!prev && !cur) return 'ổn định';
    if (!prev) return 'mới phát sinh';
    const diff = Math.round(((cur - prev) / prev) * 100);
    if (diff === 0) return 'ổn định';
    return `${diff > 0 ? '+' : ''}${diff}% so với ${sixMonthsHistory[sixMonthsHistory.length - 2].label}`;
  }, [sixMonthsHistory]);

  // Top categories in current period
  const topCategories = useMemo(() => {
    const map = {};
    for (const t of inPeriod) {
      if (t.type === 'expense' && !t.excluded) {
        const cat = t.category_id || 'other';
        map[cat] = (map[cat] || 0) + t.amount;
      }
    }
    const totalExp = Object.values(map).reduce((s, a) => s + a, 0) || 1;
    return Object.entries(map)
      .map(([catId, amt]) => {
        const cat = catInfo(catId, fin.cats);
        const pct = Math.round((amt / totalExp) * 100);
        return { catId, label: cat.label, color: cat.color, amount: amt, pct };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [inPeriod, fin.cats]);

  const updateDraftItem = (index, key, value) => {
    const normalized = key === 'qty' ? sanitizeDigits(value, 3)
      : key === 'price' ? sanitizeDigits(value) : value;
    const next = draftItems.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: normalized } : item);
    setDraftItems(next);
    const total = next.reduce((sum, item) => sum
      + (Math.max(1, Number(item.qty) || 1) * (parseCurrencyInput(item.price, { autoK: false }) || 0)), 0);
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
      .filter(item => item.name?.trim() || parseCurrencyInput(item.price, { autoK: false }))
      .map(item => ({
        name: item.name?.trim() || 'Mục chưa đặt tên',
        qty: Math.max(1, Number(item.qty) || 1),
        price: parseCurrencyInput(item.price, { autoK: false }) || 0,
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
                        <span>{card.name}{card.last4 ? ` ···${card.last4}` : ''}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tx.type === 'expense' && !tx.excluded && (
                <div className="fin-edit-field">
                  <label className="fin-label">Mức cần thiết</label>
                  <div className="fin-necessity-toggle" role="group" aria-label="Mức cần thiết">
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
            <button className="fin-btn fin-btn--primary" onClick={save}><AppIcon name="floppyDisk" size={15} /> Lưu thay đổi (Ctrl+Enter)</button>
          </div>
        </div>
      </div>
    );
  }

  const meta = [
    ['Ngày', formatDate(tx.occurred_at)],
    ['Nơi', tx.merchant || '—'],
    ['Loại', typeLabel],
    ['Mức cần thiết', NECESSITY_META[tx.necessity]?.label || '—'],
    ['Tính chất', tx.is_fixed ? 'Cố định' : 'Biến đổi'],
    ['Trả bằng', source],
    ['Nguồn tạo', tx.bill_id ? 'Hóa đơn định kỳ' : tx.loan_id ? 'Khoản vay' : tx.card_id ? 'Sao kê thẻ' : tx.shortcut_id ? 'Shortcut' : 'Nhập tay'],
  ];
  const linkedPeriod = tx.bill_period || tx.income_period || tx.loan_period || tx.card_period;
  if (linkedPeriod) meta.push(['Thuộc kỳ', `${linkedPeriod.slice(5)}/${linkedPeriod.slice(0, 4)}`]);

  return (
    <>
      <div className="fin-nhipchi__detail-card">
        {/* Head */}
        <div className="fin-nhipchi__detail-head">
          <div className="fin-nhipchi__detail-top">
            <span className="fin-nhipchi__detail-title-sm">CHI TIẾT KHOẢN CHI</span>
            <button className="fin-nhipchi__detail-close" onClick={onClose} aria-label="Đóng chi tiết">
              <AppIcon name="x" size={15} />
            </button>
          </div>

          <div className="fin-nhipchi__detail-banner">
            <span className="fin-nhipchi__detail-banner-stripe" style={{ backgroundColor: info.color }} />
            <div style={{ minWidth: 0 }}>
              <div className="fin-nhipchi__detail-main-name">
                {tx.note || subLabel(tx.subcategory_id, fin.cats) || info.label}
              </div>
              <div className="fin-nhipchi__detail-sub-name">
                {info.label}{subLabel(tx.subcategory_id, fin.cats) ? ` · ${subLabel(tx.subcategory_id, fin.cats)}` : ''}
              </div>
            </div>
          </div>

          <div className={`fin-nhipchi__detail-big-amount${tx.type === 'income' ? ' fin-nhipchi__detail-big-amount--income' : ''}`}>
            {tx.type === 'income' ? '+' : tx.type === 'saving' ? '' : '-'}{money(tx.amount)}
          </div>

          <div className="fin-nhipchi__detail-actions">
            <button className="fin-nhipchi__detail-btn-edit" onClick={() => onEditingChange(true)}>
              <AppIcon name="pencil" size={14} /> Sửa khoản này
            </button>
            {tx.type !== 'saving' && (
              <button className="fin-nhipchi__detail-btn-icon" onClick={duplicate} title="Nhân bản">
                <AppIcon name="copy" size={15} />
              </button>
            )}
            <button className="fin-nhipchi__detail-btn-icon fin-nhipchi__detail-btn-icon--del" onClick={deleteTx} title="Xóa giao dịch">
              <AppIcon name="trash" size={15} />
            </button>
          </div>
        </div>

        {/* Fields list */}
        <div className="fin-nhipchi__detail-fields">
          {meta.map(([key, value]) => (
            <div className="fin-nhipchi__field-row" key={key}>
              <span className="fin-nhipchi__field-k">{key}</span>
              <span className="fin-nhipchi__field-v">{value}</span>
            </div>
          ))}
          {tx.description && (
            <div className="fin-nhipchi__field-row">
              <span className="fin-nhipchi__field-k">Ghi chú</span>
              <span className="fin-nhipchi__field-v">{tx.description}</span>
            </div>
          )}
        </div>

        {/* 6-Month Trend Sparkline */}
        <div className="fin-nhipchi__detail-trend">
          <div className="fin-nhipchi__trend-top">
            <span className="fin-nhipchi__detail-title-sm">KHOẢN NÀY 6 THÁNG QUA</span>
            <span style={{ fontSize: '12px', color: '#8A857D' }}>{trendText}</span>
          </div>
          <div className="fin-nhipchi__trend-bars">
            {sixMonthsHistory.map(h => (
              <div key={h.mStr} className="fin-nhipchi__trend-col" title={`${h.label}: ${money(h.sum)}`}>
                <span
                  className="fin-nhipchi__trend-fill"
                  style={{
                    height: `${h.percent}%`,
                    backgroundColor: h.mStr === (nav.periodKey || fin.today.slice(0, 7)) ? info.color : '#E8E5DF',
                  }}
                />
                <span className="fin-nhipchi__trend-lbl">{h.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category Breakdown Card (only in desktop sidebar) */}
      {!isMobileSheet && topCategories.length > 0 && (
        <div className="fin-nhipchi__cats-card">
          <div className="fin-nhipchi__cats-header">
            <span className="fin-nhipchi__cats-title">Nhóm chi kỳ này</span>
            <span className="fin-nhipchi__cats-sub">{topCategories.length} nhóm</span>
          </div>

          <div className="fin-nhipchi__cats-list">
            {topCategories.map(c => (
              <div
                key={c.catId}
                className="fin-nhipchi__cat-item"
                onClick={() => onFilterCat(c.catId)}
                title={`Bấm để lọc theo ${c.label}`}
              >
                <div className="fin-nhipchi__cat-item-top">
                  <span className="fin-nhipchi__cat-dot" style={{ backgroundColor: c.color }} />
                  <span className="fin-nhipchi__cat-name">{c.label}</span>
                  <span className="fin-nhipchi__cat-pct">{c.pct}%</span>
                  <span className="fin-nhipchi__cat-amt">{money(c.amount)}</span>
                </div>
                <div className="fin-nhipchi__cat-bar">
                  <div
                    className="fin-nhipchi__cat-bar-fill"
                    style={{ width: `${c.pct}%`, backgroundColor: c.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
