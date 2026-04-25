import { lazy, Suspense, useState, useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { JourneyProvider } from './contexts/JourneyContext';
import { useAuth } from './contexts/AuthContext';
import { useActiveJourney } from './contexts/JourneyContext';
import Navbar from './components/Navbar';
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
const TeamPage          = lazy(() => import('./pages/TeamPage'));
const DashboardPage     = lazy(() => import('./pages/DashboardPage'));
const QuizPage          = lazy(() => import('./pages/QuizPage'));
const LeaderboardPage   = lazy(() => import('./pages/LeaderboardPage'));
const FriendsPage       = lazy(() => import('./pages/FriendsPage'));
const JourneyPage       = lazy(() => import('./pages/JourneyPage'));
const JourneyDetailPage = lazy(() => import('./pages/JourneyDetailPage'));
const LifeJourneyPage   = lazy(() => import('./pages/LifeJourneyPage'));

// ── SEO meta per route ─────────────────────────────────────────────
const ROUTE_META = {
  '/':           { title: 'Vượt Lười — Thử Thách 21 Ngày Chinh Phục Thói Quen',             desc: 'Xây dựng thói quen tốt trong 21 ngày. Theo dõi streak, đặt mục tiêu, và cùng đồng đội vượt lười.' },
  '/tracker':    { title: 'Tracker — Vượt Lười',                                             desc: 'Tick ngày hôm nay, theo dõi streak và tiến độ 21 ngày của bạn.' },

  '/focus':      { title: 'Focus Timer — Vượt Lười',                                         desc: 'Dùng Pomodoro để tập trung sâu và liên kết với thói quen của bạn.' },
  '/team':       { title: 'Team — Vượt Lười',                                                desc: 'Tạo hoặc tham gia nhóm để cùng nhau vượt lười. Có đồng đội check = không bỏ cuộc được!' },
  '/journey':    { title: 'Lộ Trình — Vượt Lười',                                            desc: 'Chọn lộ trình 21 ngày phù hợp với bạn hoặc tự tạo lộ trình riêng.' },
  '/dashboard':  { title: 'Stats — Vượt Lười',                                               desc: 'Thống kê toàn bộ quá trình: streak, XP, mood, habit completion và lộ trình.' },
  '/quiz':       { title: 'Quiz — Vượt Lười',                                                desc: 'Kiểm tra hiểu biết về tâm lý hành vi và thói quen. +50 XP nếu làm tốt!' },
  '/leaderboard':{ title: 'Bảng Xếp Hạng — Vượt Lười',                                      desc: 'Xem ai đang dẫn đầu về streak và XP. Cạnh tranh lành mạnh!' },
  '/friends':      { title: 'Bạn Bè — Vượt Lười',                                              desc: 'Kết bạn, xem streak và XP của nhau, cổ vũ nhau cùng tiến.' },
  '/life-journey': { title: 'Hành Trình Cuộc Đời — Vượt Lười',                                 desc: 'Ghi lại những cột mốc quan trọng trong cuộc sống của bạn trên biểu đồ cảm xúc.' },
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

      <ErrorBoundary>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/"             element={<LandingPage />} />
            <Route path="/tracker"      element={<TrackerPage />} />
            <Route path="/habits"       element={<Navigate to="/tracker" replace />} />
            <Route path="/focus"        element={<FocusPage />} />
            <Route path="/team"         element={<TeamPage />} />
            <Route path="/dashboard"    element={<DashboardPage />} />
            <Route path="/quiz"         element={<QuizPage />} />
            <Route path="/leaderboard"  element={<LeaderboardPage />} />
            <Route path="/friends"      element={<FriendsPage />} />
            <Route path="/journey"      element={<JourneyPage />} />
            <Route path="/journey/:id"  element={<JourneyDetailPage />} />
            <Route path="/life-journey" element={<LifeJourneyPage />} />
            <Route path="*"             element={<LandingPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
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
