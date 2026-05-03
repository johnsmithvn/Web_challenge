import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

let _supabase = null;
async function getSb() {
  if (!_supabase) {
    const mod = await import('../lib/supabase');
    _supabase = mod.supabase;
  }
  return _supabase;
}

/**
 * useIntentions — Incubator (Trạm Ấp Trứng) CRUD.
 *
 * Manages someday-maybe items with decision friction:
 * - deferIntention: requires reason (prevents impulsive postponing)
 * - executeIntention: converts to Task or Expense
 * - abandonIntention: mark as abandoned with reason
 */
export function useIntentions() {
  const { user } = useAuth();
  const isAuth = !!user;
  const userId = user?.id;

  const [intentions, setIntentions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRef = useRef(false);

  // ── Fetch active intentions ───────────────────────────────
  const fetchIntentions = useCallback(async (status = 'incubating') => {
    if (!isAuth || !userId) return;
    setIsLoading(true);
    try {
      const sb = await getSb();
      if (!sb) return;

      const { data, error } = await sb
        .from('intentions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useIntentions] fetch error:', error.message);
      } else {
        setIntentions(data || []);
      }
    } catch (err) {
      console.error('[useIntentions] fetch exception:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuth, userId]);

  useEffect(() => {
    if (isAuth && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchIntentions();
    }
    if (!isAuth) {
      fetchedRef.current = false;
      setIntentions([]);
    }
  }, [isAuth, fetchIntentions]);

  // ── Add intention ─────────────────────────────────────────
  const addIntention = useCallback(async ({ title, originalReason, estimatedCost, estimatedTime }) => {
    if (!isAuth || !userId || !title?.trim()) return null;
    try {
      const sb = await getSb();
      if (!sb) return null;

      const { data, error } = await sb
        .from('intentions')
        .insert({
          user_id: userId,
          title: title.trim(),
          original_reason: originalReason || null,
          estimated_cost: estimatedCost || null,
          estimated_time: estimatedTime || null,
          status: 'incubating',
        })
        .select()
        .single();

      if (error) {
        console.error('[useIntentions] add error:', error.message);
        return null;
      }

      // Log creation
      await sb.from('intention_logs').insert({
        intention_id: data.id,
        action: 'created',
        reason_note: originalReason || null,
      });

      setIntentions(prev => [data, ...prev]);
      return data;
    } catch (err) {
      console.error('[useIntentions] add exception:', err);
      return null;
    }
  }, [isAuth, userId]);

  // ── Defer intention (REQUIRES reason — friction UX) ───────
  const deferIntention = useCallback(async (id, { reason, scheduledFor }) => {
    if (!isAuth || !reason?.trim()) return false;
    try {
      const sb = await getSb();
      if (!sb) return false;

      // Update review_date
      const updates = { updated_at: new Date().toISOString() };
      if (scheduledFor) updates.review_date = scheduledFor;

      const { error: updateErr } = await sb
        .from('intentions')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId);

      if (updateErr) {
        console.error('[useIntentions] defer update error:', updateErr.message);
        return false;
      }

      // Log the deferral
      const { error: logErr } = await sb.from('intention_logs').insert({
        intention_id: id,
        action: 'deferred',
        reason_note: reason.trim(),
        scheduled_for: scheduledFor || null,
      });

      if (logErr) console.error('[useIntentions] defer log error:', logErr.message);

      // Update local state
      setIntentions(prev => prev.map(i =>
        i.id === id ? { ...i, ...updates, review_date: scheduledFor || i.review_date } : i
      ));
      return true;
    } catch (err) {
      console.error('[useIntentions] defer exception:', err);
      return false;
    }
  }, [isAuth, userId]);

  // ── Execute intention (multi-output: Task + Expense + Habit) ────
  const executeIntention = useCallback(async (id, { convertedTypes, convertedIds }) => {
    if (!isAuth) return false;
    try {
      const sb = await getSb();
      if (!sb) return false;

      const { error: updateErr } = await sb
        .from('intentions')
        .update({
          status: 'executed',
          converted_to: convertedTypes?.length ? convertedTypes : null,
          converted_ids: convertedIds && Object.keys(convertedIds).length ? convertedIds : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', userId);

      if (updateErr) {
        console.error('[useIntentions] execute error:', updateErr.message);
        return false;
      }

      await sb.from('intention_logs').insert({
        intention_id: id,
        action: 'executed',
        reason_note: convertedTypes?.length ? `Converted to ${convertedTypes.join(', ')}` : null,
      });

      setIntentions(prev => prev.filter(i => i.id !== id));
      return true;
    } catch (err) {
      console.error('[useIntentions] execute exception:', err);
      return false;
    }
  }, [isAuth, userId]);

  // ── Abandon intention ─────────────────────────────────────
  const abandonIntention = useCallback(async (id, reason) => {
    if (!isAuth) return false;
    try {
      const sb = await getSb();
      if (!sb) return false;

      const { error: updateErr } = await sb
        .from('intentions')
        .update({ status: 'abandoned', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId);

      if (updateErr) {
        console.error('[useIntentions] abandon error:', updateErr.message);
        return false;
      }

      await sb.from('intention_logs').insert({
        intention_id: id,
        action: 'abandoned',
        reason_note: reason || null,
      });

      setIntentions(prev => prev.filter(i => i.id !== id));
      return true;
    } catch (err) {
      console.error('[useIntentions] abandon exception:', err);
      return false;
    }
  }, [isAuth, userId]);

  // ── Get logs for an intention ─────────────────────────────
  const getLogs = useCallback(async (intentionId) => {
    if (!isAuth) return [];
    try {
      const sb = await getSb();
      if (!sb) return [];

      const { data, error } = await sb
        .from('intention_logs')
        .select('*')
        .eq('intention_id', intentionId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[useIntentions] getLogs error:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.error('[useIntentions] getLogs exception:', err);
      return [];
    }
  }, [isAuth]);

  // Derived counts — use local date (NOT toISOString which is UTC)
  const _today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  const reviewDueCount = intentions.filter(i => {
    if (!i.review_date) return false;
    return i.review_date <= _today;
  }).length;

  // ── Update intention (edit title / params) ───────────────
  const updateIntention = useCallback(async (id, { title, originalReason, estimatedCost, estimatedTime }) => {
    if (!isAuth || !userId || !title?.trim()) return false;
    try {
      const sb = await getSb();
      if (!sb) return false;

      const updates = {
        title: title.trim(),
        original_reason: originalReason?.trim() || null,
        estimated_cost: estimatedCost ? parseInt(estimatedCost, 10) : null,
        estimated_time: estimatedTime ? parseInt(estimatedTime, 10) : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await sb
        .from('intentions')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('[useIntentions] update error:', error.message);
        return false;
      }

      // Log as reviewed
      await sb.from('intention_logs').insert({
        intention_id: id,
        action: 'reviewed',
        reason_note: 'Chỉnh sửa thông tin dự định',
      });

      // Optimistic local state
      setIntentions(prev => prev.map(i =>
        i.id === id ? { ...i, ...updates } : i
      ));
      return true;
    } catch (err) {
      console.error('[useIntentions] update exception:', err);
      return false;
    }
  }, [isAuth, userId]);

  // ── Fetch abandoned intentions (for archive view) ─────────
  const fetchAbandoned = useCallback(async () => {
    if (!isAuth || !userId) return [];
    try {
      const sb = await getSb();
      if (!sb) return [];

      const { data, error } = await sb
        .from('intentions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'abandoned')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('[useIntentions] fetchAbandoned error:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.error('[useIntentions] fetchAbandoned exception:', err);
      return [];
    }
  }, [isAuth, userId]);

  // ── Hard-delete an intention (logs → intention, FK safe) ──
  const deleteIntention = useCallback(async (id) => {
    if (!isAuth || !userId) return false;
    try {
      const sb = await getSb();
      if (!sb) return false;

      // Delete logs first to satisfy FK constraint
      await sb.from('intention_logs').delete().eq('intention_id', id);

      const { error } = await sb
        .from('intentions')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('[useIntentions] delete error:', error.message);
        return false;
      }

      // Remove from active list if still there
      setIntentions(prev => prev.filter(i => i.id !== id));
      return true;
    } catch (err) {
      console.error('[useIntentions] delete exception:', err);
      return false;
    }
  }, [isAuth, userId]);

  return {
    intentions,
    isLoading,
    reviewDueCount,
    fetchIntentions,
    addIntention,
    updateIntention,
    deferIntention,
    executeIntention,
    abandonIntention,
    deleteIntention,
    fetchAbandoned,
    getLogs,
  };

}
