import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * useTeamRules — manage team_rules + team_rule_agreements
 *
 * Rule lifecycle:
 *   proposed → pending (not all agreed) → active (all agreed) | rejected (any declined)
 */
export function useTeamRules(teamId, memberIds = []) {
  const { user } = useAuth();

  const [rules,      setRules]      = useState([]);
  const [agreements, setAgreements] = useState([]); // all agreements for these rules
  const [loading,    setLoading]    = useState(false);
  const [proposing,  setProposing]  = useState(false);
  const [propError,  setPropError]  = useState('');

  const loadRules = useCallback(async () => {
    if (!isSupabaseEnabled || !teamId) return;
    setLoading(true);

    const { data: rulesData } = await supabase
      .from('team_rules')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    const ruleIds = rulesData?.map(r => r.id) || [];

    let agreementsData = [];
    if (ruleIds.length) {
      const { data } = await supabase
        .from('team_rule_agreements')
        .select('*')
        .in('rule_id', ruleIds);
      agreementsData = data || [];
    }

    setRules(rulesData || []);
    setAgreements(agreementsData);
    setLoading(false);
  }, [teamId]);

  useEffect(() => { loadRules(); }, [loadRules]);

  // ── Realtime ──
  useEffect(() => {
    if (!isSupabaseEnabled || !teamId) return;

    const channel = supabase
      .channel(`team-rules-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_rules', filter: `team_id=eq.${teamId}` }, loadRules)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_rule_agreements' }, loadRules)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [teamId, loadRules]);

  // ── Propose a new rule ──
  const proposeRule = useCallback(async ({ ruleType, trigger, description, amountVnd }) => {
    if (!isSupabaseEnabled || !user || !teamId) return;
    if (!description?.trim()) { setPropError('Vui lòng nhập mô tả rule'); return; }

    setProposing(true); setPropError('');

    const { data: newRule, error } = await supabase.from('team_rules').insert({
      team_id:     teamId,
      rule_type:   ruleType,  // 'reward' | 'punishment'
      trigger:     trigger,   // 'miss_day' | 'streak_7' | 'complete_week2' | 'custom'
      description: description.trim(),
      amount_vnd:  amountVnd || null,
      proposed_by: user.id,
    }).select().single();

    if (error) { setPropError(error.message); setProposing(false); return; }

    // Auto-agree for proposer
    await supabase.from('team_rule_agreements').upsert({
      rule_id: newRule.id,
      user_id: user.id,
      agreed:  true,
      agreed_at: new Date().toISOString(),
    }, { onConflict: 'rule_id,user_id' });

    await loadRules();
    setProposing(false);
  }, [user, teamId, loadRules]);

  // ── Agree/Disagree ──
  const respondToRule = useCallback(async (ruleId, agreed) => {
    if (!isSupabaseEnabled || !user) return;

    await supabase.from('team_rule_agreements').upsert({
      rule_id: ruleId,
      user_id: user.id,
      agreed,
      agreed_at: new Date().toISOString(),
    }, { onConflict: 'rule_id,user_id' });

    // Compute new status
    const ruleAgreements = agreements.filter(a => a.rule_id === ruleId);
    const allAgreed   = memberIds.length > 0 && ruleAgreements.filter(a => a.agreed).length + (agreed ? 1 : 0) >= memberIds.length;
    const anyRejected = !agreed || ruleAgreements.some(a => !a.agreed);

    if (allAgreed) {
      await supabase.from('team_rules').update({ status: 'active' }).eq('id', ruleId);
    } else if (anyRejected && !agreed) {
      await supabase.from('team_rules').update({ status: 'rejected' }).eq('id', ruleId);
    }

    await loadRules();
  }, [user, teamId, agreements, memberIds, loadRules]);

  // ── Helpers ──
  const getAgreementsForRule = useCallback((ruleId) => {
    return agreements.filter(a => a.rule_id === ruleId);
  }, [agreements]);

  const myAgreementForRule = useCallback((ruleId) => {
    return agreements.find(a => a.rule_id === ruleId && a.user_id === user?.id) || null;
  }, [agreements, user?.id]);

  const getStatus = useCallback((rule) => {
    const ruleAgreements = getAgreementsForRule(rule.id);
    if (rule.status === 'active')   return 'active';
    if (rule.status === 'rejected') return 'rejected';
    const agreedCount = ruleAgreements.filter(a => a.agreed).length;
    return { pending: true, agreedCount, total: memberIds.length };
  }, [getAgreementsForRule, memberIds]);

  return {
    rules, agreements, loading,
    proposing, propError, setPropError,
    proposeRule,
    respondToRule,
    getAgreementsForRule,
    myAgreementForRule,
    getStatus,
    reload: loadRules,
  };
}
