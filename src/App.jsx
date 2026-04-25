import { lazy, Suspense, useState, useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { JourneyProvider } from './contexts/JourneyContext';
import { useAuth } from './contexts/AuthContext';
import { useActiveJourney } from './contexts/JourneyContext';
import Navbar from './components/Navbar';
import QuickCapture from './components/QuickCapture';
import OnboardingModal, { useOnboarding } from './components/OnboardingModal';
import ErrorBoundary from './components/ErrorBoundary';
import PageSkeleton  from './components/PageSkeleton';
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
const CollectPage       = lazy(() => import('./pages/CollectPage'));
const FinancePage       = lazy(() => import('./pages/FinancePage'));
const LifeLogPage       = lazy(() => import('./pages/LifeLogPage'));

// ── SEO meta per route ─────────────────────────────────────────────
const ROUTE_META = {
  '/':           { title: 'Life Hub — Personal Life OS',                                     desc: 'Hệ điều hành cuộc sống cá nhân. Quản lý thói quen, tài chính, kiến thức và mục tiêu.' },
  '/tracker':    { title: 'Today — Life Hub',                                                 desc: 'Checklist hôm nay: thói quen, nhiệm vụ, và gợi nhở kiến thức.' },
  '/inbox':      { title: 'Inbox — Life Hub',                                                 desc: 'Ghi nhanh mọi thứ chưa phân loại. Phân loại sau.' },
  '/collect':    { title: 'Collect — Life Hub',                                               desc: 'Kho lưu trữ: links, quotes, wishlist, học tập, ý tưởng.' },
  '/finance':    { title: 'Finance — Life Hub',                                               desc: 'Quản lý chi tiêu cá nhân và đăng ký gói dịch vụ.' },
  '/life-log':   { title: 'Life Log — Life Hub',                                              desc: 'Lịch sử cuộc sống: heatmap cả năm và timeline hàng ngày.' },
  '/focus':      { title: 'Focus Timer — Life Hub',                                           desc: 'Dùng Pomodoro để tập trung sâu và liên kết với thói quen của bạn.' },
  '/journey':    { title: 'Lộ Trình — Life Hub',                                              desc: 'Chọn lộ trình 21 ngày phù hợp với bạn hoặc tự tạo lộ trình riêng.' },
  '/dashboard':  { title: 'Stats — Life Hub',                                                 desc: 'Thống kê toàn bộ quá trình: streak, XP, mood, habit completion.' },
  '/quiz':       { title: 'Quiz — Life Hub',                                                  desc: 'Kiểm tra hiểu biết về tâm lý hành vi. +50 XP nếu làm tốt!' },
  '/leaderboard':{ title: 'Bảng Xếp Hạng — Life Hub',                                        desc: 'Xem ai đang dẫn đầu về streak và XP.' },
  '/life-journey': { title: 'Hành Trình — Life Hub',                                           desc: 'Ghi lại những cột mốc quan trọng trên biểu đồ cảm xúc.' },
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
  const { isAuthenticated } = useAuth();
  const { activeJourney, isLoadingJourney } = useActiveJourney();
  const location = useLocation();

  // Only redirect ONCE per session after login if no active journey.
  // sessionStorage survives page reloads but clears on tab close.
  const REDIRECT_KEY = 'vl_journey_redirected';
  const [redirectToJourney, setRedirectToJourney] = useState(false);
  useEffect(() => {
    if (onboarded && isAuthenticated && !isLoadingJourney && !activeJourney
        && !sessionStorage.getItem(REDIRECT_KEY)
        && !location.pathname.startsWith('/journey')) {
      sessionStorage.setItem(REDIRECT_KEY, '1');
      setRedirectToJourney(true);
    } else if (activeJourney) {
      // Journey just started → clear flag so next login can re-check
      setRedirectToJourney(false);
      sessionStorage.removeItem(REDIRECT_KEY);
    }
  }, [onboarded, isAuthenticated, isLoadingJourney, activeJourney, location.pathname]);

  // Clear redirect state after navigation happens
  useEffect(() => {
    if (redirectToJourney && location.pathname.startsWith('/journey')) {
      setRedirectToJourney(false);
    }
  }, [location.pathname, redirectToJourney]);

  return (
    <>
      <PageMeta />
      {!onboarded && <OnboardingModal onDone={() => setOnboarded(true)} />}
      {redirectToJourney && <Navigate to="/journey?firstTime=true" replace />}
      <Navbar />
      <QuickCapture />

      <div className="app-content">
        <ErrorBoundary>
          <Suspense fallback={<PageSkeleton />}>
            <div className="page-transition" key={location.pathname}>
              <Routes>
                <Route path="/"             element={<LandingPage />} />
                <Route path="/tracker"      element={<TrackerPage />} />
                <Route path="/habits"       element={<Navigate to="/tracker" replace />} />
                <Route path="/inbox"        element={<InboxPage />} />
                <Route path="/collect"      element={<CollectPage />} />
                <Route path="/finance"      element={<FinancePage />} />
                <Route path="/life-log"     element={<LifeLogPage />} />
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
      <AuthProvider>
        <BrowserRouter>
          <JourneyProvider>
            <AppShell />
          </JourneyProvider>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
