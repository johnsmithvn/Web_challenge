/**
 * dashboardMetrics — số liệu THẬT cho các ô của Trang chủ: biểu đồ chi tiêu, lịch thanh
 * toán, tuần tập, phục hồi cơ và 5 ô module. Thuần: không React, không Supabase, không
 * import JSON → chạy bằng node:assert (src/__tests__/core/dashboardMetrics.test.js).
 *
 * Mọi hàm nhận `today` dạng yyyy-MM-dd (giờ địa phương). Không có dữ liệu thì trả số 0 /
 * mảng rỗng / null để UI hiện trạng thái trống — KHÔNG bịa số mẫu.
 */

import {
  ymd,
  parseYmd,
  addDaysStr,
  daysInclusive,
  shiftMonth,
  currentMonthPeriod,
  periodTotals,
  spendingRhythm,
  dueDateInMonth,
  billCycle,
  billSettled,
  billAmountEstimate,
  cardCycle,
  cardStatementSummary,
  cardCarryOver,
  nextAnnualFee,
  loanSchedule,
  loanCycle,
} from './financeLogic.js';
import { calculateRecoveryMetrics } from './workoutLogic.js';
import { PRIORITY_OPTIONS } from './taskFields.js';

const WEEKDAY_UPPER = ['CHỦ NHẬT', 'THỨ HAI', 'THỨ BA', 'THỨ TƯ', 'THỨ NĂM', 'THỨ SÁU', 'THỨ BẢY'];
const localDate = (iso) => ymd(new Date(iso));
const trimDecimals = (x, digits) => String(Number(x.toFixed(digits))).replace('.', ',');

/** "765k", "4,28tr", "18tr" — số tiền gọn cho ô lịch và ô module. */
export function compactMoney(amount) {
  const value = Math.round(Math.abs(Number(amount) || 0));
  const sign = Number(amount) < 0 ? '-' : '';
  if (value >= 999500) return `${sign}${trimDecimals(value / 1e6, 2)}tr`;
  if (value >= 1000) return `${sign}${Math.round(value / 1000)}k`;
  return `${sign}${value}đ`;
}

/**
 * Nhãn ưu tiên kiểu P1–P5 của design (P1 = gấp nhất) suy từ thang của app (0–5, 5 = Urgent).
 * 0 / thiếu = không ưu tiên → null (không hiện pill), không đoán thành "P3".
 */
export function priorityTag(priority) {
  const value = Number(priority);
  const option = PRIORITY_OPTIONS.find(p => p.value === value && p.value > 0);
  if (!option) return null;
  const rank = 6 - value;
  return { rank, text: `P${rank}`, label: option.label };
}

// ── Chi tiêu tháng (không có hạn mức — module Ngân sách đã gỡ từ 01/09/2026) ──────

const cumulate = (rows) => {
  let running = 0;
  return rows.map(row => (running += row.amount));
};

/**
 * Chi cộng dồn từng ngày của tháng này (tới hôm nay) và của TOÀN tháng trước — cùng
 * `spendingRhythm` với biểu đồ "Nhịp chi trong kỳ" bên Finance, nên hai nơi không thể lệch.
 * Kèm phần chi CỐ ĐỊNH (`is_fixed`: hóa đơn, lãi vay ghi qua Định kỳ tự đánh dấu) và số
 * tháng trước CÙNG KỲ (cùng số ngày; tháng trước ngắn hơn thì lấy hết tháng).
 */
export function monthSpend(txs, today) {
  const month = currentMonthPeriod(today);
  const prev = currentMonthPeriod(shiftMonth(today, -1));
  const cumulative = cumulate(spendingRhythm(txs, { from: month.from, to: today, unit: 'day' }).rows);
  const prevCumulative = cumulate(spendingRhythm(txs, { from: prev.from, to: prev.to, unit: 'day' }).rows);
  const curDay = cumulative.length;
  return {
    spent: cumulative[curDay - 1] || 0,
    fixedSpent: periodTotals(txs, { from: month.from, to: today }).fixed,
    cumulative,
    curDay,
    daysInMonth: daysInclusive(month.from, month.to),
    prevMonth: prev.month0 + 1,
    prevCumulative,
    prevToDate: prevCumulative[Math.min(curDay, prevCumulative.length) - 1] || 0,
  };
}

/**
 * Dự kiến chi cả tháng = phần CỐ ĐỊNH (đã trả + còn đến hạn trong tháng) + phần BIẾN ĐỔI
 * ngoại suy theo nhịp hiện tại.
 *
 * Không tách thì khoản cố định trả đầu tháng bị nhân lên như thể ngày nào cũng trả: 9 ngày
 * đầu trả 5tr lãi vay, tháng 31 ngày → dự kiến cộng thêm ~12tr không bao giờ xảy ra.
 * Khoản cố định nhập tay mà không đánh dấu `is_fixed` vẫn bị coi là biến đổi.
 */
export function spendForecast({ spent, fixedSpent = 0, upcomingFixed = 0, curDay, daysInMonth }) {
  const variable = Math.max(0, spent - fixedSpent);
  const variableProjected = curDay > 0 ? Math.round((variable / curDay) * daysInMonth) : variable;
  return {
    projected: fixedSpent + upcomingFixed + variableProjected,
    fixed: fixedSpent + upcomingFixed,
  };
}

/**
 * Các nhóm chi nhiều nhất tháng này (tới hôm nay), kèm số tháng trước CÙNG KỲ để so —
 * so 9 ngày đầu tháng này với cả tháng trước là so sai.
 * `share` = % trong tổng chi tháng này; `deltaPct` = null khi cùng kỳ tháng trước chưa chi.
 */
export function topCategories(txs, today, cats, count = 4) {
  if (!cats?.expenseGroups) return [];
  const month = currentMonthPeriod(today);
  const prev = currentMonthPeriod(shiftMonth(today, -1));
  const curDay = daysInclusive(month.from, today);
  const prevTo = addDaysStr(prev.from, Math.min(curDay, daysInclusive(prev.from, prev.to)) - 1);
  const current = periodTotals(txs, { from: month.from, to: today });
  const before = periodTotals(txs, { from: prev.from, to: prevTo });
  const labelOf = (key) => cats.expenseGroups.find(g => g.key === key)?.label || key;
  return Object.entries(current.byCategory)
    .filter(([, spent]) => spent > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([key, spent]) => {
      const prevSpent = before.byCategory[key] || 0;
      return {
        key,
        label: labelOf(key),
        spent,
        prevSpent,
        share: current.total ? Math.round((spent / current.total) * 100) : 0,
        deltaPct: prevSpent ? Math.round(((spent - prevSpent) / prevSpent) * 100) : null,
      };
    });
}

// ── Lịch thanh toán tháng ─────────────────────────────────────────────────────

const STATUS_RANK = { paid: 0, up: 1, today: 2, over: 3 };

/**
 * Mọi khoản phải trả có hạn trong THÁNG NÀY: hóa đơn tới kỳ, sao kê thẻ, kỳ vay và phí
 * thường niên (chỉ từ hôm nay trở đi — đã qua thì ngân hàng tự trừ, app không biết).
 * Trạng thái đọc từ giao dịch đã ghi: paid | over | today | up.
 *
 * Mỗi khoản còn có `expense` = phần sẽ thành CHI TIÊU khi trả (cho dự kiến cuối tháng):
 * hóa đơn = cả số tiền; phí thường niên = cả phí; kỳ vay = chỉ phần lãi (gốc đứng ngoài
 * tổng chi); sao kê thẻ = 0 vì khoản quẹt đã tính vào chi ngay hôm quẹt.
 *
 * Trả `cells` đủ số tuần (35 hoặc 42 ô, tuần bắt đầu thứ Hai; null = ô trống) để tháng
 * bắt đầu cuối tuần không bị mất ngày 30–31.
 */
export function paymentCalendar({ bills = [], cards = [], loans = [], transactions = [], today }) {
  const month = today.slice(0, 7);
  const entries = [];
  const statusOf = (due, done) => (done ? 'paid' : due < today ? 'over' : due === today ? 'today' : 'up');
  const push = (due, name, amount, done, expense = amount) => {
    if (!due || due.slice(0, 7) !== month) return;
    entries.push({
      date: due, day: Number(due.slice(8, 10)), name, status: statusOf(due, done),
      amount: Math.max(0, Math.round(amount || 0)), expense: Math.max(0, Math.round(expense || 0)),
    });
  };

  for (const b of bills) {
    if (!b.enabled || b.finished_at) continue;
    const cycle = billCycle(b, today); // không truyền isSettled: chỉ hỏi tháng này có phải kỳ không
    if (!cycle?.thisMonth) continue;
    const start = b.anchor_date || (b.created_at ? localDate(b.created_at) : null);
    if (start && cycle.due < start) continue; // khai sau hạn của tháng này → kỳ đầu là tháng sau
    const paidTxs = transactions.filter(t => t.bill_id === b.id && t.bill_period === cycle.period);
    const amount = paidTxs.length ? paidTxs.reduce((sum, t) => sum + t.amount, 0) : billAmountEstimate(b, transactions);
    push(cycle.due, b.name, amount, billSettled(b, transactions)(cycle.period));
  }

  for (const c of cards) {
    if (c.closed_at) continue;
    const latest = cardStatementSummary(c, transactions, today);
    if (latest.statementTotal > 0) push(latest.due, `Sao kê ${c.name}`, latest.statementTotal, latest.outstanding === 0, 0);
    // Sao kê kỳ trước (hạn có thể còn nằm trong tháng này): đã trả hay chưa xét theo FIFO
    // như cardCarryOver, để khoản trả muộn mang nhãn kỳ mới không bị coi là chưa trả.
    const prevRef = addDaysStr(cardCycle(c, today).statement, -1);
    const previous = cardStatementSummary(c, transactions, prevRef);
    if (previous.statementTotal > 0) push(previous.due, `Sao kê ${c.name}`, previous.statementTotal, !cardCarryOver(c, transactions, today), 0);
    if (c.annual_fee > 0 && c.annual_fee_on) {
      const fee = nextAnnualFee(c.annual_fee_on, today);
      if (fee) push(fee.date, `Phí thường niên ${c.name}`, c.annual_fee, false);
    }
  }

  for (const l of loans) {
    if (l.closed_at) continue;
    const cycle = loanCycle(l, today, transactions);
    if (!cycle) continue;
    const due = dueDateInMonth(l.pay_day, today);
    if (l.opened_at && due <= l.opened_at) continue;
    const sch = loanSchedule(l);
    // Kỳ đang tính đã sang tháng sau = kỳ tháng này xong; còn kẹt ở tháng trước = tháng này chưa trả.
    const done = cycle.period === month ? cycle.done : cycle.period > month;
    push(due, l.name, sch.kind === 'interest' ? sch.monthlyInterest : sch.monthlyPayment, done,
      sch.kind === 'interest' ? sch.monthlyInterest : sch.interestPart);
  }

  const byDay = new Map();
  for (const e of entries) {
    const cell = byDay.get(e.day) || { day: e.day, items: [], amount: 0, status: 'paid' };
    cell.items.push(e);
    cell.amount += e.amount;
    if (STATUS_RANK[e.status] > STATUS_RANK[cell.status]) cell.status = e.status;
    byDay.set(e.day, cell);
  }

  const first = parseYmd(`${month}-01`);
  const firstCol = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cellCount = Math.ceil((firstCol + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, i) => {
    const day = i - firstCol + 1;
    if (day < 1 || day > daysInMonth) return null;
    return byDay.get(day) || { day, items: [], amount: 0, status: null };
  });

  return {
    cells,
    entries: entries.sort((a, b) => a.date.localeCompare(b.date)),
    totalCount: entries.length,
    paidCount: entries.filter(e => e.status === 'paid').length,
    leftAmount: entries.filter(e => e.status !== 'paid').reduce((sum, e) => sum + e.amount, 0),
    // Chi cố định còn phải trả trong tháng (kể cả khoản quá hạn của tháng này) — cho dự kiến.
    upcomingFixedSpend: entries.filter(e => e.status !== 'paid').reduce((sum, e) => sum + e.expense, 0),
  };
}

// ── Sắp tới hạn: nhóm theo ngày đến hạn thật ──────────────────────────────────

export function dueDateLabel(date, days) {
  const d = parseYmd(date);
  return `${days === 1 ? 'MAI · ' : ''}${WEEKDAY_UPPER[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

/** Nhóm các cảnh báo "sắp tới hạn" theo ngày đến hạn (today + days), sớm nhất trước. */
export function groupByDueDate(items, today) {
  const groups = new Map();
  for (const item of items || []) {
    if (item.days == null) continue;
    const date = addDaysStr(today, item.days);
    const group = groups.get(date) || { date, days: item.days, items: [] };
    group.items.push(item);
    groups.set(date, group);
  }
  return [...groups.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(g => ({ ...g, label: dueDateLabel(g.date, g.days) }));
}

// ── Nhiệm vụ hôm nay trống: gợi ý kéo việc sắp đến hạn về ────────────────────

/**
 * Tối đa `count` việc chưa xong có hạn trong tuần tới (mai → +6 ngày): hạn gần trước,
 * cùng hạn thì ưu tiên cao trước. Đầu vào là `futureTasks` của useUserTasks (đã bỏ
 * subtask và việc bỏ qua) — lọc lại cho chắc.
 */
export function upcomingTaskSuggestions(tasks = [], today, count = 3) {
  const until = addDaysStr(today, 6);
  return tasks
    .filter(t => !t.completed && t.status !== 'skip' && !t.parent_task_id
      && t.due_date && t.due_date > today && t.due_date <= until)
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || (Number(b.priority) || 0) - (Number(a.priority) || 0))
    .slice(0, count);
}

/**
 * Thay đổi để kéo một việc sắp tới hạn về làm hôm nay. Chỉ đổi `due_date` là chưa đủ: DB có
 * CHECK `user_tasks_start_before_due` (bắt đầu phải trước hạn), nên việc "bắt đầu T5, hạn T6"
 * kéo về hôm nay (T4) thì ngày bắt đầu cũng phải về hôm nay; giờ bắt đầu không còn trước
 * giờ hạn thì bỏ giờ bắt đầu.
 */
export function pullToTodayChanges(task, today) {
  const changes = { due_date: today };
  if (task.start_date && task.start_date >= today) {
    changes.start_date = today;
    if (task.start_time && task.due_time && String(task.start_time) >= String(task.due_time)) changes.start_time = null;
  }
  return changes;
}

/** "Mai", "T6 10/10", "CN 12/10" — nhãn hạn ngắn cho dòng gợi ý. */
export function shortDueLabel(date, today) {
  if (date === addDaysStr(today, 1)) return 'Mai';
  const d = parseYmd(date);
  return `${['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

// ── Body ──────────────────────────────────────────────────────────────────────

const WEEK_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/**
 * Tuần tập T2→CN: done (có buổi hoàn thành), today, missed (có lịch, đã qua, chưa tập),
 * plan (có lịch, sắp tới), rest. `planned` = số ngày có lịch trong tuần.
 */
export function weekTraining({ sessions = [], routineItems = [], today }) {
  const jsDay = parseYmd(today).getDay();
  const monday = addDaysStr(today, -((jsDay + 6) % 7));
  const plannedWeekdays = new Set(routineItems.map(i => Number(i.weekday)));
  const doneDates = new Set(sessions.filter(s => s.status === 'completed').map(s => s.local_date));
  const days = WEEK_LABELS.map((label, i) => {
    const date = addDaysStr(monday, i);
    const planned = plannedWeekdays.has(i + 1);
    const done = doneDates.has(date);
    const state = done ? 'done'
      : date === today ? 'today'
        : planned && date < today ? 'missed'
          : planned ? 'plan' : 'rest';
    return { label, date, planned, state };
  });
  return {
    days,
    done: days.filter(d => d.state === 'done').length,
    planned: days.filter(d => d.planned).length,
  };
}

/**
 * Nhóm cơ theo mức phục hồi (Cần nghỉ / Đang hồi / Sẵn sàng) từ các set đã tập thật,
 * dùng đúng luật `calculateRecoveryMetrics` của module Body.
 * @param muscles — { key: { name } } (src/data/body-muscles.json)
 */
export function muscleRecoveryGroups({ recentSets = [], exerciseMap, muscles = {}, nowMs }) {
  const keys = Object.keys(muscles);
  const stats = Object.fromEntries(keys.map(k => [k, { totalSets: 0, primarySets: 0, last: null, lastPrimary: null }]));
  const weekAgo = nowMs - 7 * 24 * 3600 * 1000;

  for (const s of recentSets) {
    if (s.actual_val == null && s.weight == null && s.reps == null) continue;
    const ex = exerciseMap?.get(s.exercise_key);
    const at = s.completed_at ? new Date(s.completed_at).getTime() : null;
    if (!ex || !at) continue;
    for (const muscle of [ex.primary, ...(ex.secondary || [])].filter(Boolean)) {
      const st = stats[muscle];
      if (!st) continue;
      const primary = ex.primary === muscle;
      if (at >= weekAgo) {
        st.totalSets += 1;
        if (primary) st.primarySets += 1;
      }
      if (!st.last || at > st.last) st.last = at;
      if (primary && (!st.lastPrimary || at > st.lastPrimary)) st.lastPrimary = at;
    }
  }

  const hours = (t) => (t ? Math.max(0, Math.round((nowMs - t) / 3600000)) : null);
  const groups = [
    { id: 'low', label: 'Cần nghỉ', muscles: [] },
    { id: 'mid', label: 'Đang hồi', muscles: [] },
    { id: 'ready', label: 'Sẵn sàng', muscles: [] },
  ];
  for (const k of keys) {
    const st = stats[k];
    const { state } = calculateRecoveryMetrics({
      totalSets: st.totalSets,
      primarySets: st.primarySets,
      hoursSince: hours(st.last),
      hoursSincePrimary: hours(st.lastPrimary),
    });
    (groups.find(g => g.id === state) || groups[2]).muscles.push(muscles[k]?.name || k);
  }
  return groups;
}

/** Cân nặng mới nhất (bỏ lần cân lệch), khoảng cách tới mục tiêu và điểm 30 ngày cho sparkline. */
export function weightTrend(measurements = [], goalKg, today, days = 30) {
  const valid = measurements
    .filter(m => !m.is_outlier && Number(m.weight) > 0)
    .map(m => ({ date: m.local_date || localDate(m.measured_at), at: m.measured_at, weight: Number(m.weight) }))
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const latest = valid.length ? valid[valid.length - 1].weight : null;
  const goal = Number(goalKg) > 0 ? Number(goalKg) : null;
  const from = addDaysStr(today, -(days - 1));
  return {
    latest,
    goal,
    toGoal: latest != null && goal != null ? Math.round((latest - goal) * 100) / 100 : null,
    points: valid.filter(m => m.date >= from && m.date <= today).map(m => m.weight),
  };
}

// ── 5 ô module ────────────────────────────────────────────────────────────────

/**
 * Việc đã xong trong `days` ngày gần nhất (theo ngày hoàn thành giờ địa phương), tỉ lệ
 * đúng hạn trên các việc có hạn chót, và số việc xong từng ngày cho biểu đồ cột.
 */
export function taskCompletionStats(completedTasks = [], today, days = 14) {
  const from = addDaysStr(today, -(days - 1));
  const perDay = new Map();
  const seen = new Set();
  let done = 0, withDue = 0, onTime = 0;
  for (const t of completedTasks) {
    if (!t?.completed_at || seen.has(t.id)) continue;
    seen.add(t.id);
    const day = localDate(t.completed_at);
    if (day < from || day > today) continue;
    done += 1;
    perDay.set(day, (perDay.get(day) || 0) + 1);
    if (t.due_date) {
      withDue += 1;
      if (day <= t.due_date) onTime += 1;
    }
  }
  return {
    done,
    onTimePct: withDue ? Math.round((onTime / withDue) * 100) : null,
    bars: Array.from({ length: days }, (_, i) => perDay.get(addDaysStr(from, i)) || 0),
  };
}

/** Chi trung bình mỗi ngày của tháng này (tới hôm nay) và tháng trước, kèm chi từng ngày gần nhất. */
export function dailySpendStats(txs, today, barCount = 8) {
  const month = currentMonthPeriod(today);
  const curDay = daysInclusive(month.from, today);
  const thisTotal = periodTotals(txs, { from: month.from, to: today }).total;
  const prev = currentMonthPeriod(shiftMonth(today, -1));
  const prevTotal = periodTotals(txs, prev).total;
  const { rows } = spendingRhythm(txs, { from: addDaysStr(today, -(barCount - 1)), to: today, unit: 'day' });
  return {
    avgPerDay: Math.round(thisTotal / curDay),
    prevAvgPerDay: prevTotal > 0 ? Math.round(prevTotal / daysInclusive(prev.from, prev.to)) : null,
    bars: rows.map(r => r.amount),
  };
}

/** Ghi chú mới tuần này (từ thứ Hai) và số mục tạo mỗi tuần trong `weeks` tuần gần nhất. */
export function knowledgeActivity(createdAt = [], today, weeks = 8) {
  const thisMonday = addDaysStr(today, -((parseYmd(today).getDay() + 6) % 7));
  const firstMonday = addDaysStr(thisMonday, -7 * (weeks - 1));
  const bars = Array(weeks).fill(0);
  let thisWeek = 0;
  for (const iso of createdAt) {
    const day = localDate(iso);
    if (day < firstMonday || day > today) continue;
    const week = Math.floor((daysInclusive(firstMonday, day) - 1) / 7);
    bars[week] += 1;
    if (day >= thisMonday) thisWeek += 1;
  }
  return { thisWeek, bars };
}
