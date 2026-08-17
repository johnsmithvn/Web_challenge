import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useFinance } from '../hooks/useFinance';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../components/ConfirmModal';
import {
  listPeriodOptions, currentMonthPeriod, periodFromKey, periodTotals,
} from '../utils/financeLogic';
import { money } from '../components/finance/parts';
import AppIcon from '../components/AppIcon';
import OverviewScreen from '../components/finance/OverviewScreen';
import AddScreen from '../components/finance/AddScreen';
import ListScreen from '../components/finance/ListScreen';
import CatsScreen from '../components/finance/CatsScreen';
import RecurringScreen from '../components/finance/RecurringScreen';
import '../styles/finance.css';
import '../styles/finance-handoff.css';
import '../styles/skeleton.css';

const RECURRING_SEGS = ['out', 'in', 'loan', 'card', 'lend'];

const SCREENS = [
  { key: 'overview',  icon: 'chartDonut', label: 'Tổng quan', title: 'Hôm nay tiêu gì?' },
  { key: 'add',       icon: 'plusCircle', label: 'Nhập nhanh', title: 'Ghi một khoản' },
  { key: 'list',      icon: 'receipt', label: 'Giao dịch', title: 'Giao dịch' },
  { key: 'cats',      icon: 'tree', label: 'Danh mục', title: 'Danh mục & schema' },
  { key: 'recurring', icon: 'calendar', label: 'Hóa đơn', title: 'Hóa đơn & nghĩa vụ' },
];
const VALID_PERIOD_KEY = /^(?:\d{4}-(?:0[1-9]|1[0-2])|year-\d{4}|all)$/;
const OVERVIEW_TABS = new Set(['overview', 'budget', 'stats']);

export default function FinancePage() {
  const fin = useFinance();
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

  const screen = routeScreen === 'analyze'
    ? 'overview'
    : SCREENS.some(s => s.key === routeScreen) ? routeScreen : 'overview';
  const setScreen = useCallback((target) => navigate(`/finance/${target}`), [navigate]);
  const [recurringSeg, setRecurringSeg] = useState('out');
  const [analyzeParams, setAnalyzeParams] = useState({ group: null });
  const [catsTab, setCatsTab] = useState('cats');
  const [handoff, setHandoff] = useState(null);   // prefill từ Inbox
  const [savingAsExpense, setSavingAsExpenseState] = useState(
    () => localStorage.getItem('lh_finance_saving_as_expense') === 'true',
  );
  const setSavingAsExpense = useCallback((enabled) => {
    const next = Boolean(enabled);
    setSavingAsExpenseState(next);
    localStorage.setItem('lh_finance_saving_as_expense', String(next));
  }, []);
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

  const overviewTab = useMemo(() => {
    const requested = new URLSearchParams(location.search).get('view') || 'overview';
    return OVERVIEW_TABS.has(requested) ? requested : 'overview';
  }, [location.search]);
  const setOverviewTab = useCallback((tab) => {
    const next = OVERVIEW_TABS.has(tab) ? tab : 'overview';
    navigate(next === 'overview' ? '/finance/overview' : `/finance/overview?view=${next}`);
  }, [navigate]);

  // Điều hướng chéo giữa các màn (giữ module dính vào nhau).
  const go = useCallback((target, opts = {}) => {
    const overviewView = OVERVIEW_TABS.has(opts.overviewTab) ? opts.overviewTab : 'overview';
    navigate(target === 'overview' && overviewView !== 'overview'
      ? `/finance/overview?view=${overviewView}`
      : `/finance/${target}`);
    if (opts.recurringSeg) setRecurringSeg(opts.recurringSeg);
    if (opts.group !== undefined) setAnalyzeParams({ group: opts.group });
    if (opts.period) setPeriodKey(opts.period);
  }, [navigate, setPeriodKey]);

  // Bookmark cũ vẫn mở đúng nội dung, nhưng Phân tích không còn là một màn riêng.
  useEffect(() => {
    if (routeScreen === 'analyze') navigate('/finance/overview?view=budget', { replace: true });
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
      const data = JSON.parse(raw);   // { kind:'tx'|'out'|'in'|'loan'|'card', title, inboxId, amount? }
      setHandoff(data);
      if (data.kind === 'tx') navigate('/finance/add');
      // Payload đến từ sessionStorage nên phải kiểm: segment lạ làm RecurringScreen
      // tìm không ra segMeta rồi crash trắng màn.
      else if (RECURRING_SEGS.includes(data.kind)) { navigate('/finance/recurring'); setRecurringSeg(data.kind); }
    } catch { /* bỏ qua payload hỏng */ }
  }, [location.key, navigate]);

  // Chip ngân sách header — LUÔN tháng đang chạy, kể cả khi Tổng quan xem cả năm.
  const monthChip = useMemo(() => {
    const cur = currentMonthPeriod(fin.today);
    const t = periodTotals(fin.transactions, cur, { savingAsExpense });
    const limit = fin.budgets.reduce((s, b) => s + b.limit_amount, 0);
    const end = new Date(`${cur.to}T00:00:00`);
    const now = new Date(`${fin.today}T00:00:00`);
    const daysLeft = Math.max(0, Math.round((end - now) / 86400000) + 1);
    return { spent: t.total, limit, remaining: Math.max(0, limit - t.total),
      pct: limit ? Math.round((t.total / limit) * 100) : null, daysLeft };
  }, [fin.transactions, fin.budgets, fin.today, savingAsExpense]);

  if (!fin.enabled) {
    return (
      <div className="finance-module finance-module--gate">
        <div className="fin-gate"><AppIcon name="lock" size={22} /> Đăng nhập để dùng Chi tiêu</div>
      </div>
    );
  }

  const nav = {
    screen, setScreen, go, period, periodKey, setPeriodKey, periodOptions, dataFrom: fin.dataFrom,
    recurringSeg, setRecurringSeg, overviewTab, setOverviewTab, analyzeParams,
    catsTab, setCatsTab, handoff, startHandoff: setHandoff,
    clearHandoff: () => setHandoff(null), showToast,
    confirmDelete, confirmDiscard,
    savingAsExpense, setSavingAsExpense,
  };
  const active = SCREENS.find(s => s.key === screen);
  const headerSub = screen === 'overview'
    ? 'Hạn mức cho tháng đang chạy · thống kê nhiều tháng có bộ chọn riêng'
    : screen === 'add' ? 'Số tiền trước — mọi trường còn lại đều đã có sẵn giá trị mặc định'
    : screen === 'list' ? `${period.label} · lọc cùng kỳ với Tổng quan`
    : screen === 'cats' ? '11 nhóm chi · 7 nhóm thu · cấu trúc dữ liệu'
    : 'Hóa đơn, khoản thu, khoản vay và thẻ tín dụng';

  return (
    <div className="finance-module">
      <section className="fin-content">
        <header className="fin-header">
          <div className="fin-header__copy">
            <h1 className="fin-header__title">{active?.title}</h1>
            <p className="fin-header__sub">{headerSub}</p>
          </div>
          {/* Chưa tải xong thì chip này nói "Chưa đặt" (vì `budgets` còn rỗng) rồi mới
              nhảy ra số thật — đọc như "bạn chưa đặt hạn mức nào", sai hẳn. */}
          <button className="fin-header__chip" onClick={() => go('overview', { overviewTab: 'budget' })}
            title="Ngân sách tháng đang chạy" aria-busy={!fin.hasLoaded}>
            {fin.hasLoaded ? (
              <>
                <span><strong>{monthChip.limit ? money(monthChip.remaining) : 'Chưa đặt'}</strong><small>còn lại</small></span>
                <i><b style={{ width: `${Math.min(100, monthChip.pct || 0)}%` }} /></i>
                <small>{monthChip.daysLeft} ngày</small>
              </>
            ) : (
              <span className="sk-list"><span className="sk-line" style={{ '--w': '82px' }} /></span>
            )}
          </button>
          <button className="fin-btn fin-btn--secondary fin-header__action" onClick={() => go('list')}>
            <AppIcon name="search" size={16} /> Tìm
          </button>
          <button className="fin-btn fin-btn--primary fin-header__action" onClick={() => go('add')}>
            <AppIcon name="plus" size={16} /> Thêm chi tiêu
          </button>
        </header>

        {/* Sub-tab ngang (mobile thay child sidebar) */}
        <nav className="fin-subtabs">
          {SCREENS.map(s => (
            <button key={s.key}
              className={`fin-subtabs__tab${screen === s.key ? ' fin-subtabs__tab--active' : ''}`}
              onClick={() => setScreen(s.key)}><AppIcon name={s.icon} size={16} weight={screen === s.key ? 'fill' : 'regular'} /> {s.label}</button>
          ))}
        </nav>

        {fin.error && (
          <div className="fin-warn fin-inline-message" role="alert">
            <AppIcon name="warning" size={16} weight="fill" />
            <span>Không tải được dữ liệu Finance. Kiểm tra migration và thử lại.</span>
            <button className="fin-btn fin-btn--secondary fin-btn--sm" onClick={fin.fetchAll}>
              <AppIcon name="refresh" size={14} /> Thử lại
            </button>
          </div>
        )}

        <div className="fin-screen page-transition" key={screen}>
          {screen === 'overview'  && <OverviewScreen  fin={fin} nav={nav} />}
          {screen === 'add'       && <AddScreen       fin={fin} nav={nav} />}
          {screen === 'list'      && <ListScreen      fin={fin} nav={nav} />}
          {screen === 'cats'      && <CatsScreen      fin={fin} nav={nav} />}
          {screen === 'recurring' && <RecurringScreen fin={fin} nav={nav} />}
        </div>
      </section>
      {ConfirmModal}
    </div>
  );
}
