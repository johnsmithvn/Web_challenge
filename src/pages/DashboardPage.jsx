import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useHabitStore } from '../hooks/useHabitStore';
import { useXpStore } from '../hooks/useXpStore';
import { useSkipReasons } from '../hooks/useMoodSkip';
import '../styles/tracker.css';
import '../styles/dashboard.css';


const DAY_LABELS = ['T2','T3','T4','T5','T6','T7','CN'];

/* ── Insight từ streak ───────────────────────────────────── */
function insightFromStreak(streak) {
  if (streak === 0)  return { text: 'Chưa bắt đầu. Tick ngày đầu tiên để khởi động!', color: 'var(--text-muted)' };
  if (streak < 3)    return { text: `🔥 ${streak} ngày! Chỉ ${3-streak} ngày nữa vào vùng quán tính.`, color: 'var(--orange)' };
  if (streak < 10)   return { text: `💪 Streak ${streak}! Não bộ đang hình thành thói quen. Đừng phá vỡ chuỗi.`, color: 'var(--purple-light)' };
  if (streak < 21)   return { text: `🌳 ${streak} ngày! Chỉ ${21-streak} ngày nữa hoàn thành chương trình.`, color: 'var(--green)' };
  return { text: '🏆 21 ngày! Kỷ luật đã thành bản năng. Bắt đầu vòng mới?', color: 'var(--gold)' };
}

/* ── Flower row (lấy cảm hứng từ spreadsheet) ───────────── */
const FLOWERS = ['🌰','🌱','🌿','🌸','🌺','🌻'];
function flowerForDay(streakAtThatPoint) {
  if (streakAtThatPoint === 0) return '⬜';
  const idx = Math.min(Math.floor(streakAtThatPoint / 4), FLOWERS.length - 1);
  return FLOWERS[idx];
}

function FlowerJourney({ data, startDate }) {
  const days = useMemo(() => {
    const result = [];
    let streak = 0;
    for (let i = 0; i < 21; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const key = d.toISOString().split('T')[0];
      const done = !!data[key];
      if (done) streak++;
      else if (key < new Date().toISOString().split('T')[0]) streak = 0;
      result.push({ key, done, dayNum: i + 1, streak });
    }
    return result;
  }, [data, startDate]);

  return (
    <div className="flower-journey">
      {days.map((day, i) => {
        const today = day.key === new Date().toISOString().split('T')[0];
        const future = day.key > new Date().toISOString().split('T')[0];
        return (
          <div key={i}
            className={`flower-slot ${today ? 'flower-slot--today' : ''} ${future ? 'flower-slot--future' : ''}`}
            title={`Ngày ${day.dayNum} · ${day.key}`}
          >
            <span className="flower-emoji">
              {future ? '⬜' : day.done ? flowerForDay(day.streak) : '🩶'}
            </span>
            <span className="flower-day">{day.dayNum}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── GitHub contribution heatmap (12 weeks) ─────────────── */
function ContributionGraph({ data }) {
  const today   = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // build 84 days (12 weeks), aligned to Mon
  const startDay = new Date(today);
  const dow = startDay.getDay(); // 0=Sun
  const daysBack = (dow === 0 ? 6 : dow - 1) + 77; // back to Monday, 12 weeks
  startDay.setDate(startDay.getDate() - daysBack);

  const cells = Array.from({ length: 84 }, (_, i) => {
    const d = new Date(startDay);
    d.setDate(startDay.getDate() + i);
    const key = d.toISOString().split('T')[0];
    return { key, done: !!data[key], isToday: key === todayStr, isFuture: key > todayStr };
  });

  // group into columns (each 7 days = 1 week column)
  const cols = Array.from({ length: 12 }, (_, w) => cells.slice(w * 7, w * 7 + 7));

  return (
    <div className="contrib-graph">
      <div className="contrib-graph__labels">
        {DAY_LABELS.map(l => <span key={l}>{l}</span>)}
      </div>
      <div className="contrib-graph__cols">
        {cols.map((col, ci) => (
          <div key={ci} className="contrib-graph__col">
            {col.map((cell, ri) => (
              <div
                key={ri}
                className={[
                  'contrib-cell',
                  cell.done    ? 'contrib-cell--done'   : '',
                  cell.isToday ? 'contrib-cell--today'  : '',
                  cell.isFuture? 'contrib-cell--future' : '',
                ].join(' ')}
                title={cell.key + (cell.done ? ' ✓' : '')}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="contrib-graph__legend">
        <span>Ít hơn</span>
        <div className="contrib-cell contrib-cell--empty-demo" />
        <div className="contrib-cell contrib-cell--done contrib-cell--l1" />
        <div className="contrib-cell contrib-cell--done contrib-cell--l2" />
        <div className="contrib-cell contrib-cell--done" />
        <span>Nhiều hơn</span>
      </div>
    </div>
  );
}

/* ── Monthly donut ring ────────────────────────────────── */
function MonthDonut({ data }) {
  const now  = new Date();
  const year = now.getFullYear();
  const mon  = now.getMonth();
  const total = new Date(year, mon + 1, 0).getDate();
  const done  = Array.from({ length: now.getDate() }, (_, i) => {
    const d = new Date(year, mon, i + 1).toISOString().split('T')[0];
    return !!data[d];
  }).filter(Boolean).length;
  const pct = Math.round((done / Math.min(now.getDate(), total)) * 100);

  const r    = 44;
  const circ = 2 * Math.PI * r;
  const off  = circ - (pct / 100) * circ;
  const color = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--purple)' : 'var(--orange)';
  const month = now.toLocaleDateString('vi-VN', { month: 'long' });

  return (
    <div className="month-donut">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
        <circle cx="60" cy="60" r={r} fill="none"
          stroke={color} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={off}
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="month-donut__center">
        <span className="month-donut__pct" style={{ color }}>{pct}%</span>
        <span className="month-donut__label">{month}</span>
      </div>
      <div className="month-donut__detail">
        <div className="month-donut__stat">
          <span style={{ color: 'var(--green)', fontWeight: 700 }}>{done}</span>
          <span>Hoàn thành</span>
        </div>
        <div className="month-donut__stat">
          <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{now.getDate() - done}</span>
          <span>Bỏ qua</span>
        </div>
        <div className="month-donut__stat">
          <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{total - now.getDate()}</span>
          <span>Còn lại</span>
        </div>
      </div>
    </div>
  );
}

/* ── Weekly summary table ───────────────────────────────── */
function WeeklyTable({ data }) {
  const weeks = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 4 }, (_, wi) => {
      const startMon = new Date(now);
      // go back to this Monday
      const thisDow = startMon.getDay() === 0 ? 6 : startMon.getDay() - 1;
      startMon.setDate(startMon.getDate() - thisDow - wi * 7);
      return Array.from({ length: 7 }, (_, di) => {
        const d = new Date(startMon);
        d.setDate(startMon.getDate() + di);
        const key = d.toISOString().split('T')[0];
        const future = key > now.toISOString().split('T')[0];
        return { key, done: !!data[key], future, date: d.getDate() };
      });
    }).reverse();
  }, [data]);

  return (
    <div className="weekly-table">
      <div className="weekly-table__head">
        {DAY_LABELS.map(l => <div key={l} className="weekly-table__th">{l}</div>)}
        <div className="weekly-table__th" style={{ color: 'var(--green)' }}>✓</div>
        <div className="weekly-table__th" style={{ color: 'var(--red)' }}>✗</div>
        <div className="weekly-table__th">%</div>
      </div>
      {weeks.map((week, wi) => {
        const done   = week.filter(d => !d.future && d.done).length;
        const missed = week.filter(d => !d.future && !d.done).length;
        const passed = done + missed;
        const pct    = passed > 0 ? Math.round((done / passed) * 100) : null;
        return (
          <div key={wi} className="weekly-table__row">
            {week.map((day, di) => (
              <div key={di}
                className={[
                  'weekly-table__cell',
                  day.future ? 'weekly-table__cell--future' : day.done ? 'weekly-table__cell--done' : 'weekly-table__cell--miss',
                ].join(' ')}
                title={day.key}
              >
                {day.future ? <span style={{ opacity: 0.3 }}>{day.date}</span>
                  : day.done ? '✓' : <span style={{ opacity: 0.4 }}>{day.date}</span>
                }
              </div>
            ))}
            <div className="weekly-table__stat" style={{ color: 'var(--green)' }}>{done}</div>
            <div className="weekly-table__stat" style={{ color: 'var(--red)' }}>{missed}</div>
            <div className="weekly-table__stat" style={{ color: pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--orange)' : 'var(--red)' }}>
              {pct !== null ? pct + '%' : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Skip Reason Insight ────────────────────────────────── */
function SkipInsight() {
  const { getAllSkips } = useSkipReasons();

  const insight = useMemo(() => {
    const skips = getAllSkips();
    if (!skips || !skips.length) return null;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const recent = skips.filter(s => s.date >= cutoffStr);
    if (!recent.length) return null;
    const counts = {};
    recent.forEach(s => {
      const r = s.reason || 'Lý do khác';
      counts[r] = (counts[r] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return { total: recent.length, top };
  }, [getAllSkips]);

  if (!insight) return null;

  const [topReason, topCount] = insight.top[0];
  const tips = {
    'Thiếu động lực': '💡 Thử giảm durationMin xuống 5 phút — bắt đầu nhỏ hơn dễ hơn.',
    'Bận công việc':  '💡 Dời habit sang buổi sáng trước khi ngày làm việc bắt đầu.',
    'Quên mất':       '💡 Bật nhắc nhở trong Tracker — tick trước 23:59.',
  };

  return (
    <div className="card db-section" style={{ borderColor: 'rgba(249,115,22,0.2)' }}>
      <div className="dash-card-title">🔍 Phân Tích Bỏ Qua — 14 Ngày Gần Đây</div>
      <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div className="dash-insight" style={{ borderColor: 'var(--orange)', marginTop: 0 }}>
          Bỏ qua <strong>{insight.total} lần</strong>. Lý do chủ yếu:{' '}
          <strong style={{ color: 'var(--orange)' }}>"{topReason}"</strong> ({topCount} lần)
        </div>
        {insight.top.slice(0, 3).map(([reason, count]) => {
          const pct = Math.round((count / insight.total) * 100);
          return (
            <div key={reason} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', flex: 1 }}>{reason}</span>
              <div style={{ width: 100, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: 'var(--orange)', borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{count}x</span>
            </div>
          );
        })}
        {tips[topReason] && (
          <div style={{ fontSize: '0.82rem', color: 'var(--purple-light)', marginTop: '0.25rem' }}>
            {tips[topReason]}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { data, streak, longestStreak, totalDone, completionPct, badge } = useHabitStore();
  const { totalXp } = useXpStore();

  // Program start = earliest checked date
  const checkedDates = Object.keys(data).filter(k => data[k]).sort();
  const startDate    = checkedDates[0] ? new Date(checkedDates[0]) : new Date();

  const insight = insightFromStreak(streak);

  return (
    <div className="dashboard-page">
      <div className="container">

        {/* Header */}
        <div className="db-header">
          <div>
            <div className="section-label">📈 Tổng Quan</div>
            <h1 className="display-2">Dashboard <span className="gradient-text">Của Bạn</span></h1>
          </div>
          <Link to="/tracker" className="btn btn-ghost" style={{ fontSize: '0.85rem' }}>
            🗓 Tracker →
          </Link>
        </div>

        {/* KPI row */}
        <div className="db-kpi-row">
          <div className="db-kpi card">
            <div className="db-kpi__icon">🔥</div>
            <div className="db-kpi__val gradient-text">{streak}</div>
            <div className="db-kpi__label">Streak hiện tại</div>
            {badge && <div className={`badge badge-${badge.color === 'gold' ? 'gold' : 'green'}`} style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>{badge.emoji} {badge.label}</div>}
          </div>
          <div className="db-kpi card">
            <div className="db-kpi__icon">🏅</div>
            <div className="db-kpi__val gradient-text-gold">{longestStreak}</div>
            <div className="db-kpi__label">Best streak</div>
          </div>
          <div className="db-kpi card">
            <div className="db-kpi__icon">✅</div>
            <div className="db-kpi__val gradient-text-green">{totalDone}</div>
            <div className="db-kpi__label">Tổng hoàn thành</div>
          </div>
          <div className="db-kpi card">
            <div className="db-kpi__icon">⭐</div>
            <div className="db-kpi__val" style={{ color: 'var(--cyan)' }}>{totalXp || 0}</div>
            <div className="db-kpi__label">Tổng XP</div>
          </div>
        </div>

        {/* Flower journey */}
        <div className="card db-section">
          <div className="dash-card-title">🌸 Hành Trình 21 Ngày</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
            Mỗi ô là 1 ngày — hoa nở theo streak liên tiếp
          </p>
          <FlowerJourney data={data} startDate={startDate} />
          <div className="flower-legend">
            {'🌰 → 🌱 → 🌿 → 🌸 → 🌺 → 🌻'.split(' → ').map((f, i) => (
              <span key={i} style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{f}</span>
            ))}
          </div>
        </div>

        {/* 2-col: donut + weekly table */}
        <div className="db-two-col">
          <div className="card db-section">
            <div className="dash-card-title">🎯 Tháng Này</div>
            <MonthDonut data={data} />
          </div>
          <div className="card db-section">
            <div className="dash-card-title">📋 Tuần Gần Đây</div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem', marginTop: '0.25rem' }}>
              4 tuần gần nhất · Hoàn thành / Bỏ / Tỷ lệ
            </p>
            <WeeklyTable data={data} />
          </div>
        </div>

        {/* Contribution graph */}
        <div className="card db-section">
          <div className="dash-card-title">📅 Contribution — 12 Tuần Gần Đây</div>
          <ContributionGraph data={data} />
        </div>

        {/* Skip Insight */}
        <SkipInsight />

        {/* Insight */}
        <div className="card db-section">
          <div className="dash-card-title">💡 Nhận Xét</div>
          <div className="dash-insight" style={{ borderColor: insight.color, marginTop: '0.75rem' }}>
            {insight.text}
          </div>
          {totalDone >= 7 && (
            <div className="dash-insight" style={{ borderColor: 'var(--green)', marginTop: '0.5rem' }}>
              ⚡ Bạn đã hoàn thành <strong>{totalDone} ngày</strong> kể từ khi bắt đầu. Tiếp tục để đạt <strong>{Math.ceil(totalDone / 7) * 7 + 7} ngày</strong>!
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
