import { lazy, Suspense, useState, useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { JourneyProvider } from './contexts/JourneyContext';
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
// LandingPage & TrackerPage are eager (entry points, always needed)
import LandingPage from './pages/LandingPage';
import TrackerPage from './pages/TrackerPage';


const FocusPage         = lazy(() => import('./pages/FocusPage'));
const DashboardPage     = lazy(() => import('./pages/DashboardPage'));
const QuizPage          = lazy(() => import('./pages/QuizPage'));
const LeaderboardPage   = lazy(() => import('./pages/LeaderboardPage'));
const JourneyPage       = lazy(() => import('./pages/JourneyPage'));
const JourneyDetailPage = lazy(() => import('./pages/JourneyDetailPage'));
const LifeJourneyPage   = lazy(() => import('./pages/LifeJourneyPage'));
// v3.0.0 — New Life Hub pages
const InboxPage         = lazy(() => import('./pages/InboxPage'));
const TasksPage         = lazy(() => import('./pages/TasksPage'));
const CollectPage       = lazy(() => import('./pages/CollectPage'));
const FinancePage       = lazy(() => import('./pages/FinancePage'));
const LifeLogPage       = lazy(() => import('./pages/LifeLogPage'));
const IncubatorPage     = lazy(() => import('./pages/IncubatorPage'));
const SettingsPage      = lazy(() => import('./pages/SettingsPage'));

// ── SEO meta per route ─────────────────────────────────────────────
const ROUTE_META = {
  '/':           { title: 'Life Hub — Personal Life OS',                                     desc: 'Hệ điều hành cuộc sống cá nhân. Quản lý thói quen, tài chính, kiến thức và mục tiêu.' },
  '/tracker':    { title: 'Today — Life Hub',                                                 desc: 'Checklist hôm nay: thói quen, nhiệm vụ, và gợi nhở kiến thức.' },
  '/inbox':      { title: 'Inbox — Life Hub',                                                 desc: 'Ghi nhanh mọi thứ chưa phân loại. Phân loại sau.' },
  '/tasks':      { title: 'Nhiệm Vụ — Life Hub',                                              desc: 'Danh sách nhiệm vụ cá nhân: quá hạn, hôm nay, sắp tới.' },
  '/collect':    { title: 'Knowledge Base — Life Hub',                                          desc: 'Kho tàng kiến thức cá nhân. Viết bài, đọc lại, phân loại theo tag.' },
  '/finance':    { title: 'Finance — Life Hub',                                               desc: 'Quản lý chi tiêu cá nhân và đăng ký gói dịch vụ.' },
  '/life-log':   { title: 'Life Log — Life Hub',                                              desc: 'Lịch sử cuộc sống: heatmap cả năm và timeline hàng ngày.' },
  '/focus':      { title: 'Focus Timer — Life Hub',                                           desc: 'Dùng Pomodoro để tập trung sâu và liên kết với thói quen của bạn.' },
  '/journey':    { title: 'Lộ Trình — Life Hub',                                              desc: 'Chọn lộ trình 21 ngày phù hợp với bạn hoặc tự tạo lộ trình riêng.' },
  '/dashboard':  { title: 'Stats — Life Hub',                                                 desc: 'Thống kê toàn bộ quá trình: streak, XP, mood, habit completion.' },
  '/quiz':       { title: 'Quiz — Life Hub',                                                  desc: 'Kiểm tra hiểu biết về tâm lý hành vi. +50 XP nếu làm tốt!' },
  '/leaderboard':{ title: 'Bảng Xếp Hạng — Life Hub',                                        desc: 'Xem ai đang dẫn đầu về streak và XP.' },
  '/life-journey': { title: 'Hành Trình — Life Hub',                                           desc: 'Ghi lại những cột mốc quan trọng trên biểu đồ cảm xúc.' },
  '/incubator':  { title: 'Trạm Ấp Trứng — Life Hub',                                          desc: 'Nuôi dưỡng dự định, dời lại phải có lý do, theo dõi timeline quyết định.' },
  '/settings':   { title: 'Cài Đặt — Life Hub',                                                  desc: 'Quản lý tags, giao diện và tùy chỉnh hệ thống.' },
};

function PageMeta() {
  const { pathname } = useLocation();
  const meta = ROUTE_META[pathname] || ROUTE_META['/'];
  document.title = meta.title;
  const descEl = document.querySelector('meta[name="description"]');
  if (descEl) descEl.setAttribute('content', meta.desc);
  return null;
}

// ── App Shell ──────────────────────────────────────────────────────
function AppShell() {
  const { shouldShow } = useOnboarding();
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
                <Route path="/tracker"      element={<TrackerPage />} />
                <Route path="/habits"       element={<Navigate to="/tracker" replace />} />
                <Route path="/inbox"        element={<InboxPage />} />
                <Route path="/tasks"        element={<TasksPage />} />
                <Route path="/collect"      element={<CollectPage />} />
                <Route path="/finance"      element={<FinancePage />} />
                <Route path="/life-log"     element={<LifeLogPage />} />
                <Route path="/incubator"    element={<IncubatorPage />} />
                <Route path="/settings"     element={<SettingsPage />} />
                <Route path="/focus"        element={<FocusPage />} />
                <Route path="/team"         element={<Navigate to="/tracker" replace />} />
                <Route path="/friends"      element={<Navigate to="/tracker" replace />} />
                <Route path="/dashboard"    element={<DashboardPage />} />
                <Route path="/quiz"         element={<QuizPage />} />
                <Route path="/leaderboard"  element={<LeaderboardPage />} />
                <Route path="/journey"      element={<JourneyPage />} />
                <Route path="/journey/:id"  element={<JourneyDetailPage />} />
                <Route path="/life-journey" element={<LifeJourneyPage />} />
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
            <JourneyProvider>
              <AppShell />
            </JourneyProvider>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
