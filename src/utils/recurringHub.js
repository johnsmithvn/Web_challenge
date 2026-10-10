import {
  parseYmd, ymd, addDaysStr, monthEnd, dueDateInMonth,
  billCycle, billSettled, billAmountEstimate,
  cardStatementSummary, cardCarryOver, cardBalance,
  loanSchedule, loanCycle,
} from './financeLogic.js';

const WD_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const dmyFull = (iso) => iso.split('-').reverse().join('/');

/**
 * 1. Gom 5 nguồn thành item phẳng (bảng §2 trong RECURRING_HUB_PLAN.md).
 * Không format tiền ở đây — UI lo việc hiển thị.
 */
export function buildHubItems(fin = {}) {
  const bills = fin.bills || [];
  const cards = fin.cards || [];
  const loans = fin.loans || [];
  const goals = fin.goals || [];
  const lendings = fin.lendings || [];
  const transactions = fin.transactions || [];
  const deposits = fin.deposits || [];
  const today = fin.today || ymd(new Date());
  const monthStr = today.slice(0, 7);

  const items = [];

  // ── 1. Hóa đơn (bill) ──────────────────────────────────────────────────────
  for (const b of bills) {
    if (!b.enabled || b.finished_at) continue;
    const isSettled = billSettled(b, transactions);
    const cyc = billCycle(b, today, isSettled);
    let ev = null;

    if (cyc && (cyc.thisMonth || cyc.days < 0)) {
      const day = Number(cyc.due.slice(8));
      const due = cyc.due;
      const amount = b.amount_mode === 'ask' ? billAmountEstimate(b, transactions) : (b.amount || 0);
      const approx = b.amount_mode === 'ask';
      const paidTx = transactions.find(t => t.bill_id === b.id && t.bill_period === cyc.period);
      const isSkipped = (b.skipped_periods || []).includes(cyc.period);
      const state = paidTx ? 'paid' : (isSkipped ? 'skip' : 'due');
      const paidOn = paidTx ? `${paidTx.occurred_at.slice(8)}/${paidTx.occurred_at.slice(5, 7)}` : null;
      ev = { day, due, amount, approx, state, paidOn };
    }

    const overdue = Boolean(ev && ev.state === 'due' && ev.due < today);
    const progress = b.term_total > 0
      ? {
        pct: Math.min(100, Math.round(((b.term_done || 0) / b.term_total) * 100)),
        label: `${b.term_done || 0}/${b.term_total} kỳ`,
      }
      : null;

    items.push({
      id: b.id,
      kind: 'bill',
      name: b.name,
      sub: [b.provider, b.customer_code].filter(Boolean).join(' · ') || '',
      icon: b.icon || 'receipt',
      categoryId: b.category_id || 'housing',
      main: b.amount_mode === 'ask' ? billAmountEstimate(b, transactions) : (b.amount || 0),
      note: !ev && cyc ? `kỳ sau ${cyc.period.slice(5)}/${cyc.period.slice(0, 4)}` : '',
      source: b,
      ev,
      progress,
      overdue,
    });
  }

  // ── 2. Thẻ tín dụng (card) ────────────────────────────────────────────────
  for (const c of cards) {
    if (c.closed_at) continue;
    const cyc = cardStatementSummary(c, transactions, today);
    const carry = cardCarryOver(c, transactions, today);
    const balance = cardBalance(c.id, transactions);
    const dueTotal = cyc.outstanding + (carry?.amount || 0);

    let ev = null;
    if (dueTotal > 0) {
      const due = carry ? carry.due : cyc.due;
      ev = {
        day: Number(due.slice(8)),
        due,
        amount: dueTotal,
        approx: false,
        state: 'due',
        paidOn: null,
      };
    } else if (cyc.statementTotal > 0 && cyc.paid > 0 && cyc.outstanding === 0) {
      ev = {
        day: Number(cyc.due.slice(8)),
        due: cyc.due,
        amount: cyc.statementTotal,
        approx: false,
        state: 'paid',
        paidOn: null,
      };
    }

    const overdue = Boolean(ev && ev.state === 'due' && ev.due < today);
    const pct = c.credit_limit ? Math.min(100, Math.round((balance / c.credit_limit) * 100)) : 0;
    const progress = { pct, label: `${pct}% hạn mức` };

    items.push({
      id: c.id,
      kind: 'card',
      name: `${c.name}${c.last4 ? ` ••${c.last4}` : ''}`,
      sub: [c.bank, `chốt ngày ${c.statement_day}`].filter(Boolean).join(' · '),
      icon: 'creditCard',
      categoryId: 'finance',
      main: balance,
      note: balance > 0 ? `chốt ngày ${c.statement_day}` : 'không có dư nợ',
      source: c,
      ev,
      progress,
      overdue,
    });
  }

  // ── 3. Khoản vay (loan) ───────────────────────────────────────────────────
  for (const l of loans) {
    if (l.closed_at) continue;
    const sch = loanSchedule(l);
    const principalPaid = transactions.some(t => t.loan_id === l.id && t.loan_part === 'principal');
    // Đủ kỳ là xong với vay trả đều; vay chỉ-trả-lãi còn nợ gốc tới khi tất toán.
    if (sch.progress.done >= sch.progress.total && (sch.kind === 'amort' || principalPaid)) continue;
    const cyc = loanCycle(l, today, transactions);
    let ev = null;

    if (cyc) {
      const day = Number(cyc.due.slice(8));
      const amount = sch.kind === 'interest' ? sch.monthlyInterest : sch.monthlyPayment;
      const state = cyc.done ? 'paid' : 'due';
      ev = { day, due: cyc.due, amount, approx: false, state, paidOn: cyc.done ? '' : null };
    }

    const overdue = Boolean(ev && ev.state === 'due' && ev.due < today);
    const pct = sch.progress.total
      ? Math.min(100, Math.round((sch.progress.done / sch.progress.total) * 100))
      : 0;
    const progress = { pct, label: `kỳ ${sch.progress.done}/${sch.progress.total}` };

    items.push({
      id: l.id,
      kind: 'loan',
      name: l.name,
      sub: [l.lender, sch.kind === 'interest' ? (cyc ? 'chỉ trả lãi' : 'chờ tất toán gốc') : 'trả đều gốc + lãi'].filter(Boolean).join(' · '),
      icon: 'bank',
      categoryId: 'finance',
      main: sch.kind === 'interest' ? sch.principalDue : sch.principalRemaining,
      note: cyc ? '' : (l.due_at ? `tất toán ${dmyFull(l.due_at)}` : 'chờ tất toán gốc'),
      source: l,
      ev,
      progress,
      overdue,
    });
  }

  // ── 4. Quỹ tiết kiệm (save) ───────────────────────────────────────────────
  for (const g of goals) {
    if (g.closed_at) continue;
    let ev = null;
    if (g.auto_deposit && Number(g.auto_deposit.amount) > 0) {
      const due = dueDateInMonth(Number(g.auto_deposit.day) || 1, today);
      const day = Number(due.slice(8));
      const amount = Number(g.auto_deposit.amount);
      const tx = transactions.find(t =>
        t.saving_goal_id === g.id &&
        t.type === 'saving' &&
        t.saving_dir === 'in' &&
        t.occurred_at &&
        t.occurred_at.slice(0, 7) === monthStr
      );
      const state = tx ? 'paid' : 'due';
      const paidOn = tx ? `${tx.occurred_at.slice(8)}/${tx.occurred_at.slice(5, 7)}` : null;
      ev = { day, due, amount, approx: false, state, paidOn };
    }

    const overdue = Boolean(ev && ev.state === 'due' && ev.due < today);
    const deps = deposits.filter(d => d.fund_id === g.id && !d.closed_on);
    const bal = deps.reduce((s, d) => s + (d.amount || 0), 0);
    const pct = g.goal ? Math.min(100, Math.round((bal / g.goal) * 100)) : 0;
    const progress = { pct, label: `${pct}% mục tiêu` };

    items.push({
      id: g.id,
      kind: 'save',
      name: g.name,
      sub: g.auto_deposit?.amount ? `gửi ngày ${g.auto_deposit.day} hằng tháng` : 'gửi tay',
      icon: 'piggyBank',
      categoryId: 'saving',
      main: bal,
      note: 'gửi tay',
      source: g,
      ev,
      progress,
      overdue,
    });
  }

  // ── 5. Cho vay (lend) ─────────────────────────────────────────────────────
  for (const l of lendings) {
    if (l.closed_at) continue;
    const repayments = transactions.filter(t => t.lending_id === l.id && t.type === 'income' && t.excluded);
    const got = repayments.reduce((s, t) => s + t.amount, 0);
    const left = Math.max(0, (l.principal || 0) - got);
    if (left <= 0) continue;

    let ev = null;
    if (l.lent_on && l.lent_on.slice(0, 7) === monthStr) {
      const day = Number(l.lent_on.slice(8));
      ev = {
        day,
        due: l.lent_on,
        amount: l.principal || 0,
        approx: false,
        state: 'paid', // tiền đã ra khỏi ví trong tháng này
        paidOn: `${l.lent_on.slice(8)}/${l.lent_on.slice(5, 7)}`,
      };
    }

    const pct = l.principal ? Math.min(100, Math.round((got / l.principal) * 100)) : 0;
    const progress = { pct, label: `thu ${pct}%` };

    items.push({
      id: l.id,
      kind: 'lend',
      name: l.name,
      sub: l.due_on ? `hẹn ${l.due_on}` : (l.note || 'Cho vay'),
      icon: 'handCoins',
      categoryId: 'lend',
      main: left,
      note: l.due_on ? `hẹn ${dmyFull(l.due_on)}` : 'không hẹn ngày',
      source: l,
      ev,
      progress,
      overdue: false,
    });
  }

  return items;
}

/**
 * 2. Ranh giới tuần trong tháng. Tuần bắt đầu Thứ 2, kết thúc CN.
 * Cắt về monthEnd nếu tràn sang tháng sau.
 */
export function weekBounds(todayStr) {
  const today = parseYmd(todayStr);
  const year = today.getFullYear();
  const month0 = today.getMonth();
  const mEnd = monthEnd(year, month0);

  const jsDay = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysToSunday = jsDay === 0 ? 0 : 7 - jsDay;

  const thisSunday = addDaysStr(todayStr, daysToSunday);
  const thisWeekEnd = thisSunday > mEnd ? mEnd : thisSunday;

  const mondayNext = addDaysStr(thisSunday, 1);
  if (mondayNext > mEnd) {
    return {
      thisWeekEnd,
      nextWeekStart: null,
      nextWeekEnd: null,
      monthEnd: mEnd,
    };
  }

  const nextWeekStart = mondayNext;
  const sundayNext = addDaysStr(mondayNext, 6);
  const nextWeekEnd = sundayNext > mEnd ? mEnd : sundayNext;

  return {
    thisWeekEnd,
    nextWeekStart,
    nextWeekEnd,
    monthEnd: mEnd,
  };
}

/**
 * 3. Chia nhóm timeline:
 * [{ key: 'overdue'|'thisWeek'|'nextWeek'|'later'|'none'|'done', label, total, items }]
 */
export function groupHubItems(items = [], todayStr, kindFilter = 'all') {
  const filtered = kindFilter === 'all'
    ? items
    : items.filter(i => i.kind === kindFilter);

  const bounds = weekBounds(todayStr);

  const overdue = [];
  const thisWeek = [];
  const nextWeek = [];
  const later = [];
  const none = [];
  const done = [];

  for (const item of filtered) {
    if (!item.ev) {
      none.push(item);
      continue;
    }
    const { state, due } = item.ev;
    if (state === 'paid' || state === 'skip') {
      done.push(item);
      continue;
    }
    // state === 'due'
    if (due < todayStr) {
      overdue.push(item);
    } else if (due <= bounds.thisWeekEnd) {
      thisWeek.push(item);
    } else if (bounds.nextWeekStart && due >= bounds.nextWeekStart && due <= bounds.nextWeekEnd) {
      nextWeek.push(item);
    } else if (due <= bounds.monthEnd) {
      later.push(item);
    } else {
      none.push(item);
    }
  }

  // Sắp xếp
  const sortByDueAsc = (a, b) => (a.ev.due || '').localeCompare(b.ev.due || '');
  const sortByDueDesc = (a, b) => (b.ev.due || '').localeCompare(a.ev.due || '');
  const sortByName = (a, b) => (a.name || '').localeCompare(b.name || '');

  overdue.sort(sortByDueAsc);
  thisWeek.sort(sortByDueAsc);
  nextWeek.sort(sortByDueAsc);
  later.sort(sortByDueAsc);
  done.sort(sortByDueDesc);
  none.sort(sortByName);

  const sum = (list) => list.reduce((s, i) => s + (i.ev?.amount || 0), 0);

  const groups = [];

  if (overdue.length > 0) {
    groups.push({ key: 'overdue', label: 'QUÁ HẠN', total: sum(overdue), items: overdue });
  }
  if (thisWeek.length > 0) {
    const endParts = bounds.thisWeekEnd.split('-');
    groups.push({
      key: 'thisWeek',
      label: `TUẦN NÀY · ĐẾN CN ${endParts[2]}/${endParts[1]}`,
      total: sum(thisWeek),
      items: thisWeek,
    });
  }
  if (nextWeek.length > 0 && bounds.nextWeekStart && bounds.nextWeekEnd) {
    const sParts = bounds.nextWeekStart.split('-');
    const eParts = bounds.nextWeekEnd.split('-');
    groups.push({
      key: 'nextWeek',
      label: `TUẦN SAU · ${sParts[2]}–${eParts[2]}/${eParts[1]}`,
      total: sum(nextWeek),
      items: nextWeek,
    });
  }
  if (later.length > 0) {
    groups.push({ key: 'later', label: 'CUỐI THÁNG', total: sum(later), items: later });
  }
  if (none.length > 0) {
    groups.push({ key: 'none', label: 'KHÔNG CÓ KỲ TRONG THÁNG', total: 0, items: none });
  }
  if (done.length > 0) {
    groups.push({ key: 'done', label: 'ĐÃ XONG THÁNG NÀY', total: sum(done), items: done });
  }

  return groups;
}

/**
 * 4. Số liệu 6 ô KPI:
 * all, bill, card, loan, save, lend
 */
export function hubTotals(items = []) {
  const calcKind = (kind) => {
    const kindItems = items.filter(i => i.kind === kind);
    const evItems = kindItems.filter(i => i.ev !== null);
    const dueItems = evItems.filter(i => i.ev.state === 'due');
    const doneItems = evItems.filter(i => i.ev.state === 'paid' || i.ev.state === 'skip');
    return {
      value: dueItems.reduce((s, i) => s + (i.ev?.amount || 0), 0),
      count: kindItems.length,
      pct: evItems.length ? doneItems.length / evItems.length : 0,
      dueCount: dueItems.length,
      doneCount: doneItems.length,
    };
  };

  const evAll = items.filter(i => i.ev !== null);
  const dueAll = evAll.filter(i => i.ev.state === 'due');
  const doneAll = evAll.filter(i => i.ev.state === 'paid' || i.ev.state === 'skip');

  return {
    all: {
      value: dueAll.reduce((s, i) => s + (i.ev?.amount || 0), 0),
      sub: 'còn phải chi tháng này',
      pct: evAll.length ? doneAll.length / evAll.length : 0,
      count: items.length,
      dueCount: dueAll.length,
      doneCount: doneAll.length,
    },
    bill: {
      ...calcKind('bill'),
      sub: 'hóa đơn còn phải trả',
    },
    card: {
      ...calcKind('card'),
      sub: 'sao kê cần trả',
    },
    loan: {
      ...calcKind('loan'),
      sub: 'gốc & lãi phải trả',
    },
    save: {
      ...calcKind('save'),
      sub: 'quỹ tiết kiệm',
    },
    lend: {
      ...calcKind('lend'),
      sub: 'khoản cho vay',
    },
  };
}

/**
 * 5. Dữ liệu dải lịch tháng (1..28/29/30/31).
 */
export function calendarDays(items = [], todayStr) {
  const ref = parseYmd(todayStr);
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const monthPrefix = todayStr.slice(0, 8);
  const currentMonthKey = todayStr.slice(0, 7);

  const days = [];
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${monthPrefix}${String(d).padStart(2, '0')}`;
    const dayOfWeek = new Date(y, m, d).getDay();
    const weekday = WD_LABELS[dayOfWeek];
    const isToday = (dateStr === todayStr);
    const isPast = (dateStr < todayStr);

    const chips = [];
    for (const item of items) {
      if (item.ev && item.ev.day === d && item.ev.due && item.ev.due.slice(0, 7) === currentMonthKey) {
        chips.push({
          id: item.id,
          kind: item.kind,
          state: item.ev.state,
          name: item.name,
          amount: item.ev.amount,
        });
      }
    }

    days.push({
      day: d,
      weekday,
      isToday,
      isPast,
      chips,
    });
  }

  return days;
}
