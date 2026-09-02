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

export const NECESSITY_ORDER = ['must', 'want'];

/**
 * Mức cắt được suy tự động: sub đè cat (NEED_BY_SUB đè NEED_BY_CAT). Gửi xe là
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
  return (cats && cats.necessityByCat && cats.necessityByCat[categoryId]) || 'want';
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
/**
 * Ngày đến hạn KẾ TIẾP: qua ngày trong tháng này rồi thì nhảy sang tháng sau.
 * Khác `dueDateInMonth` (luôn nằm trong tháng của `refStr`) — dùng cho chỗ hỏi
 * "còn mấy ngày nữa", đồng thời cho biết ngày đó thuộc KỲ nào để tra đã trả chưa.
 */
export function nextDueDate(dueDay, refStr) {
  const inMonth = dueDateInMonth(dueDay, refStr);
  if (inMonth == null || inMonth >= refStr) return inMonth;
  const ref = parseYmd(refStr);
  return dueDateInMonth(dueDay, ymd(new Date(ref.getFullYear(), ref.getMonth() + 1, 1)));
}

/** Ngày mùng 1 của tháng cách `refStr` đúng `months` tháng (âm = lùi). */
export function shiftMonth(refStr, months) {
  const d = parseYmd(refStr);
  return ymd(new Date(d.getFullYear(), d.getMonth() + months, 1));
}

/**
 * Kỳ đang tính của một hóa đơn — chỗ DUY NHẤT quyết định "kỳ nào" cho hóa đơn,
 * thay cho việc lấy đại `today.slice(0,7)`.
 *
 * `rrule.every` = số tháng một kỳ (1 = hằng tháng, 3 = quý, 12 = năm); `anchor_date`
 * là ngày bắt đầu trả, chỉ dùng để biết THÁNG nào tới lượt. Ngày trong tháng luôn
 * lấy theo `due_day` — ngày cố định thắng ngày bắt đầu.
 *
 * Tháng này đúng kỳ → `thisMonth: true` và `days` ÂM khi đã quá hạn (màn Hóa đơn
 * dựa vào đó để tô đỏ). Tháng này không phải kỳ (chỉ xảy ra khi `every > 1`) → BÁM
 * LẠI kỳ vừa qua nếu nó chưa trả và chưa bỏ, chỉ khi kỳ đó xong mới nhảy tới kỳ
 * kế. Không có bước bám này thì một kỳ quý bị lỡ sẽ biến mất khỏi màn hình vào
 * đúng tháng sau đó — app im lặng quên một khoản nợ thật.
 *
 * @param isSettled — (period) => đã trả hoặc đã bỏ kỳ. Dựng bằng `billSettled()`.
 *   Bỏ trống thì luôn nhảy tới kỳ kế (dùng cho chỗ chỉ cần biết lịch, không cần trạng thái).
 */
export function billCycle(bill, refStr, isSettled) {
  const due = dueDateInMonth(bill.due_day, refStr);
  if (due == null) return null;
  const at = (d) => ({ period: d.slice(0, 7), due: d, days: daysInclusive(refStr, d) - 1,
    thisMonth: d.slice(0, 7) === refStr.slice(0, 7) });

  const every = Math.max(1, Number(bill.rrule?.every) || 1);
  if (every === 1 || !bill.anchor_date) return at(due);

  const anchor = parseYmd(bill.anchor_date), ref = parseYmd(refStr);
  const diff = (ref.getFullYear() - anchor.getFullYear()) * 12 + (ref.getMonth() - anchor.getMonth());
  if (diff >= 0 && diff % every === 0) return at(due);

  if (diff > 0 && isSettled) {
    const previous = at(dueDateInMonth(bill.due_day, shiftMonth(refStr, -(diff % every))));
    if (!isSettled(previous.period)) return previous;
  }
  const ahead = diff < 0 ? -diff : every - (diff % every);
  return at(dueDateInMonth(bill.due_day, shiftMonth(refStr, ahead)));
}

/**
 * `count` kỳ gần nhất tính lùi từ `fromPeriod`, mới nhất trước. Bước lùi bằng đúng
 * chu kỳ của hóa đơn — hóa đơn quý phải ra 10/26 · 07/26 · 04/26, không phải 6 tháng liền.
 */
export function billPeriods(bill, fromPeriod, count = 6) {
  const every = Math.max(1, Number(bill.rrule?.every) || 1);
  const year = Number(fromPeriod.slice(0, 4)), month = Number(fromPeriod.slice(5, 7)) - 1;
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(year, month - i * every, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  });
}

/**
 * NGÀY TRẢ nằm ở kỳ nào — mốc kỳ gần ngày đó nhất.
 *
 * Không dùng "tháng của ngày trả" (trả hóa đơn hạn 28/07 vào 02/08 vẫn là kỳ 07) và
 * cũng không dùng "kỳ đang chạy" (khai hóa đơn hôm nay rồi ghi lại khoản đã trả từ
 * tháng 7 thì phải rơi vào kỳ tháng 7, không phải kỳ sắp tới). Gần nhất xử lý được
 * cả trả muộn vài ngày lẫn trả sớm vài ngày; hòa thì ưu tiên kỳ CŨ hơn — trả nợ cũ
 * là mặc định an toàn hơn trả trước cho kỳ chưa tới.
 */
export function billPeriodForDate(bill, dateStr) {
  if (!bill?.due_day || !dateStr) return null;
  const every = Math.max(1, Number(bill.rrule?.every) || 1);
  const anchor = (every > 1 && bill.anchor_date) ? bill.anchor_date : dateStr;
  const a = parseYmd(anchor), d = parseYmd(dateStr);
  const diff = (d.getFullYear() - a.getFullYear()) * 12 + (d.getMonth() - a.getMonth());
  const floor = diff - (((diff % every) + every) % every);
  let best = null;
  for (const k of [floor - every, floor, floor + every]) {
    const at = dueDateInMonth(bill.due_day, shiftMonth(anchor, k));
    const gap = Math.abs(parseYmd(at) - d);
    if (best == null || gap < best.gap) best = { at, gap };
  }
  return best.at.slice(0, 7);
}

/** Kỳ đã xong = đã ghi giao dịch cho kỳ đó, hoặc đã bấm bỏ kỳ. */
export function billSettled(bill, txs) {
  const skipped = bill.skipped_periods || [];
  return (period) => skipped.includes(period)
    || txs.some(t => t.bill_id === bill.id && t.bill_period === period);
}

const VN_MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
  'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

/**
 * 15 kỳ chuẩn để khởi tạo bộ lọc: 12 tháng gần nhất theo thứ tự mới nhất trước,
 * Cả năm nay, Cả năm trước, Tất cả. Month/year picker có thể mở kỳ xa hơn qua
 * `periodFromKey`, không bị giới hạn bởi danh sách này.
 * unit = đơn vị cột nhịp chi ('day' cho 1 tháng, 'month' cho kỳ dài).
 */
export function listPeriodOptions(refStr, fromStr = '2000-01-01') {
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
  // "Tất cả" KHÔNG được hứa nhiều hơn số dữ liệu thật sự có trong state: `fromStr`
  // là mốc đầu cửa sổ mà useFinance kéo về. Hứa 2000-01-01 rồi hiện 0đ cho kỳ cũ
  // là app nói dối — và CSV xuất từ state cũng thiếu dữ liệu mà không cảnh báo.
  opts.push({ key: 'all', label: 'Tất cả', from: fromStr, to: refStr, unit: 'month' });
  return opts;
}

/** Đổi khóa của month/year picker thành khoảng ngày để mọi màn dùng chung. */
export function periodFromKey(key, refStr, fromStr = '2000-01-01') {
  const current = currentMonthPeriod(refStr);
  if (key === 'all') return { key, label: 'Tất cả', from: fromStr, to: refStr, unit: 'month' };

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
 * necessity đọc từ t.necessity (hook đã suy lúc ghi); thiếu thì rơi về 'want'.
 */
export function periodTotals(txs, { from, to }, { savingAsExpense = false } = {}) {
  const out = {
    total: 0, income: 0, savingIn: 0, savingOut: 0, fixed: 0,
    count: 0, txCount: 0, days: daysInclusive(from, to),
    byCategory: {}, byNecessity: { must: 0, want: 0 }, biggest: null,
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
    const nec = t.necessity || 'want';
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
  { re: /internet|wifi|mạng|fpt|viettel/i,           cat: 'subscription',  sub: 'housing.internet' },
  { re: /tiền nhà|thuê nhà|thuê phòng/i,             cat: 'housing',       sub: 'housing.rent' },
  { re: /netflix|spotify|youtube|đăng ký|subscri/i,  cat: 'personal',      sub: 'subscription.streaming' },
  { re: /thuốc|khám|bệnh viện|bác sĩ/i,              cat: 'health',        sub: 'health.medicine' },
  { re: /phim|sự kiện/i,                              cat: 'personal',      sub: 'entertainment.events' },
  { re: /game/i,                                      cat: 'personal',      sub: 'entertainment.game' },
  { re: /du lịch/i,                                   cat: 'personal',      sub: 'entertainment.travel' },
  { re: /quần áo|áo|giày|mua sắm|shopee|lazada/i,    cat: 'personal',      sub: 'shopping.clothes' },
];

/** Đoán {categoryId, subId} từ text. Trả null nếu không khớp luật nào. */
export function matchCategory(text) {
  if (!text) return null;
  for (const rule of NL_DICT) {
    if (rule.re.test(text)) return { categoryId: rule.cat, subId: rule.sub };
  }
  return null;
}

// ── Ngân sách — tính trên HẠN MỨC, không trên thu nhập ───────────────────────
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

  return {
    totalLimit, totalSpent: totals.total, remaining: totalLimit - totals.total,
    pct: totalLimit ? Math.round((totals.total / totalLimit) * 100) : null,
    categories, cutable: totals.byNecessity.want,
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
  if (!balance || !days || !blendedRate || balance <= 0 || days <= 0 || blendedRate <= 0) return 0;
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

// ── Cho vay: lãi theo ngày trên dư nợ còn lại ───────────────────────────────
/**
 * Lãi của một khoản CHO VAY. Không phải `principal * rate` một cục: mỗi lần họ trả
 * gốc là dư nợ tụt xuống, nên lãi từ hôm đó phải tính trên số nhỏ hơn — vì vậy đổi
 * ngày hẹn hay ghi thêm một lần họ trả đều làm con số này khác đi.
 *
 * Lãi ĐƠN, năm 365 ngày, đơn vị NGÀY (không quy về tháng như `loanSchedule`): vay tay
 * đôi hiếm khi tròn tháng, và thứ người dùng gõ vào là một ngày hẹn cụ thể.
 *
 * @param repayments — giao dịch thu GỐC của khoản này (excluded, có `lending_id`).
 *   Tiền lãi họ trả KHÔNG nằm trong danh sách này nên không làm giảm dư nợ gốc.
 * @returns
 *   earned   — lãi đã phát sinh tới `refStr`: số họ đang nợ thêm ngoài gốc.
 *   expected — lãi tới NGÀY HẸN nếu dư nợ giữ nguyên từ giờ tới đó. Quá hẹn thì lãi
 *              vẫn chạy, nên mốc là ngày xa hơn giữa ngày hẹn và hôm nay.
 *   total    — tổng sẽ nhận trên cả khoản = gốc + expected.
 */
export function lendingInterest(lending, repayments = [], refStr) {
  const rate = Number(lending.rate) || 0;
  const principal = lending.principal || 0;
  const start = lending.lent_on || refStr;
  const accrue = (bal, from, to) =>
    to <= from ? 0 : bal * (rate / 100) * ((daysInclusive(from, to) - 1) / 365);

  let balance = principal, cursor = start, before = 0;
  for (const t of [...repayments].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))) {
    const at = t.occurred_at > cursor ? t.occurred_at : cursor;   // trả trước ngày đưa tiền → 0 ngày lãi
    before += accrue(balance, cursor, at);
    balance = Math.max(0, balance - t.amount);
    cursor = at;
  }
  const now = refStr > cursor ? refStr : cursor;
  const to = lending.due_on && lending.due_on > now ? lending.due_on : now;
  const expected = Math.round(before + accrue(balance, cursor, to));
  const earned = Math.round(before + accrue(balance, cursor, now));
  // Lãi mất do rút tiết kiệm trước hạn: TIỀN TUYỆT ĐỐI, không nhân với số ngày và
  // không đổi khi dời ngày hẹn — nó đã mất xong ngay lúc đập sổ.
  const forfeited = Math.max(0, Number(lending.forfeited_interest) || 0);
  return {
    rate, balance, to, days: Math.max(0, daysInclusive(start, to) - 1),
    earned, expected, forfeited,
    dueNow: earned + forfeited,              // lãi họ đang nợ nếu tất toán hôm nay
    total: principal + expected + forfeited,
  };
}

/**
 * Lãi bị mất khi đập một khoản gửi trước hạn = TOÀN BỘ lãi đã tích từ ngày gửi tới
 * ngày rút. Rút trước hạn thì ngân hàng trả lại theo lãi không kỳ hạn (~0,1%/năm),
 * coi như bằng 0 — số này là mức trần để điền sẵn, giấy rút của ngân hàng mới là số
 * cuối cùng nên ô nhập vẫn sửa được.
 */
export function forfeitedInterest(deposit, withdrawOn) {
  if (!deposit?.opened_at || !withdrawOn || withdrawOn <= deposit.opened_at) return 0;
  const days = daysInclusive(deposit.opened_at, withdrawOn) - 1;
  return Math.round((deposit.amount || 0) * ((Number(deposit.rate) || 0) / 100) * (days / 365));
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

/** Phân loại nơi gửi: 'cd' (Chứng chỉ tiền gửi), 'term' (Sổ tiết kiệm có kỳ hạn), 'flex' (Tích lũy linh hoạt không kỳ hạn) */
export function guessDepositType(deposit) {
  if (!deposit) return 'cd';
  if (deposit.term === null || deposit.term === undefined || deposit.term === '' || Number(deposit.term) === 0) return 'flex';
  const name = (deposit.name || '').toLowerCase();
  if (name.includes('chứng chỉ') || name.includes('cd') || name.includes('cc tiền gửi')) return 'cd';
  return 'term';
}

/** Kiểm tra nơi gửi có cho phép nạp thêm tiền (gửi thêm) không. Chỉ 'flex' mới cho nạp thêm; 'term' và 'cd' đã khóa gốc. */
export function canDepositTopUp(deposit) {
  return guessDepositType(deposit) === 'flex';
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
