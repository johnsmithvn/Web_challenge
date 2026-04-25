import { useState, useEffect } from 'react';
import { useActivityLog } from '../hooks/useActivityLog';
import { useAuth } from '../contexts/AuthContext';
import ActivityHeatmap from '../components/ActivityHeatmap';
import DailyTimeline from '../components/DailyTimeline';
import '../styles/lifelog.css';

export default function LifeLogPage() {
  const { user } = useAuth();
  const { getHeatmapData, getTimelineByDate, getTodayCount } = useActivityLog();

  const [year] = useState(() => new Date().getFullYear());
  const [heatmapData, setHeatmapData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [todayCount, setTodayCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch heatmap data for the year
  useEffect(() => {
    if (!user) return;
    const fetchHeatmap = async () => {
      setLoading(true);
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const data = await getHeatmapData(startDate, endDate);
      setHeatmapData(data);
      const count = await getTodayCount();
      setTodayCount(count);
      setLoading(false);
    };
    fetchHeatmap();
  }, [user, year]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch timeline when date is clicked
  useEffect(() => {
    if (!selectedDate || !user) return;
    const fetchTimeline = async () => {
      const data = await getTimelineByDate(selectedDate);
      setTimeline(data);
    };
    fetchTimeline();
  }, [selectedDate, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDateClick = (date) => {
    setSelectedDate(date === selectedDate ? null : date);
  };

  if (!user) {
    return (
      <div className="lifelog-page">
        <div className="lifelog-page__empty">🔐 Đăng nhập để xem Life Log</div>
      </div>
    );
  }

  return (
    <div className="lifelog-page">
      <div className="lifelog-page__header">
        <h1 className="lifelog-page__title">📅 Life Log</h1>
        <p className="lifelog-page__subtitle">
          Lịch sử hoạt động — {year}
        </p>
      </div>

      {/* Today stat */}
      <div className="lifelog-today">
        <span className="lifelog-today__label">Hôm nay</span>
        <span className="lifelog-today__count">{todayCount}</span>
        <span className="lifelog-today__unit">hoạt động</span>
      </div>

      {/* Heatmap */}
      {loading ? (
        <div className="lifelog-loading">Đang tải heatmap...</div>
      ) : (
        <ActivityHeatmap
          data={heatmapData}
          year={year}
          onDateClick={handleDateClick}
        />
      )}

      {/* Daily timeline */}
      {selectedDate && (
        <div className="lifelog-timeline-section">
          <DailyTimeline entries={timeline} date={selectedDate} />
        </div>
      )}
    </div>
  );
}
