import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * useExpenses — CRUD for the `expenses` table.
 * Chi tiêu cá nhân (VNĐ, chi tiêu only — no income).
 */
export function useExpenses() {
  const { user, isAuthenticated } = useAuth();
  const enabled = isSupabaseEnabled && isAuthenticated && !!user;

  const [expenses, setExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Fetch expenses for a date range ─────────────────────────
  const fetchExpenses = useCallback(async (startDate, endDate) => {
    if (!enabled) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (err) {
      console.warn('[useExpenses] fetch error:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, user]);

  // ── Add expense ─────────────────────────────────────────────
  const addExpense = useCallback(async (expense) => {
    if (!enabled) return null;

    const newExpense = {
      user_id:  user.id,
      amount:   expense.amount,
      category: expense.category,
      note:     expense.note || null,
      date:     expense.date || new Date().toISOString().split('T')[0],
    };

    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert(newExpense)
        .select()
        .single();

      if (error) throw error;
      setExpenses(prev => [data, ...prev]);
      return data;
    } catch (err) {
      console.warn('[useExpenses] add error:', err.message);
      return null;
    }
  }, [enabled, user]);

  // ── Delete expense ──────────────────────────────────────────
  const deleteExpense = useCallback(async (id) => {
    if (!enabled) return false;

    setExpenses(prev => prev.filter(e => e.id !== id));

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('[useExpenses] delete error:', err.message);
      return false;
    }
  }, [enabled, user]);

  // ── Get total for a date range ──────────────────────────────
  const getTotal = useCallback((list = expenses) => {
    return list.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses]);

  // ── Get by category ─────────────────────────────────────────
  const getByCategory = useCallback((list = expenses) => {
    const grouped = {};
    list.forEach(e => {
      if (!grouped[e.category]) grouped[e.category] = 0;
      grouped[e.category] += e.amount;
    });
    return Object.entries(grouped)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  return {
    expenses,       // current fetched expenses
    isLoading,
    fetchExpenses,  // (startDate, endDate) => Promise<void>
    addExpense,     // (expense) => Promise<row|null>
    deleteExpense,  // (id) => Promise<boolean>
    getTotal,       // (list?) => number
    getByCategory,  // (list?) => [{category, total}]
    enabled,
  };
}
