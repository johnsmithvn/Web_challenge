import { lazy, Suspense, useState, useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Navbar from './components/Navbar';
import QuickCapture from './components/QuickCapture';
import OnboardingModal, { useOnboarding } from './components/OnboardingModal';
import ErrorBoundary from './components/ErrorBoundary';
import PageSkeleton  from './components/PageSkeleton';
import GlobalAudioPlayer from './components/GlobalAudioPlayer';
import './styles/global.css';
import './index.css';

// ── Lazy-loaded pages (each becomes its own JS chunk) ──────────────
// LandingPage eager (entry point); eight domain pages are split into lazy chunks.
import LandingPage from './pages/LandingPage';

const FocusPage         = lazy(() => import('./pages/FocusPage'));
const InboxPage         = lazy(() => import('./pages/InboxPage'));
const TasksPage         = lazy(() => import('./pages/TasksPage'));
const CollectPage       = lazy(() => import('./pages/CollectPage'));
const FinancePage       = lazy(() => import('./pages/FinancePage'));
const IncubatorPage     = lazy(() => import('./pages/IncubatorPage'));
const AccountsPage      = lazy(() => import('./pages/AccountsPage'));
const SettingsPage      = lazy(() => import('./pages/SettingsPage'));

// ── SEO meta per route ─────────────────────────────────────────────
const ROUTE_META = {
  '/':           { title: 'Life Hub — Personal Life OS',                                     desc: 'Inbox, nhiệm vụ, tài chính, kiến thức, Focus và Account Vault trong một ứng dụng cá nhân.' },
  '/inbox':      { title: 'Inbox — Life Hub',                                                 desc: 'Ghi nhanh mọi thứ chưa phân loại. Phân loại sau.' },
  '/tasks':      { title: 'Nhiệm Vụ — Life Hub',                                              desc: 'Danh sách nhiệm vụ cá nhân: quá hạn, hôm nay, sắp tới.' },
  '/collect':    { title: 'Knowledge Base — Life Hub',                                          desc: 'Kho tàng kiến thức cá nhân. Viết bài, đọc lại, phân loại theo tag.' },
  '/finance':    { title: 'Finance — Life Hub',                                               desc: 'Ghi giao dịch, ngân sách, hóa đơn, khoản vay, thẻ và quỹ tiết kiệm.' },
  '/focus':      { title: 'Focus Timer — Life Hub',                                           desc: 'Pomodoro tập trung, lịch sử session và XP.' },
  '/incubator':  { title: 'Trạm Ấp Trứng — Life Hub',                                          desc: 'Nuôi dưỡng dự định, dời lại phải có lý do, theo dõi timeline quyết định.' },
  '/accounts':   { title: 'Vault — Life Hub',                                                  desc: 'Account Vault mã hóa toàn bộ nội dung bằng AES-GCM phía client.' },
  '/settings':   { title: 'Cài Đặt — Life Hub',                                                  desc: 'Quản lý tags, quotes và hồ sơ cá nhân.' },
};

function PageMeta() {
  const { pathname } = useLocation();
  const meta = pathname.startsWith('/finance/') ? ROUTE_META['/finance'] : ROUTE_META[pathname] || ROUTE_META['/'];
  document.title = meta.title;
  const descEl = document.querySelector('meta[name="description"]');
  if (descEl) descEl.setAttribute('content', meta.desc);
  return null;
}

// ── App Shell ──────────────────────────────────────────────────────
function AppShell() {
  const { shouldShow } = useOnboarding();
  const { user } = useAuth();
  const [onboarded, setOnboarded] = useState(!shouldShow);
  const location = useLocation();

  return (
    <>
      <PageMeta />
      {!onboarded && <OnboardingModal onDone={() => setOnboarded(true)} />}
      <Navbar />
      <QuickCapture />
      <GlobalAudioPlayer />

      <div className="app-content">
        <ErrorBoundary>
          <Suspense fallback={<PageSkeleton />}>
            <div className="page-transition" key={location.pathname}>
              <Routes>
                <Route path="/"             element={<LandingPage />} />
                <Route path="/inbox"        element={<InboxPage />} />
                <Route path="/tasks"        element={<TasksPage />} />
                <Route path="/collect"      element={<CollectPage />} />
                <Route path="/finance"          element={<FinancePage />} />
                <Route path="/finance/:screen"  element={<FinancePage />} />
                <Route path="/incubator"    element={<IncubatorPage />} />
                <Route path="/accounts"     element={<AccountsPage key={user?.id || 'guest'} />} />
                <Route path="/settings"     element={<SettingsPage />} />
                <Route path="/focus"        element={<FocusPage />} />
                {/* Redirect của các route đã gỡ. Giữ lại để link/bookmark cũ
                    không rơi vào catch-all im lặng. */}
                <Route path="/tracker"      element={<Navigate to="/tasks" replace />} />
                <Route path="/habits"       element={<Navigate to="/tasks" replace />} />
                <Route path="/dashboard"    element={<Navigate to="/tasks" replace />} />
                <Route path="/journey"      element={<Navigate to="/tasks" replace />} />
                <Route path="*"             element={<LandingPage />} />
              </Routes>
            </div>
          </Suspense>
        </ErrorBoundary>
      </div>
    </>
  );
}

export default function App() {
  // Register Service Worker for background task notifications
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppShell />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
