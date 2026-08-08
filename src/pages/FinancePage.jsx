import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useFinance } from '../hooks/useFinance';
import { useToast } from '../contexts/ToastContext';
import {
  listPeriodOptions, currentMonthPeriod, periodTotals,
} from '../utils/financeLogic';
import { money } from '../components/finance/parts';
import OverviewScreen from '../components/finance/OverviewScreen';
import AddScreen from '../components/finance/AddScreen';
import ListScreen from '../components/finance/ListScreen';
import CatsScreen from '../components/finance/CatsScreen';
import RecurringScreen from '../components/finance/RecurringScreen';
import AnalyzeScreen from '../components/finance/AnalyzeScreen';
import '../styles/finance.css';

const SCREENS = [
  { key: 'overview',  icon: '📊', label: 'Tổng quan' },
  { key: 'add',       icon: '➕', label: 'Nhập nhanh' },
  { key: 'list',      icon: '🧾', label: 'Giao dịch' },
  { key: 'cats',      icon: '🗂️', label: 'Danh mục' },
  { key: 'recurring', icon: '🔁', label: 'Hóa đơn' },
  { key: 'analyze',   icon: '📈', label: 'Phân tích' },
];

export default function FinancePage() {
  const fin = useFinance();
  const { showToast } = useToast();
  const location = useLocation();

  const periodOptions = useMemo(() => listPeriodOptions(fin.today), [fin.today]);
  // Mặc định: tháng đang chạy (mục thứ month0 trong danh sách).
  const defaultPeriodKey = currentMonthPeriod(fin.today).key;
  const [periodKey, setPeriodKey] = useState(defaultPeriodKey);
  const period = periodOptions.find(o => o.key === periodKey) || periodOptions[0];

  const [screen, setScreen] = useState('overview');
  const [recurringSeg, setRecurringSeg] = useState('out');
  const [analyzeTab, setAnalyzeTab] = useState('budget');
  const [analyzeParams, setAnalyzeParams] = useState({ group: null });
  const [catsTab, setCatsTab] = useState('cats');
  const [handoff, setHandoff] = useState(null);   // prefill từ Inbox

  // Điều hướng chéo giữa các màn (giữ module dính vào nhau).
  const go = useCallback((target, opts = {}) => {
    setScreen(target);
    if (opts.recurringSeg) setRecurringSeg(opts.recurringSeg);
    if (opts.analyzeTab) setAnalyzeTab(opts.analyzeTab);
    if (opts.group !== undefined) setAnalyzeParams({ group: opts.group });
    if (opts.period) setPeriodKey(opts.period);
  }, []);

  // Phím tắt N → Nhập nhanh (bỏ qua khi đang gõ trong input).
  useEffect(() => {
    const h = (e) => {
      if (e.key !== 'n' && e.key !== 'N') return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
      setScreen('add');
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // Nhận handoff từ Inbox (sessionStorage). location.key đổi mỗi lần điều hướng.
  useEffect(() => {
    const raw = sessionStorage.getItem('lh_inbox_to_finance');
    if (!raw) return;
    sessionStorage.removeItem('lh_inbox_to_finance');
    try {
      const data = JSON.parse(raw);   // { kind:'tx'|'out'|'in'|'loan'|'card', title, inboxId, amount? }
      setHandoff(data);
      if (data.kind === 'tx') setScreen('add');
      else { setScreen('recurring'); setRecurringSeg(data.kind); }
    } catch { /* bỏ qua payload hỏng */ }
  }, [location.key]);

  // Chip ngân sách header — LUÔN tháng đang chạy, kể cả khi Tổng quan xem cả năm.
  const monthChip = useMemo(() => {
    const cur = currentMonthPeriod(fin.today);
    const t = periodTotals(fin.transactions, cur);
    const limit = fin.budgets.reduce((s, b) => s + b.limit_amount, 0);
    return { spent: t.total, limit, pct: limit ? Math.round((t.total / limit) * 100) : null };
  }, [fin.transactions, fin.budgets, fin.today]);

  if (!fin.enabled) {
    return (
      <div className="finance-module finance-module--gate">
        <div className="fin-gate">🔐 Đăng nhập để dùng Chi tiêu</div>
      </div>
    );
  }

  const nav = {
    screen, setScreen, go, period, periodKey, setPeriodKey, periodOptions,
    recurringSeg, setRecurringSeg, analyzeTab, setAnalyzeTab, analyzeParams,
    catsTab, setCatsTab, handoff, clearHandoff: () => setHandoff(null), showToast,
  };
  const active = SCREENS.find(s => s.key === screen);

  return (
    <div className="finance-module">
      {/* CHILD SIDEBAR */}
      <aside className="fin-side">
        <div className="fin-side__title">💰 Chi tiêu</div>
        <nav className="fin-side__nav">
          {SCREENS.map(s => (
            <button key={s.key}
              className={`fin-side__link${screen === s.key ? ' fin-side__link--active' : ''}`}
              onClick={() => setScreen(s.key)}>
              <span className="fin-side__icon">{s.icon}</span>
              <span className="fin-side__label">{s.label}</span>
              {s.key === 'add' && <span className="fin-side__kbd">N</span>}
            </button>
          ))}
        </nav>
      </aside>

      {/* CONTENT */}
      <section className="fin-content">
        <header className="fin-header">
          <h1 className="fin-header__title">{active?.label}</h1>
          <button className="fin-header__chip" onClick={() => go('analyze', { analyzeTab: 'budget' })}
            title="Ngân sách tháng đang chạy">
            {money(monthChip.spent)} / {monthChip.limit ? money(monthChip.limit) : '—'}
            {monthChip.pct != null && <> · <strong>{monthChip.pct}%</strong></>}
          </button>
        </header>

        {/* Sub-tab ngang (mobile thay child sidebar) */}
        <nav className="fin-subtabs">
          {SCREENS.map(s => (
            <button key={s.key}
              className={`fin-subtabs__tab${screen === s.key ? ' fin-subtabs__tab--active' : ''}`}
              onClick={() => setScreen(s.key)}>{s.icon} {s.label}</button>
          ))}
        </nav>

        <div className="fin-screen page-transition" key={screen}>
          {screen === 'overview'  && <OverviewScreen  fin={fin} nav={nav} />}
          {screen === 'add'       && <AddScreen       fin={fin} nav={nav} />}
          {screen === 'list'      && <ListScreen      fin={fin} nav={nav} />}
          {screen === 'cats'      && <CatsScreen      fin={fin} nav={nav} />}
          {screen === 'recurring' && <RecurringScreen fin={fin} nav={nav} />}
          {screen === 'analyze'   && <AnalyzeScreen   fin={fin} nav={nav} />}
        </div>
      </section>
    </div>
  );
}
