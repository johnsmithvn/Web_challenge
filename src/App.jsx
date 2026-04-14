import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import TrackerPage from './pages/TrackerPage';
import TeamPage from './pages/TeamPage';
import DashboardPage from './pages/DashboardPage';
import QuizPage from './pages/QuizPage';
import LeaderboardPage from './pages/LeaderboardPage';
import './styles/global.css';
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/"            element={<LandingPage />} />
        <Route path="/tracker"     element={<TrackerPage />} />
        <Route path="/team"        element={<TeamPage />} />
        <Route path="/dashboard"   element={<DashboardPage />} />
        <Route path="/quiz"        element={<QuizPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="*"            element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  );
}
