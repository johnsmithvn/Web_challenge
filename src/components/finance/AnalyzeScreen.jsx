import { useState, useMemo } from 'react';
import { parseCurrencyInput } from '../../utils/currencyUtils';
import {
  periodTotals, budgetBreakdown, currentMonthPeriod, suggestedDailySpend,
  monthStart, monthEnd, parseYmd, fundBalance, maturityWarn,
} from '../../utils/financeLogic';
import { money, catInfo, NECESSITY_META, CATS, Segmented } from './parts';

function lastNMonths(refStr, n) {
  const ref = parseYmd(refStr);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const y = d.getFullYear(), m = d.getMonth();
    out.push({ key: `${y}-${String(m + 1).padStart(2, '0')}`, label: `T${m + 1}`,
      from: monthStart(y, m), to: monthEnd(y, m) });
  }
  return out;
}

function Ring({ pct, color = '#9184d9' }) {
  const r = 34, c = 2 * Math.PI * r, p = Math.min(100, pct || 0);
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" className="fin-ring">
      <circle cx="42" cy="42" r={r} fill="none" stroke="#3f424d" strokeWidth="7" />
      <circle cx="42" cy="42" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} transform="rotate(-90 42 42)" />
      <text x="42" y="47" textAnchor="middle" fill="#e9e9ed" fontSize="16">{pct == null ? '—' : `${pct}%`}</text>
    </svg>
  );
}

export default function AnalyzeScreen({ fin, nav }) {
  return (
    <div className="fin-analyze">
      <Segmented options={[{ value: 'budget', label: 'Ngân sách' }, { value: 'stats', label: 'Thống kê' }]}
        value={nav.analyzeTab} onChange={nav.setAnalyzeTab} />
      {nav.analyzeTab === 'budget' ? <BudgetTab fin={fin} /> : <StatsTab fin={fin} nav={nav} />}
    </div>
  );
}

// ── Tab Ngân sách (ghim tháng đang chạy) ─────────────────────────────────────
function BudgetTab({ fin }) {
  const cur = currentMonthPeriod(fin.today);
  const totals = useMemo(() => periodTotals(fin.transactions, cur), [fin.transactions, cur]);
  const bb = useMemo(() => budgetBreakdown(totals, fin.budgets, CATS), [totals, fin.budgets]);
  const daily = suggestedDailySpend(bb.totalLimit, bb.totalSpent, fin.today, cur.to);
  const fund = fundBalance(fin.deposits);

  return (
    <div className="fin-budget">
      <p className="fin-note">Ngân sách luôn tính cho <strong>tháng đang chạy</strong> ({cur.label}) — là công cụ điều khiển, không phải báo cáo.</p>

      <div className="fin-budget__total">
        <Ring pct={bb.pct} />
        <div className="fin-budget__total-info">
          <div className="fin-budget__spent">{money(bb.totalSpent)} <span>/ {money(bb.totalLimit)}</span></div>
          <div className="fin-budget__hint">Còn {money(Math.max(0, bb.remaining))} · nên tiêu {money(daily.perDay)}/ngày ({daily.daysLeft} ngày còn lại)</div>
        </div>
      </div>

      {/* 3 mức 50/30/20 */}
      <div className="fin-card">
        <div className="fin-card__title">Ba mức 50/30/20 (trên hạn mức, không trên thu nhập)</div>
        {['must', 'need', 'want'].map(k => {
          const lv = bb.levels[k];
          const pct = lv.limit ? Math.round((lv.spent / lv.limit) * 100) : null;
          return (
            <div key={k} className="fin-level">
              <div className="fin-level__head">
                <span className="fin-legend__dot" style={{ background: NECESSITY_META[k].color }} />
                {NECESSITY_META[k].label}
                <span className="fin-level__nums">{money(lv.spent)} / {money(lv.limit)}</span>
              </div>
              <div className="fin-level__bar"><div style={{ width: `${Math.min(100, pct || 0)}%`, background: NECESSITY_META[k].color }} /></div>
            </div>
          );
        })}
      </div>

      {/* Hạn mức từng nhóm (sửa được) */}
      <div className="fin-card">
        <div className="fin-card__title">Hạn mức từng nhóm</div>
        {bb.categories.map(c => (
          <BudgetRow key={c.categoryId} cat={c} onSave={(v) => fin.upsertBudget(c.categoryId, v)} />
        ))}
      </div>

      {/* Quỹ + nơi gửi */}
      <div className="fin-card">
        <div className="fin-card__title">Quỹ tiết kiệm · {money(fund.total)} · lãi bình quân {fund.weightedRate}%/năm</div>
        {fin.goals.length === 0 && <div className="fin-empty">Chưa có quỹ</div>}
        {fin.goals.map(g => {
          const gd = fin.deposits.filter(d => d.fund_id === g.id);
          const gb = fundBalance(gd);
          return (
            <div key={g.id} className="fin-fund">
              <div className="fin-fund__head">
                <span>{g.name}</span>
                <span className="fin-fund__lock">{g.lock_mode === 'soft' ? 'mềm' : g.lock_mode === 'term' ? 'kỳ hạn' : 'ngoài app'}</span>
                <strong>{money(gb.total)}{g.goal ? ` / ${money(g.goal)}` : ''}</strong>
              </div>
              {gd.map(d => {
                const mw = maturityWarn(d.matures_at, fin.today);
                return (
                  <div key={d.id} className="fin-deposit">
                    <span>{d.name} · {d.bank || ''}{d.account_no ? ` · ${d.account_no}` : ''}</span>
                    <span>{money(d.amount)} · {d.rate}%/năm</span>
                    {mw && <span className={mw.warn ? 'fin-due-soon' : ''}>đáo hạn {d.matures_at} ({mw.days} ngày)</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BudgetRow({ cat, onSave }) {
  const [v, setV] = useState(cat.limit ? String(cat.limit) : '');
  const pct = cat.pct;
  return (
    <div className="fin-budgetrow">
      <span className="fin-budgetrow__lbl">{cat.icon} {cat.label}</span>
      <div className="fin-budgetrow__bar"><div style={{ width: `${Math.min(100, pct || 0)}%`, background: cat.color }} /></div>
      <span className="fin-budgetrow__spent">{money(cat.spent)}</span>
      <input className="fin-input fin-input--sm" placeholder="hạn mức" value={v}
        onChange={e => setV(e.target.value)}
        onBlur={() => onSave(parseCurrencyInput(v) || 0)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onSave(parseCurrencyInput(v) || 0); e.target.blur(); } }} />
    </div>
  );
}

// ── Tab Thống kê ──────────────────────────────────────────────────────────────
function StatsTab({ fin, nav }) {
  const [range, setRange] = useState(6);
  const [mode, setMode] = useState('category');
  const [group, setGroup] = useState(nav.analyzeParams.group || 'food');
  const [billId, setBillId] = useState('');
  const months = useMemo(() => lastNMonths(fin.today, range), [fin.today, range]);

  const monthTotals = useMemo(
    () => months.map(m => ({ m, t: periodTotals(fin.transactions, m) })),
    [months, fin.transactions]);

  const maxMonth = Math.max(1, ...monthTotals.map(x => x.t.total));

  return (
    <div className="fin-stats">
      <div className="fin-stats__controls">
        <Segmented options={[{ value: 3, label: '3 tháng' }, { value: 6, label: '6 tháng' }, { value: 12, label: '12 tháng' }]}
          value={range} onChange={setRange} />
        <Segmented options={[
          { value: 'category', label: 'Theo danh mục' }, { value: 'compare', label: 'So sánh' },
          { value: 'bill', label: 'Theo hóa đơn' }, { value: 'card', label: 'Theo thẻ' }]}
          value={mode} onChange={setMode} />
      </div>

      {mode === 'category' && (
        <div className="fin-card">
          <select className="fin-input" value={group} onChange={e => setGroup(e.target.value)}>
            {CATS.expenseGroups.map(g => <option key={g.key} value={g.key}>{g.icon} {g.label}</option>)}
          </select>
          <MonthBars data={monthTotals.map(x => ({ label: x.m.label, amount: x.t.byCategory[group] || 0 }))}
            color={catInfo(group).color} />
          <div className="fin-substats">
            {(CATS.expenseGroups.find(g => g.key === group)?.subs || []).map(s => {
              const sum = fin.transactions.filter(t => t.subcategory_id === s.key && t.type === 'expense' && !t.excluded
                && t.occurred_at >= months[0].from && t.occurred_at <= months[months.length - 1].to)
                .reduce((a, t) => a + t.amount, 0);
              return <div key={s.key} className="fin-substats__row"><span>{s.label}</span><strong>{money(sum)}</strong></div>;
            })}
          </div>
        </div>
      )}

      {mode === 'compare' && (
        <div className="fin-card">
          <div className="fin-comparechart">
            {monthTotals.map(x => (
              <div key={x.m.key} className="fin-comparecol">
                <div className="fin-comparecol__stack">
                  {CATS.expenseGroups.map(g => {
                    const amt = x.t.byCategory[g.key] || 0;
                    if (!amt) return null;
                    return <div key={g.key} title={`${g.label}: ${money(amt)}`}
                      style={{ height: `${(amt / maxMonth) * 140}px`, background: g.color }} />;
                  })}
                </div>
                <span className="fin-comparecol__lbl">{x.m.label}</span>
              </div>
            ))}
          </div>
          <div className="fin-legend fin-legend--wrap">
            {CATS.expenseGroups.map(g => (
              <span key={g.key} className="fin-legend__row"><span className="fin-legend__dot" style={{ background: g.color }} />{g.icon} {g.label}</span>
            ))}
          </div>
        </div>
      )}

      {mode === 'bill' && (
        <div className="fin-card">
          <select className="fin-input" value={billId} onChange={e => setBillId(e.target.value)}>
            <option value="">— chọn hóa đơn —</option>
            {fin.bills.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          {billId && <MonthBars color="#48b3a2"
            data={months.map(m => ({ label: m.label,
              amount: fin.transactions.filter(t => t.bill_id === billId && t.occurred_at >= m.from && t.occurred_at <= m.to)
                .reduce((a, t) => a + t.amount, 0) }))} />}
        </div>
      )}

      {mode === 'card' && (
        <div className="fin-card">
          <div className="fin-cardstats">
            {[{ id: '', name: '💵 Tiền mặt' }, ...fin.cards.map(c => ({ id: c.id, name: `💳 ${c.name}` }))].map(src => {
              const sum = fin.transactions.filter(t => t.type === 'expense' && !t.excluded
                && (src.id ? t.source_card_id === src.id : !t.source_card_id)
                && t.occurred_at >= months[0].from && t.occurred_at <= months[months.length - 1].to)
                .reduce((a, t) => a + t.amount, 0);
              return <div key={src.id || 'cash'} className="fin-substats__row"><span>{src.name}</span><strong>{money(sum)}</strong></div>;
            })}
          </div>
          <p className="fin-note">Chi qua thẻ nhiều hơn tiền mặt thường là dấu hiệu đang dùng thẻ để hoãn trả — kiểm tra float ở tab Thẻ.</p>
        </div>
      )}
    </div>
  );
}

function MonthBars({ data, color }) {
  const max = Math.max(1, ...data.map(d => d.amount));
  return (
    <div className="fin-monthbars">
      {data.map(d => (
        <div key={d.label} className="fin-monthbars__col" title={money(d.amount)}>
          <div className="fin-monthbars__bar" style={{ height: `${(d.amount / max) * 130}px`, background: color }} />
          <span className="fin-monthbars__lbl">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
