import { useMemo } from 'react';
import {
  periodTotals, comparePeriods, cardStatementSummary, fundBalance,
  parseYmd, monthStart, monthEnd, daysInclusive,
} from '../../utils/financeLogic';
import {
  money,
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
          : <AnalyzeScreen
              fin={fin}
              nav={nav}
              lead={(period, slots) => <OverviewDashboard fin={fin} nav={nav} period={period} slots={slots} />}
              footer={<OverviewFundSummary fin={fin} nav={nav} />}
            />}
      </div>
    </div>
  );
}

function OverviewFundSummary({ fin, nav }) {
  const { deposits, goals } = fin;
  const fund = useMemo(() => fundBalance(deposits), [deposits]);
  return (
    <button
      type="button"
      className="fin-card fin-card--btn fin-fund-summary"
      onClick={() => nav.go('recurring', { recurringSeg: 'saving' })}
    >
      <span className="fin-fund-summary__icon"><AppIcon name="piggyBank" size={19} weight="duotone" /></span>
      <span><strong>Quỹ tiết kiệm</strong><small>{goals.length} quỹ · lãi bình quân {fund.weightedRate}%/năm</small></span>
      <b>{money(fund.total)}</b><AppIcon name="caretRight" size={14} />
    </button>
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

// `slots` = { hero, sparks, rank, merchants, cards } do Báo cáo dựng sẵn (state thẻ/xếp hạng nằm bên đó);
// ở đây chỉ quyết định thứ tự: Tổng chi → cảnh báo → 4 chỉ số → Sparkline → Nhịp chi | Xếp hạng → Quỹ.
function OverviewDashboard({ fin, nav, period, slots }) {
  const { transactions, cards, lendings, today } = fin;

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

  // Cảnh báo thẻ tới hạn (≤5 ngày hoặc quá hạn).
  const cardAlerts = useMemo(() => cards
    .map(c => ({ card: c, cyc: cardStatementSummary(c, transactions, today) }))
    .filter(x => x.cyc.outstanding > 0
      && (x.cyc.overdue || (x.cyc.daysUntilDue >= 0 && x.cyc.daysUntilDue <= 5))),
  [cards, transactions, today]);

  // Cho vay tới hẹn (≤5 ngày hoặc quá hẹn) — chưa thu đủ mới nhắc.
  const lendAlerts = useMemo(() => (lendings || [])
    .filter(l => !l.closed_at && l.due_on)
    .map(l => {
      const got = transactions.filter(t => t.lending_id === l.id).reduce((sum, t) => sum + t.amount, 0);
      return { lend: l, left: Math.max(0, l.principal - got), got, days: daysInclusive(today, l.due_on) - 1 };
    })
    .filter(x => x.left > 0 && x.days <= 5),
  [lendings, transactions, today]);

  const fixedPct = totals.total ? Math.round((totals.fixed / totals.total) * 100) : 0;
  const cardAlertRows = cardAlerts.map(({ card, cyc, balance }) => ({
    card, cyc, balance: cyc?.outstanding ?? balance,
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

      {slots.sparks}

      <div className="fin-overview-grid fin-overview-grid--3cols">
        {slots.cards.metrics && (
          <div className="fin-metrics-pair">
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
              <div className="fin-metric__label">Phần cố định</div>
              <div className="fin-metric__value">{fixedPct}%</div>
              <div className="fin-metric__hint">{money(totals.fixed)} hóa đơn + đăng ký + lãi</div>
            </div>
          </div>
        )}

        {slots.rank}

        {slots.merchants}
      </div>

      <CumulativeRhythmChart
        transactions={transactions}
        period={period}
        prevPeriod={prevRange}
        today={today}
      />
    </div>
  );
}

function compactVND(val) {
  const n = Math.abs(Number(val) || 0);
  if (n >= 1_000_000) {
    const tr = (n / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
    return `${tr}tr`;
  }
  if (n >= 1_000) {
    return `${Math.round(n / 1_000)}k`;
  }
  return money(n);
}

function computeCumulativeRhythm(transactions, period, prevPeriod, today) {
  const fromDate = parseYmd(period.from);
  const totalDays = daysInclusive(period.from, period.to);

  const curTxs = transactions.filter(t => t.type === 'expense' && !t.excluded
    && t.occurred_at >= period.from && t.occurred_at <= period.to);
  const prevTxs = prevPeriod ? transactions.filter(t => t.type === 'expense' && !t.excluded
    && t.occurred_at >= prevPeriod.from && t.occurred_at <= prevPeriod.to) : [];

  const curDaySums = {};
  for (const t of curTxs) {
    curDaySums[t.occurred_at] = (curDaySums[t.occurred_at] || 0) + t.amount;
  }

  const prevDays = prevPeriod ? daysInclusive(prevPeriod.from, prevPeriod.to) : totalDays;
  const prevFromDate = prevPeriod ? parseYmd(prevPeriod.from) : null;
  const prevDaySums = {};
  if (prevPeriod) {
    for (const t of prevTxs) {
      prevDaySums[t.occurred_at] = (prevDaySums[t.occurred_at] || 0) + t.amount;
    }
  }

  const curPoints = [];
  let curAcc = 0;
  let crossDay = null;

  // Giới hạn ngày hiển thị tới ngày hiện tại nếu đang trong kỳ đó
  const maxDayIdx = period.to <= today ? totalDays : Math.min(totalDays, daysInclusive(period.from, today));

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (i < maxDayIdx) {
      curAcc += (curDaySums[iso] || 0);
      curPoints.push({ day: i + 1, val: curAcc, iso });
    }
  }

  const prevPoints = [];
  let prevAcc = 0;
  for (let i = 0; i < prevDays; i++) {
    const d = new Date(prevFromDate.getFullYear(), prevFromDate.getMonth(), prevFromDate.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    prevAcc += (prevDaySums[iso] || 0);
    prevPoints.push({ day: i + 1, val: prevAcc, iso });
  }

  for (let i = 0; i < Math.min(curPoints.length, prevPoints.length); i++) {
    if (curPoints[i].val > prevPoints[i].val && crossDay === null) {
      crossDay = i + 1;
    }
  }

  const lastCurVal = curPoints[curPoints.length - 1]?.val || 0;
  const lastPrevVal = prevPoints[prevPoints.length - 1]?.val || 0;

  const curLabel = period.label || 'Kỳ này';
  const prevLabel = prevPeriod ? (prevPeriod.from.slice(0, 4) === period.from.slice(0, 4) ? `Tháng ${Number(prevPeriod.from.slice(5, 7))}` : prevPeriod.from.slice(0, 7)) : 'Kỳ trước';

  let subNote = '';
  if (crossDay) {
    subNote = `${curLabel.toLowerCase()} vượt ${prevLabel.toLowerCase()} từ ngày ${crossDay}`;
  } else if (lastCurVal < lastPrevVal) {
    subNote = `${curLabel.toLowerCase()} luôn thấp hơn ${prevLabel.toLowerCase()}`;
  } else {
    subNote = `Lũy kế theo ngày`;
  }

  return {
    curPoints,
    prevPoints,
    totalDays: Math.max(totalDays, prevDays),
    lastCurVal,
    lastPrevVal,
    curLabel,
    prevLabel,
    subNote,
  };
}

function makeStepPoints(points, padL, padR, padT, padB, W, H, maxVal, totalDays) {
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  return points.map(p => ({
    x: +(padL + ((p.day - 1) / Math.max(1, totalDays - 1)) * chartW).toFixed(1),
    y: +(H - padB - (p.val / maxVal) * chartH).toFixed(1),
    val: p.val,
    day: p.day,
  }));
}

function stepD(pts) {
  if (!pts.length) return '';
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x},${pts[i - 1].y} L ${pts[i].x},${pts[i].y}`;
  }
  return d;
}

function stepAreaD(pts, padB, H) {
  if (!pts.length) return '';
  const lineD = stepD(pts);
  const bottomY = H - padB;
  return `${lineD} L ${pts[pts.length - 1].x},${bottomY} L ${pts[0].x},${bottomY} Z`;
}

function CumulativeRhythmChart({ transactions, period, prevPeriod, today }) {
  const data = useMemo(() => {
    return computeCumulativeRhythm(transactions, period, prevPeriod, today);
  }, [transactions, period, prevPeriod, today]);

  const W = 720, H = 180;
  const padL = 48, padR = 65, padT = 20, padB = 25;
  const maxVal = Math.max(data.lastCurVal, data.lastPrevVal, 1_000_000);

  const curPts = makeStepPoints(data.curPoints, padL, padR, padT, padB, W, H, maxVal, data.totalDays);
  const prevPts = makeStepPoints(data.prevPoints, padL, padR, padT, padB, W, H, maxVal, data.totalDays);

  const curLine = stepD(curPts);
  const curArea = stepAreaD(curPts, padB, H);
  const prevLine = stepD(prevPts);

  const lastCur = curPts[curPts.length - 1];
  const lastPrev = prevPts[prevPts.length - 1];

  const yTicks = [
    { v: maxVal * 0.33, y: +(H - padB - (H - padT - padB) * 0.33).toFixed(1) },
    { v: maxVal * 0.66, y: +(H - padB - (H - padT - padB) * 0.66).toFixed(1) },
    { v: maxVal, y: padT },
  ];

  const xTicks = [];
  const stepDays = data.totalDays <= 31 ? 5 : 10;
  for (let d = 1; d <= data.totalDays; d += stepDays) {
    const x = +(padL + ((d - 1) / Math.max(1, data.totalDays - 1)) * (W - padL - padR)).toFixed(1);
    xTicks.push({ d, x });
  }

  return (
    <section className="fin-card fin-overview-panel">
      <div className="fin-card__head" style={{ marginBottom: '8px' }}>
        <div>
          <div className="fin-card__title">Nhịp chi trong kỳ</div>
          <small style={{ color: '#8A8A84', fontSize: '12px' }}>
            Lũy kế theo ngày · {data.subNote}
          </small>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11.5px', color: '#6A6A64' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '16px', height: '3px', background: '#6949E8', borderRadius: '2px' }} />
            <strong style={{ color: '#15161A' }}>{data.curLabel}</strong>
          </span>
          {data.prevLabel && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '16px', height: '0px', borderTop: '2px dashed #A8A8A2' }} />
              <span>{data.prevLabel}</span>
            </span>
          )}
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', minWidth: '480px' }} aria-label="Biểu đồ lũy kế nhịp chi">
          <defs>
            <linearGradient id="gRhythmArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6949E8" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#6949E8" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Đường lưới ngang */}
          <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="#EDECE7" strokeWidth="1" />
          {yTicks.map((t, idx) => (
            <g key={idx}>
              <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke="#EDECE7" strokeWidth="1" strokeDasharray="3 3" />
              <text x={padL - 8} y={t.y + 3.5} textAnchor="end" fill="#A8A8A2" fontSize="10" fontFamily="'JetBrains Mono', monospace">
                {compactVND(t.v)}
              </text>
            </g>
          ))}

          {/* Vùng fill kỳ này */}
          {curArea && <path d={curArea} fill="url(#gRhythmArea)" />}

          {/* Đường bậc thang kỳ trước */}
          {prevLine && (
            <path d={prevLine} fill="none" stroke="#A8A8A2" strokeWidth="1.8" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" />
          )}

          {/* Đường bậc thang kỳ này */}
          {curLine && (
            <path d={curLine} fill="none" stroke="#6949E8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          )}

          {/* Dot & Nhãn cuối đường kỳ trước */}
          {lastPrev && (
            <g>
              <circle cx={lastPrev.x} cy={lastPrev.y} r="3" fill="#A8A8A2" />
              <text x={lastPrev.x + 6} y={lastPrev.y + 4} fill="#8A8A84" fontSize="10.5" fontFamily="'JetBrains Mono', monospace">
                {compactVND(lastPrev.val)}
              </text>
            </g>
          )}

          {/* Dot & Nhãn cuối đường kỳ này */}
          {lastCur && (
            <g>
              <circle cx={lastCur.x} cy={lastCur.y} r="4.5" fill="#6949E8" stroke="#fff" strokeWidth="2" />
              <text x={lastCur.x + 6} y={lastCur.y - 3} fill="#6949E8" fontWeight="600" fontSize="11" fontFamily="'JetBrains Mono', monospace">
                {compactVND(lastCur.val)}
              </text>
            </g>
          )}

          {/* Nhãn trục X */}
          {xTicks.map(t => (
            <text key={t.d} x={t.x} y={H - 6} textAnchor="middle" fill="#A8A8A2" fontSize="9.5" fontFamily="'JetBrains Mono', monospace">
              {t.d}
            </text>
          ))}
        </svg>
      </div>
    </section>
  );
}
