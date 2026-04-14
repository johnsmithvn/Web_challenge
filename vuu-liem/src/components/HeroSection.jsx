import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import '../styles/hero.css';

export default function HeroSection() {
  const titleRef = useRef(null);

  useEffect(() => {
    // Typewriter for subtitle
    const words = ['não bộ', 'hệ thống', 'thói quen nhỏ'];
    let wi = 0, ci = 0, deleting = false;
    const el = document.getElementById('hero-typewriter');
    if (!el) return;
    const tick = () => {
      const word = words[wi];
      if (!deleting) {
        el.textContent = word.slice(0, ci + 1);
        ci++;
        if (ci === word.length) { deleting = true; setTimeout(tick, 1800); return; }
      } else {
        el.textContent = word.slice(0, ci - 1);
        ci--;
        if (ci === 0) { deleting = false; wi = (wi + 1) % words.length; }
      }
      setTimeout(tick, deleting ? 60 : 120);
    };
    const t = setTimeout(tick, 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="hero" id="hero">
      {/* Background orbs */}
      <div className="hero__orb hero__orb--1" />
      <div className="hero__orb hero__orb--2" />
      <div className="hero__orb hero__orb--3" />

      {/* Grid overlay */}
      <div className="hero__grid" />

      <div className="container hero__content">
        <div className="section-label">
          🔥 Chương Trình 21 Ngày
        </div>

        <h1 className="hero__title display-1">
          Thử Thách<br />
          <span className="gradient-text">Vượt Lười</span>
        </h1>

        <p className="hero__subtitle">
          Hiểu <span className="hero__type-word">
            <span id="hero-typewriter">não bộ</span>
            <span className="hero__cursor">|</span>
          </span>
          {' '}→ Tự động kỷ luật
        </p>

        <p className="hero__desc">
          Kỷ luật không cần ý chí thép. Chỉ cần <strong>hệ thống đúng</strong> và{' '}
          <strong>hiểu cách não bộ hoạt động.</strong>
        </p>

        <div className="hero__cta-group">
          <Link to="/tracker" className="btn btn-primary hero__btn-main" id="hero-cta-start">
            🚀 Bắt Đầu Thử Thách
          </Link>
          <a href="#roadmap" className="btn btn-ghost" id="hero-cta-learn">
            📖 Xem Lộ Trình
          </a>
        </div>

        {/* Stats */}
        <div className="hero__stats">
          <div className="hero__stat">
            <span className="hero__stat-num gradient-text">21</span>
            <span className="hero__stat-label">Ngày thử thách</span>
          </div>
          <div className="hero__stat-divider" />
          <div className="hero__stat">
            <span className="hero__stat-num gradient-text">3</span>
            <span className="hero__stat-label">Tuần theo lộ trình</span>
          </div>
          <div className="hero__stat-divider" />
          <div className="hero__stat">
            <span className="hero__stat-num gradient-text">0</span>
            <span className="hero__stat-label">Ý chí cần thiết</span>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="hero__scroll">
        <div className="hero__scroll-dot" />
      </div>
    </section>
  );
}
