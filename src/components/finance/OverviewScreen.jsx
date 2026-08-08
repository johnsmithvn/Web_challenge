import { useMemo } from 'react';
import {
  periodTotals, comparePeriods, spendingRhythm, cardCycle, fundBalance,
  parseYmd, monthStart, monthEnd,
} from '../../utils/financeLogic';
import {
  money, catInfo, NECESSITY_META, Donut, RhythmBars, PeriodPicker,
} from './parts';

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

export default function OverviewScreen({ fin, nav }) {
  const { transactions, cards, deposits, goals, bills, today } = fin;
  const period = nav.period;

  const totals = useMemo(() => periodTotals(transactions, period), [transactions, period]);
  const prevRange = useMemo(() => previousRange(period), [period]);
  const cmp = useMemo(
    () => (prevRange ? comparePeriods(transactions, transactions, period, prevRange, today) : null),
    [transactions, period, prevRange, today]);
  const rhythm = useMemo(
    () => spendingRhythm(transactions, { from: period.from, to: period.to, unit: period.unit }),
    [transactions, period]);

  // Cảnh báo thẻ tới hạn (≤5 ngày hoặc quá hạn).
  const cardAlerts = useMemo(() => cards.map(c => ({ card: c, cyc: cardCycle(c, today) }))
    .filter(x => x.cyc.overdue || (x.cyc.daysUntilDue >= 0 && x.cyc.daysUntilDue <= 5)), [cards, today]);

  // Donut byCategory.
  const donutData = useMemo(() => Object.entries(totals.byCategory)
    .map(([key, amount]) => ({ key, amount, color: catInfo(key).color }))
    .sort((a, b) => b.amount - a.amount), [totals]);

  const fund = useMemo(() => fundBalance(deposits), [deposits]);
  // "Cần bạn ghi": hóa đơn 'ask' đang bật (nhắc user tự nhập số).
  const askBills = bills.filter(b => b.enabled && b.amount_mode === 'ask' && !b.finished_at);

  const fixedPct = totals.total ? Math.round((totals.fixed / totals.total) * 100) : 0;
  const avgPerDay = totals.days ? Math.round(totals.total / totals.days) : 0;

  return (
    <div className="fin-overview">
      {cardAlerts.length > 0 && (
        <button className="fin-alert fin-alert--warn" onClick={() => nav.go('recurring', { recurringSeg: 'card' })}>
          💳 {cardAlerts.length} thẻ sắp tới hạn / quá hạn — bấm để xem
        </button>
      )}

      <PeriodPicker options={nav.periodOptions} value={nav.periodKey} onChange={nav.setPeriodKey} />
      <p className="fin-overview__sub">{period.label} · {totals.count} khoản đã ghi</p>

      {/* 4 chỉ số */}
      <div className="fin-metrics">
        <div className="fin-metric">
          <div className="fin-metric__label">Đã chi kỳ này</div>
          <div className="fin-metric__value">{money(totals.total)}</div>
          <div className="fin-metric__hint">{totals.count} khoản · {totals.days} ngày</div>
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
        </div>
        <div className="fin-metric">
          <div className="fin-metric__label">Phần cố định</div>
          <div className="fin-metric__value">{fixedPct}%</div>
          <div className="fin-metric__hint">{money(totals.fixed)} hóa đơn + đăng ký + lãi</div>
        </div>
      </div>

      {/* Tiền đi đâu + Bắt buộc đến đâu */}
      <div className="fin-card">
        <div className="fin-card__title">Tiền đi đâu</div>
        <div className="fin-donut-row">
          <Donut data={donutData} total={totals.total}
            onSlice={(key) => nav.go('analyze', { analyzeTab: 'stats', group: key })} />
          <div className="fin-legend">
            {donutData.length === 0 && <div className="fin-empty">Chưa có chi tiêu trong kỳ</div>}
            {donutData.map(d => {
              const info = catInfo(d.key);
              const pct = totals.total ? Math.round((d.amount / totals.total) * 100) : 0;
              return (
                <button key={d.key} className="fin-legend__row"
                  onClick={() => nav.go('analyze', { analyzeTab: 'stats', group: d.key })}>
                  <span className="fin-legend__dot" style={{ background: d.color }} />
                  <span className="fin-legend__lbl">{info.icon} {info.label}</span>
                  <span className="fin-legend__amt">{money(d.amount)}</span>
                  <span className="fin-legend__pct">{pct}%</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="fin-card__divider" />
        <div className="fin-need">
          <div className="fin-need__head">
            <span>Bắt buộc đến đâu</span>
            <span className="fin-need__cut">Có thể cắt {money(totals.byNecessity.want)}</span>
          </div>
          <div className="fin-need__bar">
            {['must', 'need', 'want'].map(k => {
              const w = totals.total ? (totals.byNecessity[k] / totals.total) * 100 : 0;
              return <div key={k} style={{ width: `${w}%`, background: NECESSITY_META[k].color }} />;
            })}
          </div>
          <div className="fin-need__rows">
            {['must', 'need', 'want'].map(k => (
              <div key={k} className="fin-need__row">
                <span className="fin-legend__dot" style={{ background: NECESSITY_META[k].color }} />
                {NECESSITY_META[k].label}
                <strong>{money(totals.byNecessity[k])}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Nhịp chi */}
      <div className="fin-card">
        <div className="fin-card__title">Nhịp chi {period.unit === 'month' ? 'theo tháng' : 'theo ngày'}</div>
        <RhythmBars rows={rhythm.rows} avg={rhythm.avg} unit={period.unit} />
      </div>

      <div className="fin-cols2">
        {/* Khoản lớn nhất */}
        <div className="fin-card">
          <div className="fin-card__title">Khoản lớn nhất kỳ này</div>
          {totals.biggest ? (
            <div className="fin-biggest">
              <span className="fin-biggest__ico">{catInfo(totals.biggest.category_id).icon}</span>
              <div>
                <div className="fin-biggest__note">{totals.biggest.note || catInfo(totals.biggest.category_id).label}</div>
                <div className="fin-biggest__date">{totals.biggest.occurred_at}</div>
              </div>
              <div className="fin-biggest__amt">{money(totals.biggest.amount)}</div>
            </div>
          ) : <div className="fin-empty">Chưa có</div>}
        </div>

        {/* Quỹ tiết kiệm tóm tắt */}
        <button className="fin-card fin-card--btn" onClick={() => nav.go('analyze', { analyzeTab: 'budget' })}>
          <div className="fin-card__title">Quỹ tiết kiệm</div>
          <div className="fin-fund-sum">
            <div className="fin-fund-sum__amt">{money(fund.total)}</div>
            <div className="fin-fund-sum__hint">{goals.length} quỹ · lãi bình quân {fund.weightedRate}%/năm</div>
          </div>
        </button>
      </div>

      {/* Cần bạn ghi (Inbox nghiệp vụ) */}
      {askBills.length > 0 && (
        <button className="fin-alert" onClick={() => nav.go('add')}>
          📝 {askBills.length} hóa đơn cần bạn ghi số tiền — sang Nhập nhanh
        </button>
      )}
    </div>
  );
}
