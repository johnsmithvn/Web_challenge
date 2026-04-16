import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseEnabled } from '../lib/supabase';
import AuthModal from '../components/AuthModal';
import TeamMemberCard from '../components/team/TeamMemberCard';
import TeammateCheckPanel from '../components/team/TeammateCheckPanel';
import JoinSyncModal from '../components/team/JoinSyncModal';
import TeamRules from '../components/team/TeamRules';
import { useTeam } from '../hooks/useTeam';
import { useTeamCheck } from '../hooks/useTeamCheck';
import { useTeamRules } from '../hooks/useTeamRules';
import '../styles/tracker.css';
import '../styles/auth.css';
import '../styles/team.css';

// ─── Mock data for guest demo ────────────────────────────────
const todayKey = new Date().toISOString().split('T')[0];
const sevenAgo = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - 6 + i);
  return d.toISOString().split('T')[0];
});

const MOCK_MEMBERS = [
  {
    id: 'mock-1', display_name: 'Bạn (Demo)', isMe: true, role: 'owner',
    currentWeek: 1, streak: 3, avatar_url: null,
    progress: Object.fromEntries(sevenAgo.slice(0, 5).map(d => [d, true])),
  },
  {
    id: 'mock-2', display_name: 'Minh Anh', isMe: false, role: 'member',
    currentWeek: 2, streak: 8, avatar_url: null,
    progress: Object.fromEntries(sevenAgo.slice(0, 6).map(d => [d, true])),
  },
  {
    id: 'mock-3', display_name: 'Tuấn', isMe: false, role: 'member',
    currentWeek: 3, streak: 21, avatar_url: null,
    progress: Object.fromEntries(sevenAgo.map(d => [d, true])),
  },
];

// ─── Main Page ───────────────────────────────────────────────
export default function TeamPage() {
  const { user, profile, isAuthenticated } = useAuth();

  // UI state
  const [showAuth,        setShowAuth]        = useState(false);
  const [useMock,         setUseMock]         = useState(false);
  const [checkTarget,     setCheckTarget]     = useState(null); // member being checked
  const [showJoinSync,    setShowJoinSync]    = useState(false);
  const [pendingJoinCode, setPendingJoinCode] = useState('');

  // Form state
  const [createName,  setCreateName]  = useState('');
  const [maxMembers,  setMaxMembers]  = useState(2);
  const [joinCode,    setJoinCode]    = useState('');

  // ── Hooks (only active when Supabase + authenticated) ──
  const teamHook  = useTeam();
  const checkHook = useTeamCheck(teamHook.team?.id);
  const memberIds = teamHook.members.map(m => m.id);
  const rulesHook = useTeamRules(teamHook.team?.id, memberIds);

  // ── Helpers ──
  const isDayValidated = (member) => {
    if (useMock) {
      return member.currentWeek !== 2 ? !!member.progress?.[todayKey] : false;
    }
    return checkHook.isDayValidated(member);
  };

  const needsTeamCheck = (member) => {
    if (useMock) return member.currentWeek === 2;
    return checkHook.needsTeamCheck(member);
  };

  const canBeChecked = (member) => {
    if (useMock) return false; // demo only
    return checkHook.canCheck(member);
  };

  // ── Join flow — show sync modal if user has active program ──
  const handleJoinClick = () => {
    const myProgram = teamHook.myProgram;
    if (myProgram && myProgram.current_week > 1) {
      setPendingJoinCode(joinCode);
      setShowJoinSync(true);
    } else {
      teamHook.joinTeam(joinCode, 'continue');
    }
  };

  const handleSyncChoice = (choice) => {
    setShowJoinSync(false);
    teamHook.joinTeam(pendingJoinCode, choice);
  };

  // ── Check submit ──
  const handleCheckSubmit = async (checkedId, status, reason) => {
    await checkHook.submitCheck(checkedId, status, reason);
    if (!checkHook.submitError) setCheckTarget(null);
  };

  // ─── No-auth wall ──────────────────────────────────────────
  if (!isAuthenticated && !useMock) {
    return (
      <div className="team-page">
        <div className="container team-auth-wall">
          <div className="team-auth-wall__icon">🤝</div>
          <h1 className="display-2">Team Mode</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: 480, textAlign: 'center' }}>
            Ghép nhóm 2–4 người. Theo dõi nhau mỗi ngày. Tuần 2 cần đồng đội xác nhận — không thể fake!
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => setShowAuth(true)} id="team-login">
              🔑 Đăng Nhập / Đăng Ký
            </button>
            <button className="btn btn-ghost" onClick={() => setUseMock(true)} id="team-demo">
              👁 Xem Demo (3 người)
            </button>
          </div>
        </div>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

  // ─── Which members to display ──────────────────────────────
  const displayMembers = useMock ? MOCK_MEMBERS : teamHook.members;
  const displayTeam    = useMock ? { name: 'Demo Squad', invite_code: 'DEMO01', max_members: 3 } : teamHook.team;
  const hasTeam        = !!displayTeam || useMock;

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="team-page">
      <div className="container">

        {/* Page header */}
        <div className="team-page-header">
          <div className="section-label">🤝 Đồng Đội</div>
          <h1 className="display-2">
            Team Mode
            {useMock && <span className="badge badge-cyan" style={{ fontSize: '0.6rem', verticalAlign: 'middle', marginLeft: '0.5rem' }}>DEMO</span>}
          </h1>
          {hasTeam && displayTeam && (
            <div className="team-page-meta">
              <span className="team-page-name">{displayTeam.name || 'My Team'}</span>
              <span className="team-page-size">👥 {displayMembers.length}/{displayTeam.max_members || 2} thành viên</span>
            </div>
          )}
        </div>

        {/* ── Setup: no team yet ── */}
        {isAuthenticated && !teamHook.team && !useMock && (
          <div className="team-setup-grid">

            {/* Create */}
            <div className="card team-setup-card">
              <div className="team-setup-card__icon">🚀</div>
              <h3>Tạo Team Mới</h3>
              <p>Tạo mã invite và gửi cho đồng đội</p>

              <input
                type="text"
                className="auth-input"
                placeholder="Tên team (tuỳ chọn)"
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                id="team-name-input"
              />

              <div className="team-size-picker">
                <label>Số thành viên tối đa:</label>
                <div className="team-size-options">
                  {[2, 3, 4].map(n => (
                    <button
                      key={n}
                      className={`team-size-btn ${maxMembers === n ? 'active' : ''}`}
                      onClick={() => setMaxMembers(n)}
                      id={`size-${n}`}
                    >
                      {n === 2 ? '👫 Duo' : n === 3 ? '👨‍👩‍👦 Trio' : '👨‍👩‍👧‍👦 Squad'}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="btn btn-primary"
                onClick={() => teamHook.createTeam(createName, maxMembers)}
                id="team-create"
                style={{ width: '100%' }}
              >
                Tạo Team
              </button>

              {teamHook.inviteCode && (
                <div className="invite-code-box" style={{ marginTop: '0.75rem' }}>
                  <span className="invite-code-value">{teamHook.inviteCode}</span>
                  <button className="btn btn-ghost" style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }} onClick={teamHook.copyInviteCode}>
                    {teamHook.copied ? '✅ Đã copy' : '📋 Copy'}
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
                <button
                  className="btn btn-primary"
                  onClick={handleJoinClick}
                  disabled={teamHook.joinLoading || !joinCode.trim()}
                  id="team-join"
                >
                  {teamHook.joinLoading ? '...' : 'Join'}
                </button>
              </div>
              {teamHook.joinError && (
                <div className="auth-error" style={{ marginTop: '0.5rem' }}>{teamHook.joinError}</div>
              )}
            </div>
          </div>
        )}

        {/* ── Active team: members grid ── */}
        {hasTeam && (
          <>
            {/* Loading */}
            {teamHook.loading && !useMock && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                ⏳ Đang tải dữ liệu team...
              </div>
            )}

            {/* Members */}
            {displayMembers.length > 0 && (
              <div className={`team-members-grid team-members-grid--${Math.min(displayMembers.length, 4)}`}>
                {displayMembers.map(member => (
                  <TeamMemberCard
                    key={member.id}
                    member={member}
                    todayKey={todayKey}
                    isDayValidated={isDayValidated}
                    needsTeamCheck={needsTeamCheck}
                    canBeChecked={canBeChecked(member)}
                    onCheckClick={setCheckTarget}
                  />
                ))}
              </div>
            )}

            {/* Waiting for members (invite code shown) */}
            {isAuthenticated && displayTeam?.invite_code && displayMembers.length < (displayTeam.max_members || 2) && !useMock && (
              <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                <div className="dash-card-title">⏳ Chờ đồng đội join...</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  Chia sẻ mã dưới đây cho {(displayTeam.max_members || 2) - displayMembers.length} người còn lại
                </p>
                <div className="invite-code-box" style={{ justifyContent: 'center' }}>
                  <span className="invite-code-value">{displayTeam.invite_code}</span>
                  <button className="btn btn-ghost" style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }} onClick={teamHook.copyInviteCode}>
                    {teamHook.copied ? '✅ Đã copy' : '📋 Copy'}
                  </button>
                </div>
              </div>
            )}

            {/* Team Rules section — real mode only */}
            {isAuthenticated && teamHook.team && (
              <TeamRules
                teamId={teamHook.team.id}
                memberIds={memberIds}
                userId={user?.id}
                useTeamRulesHook={rulesHook}
              />
            )}

            {/* Demo rules placeholder */}
            {useMock && (
              <div className="card team-rules-section" style={{ margin: '1.5rem 0' }}>
                <div className="team-rules-header">
                  <div className="dash-card-title">⚖️ Team Rules</div>
                </div>
                <div className="team-rules-list">
                  <div className="team-rule-card team-rule-card--active">
                    <div className="team-rule-card__top">
                      <span>🔴</span>
                      <span className="rule-status rule-status--active">✅ Active</span>
                    </div>
                    <div className="team-rule-card__desc">Bỏ 1 ngày → Chuyển khoản 50.000đ cho teammate</div>
                    <div className="team-rule-card__trigger">☠️ Bỏ 1 ngày</div>
                  </div>
                  <div className="team-rule-card">
                    <div className="team-rule-card__top">
                      <span>🏆</span>
                      <span className="rule-status rule-status--pending">⏳ 2/3 đồng ý</span>
                    </div>
                    <div className="team-rule-card__desc">Streak 7 ngày → Người kia mua cà phê 1 tuần</div>
                    <div className="team-rule-card__trigger">🔥 Streak 7 ngày</div>
                  </div>
                </div>
              </div>
            )}

            {/* Leave team button (real mode) */}
            {isAuthenticated && teamHook.team && (
              <div style={{ textAlign: 'right', marginTop: '1rem' }}>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}
                  onClick={() => { if (confirm('Bạn chắc chắn muốn rời team?')) teamHook.leaveTeam(); }}
                  id="leave-team"
                >
                  🚪 Rời Team
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modals ── */}
      {checkTarget && !useMock && (
        <TeammateCheckPanel
          member={checkTarget}
          onSubmit={handleCheckSubmit}
          onClose={() => { setCheckTarget(null); checkHook.setSubmitError(''); }}
          submitting={checkHook.submitting}
          submitError={checkHook.submitError}
        />
      )}

      {showJoinSync && (
        <JoinSyncModal
          currentWeek={teamHook.myProgram?.current_week || 1}
          teamName=""
          onChoice={handleSyncChoice}
          onClose={() => setShowJoinSync(false)}
        />
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
