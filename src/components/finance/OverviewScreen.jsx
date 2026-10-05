import { useMemo } from 'react';
import {
  periodTotals, comparePeriods, spendingRhythm, cardStatementSummary, fundBalance,
  parseYmd, monthStart, monthEnd, daysInclusive,
} from '../../utils/financeLogic';
import {
  money, RhythmBars,
} from './parts';
import AppIcon from '../AppIcon';
import AnalyzeScreen from './AnalyzeScreen';
import '../../styles/skeleton.css';   // dùng .sk-* trực tiếp, không qua SkeletonList

/**
 * Khung chờ của Tổng quan. Ba màn list đã có `SkeletonList`, nhưng Tổng quan là
 * tiles + biểu đồ nên dùng nó vào đây sẽ ra hình sai chỗ. Thay vào đó mượn đúng
 * lưới thật (`fin-metrics`, `fin-overview-grid`) và thay chữ bằng `.sk-line`, nên
 * lúc số về không có cú giật nào.
 *
 * Trước đây màn này không chờ gì cả: vào là thấy **0đ · 0 khoản** rồi số mới nhảy
 * vào — đọc như "tháng này chưa chi đồng nào", đúng thông tin sai nhất có thể.
 */
function OverviewSkeleton() {
  return (
    <div className="fin-overview-dashboard">
      <div className="fin-metrics">
        {[1, 2, 3, 4].map(key => (
          <div className="fin-metric sk-metric" key={key}>
            <span className="sk-line sk-line--title" style={{ '--w': '38%' }} />
            <span className="sk-line sk-line--lg" style={{ '--w': '60%' }} />
            <span className="sk-line" style={{ '--w': '48%' }} />
          </div>
        ))}
      </div>
      <div className="fin-overview-grid">
        <section className="fin-card sk-card">
          <span className="sk-line sk-line--title" style={{ '--w': '32%' }} />
          <span className="sk-block" />
        </section>
        <section className="fin-card sk-card">
          <span className="sk-line sk-line--title" style={{ '--w': '26%' }} />
          <span className="sk-block" />
        </section>
      </div>
    </div>
  );
}

/**
 * Tổng quan + Báo cáo gộp một trang: Báo cáo giữ bộ chọn kỳ (Tháng/Quý/Năm) và
 * vẽ phần Tổng quan (`OverviewDashboard`) ngay phía trên nội dung của nó.
 */
export default function OverviewScreen({ fin, nav }) {
  return (
    <div className="fin-overview-hub">
      <div className="fin-overview-view">
        {/* Một cửa duy nhất: cả Tổng quan lẫn Báo cáo đều đọc transactions,
            cũng sẽ hiện 0đ nếu vẽ trước khi dữ liệu về. */}
        {!fin.hasLoaded
          ? <OverviewSkeleton />
          : <AnalyzeScreen fin={fin} nav={nav}
            lead={(period, slots) => <OverviewDashboard fin={fin} nav={nav} period={period} slots={slots} />} />}
      </div>
    </div>
  );
}

// Kỳ liền trước của `period` (để so sánh): tháng → tháng trước, quý → quý trước, năm → năm trước.
function previousRange(period) {
  const f = parseYmd(period.from);
  const y = f.getFullYear(), m = f.getMonth();
  if (period.mode === 'year') return { from: monthStart(y - 1, 0), to: monthEnd(y - 1, 11) };
  if (period.mode === 'quarter') return { from: monthStart(y, m - 3), to: monthEnd(y, m - 1) };
  return { from: monthStart(y, m - 1), to: monthEnd(y, m - 1) };
}

// `slots` = { hero, sparks, rank, cards } do Báo cáo dựng sẵn (state thẻ/xếp hạng nằm bên đó);
// ở đây chỉ quyết định thứ tự: Tổng chi → cảnh báo → 4 chỉ số → Sparkline → Nhịp chi | Xếp hạng → Quỹ.
function OverviewDashboard({ fin, nav, period, slots }) {
  const { transactions, cards, deposits, goals, lendings, today } = fin;

  const totals = useMemo(
    () => periodTotals(transactions, period),
    [transactions, period],
  );
  // Kỳ liền trước nằm ngoài cửa sổ đã fetch thì KHÔNG so sánh: state chỉ có giao
  // dịch gắn quy tắc của kỳ đó, "giảm 80% so với kỳ trước" sẽ là con số bịa.
  const prevRange = useMemo(() => {
    const range = previousRange(period);
    return nav.dataFrom && range.from < nav.dataFrom ? null : range;
  }, [period, nav.dataFrom]);
  const cmp = useMemo(
    () => (prevRange ? comparePeriods(transactions, transactions, period, prevRange, today) : null),
    [transactions, period, prevRange, today]);
  const rhythm = useMemo(
    () => spendingRhythm(transactions, { from: period.from, to: period.to, unit: period.unit }),
    [transactions, period]);

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

  const fund = useMemo(() => fundBalance(deposits), [deposits]);

  const fixedPct = totals.total ? Math.round((totals.fixed / totals.total) * 100) : 0;
  const effectiveDays = today >= period.from && today <= period.to
    ? daysInclusive(period.from, today) : totals.days;
  const avgPerDay = effectiveDays ? Math.round(totals.total / effectiveDays) : 0;
  const cardAlertRows = cardAlerts.map(({ card, cyc }) => ({
    card, cyc, balance: cyc.outstanding,
  }));
  return (
    <div className="fin-overview">
      {slots.hero}

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

      {/* 4 chỉ số */}
      {slots.cards.metrics && <div className="fin-metrics">
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
      </div>}

      {slots.sparks}

      <div className="fin-overview-grid">
        <section className="fin-card fin-overview-panel">
          <div className="fin-card__head"><div className="fin-card__title">Nhịp chi {period.unit === 'month' ? 'theo tháng' : 'theo ngày'}</div><small>đường mờ là mức trung bình của kỳ này</small></div>
          <RhythmBars rows={rhythm.rows} avg={rhythm.avg} unit={period.unit} />
        </section>

        {slots.rank}
      </div>

      <button className="fin-card fin-card--btn fin-fund-summary" onClick={() => nav.go('recurring', { recurringSeg: 'saving' })}>
        <span className="fin-fund-summary__icon"><AppIcon name="piggyBank" size={19} weight="duotone" /></span>
        <span><strong>Quỹ tiết kiệm</strong><small>{goals.length} quỹ · lãi bình quân {fund.weightedRate}%/năm</small></span>
        <b>{money(fund.total)}</b><AppIcon name="caretRight" size={14} />
      </button>
    </div>
  );
}
