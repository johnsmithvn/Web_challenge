/**
 * dashboardAlerts — Pure logic tổng hợp và phân loại cảnh báo toàn hệ thống.
 * KHÔNG React, KHÔNG Supabase, KHÔNG DOM → chạy thuần bằng Node.js để test bằng node:assert.
 *
 * Tiêu chí: ZERO BLINDSPOTS (Không bỏ sót bất kỳ nghĩa vụ hay hạn chót nào).
 * Phân cấp 3 tầng nghiêm ngặt:
 *   1. Critical (Báo động đỏ): ĐÃ QUÁ HẠN (Task, Hóa đơn, Sao kê thẻ, Nợ vay, Cho mượn).
 *   2. Due Today: ĐẾN HẠN HÔM NAY (Cần xử lý trước 23:59 đêm nay).
 *   3. Heads Up: SẮP TỚI HẠN (Còn 1–3 ngày, phí thường niên ≤5 ngày, sổ đáo hạn ≤14 ngày, vỡ ngân sách).
 */

import {
  daysInclusive,
  daysUntilDue,
  billCycle,
  billSettled,
  cardStatementSummary,
  nextAnnualFee,
  loanSchedule,
  maturityWarn,
  periodTotals,
  currentMonthPeriod,
} from './financeLogic.js';

import { isSubtask } from './subtaskUtils.js';

export function collectSystemAlerts({
  tasks = [],
  bills = [],
  cards = [],
  loans = [],
  lendings = [],
  deposits = [],
  budgets = [],
  transactions = [],
  today,
} = {}) {
  if (!today) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  const critical = [];
  const dueToday = [];
  const headsUp = [];

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. NHIỆM VỤ (TASKS)
  // ═══════════════════════════════════════════════════════════════════════════
  for (const t of tasks) {
    // Bỏ qua: đã xong, bỏ qua (skip), subtask (đã nằm trong task cha), không có ngày hạn
    if (t.completed || t.status === 'skip' || isSubtask(t) || !t.due_date) continue;

    const diffDays = daysInclusive(t.due_date, today) - 1; // âm nếu dueDate < today

    if (t.due_date < today) {
      const overdueDays = Math.max(1, Math.abs(diffDays));
      critical.push({
        id: `task-${t.id}`,
        domain: 'task',
        type: 'task_overdue',
        severity: 'critical',
        raw: t,
        title: t.title,
        subtitle: `Hạn chót: ${t.due_date}${t.priority ? ` · Ưu tiên P${t.priority}` : ''}`,
        amount: null,
        days: -overdueDays,
        badge: `Trễ ${overdueDays} ngày`,
        icon: 'pushPin',
        actionType: 'task',
        actionLabel: 'Xong',
        actionSecondaryLabel: 'Dời hôm nay',
        targetUrl: '/tasks',
      });
    } else if (t.due_date === today) {
      dueToday.push({
        id: `task-${t.id}`,
        domain: 'task',
        type: 'task_today',
        severity: 'today',
        raw: t,
        title: t.title,
        subtitle: t.due_time ? `Hẹn lúc ${t.due_time}` : 'Cần làm trong hôm nay',
        amount: null,
        days: 0,
        badge: 'Hôm nay',
        icon: 'checkCircle',
        actionType: 'task',
        actionLabel: 'Xong',
        targetUrl: '/tasks',
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. HÓA ĐƠN TÀI CHÍNH (FINANCE BILLS)
  // ═══════════════════════════════════════════════════════════════════════════
  for (const b of bills) {
    if (!b.enabled || b.finished_at) continue;

    const settled = billSettled(b, transactions);
    const cyc = billCycle(b, today, settled);
    if (!cyc || settled(cyc.period)) continue;

    const billAmt = b.amount_mode === 'fixed' ? b.amount : null;

    if (cyc.days < 0) {
      critical.push({
        id: `bill-${b.id}`,
        domain: 'finance',
        type: 'bill_overdue',
        severity: 'critical',
        raw: b,
        title: `Hóa đơn ${b.name}`,
        subtitle: `Kỳ ${cyc.period} · Hạn ${cyc.due}`,
        amount: billAmt,
        period: cyc.period,
        days: cyc.days,
        badge: `Quá hạn ${Math.abs(cyc.days)} ngày`,
        icon: 'receipt',
        actionType: 'bill_pay',
        actionLabel: 'Trả ngay',
        actionSecondaryLabel: 'Bỏ kỳ',
        targetUrl: '/finance/recurring',
      });
    } else if (cyc.days === 0) {
      dueToday.push({
        id: `bill-${b.id}`,
        domain: 'finance',
        type: 'bill_today',
        severity: 'today',
        raw: b,
        title: `Hóa đơn ${b.name}`,
        subtitle: `Đến hạn hôm nay (${cyc.due})`,
        amount: billAmt,
        period: cyc.period,
        days: 0,
        badge: 'Đến hạn hôm nay',
        icon: 'receipt',
        actionType: 'bill_pay',
        actionLabel: 'Trả ngay',
        targetUrl: '/finance/recurring',
      });
    } else if (cyc.days <= 3) {
      headsUp.push({
        id: `bill-${b.id}`,
        domain: 'finance',
        type: 'bill_soon',
        severity: 'heads_up',
        raw: b,
        title: `Hóa đơn ${b.name}`,
        subtitle: `Đến hạn ngày ${cyc.due}`,
        amount: billAmt,
        period: cyc.period,
        days: cyc.days,
        badge: `Còn ${cyc.days} ngày`,
        icon: 'receipt',
        actionType: 'bill_pay',
        actionLabel: 'Trả trước',
        targetUrl: '/finance/recurring',
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. THẺ TÍN DỤNG (CREDIT CARDS - SAO KÊ & PHÍ THƯỜNG NIÊN)
  // ═══════════════════════════════════════════════════════════════════════════
  for (const c of cards) {
    if (c.closed_at) continue;

    // Sao kê
    const cyc = cardStatementSummary(c, transactions, today);
    if (cyc && cyc.outstanding > 0) {
      if (cyc.overdue || cyc.daysUntilDue < 0) {
        critical.push({
          id: `card-${c.id}`,
          domain: 'finance',
          type: 'card_overdue',
          severity: 'critical',
          raw: c,
          title: `Sao kê ${c.name}`,
          subtitle: `Hạn chót ${cyc.due} · Trả đủ để không phát sinh lãi`,
          amount: cyc.outstanding,
          period: cyc.period,
          days: cyc.daysUntilDue,
          badge: `Quá hạn ${Math.abs(cyc.daysUntilDue)} ngày`,
          icon: 'creditCard',
          actionType: 'card_pay',
          actionLabel: 'Trả sao kê',
          targetUrl: '/finance/recurring',
        });
      } else if (cyc.daysUntilDue === 0) {
        dueToday.push({
          id: `card-${c.id}`,
          domain: 'finance',
          type: 'card_today',
          severity: 'today',
          raw: c,
          title: `Sao kê ${c.name}`,
          subtitle: `Hạn cuối hôm nay (${cyc.due})`,
          amount: cyc.outstanding,
          period: cyc.period,
          days: 0,
          badge: 'Đến hạn hôm nay',
          icon: 'creditCard',
          actionType: 'card_pay',
          actionLabel: 'Trả sao kê',
          targetUrl: '/finance/recurring',
        });
      } else if (cyc.daysUntilDue <= 5) {
        headsUp.push({
          id: `card-${c.id}`,
          domain: 'finance',
          type: 'card_soon',
          severity: 'heads_up',
          raw: c,
          title: `Sao kê ${c.name}`,
          subtitle: `Hạn thanh toán ${cyc.due}`,
          amount: cyc.outstanding,
          period: cyc.period,
          days: cyc.daysUntilDue,
          badge: `Còn ${cyc.daysUntilDue} ngày`,
          icon: 'creditCard',
          actionType: 'card_pay',
          actionLabel: 'Trả sao kê',
          targetUrl: '/finance/recurring',
        });
      }
    }

    // Phí thường niên
    if (c.annual_fee > 0 && c.annual_fee_on) {
      const fee = nextAnnualFee(c.annual_fee_on, today);
      if (fee) {
        if (fee.days === 0) {
          dueToday.push({
            id: `fee-${c.id}`,
            domain: 'finance',
            type: 'card_fee_today',
            severity: 'today',
            raw: c,
            title: `Phí thường niên ${c.name}`,
            subtitle: `Thu hôm nay (${fee.date})`,
            amount: c.annual_fee,
            days: 0,
            badge: 'Thu hôm nay',
            icon: 'calendar',
            actionType: 'nav',
            actionLabel: 'Xem thẻ',
            targetUrl: '/finance/recurring',
          });
        } else if (fee.days <= 5) {
          headsUp.push({
            id: `fee-${c.id}`,
            domain: 'finance',
            type: 'card_fee_soon',
            severity: 'heads_up',
            raw: c,
            title: `Phí thường niên ${c.name}`,
            subtitle: `Thu ngày ${fee.date}`,
            amount: c.annual_fee,
            days: fee.days,
            badge: `Còn ${fee.days} ngày`,
            icon: 'calendar',
            actionType: 'nav',
            actionLabel: 'Xem thẻ',
            targetUrl: '/finance/recurring',
          });
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. KHOẢN NỢ VAY CỦA MÌNH (FINANCE LOANS)
  // ═══════════════════════════════════════════════════════════════════════════
  const currentMonthKey = today.slice(0, 7);
  for (const l of loans) {
    if (l.closed_at) continue;

    const sch = loanSchedule(l);
    const d = daysUntilDue(l.pay_day, today);

    const paidInterest = transactions.some(
      t => t.loan_id === l.id && t.loan_period === currentMonthKey && t.loan_part === 'interest'
    );
    const paidPrincipal = transactions.some(
      t => t.loan_id === l.id && t.loan_period === currentMonthKey && t.loan_part === 'principal'
    );
    const donePeriod = sch.kind === 'interest' ? paidInterest : paidPrincipal;

    const dueAmount = sch.kind === 'interest' ? sch.monthlyInterest : sch.monthlyPayment;

    // Trả định kỳ tháng này
    if (!donePeriod && d != null) {
      if (d < 0) {
        critical.push({
          id: `loan-${l.id}`,
          domain: 'finance',
          type: 'loan_overdue',
          severity: 'critical',
          raw: l,
          title: `Khoản vay ${l.name}`,
          subtitle: `Trả định kỳ ngày ${l.pay_day} hàng tháng`,
          amount: dueAmount,
          days: d,
          badge: `Quá hạn ${Math.abs(d)} ngày`,
          icon: 'bank',
          actionType: 'loan_pay',
          actionLabel: 'Ghi trả nợ',
          targetUrl: '/finance/recurring',
        });
      } else if (d === 0) {
        dueToday.push({
          id: `loan-${l.id}`,
          domain: 'finance',
          type: 'loan_today',
          severity: 'today',
          raw: l,
          title: `Khoản vay ${l.name}`,
          subtitle: `Đến ngày trả định kỳ hôm nay`,
          amount: dueAmount,
          days: 0,
          badge: 'Đến hạn hôm nay',
          icon: 'bank',
          actionType: 'loan_pay',
          actionLabel: 'Ghi trả nợ',
          targetUrl: '/finance/recurring',
        });
      } else if (d <= 3) {
        headsUp.push({
          id: `loan-${l.id}`,
          domain: 'finance',
          type: 'loan_soon',
          severity: 'heads_up',
          raw: l,
          title: `Khoản vay ${l.name}`,
          subtitle: `Hạn trả ngày ${l.pay_day}/${today.slice(5, 7)}`,
          amount: dueAmount,
          days: d,
          badge: `Còn ${d} ngày`,
          icon: 'bank',
          actionType: 'loan_pay',
          actionLabel: 'Ghi trả nợ',
          targetUrl: '/finance/recurring',
        });
      }
    }

    // Tất toán nợ gốc (khoản vay trả lãi định kỳ)
    if (sch.kind === 'interest' && l.due_at && l.due_at <= today) {
      const settledPrincipal = transactions.some(
        t => t.loan_id === l.id && t.loan_part === 'principal'
      );
      if (!settledPrincipal) {
        critical.push({
          id: `loan-principal-${l.id}`,
          domain: 'finance',
          type: 'loan_principal_due',
          severity: 'critical',
          raw: l,
          title: `Tất toán gốc ${l.name}`,
          subtitle: `Đã đến hạn tất toán ngày ${l.due_at}`,
          amount: sch.principalDue,
          days: daysInclusive(today, l.due_at) - 1,
          badge: 'Tất toán gốc',
          icon: 'bank',
          actionType: 'loan_settle',
          actionLabel: 'Tất toán gốc',
          targetUrl: '/finance/recurring',
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. CHO NGƯỜI KHÁC VAY (FINANCE LENDINGS)
  // ═══════════════════════════════════════════════════════════════════════════
  for (const lend of lendings) {
    if (lend.closed_at || !lend.due_on) continue;

    const got = transactions
      .filter(t => t.lending_id === lend.id)
      .reduce((sum, t) => sum + t.amount, 0);
    const left = Math.max(0, lend.principal - got);

    if (left > 0) {
      const days = daysInclusive(today, lend.due_on) - 1;

      if (days < 0) {
        critical.push({
          id: `lend-${lend.id}`,
          domain: 'finance',
          type: 'lend_overdue',
          severity: 'critical',
          raw: lend,
          title: `Khoản cho vay: ${lend.name}`,
          subtitle: `Hẹn trả ngày ${lend.due_on} · Đã thu ${got ? `${got.toLocaleString('vi-VN')}₫` : '0₫'}`,
          amount: left,
          days,
          badge: `Quá hẹn ${Math.abs(days)} ngày`,
          icon: 'handCoins',
          actionType: 'lend_collect',
          actionLabel: 'Thu nợ',
          targetUrl: '/finance/recurring',
        });
      } else if (days === 0) {
        dueToday.push({
          id: `lend-${lend.id}`,
          domain: 'finance',
          type: 'lend_today',
          severity: 'today',
          raw: lend,
          title: `Khoản cho vay: ${lend.name}`,
          subtitle: `Hẹn trả tiền vào hôm nay`,
          amount: left,
          days: 0,
          badge: 'Hẹn hôm nay',
          icon: 'handCoins',
          actionType: 'lend_collect',
          actionLabel: 'Thu nợ',
          targetUrl: '/finance/recurring',
        });
      } else if (days <= 3) {
        headsUp.push({
          id: `lend-${lend.id}`,
          domain: 'finance',
          type: 'lend_soon',
          severity: 'heads_up',
          raw: lend,
          title: `Khoản cho vay: ${lend.name}`,
          subtitle: `Hẹn trả ngày ${lend.due_on}`,
          amount: left,
          days,
          badge: `Còn ${days} ngày`,
          icon: 'handCoins',
          actionType: 'lend_collect',
          actionLabel: 'Xem chi tiết',
          targetUrl: '/finance/recurring',
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. TIẾT KIỆM ĐÁO HẠN (FINANCE DEPOSITS)
  // ═══════════════════════════════════════════════════════════════════════════
  for (const d of deposits) {
    if (d.closed_on || !d.matures_at) continue;

    const warn = maturityWarn(d.matures_at, today);
    if (warn && warn.warn && warn.days <= 14) {
      headsUp.push({
        id: `deposit-${d.id}`,
        domain: 'finance',
        type: 'deposit_maturing',
        severity: 'heads_up',
        raw: d,
        title: `Sổ tiết kiệm: ${d.name || d.bank || 'Tiền gửi'}`,
        subtitle: `Đáo hạn ngày ${d.matures_at} · Lãi suất ${d.rate}%`,
        amount: d.amount,
        days: warn.days,
        badge: warn.days === 0 ? 'Đáo hạn hôm nay' : `Đáo hạn sau ${warn.days} ngày`,
        icon: 'piggyBank',
        actionType: 'nav',
        actionLabel: 'Xem sổ',
        targetUrl: '/finance/recurring',
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. VƯỢT HẠN MỨC NGÂN SÁCH (FINANCE BUDGETS)
  // ═══════════════════════════════════════════════════════════════════════════
  if (budgets.length > 0) {
    const curMonth = currentMonthPeriod(today);
    const totals = periodTotals(transactions, curMonth);

    for (const b of budgets) {
      const spent = totals.byCategory[b.category_id] || 0;
      if (b.limit_amount > 0 && spent > b.limit_amount) {
        const excess = spent - b.limit_amount;
        headsUp.push({
          id: `budget-${b.id || b.category_id}`,
          domain: 'finance',
          type: 'budget_exceeded',
          severity: 'heads_up',
          raw: b,
          title: `Vượt ngân sách: ${b.category_id}`,
          subtitle: `Đã chi ${spent.toLocaleString('vi-VN')}₫ / Hạn mức ${b.limit_amount.toLocaleString('vi-VN')}₫`,
          amount: excess,
          days: null,
          badge: 'Vượt hạn mức',
          icon: 'warning',
          actionType: 'nav',
          actionLabel: 'Xem ngân sách',
          targetUrl: '/finance/overview',
        });
      }
    }
  }

  // Sắp xếp: việc nào gấp/quá hạn lâu hơn lên trước
  critical.sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
  dueToday.sort((a, b) => a.title.localeCompare(b.title));
  headsUp.sort((a, b) => (a.days ?? 999) - (b.days ?? 999));

  const criticalCount = critical.length;
  const dueTodayCount = dueToday.length;
  const headsUpCount = headsUp.length;
  const totalUrgent = criticalCount + dueTodayCount;

  return {
    critical,
    dueToday,
    headsUp,
    stats: {
      criticalCount,
      dueTodayCount,
      headsUpCount,
      totalUrgent,
      allClear: totalUrgent === 0,
    },
  };
}
