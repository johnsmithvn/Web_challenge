/**
 * LandingPage — cửa đăng nhập và bản đồ workflow chính của Life Hub.
 *
 * MODULES là bản đồ workflow gọn trên landing; module mới phải cập nhật cả
 * mảng này và docs/FEATURES.md để copy không lệch source.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import AuthModal from '../components/AuthModal';
import AppIcon from '../components/AppIcon';
import '../styles/landing.css';

const FLOW = [
  { icon: 'inbox', label: 'Ghi vào Inbox', desc: 'Nghĩ ra gì gõ vào đó, chưa cần phân loại' },
  { icon: 'funnel', label: 'Phân loại sau', desc: 'Lúc rảnh mới quyết định nó là việc, kiến thức hay khoản chi' },
  { icon: 'checkCircle', label: 'Xử lý đúng chỗ', desc: 'Mỗi loại đi về đúng module của nó' },
];

const MODULES = [
  {
    to: '/inbox', icon: 'inbox', name: 'Inbox', accent: 'var(--purple-light)',
    desc: 'Hộp thu gom mọi ý nghĩ chưa phân loại.',
    points: [
      'Ghi nhanh một dòng, tự nhận diện URL',
      'Snooze lại 1 tuần → 3 tháng',
      'Chuyển thẳng thành Nhiệm vụ / Bài viết / Khoản chi / Dự định',
      'Chọn nhiều item để phân loại hoặc xoá hàng loạt',
    ],
  },
  {
    to: '/tasks', icon: 'pushPin', name: 'Nhiệm Vụ', accent: '#22d3ee',
    desc: 'Danh sách việc cần làm, tách hẳn khỏi mọi thứ khác.',
    points: [
      'Chia 3 khối: Quá hạn / Hôm nay / Sắp tới',
      '5 mức ưu tiên, dải màu nhìn là biết việc gấp',
      'Lặp theo ngày / tuần / tháng, tự sinh lần kế tiếp',
      'Lịch tháng xem việc đã xong',
      'Mở chi tiết: các thay đổi đã ghi nhận + ghi chú riêng',
    ],
  },
  {
    to: '/collect', icon: 'brain', name: 'Knowledge', accent: '#a78bfa',
    desc: 'Kho bài viết cá nhân, viết và đọc lại.',
    points: [
      'Trình soạn thảo đầy đủ: bảng, checklist, ảnh, YouTube, audio',
      'Phân loại theo 7 kiểu: ghi chú, trích dẫn, học, ý tưởng…',
      'Gắn tag, thêm ghi chú phụ cho từng bài',
      'Liên kết bài viết với nhiệm vụ',
    ],
  },
  {
    to: '/finance', icon: 'money', name: 'Finance', accent: '#00cc6e',
    desc: 'Sổ tiền cá nhân theo kỳ, nghĩa vụ và mục tiêu.',
    points: [
      'Ghi khoản chi, thu nhập và tiết kiệm; hiểu 50k, 89$',
      'Tổng quan, ngân sách, thống kê và danh mục theo kỳ',
      'Theo dõi hóa đơn, thu nhập định kỳ, khoản vay và thẻ',
      'Quỹ tiết kiệm, CSV và liên kết Nhiệm vụ / Inbox',
    ],
  },
  {
    to: '/focus', icon: '⏱', name: 'Focus', accent: '#f97316',
    desc: 'Pomodoro 25/5/15 để làm việc sâu.',
    points: [
      'Vòng đếm ngược, tự chuyển phiên làm / nghỉ',
      'Tự chỉnh độ dài từng phiên',
      'Thống kê số phiên và số phút hôm nay',
    ],
  },
  {
    to: '/accounts', icon: 'key', name: 'Account Vault', accent: '#ec4899',
    desc: 'Kho tài khoản và secret được mã hóa trước khi rời trình duyệt.',
    points: [
      'Mở khóa riêng bằng Vault passphrase',
      'Mã hóa toàn bộ nội dung item bằng AES-GCM',
      'Lưu field, mã khôi phục, lịch sử và liên kết item',
      'Tạo password ngẫu nhiên bằng Web Crypto',
    ],
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showAuth, setShowAuth] = useState(false);

  return (
    <main className="lp">
      {/* Navbar ẩn ở "/" khi chưa đăng nhập → trang này tự lo nút đổi theme */}
      <button
        className="lp__theme"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối'}
        aria-label="Đổi giao diện sáng/tối"
      >
        <AppIcon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
      </button>

      {/* ── Hero ── */}
      <section className="lp-hero">
        <div className="lp-hero__orb lp-hero__orb--1" />
        <div className="lp-hero__orb lp-hero__orb--2" />
        <div className="lp-hero__grid" />

        <div className="container lp-hero__content">
          <div className="section-label"><AppIcon name="sparkle" size={15} /> Personal Life OS</div>

          <h1 className="lp-hero__title display-2">
            Life <span className="gradient-text">Hub</span>
          </h1>

          <p className="lp-hero__desc">
            Một chỗ duy nhất cho việc cần làm, thứ cần nhớ và tiền đã tiêu.
            Không mạng xã hội, không bảng xếp hạng — chỉ là hệ thống riêng của bạn.
          </p>

          <div className="lp-hero__cta">
            {user ? (
              <>
                <Link to="/inbox" className="btn btn-primary"><AppIcon name="inbox" size={16} /> Vào Inbox</Link>
                <Link to="/tasks" className="btn btn-ghost"><AppIcon name="pushPin" size={16} /> Xem nhiệm vụ</Link>
              </>
            ) : (
              <>
                <button className="btn btn-primary" onClick={() => setShowAuth(true)} id="lp-login">
                  <AppIcon name="key" size={16} /> Đăng nhập
                </button>
                <Link to="/tasks" className="btn btn-ghost">Dùng thử không cần tài khoản</Link>
              </>
            )}
          </div>

          {!user && (
            <p className="lp-hero__note">
              Chưa đăng nhập vẫn dùng thử Nhiệm vụ và Focus; dữ liệu chỉ nằm trong
              bộ nhớ tạm nên tải lại trang là mất.
            </p>
          )}
        </div>
      </section>

      {/* ── Luồng chính ── */}
      <section className="container lp-section">
        <h2 className="lp-section__title h2">Cách nó chạy</h2>
        <p className="lp-section__sub">
          Không bắt bạn phân loại lúc đang bận. Gom hết một chỗ, dọn sau.
        </p>

        <ol className="lp-flow">
          {FLOW.map((s, i) => (
            <li key={s.label} className="lp-flow__step">
              <span className="lp-flow__num">{i + 1}</span>
              <span className="lp-flow__icon" aria-hidden="true"><AppIcon name={s.icon} size={26} weight="duotone" /></span>
              <span className="lp-flow__label">{s.label}</span>
              <span className="lp-flow__desc">{s.desc}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Module ── */}
      <section className="container lp-section">
        <h2 className="lp-section__title h2">Có những gì</h2>
        <p className="lp-section__sub">Bảy module, mỗi cái làm đúng một việc.</p>

        <div className="lp-grid">
          {MODULES.map(m => (
            <Link key={m.to} to={m.to} className="card lp-card" style={{ '--lp-accent': m.accent }}>
              <div className="lp-card__head">
                <span className="lp-card__icon" aria-hidden="true"><AppIcon name={m.icon} size={26} weight="duotone" /></span>
                <span className="lp-card__name">{m.name}</span>
              </div>
              <p className="lp-card__desc">{m.desc}</p>
              <ul className="lp-card__points">
                {m.points.map(p => <li key={p}>{p}</li>)}
              </ul>
            </Link>
          ))}
        </div>
      </section>

      <footer className="lp-footer">
        <div className="container">
          <span className="gradient-text lp-footer__logo"><AppIcon name="sparkle" size={18} /> Life Hub</span>
          <p>Personal Life OS — dựng cho đúng một người dùng.</p>
        </div>
      </footer>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </main>
  );
}
