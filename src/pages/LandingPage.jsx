/**
 * LandingPage — trang "/" cho app 1 người dùng.
 *
 * KHÔNG phải landing marketing. Bản cũ (v2.x) là 7 section quảng cáo cho sản
 * phẩm "Thử Thách Vượt Lười 21 ngày": Hero typewriter, Problem, Knowledge,
 * Roadmap, demo Tracker, Reverse, Testimonials (đánh giá bịa), Pricing (bảng
 * giá cho app không bán) — 923 dòng mô tả một sản phẩm không còn tồn tại.
 *
 * Bản này làm đúng 2 việc: cửa đăng nhập cho khách, và bản đồ module cho chủ
 * nhà. Navbar tự ẩn ở "/" khi chưa đăng nhập (Navbar.jsx:154) nên trang này
 * phải tự chứa nút đăng nhập và nút đổi theme.
 *
 * CỐ Ý chỉ liệt kê module sẽ CÒN LẠI sau khi dọn (xem docs/TASKS.md § KẾ HOẠCH
 * DỌN MODULE). Quiz/BXH đã gỡ ở đợt 3; Habit + Lộ Trình đang chờ gỡ ở đợt 4 —
 * quảng cáo chúng ở đây là viết để xoá lại.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import AuthModal from '../components/AuthModal';
import '../styles/landing.css';

const FLOW = [
  { icon: '📥', label: 'Ghi vào Inbox', desc: 'Nghĩ ra gì gõ vào đó, chưa cần phân loại' },
  { icon: '🔀', label: 'Phân loại sau', desc: 'Lúc rảnh mới quyết định nó là việc, kiến thức hay khoản chi' },
  { icon: '✅', label: 'Xử lý đúng chỗ', desc: 'Mỗi loại đi về đúng module của nó' },
];

const MODULES = [
  {
    to: '/inbox', icon: '📥', name: 'Inbox', accent: 'var(--purple-light)',
    desc: 'Hộp thu gom mọi ý nghĩ chưa phân loại.',
    points: [
      'Ghi nhanh một dòng, tự nhận diện URL',
      'Snooze lại 1 tuần → 3 tháng',
      'Chuyển thẳng thành Nhiệm vụ / Bài viết / Khoản chi / Dự định',
      'Chọn nhiều item để phân loại hoặc xoá hàng loạt',
    ],
  },
  {
    to: '/tasks', icon: '📌', name: 'Nhiệm Vụ', accent: '#22d3ee',
    desc: 'Danh sách việc cần làm, tách hẳn khỏi mọi thứ khác.',
    points: [
      'Chia 3 khối: Quá hạn / Hôm nay / Sắp tới',
      '5 mức ưu tiên, dải màu nhìn là biết việc gấp',
      'Lặp theo ngày / tuần / tháng, tự sinh lần kế tiếp',
      'Lịch tháng xem việc đã xong',
      'Mở chi tiết: lịch sử mọi thay đổi + ghi chú riêng',
    ],
  },
  {
    to: '/collect', icon: '🧠', name: 'Knowledge', accent: '#a78bfa',
    desc: 'Kho bài viết cá nhân, viết và đọc lại.',
    points: [
      'Trình soạn thảo đầy đủ: bảng, checklist, ảnh, YouTube, audio',
      'Phân loại theo 8 kiểu: ghi chú, trích dẫn, bài học, ý tưởng…',
      'Gắn tag, thêm ghi chú phụ cho từng bài',
      'Liên kết bài viết với nhiệm vụ',
    ],
  },
  {
    to: '/finance', icon: '💰', name: 'Finance', accent: '#00cc6e',
    desc: 'Chi tiêu và các gói đăng ký định kỳ.',
    points: [
      'Nhập tiền kiểu tự do: 50k, 89$ đều hiểu',
      'Chia theo danh mục, biểu đồ tròn theo tháng',
      'Đăng ký định kỳ tự đẩy ngày đến hạn kế tiếp',
      'Dải 30 ngày tới xem tiền sắp ra lúc nào',
    ],
  },
  {
    to: '/incubator', icon: '🥚', name: 'Incubator', accent: '#eab308',
    desc: 'Nơi ấp những dự định chưa tới lúc làm.',
    points: [
      'Hoãn phải nêu lý do — chống hoãn vô thức',
      'Nhắc review khi tới hạn đã hẹn',
      'Chín rồi thì chuyển thành Nhiệm vụ hoặc Khoản chi',
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
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* ── Hero ── */}
      <section className="lp-hero">
        <div className="lp-hero__orb lp-hero__orb--1" />
        <div className="lp-hero__orb lp-hero__orb--2" />
        <div className="lp-hero__grid" />

        <div className="container lp-hero__content">
          <div className="section-label">⚡ Personal Life OS</div>

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
                <Link to="/inbox" className="btn btn-primary">📥 Vào Inbox</Link>
                <Link to="/tasks" className="btn btn-ghost">📌 Xem nhiệm vụ</Link>
              </>
            ) : (
              <>
                <button className="btn btn-primary" onClick={() => setShowAuth(true)} id="lp-login">
                  🔑 Đăng nhập
                </button>
                <Link to="/tasks" className="btn btn-ghost">Dùng thử không cần tài khoản</Link>
              </>
            )}
          </div>

          {!user && (
            <p className="lp-hero__note">
              Chưa đăng nhập vẫn dùng được, nhưng dữ liệu chỉ nằm trong bộ nhớ tạm —
              tải lại trang là mất.
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
              <span className="lp-flow__icon" aria-hidden="true">{s.icon}</span>
              <span className="lp-flow__label">{s.label}</span>
              <span className="lp-flow__desc">{s.desc}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Module ── */}
      <section className="container lp-section">
        <h2 className="lp-section__title h2">Có những gì</h2>
        <p className="lp-section__sub">Sáu module, mỗi cái làm đúng một việc.</p>

        <div className="lp-grid">
          {MODULES.map(m => (
            <Link key={m.to} to={m.to} className="card lp-card" style={{ '--lp-accent': m.accent }}>
              <div className="lp-card__head">
                <span className="lp-card__icon" aria-hidden="true">{m.icon}</span>
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
          <span className="gradient-text lp-footer__logo">⚡ Life Hub</span>
          <p>Personal Life OS — dựng cho đúng một người dùng.</p>
        </div>
      </footer>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </main>
  );
}
