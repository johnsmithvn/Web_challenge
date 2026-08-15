/**
 * financeLogic — logic thuần của module chi tiêu. KHÔNG React, KHÔNG Supabase,
 * KHÔNG localStorage, KHÔNG import JSON → chạy được bằng `node` để test bằng
 * node:assert (src/__tests__/financeLogic.test.js), cùng convention vaultLogic /
 * taskFields / recurrenceUtils.
 *
 * Dữ liệu danh mục (finance-categories.json) được TIÊM vào các hàm cần nó
 * (`deriveNecessity`, `budgetBreakdown`) qua tham số `cats` — không import trực
 * tiếp, để file vẫn chạy bằng node và test khỏi cần JSON.
 *
 * Ba nguyên lý (docs/DESIGN_FINANCE.md §0) mà file này ép:
 *   1. App KHÔNG tính số dư — periodTotals tách income/saving khỏi total chi, không
 *      bao giờ trừ thu vào chi hay tính "còn lại".
 *   2. Một bảng lọc theo kỳ — periodTotals là NƠI TÍNH TỔNG DUY NHẤT; mọi màn gọi nó.
 *   3. 50/30/20 tính trên hạn mức (budgets), không trên thu nhập.
 *
 * Giao dịch `excluded=true` (trả gốc vay, trả sao kê thẻ) đứng NGOÀI mọi tổng chi.
 */

export const NECESSITY_ORDER = ['must', 'need', 'want'];

/**
 * Mức cần thiết suy tự động: sub đè cat (NEED_BY_SUB đè NEED_BY_CAT). Gửi xe là
 * `must`, quán nước là `want`, dù cùng nhóm Đi lại.
 * @param cats — object finance-categories.json (tiêm vào để test khỏi import JSON).
 */
export function deriveNecessity(categoryId, subcategoryId, cats) {
  if (subcategoryId && cats) {
    for (const g of cats.expenseGroups) {
      const s = (g.subs || []).find(x => x.key === subcategoryId);
      if (s && s.necessity) return s.necessity;
    }
  }
  return (cats && cats.necessityByCat && cats.necessityByCat[categoryId]) || 'need';
}

// ── Date helpers thuần (chuỗi 'yyyy-MM-dd', so sánh chuỗi ISO là đủ) ─────────
function pad(n) { return String(n).padStart(2, '0'); }
export function ymd(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
export function parseYmd(str) {
  return new Date(`${str}T00:00:00`);  // ghép giờ để tránh lệch UTC ở GMT+7
}
export function addDaysStr(str, days) {
  const d = parseYmd(str);
  d.setDate(d.getDate() + days);
  return ymd(d);
}
/** Số ngày trong [from, to] BAO GỒM cả hai đầu. */
export function daysInclusive(from, to) {
  return Math.round((parseYmd(to) - parseYmd(from)) / 86400000) + 1;
}
export function monthStart(year, month0) { return ymd(new Date(year, month0, 1)); }
export function monthEnd(year, month0)   { return ymd(new Date(year, month0 + 1, 0)); }

/**
 * Ngày đến hạn thật của kỳ nằm trong tháng của `refStr`. Hóa đơn ngày 31 ở tháng 30
 * hoặc 28 ngày rơi về NGÀY CUỐI THÁNG, không tràn sang tháng sau.
 */
export function dueDateInMonth(dueDay, refStr) {
  if (!dueDay || !refStr) return null;
  const ref = parseYmd(refStr);
  const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  return `${refStr.slice(0, 8)}${pad(Math.min(dueDay, lastDay))}`;
}
/** Số ngày tới hạn trong tháng đang chạy: âm = quá hạn, 0 = đến hạn hôm nay. */
export function daysUntilDue(dueDay, refStr) {
  const due = dueDateInMonth(dueDay, refStr);
  return due == null ? null : daysInclusive(refStr, due) - 1;
}

const VN_MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
  'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

/**
 * 15 kỳ chuẩn để khởi tạo bộ lọc: 12 tháng gần nhất theo thứ tự mới nhất trước,
 * Cả năm nay, Cả năm trước, Tất cả. Month/year picker có thể mở kỳ xa hơn qua
 * `periodFromKey`, không bị giới hạn bởi danh sách này.
 * unit = đơn vị cột nhịp chi ('day' cho 1 tháng, 'month' cho kỳ dài).
 */
export function listPeriodOptions(refStr) {
  const ref = parseYmd(refStr);
  const y = ref.getFullYear();
  const opts = [];
  for (let offset = 0; offset < 12; offset++) {
    const d = new Date(y, ref.getMonth() - offset, 1);
    const year = d.getFullYear(), month0 = d.getMonth();
    opts.push({ key: `${year}-${pad(month0 + 1)}`, label: `${VN_MONTHS[month0]}/${year}`,
      from: monthStart(year, month0), to: monthEnd(year, month0), unit: 'day' });
  }
  opts.push({ key: `year-${y}`,     label: `Cả năm ${y}`,     from: monthStart(y, 0),     to: monthEnd(y, 11),     unit: 'month' });
  opts.push({ key: `year-${y - 1}`, label: `Cả năm ${y - 1}`, from: monthStart(y - 1, 0), to: monthEnd(y - 1, 11), unit: 'month' });
  opts.push({ key: 'all', label: 'Tất cả', from: '2000-01-01', to: refStr, unit: 'month' });
  return opts;
}

/** Đổi khóa của month/year picker thành khoảng ngày để mọi màn dùng chung. */
export function periodFromKey(key, refStr) {
  const current = currentMonthPeriod(refStr);
  if (key === 'all') return { key, label: 'Tất cả', from: '2000-01-01', to: refStr, unit: 'month' };

  const yearMatch = /^year-(\d{4})$/.exec(key || '');
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    return { key, label: `Cả năm ${year}`, from: monthStart(year, 0), to: monthEnd(year, 11), unit: 'month' };
  }

  const monthMatch = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(key || '');
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month0 = Number(monthMatch[2]) - 1;
    return { key, label: `${VN_MONTHS[month0]}/${year}`, from: monthStart(year, month0), to: monthEnd(year, month0), unit: 'day' };
  }
  return current;
}

/** Mục "tháng đang chạy" — dùng cho chip ngân sách / Hóa đơn / Ngân sách. */
export function currentMonthPeriod(refStr) {
  const ref = parseYmd(refStr);
  const y = ref.getFullYear(), m = ref.getMonth();
  return { key: `${y}-${pad(m + 1)}`, label: `${VN_MONTHS[m]}/${y}`,
    from: monthStart(y, m), to: monthEnd(y, m), unit: 'day', year: y, month0: m };
}

function inRange(str, from, to) { return str >= from && str <= to; }

/**
 * NƠI TÍNH TỔNG DUY NHẤT. Lọc `txs` theo occurred_at ∈ [from, to] rồi đếm.
 * excluded=true không vào bất kỳ tổng nào. income/saving tách riêng, KHÔNG trừ chi.
 * necessity đọc từ t.necessity (hook đã suy lúc ghi); thiếu thì rơi về 'need'.
 */
export function periodTotals(txs, { from, to }, { savingAsExpense = false } = {}) {
  const out = {
    total: 0, income: 0, savingIn: 0, savingOut: 0, fixed: 0,
    count: 0, txCount: 0, days: daysInclusive(from, to),
    byCategory: {}, byNecessity: { must: 0, need: 0, want: 0 }, biggest: null,
  };
  for (const t of txs) {
    if (!inRange(t.occurred_at, from, to)) continue;
    out.txCount++;
    if (t.type === 'income') { if (!t.excluded) out.income += t.amount; continue; }
    if (t.type === 'saving') {
      if (t.saving_dir === 'out') out.savingOut += t.amount; else out.savingIn += t.amount;
      if (savingAsExpense && t.saving_dir !== 'out' && !t.excluded) {
        out.total += t.amount;
        out.count++;
        if (t.is_fixed) out.fixed += t.amount;
        const cat = t.category_id || 'finance';
        out.byCategory[cat] = (out.byCategory[cat] || 0) + t.amount;
        out.byNecessity.must += t.amount;
        if (!out.biggest || t.amount > out.biggest.amount) out.biggest = t;
      }
      continue;
    }
    if (t.excluded) continue;                 // trả gốc / trả sao kê — ngoài tổng chi
    out.total += t.amount;
    out.count++;
    if (t.is_fixed) out.fixed += t.amount;
    const cat = t.category_id || 'other';
    out.byCategory[cat] = (out.byCategory[cat] || 0) + t.amount;
    const nec = t.necessity || 'need';
    out.byNecessity[nec] = (out.byNecessity[nec] || 0) + t.amount;
    if (!out.biggest || t.amount > out.biggest.amount) out.biggest = t;
  }
  return out;
}

/**
 * So sánh kỳ — 3 nhánh (handoff §Chi tiết cần đúng). Hai kỳ lệch độ dài thì so
 * tổng là sai.
 *   - Tháng đang chạy → so CÙNG CỬA SỔ NGÀY (kỳ trước tính tới đúng ngày hôm nay).
 *   - Hai tháng dương lịch đã trọn → so tổng.
 *   - Còn lại (năm chưa trọn) → so mức trung bình mỗi ngày.
 */
export function comparePeriods(curTxs, prevTxs, curRange, prevRange, refStr, options) {
  const cur = periodTotals(curTxs, curRange, options);
  const ref = parseYmd(refStr);
  // "Tháng đang chạy" = kỳ đúng bằng tháng dương lịch CHỨA hôm nay. Không chỉ
  // kiểm "from là đầu tháng" — kỳ cả năm cũng bắt đầu 01-01, sẽ bị nhận nhầm.
  const isRunningMonth = curRange.from === monthStart(ref.getFullYear(), ref.getMonth())
    && curRange.to === monthEnd(ref.getFullYear(), ref.getMonth());

  if (isRunningMonth) {
    const dayN = daysInclusive(curRange.from, refStr);
    let winEnd = addDaysStr(prevRange.from, dayN - 1);
    if (winEnd > prevRange.to) winEnd = prevRange.to;
    const prev = periodTotals(prevTxs, { from: prevRange.from, to: winEnd }, options);
    return { mode: 'window', dayN, unit: '₫',
      curValue: cur.total, prevValue: prev.total,
      deltaPct: pctDelta(cur.total, prev.total), note: `so cùng cửa sổ ${dayN} ngày` };
  }

  const prev = periodTotals(prevTxs, prevRange, options);
  if (isFullCalendarMonth(curRange) && isFullCalendarMonth(prevRange)) {
    return { mode: 'total', unit: '₫', curValue: cur.total, prevValue: prev.total,
      deltaPct: pctDelta(cur.total, prev.total), note: 'so tổng cả tháng' };
  }
  const curAvg = cur.total / cur.days, prevAvg = prev.total / (prev.days || 1);
  return { mode: 'avgPerDay', unit: '₫/ngày', curValue: curAvg, prevValue: prevAvg,
    deltaPct: pctDelta(curAvg, prevAvg), note: 'so mức trung bình mỗi ngày' };
}

function pctDelta(cur, prev) {
  if (!prev) return null;                     // không có mẫu số → không có % (tránh chia 0)
  return Math.round(((cur - prev) / prev) * 100);
}
function isFullCalendarMonth(range) {
  const d = parseYmd(range.from);
  return range.from === monthStart(d.getFullYear(), d.getMonth())
    && range.to === monthEnd(d.getFullYear(), d.getMonth());
}

// ── Nhập nhanh: đoán danh mục con từ ngôn ngữ tự nhiên ───────────────────────
// NL_DICT là HẰNG SỐ LOGIC (không phải content editable) — cùng chỗ với logic,
// không JSON. Match đầu tiên thắng. Số tiền do parseCurrencyInput (currencyUtils)
// lo ở tầng UI — tách ra để test khỏi đụng localStorage.
export const NL_DICT = [
  { re: /c[àa]\s?ph[êe]|coffee|trà sữa|trà/i,       cat: 'food',          sub: 'food.drinks' },
  { re: /ăn sáng|ăn trưa|ăn tối|cơm|bún|phở|bữa/i,  cat: 'food',          sub: 'food.eatout' },
  { re: /chợ|siêu thị|rau|thịt|đi chợ/i,            cat: 'food',          sub: 'food.grocery' },
  { re: /ăn vặt|snack|bánh|kẹo/i,                    cat: 'food',          sub: 'food.snack' },
  { re: /xăng|đổ xăng|dầu/i,                         cat: 'transport',     sub: 'transport.fuel' },
  { re: /gửi xe|giữ xe|bãi xe/i,                     cat: 'transport',     sub: 'transport.parking' },
  { re: /grab|taxi|xe ôm|gojek/i,                    cat: 'transport',     sub: 'transport.taxi' },
  { re: /tiền điện|hóa đơn điện|(^|\s)điện(\s|$)/i,  cat: 'housing',       sub: 'housing.electric' },
  { re: /tiền nước|hóa đơn nước|(^|\s)nước(\s|$)/i,  cat: 'housing',       sub: 'housing.water' },
  { re: /internet|wifi|mạng|fpt|viettel/i,           cat: 'housing',       sub: 'housing.internet' },
  { re: /tiền nhà|thuê nhà|thuê phòng/i,             cat: 'housing',       sub: 'housing.rent' },
  { re: /netflix|spotify|youtube|đăng ký|subscri/i,  cat: 'subscription',  sub: 'subscription.streaming' },
  { re: /thuốc|khám|bệnh viện|bác sĩ/i,              cat: 'health',        sub: 'health.medicine' },
  { re: /phim|sự kiện/i,                              cat: 'entertainment', sub: 'entertainment.events' },
  { re: /game/i,                                      cat: 'entertainment', sub: 'entertainment.game' },
  { re: /du lịch/i,                                   cat: 'entertainment', sub: 'entertainment.travel' },
  { re: /quần áo|áo|giày|mua sắm|shopee|lazada/i,    cat: 'shopping',      sub: 'shopping.clothes' },
];

/** Đoán {categoryId, subId} từ text. Trả null nếu không khớp luật nào. */
export function matchCategory(text) {
  if (!text) return null;
  for (const rule of NL_DICT) {
    if (rule.re.test(text)) return { categoryId: rule.cat, subId: rule.sub };
  }
  return null;
}

// ── Ngân sách 50/30/20 — tính trên HẠN MỨC, không trên thu nhập ─────────────
/**
 * @param totals — kết quả periodTotals của tháng đang chạy.
 * @param budgets — [{category_id, limit_amount}] hạn mức từng nhóm.
 * @param cats — finance-categories.json (tiêm vào).
 */
export function budgetBreakdown(totals, budgets, cats) {
  const byCat = {};
  for (const b of budgets) byCat[b.category_id] = b.limit_amount;
  const totalLimit = budgets.reduce((s, b) => s + b.limit_amount, 0);

  const categories = cats.expenseGroups.map(g => {
    const limit = byCat[g.key] || 0;
    const spent = totals.byCategory[g.key] || 0;
    return { categoryId: g.key, label: g.label, color: g.color, icon: g.icon,
      limit, spent, pct: limit ? Math.round((spent / limit) * 100) : null };
  });

  const levels = {
    must: { limit: Math.round(totalLimit * 0.5), spent: totals.byNecessity.must },
    need: { limit: Math.round(totalLimit * 0.3), spent: totals.byNecessity.need },
    want: { limit: totalLimit - Math.round(totalLimit * 0.5) - Math.round(totalLimit * 0.3), spent: totals.byNecessity.want },
  };

  return {
    totalLimit, totalSpent: totals.total, remaining: totalLimit - totals.total,
    pct: totalLimit ? Math.round((totals.total / totalLimit) * 100) : null,
    categories, levels, cutable: totals.byNecessity.want,
  };
}

/** "Nên tiêu mỗi ngày" cho số ngày còn lại của tháng đang chạy. */
export function suggestedDailySpend(totalLimit, spent, refStr, monthEndStr) {
  const daysLeft = daysInclusive(refStr, monthEndStr);
  const left = Math.max(0, totalLimit - spent);
  return { daysLeft, perDay: daysLeft > 0 ? Math.round(left / daysLeft) : 0 };
}

// ── Thẻ tín dụng: float & stoozing ──────────────────────────────────────────
/**
 * Ngày chốt sao kê & đến hạn của kỳ hiện tại + số ngày float. statement_day ≠
 * due_day; grace = ân hạn. Trả ngày dạng chuỗi + số ngày còn tới hạn.
 */
export function cardCycle(card, refStr) {
  const ref = parseYmd(refStr);
  const y = ref.getFullYear(), m = ref.getMonth();
  const clampDay = (yy, mm, day) => Math.min(day, new Date(yy, mm + 1, 0).getDate());
  const sDay = card.statement_day || 1;
  const dDay = card.due_day || (card.grace ? sDay + card.grace : sDay + 15);

  let stmtY = y, stmtM = m;                    // ngày chốt gần nhất ≤ hôm nay
  if (ref.getDate() < sDay) { stmtM = m - 1; if (stmtM < 0) { stmtM = 11; stmtY--; } }
  const statement = ymd(new Date(stmtY, stmtM, clampDay(stmtY, stmtM, sDay)));

  let dueY = stmtY, dueM = stmtM;              // đến hạn sau ngày chốt
  if (dDay <= sDay) { dueM = stmtM + 1; if (dueM > 11) { dueM = 0; dueY++; } }
  const due = ymd(new Date(dueY, dueM, clampDay(dueY, dueM, dDay)));

  return {
    statement, due,
    daysUntilDue: daysInclusive(refStr, due) - 1,     // 0 = đến hạn hôm nay
    floatDaysTotal: daysInclusive(statement, due) - 1,
    overdue: refStr > due,
  };
}

/**
 * Lần thu phí thường niên kế tiếp. `feeOn` là ngày thu (yyyy-MM-dd, thường là ngày
 * mở thẻ); phí lặp lại đúng ngày/tháng đó MỖI NĂM nên chỉ tháng+ngày được dùng,
 * năm luôn tính lại từ `refStr`. 29/2 rơi vào năm thường thì lùi về 28/2.
 * Trả { date, days } — days 0 = thu hôm nay, null nếu thẻ không khai ngày.
 */
export function nextAnnualFee(feeOn, refStr) {
  if (!feeOn || !refStr) return null;
  const fee = parseYmd(feeOn);
  const month = fee.getMonth(), day = fee.getDate();
  const at = (year) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return ymd(new Date(year, month, Math.min(day, lastDay)));
  };
  const year = parseYmd(refStr).getFullYear();
  let date = at(year);
  if (date < refStr) date = at(year + 1);
  return { date, days: daysInclusive(refStr, date) - 1 };
}

/** Tổng dư nợ đang theo dõi = mọi lần quẹt thẻ - mọi lần trả sao kê đã ghi. */
export function cardBalance(cardId, txs) {
  const purchases = txs
    .filter(t => t.source_card_id === cardId && t.type === 'expense' && !t.excluded)
    .reduce((sum, t) => sum + t.amount, 0);
  const payments = txs
    .filter(t => t.card_id === cardId && t.type === 'expense' && t.excluded)
    .reduce((sum, t) => sum + t.amount, 0);
  return Math.max(0, purchases - payments);
}

/**
 * Sao kê gần nhất đã chốt: (ngày chốt kỳ trước, ngày chốt kỳ này]. Khoản trả
 * mang card_period được trừ khỏi sao kê, nên trả một phần vẫn cho ra số còn lại.
 */
export function cardStatementSummary(card, txs, refStr) {
  const cycle = cardCycle(card, refStr);
  const previousStatement = cardCycle(card, addDaysStr(cycle.statement, -1)).statement;
  const period = cycle.statement.slice(0, 7);
  const statementTotal = txs
    .filter(t => t.source_card_id === card.id && t.type === 'expense' && !t.excluded
      && t.occurred_at > previousStatement && t.occurred_at <= cycle.statement)
    .reduce((sum, t) => sum + t.amount, 0);
  const paid = txs
    .filter(t => t.card_id === card.id && t.card_period === period && t.excluded)
    .reduce((sum, t) => sum + t.amount, 0);
  return {
    ...cycle,
    period,
    previousStatement,
    statementTotal,
    paid,
    outstanding: Math.max(0, statementTotal - paid),
  };
}

/** Lãi ước kiếm được từ float: giữ `balance` thêm `days` ngày ở lãi suất `blendedRate`%/năm. */
export function floatInterest(balance, days, blendedRate) {
  if (!balance || !days || !blendedRate) return 0;
  return Math.round(balance * (blendedRate / 100) * (days / 365));
}

// ── Khoản vay: lịch trả ──────────────────────────────────────────────────────
/**
 * interest: mỗi kỳ chỉ trả lãi = principal*rate/12; gốc tất toán 1 lần cuối kỳ.
 * amort: trả đều gốc+lãi theo công thức annuity.
 */
export function loanSchedule(loan) {
  const r = (loan.rate || 0) / 100 / 12;
  const n = loan.term || 1;
  if (loan.kind === 'interest') {
    return { kind: 'interest', monthlyInterest: Math.round(loan.principal * r),
      principalDue: loan.principal, dueAt: loan.due_at,
      progress: { done: loan.done || 0, total: n } };
  }
  const pay = r === 0 ? loan.principal / n
    : (loan.principal * r) / (1 - Math.pow(1 + r, -n));
  const done = loan.done || 0;
  let bal = loan.principal;                     // dư nợ gốc còn lại sau `done` kỳ
  for (let i = 0; i < done; i++) bal = bal - (pay - bal * r);
  const interestPart = Math.round(bal * r);
  return { kind: 'amort', monthlyPayment: Math.round(pay),
    interestPart, principalPart: Math.max(0, Math.round(pay) - interestPart),
    principalRemaining: Math.max(0, Math.round(bal)), progress: { done, total: n } };
}

/** Số tham chiếu của hóa đơn: cố định dùng giá khai báo, biến đổi lấy trung bình 3 kỳ gần nhất. */
export function billAmountEstimate(bill, txs) {
  if (bill.amount_mode === 'fixed') return bill.amount || 0;
  const recent = txs.filter(tx => tx.bill_id === bill.id)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, 3);
  return recent.length
    ? Math.round(recent.reduce((sum, tx) => sum + tx.amount, 0) / recent.length)
    : 0;
}

// ── Quỹ tiết kiệm: số dư = SUM(deposits), lãi suất bình quân gia quyền ───────
export function fundBalance(deposits) {
  const total = deposits.reduce((s, d) => s + (d.amount || 0), 0);
  if (!total) return { total: 0, weightedRate: 0 };
  const weighted = deposits.reduce((s, d) => s + (d.amount || 0) * (d.rate || 0), 0) / total;
  return { total, weightedRate: Math.round(weighted * 100) / 100 };
}

/** BLENDED_RATE toàn cục = lãi suất bình quân gia quyền của MỌI tiền đang gửi. */
export function blendedRate(allDeposits) {
  return fundBalance(allDeposits).weightedRate;
}

/** Ngày đáo hạn ≤ 45 ngày → cảnh báo vàng. */
export function maturityWarn(matures_at, refStr) {
  if (!matures_at) return null;
  const days = daysInclusive(refStr, matures_at) - 1;
  return { days, warn: days >= 0 && days <= 45 };
}

// ── Nhịp chi: cột theo ngày (1 tháng) hoặc theo tháng (kỳ dài) ───────────────
export function spendingRhythm(txs, { from, to, unit }, { savingAsExpense = false } = {}) {
  const buckets = new Map();
  for (const t of txs) {
    const isCountedSaving = savingAsExpense && t.type === 'saving' && t.saving_dir !== 'out';
    if ((t.type !== 'expense' && !isCountedSaving) || t.excluded) continue;
    if (!inRange(t.occurred_at, from, to)) continue;
    const key = unit === 'month' ? t.occurred_at.slice(0, 7) : t.occurred_at;
    buckets.set(key, (buckets.get(key) || 0) + t.amount);
  }
  const rows = [];
  if (unit === 'month') {
    const d = parseYmd(from.slice(0, 7) + '-01');
    const end = parseYmd(to.slice(0, 7) + '-01');
    while (d <= end) {
      const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      rows.push({ key: k, amount: buckets.get(k) || 0 });
      d.setMonth(d.getMonth() + 1);
    }
  } else {
    let cur = from;
    while (cur <= to) { rows.push({ key: cur, amount: buckets.get(cur) || 0 }); cur = addDaysStr(cur, 1); }
  }
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.amount, 0) / rows.length) : 0;
  return { rows, avg };
}

// ── Giao dịch: nhóm theo ngày thật (mới nhất trước) ─────────────────────────
export function groupByDate(txs) {
  const map = new Map();
  for (const t of txs) {
    if (!map.has(t.occurred_at)) map.set(t.occurred_at, []);
    map.get(t.occurred_at).push(t);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, items]) => ({ date, items }));
}
