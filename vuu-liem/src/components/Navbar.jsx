import { useState, useEffect } from 'react';
import '../styles/navbar.css';
import '../styles/xpbar.css';
import { Link, useLocation } from 'react-router-dom';
import XpBar from './XpBar';

const NAV_LINKS = [
  { to: '/',            label: 'Trang Chủ' },
  { to: '/tracker',     label: '📊 Tracker' },
  { to: '/team',        label: '🤝 Đồng Đội' },
  { to: '/dashboard',   label: '📈 Dashboard' },
  { to: '/quiz',        label: '🧠 Quiz' },
  { to: '/leaderboard', label: '🏆 BXH' },
];

export default function Navbar() {
  const [scrolled,  setScrolled]  = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location]);

  return (
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

        {/* CTA */}
        <Link to="/tracker" className="btn btn-primary navbar__cta" id="navbar-cta">
          🚀 Bắt Đầu
        </Link>

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
          <div style={{ padding: '0.5rem 0' }}>
            <XpBar compact />
          </div>
          <Link to="/tracker" className="btn btn-primary" style={{ marginTop: '0.5rem' }} id="mobile-cta">
            🚀 Bắt Đầu Ngay
          </Link>
        </div>
      )}
    </nav>
  );
}
