import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// ─── Constants ───────────────────────────────────────────────
function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function getCurrentWeek(startedAt) {
  if (!startedAt) return 1;
  const start = new Date(startedAt);
  const today = new Date();
  const diffDays = Math.floor((today - start) / 86400000) + 1;
  return Math.min(3, Math.max(1, Math.ceil(diffDays / 7)));
}

// ─── Hook ────────────────────────────────────────────────────
export function useTeam() {
  const { user, profile, isAuthenticated } = useAuth();

  const [team,        setTeam]        = useState(null);   // teams row
  const [members,     setMembers]     = useState([]);     // [{profile, program, progress, streak}]
  const [myProgram,   setMyProgram]   = useState(null);   // user_programs row for current user
  const [loading,     setLoading]     = useState(false);
  const [joinError,   setJoinError]   = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [inviteCode,  setInviteCode]  = useState('');
  const [copied,      setCopied]      = useState(false);

  // ── Load team on auth ──
  useEffect(() => {
    if (!isSupabaseEnabled || !isAuthenticated || !user) return;
    loadTeam();
  }, [isAuthenticated, user?.id]);

  // ── Main loader ──
  const loadTeam = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Find team via team_members junction
      const { data: membership } = await supabase
        .from('team_members')
        .select('team_id, role, week_sync')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership) { setTeam(null); setMembers([]); setLoading(false); return; }

      // 2. Fetch team row
      const { data: teamRow } = await supabase
        .from('teams')
        .select('*')
        .eq('id', membership.team_id)
        .eq('status', 'active')
        .maybeSingle();

      if (!teamRow) { setTeam(null); setMembers([]); setLoading(false); return; }
      setTeam(teamRow);

      // 3. Fetch all members of this team
      const { data: allMemberships } = await supabase
        .from('team_members')
        .select('user_id, role, joined_at')
        .eq('team_id', teamRow.id);

      if (!allMemberships?.length) { setLoading(false); return; }

      const memberIds = allMemberships.map(m => m.user_id);

      // 4. Batch fetch: profiles, programs, streaks, last-7-days progress
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const fromDate = sevenDaysAgo.toISOString().split('T')[0];

      const [
        { data: profiles },
        { data: programs },
        { data: streakRows },
        { data: progressRows },
      ] = await Promise.all([
        supabase.from('profiles').select('*').in('id', memberIds),
        supabase.from('user_programs').select('*').in('user_id', memberIds).eq('status', 'active'),
        supabase.from('streaks').select('user_id, current_streak').in('user_id', memberIds),
        supabase.from('progress').select('user_id, date, completed').in('user_id', memberIds).gte('date', fromDate),
      ]);

      // 5. Assemble member objects
      const assembled = allMemberships.map(m => {
        const prof    = profiles?.find(p => p.id === m.user_id) || { id: m.user_id, display_name: 'Unknown' };
        const prog    = programs?.find(p => p.user_id === m.user_id) || null;
        const strRow  = streakRows?.find(s => s.user_id === m.user_id);
        const progMap = {};
        progressRows?.filter(r => r.user_id === m.user_id).forEach(r => { progMap[r.date] = r.completed; });

        const currentWeek = prog ? getCurrentWeek(prog.started_at) : 1;

        return {
          ...prof,
          role:        m.role,
          joinedAt:    m.joined_at,
          program:     prog,
          currentWeek,
          streak:      strRow?.current_streak || 0,
          progress:    progMap,
          isMe:        m.user_id === user.id,
        };
      });

      setMembers(assembled);

      // 6. My program
      const myProg = programs?.find(p => p.user_id === user.id) || null;
      setMyProgram(myProg);

    } catch (e) {
      console.error('[useTeam] loadTeam error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ── Realtime subscriptions ──
  useEffect(() => {
    if (!isSupabaseEnabled || !team) return;

    const memberIds = members.map(m => m.id);

    const channel = supabase
      .channel(`team-v3-${team.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'team_members',
        filter: `team_id=eq.${team.id}`,
      }, () => loadTeam())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'team_check_logs',
        filter: `team_id=eq.${team.id}`,
      }, () => loadTeam())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'progress',
      }, (payload) => {
        if (memberIds.includes(payload.new?.user_id)) {
          // Partial update — just refresh progress for that user
          setMembers(prev => prev.map(m => {
            if (m.id !== payload.new?.user_id) return m;
            return { ...m, progress: { ...m.progress, [payload.new.date]: payload.new.completed } };
          }));
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [team?.id, members.length]);

  // ── Create Team ──
  const createTeam = useCallback(async (name = '', maxMembers = 2) => {
    if (!isSupabaseEnabled || !user) return;
    const code = genCode();
    const teamName = name.trim() || `Team ${code}`;

    const { data: newTeam, error: tErr } = await supabase
      .from('teams')
      .insert({ invite_code: code, name: teamName, max_members: maxMembers, created_by: user.id, status: 'active' })
      .select().single();

    if (tErr) { console.error('[useTeam] createTeam:', tErr.message); return; }

    // Insert creator as owner in team_members
    await supabase.from('team_members').insert({
      team_id: newTeam.id, user_id: user.id, role: 'owner',
    });

    // Create/ensure user_program
    await ensureUserProgram(user.id, null); // no sync choice for owner

    setTeam(newTeam);
    setInviteCode(code);
    await loadTeam();
  }, [user, loadTeam]);

  // ── Join Team ──
  const joinTeam = useCallback(async (code, weekSyncChoice = 'continue') => {
    if (!code?.trim()) return;
    setJoinLoading(true); setJoinError('');

    const { data: found } = await supabase
      .from('teams').select('*').eq('invite_code', code.trim().toUpperCase()).maybeSingle();

    if (!found) { setJoinError('Mã không tồn tại'); setJoinLoading(false); return; }

    // Check capacity
    const { count } = await supabase
      .from('team_members').select('id', { count: 'exact' }).eq('team_id', found.id);

    if (count >= (found.max_members || 2)) {
      setJoinError('Team này đã đủ người'); setJoinLoading(false); return;
    }

    // Check not already a member
    const { data: existing } = await supabase
      .from('team_members').select('id').eq('team_id', found.id).eq('user_id', user.id).maybeSingle();
    if (existing) { setJoinError('Bạn đã là thành viên team này'); setJoinLoading(false); return; }

    // Insert membership
    const { error: mErr } = await supabase.from('team_members').insert({
      team_id: found.id, user_id: user.id, role: 'member', week_sync: weekSyncChoice,
    });

    if (mErr) { setJoinError(mErr.message); setJoinLoading(false); return; }

    // Handle week sync
    await ensureUserProgram(user.id, weekSyncChoice);

    // Activate team if just reached max
    const { count: newCount } = await supabase
      .from('team_members').select('id', { count: 'exact' }).eq('team_id', found.id);
    if (newCount >= (found.max_members || 2)) {
      await supabase.from('teams').update({ status: 'active', activated_at: new Date().toISOString() }).eq('id', found.id);
    }

    await loadTeam();
    setJoinLoading(false);
  }, [user, loadTeam]);

  // ── Ensure user_program exists ──
  const ensureUserProgram = async (userId, weekSyncChoice) => {
    const { data: existing } = await supabase
      .from('user_programs').select('*').eq('user_id', userId).eq('status', 'active').maybeSingle();

    if (!existing) {
      await supabase.from('user_programs').insert({
        user_id: userId, started_at: new Date().toISOString().split('T')[0], status: 'active',
      });
    } else if (weekSyncChoice === 'restart') {
      await supabase.from('user_programs').update({
        started_at: new Date().toISOString().split('T')[0],
        current_week: 1,
        reset_count: (existing.reset_count || 0) + 1,
      }).eq('id', existing.id);
    }
  };

  // ── Copy invite code ──
  const copyInviteCode = useCallback(() => {
    const code = team?.invite_code || inviteCode;
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [team?.invite_code, inviteCode]);

  // ── Leave team ──
  const leaveTeam = useCallback(async () => {
    if (!isSupabaseEnabled || !user || !team) return;
    await supabase.from('team_members').delete().eq('team_id', team.id).eq('user_id', user.id);
    setTeam(null); setMembers([]); setMyProgram(null);
  }, [user, team]);

  const todayKey = new Date().toISOString().split('T')[0];
  const me = members.find(m => m.isMe);

  return {
    team, members, myProgram, loading,
    joinError, joinLoading,
    inviteCode: team?.invite_code || inviteCode,
    copied,
    todayKey,
    me,
    createTeam,
    joinTeam,
    copyInviteCode,
    leaveTeam,
    reload: loadTeam,
  };
}
