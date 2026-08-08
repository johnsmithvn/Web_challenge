import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';
import { toDateStr } from '../utils/dateUtils';
import { deriveNecessity, blendedRate } from '../utils/financeLogic';
import CATS from '../data/finance-categories.json';

/**
 * useFinance — hook DUY NHẤT sở hữu toàn bộ dữ liệu + action của module chi tiêu.
 *
 * Vì sao 1 hook cho 9 bảng thay vì 9 hook: gần như mọi màn cần nhiều bảng cùng
 * lúc (Tổng quan đọc transactions + cards + savings + budgets), và các hàm "thanh
 * toán" ghi chéo 2 bảng (tạo transaction + cập nhật quy tắc). Gom vào một nơi rẻ
 * hơn 9 file CRUD gần trùng + 1 context để share chúng.
 *
 * "Một bảng, lọc theo kỳ" (DESIGN §0.2): fetch TOÀN BỘ transactions 1 lần, mọi màn
 * lọc theo kỳ client-side bằng financeLogic — đổi kỳ không refetch.
 *
 * Auth-gated như module cũ: chưa đăng nhập → enabled=false, action no-op, page hiện
 * cổng đăng nhập. (Không guest in-memory — 9 bảng có FK chéo, guest phức tạp vô ích.)
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
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRef = useRef(false);

  // ── Fetch tất cả (transactions + 8 bảng phụ) ──────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    try {
      const q = (table, order = 'created_at') =>
        supabase.from(table).select('*').eq('user_id', userId).order(order, { ascending: false });
      const [tx, bl, ln, cd, gl, dp, ir, sc, bg] = await Promise.all([
        supabase.from('finance_transactions').select('*').eq('user_id', userId)
          .order('occurred_at', { ascending: false }).order('created_at', { ascending: false }),
        q('finance_bills'), q('finance_loans'), q('finance_cards'),
        q('finance_saving_goals'), q('finance_deposits'),
        q('finance_income_rules'), supabase.from('finance_shortcuts').select('*')
          .eq('user_id', userId).order('sort_order', { ascending: true }),
        q('finance_budgets'),
      ]);
      if (tx.error) throw tx.error;
      setTransactions(tx.data || []);
      setBills(bl.data || []);
      setLoans(ln.data || []);
      setCards(cd.data || []);
      setGoals(gl.data || []);
      setDeposits(dp.data || []);
      setIncomeRules(ir.data || []);
      setShortcuts(sc.data || []);
      setBudgets(bg.data || []);
    } catch (err) {
      logger.warn('[useFinance] fetchAll error:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, userId]);

  useEffect(() => {
    if (enabled && autoFetch && !fetchedRef.current) { fetchedRef.current = true; fetchAll(); }
    if (!enabled) { fetchedRef.current = false; }
  }, [enabled, autoFetch, fetchAll]);

  // ── Helper CRUD chung cho 8 bảng phụ (giảm lặp) ───────────────────────────
  // setList = setter React của bảng; on lỗi refetch cả module (đơn giản, an toàn).
  const insertRow = useCallback(async (table, setList, row) => {
    if (!enabled) return null;
    try {
      const { data, error } = await supabase.from(table)
        .insert({ ...row, user_id: userId }).select().single();
      if (error) throw error;
      setList(prev => [data, ...prev]);
      return data;
    } catch (err) { logger.warn(`[useFinance] insert ${table}:`, err.message); return null; }
  }, [enabled, userId]);

  const updateRow = useCallback(async (table, setList, id, updates) => {
    if (!enabled) return false;
    let backup;
    setList(prev => { backup = prev.find(r => r.id === id); return prev.map(r => r.id === id ? { ...r, ...updates } : r); });
    try {
      const { error } = await supabase.from(table).update(updates).eq('id', id).eq('user_id', userId);
      if (error) throw error;
      return true;
    } catch (err) {
      logger.warn(`[useFinance] update ${table}:`, err.message);
      if (backup) setList(prev => prev.map(r => r.id === id ? backup : r));
      return false;
    }
  }, [enabled, userId]);

  const deleteRow = useCallback(async (table, setList, id) => {
    if (!enabled) return false;
    let backup;
    setList(prev => { backup = prev.find(r => r.id === id); return prev.filter(r => r.id !== id); });
    try {
      const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
      return true;
    } catch (err) {
      logger.warn(`[useFinance] delete ${table}:`, err.message);
      if (backup) setList(prev => [backup, ...prev]);
      return false;
    }
  }, [enabled, userId]);

  // ── Transactions ──────────────────────────────────────────────────────────
  const addTransaction = useCallback(async (tx) => {
    if (!enabled) return null;
    const necessity = tx.type === 'expense'
      ? (tx.necessity || deriveNecessity(tx.category_id, tx.subcategory_id, CATS))
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
      shortcut_id: tx.shortcut_id || null,
      bill_id: tx.bill_id || null,
      bill_period: tx.bill_period || null,
      loan_id: tx.loan_id || null,
      card_id: tx.card_id || null,
      saving_goal_id: tx.saving_goal_id || null,
      saving_dir: tx.saving_dir || null,
      inbox_item_id: tx.inbox_item_id || null,
      task_id: tx.task_id || null,
    };
    try {
      const { data, error } = await supabase.from('finance_transactions').insert(row).select().single();
      if (error) throw error;
      setTransactions(prev => [data, ...prev]);
      return data;
    } catch (err) { logger.warn('[useFinance] addTransaction:', err.message); return null; }
  }, [enabled, userId, today]);

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

  // ── Thanh toán = ghi 1 transaction + cập nhật quy tắc (nguyên lý #3) ───────
  const payBill = useCallback(async (bill, { amount, occurredAt } = {}) => {
    if (!enabled) return null;
    const occ = occurredAt || today;
    const tx = await addTransaction({
      type: 'expense', amount: amount ?? bill.amount, occurred_at: occ,
      category_id: bill.category_id, subcategory_id: bill.subcategory_id,
      is_fixed: true, bill_id: bill.id, bill_period: occ.slice(0, 7),   // 'YYYY-MM'
      note: bill.name,
    });
    if (!tx) return null;                       // unique(bill_id,bill_period) chặn trả trùng kỳ
    const done = (bill.term_done || 0) + 1;
    const patch = { term_done: done };
    if (bill.term_total && done >= bill.term_total) patch.finished_at = new Date().toISOString();
    await updateBill(bill.id, patch);
    return tx;
  }, [enabled, today, addTransaction, updateBill]);

  const receiveIncome = useCallback(async (rule, { amount, occurredAt } = {}) => {
    if (!enabled) return null;
    const occ = occurredAt || today;
    const period = occ.slice(0, 7);
    if ((rule.received_periods || []).includes(period)) return null;   // đã nhận kỳ này
    const tx = await addTransaction({ type: 'income', amount: amount ?? rule.amount, occurred_at: occ, note: rule.name });
    if (!tx) return null;
    await updateIncomeRule(rule.id, { received_periods: [...(rule.received_periods || []), period] });
    return tx;
  }, [enabled, today, addTransaction, updateIncomeRule]);

  // Lãi = chi tiêu (is_fixed). Gốc = excluded (ngoài tổng chi), done++.
  const payLoanInterest = useCallback(async (loan, { amount, occurredAt } = {}) => {
    if (!enabled) return null;
    return addTransaction({ type: 'expense', amount, occurred_at: occurredAt || today,
      category_id: 'finance', subcategory_id: 'finance.interest', is_fixed: true,
      loan_id: loan.id, note: `Lãi ${loan.name}` });
  }, [enabled, today, addTransaction]);

  const payLoanPrincipal = useCallback(async (loan, { amount, occurredAt } = {}) => {
    if (!enabled) return null;
    const tx = await addTransaction({ type: 'expense', amount, occurred_at: occurredAt || today,
      excluded: true, loan_id: loan.id, note: `Trả gốc ${loan.name}` });
    if (tx) await updateLoan(loan.id, { done: (loan.done || 0) + 1 });
    return tx;
  }, [enabled, today, addTransaction, updateLoan]);

  // Trả sao kê thẻ: excluded (đã tính vào hôm quẹt), chỉ để lịch sử có dấu vết.
  const payCardStatement = useCallback(async (card, { amount, occurredAt } = {}) => {
    if (!enabled) return null;
    return addTransaction({ type: 'expense', amount, occurred_at: occurredAt || today,
      excluded: true, card_id: card.id, note: `Trả sao kê ${card.name}` });
  }, [enabled, today, addTransaction]);

  const moveSaving = useCallback(async (goal, dir, { amount, occurredAt } = {}) => {
    if (!enabled) return null;
    return addTransaction({ type: 'saving', amount, occurred_at: occurredAt || today,
      saving_goal_id: goal.id, saving_dir: dir, note: `${dir === 'out' ? 'Rút' : 'Gửi'} ${goal.name}` });
  }, [enabled, today, addTransaction]);

  return {
    enabled, isLoading, today, cats: CATS,
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
    payBill, receiveIncome, payLoanInterest, payLoanPrincipal, payCardStatement, moveSaving,
  };
}
