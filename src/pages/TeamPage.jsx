import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import AuthModal from '../components/AuthModal';
import '../styles/tracker.css';
import '../styles/auth.css';
import '../styles/team.css';

const REACTIONS = ['🔥', '💪', '👏', '🎯', '⚡'];

// Generate invite code
function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ─── Mock teammate for demo / no-auth mode ──────────────────
const MOCK_TEAMMATE = {
  id: 'mock',
  display_name: 'Minh Anh',
  avatar_url: null,
  emoji: '🧑‍💻',
  streak: 5,
  progress: { [new Date().toISOString().split('T')[0]]: true },
};

export default function TeamPage() {
  const { user, profile, isAuthenticated } = useAuth();
  const [showAuth,     setShowAuth]     = useState(false);
  const [team,         setTeam]         = useState(null);
  const [teammate,     setTeammate]     = useState(null);
  const [tmProgress,   setTmProgress]   = useState({});
  const [inviteCode,   setInviteCode]   = useState('');
  const [joinCode,     setJoinCode]     = useState('');
  const [joinError,    setJoinError]    = useState('');
  const [reactions,    setReactions]    = useState({});
  const [loadingJoin,  setLoadingJoin]  = useState(false);
  const [copied,       setCopied]       = useState(false);
  const [useMock,      setUseMock]      = useState(false);

  const todayKey = new Date().toISOString().split('T')[0];
  const myTodayDone = !!JSON.parse(localStorage.getItem('vl_habit_data') || '{}')[todayKey];

  // ── Load existing team from DB ──
  useEffect(() => {
    if (!isSupabaseEnabled || !isAuthenticated || !user) return;
    loadTeam();
  }, [isAuthenticated, user?.id]);

  const loadTeam = async () => {
    const { data: teams } = await supabase
      .from('teams')
      .select('*')
      .or(`member1_id.eq.${user.id},member2_id.eq.${user.id}`)
      .eq('status', 'active')
      .maybeSingle();

    if (teams) {
      setTeam(teams);
      const tmId = teams.member1_id === user.id ? teams.member2_id : teams.member1_id;
      if (tmId) await loadTeammate(tmId);
    }
  };

  const loadTeammate = async (tmId) => {
    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', tmId).single();
    const { data: streak } = await supabase
      .from('streaks').select('*').eq('user_id', tmId).single();
    const { data: prog } = await supabase
      .from('progress').select('date, completed').eq('user_id', tmId);

    const progMap = {};
    prog?.forEach(r => { progMap[r.date] = r.completed; });

    setTeammate({ ...prof, streak: streak?.current_streak || 0 });
    setTmProgress(progMap);
  };

  // ── Realtime subscription ──
  useEffect(() => {
    if (!isSupabaseEnabled || !team || !teammate) return;

    const channel = supabase
      .channel(`team-${team.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'progress',
        filter: `user_id=eq.${teammate.id}`,
      }, (payload) => {
        if (payload.new) {
          setTmProgress(prev => ({
            ...prev,
            [payload.new.date]: payload.new.completed,
          }));
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [team?.id, teammate?.id]);

  // ── Create team ──
  const handleCreate = async () => {
    if (!isSupabaseEnabled || !user) return;
    const code = genCode();
    const { data, error } = await supabase.from('teams').insert({
      invite_code: code,
      member1_id:  user.id,
      status:      'pending',
    }).select().single();

    if (!error) { setTeam(data); setInviteCode(code); }
  };

  // ── Join team ──
  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setLoadingJoin(true); setJoinError('');
    const code = joinCode.trim().toUpperCase();

    const { data: found } = await supabase
      .from('teams').select('*').eq('invite_code', code).maybeSingle();

    if (!found) { setJoinError('Mã không tồn tại'); setLoadingJoin(false); return; }
    if (found.member1_id === user.id) { setJoinError('Không thể join team của chính mình'); setLoadingJoin(false); return; }
    if (found.member2_id) { setJoinError('Team này đã đủ người'); setLoadingJoin(false); return; }

    const { data: updated, error } = await supabase
      .from('teams')
      .update({ member2_id: user.id, status: 'active', activated_at: new Date().toISOString() })
      .eq('id', found.id)
      .select().single();

    if (!error) { setTeam(updated); await loadTeammate(found.member1_id); }
    else setJoinError(error.message);
    setLoadingJoin(false);
  };

  // ── Send reaction ──
  const handleReaction = async (emoji) => {
    if (!isSupabaseEnabled || !user || !teammate) return;
    await supabase.from('reactions').upsert({
      from_user_id: user.id,
      to_user_id:   teammate.id,
      emoji, date: todayKey,
    }, { onConflict: 'from_user_id,to_user_id,emoji,date' });
    setReactions(prev => ({ ...prev, [emoji]: (prev[emoji] || 0) + 1 }));
  };

  const copyCode = () => {
    navigator.clipboard.writeText(team?.invite_code || inviteCode);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  // Week mini heatmap
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 6 + i);
    return d.toISOString().split('T')[0];
  });

  // ─── No auth state ──────────────────────────────────────────
  if (!isAuthenticated && !useMock) {
    return (
      <div className="team-page">
        <div className="container team-auth-wall">
          <div className="team-auth-wall__icon">🤝</div>
          <h1 className="display-2">Team Mode</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: 480 }}>
            Ghép cặp với 1 người. Thấy nhau tick mỗi ngày. Không muốn phá streak trước mặt người khác.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => setShowAuth(true)} id="team-login">
              🔑 Đăng Nhập / Đăng Ký
            </button>
            <button className="btn btn-ghost" onClick={() => setUseMock(true)} id="team-demo">
              👁 Xem Demo
            </button>
          </div>
        </div>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

  // ─── Demo mode (mock teammate) ──────────────────────────────
  const displayTeammate = useMock && !teammate ? MOCK_TEAMMATE : teammate;
  const displayProgress = useMock && !teammate ? MOCK_TEAMMATE.progress : tmProgress;
  const hasTeam = !!team || useMock;

  return (
    <div className="team-page">
      <div className="container">
        <div style={{ marginBottom: '2rem' }}>
          <div className="section-label">🤝 Đồng Đội</div>
          <h1 className="display-2">Team Mode {useMock && <span className="badge badge-cyan" style={{ fontSize: '0.6rem', verticalAlign: 'middle' }}>DEMO</span>}</h1>
          {isAuthenticated && !team && !useMock && (
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              Tạo team hoặc nhập mã để kết nối với đồng đội
            </p>
          )}
        </div>

        {/* ── No team yet (authenticated) ── */}
        {isAuthenticated && !team && (
          <div className="team-setup-grid">
            {/* Create */}
            <div className="card team-setup-card">
              <div className="team-setup-card__icon">🚀</div>
              <h3>Tạo Team Mới</h3>
              <p>Tạo mã invite và gửi cho bạn đồng hành</p>
              <button className="btn btn-primary" onClick={handleCreate} id="team-create">
                Tạo Team
              </button>
              {(team?.invite_code || inviteCode) && (
                <div className="invite-code-box" style={{ marginTop: '1rem' }}>
                  <span className="invite-code-value">{team?.invite_code || inviteCode}</span>
                  <button className="btn btn-ghost" style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }} onClick={copyCode}>
                    {copied ? '✅ Đã copy' : '📋 Copy'}
                  </button>
                </div>
              )}
            </div>

            {/* Join */}
            <div className="card team-setup-card">
              <div className="team-setup-card__icon">🔗</div>
              <h3>Nhập Mã Invite</h3>
              <p>Bạn đồng hành đã gửi mã? Nhập vào đây</p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="auth-input"
                  placeholder="VD: AB1C2D"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '0.1em' }}
                  id="join-code-input"
                />
                <button className="btn btn-primary" onClick={handleJoin} disabled={loadingJoin} id="team-join">
                  {loadingJoin ? '...' : 'Join'}
                </button>
              </div>
              {joinError && <div className="auth-error" style={{ marginTop: '0.5rem' }}>{joinError}</div>}
            </div>
          </div>
        )}

        {/* ── Active team ── */}
        {(hasTeam) && (
          <>
            {/* Duo cards */}
            <div className="team-duo-grid">
              {/* Me */}
              <div className="team-player-card card">
                <div className="team-player-card__avatar">
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} alt="" />
                    : (profile?.display_name?.[0] || '😤')}
                </div>
                <div className="team-player-card__name">
                  {profile?.display_name || 'Bạn'}
                  <span className="badge badge-cyan" style={{ marginLeft: 8, fontSize: '0.65rem' }}>Bạn</span>
                </div>
                <div className="team-player-card__streak">
                  🔥 {JSON.parse(localStorage.getItem('vl_streak_cache') || '0')} streak
                </div>
                <div className="team-player-mini-heatmap">
                  {weekDays.map(d => {
                    const done = !!JSON.parse(localStorage.getItem('vl_habit_data') || '{}')[d];
                    return <div key={d} className={`heatmap-cell ${done ? 'heatmap-cell--done' : 'heatmap-cell--empty'}`} title={d} />;
                  })}
                </div>
                <div className={`team-today-badge ${myTodayDone ? 'done' : 'pending'}`}>
                  {myTodayDone ? '✅ Done hôm nay!' : '⏳ Chưa tick hôm nay'}
                </div>
              </div>

              {/* VS */}
              <div className="team-vs">VS</div>

              {/* Teammate */}
              <div className="team-player-card card">
                <div className="team-player-card__avatar">
                  {displayTeammate?.avatar_url
                    ? <img src={displayTeammate.avatar_url} alt="" />
                    : (displayTeammate?.emoji || displayTeammate?.display_name?.[0] || '🧑')}
                </div>
                <div className="team-player-card__name">{displayTeammate?.display_name || 'Đang chờ...'}</div>
                <div className="team-player-card__streak">
                  🔥 {displayTeammate?.streak || 0} streak
                </div>
                <div className="team-player-mini-heatmap">
                  {weekDays.map(d => {
                    const done = !!displayProgress?.[d];
                    return <div key={d} className={`heatmap-cell ${done ? 'heatmap-cell--done' : 'heatmap-cell--empty'}`} title={d} />;
                  })}
                </div>
                <div className={`team-today-badge ${displayProgress?.[todayKey] ? 'done' : 'pending'}`}>
                  {displayProgress?.[todayKey] ? '✅ Done hôm nay!' : '⏳ Chưa tick hôm nay'}
                </div>
              </div>
            </div>

            {/* Reactions */}
            {displayTeammate && (
              <div className="card team-reactions">
                <div className="dash-card-title">⚡ Gửi Động Lực</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  Gửi reaction cho {displayTeammate.display_name}
                </p>
                <div className="reaction-row">
                  {REACTIONS.map(emoji => (
                    <button
                      key={emoji}
                      className="reaction-btn"
                      onClick={() => handleReaction(emoji)}
                      id={`reaction-${emoji}`}
                    >
                      <span className="reaction-emoji">{emoji}</span>
                      {reactions[emoji] > 0 && (
                        <span className="reaction-count">{reactions[emoji]}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Invite code */}
            {(team?.invite_code) && !team?.member2_id && (
              <div className="card" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <div className="dash-card-title">⏳ Chờ đồng đội join...</div>
                <div className="invite-code-box" style={{ justifyContent: 'center' }}>
                  <span className="invite-code-value">{team.invite_code}</span>
                  <button className="btn btn-ghost" style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }} onClick={copyCode}>
                    {copied ? '✅ Đã copy' : '📋 Copy'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
