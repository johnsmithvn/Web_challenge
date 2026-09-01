import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { ShortcutsModal } from './TiptapEditor';
import AuthModal from './AuthModal';
import XpBar from './XpBar';
import SubAlert from './SubAlert';
import AppIcon from './AppIcon';

import '../styles/navbar.css';
import '../styles/xpbar.css';
import '../styles/auth.css';

/* ── Navigation Structure ──────────────────────────────────── */
// Primary: always visible (bottom tabs on mobile, sidebar on desktop)
const PRIMARY_NAV = [
  { to: '/inbox',     icon: 'inbox', label: 'Inbox' },
  { to: '/tasks',     icon: 'pushPin', label: 'Nhiệm Vụ' },
  { to: '/collect',   icon: 'brain', label: 'Knowledge' },
  { to: '/finance',   icon: 'wallet', label: 'Finance' },
  { to: '/accounts',  icon: 'lock', label: 'Tài Khoản' },
];

// Bottom tabs giữ 5 workflow thường dùng để vùng chạm không bị co quá nhỏ.
const MOBILE_PRIMARY_NAV = PRIMARY_NAV.filter(link => link.to !== '/accounts');

const FINANCE_NAV = [
  { to: '/finance/overview', icon: 'chartDonut', label: 'Tổng quan' },
  { to: '/finance/add', icon: 'plusCircle', label: 'Nhập nhanh', hint: 'N' },
  { to: '/finance/list', icon: 'receipt', label: 'Giao dịch' },
  { to: '/finance/recurring', icon: 'calendar', label: 'Định kỳ & Quỹ' },
  { to: '/finance/cats', icon: 'tree', label: 'Danh mục' },
];

// Secondary: visible in sidebar, hidden in bottom tabs (dropdown)
const SECONDARY_NAV = [
  { to: '/focus',         icon: 'timer',  label: 'Focus' },
];

const MOBILE_MORE_NAV = [
  { to: '/accounts', icon: 'lock', label: 'Tài Khoản' },
  ...SECONDARY_NAV,
];


/* ── User Avatar Dropdown ──────────────────────────────────── */
function UserAvatar({ profile, user, onSignOut, onOpenShortcuts, direction = 'down' }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const avatarRef = useRef(null);
  const menuRef = useRef(null); // ref for the portaled dropdown

  // Close on outside click — must exclude both the avatar AND the portaled menu
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      const inAvatar = avatarRef.current?.contains(e.target);
      const inMenu   = menuRef.current?.contains(e.target);
      if (!inAvatar && !inMenu) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Calculate position when opening
  const handleToggle = () => {
    if (!open && avatarRef.current) {
      const rect = avatarRef.current.getBoundingClientRect();
      if (direction === 'up') {
        setMenuPos({
          left: 12,
          bottom: window.innerHeight - rect.top + 8,
          top: 'auto',
        });
      } else {
        setMenuPos({
          left: rect.left,
          top: rect.bottom + 8,
          bottom: 'auto',
        });
      }
    }
    setOpen(v => !v);
  };

  const initials = (profile?.display_name || user?.email || 'U')
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const dropdownStyle = menuPos ? {
    position: 'fixed',
    left: menuPos.left,
    top: menuPos.top,
    bottom: menuPos.bottom,
    width: 196,
    zIndex: 99999,
  } : {};

  return (
    <div data-avatar-root ref={avatarRef}>
      <div className="nav-avatar" onClick={handleToggle} id="nav-avatar" role="button" aria-label="Tài khoản">
        {profile?.avatar_url
          ? <img src={profile.avatar_url} alt={initials} />
          : initials}
      </div>

      {open && menuPos && createPortal(
        <div ref={menuRef} className="nav-user-menu" style={dropdownStyle}>
          <div className="nav-user-menu__name">
            {profile?.display_name || user?.email?.split('@')[0]}
          </div>
          <button
            className="nav-user-menu__item"
            onClick={() => { onOpenShortcuts?.(); setOpen(false); }}
            id="nav-shortcuts-menu"
          >
            <AppIcon name="keyboard" size={16} /> Phím Tắt
          </button>
          <button
            className="nav-user-menu__item"
            onClick={() => { window.location.href = '/settings'; setOpen(false); }}
            id="nav-settings-menu"
          >
            <AppIcon name="gear" size={16} /> Cài Đặt
          </button>
          <button
            className="nav-user-menu__item nav-user-menu__item--danger"
            onClick={() => { onSignOut(); setOpen(false); }}
            id="nav-signout"
          >
            <AppIcon name="signOut" size={16} /> Đăng Xuất
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}


/* ── Main Navbar Component ─────────────────────────────────── */
export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(() => location.pathname.startsWith('/finance'));
  const [showAuth, setShowAuth] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { user, profile, signOut, loading, isRecoveringPassword } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const moreRef = useRef(null);

  // Auto-open AuthModal in password recovery mode when redirected from recovery email
  useEffect(() => {
    if (isRecoveringPassword) {
      setShowAuth(true);
    }
  }, [isRecoveringPassword]);

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
          <span className="sidebar__logo-icon"><AppIcon name="sparkle" size={21} weight="fill" /></span>
          <span className="sidebar__logo-text">Life Hub</span>
        </Link>

        <nav className="sidebar__nav">
          <div className="sidebar__section-label">Chính</div>
          {PRIMARY_NAV.map(link => link.to === '/finance' ? (
            <div className={`sidebar__nav-group${financeOpen ? ' sidebar__nav-group--open' : ''}`} key={link.to}>
              <button type="button" className={`sidebar__link${isActive('/finance') ? ' sidebar__link--active' : ''}`}
                aria-expanded={financeOpen} aria-controls="finance-sidebar-children"
                onClick={() => {
                  if (!isActive('/finance')) navigate('/finance/overview');
                  setFinanceOpen(open => !open);
                }}>
                <span className="sidebar__link-icon"><AppIcon name={link.icon} size={19} weight={isActive('/finance') ? 'fill' : 'regular'} /></span>
                <span className="sidebar__link-label">{link.label}</span>
                <AppIcon name="caretDown" size={13} className="sidebar__link-caret" />
              </button>
              <div id="finance-sidebar-children" className="sidebar__children"
                aria-label="Điều hướng Finance" aria-hidden={!financeOpen}>
                <div className="sidebar__children-inner">
                  {FINANCE_NAV.map(child => (
                    <Link key={child.to} to={child.to} tabIndex={financeOpen ? undefined : -1}
                      className={`sidebar__child${location.pathname === child.to || (child.to.endsWith('/overview') && location.pathname === '/finance') ? ' sidebar__child--active' : ''}`}>
                      <AppIcon name={child.icon} size={15} weight={location.pathname === child.to ? 'fill' : 'regular'} />
                      <span>{child.label}</span>
                      {child.hint && <kbd>{child.hint}</kbd>}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <Link key={link.to} to={link.to}
              className={`sidebar__link${isActive(link.to) ? ' sidebar__link--active' : ''}`}>
              <span className="sidebar__link-icon"><AppIcon name={link.icon} size={19} weight={isActive(link.to) ? 'fill' : 'regular'} /></span>
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
              <span className="sidebar__link-icon"><AppIcon name={link.icon} size={18} weight={isActive(link.to) ? 'fill' : 'regular'} /></span>
              <span className="sidebar__link-label">{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar__bottom">

          <SubAlert />
          <div className="sidebar__xp">
            <XpBar compact />
          </div>

          {/* Login button — always visible when no user (no loading guard) */}
          {!user && (
            <button
              className="btn btn-primary sidebar__login"
              onClick={() => setShowAuth(true)}
              id="navbar-login"
            >
              <AppIcon name="key" size={16} /> Đăng Nhập
            </button>
          )}

          <div className="sidebar__actions">
            {!loading && user && (
              <UserAvatar profile={profile} user={user} onSignOut={signOut} onOpenShortcuts={() => setShortcutsOpen(true)} direction="up" />
            )}
            <button
              className="sidebar__theme-toggle"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              aria-label="Toggle theme"
              id="navbar-theme-toggle"
            >
              <AppIcon name={theme === 'dark' ? 'sun' : 'moon'} size={18} weight="fill" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MOBILE TOP BAR (<769px) ──────────────────────────── */}
      <header className="topbar">
        <Link to="/" className="topbar__logo">
          <AppIcon name="sparkle" size={18} weight="fill" /> Life Hub
        </Link>

        <div className="topbar__right">
          <button
            className="topbar__theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            <AppIcon name={theme === 'dark' ? 'sun' : 'moon'} size={17} weight="fill" />
          </button>
          {user
            ? <UserAvatar profile={profile} user={user} onSignOut={signOut} onOpenShortcuts={() => setShortcutsOpen(true)} direction="down" />
            : (
              <button
                className="btn btn-primary topbar__login"
                onClick={() => setShowAuth(true)}
                id="mobile-login"
              >
                <AppIcon name="key" size={16} />
              </button>
            )
          }
        </div>
      </header>

      {/* ── MOBILE BOTTOM TABS (<769px) ──────────────────────── */}
      <nav className="bottom-tabs">
        {MOBILE_PRIMARY_NAV.map(link => (
          <Link
            key={link.to}
            to={link.to}
            className={`bottom-tabs__tab${isActive(link.to) ? ' bottom-tabs__tab--active' : ''}`}
          >
            <span className="bottom-tabs__icon"><AppIcon name={link.icon} size={21} weight={isActive(link.to) ? 'fill' : 'regular'} /></span>
            <span className="bottom-tabs__label">{link.label}</span>
          </Link>
        ))}

        {/* More button for secondary nav */}
        <div className="bottom-tabs__more-wrapper" ref={moreRef}>
          <button
            className={`bottom-tabs__tab${moreOpen ? ' bottom-tabs__tab--active' : ''}`}
            onClick={() => setMoreOpen(v => !v)}
          >
            <span className="bottom-tabs__icon"><AppIcon name="list" size={21} /></span>
            <span className="bottom-tabs__label">Thêm</span>
          </button>

          {moreOpen && (
            <div className="bottom-tabs__dropdown">
              {MOBILE_MORE_NAV.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`bottom-tabs__dropdown-item${isActive(link.to) ? ' active' : ''}`}
                  onClick={() => setMoreOpen(false)}
                >
                  <AppIcon name={link.icon} size={17} /> {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Auth Modal */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      {/* Shortcuts Modal */}
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}
