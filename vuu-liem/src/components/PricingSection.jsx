import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/sections.css';

const FEATURES = [
  'Lộ trình 3 tuần có cấu trúc',
  'Habit Tracker tương tác hàng ngày',
  'Streak system + Badge + XP thưởng',
  'Dashboard phân tích tiến độ cá nhân',
  'Team Mode — accountability cùng bạn bè',
  'Quiz não bộ + Daily Challenge',
  'Kiến thức: Dopamine, MVA, Amygdala',
];

// Persist end date across reloads (7-day rolling window)
function getEndDate() {
  const stored = localStorage.getItem('vl_promo_end');
  if (stored) {
    const d = new Date(parseInt(stored, 10));
    if (d > new Date()) return d; // still valid
  }
  // Set 7-day window from now
  const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  localStorage.setItem('vl_promo_end', end.getTime().toString());
  return end;
}

const END_DATE = getEndDate();

function useCountdown(targetDate) {
  const calc = () => {
    const diff = Math.max(0, targetDate - Date.now());
    return {
      d: Math.floor(diff / 86_400_000),
      h: Math.floor((diff % 86_400_000) / 3_600_000),
      m: Math.floor((diff % 3_600_000) / 60_000),
      s: Math.floor((diff % 60_000) / 1_000),
    };
  };
  const [time, setTime] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export default function PricingSection() {
  const { d, h, m, s } = useCountdown(END_DATE);
  const urgent = d === 0 && h < 6;

  return (
    <section className="section pricing-section" id="pricing">
      <div className="container">
        <div className="section-label">💰 Tham Gia</div>
        <h2 className="display-2" style={{ marginBottom: '0.5rem' }}>
          Bắt Đầu <span className="gradient-text">Ngay Hôm Nay</span>
        </h2>
        <p className="section-desc" style={{ margin: '0 auto 2.5rem' }}>
          Một quyết định nhỏ — thay đổi 21 ngày
        </p>

        <div className="pricing-card glass-panel">
          <span className="pricing-popular">🔥 Phổ biến nhất</span>

          <h3 className="h2" style={{ margin: '0.5rem 0 0.25rem' }}>Thử Thách Vượt Lười</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Chương trình 21 ngày đầy đủ</p>

          <div className="pricing-price">200.000<span> VND</span></div>

          {/* Persistent countdown */}
          <div style={{ marginBottom: '0.5rem' }}>
            <p style={{ fontSize: '0.85rem', color: urgent ? 'var(--red)' : 'var(--text-muted)', marginBottom: '0.5rem' }}>
              {urgent ? '🚨 Ưu đãi sắp hết!' : '⏳ Ưu đãi kết thúc sau:'}
            </p>
            <div className="countdown">
              {d > 0 && (
                <>
                  <div className="countdown-block">
                    <span className="countdown-num">{String(d).padStart(2,'0')}</span>
                    <span className="countdown-label">Ngày</span>
                  </div>
                  <span className="countdown-sep">:</span>
                </>
              )}
              <div className="countdown-block">
                <span className="countdown-num" style={{ color: urgent ? 'var(--red)' : undefined }}>
                  {String(h).padStart(2,'0')}
                </span>
                <span className="countdown-label">Giờ</span>
              </div>
              <span className="countdown-sep">:</span>
              <div className="countdown-block">
                <span className="countdown-num">{String(m).padStart(2,'0')}</span>
                <span className="countdown-label">Phút</span>
              </div>
              <span className="countdown-sep">:</span>
              <div className="countdown-block">
                <span className="countdown-num">{String(s).padStart(2,'0')}</span>
                <span className="countdown-label">Giây</span>
              </div>
            </div>
          </div>

          <ul className="pricing-features">
            {FEATURES.map((f, i) => <li key={i}>{f}</li>)}
          </ul>

          <Link
            to="/tracker"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '1rem', fontSize: '1.05rem' }}
            id="pricing-cta"
          >
            🚀 Đăng Ký Ngay — 200.000 VND
          </Link>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem', textAlign: 'center' }}>
            🔒 Không cần thẻ tín dụng • Bắt đầu ngay hôm nay
          </p>
        </div>
      </div>
    </section>
  );
}
