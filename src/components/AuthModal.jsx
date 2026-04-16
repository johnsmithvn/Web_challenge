import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/auth.css';

const TABS = ['login', 'register'];

export default function AuthModal({ onClose }) {
  const { signIn, signUp, signInWithGoogle, isSupabaseEnabled } = useAuth();
  const [tab,         setTab]         = useState('login');
  const [username,    setUsername]    = useState('');
  const [password,    setPassword]    = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const reset = () => setError('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isSupabaseEnabled) {
      setError('Supabase chưa được cấu hình. Thêm keys vào .env.local');
      return;
    }
    if (!username.trim()) { setError('Vui lòng nhập tên đăng nhập'); return; }

    setLoading(true); reset();

    let result;
    if (tab === 'login') {
      result = await signIn({ username, password });
    } else {
      result = await signUp({ username, password, displayName: displayName.trim() || username });
    }

    setLoading(false);

    if (result?.error) {
      const msg = result.error.message || '';
      if (msg.includes('Invalid login') || msg.includes('invalid_credentials'))
        setError('Tên đăng nhập hoặc mật khẩu không đúng');
      else if (msg.includes('already registered') || msg.includes('already exists'))
        setError('Tên đăng nhập này đã được sử dụng');
      else if (msg.includes('Password should') || msg.includes('password'))
        setError('Mật khẩu tối thiểu 6 ký tự');
      else
        setError(msg);
    } else {
      onClose?.();
    }
  };

  const handleGoogle = async () => {
    if (!isSupabaseEnabled) { setError('Supabase chưa được cấu hình'); return; }
    await signInWithGoogle();
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="auth-modal card" role="dialog" aria-modal="true">

        {/* Close */}
        <button className="auth-modal__close" onClick={onClose} aria-label="Đóng" id="auth-close">✕</button>

        {/* Logo */}
        <div className="auth-modal__logo">
          <span>⚡</span>
          <span className="gradient-text">Vượt Lười</span>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          {TABS.map(t => (
            <button
              key={t}
              className={`auth-tab ${tab === t ? 'auth-tab--active' : ''}`}
              onClick={() => { setTab(t); reset(); }}
              id={`auth-tab-${t}`}
            >
              {t === 'login' ? '🔑 Đăng Nhập' : '✨ Đăng Ký'}
            </button>
          ))}
        </div>

        {/* Google OAuth */}
        <button className="btn btn-ghost auth-google" onClick={handleGoogle} id="auth-google" disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
            <path fill="#4285F4" d="M46.145 24.503c0-1.636-.147-3.21-.42-4.722H24v8.944h12.434c-.536 2.893-2.168 5.344-4.621 6.988v5.81h7.479c4.376-4.03 6.853-9.97 6.853-17.02z"/>
            <path fill="#34A853" d="M24 47c6.237 0 11.464-2.07 15.285-5.605l-7.479-5.81C29.735 37.05 27.056 38 24 38c-5.99 0-11.066-4.048-12.876-9.49h-7.71v6.001C7.266 41.83 15.074 47 24 47z"/>
            <path fill="#FBBC05" d="M11.124 28.51A14.914 14.914 0 0 1 10.5 24c0-1.575.27-3.105.624-4.51v-6H3.414A23.98 23.98 0 0 0 0 24c0 3.862.922 7.52 2.556 10.749l8.568-6.24z"/>
            <path fill="#EA4335" d="M24 9.5c3.375 0 6.405 1.16 8.792 3.44l6.586-6.587C35.455 2.686 30.23.5 24 .5 15.074.5 7.266 5.67 3.414 13.251l8.71 6.24C13.934 13.548 18.91 9.5 24 9.5z"/>
          </svg>
          Tiếp tục với Google
        </button>

        <div className="auth-divider"><span>hoặc</span></div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">

          {/* Tên hiển thị — chỉ khi đăng ký */}
          {tab === 'register' && (
            <div className="auth-field">
              <label htmlFor="auth-displayname">Tên hiển thị (trong team)</label>
              <input
                id="auth-displayname"
                type="text"
                placeholder="Ví dụ: Minh Anh"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                autoComplete="name"
                className="auth-input"
              />
            </div>
          )}

          {/* Username */}
          <div className="auth-field">
            <label htmlFor="auth-username">Tên đăng nhập</label>
            <input
              id="auth-username"
              type="text"
              placeholder="Ví dụ: minhanh99"
              value={username}
              onChange={e => setUsername(e.target.value.trim())}
              required
              autoComplete="username"
              className="auth-input"
              autoCapitalize="none"
            />
            {tab === 'register' && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                Chỉ dùng a-z, 0-9, dấu _ hoặc . (không cần @)
              </div>
            )}
          </div>

          {/* Password */}
          <div className="auth-field">
            <label htmlFor="auth-password">Mật khẩu</label>
            <input
              id="auth-password"
              type="password"
              placeholder={tab === 'register' ? 'Tối thiểu 6 ký tự' : '••••••••'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              className="auth-input"
              minLength={6}
            />
          </div>

          {error && <div className="auth-error">⚠️ {error}</div>}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '0.85rem' }}
            disabled={loading}
            id="auth-submit"
          >
            {loading ? '⏳ Đang xử lý...' : tab === 'login' ? '🔑 Đăng Nhập' : '✨ Đăng Ký'}
          </button>
        </form>

        {!isSupabaseEnabled && (
          <div className="auth-notice">
            🔧 Chế độ demo — Thêm VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY vào .env.local để kích hoạt auth thật
          </div>
        )}
      </div>
    </div>
  );
}
