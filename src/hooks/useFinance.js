import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';
import { toDateStr } from '../utils/dateUtils';
import { deriveNecessity, blendedRate, loanSchedule, cardCycle } from '../utils/financeLogic';
import BASE_CATS from '../data/finance-categories.json';

/**
 * useFinance — hook DUY NHẤT sở hữu toàn bộ dữ liệu + action của module chi tiêu.
 *
 * Vì sao 1 hook cho 10 bảng thay vì 10 hook: gần như mọi màn cần nhiều bảng cùng
 * lúc (Tổng quan đọc transactions + cards + savings + budgets), và các hàm "thanh
 * toán" ghi chéo 2 bảng (tạo transaction + cập nhật quy tắc). Gom vào một nơi rẻ
 * hơn 9 file CRUD gần trùng + 1 context để share chúng.
 *
 * "Một bảng, lọc theo kỳ" (DESIGN §0.2): fetch TOÀN BỘ transactions 1 lần, mọi màn
 * lọc theo kỳ client-side bằng financeLogic — đổi kỳ không refetch.
 *
 * Auth-gated như module cũ: chưa đăng nhập → enabled=false, action no-op, page hiện
 * cổng đăng nhập. (Không guest in-memory — 10 bảng có FK chéo, guest phức tạp vô ích.)
 */
export function useFinance({ autoFetch = true } = {}) {
  const { user, isAuthenticated } = useAuth();
  const enabled = isSupabaseEnabled && isAuthenticated && !!user;
  const userId = user?.id;
  const today = toDateStr();

  const [transactions, setTransactions] = useState([]);
  const [bills, setBills] = useState([]);
  const [loans, setLoans] = useState([]);
  const [cards, setCards] = useState([]);
  const [goals, setGoals] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [incomeRules, setIncomeRules] = useState([]);
  const [shortcuts, setShortcuts] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [categoryOverrides, setCategoryOverrides] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const fetchedRef = useRef(false);

  // ── Fetch tất cả dữ liệu của module ───────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      const q = (table, order = 'created_at') =>
        supabase.from(table).select('*').eq('user_id', userId).order(order, { ascending: false });
      const [tx, bl, ln, cd, gl, dp, ir, sc, bg, co] = await Promise.all([
        supabase.from('finance_transactions').select('*').eq('user_id', userId)
          .order('occurred_at', { ascending: false }).order('created_at', { ascending: false }),
        q('finance_bills'), q('finance_loans'), q('finance_cards'),
        q('finance_saving_goals'), q('finance_deposits'),
        q('finance_income_rules'), supabase.from('finance_shortcuts').select('*')
          .eq('user_id', userId).order('sort_order', { ascending: true }),
        q('finance_budgets'),
        q('finance_category_overrides'),
      ]);
      const failed = [tx, bl, ln, cd, gl, dp, ir, sc, bg, co].find(result => result.error);
      if (failed) throw failed.error;
      setTransactions(tx.data || []);
      setBills(bl.data || []);
      setLoans(ln.data || []);
      setCards(cd.data || []);
      setGoals(gl.data || []);
      setDeposits(dp.data || []);
      setIncomeRules(ir.data || []);
      setShortcuts(sc.data || []);
      setBudgets(bg.data || []);
      setCategoryOverrides(co.data || []);
    } catch (err) {
      logger.warn('[useFinance] fetchAll error:', err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, userId]);

  const cats = useMemo(() => {
    const merge = (base) => base.map(group => {
        const override = categoryOverrides.find(o => o.category_id === group.key);
        return override ? { ...group, ...override, key: group.key,
          subs: Array.isArray(override.subs) ? override.subs : group.subs } : group;
      });
    const necessityByCat = { ...BASE_CATS.necessityByCat };
    for (const override of categoryOverrides) {
      if (override.necessity) necessityByCat[override.category_id] = override.necessity;
    }
    return { ...BASE_CATS, necessityByCat,
      expenseGroups: merge(BASE_CATS.expenseGroups),
      incomeGroups: merge(BASE_CATS.incomeGroups) };
  }, [categoryOverrides]);

  useEffect(() => {
    if (enabled && autoFetch && !fetchedRef.current) { fetchedRef.current = true; fetchAll(); }
    if (!enabled) { fetchedRef.current = false; }
  }, [enabled, autoFetch, fetchAll]);

  // ── Helper CRUD chung cho 8 bảng phụ (giảm lặp) ───────────────────────────
  // setList = setter React của bảng; on lỗi refetch cả module (đơn giản, an toàn).
  const insertRow = useCallback(async (table, setList, row) => {
    if (!enabled) return null;
    try {
      setError(null);
      const { data, error } = await supabase.from(table)
        .insert({ ...row, user_id: userId }).select().single();
      if (error) throw error;
      setList(prev => [data, ...prev]);
      return data;
    } catch (err) {
      logger.warn(`[useFinance] insert ${table}:`, err.message);
      setError(err.message);
      return null;
    }
  }, [enabled, userId]);

  const updateRow = useCallback(async (table, setList, id, updates) => {
    if (!enabled) return false;
    let backup;
    setList(prev => { backup = prev.find(r => r.id === id); return prev.map(r => r.id === id ? { ...r, ...updates } : r); });
    try {
      setError(null);
      const { error } = await supabase.from(table).update(updates).eq('id', id).eq('user_id', userId);
      if (error) throw error;
      return true;
    } catch (err) {
      logger.warn(`[useFinance] update ${table}:`, err.message);
      setError(err.message);
      if (backup) setList(prev => prev.map(r => r.id === id ? backup : r));
      return false;
    }
  }, [enabled, userId]);

  const deleteRow = useCallback(async (table, setList, id) => {
    if (!enabled) return false;
    let backup;
    setList(prev => { backup = prev.find(r => r.id === id); return prev.filter(r => r.id !== id); });
    try {
      setError(null);
      const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
      return true;
    } catch (err) {
      logger.warn(`[useFinance] delete ${table}:`, err.message);
      setError(err.message);
      if (backup) setList(prev => [backup, ...prev]);
      return false;
    }
  }, [enabled, userId]);

  // ── Transactions ──────────────────────────────────────────────────────────
  const addTransaction = useCallback(async (tx) => {
    if (!enabled) return null;
    const necessity = tx.type === 'expense'
      ? (tx.necessity || deriveNecessity(tx.category_id, tx.subcategory_id, cats))
      : null;
    const row = {
      user_id: userId,
      amount: tx.amount,
      occurred_at: tx.occurred_at || today,
      type: tx.type || 'expense',
      category_id: tx.category_id || null,
      subcategory_id: tx.subcategory_id || null,
      source_card_id: tx.source_card_id || null,
      excluded: tx.excluded || false,
      necessity,
      is_fixed: tx.is_fixed || false,
      note: tx.note || null,
      merchant: tx.merchant || null,
      items: tx.items || [],
      attachments: tx.attachments || [],
      shortcut_id: tx.shortcut_id || null,
      bill_id: tx.bill_id || null,
      bill_period: tx.bill_period || null,
      income_rule_id: tx.income_rule_id || null,
      income_period: tx.income_period || null,
      loan_id: tx.loan_id || null,
      loan_period: tx.loan_period || null,
      loan_part: tx.loan_part || null,
      card_id: tx.card_id || null,
      card_period: tx.card_period || null,
      saving_goal_id: tx.saving_goal_id || null,
      saving_dir: tx.saving_dir || null,
      inbox_item_id: tx.inbox_item_id || null,
      task_id: tx.task_id || null,
    };
    try {
      setError(null);
      const { data, error } = await supabase.from('finance_transactions').insert(row).select().single();
      if (error) throw error;
      setTransactions(prev => [data, ...prev]);
      return data;
    } catch (err) {
      logger.warn('[useFinance] addTransaction:', err.message);
      setError(err.message);
      return null;
    }
  }, [enabled, userId, today, cats]);

  const updateTransaction = useCallback((id, updates) =>
    updateRow('finance_transactions', setTransactions, id, updates), [updateRow]);
  const deleteTransaction = useCallback((id) =>
    deleteRow('finance_transactions', setTransactions, id), [deleteRow]);

  // ── CRUD 8 bảng phụ (thin wrappers) ───────────────────────────────────────
  const addBill    = useCallback((r) => insertRow('finance_bills', setBills, r), [insertRow]);
  const updateBill = useCallback((id, u) => updateRow('finance_bills', setBills, id, u), [updateRow]);
  const deleteBill = useCallback((id) => deleteRow('finance_bills', setBills, id), [deleteRow]);

  const addLoan    = useCallback((r) => insertRow('finance_loans', setLoans, r), [insertRow]);
  const updateLoan = useCallback((id, u) => updateRow('finance_loans', setLoans, id, u), [updateRow]);
  const deleteLoan = useCallback((id) => deleteRow('finance_loans', setLoans, id), [deleteRow]);

  const addCard    = useCallback((r) => insertRow('finance_cards', setCards, r), [insertRow]);
  const updateCard = useCallback((id, u) => updateRow('finance_cards', setCards, id, u), [updateRow]);
  const deleteCard = useCallback((id) => deleteRow('finance_cards', setCards, id), [deleteRow]);

  const addGoal    = useCallback((r) => insertRow('finance_saving_goals', setGoals, r), [insertRow]);
  const updateGoal = useCallback((id, u) => updateRow('finance_saving_goals', setGoals, id, u), [updateRow]);
  const deleteGoal = useCallback((id) => deleteRow('finance_saving_goals', setGoals, id), [deleteRow]);

  const addDeposit    = useCallback((r) => insertRow('finance_deposits', setDeposits, r), [insertRow]);
  const updateDeposit = useCallback((id, u) => updateRow('finance_deposits', setDeposits, id, u), [updateRow]);
  const deleteDeposit = useCallback((id) => deleteRow('finance_deposits', setDeposits, id), [deleteRow]);

  const addIncomeRule    = useCallback((r) => insertRow('finance_income_rules', setIncomeRules, r), [insertRow]);
  const updateIncomeRule = useCallback((id, u) => updateRow('finance_income_rules', setIncomeRules, id, u), [updateRow]);
  const deleteIncomeRule = useCallback((id) => deleteRow('finance_income_rules', setIncomeRules, id), [deleteRow]);

  const addShortcut    = useCallback((r) => insertRow('finance_shortcuts', setShortcuts, r), [insertRow]);
  const updateShortcut = useCallback((id, u) => updateRow('finance_shortcuts', setShortcuts, id, u), [updateRow]);
  const deleteShortcut = useCallback((id) => deleteRow('finance_shortcuts', setShortcuts, id), [deleteRow]);

  // Budget: upsert theo (user, category) — hạn mức đứng.
  const upsertBudget = useCallback(async (categoryId, limitAmount) => {
    if (!enabled) return false;
    try {
      const { data, error } = await supabase.from('finance_budgets')
        .upsert({ user_id: userId, category_id: categoryId, limit_amount: limitAmount },
          { onConflict: 'user_id,category_id' }).select().single();
      if (error) throw error;
      setBudgets(prev => {
        const i = prev.findIndex(b => b.category_id === categoryId);
        if (i === -1) return [data, ...prev];
        const next = [...prev]; next[i] = data; return next;
      });
      return true;
    } catch (err) { logger.warn('[useFinance] upsertBudget:', err.message); return false; }
  }, [enabled, userId]);

  const upsertCategoryOverride = useCallback(async (categoryId, kind, patch) => {
    if (!enabled) return null;
    try {
      const current = categoryOverrides.find(o => o.category_id === categoryId);
      const { data, error } = await supabase.from('finance_category_overrides')
        .upsert({ ...current, ...patch, user_id: userId, category_id: categoryId, kind },
          { onConflict: 'user_id,category_id' }).select().single();
      if (error) throw error;
      setCategoryOverrides(prev => {
        const exists = prev.some(o => o.category_id === categoryId);
        return exists ? prev.map(o => o.category_id === categoryId ? data : o) : [...prev, data];
      });
      return data;
    } catch (err) {
      logger.warn('[useFinance] upsertCategoryOverride:', err.message);
      return null;
    }
  }, [enabled, userId, categoryOverrides]);

  const callFinanceRpc = useCallback(async (name, params) => {
    if (!enabled) return null;
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc(name, params);
      if (rpcError) throw rpcError;
      await fetchAll();
      return data;
    } catch (err) {
      logger.warn(`[useFinance] ${name}:`, err.message);
      setError(err.message);
      return null;
    }
  }, [enabled, fetchAll]);

  // ── Thanh toán nguyên khối tại DB (transaction + trạng thái quy tắc) ───────
  const payBill = useCallback(async (bill, { amount, occurredAt, sourceCardId, taskId, period } = {}) => {
    if (!enabled) return null;
    const occ = occurredAt || today;
    return callFinanceRpc('finance_pay_bill', {
      p_bill_id: bill.id,
      p_amount: amount ?? bill.amount ?? null,
      p_occurred_at: occ,
      p_source_card_id: sourceCardId || null,
      p_task_id: taskId || null,
      p_necessity: deriveNecessity(bill.category_id, bill.subcategory_id, cats),
      p_bill_period: period || today.slice(0, 7),
    });
  }, [enabled, today, cats, callFinanceRpc]);

  const skipBillPeriod = useCallback((billId, period = today.slice(0, 7)) =>
    callFinanceRpc('finance_skip_bill_period', {
      p_bill_id: billId,
      p_period: period,
    }), [today, callFinanceRpc]);

  const receiveIncome = useCallback(async (rule, { amount, occurredAt, taskId, period } = {}) => {
    if (!enabled) return null;
    const occ = occurredAt || today;
    return callFinanceRpc('finance_receive_income', {
      p_rule_id: rule.id,
      p_amount: amount ?? rule.amount ?? null,
      p_occurred_at: occ,
      p_task_id: taskId || null,
      p_income_period: period || today.slice(0, 7),
    });
  }, [enabled, today, callFinanceRpc]);

  // Lãi là chi tiêu; gốc được ghi excluded. DB chặn ghi trùng từng phần trong kỳ.
  const payLoanInterest = useCallback(async (loan, { amount, occurredAt, taskId, period } = {}) => {
    if (!enabled) return null;
    return callFinanceRpc('finance_record_loan_payment', {
      p_loan_id: loan.id,
      p_interest: amount || 0,
      p_principal: 0,
      p_occurred_at: occurredAt || today,
      p_task_id: taskId || null,
      p_loan_period: period || today.slice(0, 7),
    });
  }, [enabled, today, callFinanceRpc]);

  const payLoanPrincipal = useCallback(async (loan, { amount, occurredAt, taskId, period } = {}) => {
    if (!enabled) return null;
    return callFinanceRpc('finance_record_loan_payment', {
      p_loan_id: loan.id,
      p_interest: 0,
      p_principal: amount || 0,
      p_occurred_at: occurredAt || today,
      p_task_id: taskId || null,
      p_loan_period: period || today.slice(0, 7),
    });
  }, [enabled, today, callFinanceRpc]);

  // Trả góp đều phải tách thành hai dòng: lãi là chi, gốc đứng ngoài tổng chi.
  const payLoanInstallment = useCallback(async (loan, { amount, occurredAt, taskId, period } = {}) => {
    if (!enabled) return null;
    const schedule = loanSchedule(loan);
    const paid = amount || schedule.monthlyPayment;
    const interest = Math.min(paid, schedule.interestPart);
    const principal = Math.max(0, paid - interest);
    const occ = occurredAt || today;
    return callFinanceRpc('finance_record_loan_payment', {
      p_loan_id: loan.id,
      p_interest: interest,
      p_principal: principal,
      p_occurred_at: occ,
      p_task_id: taskId || null,
      p_loan_period: period || today.slice(0, 7),
    });
  }, [enabled, today, callFinanceRpc]);

  // Trả sao kê thẻ: excluded (đã tính vào hôm quẹt), chỉ để lịch sử có dấu vết.
  const payCardStatement = useCallback(async (card, { amount, occurredAt, taskId, period } = {}) => {
    if (!enabled) return null;
    const occ = occurredAt || today;
    return callFinanceRpc('finance_pay_card_statement', {
      p_card_id: card.id,
      p_amount: amount || null,
      p_occurred_at: occ,
      p_card_period: period || cardCycle(card, today).statement.slice(0, 7),
      p_task_id: taskId || null,
    });
  }, [enabled, today, callFinanceRpc]);

  const requestSavingWithdrawal = useCallback((goalId, depositId, amount) =>
    callFinanceRpc('finance_request_saving_withdrawal', {
      p_goal_id: goalId,
      p_deposit_id: depositId,
      p_amount: amount,
    }), [callFinanceRpc]);

  const moveSaving = useCallback(async (goal, deposit, dir, { amount, occurredAt, note, taskId } = {}) => {
    if (!enabled) return null;
    if (!deposit || !amount || (dir === 'out' && amount > deposit.amount)) return null;
    return callFinanceRpc('finance_move_saving', {
      p_goal_id: goal.id,
      p_deposit_id: deposit.id,
      p_direction: dir,
      p_amount: amount,
      p_occurred_at: occurredAt || today,
      p_note: note || null,
      p_task_id: taskId || null,
    });
  }, [enabled, today, callFinanceRpc]);

  return {
    enabled, isLoading, error, today, cats, categoryOverrides,
    transactions, bills, loans, cards, goals, deposits, incomeRules, shortcuts, budgets,
    blendedRate: blendedRate(deposits),
    fetchAll,
    addTransaction, updateTransaction, deleteTransaction,
    addBill, updateBill, deleteBill,
    addLoan, updateLoan, deleteLoan,
    addCard, updateCard, deleteCard,
    addGoal, updateGoal, deleteGoal,
    addDeposit, updateDeposit, deleteDeposit,
    addIncomeRule, updateIncomeRule, deleteIncomeRule,
    addShortcut, updateShortcut, deleteShortcut,
    upsertBudget,
    upsertCategoryOverride,
    payBill, skipBillPeriod, receiveIncome, payLoanInterest, payLoanPrincipal, payLoanInstallment,
    payCardStatement, requestSavingWithdrawal, moveSaving,
  };
}
