import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import AppIcon from './AppIcon';
import '../styles/auth.css';

const art = (name) => `${import.meta.env.BASE_URL}art/auth/auth-${name}.svg`;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const TITLES = {
  login: 'Đăng nhập',
  register: 'Tạo tài khoản',
  forgot: 'Khôi phục mật khẩu',
  updatePassword: 'Đặt mật khẩu mới',
};

export default function AuthModal({ onClose }) {
  const {
    signIn,
    signUp,
    signInWithGoogle,
    resetPassword,
    updatePassword,
    isRecoveringPassword,
    setIsRecoveringPassword,
    isSupabaseEnabled,
  } = useAuth();
  const [tab, setTab] = useState(isRecoveringPassword ? 'updatePassword' : 'login');

  // Register fields
  const [regUsername,    setRegUsername]    = useState('');
  const [regEmail,       setRegEmail]       = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regPassword,    setRegPassword]    = useState('');

  // Login fields
  const [loginId,      setLoginId]      = useState(''); // username OR email
  const [loginPassword, setLoginPassword] = useState('');

  // Forgot / Reset fields
  const [forgotId, setForgotId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const reset = () => { setError(''); setSuccessMsg(''); };

  // ── Đèn pin: bấm icon mắt ở ô mật khẩu → màn chuyển đêm, chữ chỉ hiện chỗ có ánh sáng ──
  const [night, setNight] = useState(false);
  const nightOn = night && tab === 'login';
  const passwordRef = useRef(null);
  const eyeRef = useRef(null);
  const beamRef = useRef(null);
  const torchRef = useRef(null);
  const revealRef = useRef(null);
  const revealTextRef = useRef(null);
  const owlRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const angleRef = useRef(Math.PI);

  const toggleNight = () => {
    if (!night) {
      // Bật lên thì đèn chiếu dọc ô mật khẩu sang trái, như chưa rê chuột.
      const field = passwordRef.current.getBoundingClientRect();
      pointerRef.current = { x: field.left, y: field.top + field.height / 2 };
      angleRef.current = Math.PI;
    }
    setNight(!night);
  };

  useEffect(() => {
    if (!nightOn) return undefined;
    const input = passwordRef.current;
    const owl = owlRef.current;

    const update = () => {
      const eyeRect = eyeRef.current.getBoundingClientRect();
      const fieldRect = input.getBoundingClientRect();
      const pointer = pointerRef.current;
      const eyeX = eyeRect.left + eyeRect.width / 2;
      const eyeY = eyeRect.top + eyeRect.height / 2;
      const pointerDistance = Math.hypot(pointer.x - eyeX, pointer.y - eyeY);
      if (pointerDistance > 24) angleRef.current = Math.atan2(pointer.y - eyeY, pointer.x - eyeX);
      const angle = angleRef.current;
      const angleDeg = angle * 180 / Math.PI;
      const unitX = Math.cos(angle);
      const unitY = Math.sin(angle);
      const originX = eyeX + unitX * 13;
      const originY = eyeY + unitY * 13;
      const beamLength = clamp(pointerDistance * 1.65, 160, 1600);
      const beamHeight = beamLength * 0.38;

      const beam = beamRef.current.style;
      beam.width = `${beamLength}px`;
      beam.height = `${beamHeight}px`;
      beam.transform = `translate(${originX}px, ${originY - beamHeight / 2}px) rotate(${angleDeg}deg)`;
      torchRef.current.style.transform = `translate(${eyeX - 17}px, ${eyeY - 17}px) rotate(${angleDeg}deg)`;

      const reveal = revealRef.current.style;
      reveal.width = `${Math.max(0, fieldRect.width - 45)}px`;
      reveal.height = `${fieldRect.height}px`;
      reveal.transform = `translate(${fieldRect.left}px, ${fieldRect.top}px)`;
      revealTextRef.current.style.transform = `translateX(${-input.scrollLeft}px)`;

      // Độ sáng 0–1 tại một điểm: trong nón sáng, mờ dần ở mép và cuối nón.
      const lightAt = (x, y) => {
        const offsetX = x - originX;
        const offsetY = y - originY;
        const along = offsetX * unitX + offsetY * unitY;
        if (along < 0) return 0;
        const sideways = Math.abs(-offsetX * unitY + offsetY * unitX);
        const halfBeam = beamHeight * (0.01 + 0.49 * along / beamLength);
        const edgeFade = clamp((halfBeam - sideways + 4) / 16, 0, 1);
        const tail = clamp((along / beamLength - 0.55) / 0.41, 0, 1);
        return edgeFade * (1 - tail * tail * (3 - 2 * tail));
      };
      const midY = fieldRect.top + fieldRect.height / 2;
      for (const char of revealTextRef.current.children) {
        const box = char.getBoundingClientRect();
        char.style.setProperty('--lit', String(lightAt(box.left + box.width / 2, midY)));
      }

      const owlBox = owl.getBoundingClientRect();
      const owlX = owlBox.left + owlBox.width / 2;
      const owlLight = lightAt(owlX, owlBox.top + owlBox.height / 2);
      const lit = owlLight > 0.08;
      const dx = originX - owlX;
      const dy = originY - (owlBox.top + owlBox.height * 0.36);
      const distance = Math.max(1, Math.hypot(dx, dy));
      const gazeX = lit ? dx / distance : 0;
      const gazeY = lit ? dy / distance : 0;
      owl.style.opacity = String(owlLight);
      owl.classList.toggle('is-lit', lit);
      owl.style.setProperty('--owl-gaze-x', `${gazeX * 3.2}px`);
      owl.style.setProperty('--owl-gaze-y', `${gazeY * 2.6}px`);
      owl.style.setProperty('--owl-head-x', `${gazeX * 2}px`);
      owl.style.setProperty('--owl-head-y', `${gazeY * 1.2}px`);
      owl.style.setProperty('--owl-tilt', `${gazeX * 9}deg`);
    };

    const onPointerMove = (event) => {
      pointerRef.current = { x: event.clientX, y: event.clientY };
      update();
    };

    update();
    document.addEventListener('pointermove', onPointerMove);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    input.addEventListener('scroll', update);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      input.removeEventListener('scroll', update);
      owl.style.opacity = '0';
      owl.classList.remove('is-lit');
    };
  }, [nightOn, loginPassword]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setIsRecoveringPassword(false);
      onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, setIsRecoveringPassword]);

  // ── Validation helpers ──
  const isValidUsername = (v) => /^[a-z0-9_.]{3,20}$/.test(v);
  const isValidEmail    = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isSupabaseEnabled) { setError('Supabase chưa được cấu hình. Cần thêm env keys.'); return; }

    setLoading(true); reset();

    if (tab === 'forgot') {
      if (!forgotId.trim()) { setError('Vui lòng nhập tên đăng nhập hoặc email'); setLoading(false); return; }
      const res = await resetPassword(forgotId);
      setLoading(false);
      if (res?.error) {
        setError(res.error.message === 'username_not_found'
          ? 'Không tìm thấy tài khoản với tên đăng nhập hoặc email này'
          : (res.error.message || 'Không thể gửi email khôi phục'));
      } else {
        setSuccessMsg('Đã gửi email khôi phục! Vui lòng kiểm tra hộp thư đến (hoặc thư rác) của bạn.');
      }
      return;
    }

    if (tab === 'updatePassword') {
      if (newPassword.length < 6) {
        setError('Mật khẩu mới phải có ít nhất 6 ký tự'); setLoading(false); return;
      }
      if (newPassword !== confirmPassword) {
        setError('Mật khẩu xác nhận không khớp'); setLoading(false); return;
      }
      const res = await updatePassword(newPassword);
      setLoading(false);
      if (res?.error) {
        setError(res.error.message || 'Không thể cập nhật mật khẩu');
      } else {
        setSuccessMsg('Đổi mật khẩu thành công! Đang tự động hoàn tất...');
        setTimeout(() => {
          onClose?.();
        }, 1200);
      }
      return;
    }

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

  const handleClose = () => {
    setIsRecoveringPassword(false);
    onClose?.();
  };

  const message = (
    <>
      {error      && <div className="auth-error" role="alert"><AppIcon name="warning" size={15} /> {error}</div>}
      {successMsg && <div className="auth-success" role="status"><AppIcon name="checkCircle" size={15} /> {successMsg}</div>}
    </>
  );

  return (
    <div className={`auth-screen${nightOn ? ' is-night' : ''}`} role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="auth-landscape auth-landscape--page" aria-hidden="true">
        <img className="auth-land auth-day" src={art('scene-day')} alt="" />
        <img className="auth-land auth-night" src={art('scene-night')} alt="" />
      </div>

      <div className="auth-card">
        <button className="auth-close" onClick={handleClose} aria-label="Đóng" id="auth-close"><AppIcon name="x" size={17} /></button>

        <section className="auth-scene">
          <div className="auth-landscape" aria-hidden="true">
            <div className="auth-sky">
              <img className="auth-sun" src={art('sun')} alt="" />
              <img className="auth-moon" src={art('moon')} alt="" />
            </div>
            <img className="auth-land auth-day" src={art('panel-day')} alt="" />
            <img className="auth-land auth-night" src={art('panel-night')} alt="" />
          </div>
          <div className="auth-scene__copy">
            <h2>Life Hub</h2>
            <p>Nhiệm vụ, tài chính, ghi chú và mọi thứ của bạn ở một chỗ.</p>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-body">
            <h1 className="auth-title" id="auth-title">{TITLES[tab]}</h1>

            {(tab === 'login' || tab === 'register') && (
              <>
                <button className="auth-google" onClick={handleGoogle} id="auth-google" disabled={loading} type="button">
                  <AppIcon name="google" size={18} weight="bold" />
                  Tiếp tục với Google
                </button>
                <div className="auth-divider"><span>hoặc</span></div>
              </>
            )}

            {/* ═══ LOGIN FORM ═══ */}
            {tab === 'login' && (
              <form onSubmit={handleSubmit} className="auth-form">
                <div className="auth-field">
                  <label className="sr-only" htmlFor="login-id">Tên đăng nhập hoặc Email</label>
                  <input
                    id="login-id"
                    type="text"
                    placeholder="Tên đăng nhập hoặc email"
                    value={loginId}
                    onChange={e => setLoginId(e.target.value)}
                    required
                    autoComplete="username"
                    className="auth-entry"
                    autoCapitalize="none"
                  />
                  <div className="auth-owl" ref={owlRef} aria-hidden="true">
                    <div className="auth-owl__art">
                      <img src={art('owl-perch')} alt="" />
                      <div className="auth-owl__breath">
                        <img src={art('owl-body')} alt="" />
                        <div className="auth-owl__head">
                          <img src={art('owl-head')} alt="" />
                          <div className="auth-owl__eyes">
                            <img src={art('owl-eyes')} alt="" />
                            <div className="auth-owl__gaze"><img src={art('owl-gaze')} alt="" /></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="auth-field auth-field--secret">
                  <label className="sr-only" htmlFor="login-password">Mật khẩu</label>
                  <input
                    ref={passwordRef}
                    id="login-password"
                    type="password"
                    placeholder="Mật khẩu"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="auth-entry"
                    minLength={6}
                  />
                  <button
                    ref={eyeRef}
                    className="auth-eye"
                    type="button"
                    onClick={toggleNight}
                    aria-pressed={nightOn}
                    aria-controls="login-password"
                    aria-label={nightOn ? 'Tắt đèn pin' : 'Soi mật khẩu bằng đèn pin'}
                    title={nightOn ? 'Tắt đèn pin' : 'Soi mật khẩu bằng đèn pin'}
                  >
                    <AppIcon name="eye" size={19} weight="bold" />
                  </button>
                </div>

                <button type="button" className="auth-link auth-forgot" onClick={() => { setTab('forgot'); reset(); }}>
                  Quên mật khẩu?
                </button>

                {message}

                <button type="submit" className="auth-submit" disabled={loading} id="auth-submit">
                  {loading ? 'Đang xử lý...' : <>Đăng nhập <AppIcon name="arrowRight" size={17} /></>}
                </button>
                <p className="auth-switch">
                  Chưa có tài khoản? <button type="button" className="auth-link" onClick={() => { setTab('register'); reset(); }}>Đăng ký</button>
                </p>
              </form>
            )}

            {/* ═══ REGISTER FORM ═══ */}
            {tab === 'register' && (
              <form onSubmit={handleSubmit} className="auth-form">
                <div className="auth-field">
                  <label className="sr-only" htmlFor="reg-username">Tên đăng nhập</label>
                  <input
                    id="reg-username"
                    type="text"
                    placeholder="Tên đăng nhập *"
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
                    className="auth-entry"
                    autoCapitalize="none"
                    maxLength={50}
                  />
                  <div className="auth-hint">Có thể dùng email làm tên đăng nhập</div>
                </div>

                <div className="auth-field">
                  <label className="sr-only" htmlFor="reg-password">Mật khẩu</label>
                  <input
                    id="reg-password"
                    type="password"
                    placeholder="Mật khẩu * (tối thiểu 6 ký tự)"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="auth-entry"
                    minLength={6}
                  />
                </div>

                <div className="auth-field">
                  <label className="sr-only" htmlFor="reg-email">Email (tuỳ chọn)</label>
                  <input
                    id="reg-email"
                    type="email"
                    placeholder="Email (tuỳ chọn)"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    autoComplete="email"
                    className="auth-entry"
                  />
                  <div className="auth-hint">Để khôi phục mật khẩu · bỏ trống thì chỉ đăng nhập bằng tên đăng nhập</div>
                </div>

                <div className="auth-field">
                  <label className="sr-only" htmlFor="reg-displayname">Tên hiển thị (tuỳ chọn)</label>
                  <input
                    id="reg-displayname"
                    type="text"
                    placeholder={regUsername ? `Tên hiển thị · mặc định: ${isValidEmail(regUsername) ? regUsername.split('@')[0] : regUsername}` : 'Tên hiển thị (tuỳ chọn)'}
                    value={regDisplayName}
                    onChange={e => setRegDisplayName(e.target.value)}
                    autoComplete="name"
                    className="auth-entry"
                  />
                </div>

                {message}

                <button type="submit" className="auth-submit" disabled={loading} id="auth-submit">
                  {loading ? 'Đang tạo tài khoản...' : <>Đăng ký <AppIcon name="arrowRight" size={17} /></>}
                </button>
                <p className="auth-switch">
                  Đã có tài khoản? <button type="button" className="auth-link" onClick={() => { setTab('login'); reset(); }}>Đăng nhập</button>
                </p>
              </form>
            )}

            {/* ═══ FORGOT PASSWORD FORM ═══ */}
            {tab === 'forgot' && (
              <form onSubmit={handleSubmit} className="auth-form">
                <p className="auth-desc">
                  Nhập tên đăng nhập hoặc email đã đăng ký. Liên kết đặt lại mật khẩu sẽ được gửi về email của bạn.
                </p>
                <div className="auth-field">
                  <label className="sr-only" htmlFor="forgot-id">Tên đăng nhập hoặc Email</label>
                  <input
                    id="forgot-id"
                    type="text"
                    placeholder="Tên đăng nhập hoặc email"
                    value={forgotId}
                    onChange={e => setForgotId(e.target.value)}
                    required
                    autoComplete="email"
                    className="auth-entry"
                    autoCapitalize="none"
                  />
                </div>

                {message}

                <button type="submit" className="auth-submit" disabled={loading}>
                  {loading ? 'Đang gửi...' : <>Gửi liên kết khôi phục <AppIcon name="arrowRight" size={17} /></>}
                </button>
                <p className="auth-switch">
                  <button type="button" className="auth-link" onClick={() => { setTab('login'); reset(); }}>← Quay lại đăng nhập</button>
                </p>
              </form>
            )}

            {/* ═══ UPDATE PASSWORD FORM ═══ */}
            {tab === 'updatePassword' && (
              <form onSubmit={handleSubmit} className="auth-form">
                <p className="auth-desc">Nhập mật khẩu mới cho tài khoản của bạn.</p>
                <div className="auth-field">
                  <label className="sr-only" htmlFor="new-password">Mật khẩu mới</label>
                  <input
                    id="new-password"
                    type="password"
                    placeholder="Mật khẩu mới"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="auth-entry"
                    minLength={6}
                  />
                </div>
                <div className="auth-field">
                  <label className="sr-only" htmlFor="confirm-new-password">Xác nhận mật khẩu mới</label>
                  <input
                    id="confirm-new-password"
                    type="password"
                    placeholder="Nhập lại mật khẩu mới"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="auth-entry"
                    minLength={6}
                  />
                </div>

                {message}

                <button type="submit" className="auth-submit" disabled={loading}>
                  {loading ? 'Đang cập nhật...' : <>Cập nhật mật khẩu <AppIcon name="arrowRight" size={17} /></>}
                </button>
              </form>
            )}

            {!isSupabaseEnabled && (
              <div className="auth-notice">
                <AppIcon name="gear" size={14} /> Chế độ demo — Thêm VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY để kích hoạt auth thật
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="auth-beam" ref={beamRef} aria-hidden="true" />
      <div className="auth-reveal" ref={revealRef} aria-hidden="true">
        <span ref={revealTextRef}>
          {nightOn && Array.from(loginPassword, (letter, i) => (
            <span className="auth-reveal__char" key={i}>
              <span className="auth-reveal__mask">•</span>
              <span className="auth-reveal__plain">{letter}</span>
            </span>
          ))}
        </span>
      </div>
      <div className="auth-torch" ref={torchRef} aria-hidden="true"><img src={art('flashlight')} alt="" /></div>
    </div>
  );
}
