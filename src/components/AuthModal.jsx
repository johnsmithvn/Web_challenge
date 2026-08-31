import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import AppIcon from './AppIcon';
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
      const emailRaw = regEmail.trim().toLowerCase();

      if (!uname) { setError('Vui lòng nhập tên đăng nhập'); setLoading(false); return; }

      // Determine if username is an email
      const usernameIsEmail = isValidEmail(uname);

      // If username is NOT an email → validate as standard username
      if (!usernameIsEmail && !isValidUsername(uname)) {
        setError('Tên đăng nhập: 3–20 ký tự, chỉ dùng a-z, 0-9, dấu _ hoặc .');
        setLoading(false); return;
      }

      // Auto-fill email: if username is email and email field is empty → use username as email
      let emailToUse = emailRaw;
      if (!emailToUse && usernameIsEmail) {
        emailToUse = uname;
      }
      // If still no email → generate placeholder (Supabase auth requires email)
      if (!emailToUse) {
        emailToUse = `${uname}@lifehub.local`;
      } else if (!isValidEmail(emailToUse)) {
        setError('Email không hợp lệ');
        setLoading(false); return;
      }

      // Check duplicate email if user provided a real email (not placeholder)
      if (!emailToUse.endsWith('@lifehub.local')) {
        const { data: emailTaken } = await supabase
          .rpc('email_exists', { p_email: emailToUse });
        if (emailTaken) {
          setError('Email này đã được đăng ký');
          setLoading(false); return;
        }
      }

      // Smart display_name fallback
      const displayName = regDisplayName.trim()
        || (usernameIsEmail ? uname.split('@')[0] : uname);

      const result = await signUp({
        username:    uname,
        email:       emailToUse,
        password:    regPassword,
        displayName,
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
        else if (msg.includes('Database error saving new user'))
          setError('Lỗi cơ sở dữ liệu khi tạo user (kiểm tra trigger handle_new_user hoặc tắt Confirm email trong Supabase Auth)');
        else
          setError(msg);
      } else {
        setSuccessMsg('Đăng ký thành công! Đang đăng nhập...');
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
        <button className="auth-modal__close" onClick={onClose} aria-label="Đóng" id="auth-close"><AppIcon name="x" size={17} /></button>

        {/* Logo */}
        <div className="auth-modal__logo">
          <AppIcon name="sparkle" size={21} weight="duotone" />
          <span className="gradient-text">Life Hub</span>
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
              <AppIcon name={t === 'login' ? 'key' : 'user'} size={15} /> {t === 'login' ? 'Đăng Nhập' : 'Đăng Ký'}
            </button>
          ))}
        </div>

        {/* Google OAuth */}
        <button className="btn btn-ghost auth-google" onClick={handleGoogle} id="auth-google" disabled={loading}>
          <AppIcon name="google" size={18} weight="bold" style={{ flexShrink: 0 }} />
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

            {error      && <div className="auth-error"><AppIcon name="warning" size={15} /> {error}</div>}
            {successMsg && <div className="auth-success"><AppIcon name="checkCircle" size={15} /> {successMsg}</div>}

            <button type="submit" className="btn btn-primary auth-submit" disabled={loading} id="auth-submit">
              <AppIcon name={loading ? 'clock' : 'key'} size={15} /> {loading ? 'Đang xử lý...' : 'Đăng Nhập'}
            </button>
          </form>
        )}

        {/* ═══ REGISTER FORM ═══ */}
        {tab === 'register' && (
          <form onSubmit={handleSubmit} className="auth-form">

            {/* Username (required) */}
            <div className="auth-field">
              <label htmlFor="reg-username">
                Tên đăng nhập <span style={{ color: 'var(--purple)' }}>*</span>
              </label>
              <input
                id="reg-username"
                type="text"
                placeholder="minhanh99  hoặc  hello@gmail.com"
                value={regUsername}
                onChange={e => {
                  const val = e.target.value.toLowerCase().trim();
                  setRegUsername(val);
                  // Auto-fill email if username looks like email and email field is empty
                  if (isValidEmail(val) && !regEmail) {
                    setRegEmail(val);
                  }
                }}
                required
                autoComplete="username"
                className="auth-input"
                autoCapitalize="none"
                maxLength={50}
              />
              <div className="auth-hint">Có thể dùng email làm tên đăng nhập</div>
            </div>

            {/* Password (required) */}
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

            {/* Email (optional) */}
            <div className="auth-field">
              <label htmlFor="reg-email">
                Email <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(tuỳ chọn)</span>
              </label>
              <input
                id="reg-email"
                type="email"
                placeholder="hello@gmail.com (bỏ trống cũng được)"
                value={regEmail}
                onChange={e => setRegEmail(e.target.value)}
                autoComplete="email"
                className="auth-input"
              />
              <div className="auth-hint">Để khôi phục mật khẩu · nếu bỏ trống, chỉ đăng nhập bằng tên đăng nhập + mật khẩu</div>
            </div>

            {/* Display name (optional) */}
            <div className="auth-field">
              <label htmlFor="reg-displayname">
                Tên hiển thị <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(tuỳ chọn)</span>
              </label>
              <input
                id="reg-displayname"
                type="text"
                placeholder={regUsername ? `Mặc định: ${isValidEmail(regUsername) ? regUsername.split('@')[0] : regUsername}` : 'Để trống = dùng tên đăng nhập'}
                value={regDisplayName}
                onChange={e => setRegDisplayName(e.target.value)}
                autoComplete="name"
                className="auth-input"
              />
            </div>

            {error      && <div className="auth-error"><AppIcon name="warning" size={15} /> {error}</div>}
            {successMsg && <div className="auth-success"><AppIcon name="checkCircle" size={15} /> {successMsg}</div>}

            <button type="submit" className="btn btn-primary auth-submit" disabled={loading} id="auth-submit">
              <AppIcon name={loading ? 'clock' : 'user'} size={15} /> {loading ? 'Đang tạo tài khoản...' : 'Đăng Ký'}
            </button>
          </form>
        )}

        {!isSupabaseEnabled && (
          <div className="auth-notice">
            <AppIcon name="gear" size={14} /> Chế độ demo — Thêm VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY để kích hoạt auth thật
          </div>
        )}
      </div>
    </div>
  );
}
