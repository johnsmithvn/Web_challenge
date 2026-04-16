import { useState, useEffect, useCallback } from 'react';
import { useHabitStore } from '../hooks/useHabitStore';
import { useXpStore, computeLevel } from '../hooks/useXpStore';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import '../styles/leaderboard.css';

const TABS = [
  { id: 'streak', label: '🔥 Streak' },
  { id: 'xp',     label: '⚡ XP' },
  { id: 'done',   label: '✅ Ngày Done' },
];

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
const RANK_EMOJIS = ['🥇', '🥈', '🥉'];

/**
 * Fetch real leaderboard from Supabase:
 * - streaks table  → current_streak, longest_streak
 * - progress table → count of completed days
 * - profiles       → display_name, avatar_url
 * All joined via profiles.id
 */
async function fetchLeaderboard() {
  // Fetch profiles + streaks in one query
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select(`
      id,
      display_name,
      avatar_url,
      streaks ( current_streak, longest_streak )
    `)
    .order('created_at', { ascending: true })
    .limit(50);

  if (error || !profiles) return [];

  // Fetch done counts per user
  const { data: doneCounts } = await supabase
    .from('progress')
    .select('user_id')
    .eq('completed', true);

  const doneMap = {};
  (doneCounts || []).forEach(r => {
    doneMap[r.user_id] = (doneMap[r.user_id] || 0) + 1;
  });

  return profiles.map(p => ({
    id:        p.id,
    name:      p.display_name || 'Ẩn danh',
    avatarUrl: p.avatar_url || null,
    streak:    p.streaks?.current_streak  ?? 0,
    totalXp:   ((p.streaks?.current_streak ?? 0) * 10) + ((doneMap[p.id] ?? 0) * 10),
    totalDone: doneMap[p.id] ?? 0,
  }));
}

export default function LeaderboardPage() {
  const { streak, totalDone }  = useHabitStore();
  const { totalXp }            = useXpStore();
  const { user, profile, isAuthenticated } = useAuth();
  const [tab, setTab]          = useState('streak');
  const [realUsers, setRealUsers] = useState([]);
  const [loading, setLoading]  = useState(false);

  const loadData = useCallback(async () => {
    if (!isSupabaseEnabled) return;
    setLoading(true);
    const data = await fetchLeaderboard();
    setRealUsers(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Build "me" entry from local/Supabase data
  const myId = user?.id ?? 'local-me';
  const me = {
    id:        myId,
    name:      profile?.display_name ?? 'Bạn',
    avatarUrl: profile?.avatar_url   ?? null,
    streak,
    totalXp,
    totalDone,
    isMe: true,
  };

  // Merge: if already in realUsers (authenticated), update isMe flag;
  // otherwise add "me" as a local entry
  const merged = (() => {
    if (!isAuthenticated || !isSupabaseEnabled) {
      return [...realUsers, me];
    }
    const inList = realUsers.find(u => u.id === myId);
    if (inList) {
      return realUsers.map(u => u.id === myId ? { ...u, isMe: true } : u);
    }
    return [...realUsers, me];
  })();

  const sorted = [...merged].sort((a, b) => {
    if (tab === 'streak') return b.streak    - a.streak;
    if (tab === 'xp')     return b.totalXp   - a.totalXp;
    return b.totalDone - a.totalDone;
  });

  const myRank = sorted.findIndex(u => u.isMe) + 1;

  const getVal = (u) => {
    if (tab === 'streak') return { num: u.streak,    unit: 'ngày 🔥' };
    if (tab === 'xp')     return { num: u.totalXp,   unit: 'XP ⚡' };
    return                       { num: u.totalDone,  unit: 'ngày ✅' };
  };

  const AvatarEl = ({ u, size = 40 }) => {
    const style = {
      width: size, height: size,
      borderRadius: '50%',
      objectFit: 'cover',
      background: 'rgba(139,92,246,0.2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.45,
      flexShrink: 0,
      border: u.isMe ? '2px solid var(--cyan)' : '2px solid rgba(255,255,255,0.08)',
    };
    if (u.avatarUrl) {
      return <img src={u.avatarUrl} alt={u.name} style={{ ...style, padding: 0 }} />;
    }
    const initials = u.name.slice(0, 1).toUpperCase();
    return <div style={style}>{initials}</div>;
  };

  return (
    <div className="lb-page">
      <div className="container">

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div className="section-label">🏆 Xếp Hạng</div>
          <h1 className="display-2">
            Leaderboard <span className="gradient-text">Cộng Đồng</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            {loading ? '⏳ Đang tải...' : (
              <>
                Hạng của bạn:&nbsp;
                <strong style={{ color: 'var(--gold)' }}>#{myRank}</strong>
                &nbsp;—&nbsp;
                {streak > 0 ? `Streak ${streak} ngày 🔥` : 'Bắt đầu hôm nay!'}
                &nbsp;·&nbsp;
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {sorted.length} người dùng
                </span>
              </>
            )}
          </p>
        </div>

        {/* Tabs */}
        <div className="lb-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`lb-tab ${tab === t.id ? 'lb-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
              id={`lb-tab-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Top 3 podium */}
        {!loading && sorted.length >= 1 && (
          <div className="lb-podium">
            {sorted.slice(0, 3).map((u, i) => {
              const lv  = computeLevel(u.totalXp);
              const val = getVal(u);
              return (
                <div
                  key={u.id}
                  className={`lb-podium-card ${u.isMe ? 'lb-podium-card--me' : ''}`}
                  style={{ '--rank-color': RANK_COLORS[i] }}
                >
                  <div className="lb-podium-rank">{RANK_EMOJIS[i]}</div>
                  <AvatarEl u={u} size={52} />
                  <div className="lb-name">{u.name}{u.isMe && <span style={{fontSize:'0.65rem', marginLeft:4, color:'var(--cyan)'}}>Bạn</span>}</div>
                  <div className="lb-level">{lv.emoji} {lv.name}</div>
                  <div className="lb-val" style={{ color: RANK_COLORS[i] }}>
                    {val.num} <span style={{ fontSize: '0.75rem' }}>{val.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Full list */}
        <div className="lb-table-wrap card">
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              ⏳ Đang tải dữ liệu...
            </div>
          ) : sorted.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Chưa có dữ liệu — hãy là người đầu tiên! 🚀
            </div>
          ) : sorted.map((u, i) => {
            const lv  = computeLevel(u.totalXp);
            const val = getVal(u);
            return (
              <div key={u.id} className={`lb-row ${u.isMe ? 'lb-row--me' : ''}`}>
                <span className="lb-row__rank" style={{ color: i < 3 ? RANK_COLORS[i] : 'var(--text-muted)' }}>
                  {i < 3 ? RANK_EMOJIS[i] : `#${i + 1}`}
                </span>
                <AvatarEl u={u} size={34} />
                <div className="lb-row__info">
                  <span className="lb-row__name">
                    {u.name}
                    {u.isMe && <span className="badge badge-cyan" style={{ marginLeft: 6, fontSize: '0.65rem' }}>Bạn</span>}
                  </span>
                  <span className="lb-row__level">{lv.emoji} {lv.name}</span>
                </div>
                <span className="lb-row__val">
                  {val.num} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{val.unit}</span>
                </span>
              </div>
            );
          })}
        </div>

        {!isSupabaseEnabled && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '1.5rem' }}>
            🔧 Kết nối Supabase để xem leaderboard thật
          </p>
        )}

      </div>
    </div>
  );
}
