import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import XpBar from './XpBar';
import '../styles/navbar.css';
import '../styles/xpbar.css';
import '../styles/auth.css';

const NAV_LINKS = [
  { to: '/',            label: 'Trang Chủ' },
  { to: '/habits',      label: '📋 Habits' },
  { to: '/tracker',     label: '🗓 Tracker' },
  { to: '/focus',       label: '⏱ Focus' },
  { to: '/journey',     label: '🗺 Lộ Trình' },
  { to: '/team',        label: '🤝 Team' },
  { to: '/dashboard',   label: '📈 Stats' },
  { to: '/quiz',        label: '🧠 Quiz' },
  { to: '/leaderboard', label: '🏆 BXH' },
];


function UserAvatar({ profile, user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = (profile?.display_name || user?.email || 'U')
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="nav-avatar" onClick={() => setOpen(v => !v)} id="nav-avatar" role="button" aria-label="Tài khoản">
        {profile?.avatar_url
          ? <img src={profile.avatar_url} alt={initials} />
          : initials}
      </div>

      {open && (
        <div className="nav-user-menu">
          <div className="nav-user-menu__name">
            {profile?.display_name || user?.email?.split('@')[0]}
          </div>
          <Link to="/dashboard" className="nav-user-menu__item" onClick={() => setOpen(false)}>
            📈 Dashboard
          </Link>
          <Link to="/leaderboard" className="nav-user-menu__item" onClick={() => setOpen(false)}>
            🏆 Leaderboard
          </Link>
          <Link to="/friends" className="nav-user-menu__item" onClick={() => setOpen(false)}>
            👥 Bạn Bè
          </Link>
          <button
            className="nav-user-menu__item nav-user-menu__item--danger"
            onClick={() => { onSignOut(); setOpen(false); }}
            id="nav-signout"
          >
            🚪 Đăng Xuất
          </button>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const [scrolled,   setScrolled]   = useState(false);
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [showAuth,   setShowAuth]   = useState(false);
  const { user, profile, signOut, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location]);

  return (
    <>
      <nav className={`navbar${scrolled ? ' navbar--scrolled' : ''}`}>
        <div className="navbar__inner container">
          {/* Logo */}
          <Link to="/" className="navbar__logo">
            <span className="navbar__logo-icon">⚡</span>
            <span className="navbar__logo-text">Vượt Lười</span>
          </Link>

          {/* Desktop links */}
          <ul className="navbar__links">
            {NAV_LINKS.map(link => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className={`navbar__link${location.pathname === link.to ? ' navbar__link--active' : ''}`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* XP Bar compact */}
          <div className="navbar__xp">
            <XpBar compact />
          </div>

          {/* Auth section */}
          {!loading && (
            user
              ? <UserAvatar profile={profile} user={user} onSignOut={signOut} />
              : (
                <button
                  className="btn btn-primary navbar__cta"
                  onClick={() => setShowAuth(true)}
                  id="navbar-login"
                >
                  🔑 Đăng Nhập
                </button>
              )
          )}

          {/* Mobile toggle */}
          <button
            className={`navbar__burger${menuOpen ? ' open' : ''}`}
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Toggle menu"
            id="navbar-burger"
          >
            <span /><span /><span />
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="navbar__mobile">
            {NAV_LINKS.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`navbar__mobile-link${location.pathname === link.to ? ' active' : ''}`}
              >
                {link.label}
              </Link>
            ))}
            {user && (
              <Link to="/friends" className="navbar__mobile-link">👥 Bạn Bè</Link>
            )}
            <div style={{ padding: '0.5rem 0' }}>
              <XpBar compact />
            </div>
            {user
              ? (
                <button className="btn btn-ghost" style={{ marginTop: '0.5rem' }} onClick={signOut}>
                  🚪 Đăng Xuất
                </button>
              )
              : (
                <button
                  className="btn btn-primary"
                  style={{ marginTop: '0.5rem' }}
                  onClick={() => { setShowAuth(true); setMenuOpen(false); }}
                  id="mobile-login"
                >
                  🔑 Đăng Nhập
                </button>
              )
            }
          </div>
        )}
      </nav>

      {/* Auth Modal */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
