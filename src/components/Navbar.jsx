import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import AuthModal from './AuthModal';
import XpBar from './XpBar';
import SubAlert from './SubAlert';
import DailyReview from './DailyReview';
import '../styles/navbar.css';
import '../styles/xpbar.css';
import '../styles/auth.css';

/* ── Navigation Structure ──────────────────────────────────── */
// Primary: always visible (bottom tabs on mobile, sidebar on desktop)
const PRIMARY_NAV = [
  { to: '/tracker',   icon: '🏠', label: 'Today' },
  { to: '/inbox',     icon: '📥', label: 'Inbox' },
  { to: '/collect',   icon: '📓', label: 'Collect' },
  { to: '/finance',   icon: '💰', label: 'Finance' },
  { to: '/life-log',  icon: '📅', label: 'Life Log' },
];

// Secondary: visible in sidebar, hidden in bottom tabs (dropdown)
const SECONDARY_NAV = [
  { to: '/focus',         icon: '⏱',  label: 'Focus' },
  { to: '/journey',       icon: '🗺', label: 'Lộ Trình' },
  { to: '/dashboard',     icon: '📈', label: 'Stats' },
  { to: '/quiz',          icon: '🧠', label: 'Quiz' },
  { to: '/leaderboard',   icon: '🏆', label: 'BXH' },
  { to: '/life-journey',  icon: '💛', label: 'Hành Trình' },
];


/* ── User Avatar Dropdown ──────────────────────────────────── */
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


/* ── Main Navbar Component ─────────────────────────────────── */
export default function Navbar() {
  const [moreOpen, setMoreOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const { user, profile, signOut, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const moreRef = useRef(null);

  // Close "more" dropdown on route change
  useEffect(() => { setMoreOpen(false); }, [location]);

  // Close "more" dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isActive = (to) => location.pathname === to || location.pathname.startsWith(to + '/');

  // Hide navbar entirely on landing page when not logged in
  const isLanding = location.pathname === '/';
  if (isLanding && !user) return showAuth ? <AuthModal onClose={() => setShowAuth(false)} /> : null;

  return (
    <>
      {/* ── DESKTOP SIDEBAR (≥769px) ─────────────────────────── */}
      <aside className="sidebar">
        <Link to="/" className="sidebar__logo">
          <span className="sidebar__logo-icon">⚡</span>
          <span className="sidebar__logo-text">Life Hub</span>
        </Link>

        <nav className="sidebar__nav">
          <div className="sidebar__section-label">Chính</div>
          {PRIMARY_NAV.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`sidebar__link${isActive(link.to) ? ' sidebar__link--active' : ''}`}
            >
              <span className="sidebar__link-icon">{link.icon}</span>
              <span className="sidebar__link-label">{link.label}</span>
            </Link>
          ))}

          <div className="sidebar__divider" />
          <div className="sidebar__section-label">Khác</div>
          {SECONDARY_NAV.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`sidebar__link sidebar__link--secondary${isActive(link.to) ? ' sidebar__link--active' : ''}`}
            >
              <span className="sidebar__link-icon">{link.icon}</span>
              <span className="sidebar__link-label">{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar__bottom">
          <DailyReview />
          <SubAlert />
          <div className="sidebar__xp">
            <XpBar compact />
          </div>
          <button
            className="sidebar__theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            aria-label="Toggle theme"
            id="navbar-theme-toggle"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {!loading && (
            user
              ? <UserAvatar profile={profile} user={user} onSignOut={signOut} />
              : (
                <button
                  className="btn btn-primary sidebar__login"
                  onClick={() => setShowAuth(true)}
                  id="navbar-login"
                >
                  🔑 Đăng Nhập
                </button>
              )
          )}
        </div>
      </aside>

      {/* ── MOBILE TOP BAR (<769px) ──────────────────────────── */}
      <header className="topbar">
        <Link to="/" className="topbar__logo">
          <span>⚡</span> Life Hub
        </Link>

        <div className="topbar__right">
          <button
            className="topbar__theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {!loading && (
            user
              ? <UserAvatar profile={profile} user={user} onSignOut={signOut} />
              : (
                <button
                  className="btn btn-primary topbar__login"
                  onClick={() => setShowAuth(true)}
                  id="mobile-login"
                >
                  🔑
                </button>
              )
          )}
        </div>
      </header>

      {/* ── MOBILE BOTTOM TABS (<769px) ──────────────────────── */}
      <nav className="bottom-tabs">
        {PRIMARY_NAV.map(link => (
          <Link
            key={link.to}
            to={link.to}
            className={`bottom-tabs__tab${isActive(link.to) ? ' bottom-tabs__tab--active' : ''}`}
          >
            <span className="bottom-tabs__icon">{link.icon}</span>
            <span className="bottom-tabs__label">{link.label}</span>
          </Link>
        ))}

        {/* More button for secondary nav */}
        <div className="bottom-tabs__more-wrapper" ref={moreRef}>
          <button
            className={`bottom-tabs__tab${moreOpen ? ' bottom-tabs__tab--active' : ''}`}
            onClick={() => setMoreOpen(v => !v)}
          >
            <span className="bottom-tabs__icon">☰</span>
            <span className="bottom-tabs__label">Thêm</span>
          </button>

          {moreOpen && (
            <div className="bottom-tabs__dropdown">
              {SECONDARY_NAV.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`bottom-tabs__dropdown-item${isActive(link.to) ? ' active' : ''}`}
                  onClick={() => setMoreOpen(false)}
                >
                  <span>{link.icon}</span> {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Auth Modal */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}
