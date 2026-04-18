import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import LandingPage    from './pages/LandingPage';
import TrackerPage    from './pages/TrackerPage';
import HabitsPage     from './pages/HabitsPage';
import FocusPage      from './pages/FocusPage';
import TeamPage       from './pages/TeamPage';
import DashboardPage  from './pages/DashboardPage';
import QuizPage       from './pages/QuizPage';
import LeaderboardPage from './pages/LeaderboardPage';
import FriendsPage    from './pages/FriendsPage';
import './styles/global.css';
import './index.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/"            element={<LandingPage />} />
          <Route path="/tracker"     element={<TrackerPage />} />
          <Route path="/habits"      element={<HabitsPage />} />
          <Route path="/focus"       element={<FocusPage />} />
          <Route path="/team"        element={<TeamPage />} />
          <Route path="/dashboard"   element={<DashboardPage />} />
          <Route path="/quiz"        element={<QuizPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/friends"     element={<FriendsPage />} />
          <Route path="*"            element={<LandingPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
