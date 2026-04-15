import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import AuthModal from '../components/AuthModal';
import { useXpStore, computeLevel } from '../hooks/useXpStore';
import '../styles/auth.css';
import '../styles/friends.css';

const STATUS_MAP = {
  pending:   { label: 'Đang chờ',    color: 'var(--text-muted)' },
  accepted:  { label: 'Bạn bè',      color: 'var(--green)' },
  declined:  { label: 'Đã từ chối',  color: '#f87171' },
};

export default function FriendsPage() {
  const { user, isAuthenticated } = useAuth();
  const [showAuth,    setShowAuth]    = useState(false);
  const [search,      setSearch]      = useState('');
  const [searchRes,   setSearchRes]   = useState([]);
  const [friends,     setFriends]     = useState([]);
  const [incoming,    setIncoming]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [msg,         setMsg]         = useState('');

  const loadFriends = useCallback(async () => {
    if (!isSupabaseEnabled || !user) return;

    // Accepted friendships
    const { data } = await supabase
      .from('friendships')
      .select(`
        id, status, requester_id, addressee_id,
        requester:profiles!friendships_requester_id_fkey(id, display_name, avatar_url),
        addressee:profiles!friendships_addressee_id_fkey(id, display_name, avatar_url)
      `)
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .in('status', ['accepted', 'pending']);

    if (data) {
      const accepted = data.filter(f => f.status === 'accepted').map(f => ({
        id: f.id,
        friend: f.requester_id === user.id ? f.addressee : f.requester,
      }));
      const pending = data.filter(f => f.status === 'pending' && f.addressee_id === user.id).map(f => ({
        id: f.id,
        from: f.requester,
      }));
      setFriends(accepted);
      setIncoming(pending);
    }
  }, [user?.id]);

  useEffect(() => { if (isAuthenticated) loadFriends(); }, [isAuthenticated]);

  const handleSearch = async () => {
    if (!search.trim() || !isSupabaseEnabled) return;
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, username')
      .ilike('username', `%${search.trim()}%`)
      .neq('id', user.id)
      .limit(8);
    setSearchRes(data || []);
    setLoading(false);
  };

  const sendRequest = async (addresseeId) => {
    const { error } = await supabase.from('friendships').insert({
      requester_id: user.id, addressee_id: addresseeId,
    });
    if (error?.code === '23505') setMsg('Đã gửi lời mời trước đó rồi');
    else { setMsg('✅ Đã gửi lời mời kết bạn!'); setSearchRes([]); setSearch(''); }
    setTimeout(() => setMsg(''), 3000);
  };

  const respondRequest = async (friendshipId, accept) => {
    await supabase.from('friendships')
      .update({ status: accept ? 'accepted' : 'declined' })
      .eq('id', friendshipId);
    loadFriends();
  };

  const removeFriend = async (friendshipId) => {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    loadFriends();
  };

  if (!isAuthenticated) {
    return (
      <div className="friends-page">
        <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>👥</div>
          <h1 className="display-2">Bạn Bè</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            Đăng nhập để kết nối và so sánh streak với bạn bè
          </p>
          <button className="btn btn-primary" onClick={() => setShowAuth(true)} id="friends-login">
            🔑 Đăng Nhập
          </button>
        </div>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

  return (
    <div className="friends-page">
      <div className="container">
        <div style={{ marginBottom: '2rem' }}>
          <div className="section-label">👥 Xã Hội</div>
          <h1 className="display-2">Bạn Bè <span className="gradient-text">& Kết Nối</span></h1>
        </div>

        {/* Search */}
        {isSupabaseEnabled ? (
          <div className="card friends-search">
            <div className="dash-card-title">🔍 Tìm Bạn Bè</div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <input
                className="auth-input"
                placeholder="Nhập username..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                style={{ flex: 1 }}
                id="friends-search-input"
              />
              <button className="btn btn-primary" onClick={handleSearch} disabled={loading} id="friends-search-btn">
                {loading ? '...' : 'Tìm'}
              </button>
            </div>
            {msg && <div className="auth-success" style={{ marginTop: '0.5rem' }}>{msg}</div>}

            {searchRes.length > 0 && (
              <div className="friends-search-results">
                {searchRes.map(u => (
                  <div key={u.id} className="friend-row">
                    <div className="friend-avatar">
                      {u.avatar_url ? <img src={u.avatar_url} alt="" /> : u.display_name?.[0] || '?'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="friend-name">{u.display_name}</div>
                      <div className="friend-username">@{u.username}</div>
                    </div>
                    <button className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem' }}
                      onClick={() => sendRequest(u.id)} id={`add-friend-${u.id}`}>
                      ➕ Kết Bạn
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="auth-notice">🔧 Cần cấu hình Supabase để tìm bạn bè thật</div>
        )}

        {/* Incoming requests */}
        {incoming.length > 0 && (
          <div className="card" style={{ marginTop: '1.25rem' }}>
            <div className="dash-card-title">📬 Lời Mời Kết Bạn ({incoming.length})</div>
            {incoming.map(req => (
              <div key={req.id} className="friend-row" style={{ marginTop: '0.75rem' }}>
                <div className="friend-avatar">{req.from.display_name?.[0] || '?'}</div>
                <div style={{ flex: 1 }}>
                  <div className="friend-name">{req.from.display_name}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
                    onClick={() => respondRequest(req.id, true)} id={`accept-${req.id}`}>✅</button>
                  <button className="btn btn-ghost" style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
                    onClick={() => respondRequest(req.id, false)} id={`decline-${req.id}`}>❌</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Friends list */}
        <div className="card" style={{ marginTop: '1.25rem' }}>
          <div className="dash-card-title">🤝 Bạn Bè ({friends.length})</div>
          {friends.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.75rem' }}>
              Chưa có bạn bè. Tìm và kết nối để so sánh streak!
            </p>
          ) : (
            friends.map(f => {
              const lv = computeLevel(0); // TODO: fetch friend XP
              return (
                <div key={f.id} className="friend-row" style={{ paddingTop: '0.75rem' }}>
                  <div className="friend-avatar">
                    {f.friend.avatar_url ? <img src={f.friend.avatar_url} alt="" /> : f.friend.display_name?.[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="friend-name">{f.friend.display_name}</div>
                    <div className="friend-username">{lv.emoji} {lv.name}</div>
                  </div>
                  <button className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', color: '#f87171' }}
                    onClick={() => removeFriend(f.id)} id={`remove-${f.id}`}>
                    Xóa
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
