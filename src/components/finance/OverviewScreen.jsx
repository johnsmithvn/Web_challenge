import { useMemo } from 'react';
import {
  periodTotals, comparePeriods, spendingRhythm, cardStatementSummary, fundBalance,
  parseYmd, monthStart, monthEnd, daysInclusive,
} from '../../utils/financeLogic';
import {
  money, catInfo, NECESSITY_META, Donut, RhythmBars, PeriodPicker, Segmented, FinanceIcon,
} from './parts';
import { formatDate } from '../../utils/dateUtils';
import AppIcon from '../AppIcon';
import AnalyzeScreen from './AnalyzeScreen';

const OVERVIEW_TABS = [
  { value: 'overview', label: 'Tổng quan', icon: 'chartDonut' },
  { value: 'budget', label: 'Ngân sách', icon: 'trend' },
  { value: 'stats', label: 'Thống kê', icon: 'chartLine' },
];

export default function OverviewScreen({ fin, nav }) {
  return (
    <div className="fin-overview-hub">
      <div className="fin-overview-tabs">
        <Segmented options={OVERVIEW_TABS} value={nav.overviewTab}
          onChange={nav.setOverviewTab} ariaLabel="Chế độ Tổng quan" />
      </div>
      <div className="fin-overview-view" key={nav.overviewTab}>
        {nav.overviewTab === 'overview'
          ? <OverviewDashboard fin={fin} nav={nav} />
          : <AnalyzeScreen fin={fin} nav={nav} mode={nav.overviewTab} />}
      </div>
    </div>
  );
}

// Kỳ liền trước của `period` (để so sánh). null nếu là "Tất cả".
function previousRange(period) {
  if (period.key === 'all') return null;
  if (period.key.startsWith('year-')) {
    const y = Number(period.key.slice(5)) - 1;
    return { from: monthStart(y, 0), to: monthEnd(y, 11) };
  }
  const f = parseYmd(period.from);           // mục tháng
  const y = f.getFullYear(), m = f.getMonth();
  const pm = m === 0 ? 11 : m - 1, py = m === 0 ? y - 1 : y;
  return { from: monthStart(py, pm), to: monthEnd(py, pm) };
}

function OverviewDashboard({ fin, nav }) {
  const { transactions, cards, deposits, goals, bills, lendings, today } = fin;
  const period = nav.period;

  const totals = useMemo(
    () => periodTotals(transactions, period, { savingAsExpense: nav.savingAsExpense }),
    [transactions, period, nav.savingAsExpense],
  );
  // Kỳ liền trước nằm ngoài cửa sổ đã fetch thì KHÔNG so sánh: state chỉ có giao
  // dịch gắn quy tắc của kỳ đó, "giảm 80% so với kỳ trước" sẽ là con số bịa.
  const prevRange = useMemo(() => {
    const range = previousRange(period);
    return range && nav.dataFrom && range.from < nav.dataFrom ? null : range;
  }, [period, nav.dataFrom]);
  const cmp = useMemo(
    () => (prevRange ? comparePeriods(transactions, transactions, period, prevRange, today,
      { savingAsExpense: nav.savingAsExpense }) : null),
    [transactions, period, prevRange, today, nav.savingAsExpense]);
  const rhythm = useMemo(
    () => spendingRhythm(transactions, { from: period.from, to: period.to, unit: period.unit },
      { savingAsExpense: nav.savingAsExpense }),
    [transactions, period, nav.savingAsExpense]);

  // Cảnh báo thẻ tới hạn (≤7 ngày hoặc quá hạn).
  const cardAlerts = useMemo(() => cards
    .map(c => ({ card: c, cyc: cardStatementSummary(c, transactions, today) }))
    .filter(x => x.cyc.outstanding > 0
      && (x.cyc.overdue || (x.cyc.daysUntilDue >= 0 && x.cyc.daysUntilDue <= 7))),
  [cards, transactions, today]);

  // Cho vay tới hẹn (≤7 ngày hoặc quá hẹn) — chưa thu đủ mới nhắc.
  const lendAlerts = useMemo(() => (lendings || [])
    .filter(l => !l.closed_at && l.due_on)
    .map(l => {
      const got = transactions.filter(t => t.lending_id === l.id).reduce((sum, t) => sum + t.amount, 0);
      return { lend: l, left: Math.max(0, l.principal - got), got, days: daysInclusive(today, l.due_on) - 1 };
    })
    .filter(x => x.left > 0 && x.days <= 7),
  [lendings, transactions, today]);

  // Donut byCategory.
  const donutData = useMemo(() => Object.entries(totals.byCategory)
    .map(([key, amount]) => ({ key, amount, color: catInfo(key, fin.cats).color }))
    .sort((a, b) => b.amount - a.amount), [totals, fin.cats]);

  const fund = useMemo(() => fundBalance(deposits), [deposits]);
  // "Cần bạn ghi": hóa đơn 'ask' đang bật (nhắc user tự nhập số).
  const askBills = bills.filter(b => b.enabled && b.amount_mode === 'ask' && !b.finished_at);

  const fixedPct = totals.total ? Math.round((totals.fixed / totals.total) * 100) : 0;
  const effectiveDays = today >= period.from && today <= period.to
    ? daysInclusive(period.from, today) : totals.days;
  const avgPerDay = effectiveDays ? Math.round(totals.total / effectiveDays) : 0;
  const cardAlertRows = cardAlerts.map(({ card, cyc }) => ({
    card, cyc, balance: cyc.outstanding,
  }));
  const topTransactions = useMemo(() => transactions
    .filter(t => t.type === 'expense' && !t.excluded
      && t.occurred_at >= period.from && t.occurred_at <= period.to)
    .sort((a, b) => b.amount - a.amount).slice(0, 4), [transactions, period]);
  return (
    <div className="fin-overview">
      {cardAlertRows.map(({ card, cyc, balance }) => (
        <button key={card.id} className="fin-alert fin-alert--warn fin-alert--detail"
          onClick={() => nav.go('recurring', { recurringSeg: 'card' })}>
          <AppIcon name="creditCard" size={17} weight="fill" />
          <span><strong>Sao kê {card.name} {cyc.overdue ? `quá hạn ${Math.abs(cyc.daysUntilDue)} ngày` : `tới hạn trong ${cyc.daysUntilDue} ngày`}</strong>
            <small>Phải trả trước {cyc.due} · trả đủ để không phát sinh lãi trên toàn bộ sao kê.</small></span>
          <b>{money(balance)}</b>
          <AppIcon name="caretRight" size={14} />
        </button>
      ))}

      {lendAlerts.map(({ lend, left, got, days }) => (
        <button key={lend.id} className="fin-alert fin-alert--warn fin-alert--detail"
          onClick={() => nav.go('recurring', { recurringSeg: 'lend' })}>
          <AppIcon name="handCoins" size={17} weight="fill" />
          <span><strong>{lend.name} {days < 0 ? `quá hẹn ${Math.abs(days)} ngày` : days === 0 ? 'hẹn trả hôm nay' : `hẹn trả sau ${days} ngày`}</strong>
            <small>Cho mượn {money(lend.principal)} ngày {lend.lent_on.split('-').reverse().join('/')} · {got > 0 ? `đã thu ${money(got)}` : 'chưa thu đồng nào'}</small></span>
          <b>{money(left)}</b>
          <AppIcon name="caretRight" size={14} />
        </button>
      ))}

      <PeriodPicker options={nav.periodOptions} period={nav.period} value={nav.periodKey} onChange={nav.setPeriodKey} dataFrom={nav.dataFrom} />

      {/* 4 chỉ số */}
      <div className="fin-metrics">
        <div className="fin-metric">
          <div className="fin-metric__label">Đã chi {period.label}</div>
          <div className="fin-metric__value">{money(totals.total)}</div>
          <div className="fin-metric__hint">{totals.count} khoản · {effectiveDays} ngày</div>
        </div>
        <div className="fin-metric">
          <div className="fin-metric__label">So với kỳ trước</div>
          {cmp ? (
            <>
              <div className={`fin-metric__value ${cmp.deltaPct > 0 ? 'fin-up' : cmp.deltaPct < 0 ? 'fin-down' : ''}`}>
                {cmp.deltaPct == null ? '—' : `${cmp.deltaPct > 0 ? '+' : ''}${cmp.deltaPct}%`}
              </div>
              <div className="fin-metric__hint">{cmp.note} · {money(cmp.prevValue)}</div>
            </>
          ) : <div className="fin-metric__value">—</div>}
        </div>
        <div className="fin-metric">
          <div className="fin-metric__label">Trung bình mỗi ngày</div>
          <div className="fin-metric__value">{money(avgPerDay)}</div>
          <div className="fin-metric__hint">trên {effectiveDays} ngày của kỳ này</div>
        </div>
        <div className="fin-metric">
          <div className="fin-metric__label">Phần cố định</div>
          <div className="fin-metric__value">{fixedPct}%</div>
          <div className="fin-metric__hint">{money(totals.fixed)} hóa đơn + đăng ký + lãi</div>
        </div>
      </div>

      <div className="fin-overview-grid">
        <section className="fin-card fin-overview-panel">
          <div className="fin-card__head"><div className="fin-card__title">Tiền đi đâu</div><small>Tiền để dành nằm ngoài biểu đồ này</small></div>
          <div className="fin-donut-row">
            <Donut data={donutData} total={totals.total} size={132}
              onSlice={(key) => nav.go('overview', { overviewTab: 'stats', group: key })} />
            <div className="fin-legend">
              {donutData.length === 0 && <div className="fin-empty">Chưa có chi tiêu trong kỳ</div>}
              {donutData.map(d => {
                const info = catInfo(d.key, fin.cats);
                const pct = totals.total ? Math.round((d.amount / totals.total) * 100) : 0;
                return <button key={d.key} className="fin-legend__row"
                  onClick={() => nav.go('overview', { overviewTab: 'stats', group: d.key })}>
                  <span className="fin-legend__dot" style={{ background: d.color }} />
                  <span className="fin-legend__lbl"><FinanceIcon name={info.icon} cats={fin.cats} size={14} /> {info.label}</span>
                  <span className="fin-legend__amt">{money(d.amount)}</span>
                  <span className="fin-legend__pct">{pct}%</span><AppIcon name="caretRight" size={11} />
                </button>;
              })}
            </div>
          </div>
          <div className="fin-card__divider" />
          <div className="fin-need">
            <div className="fin-need__head"><span>Bắt buộc đến đâu</span><span className="fin-need__cut">Có thể cắt {money(totals.byNecessity.want)}</span></div>
            <div className="fin-need__bar">{['must', 'need', 'want'].map(k => {
              const w = totals.total ? (totals.byNecessity[k] / totals.total) * 100 : 0;
              return <div key={k} style={{ width: `${w}%`, background: NECESSITY_META[k].color }} />;
            })}</div>
            <div className="fin-need__rows">{['must', 'need', 'want'].map(k => {
              const share = totals.total ? Math.round(totals.byNecessity[k] / totals.total * 100) : 0;
              return <div key={k} className="fin-need__row"><span className="fin-legend__dot" style={{ background: NECESSITY_META[k].color }} />
                <span>{NECESSITY_META[k].label}</span><strong>{money(totals.byNecessity[k])}</strong><small>{share}%</small></div>;
            })}</div>
          </div>
          <div className="fin-card__divider" />
          <div className="fin-fixed-split">
            <div><span>Cố định</span><strong>{money(totals.fixed)}</strong></div>
            <div><span>Biến đổi</span><strong>{money(Math.max(0, totals.total - totals.fixed))}</strong></div>
            <div className="fin-fixed-split__bar"><i style={{ width: `${fixedPct}%` }} /><i /></div>
            <p>Cố định trả lời “đoán trước được không”; mức cần thiết trả lời “bỏ được không”.</p>
          </div>
        </section>

        <section className="fin-card fin-overview-panel">
          <div className="fin-card__head"><div className="fin-card__title">Nhịp chi {period.unit === 'month' ? 'theo tháng' : 'theo ngày'}</div><small>đường mờ là mức trung bình của kỳ này</small></div>
          <RhythmBars rows={rhythm.rows} avg={rhythm.avg} unit={period.unit} />
          <div className="fin-card__divider" />
          <div className="fin-card__eyebrow">Khoản lớn nhất kỳ này</div>
          {topTransactions.length ? <div className="fin-top-tx">{topTransactions.map(t => {
            const info = catInfo(t.category_id, fin.cats);
            return <button className="fin-biggest" key={t.id} onClick={() => nav.go('list')}>
              <span className="fin-biggest__ico" style={{ color: info.color }}><FinanceIcon name={info.icon} cats={fin.cats} size={17} /></span>
              <span><span className="fin-biggest__note">{t.note || info.label}</span><span className="fin-biggest__date">{formatDate(t.occurred_at)}</span></span>
              <strong className="fin-biggest__amt">{money(t.amount)}</strong>
            </button>;
          })}</div> : <div className="fin-empty">Chưa có khoản nào trong kỳ</div>}
        </section>
      </div>

      <button className="fin-card fin-card--btn fin-fund-summary" onClick={() => nav.go('overview', { overviewTab: 'budget' })}>
        <span className="fin-fund-summary__icon"><AppIcon name="piggyBank" size={19} weight="duotone" /></span>
        <span><strong>Quỹ tiết kiệm</strong><small>{goals.length} quỹ · lãi bình quân {fund.weightedRate}%/năm</small></span>
        <b>{money(fund.total)}</b><AppIcon name="caretRight" size={14} />
      </button>

      {/* Cần bạn ghi (Inbox nghiệp vụ) */}
      {askBills.length > 0 && (
        <button className="fin-alert" onClick={() => nav.go('add')}>
          <AppIcon name="note" size={17} /><span>{askBills.length} hóa đơn cần bạn ghi số tiền — sang Nhập nhanh</span><AppIcon name="caretRight" size={14} />
        </button>
      )}
    </div>
  );
}
