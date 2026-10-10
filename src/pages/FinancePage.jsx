import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useFinance } from '../hooks/useFinance';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../components/ConfirmModal';
import {
  listPeriodOptions, currentMonthPeriod, periodFromKey,
} from '../utils/financeLogic';
import AppIcon from '../components/AppIcon';
import OverviewScreen from '../components/finance/OverviewScreen';
import AddScreen from '../components/finance/AddScreen';
import ListScreen from '../components/finance/ListScreen';
import CatsScreen from '../components/finance/CatsScreen';
import RecurringScreen from '../components/finance/RecurringScreen';
import '../styles/finance.css';
import '../styles/skeleton.css';

// 'in' (Thu định kỳ) đã gỡ — handoff cũ mang kind 'in' rơi vào nhánh bỏ qua, không mở tab chết.
const RECURRING_SEGS = ['out', 'loan', 'card', 'lend', 'saving'];

const SCREENS = [
  { key: 'overview',  icon: 'chartDonut', label: 'Tổng quan', title: 'Hôm nay tiêu gì?' },
  { key: 'add',       icon: 'plusCircle', label: 'Nhập nhanh', title: 'Ghi một khoản' },
  { key: 'list',      icon: 'receipt',    label: 'Giao dịch',  title: 'Giao dịch' },
  { key: 'recurring', icon: 'calendar',   label: 'Định kỳ & Quỹ', title: 'Định kỳ, nghĩa vụ & Quỹ tiết kiệm' },
  { key: 'cats',      icon: 'tree',       label: 'Danh mục',   title: 'Danh mục & schema' },
];
const VALID_PERIOD_KEY = /^(?:\d{4}-(?:0[1-9]|1[0-2])|year-\d{4}|all)$/;

export default function FinancePage() {
  const fin = useFinance();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const { confirm, ConfirmModal } = useConfirm();
  const location = useLocation();
  const navigate = useNavigate();
  const { screen: routeScreen } = useParams();

  // `fin.dataFrom` = mốc đầu cửa sổ giao dịch đã fetch. Truyền xuống để "Tất cả"
  // và bộ chọn kỳ chỉ hứa đúng phần dữ liệu đang có trong state.
  const periodOptions = useMemo(() => listPeriodOptions(fin.today, fin.dataFrom), [fin.today, fin.dataFrom]);
  // Mặc định: tháng đang chạy (mục thứ month0 trong danh sách).
  const defaultPeriodKey = currentMonthPeriod(fin.today).key;
  const [periodKey, setPeriodKeyState] = useState(() => {
    const stored = sessionStorage.getItem('lh_finance_period');
    return stored && VALID_PERIOD_KEY.test(stored) ? stored : defaultPeriodKey;
  });
  const setPeriodKey = useCallback(key => {
    const next = VALID_PERIOD_KEY.test(key) ? key : defaultPeriodKey;
    setPeriodKeyState(next);
    sessionStorage.setItem('lh_finance_period', next);
  }, [defaultPeriodKey]);
  const period = useMemo(() => periodFromKey(periodKey, fin.today, fin.dataFrom),
    [periodKey, fin.today, fin.dataFrom]);

  const screen = (routeScreen === 'analyze' || routeScreen === 'report')
    ? 'overview'
    : SCREENS.some(s => s.key === routeScreen) ? routeScreen : 'overview';
  const setScreen = useCallback((target) => navigate(`/finance/${target}`), [navigate]);
  // Trang chủ mở thẳng tab con qua navigation state (cảnh báo thẻ → tab Thẻ...).
  // Kiểm như handoff: segment lạ làm RecurringScreen crash trắng màn.
  const [recurringSeg, setRecurringSeg] = useState(() =>
    (RECURRING_SEGS.includes(location.state?.recurringSeg) ? location.state.recurringSeg : 'out'));
  const [analyzeParams, setAnalyzeParams] = useState({ group: null });
  const [catsTab, setCatsTab] = useState('cats');
  const [handoff, setHandoff] = useState(null);   // prefill từ Inbox
  const [searchQuery, setSearchQuery] = useState('');
  // Ô bên phải header để màn con portal control vào (AddScreen đặt pill hóa đơn ở đây).
  const [headerSlot, setHeaderSlot] = useState(null);
  // Form đang gõ dở mà bấm sang chỗ khác thì mất trắng — hỏi trước khi bỏ.
  const confirmDiscard = useCallback(() => confirm({
    title: 'Bỏ nội dung đang nhập?',
    message: 'Form này đang có dữ liệu chưa lưu. Rời khỏi đây là mất những gì bạn vừa gõ.',
    confirmLabel: 'Bỏ nội dung',
    danger: true,
  }), [confirm]);
  const confirmDelete = useCallback((label, message) => confirm({
    title: `Xóa ${label}?`,
    message: message || 'Dữ liệu này sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.',
    confirmLabel: 'Xóa',
    danger: true,
  }), [confirm]);

  // Điều hướng chéo giữa các màn (giữ module dính vào nhau).
  const go = useCallback((target, opts = {}) => {
    navigate(`/finance/${target}`);
    if (opts.recurringSeg) setRecurringSeg(opts.recurringSeg);
    if (opts.group !== undefined) setAnalyzeParams({ group: opts.group });
    if (opts.period) setPeriodKey(opts.period);
  }, [navigate, setPeriodKey]);

  // Khóa cuộn desktop chống tràn (Workspace Pattern) khi ở phân hệ Finance
  useEffect(() => {
    document.body.classList.add('in-finance-workspace');
    return () => {
      document.body.classList.remove('in-finance-workspace');
    };
  }, []);

  // Bookmark cũ vẫn mở đúng nội dung (Báo cáo đã gộp vào Tổng quan)
  useEffect(() => {
    if (routeScreen === 'analyze' || routeScreen === 'report') {
      navigate('/finance/overview', { replace: true });
    }
  }, [navigate, routeScreen]);

  // Phím tắt N → Nhập nhanh (bỏ qua khi đang gõ trong input).
  useEffect(() => {
    const h = (e) => {
      if (e.key !== 'n' && e.key !== 'N') return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
      navigate('/finance/add');
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [navigate]);

  // Nhận handoff từ Inbox (sessionStorage). location.key đổi mỗi lần điều hướng.
  useEffect(() => {
    const raw = sessionStorage.getItem('lh_inbox_to_finance');
    if (!raw) return;
    sessionStorage.removeItem('lh_inbox_to_finance');
    try {
      const data = JSON.parse(raw);   // { kind:'tx'|'out'|'loan'|'card', title, inboxId, amount? }
      setHandoff(data);
      if (data.kind === 'tx') navigate('/finance/add');
      // Payload đến từ sessionStorage nên phải kiểm: segment lạ làm RecurringScreen
      // tìm không ra segMeta rồi crash trắng màn.
      else if (RECURRING_SEGS.includes(data.kind)) { navigate('/finance/recurring'); setRecurringSeg(data.kind); }
    } catch { /* bỏ qua payload hỏng */ }
  }, [location.key, navigate]);

  if (!fin.enabled) {
    return (
      <div className="finance-module finance-module--gate">
        <div className="fin-gate"><AppIcon name="lock" size={22} /> Đăng nhập để dùng Chi tiêu</div>
      </div>
    );
  }

  const nav = {
    screen, setScreen, go, period, periodKey, setPeriodKey, periodOptions, dataFrom: fin.dataFrom,
    recurringSeg, setRecurringSeg, analyzeParams,
    catsTab, setCatsTab, handoff, startHandoff: setHandoff,
    clearHandoff: () => setHandoff(null), showToast,
    confirmDelete, confirmDiscard,
    searchQuery, setSearchQuery, headerSlot,
  };
  const active = SCREENS.find(s => s.key === screen);
  const headerSub = screen === 'overview' ? 'Tổng quan và báo cáo chi tiêu theo kỳ'
    : screen === 'list' ? `${period.label} · lọc cùng kỳ với Tổng quan`
    : screen === 'cats' ? `${fin.cats.expenseGroups.length} nhóm chi · cấu trúc dữ liệu`
    : 'Định kỳ, nghĩa vụ và Quỹ tiết kiệm';

  return (
    <div className="finance-module">
      {/* ── MOBILE TOP BAR (<769px — Chuẩn Module giống Body) ────────── */}
      <div className="fin-mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="fin-mobile-back-hub"
            onClick={() => navigate('/')}
            title="Về Life Hub"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--n-txt3, #9ca3af)',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              padding: '4px',
              borderRadius: '8px'
            }}
          >
            <AppIcon name="sparkle" size={18} weight="fill" />
          </button>
          <AppIcon name="wallet" size={20} style={{ color: 'var(--n-accent, #6366f1)' }} />
          <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--n-txt, #fff)', letterSpacing: '-0.02em' }}>
            Finance
          </span>
          <span style={{ fontSize: '12px', color: 'var(--n-txt3, #9ca3af)' }}>
            · {active?.label || 'Tổng quan'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {screen !== 'add' && (
            <button
              type="button"
              onClick={() => go('add')}
              style={{
                background: 'var(--n-accent-soft, rgba(99, 102, 241, 0.15))',
                border: '1px solid var(--n-accent, #6366f1)',
                borderRadius: '8px',
                height: '30px',
                padding: '0 9px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                color: 'var(--n-accent, #6366f1)',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Ghi chép chi tiêu mới"
            >
              <AppIcon name="plus" size={13} weight="bold" />
              <span>Thêm</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            style={{
              background: 'none',
              border: '1px solid var(--n-border, rgba(255, 255, 255, 0.1))',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--n-txt2, #d1d5db)',
              cursor: 'pointer'
            }}
            title="Đổi giao diện Sáng / Tối"
          >
            <AppIcon name={theme === 'dark' ? 'sun' : 'moon'} size={15} weight="fill" />
          </button>

          <span style={{
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--n-accent, #6366f1), #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: '12px',
            fontWeight: 700
          }}>
            {(user?.user_metadata?.full_name || user?.email || 'F')[0].toUpperCase()}
          </span>
        </div>
      </div>

      <section className="fin-content">
        {/* Định kỳ & Quỹ tự có header (tiêu đề · tháng · Thêm nguồn chi) theo bản chốt. */}
        {screen !== 'list' && screen !== 'overview' && screen !== 'recurring' && (
          <header className="fin-header">
            <div className="fin-header__brand">
              <div className="fin-header__copy">
                <h1 className="fin-header__title">{active?.title}</h1>
                {screen !== 'add' && (
                  <p className="fin-header__sub">{headerSub}</p>
                )}
              </div>
            </div>

            {screen === 'add' ? (
              <div className="fin-header__slot" ref={setHeaderSlot} />
            ) : (
              <button className="fin-btn fin-btn--primary fin-header__action" onClick={() => go('add')}>
                <AppIcon name="plus" size={16} /> Thêm chi tiêu
              </button>
            )}
          </header>
        )}

        {fin.error && (
          <div className="fin-warn fin-inline-message" role="alert">
            <AppIcon name="warning" size={16} weight="fill" />
            <span>Không tải được dữ liệu Finance. Kiểm tra migration và thử lại.</span>
            <button className="fin-btn fin-btn--secondary fin-btn--sm" onClick={fin.fetchAll}>
              <AppIcon name="refresh" size={14} /> Thử lại
            </button>
          </div>
        )}

        <div className="fin-screen" key={screen}>
          {screen === 'overview'  && <OverviewScreen  fin={fin} nav={nav} />}
          {screen === 'add'       && <AddScreen       fin={fin} nav={nav} />}
          {screen === 'list'      && <ListScreen      fin={fin} nav={nav} />}
          {screen === 'cats'      && <CatsScreen      fin={fin} nav={nav} />}
          {screen === 'recurring' && <RecurringScreen fin={fin} nav={nav} />}
        </div>
      </section>

      {/* ── MOBILE BOTTOM NAVIGATION (64px — 5 TABS CHUẨN DESIGN GIỐNG BODY) ──── */}
      <nav className="fin-mobile-bottom-nav">
        {SCREENS.map(s => {
          const isActive = screen === s.key;
          return (
            <button
              key={s.key}
              className={`fin-mobile-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setScreen(s.key)}
            >
              <AppIcon name={s.icon} size={20} weight={isActive ? 'fill' : 'regular'} />
              <span className="fin-mobile-nav-label">{s.label}</span>
            </button>
          );
        })}
      </nav>

      {ConfirmModal}
    </div>
  );
}
