import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * useTeamCheck — manages the "tuần 2 check" flow
 *
 * Week rules:
 *   - Week 1 or 3: user can self-check; teammates can also optionally check
 *   - Week 2: checkbox LOCKED; needs ≥1 teammate check to count
 *
 * team_check_logs: UNIQUE(team_id, checked_id, date) — one official check per person per day
 */
export function useTeamCheck(teamId) {
  const { user } = useAuth();

  const [checksToday,   setChecksToday]   = useState([]); // all check_logs rows for today
  const [submitting,    setSubmitting]    = useState(false);
  const [submitError,   setSubmitError]   = useState('');

  const todayKey = new Date().toISOString().split('T')[0];

  // ── Load today's checks ──
  const loadChecks = useCallback(async () => {
    if (!isSupabaseEnabled || !teamId) return;

    const { data } = await supabase
      .from('team_check_logs')
      .select('id, checker_id, checked_id, status, reason, created_at')
      .eq('team_id', teamId)
      .eq('date', todayKey);

    setChecksToday(data || []);
  }, [teamId, todayKey]);

  useEffect(() => {
    loadChecks();
  }, [loadChecks]);

  // ── Realtime for today's checks ──
  useEffect(() => {
    if (!isSupabaseEnabled || !teamId) return;

    const channel = supabase
      .channel(`team-checks-${teamId}-${todayKey}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'team_check_logs',
        filter: `team_id=eq.${teamId}`,
      }, () => loadChecks())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [teamId, todayKey, loadChecks]);

  /**
   * Submit a check for a teammate
   * @param {string} checkedId - the person being checked
   * @param {boolean} status - true = done, false = fail
   * @param {string} reason - required when status = false
   */
  const submitCheck = useCallback(async (checkedId, status, reason = '') => {
    if (!isSupabaseEnabled || !user || !teamId) return;
    if (!status && !reason.trim()) {
      setSubmitError('Vui lòng nhập lý do khi đánh fail');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    const { error } = await supabase.from('team_check_logs').upsert({
      team_id:    teamId,
      checker_id: user.id,
      checked_id: checkedId,
      date:       todayKey,
      status,
      reason:     reason.trim() || null,
    }, { onConflict: 'team_id,checked_id,date' });

    if (error) {
      setSubmitError(error.message);
    } else {
      await loadChecks();
    }

    setSubmitting(false);
  }, [user, teamId, todayKey, loadChecks]);

  /**
   * Check if a specific user has been checked today
   */
  const getCheckForUser = useCallback((checkedId) => {
    return checksToday.find(c => c.checked_id === checkedId) || null;
  }, [checksToday]);

  /**
   * Can the current user check a specific member?
   * - Cannot check yourself
   * - Cannot check someone twice (already exists)
   */
  const canCheck = useCallback((targetMember) => {
    if (!targetMember || targetMember.id === user?.id) return false;
    const existing = getCheckForUser(targetMember.id);
    return !existing;
  }, [user?.id, getCheckForUser]);

  /**
   * Does a user need a team check (week 2)?
   */
  const needsTeamCheck = useCallback((member) => {
    return member?.currentWeek === 2;
  }, []);

  /**
   * Has a user's day been validated?
   * - Week 1/3: self-check via progress table (handled in useHabitStore)
   * - Week 2: needs a check_log with status=true
   */
  const isDayValidated = useCallback((member) => {
    if (!member) return false;
    const todayDone = !!member.progress?.[todayKey];
    if (member.currentWeek !== 2) return todayDone;
    // Week 2: must have at least 1 team check with status=true
    const check = getCheckForUser(member.id);
    return !!check?.status;
  }, [todayKey, getCheckForUser]);

  return {
    checksToday,
    submitting,
    submitError,
    setSubmitError,
    submitCheck,
    getCheckForUser,
    canCheck,
    needsTeamCheck,
    isDayValidated,
    reload: loadChecks,
  };
}
