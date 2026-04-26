import { useState, useEffect, lazy, Suspense } from 'react';
import { useActivityLog } from '../hooks/useActivityLog';
import { useHabitStore } from '../hooks/useHabitStore';
import { useMoodLog, useSkipReasons } from '../hooks/useMoodSkip';
import { useUserTasks } from '../hooks/useUserTasks';
import { useAuth } from '../contexts/AuthContext';
import ActivityHeatmap from '../components/ActivityHeatmap';
import '../styles/lifelog.css';

const MonthCalendar = lazy(() => import('../components/MonthCalendar'));

export default function LifeLogPage() {
  const { user } = useAuth();
  const { getHeatmapData, getTodayCount } = useActivityLog();
  const { data: habitData } = useHabitStore();
  const { moodLog } = useMoodLog();
  const { skipLog } = useSkipReasons();
  const { getCompletedTasks } = useUserTasks();

  const today = new Date().toISOString().split('T')[0];
  const [year]                        = useState(() => new Date().getFullYear());
  const [heatmapData, setHeatmapData] = useState([]);
  const [todayCount, setTodayCount]   = useState(0);
  const [loadingHeatmap, setLoadingHeatmap] = useState(false);

  // Fetch year heatmap
  useEffect(() => {
    if (!user) return;
    const fetchHeatmap = async () => {
      setLoadingHeatmap(true);
      const data = await getHeatmapData(`${year}-01-01`, `${year}-12-31`);
      setHeatmapData(data);
      const count = await getTodayCount();
      setTodayCount(count);
      setLoadingHeatmap(false);
    };
    fetchHeatmap();
  }, [user, year]); // eslint-disable-line react-hooks/exhaustive-deps

  // Heatmap cell click — no-op for now, MonthCalendar handles detail
  const handleHeatmapClick = () => {};

  // MonthCalendar day click callback (for future use)
  const handleCalendarDayClick = () => {};

  if (!user) {
    return (
      <div className="lifelog-page">
        <div className="lifelog-page__empty">🔐 Đăng nhập để xem Life Log</div>
      </div>
    );
  }

  return (
    <div className="lifelog-page">

      {/* Header */}
      <div className="lifelog-page__header">
        <div className="section-label">📅 Life Log</div>
        <h1 className="lifelog-page__title">
          Lịch Sử <span className="gradient-text">Cuộc Sống</span>
        </h1>
        <p className="lifelog-page__subtitle">
          Hành trình mỗi ngày của bạn — {year}
        </p>
      </div>

      {/* Today pill stat */}
      <div className="lifelog-today">
        <span className="lifelog-today__label">Hôm nay</span>
        <span className="lifelog-today__count">{todayCount}</span>
        <span className="lifelog-today__unit">hoạt động</span>
      </div>

      {/* ── PRIMARY: MonthCalendar ─────────────────────────── */}
      <Suspense fallback={
        <div className="card lifelog-cal-loading">⏳ Đang tải lịch...</div>
      }>
        <MonthCalendar
          habitData={habitData}
          moodLog={moodLog}
          skipLog={skipLog}
          getCompletedTasks={getCompletedTasks}
          onDayClick={handleCalendarDayClick}
        />
      </Suspense>

      <div className="lifelog-heatmap-section">
        <div className="card lifelog-heatmap-card">
          <div className="lifelog-heatmap-header">
            <span className="dash-card-title">🗓 Hoạt Động — {year}</span>
            <span className="lifelog-heatmap-hint">Click ô để xem chi tiết</span>
          </div>
          {loadingHeatmap ? (
            <div className="lifelog-loading">Đang tải heatmap...</div>
          ) : (
            <ActivityHeatmap
              data={heatmapData}
              year={year}
              onDateClick={handleHeatmapClick}
            />
          )}
        </div>
      </div>

    </div>
  );
}
