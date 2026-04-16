import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/auth.css';

const TABS = ['login', 'register'];

export default function AuthModal({ onClose }) {
  const { signIn, signUp, signInWithGoogle, isSupabaseEnabled } = useAuth();
  const [tab,         setTab]         = useState('login');

  // Register fields
  const [regUsername,    setRegUsername]    = useState('');
  const [regEmail,       setRegEmail]       = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regPassword,    setRegPassword]    = useState('');

  // Login fields
  const [loginId,      setLoginId]      = useState(''); // username OR email
  const [loginPassword, setLoginPassword] = useState('');

  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const reset = () => { setError(''); setSuccessMsg(''); };

  // ── Validation helpers ──
  const isValidUsername = (v) => /^[a-z0-9_.]{3,20}$/.test(v);
  const isValidEmail    = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isSupabaseEnabled) { setError('Supabase chưa được cấu hình. Cần thêm env keys.'); return; }

    setLoading(true); reset();

    if (tab === 'login') {
      // ── Login ──
      if (!loginId.trim()) { setError('Nhập tên đăng nhập hoặc email'); setLoading(false); return; }

      const result = await signIn({ loginId, password: loginPassword });
      setLoading(false);

      if (result?.error) {
        const msg = result.error.message || '';
        if (msg === 'username_not_found')
          setError('Không tìm thấy tên đăng nhập này');
        else if (msg.includes('invalid_credentials') || msg.includes('Invalid login'))
          setError('Tên đăng nhập/email hoặc mật khẩu không đúng');
        else
          setError(msg);
      } else {
        onClose?.();
      }

    } else {
      // ── Register ──
      const uname = regUsername.trim().toLowerCase();
      const email = regEmail.trim().toLowerCase();

      if (!uname) { setError('Vui lòng nhập tên đăng nhập'); setLoading(false); return; }
      if (!isValidUsername(uname)) {
        setError('Tên đăng nhập: 3–20 ký tự, chỉ dùng a-z, 0-9, dấu _ hoặc .');
        setLoading(false); return;
      }
      if (!email || !isValidEmail(email)) {
        setError('Email không hợp lệ');
        setLoading(false); return;
      }

      const result = await signUp({
        username:    uname,
        email,
        password:    regPassword,
        displayName: regDisplayName.trim() || uname,
      });

      setLoading(false);

      if (result?.error) {
        const msg = result.error.message || '';
        if (msg === 'username_taken')
          setError('Tên đăng nhập này đã được dùng, chọn tên khác nhé');
        else if (msg.includes('already registered') || msg.includes('already exists'))
          setError('Email này đã được đăng ký');
        else if (msg.includes('Password should') || msg.includes('password'))
          setError('Mật khẩu tối thiểu 6 ký tự');
        else
          setError(msg);
      } else {
        setSuccessMsg('✅ Đăng ký thành công! Đang đăng nhập...');
        setTimeout(() => onClose?.(), 1200);
      }
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

        {/* ═══ LOGIN FORM ═══ */}
        {tab === 'login' && (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label htmlFor="login-id">Tên đăng nhập hoặc Email</label>
              <input
                id="login-id"
                type="text"
                placeholder="minhanh99  hoặc  hello@gmail.com"
                value={loginId}
                onChange={e => setLoginId(e.target.value)}
                required
                autoComplete="username"
                className="auth-input"
                autoCapitalize="none"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="login-password">Mật khẩu</label>
              <input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="auth-input"
                minLength={6}
              />
            </div>

            {error      && <div className="auth-error">⚠️ {error}</div>}
            {successMsg && <div className="auth-success">{successMsg}</div>}

            <button type="submit" className="btn btn-primary auth-submit" disabled={loading} id="auth-submit">
              {loading ? '⏳ Đang xử lý...' : '🔑 Đăng Nhập'}
            </button>
          </form>
        )}

        {/* ═══ REGISTER FORM ═══ */}
        {tab === 'register' && (
          <form onSubmit={handleSubmit} className="auth-form">

            {/* Username */}
            <div className="auth-field">
              <label htmlFor="reg-username">
                Tên đăng nhập <span style={{ color: 'var(--purple)' }}>*</span>
              </label>
              <input
                id="reg-username"
                type="text"
                placeholder="minhanh99"
                value={regUsername}
                onChange={e => setRegUsername(e.target.value.toLowerCase())}
                required
                autoComplete="username"
                className="auth-input"
                autoCapitalize="none"
                maxLength={20}
              />
              <div className="auth-hint">3–20 ký tự · a–z, 0–9, dấu _ hoặc . · không cần @</div>
            </div>

            {/* Display name */}
            <div className="auth-field">
              <label htmlFor="reg-displayname">Tên hiển thị (trong team)</label>
              <input
                id="reg-displayname"
                type="text"
                placeholder="Ví dụ: Minh Anh (để trống = dùng tên đăng nhập)"
                value={regDisplayName}
                onChange={e => setRegDisplayName(e.target.value)}
                autoComplete="name"
                className="auth-input"
              />
            </div>

            {/* Email */}
            <div className="auth-field">
              <label htmlFor="reg-email">
                Email <span style={{ color: 'var(--purple)' }}>*</span>
              </label>
              <input
                id="reg-email"
                type="email"
                placeholder="hello@gmail.com"
                value={regEmail}
                onChange={e => setRegEmail(e.target.value)}
                required
                autoComplete="email"
                className="auth-input"
              />
              <div className="auth-hint">Dùng để đăng nhập bằng email · bạn cũng có thể dùng tên đăng nhập</div>
            </div>

            {/* Password */}
            <div className="auth-field">
              <label htmlFor="reg-password">
                Mật khẩu <span style={{ color: 'var(--purple)' }}>*</span>
              </label>
              <input
                id="reg-password"
                type="password"
                placeholder="Tối thiểu 6 ký tự"
                value={regPassword}
                onChange={e => setRegPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="auth-input"
                minLength={6}
              />
            </div>

            {error      && <div className="auth-error">⚠️ {error}</div>}
            {successMsg && <div className="auth-success">{successMsg}</div>}

            <button type="submit" className="btn btn-primary auth-submit" disabled={loading} id="auth-submit">
              {loading ? '⏳ Đang tạo tài khoản...' : '✨ Đăng Ký'}
            </button>
          </form>
        )}

        {!isSupabaseEnabled && (
          <div className="auth-notice">
            🔧 Chế độ demo — Thêm VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY để kích hoạt auth thật
          </div>
        )}
      </div>
    </div>
  );
}
