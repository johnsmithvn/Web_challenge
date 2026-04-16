import { useEffect } from 'react';
import { useHabitStore } from '../hooks/useHabitStore';
import { useXpStore, XP_REWARDS } from '../hooks/useXpStore';
import { useNotifications } from '../hooks/useNotifications';
import { useTeam } from '../hooks/useTeam';
import TrackerSection from '../components/TrackerSection';
import DailyChallenge from '../components/DailyChallenge';
import XpBar from '../components/XpBar';
import NotificationSettings from '../components/NotificationSettings';
import '../styles/tracker.css';
import '../styles/xpbar.css';

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export default function TrackerPage() {
  const { data, weekDates, streak, totalDone, completionPct, badge, todayDone } = useHabitStore();
  const { addXp, hasMilestone } = useXpStore();
  const { scheduleTodayReminder } = useNotifications();

  // useTeam — always called (Rules of Hooks), handles errors internally
  const { team } = useTeam();
  const isInTeam = !!(team?.id);

  // Award XP for streak milestones
  useEffect(() => {
    if (streak >= 3  && !hasMilestone('streak_3'))  addXp(XP_REWARDS.streak_3,  'streak_3',  { streak: 3  });
    if (streak >= 10 && !hasMilestone('streak_10')) addXp(XP_REWARDS.streak_10, 'streak_10', { streak: 10 });
    if (streak >= 21 && !hasMilestone('streak_21')) addXp(XP_REWARDS.streak_21, 'streak_21', { streak: 21 });
  }, [streak]);

  // Schedule push reminder
  useEffect(() => {
    const cleanup = scheduleTodayReminder(todayDone);
    return cleanup;
  }, [todayDone]);

  // 28-day heatmap
  const heatmap = Array.from({ length: 28 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (27 - i));
    const key = d.toISOString().split('T')[0];
    return { key, done: !!data[key], isToday: key === new Date().toISOString().split('T')[0] };
  });

  return (
    <div className="dashboard-page">
      <div className="container">
        <div style={{ marginBottom: '2rem' }}>
          <div className="section-label">📊 Của Bạn</div>
          <h1 className="display-2">
            Tracker <span className="gradient-text">Kỷ Luật</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Tick mỗi ngày để xây streak 🔥 — đừng phá vỡ chuỗi!
          </p>
        </div>

        {/* XP Bar */}
        <XpBar />

        {/* Daily Challenge */}
        <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
          <DailyChallenge />
        </div>

        {/* Heatmap */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="dash-card-title">📅 28 Ngày Gần Đây</div>
          <div className="heatmap-labels">
            {DAY_LABELS.map(l => <span key={l} className="heatmap-label">{l}</span>)}
          </div>
          <div className="heatmap-grid">
            {heatmap.map((day, i) => (
              <div
                key={i}
                className={`heatmap-cell ${day.isToday ? 'heatmap-cell--today' : day.done ? 'heatmap-cell--done' : 'heatmap-cell--empty'}`}
                title={day.key + (day.done ? ' ✓' : '')}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span>⬜ Chưa làm</span>
            <span style={{ color: 'var(--green)' }}>🟩 Đã làm</span>
            <span style={{ color: 'var(--cyan)' }}>🟦 Hôm nay</span>
          </div>
        </div>

        {/* Habit table */}
        <TrackerSection compact={true} isInTeam={isInTeam} />

        {/* Insight */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="dash-card-title">💡 Insight</div>
          {streak === 0 && <div className="dash-insight">Bắt đầu hôm nay! Streak đầu tiên luôn là khó nhất — nhưng sau ngày 1, mọi thứ dễ hơn.</div>}
          {streak > 0 && streak < 3  && <div className="dash-insight">🔥 Streak {streak} ngày! Chỉ cần {3 - streak} ngày nữa để nhận badge <strong>Lấy Đà</strong> + <strong>+50 XP</strong>.</div>}
          {streak >= 3 && streak < 10 && <div className="dash-insight">🟢 Bạn đang có đà! Tiếp tục {10 - streak} ngày nữa để đạt <strong>Bứt Phá</strong> + <strong>+100 XP</strong>.</div>}
          {streak >= 10 && streak < 21 && <div className="dash-insight">🟡 Ấn tượng! Chỉ còn {21 - streak} ngày để <strong>Hoàn Thành</strong> + <strong>+200 XP</strong>!</div>}
          {streak >= 21 && <div className="dash-insight" style={{ borderColor: 'var(--gold)' }}>🏆 <strong>XUẤT SẮC!</strong> 21 ngày hoàn thành! Kỷ luật đã trở thành bản năng.</div>}
        </div>

        {/* Notification settings */}
        <div style={{ marginTop: '1.5rem' }}>
          <NotificationSettings />
        </div>
      </div>
    </div>
  );
}
