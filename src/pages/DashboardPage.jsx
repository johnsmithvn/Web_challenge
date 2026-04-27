import { useMemo, useState, useEffect, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import { useHabitStore } from '../hooks/useHabitStore';
import { useXpStore, computeLevel } from '../hooks/useXpStore';
import { useSkipReasons, useMoodLog } from '../hooks/useMoodSkip';
import { useExpenses } from '../hooks/useExpenses';
import { useSubscriptions } from '../hooks/useSubscriptions';
import { useActivityLog } from '../hooks/useActivityLog';
import { useFocusTimer } from '../hooks/useFocusTimer';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import ActivityHeatmap from '../components/ActivityHeatmap';
import '../styles/tracker.css';
import '../styles/dashboard.css';

const DAY_LABELS = ['T2','T3','T4','T5','T6','T7','CN'];
const FLOWERS = ['🌰','🌱','🌿','🌸','🌺','🌻'];
const CAT_COLORS = {
  'Ăn uống':'#f97316','Di chuyển':'#3b82f6','Mua sắm':'#8b5cf6',
  'Sức khỏe':'#22c55e','Học tập':'#06b6d4','Giải trí':'#ec4899',
  'Hóa đơn':'#eab308','Khác':'#64748b',
};

function fmt(n) {
  if (n >= 1_000_000) return (n/1_000_000).toFixed(1)+'M';
  if (n >= 1_000) return (n/1_000).toFixed(0)+'k';
  return n.toLocaleString('vi-VN');
}

function insightFromStreak(s) {
  if (s===0) return { text:'Chưa bắt đầu. Tick ngày đầu tiên!', color:'var(--text-muted)' };
  if (s<3)   return { text:`🔥 ${s} ngày! Chỉ ${3-s} ngày nữa vào vùng quán tính.`, color:'var(--orange)' };
  if (s<10)  return { text:`💪 Streak ${s}! Não đang hình thành thói quen.`, color:'var(--purple-light)' };
  if (s<21)  return { text:`🌳 ${s} ngày! ${21-s} ngày nữa hoàn thành chương trình.`, color:'var(--green)' };
  return { text:'🏆 21 ngày! Kỷ luật đã thành bản năng.', color:'var(--gold)' };
}

const MOOD_SCORE = { 'Xuất sắc': 5, 'Tốt': 4, 'Bình thường': 3, 'Không tốt': 2, 'Tệ': 1 };
const MOOD_COLOR = { 5: '#22c55e', 4: '#06b6d4', 3: '#8b5cf6', 2: '#f97316', 1: '#ef4444' };

const MOOD_EMOJI = { 5: '💪', 4: '😊', 3: '😐', 2: '😔', 1: '😴' };

/* ── Mood Trend Chart (7/30 day toggle) ─────────────────── */
const MoodTrendChart = memo(function MoodTrendChart({ moodLog }) {
  const [range, setRange] = useState(7);

  const days = useMemo(() => {
    const res = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const mood = moodLog[key] ?? null;
      const score = mood ? (MOOD_SCORE[mood.label] ?? null) : null;
      res.push({
        key,
        label: range <= 7
          ? d.toLocaleDateString('vi-VN', { weekday: 'short' }).replace('Th ', 'T')
          : `${d.getDate()}/${d.getMonth() + 1}`,
        emoji: mood?.emoji ?? null,
        score,
        color: score ? MOOD_COLOR[score] : null,
      });
    }
    return res;
  }, [moodLog, range]);

  const withData = days.filter(d => d.score !== null);
  const avg = withData.length ? (withData.reduce((s, d) => s + d.score, 0) / withData.length).toFixed(1) : null;

  const W = 480, H = 120, PAD_X = 32, PAD_Y = 16;
  const plotW = W - PAD_X * 2;
  const plotH = H - PAD_Y * 2;
  const stepX = days.length > 1 ? plotW / (days.length - 1) : 0;

  // Build SVG polyline points for connected dots
  const points = days.map((d, i) => {
    const x = PAD_X + i * stepX;
    const y = d.score !== null
      ? PAD_Y + plotH - ((d.score - 1) / 4) * plotH
      : null;
    return { ...d, x, y, i };
  });

  const linePoints = points.filter(p => p.y !== null);
  const linePath = linePoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  // Show label every N items depending on range
  const labelEvery = range <= 7 ? 1 : range <= 14 ? 2 : 5;

  return (
    <div className="mood-trend">
      <div className="mood-trend__header">
        <div className="mood-trend__tabs">
          {[7, 30].map(r => (
            <button key={r} className={`mood-trend__tab${range === r ? ' mood-trend__tab--active' : ''}`}
              onClick={() => setRange(r)}>{r} ngày</button>
          ))}
        </div>
        {avg && <div className="mood-trend__avg">TB: <strong style={{color: MOOD_COLOR[Math.round(avg)]}}>{avg}/5</strong> {MOOD_EMOJI[Math.round(avg)]}</div>}
      </div>

      {!withData.length ? (
        <div className="mood-trend__empty">Chưa có dữ liệu tâm trạng {range} ngày này</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <svg width="100%" viewBox={`0 0 ${W} ${H + 28}`} style={{ minWidth: 280 }}>
            {/* grid lines */}
            {[1, 2, 3, 4, 5].map(lv => {
              const y = PAD_Y + plotH - ((lv - 1) / 4) * plotH;
              return <line key={lv} x1={PAD_X} y1={y} x2={W - PAD_X} y2={y}
                stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />;
            })}
            {/* line */}
            {linePoints.length > 1 && (
              <path d={linePath} fill="none" stroke="var(--purple)" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
            )}
            {/* dots */}
            {points.map((p) => p.y !== null && (
              <g key={p.key}>
                <circle cx={p.x} cy={p.y} r="5" fill={p.color} stroke="var(--bg-card)" strokeWidth="2" />
                <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10">{p.emoji}</text>
              </g>
            ))}
            {/* x labels */}
            {points.map((p, i) => (i % labelEvery === 0 || i === points.length - 1) && (
              <text key={`l-${p.key}`} x={p.x} y={H + 18} textAnchor="middle"
                fill={i === points.length - 1 ? 'var(--purple-light)' : 'var(--text-muted)'}
                fontSize="9" fontWeight={i === points.length - 1 ? 700 : 400}>
                {i === points.length - 1 ? 'Nay' : p.label}
              </text>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
});

/* ── Focus Breakdown Per Habit (7 days) ─────────────────── */
const FocusBreakdown = memo(function FocusBreakdown() {
  const { user, isAuthenticated } = useAuth();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const useDB = isSupabaseEnabled && isAuthenticated;

  useEffect(() => {
    if (!useDB || !user) return;
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceStr = since.toISOString().split('T')[0];

    (async () => {
      // Fetch focus sessions for last 7 days
      const { data: sessions, error } = await supabase
        .from('focus_sessions')
        .select('habit_id, duration_min')
        .eq('user_id', user.id)
        .gte('date', sinceStr);

      if (error || !sessions?.length) { setData([]); setTotal(0); return; }

      // Group by habit_id
      const map = {};
      let t = 0;
      sessions.forEach(s => {
        const hid = s.habit_id || '__none__';
        map[hid] = (map[hid] || 0) + s.duration_min;
        t += s.duration_min;
      });
      setTotal(t);

      // Fetch habit names
      const habitIds = Object.keys(map).filter(k => k !== '__none__');
      let habitNames = {};
      if (habitIds.length) {
        const { data: habits } = await supabase
          .from('habits')
          .select('id, name, icon, color')
          .in('id', habitIds);
        if (habits) habits.forEach(h => { habitNames[h.id] = h; });
      }

      const rows = Object.entries(map)
        .map(([hid, mins]) => ({
          id: hid,
          name: hid === '__none__' ? 'Không gắn habit' : (habitNames[hid]?.name || 'Unknown'),
          icon: hid === '__none__' ? '⏱' : (habitNames[hid]?.icon || '⚡'),
          color: hid === '__none__' ? '#64748b' : (habitNames[hid]?.color || '#8b5cf6'),
          mins,
          pct: Math.round((mins / t) * 100),
        }))
        .sort((a, b) => b.mins - a.mins);

      setData(rows);
    })();
  }, [useDB, user?.id]);

  if (!useDB) return null;
  if (!data.length) return (
    <div className="focus-bkdn__empty">Chưa có session focus 7 ngày gần đây</div>
  );

  const hours = Math.floor(total / 60);
  const mins = total % 60;

  return (
    <div className="focus-bkdn">
      <div className="focus-bkdn__total">
        Tổng: <strong>{hours > 0 ? `${hours}h ` : ''}{mins}p</strong> · {data.length} habits
      </div>
      {data.map(row => (
        <div key={row.id} className="focus-bkdn__row">
          <span className="focus-bkdn__icon">{row.icon}</span>
          <span className="focus-bkdn__name">{row.name}</span>
          <div className="focus-bkdn__bar">
            <div className="focus-bkdn__bar-fill" style={{ width: `${row.pct}%`, background: row.color }} />
          </div>
          <span className="focus-bkdn__val">{row.mins}p</span>
          <span className="focus-bkdn__pct">{row.pct}%</span>
        </div>
      ))}
    </div>
  );
});

/* ── Weekly Review Digest ───────────────────────────────── */
const WeeklyReview = memo(function WeeklyReview({ data: habitData, streak, xpLog, todayMinutes, expenses, moodLog }) {
  const [expanded, setExpanded] = useState(false);

  const review = useMemo(() => {
    const now = new Date();
    // This week: Mon..today
    const dow = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - dow);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);

    const dateStr = (d) => d.toISOString().split('T')[0];
    const range = (start, days) => {
      const r = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        r.push(dateStr(d));
      }
      return r;
    };

    const thisWeekDays = range(thisWeekStart, dow + 1);
    const lastWeekDays = range(lastWeekStart, 7);

    // Habits: days completed
    const thisHabits = thisWeekDays.filter(d => !!habitData[d]).length;
    const lastHabits = lastWeekDays.filter(d => !!habitData[d]).length;

    // XP this week vs last
    const xpInRange = (dates) => xpLog.filter(e => {
      const d = new Date(e.ts).toISOString().split('T')[0];
      return dates.includes(d);
    }).reduce((s, e) => s + e.amount, 0);
    const thisXp = xpInRange(thisWeekDays);
    const lastXp = xpInRange(lastWeekDays);

    // Expenses this week vs last
    const expInRange = (dates) => expenses.filter(e => dates.includes(e.date)).reduce((s, e) => s + (e.amount || 0), 0);
    const thisExp = expInRange(thisWeekDays);
    const lastExp = expInRange(lastWeekDays);

    // Mood avg this week vs last
    const moodAvg = (dates) => {
      const moods = dates.map(d => moodLog[d]).filter(Boolean).map(m => MOOD_SCORE[m.label] ?? 3);
      return moods.length ? (moods.reduce((a, b) => a + b, 0) / moods.length) : null;
    };
    const thisMood = moodAvg(thisWeekDays);
    const lastMood = moodAvg(lastWeekDays);

    return { thisHabits, lastHabits, thisXp, lastXp, thisExp, lastExp, thisMood, lastMood, daysInWeek: dow + 1 };
  }, [habitData, xpLog, expenses, moodLog]);

  const trend = (curr, prev) => {
    if (prev === 0 && curr === 0) return { arrow: '→', color: 'var(--text-muted)', text: 'ổn định' };
    const diff = curr - prev;
    if (diff > 0) return { arrow: '↑', color: 'var(--green)', text: `+${typeof curr === 'number' && curr > 100 ? fmt(diff) : diff}` };
    if (diff < 0) return { arrow: '↓', color: 'var(--orange)', text: `${typeof curr === 'number' && Math.abs(curr) > 100 ? fmt(diff) : diff}` };
    return { arrow: '→', color: 'var(--text-muted)', text: 'ổn định' };
  };

  const metrics = [
    { icon: '🔥', label: 'Habits', value: `${review.thisHabits}/${review.daysInWeek} ngày`, trend: trend(review.thisHabits, review.lastHabits) },
    { icon: '⭐', label: 'XP', value: `+${review.thisXp}`, trend: trend(review.thisXp, review.lastXp) },
    { icon: '💰', label: 'Chi tiêu', value: `${fmt(review.thisExp)}₫`, trend: trend(review.thisExp, review.lastExp) },
    { icon: '😊', label: 'Mood TB', value: review.thisMood ? `${review.thisMood.toFixed(1)}/5` : '—', trend: review.thisMood && review.lastMood ? trend(review.thisMood, review.lastMood) : { arrow: '—', color: 'var(--text-muted)', text: '' } },
  ];

  return (
    <div className="weekly-review card">
      <div className="weekly-review__header" onClick={() => setExpanded(e => !e)} style={{ cursor: 'pointer' }}>
        <span className="dash-card-title">📊 Tuần Này</span>
        <span className="weekly-review__toggle">{expanded ? '▾' : '▸'}</span>
      </div>
      {expanded && (
        <div className="weekly-review__body">
          {metrics.map(m => (
            <div key={m.label} className="weekly-review__row">
              <span className="weekly-review__icon">{m.icon}</span>
              <span className="weekly-review__label">{m.label}</span>
              <span className="weekly-review__value">{m.value}</span>
              <span className="weekly-review__trend" style={{ color: m.trend.color }}>
                {m.trend.arrow} {m.trend.text}
              </span>
            </div>
          ))}
          <div className="weekly-review__note">
            So sánh với tuần trước (T2–CN)
          </div>
        </div>
      )}
    </div>
  );
});


function flowerForDay(streak) {
  if (streak===0) return '⬜';
  return FLOWERS[Math.min(Math.floor(streak/4), FLOWERS.length-1)];
}

/* ── Flower Journey ── */
function FlowerJourney({ data, startDate }) {
  const days = useMemo(() => {
    const res=[]; let streak=0;
    for (let i=0;i<21;i++) {
      const d=new Date(startDate); d.setDate(startDate.getDate()+i);
      const key=d.toISOString().split('T')[0];
      const done=!!data[key];
      if (done) streak++; else if (key<new Date().toISOString().split('T')[0]) streak=0;
      res.push({key,done,dayNum:i+1,streak});
    }
    return res;
  },[data,startDate]);
  const todayStr=new Date().toISOString().split('T')[0];
  return (
    <div className="flower-journey">
      {days.map((day,i)=>{
        const today=day.key===todayStr, future=day.key>todayStr;
        return (
          <div key={i} className={`flower-slot${today?' flower-slot--today':''}${future?' flower-slot--future':''}`} title={`Ngày ${day.dayNum}`}>
            <span className="flower-emoji">{future?'⬜':day.done?flowerForDay(day.streak):'🩶'}</span>
            <span className="flower-day">{day.dayNum}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Monthly Donut ── */
function MonthDonut({ data }) {
  const now=new Date(), y=now.getFullYear(), m=now.getMonth();
  const total=new Date(y,m+1,0).getDate();
  const done=Array.from({length:now.getDate()},(_,i)=>!!data[new Date(y,m,i+1).toISOString().split('T')[0]]).filter(Boolean).length;
  const pct=Math.round((done/Math.min(now.getDate(),total))*100);
  const r=44, circ=2*Math.PI*r, off=circ-(pct/100)*circ;
  const color=pct>=80?'var(--green)':pct>=50?'var(--purple)':'var(--orange)';
  return (
    <div className="month-donut">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14"/>
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={off} transform="rotate(-90 60 60)"
          style={{transition:'stroke-dashoffset 1s ease'}}/>
      </svg>
      <div className="month-donut__center">
        <span className="month-donut__pct" style={{color}}>{pct}%</span>
        <span className="month-donut__label">{now.toLocaleDateString('vi-VN',{month:'long'})}</span>
      </div>
      <div className="month-donut__detail">
        {[['✅',done,'var(--green)'],['❌',now.getDate()-done,'var(--red)'],['📅',total-now.getDate(),'var(--text-muted)']].map(([e,v,c])=>(
          <div key={e} className="month-donut__stat"><span style={{color:c,fontWeight:700}}>{v}</span><span>{e}</span></div>
        ))}
      </div>
    </div>
  );
}

/* ── Weekly Table ── */
function WeeklyTable({ data }) {
  const weeks=useMemo(()=>{
    const now=new Date();
    return Array.from({length:4},(_,wi)=>{
      const s=new Date(now);
      const dow=s.getDay()===0?6:s.getDay()-1;
      s.setDate(s.getDate()-dow-wi*7);
      return Array.from({length:7},(_,di)=>{
        const d=new Date(s); d.setDate(s.getDate()+di);
        const key=d.toISOString().split('T')[0];
        return {key,done:!!data[key],future:key>now.toISOString().split('T')[0],date:d.getDate()};
      });
    }).reverse();
  },[data]);
  return (
    <div className="weekly-table">
      <div className="weekly-table__head">
        {DAY_LABELS.map(l=><div key={l} className="weekly-table__th">{l}</div>)}
        <div className="weekly-table__th" style={{color:'var(--green)'}}>✓</div>
        <div className="weekly-table__th" style={{color:'var(--red)'}}>✗</div>
        <div className="weekly-table__th">%</div>
      </div>
      {weeks.map((week,wi)=>{
        const done=week.filter(d=>!d.future&&d.done).length;
        const missed=week.filter(d=>!d.future&&!d.done).length;
        const pct=done+missed>0?Math.round((done/(done+missed))*100):null;
        return (
          <div key={wi} className="weekly-table__row">
            {week.map((day,di)=>(
              <div key={di} className={`weekly-table__cell weekly-table__cell--${day.future?'future':day.done?'done':'miss'}`} title={day.key}>
                {day.future?<span style={{opacity:.3}}>{day.date}</span>:day.done?'✓':<span style={{opacity:.4}}>{day.date}</span>}
              </div>
            ))}
            <div className="weekly-table__stat" style={{color:'var(--green)'}}>{done}</div>
            <div className="weekly-table__stat" style={{color:'var(--red)'}}>{missed}</div>
            <div className="weekly-table__stat" style={{color:pct>=80?'var(--green)':pct>=50?'var(--orange)':'var(--red)'}}>
              {pct!==null?pct+'%':'—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Finance Pie Donut ── */
function FinancePie({ byCategory, total }) {
  if (!byCategory.length) return <div style={{color:'var(--text-muted)',fontSize:'.85rem',textAlign:'center',padding:'1rem'}}>Chưa có dữ liệu tháng này</div>;
  const r=52, circ=2*Math.PI*r;
  let offset=0;
  const slices=byCategory.slice(0,6).map(({category,total:amt})=>{
    const pct=amt/total;
    const slice={category,amt,pct,offset,color:CAT_COLORS[category]||'#64748b'};
    offset+=pct;
    return slice;
  });
  return (
    <div className="db-fin-pie">
      <svg width="130" height="130" viewBox="0 0 130 130">
        {slices.map((s,i)=>(
          <circle key={i} cx="65" cy="65" r={r} fill="none"
            stroke={s.color} strokeWidth="20" strokeLinecap="butt"
            strokeDasharray={`${s.pct*circ} ${circ}`}
            strokeDashoffset={-s.offset*circ}
            transform="rotate(-90 65 65)"
            style={{transition:'stroke-dasharray .8s ease'}}
          />
        ))}
        <circle cx="65" cy="65" r="42" fill="var(--bg-card)"/>
        <text x="65" y="61" textAnchor="middle" fill="var(--text-primary)" fontSize="11" fontWeight="700">
          {fmt(total)}₫
        </text>
        <text x="65" y="75" textAnchor="middle" fill="var(--text-muted)" fontSize="9">tháng này</text>
      </svg>
      <div className="db-fin-legend">
        {slices.map(s=>(
          <div key={s.category} className="db-fin-legend-item">
            <span className="db-fin-legend-dot" style={{background:s.color}}/>
            <span className="db-fin-legend-name">{s.category}</span>
            <span className="db-fin-legend-val">{fmt(s.amt)}₫</span>
            <span className="db-fin-legend-pct">{Math.round(s.pct*100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Skip Insight ── */
function SkipInsight() {
  const { getAllSkips }=useSkipReasons();
  const insight=useMemo(()=>{
    const skips=getAllSkips(); if(!skips?.length) return null;
    const cutoff=new Date(); cutoff.setDate(cutoff.getDate()-14);
    const recent=skips.filter(s=>s.date>=cutoff.toISOString().split('T')[0]);
    if(!recent.length) return null;
    const counts={};
    recent.forEach(s=>{ const r=s.reason||'Lý do khác'; counts[r]=(counts[r]||0)+1; });
    return {total:recent.length,top:Object.entries(counts).sort((a,b)=>b[1]-a[1])};
  },[getAllSkips]);
  if(!insight) return null;
  const [topReason,topCount]=insight.top[0];
  const tips={'Thiếu động lực':'💡 Giảm durationMin xuống 5 phút — bắt đầu nhỏ hơn.','Bận công việc':'💡 Dời habit sang buổi sáng trước khi ngày bắt đầu.','Quên mất':'💡 Bật nhắc nhở trong Tracker.'};
  return (
    <div className="card db-section" style={{borderColor:'rgba(249,115,22,.2)'}}>
      <div className="dash-card-title">🔍 Phân Tích Bỏ Qua — 14 Ngày</div>
      <div style={{marginTop:'.75rem',display:'flex',flexDirection:'column',gap:'.5rem'}}>
        <div className="dash-insight" style={{borderColor:'var(--orange)',marginTop:0}}>
          Bỏ qua <strong>{insight.total} lần</strong> · Lý do chủ yếu:{' '}
          <strong style={{color:'var(--orange)'}}>"{topReason}"</strong> ({topCount}x)
        </div>
        {insight.top.slice(0,3).map(([reason,count])=>{
          const pct=Math.round((count/insight.total)*100);
          return (
            <div key={reason} style={{display:'flex',alignItems:'center',gap:'.75rem'}}>
              <span style={{fontSize:'.82rem',color:'var(--text-secondary)',flex:1}}>{reason}</span>
              <div style={{width:100,height:6,background:'rgba(255,255,255,.06)',borderRadius:3,overflow:'hidden'}}>
                <div style={{width:`${pct}%`,height:'100%',background:'var(--orange)',borderRadius:3}}/>
              </div>
              <span style={{fontSize:'.75rem',color:'var(--text-muted)',width:28,textAlign:'right'}}>{count}x</span>
            </div>
          );
        })}
        {tips[topReason]&&<div style={{fontSize:'.82rem',color:'var(--purple-light)',marginTop:'.25rem'}}>{tips[topReason]}</div>}
      </div>
    </div>
  );
}

/* ── TODAY KPI Card ── */
function TodayKpi({ icon, label, value, unit, color, sub }) {
  return (
    <div className="db-today-kpi card">
      <div className="db-today-kpi__icon" style={{color}}>{icon}</div>
      <div className="db-today-kpi__val" style={{color}}>{value}<span className="db-today-kpi__unit">{unit}</span></div>
      <div className="db-today-kpi__label">{label}</div>
      {sub&&<div className="db-today-kpi__sub">{sub}</div>}
    </div>
  );
}

/* ── Section Divider ── */
function SectionTitle({ icon, title, action }) {
  return (
    <div className="db-section-title">
      <div className="db-section-title__left">
        <span className="db-section-title__icon">{icon}</span>
        <span className="db-section-title__text">{title}</span>
      </div>
      {action&&<div className="db-section-title__action">{action}</div>}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════ */
export default function DashboardPage() {
  const { data, streak, longestStreak, totalDone } = useHabitStore();
  const { totalXp, levelInfo } = useXpStore();
  const { getAllSkips } = useSkipReasons();
  const { moodLog } = useMoodLog();
  const { todayMinutes, todaySessions } = useFocusTimer();

  /* ── Stable date refs (avoid recreation every render) ── */
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const monthStart = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
  }, []);

  /* ── Expenses ── */
  const { expenses, fetchExpenses, getTotal, getByCategory, enabled: expEnabled } = useExpenses();
  const today = new Date();
  useEffect(() => { if (expEnabled) fetchExpenses(monthStart, todayStr); }, [expEnabled]); // eslint-disable-line


  const todayExpenses = useMemo(() => expenses.filter(e => e.date === todayStr), [expenses, todayStr]);
  const monthTotal = useMemo(() => getTotal(), [expenses]);
  const byCategory = useMemo(() => getByCategory(), [expenses]);
  const todaySpend = useMemo(() => getTotal(todayExpenses), [todayExpenses]);

  /* ── Subscriptions ── */
  const { subs, fetchSubs, getMonthlyCost, getUpcoming, enabled: subEnabled } = useSubscriptions();
  useEffect(() => { if (subEnabled) fetchSubs(); }, [subEnabled]);
  const monthlySub = getMonthlyCost();
  const upcomingSubs = getUpcoming(7);

  /* ── Activity today ── */
  const { getTodayCount, enabled: actEnabled } = useActivityLog();
  const [todayActivity, setTodayActivity] = useState(0);
  useEffect(() => { if (actEnabled) getTodayCount().then(setTodayActivity); }, [actEnabled]);

  /* ── XP today ── */
  const { log: xpLog } = useXpStore();
  const todayXp = useMemo(() => {
    return xpLog.filter(e => new Date(e.ts).toDateString() === today.toDateString()).reduce((s,e) => s+e.amount, 0);
  }, [xpLog]);

  /* ── Habit start ── */
  const checkedDates = Object.keys(data).filter(k=>data[k]).sort();
  const startDate = checkedDates[0] ? new Date(checkedDates[0]) : new Date();
  const insight = insightFromStreak(streak);

  return (
    <div className="dashboard-page">
      <div className="container">

        {/* ── Header ── */}
        <div className="db-header">
          <div>
            <div className="section-label">📈 Life Hub</div>
            <h1 className="display-2">Dashboard <span className="gradient-text">Của Bạn</span></h1>
          </div>
          <Link to="/tracker" className="btn btn-ghost" style={{fontSize:'.85rem'}}>🗓 Tracker →</Link>
        </div>

        {/* ── TODAY OVERVIEW ── */}
        <SectionTitle icon="⚡" title="Hôm Nay" />
        <div className="db-today-row">
          <TodayKpi icon="🔥" label="Hoạt động" value={todayActivity} unit=" actions" color="var(--orange)" sub={`Streak ${streak} ngày`}/>
          <TodayKpi icon="⏱" label="Focus" value={todayMinutes} unit=" phút" color="var(--cyan)" sub={`${todaySessions.length} sessions`}/>
          <TodayKpi icon="💰" label="Chi tiêu" value={fmt(todaySpend)} unit="₫" color="var(--purple-light)" sub={expEnabled?'Hôm nay':'Cần đăng nhập'}/>
          <TodayKpi icon="⭐" label="XP kiếm được" value={`+${todayXp}`} unit=" XP" color="var(--gold)" sub={`${levelInfo.emoji} ${levelInfo.name}`}/>
        </div>

        {/* ── HABITS ── */}
        <SectionTitle icon="🌸" title="Thói Quen" action={
          <div className="db-kpi-row-mini">
            {[['🔥',streak,'Streak'],['🏅',longestStreak,'Best'],['✅',totalDone,'Tổng'],['⭐',totalXp,'XP']].map(([ic,v,lb])=>(
              <div key={lb} className="db-kpi-mini card">
                <span className="db-kpi-mini__icon">{ic}</span>
                <span className="db-kpi-mini__val gradient-text">{v}</span>
                <span className="db-kpi-mini__label">{lb}</span>
              </div>
            ))}
          </div>
        }/>

        <div className="card db-section">
          <div className="dash-card-title">🌸 Hành Trình 21 Ngày</div>
          <p style={{fontSize:'.8rem',color:'var(--text-muted)',marginTop:'.25rem',marginBottom:'.75rem'}}>Hoa nở theo streak liên tiếp</p>
          <FlowerJourney data={data} startDate={startDate}/>
          <div className="flower-legend">
            {'🌰 → 🌱 → 🌿 → 🌸 → 🌺 → 🌻'.split(' → ').map((f,i)=>(
              <span key={i} style={{fontSize:'.82rem',color:'var(--text-muted)'}}>{f}</span>
            ))}
          </div>
        </div>

        <div className="db-two-col">
          <div className="card db-section">
            <div className="dash-card-title">🎯 Tháng Này</div>
            <MonthDonut data={data}/>
          </div>
          <div className="card db-section">
            <div className="dash-card-title">📋 4 Tuần Gần Đây</div>
            <p style={{fontSize:'.78rem',color:'var(--text-muted)',margin:'.25rem 0 .75rem'}}>Hoàn thành / Bỏ / Tỷ lệ</p>
            <WeeklyTable data={data}/>
          </div>
        </div>

        {/* ── FINANCE ── */}
        <SectionTitle icon="💰" title="Tài Chính" action={<Link to="/finance" className="btn btn-ghost" style={{fontSize:'.8rem'}}>Chi tiết →</Link>}/>

        <div className="db-finance-kpi-row">
          {[
            {icon:'🛒',label:'Chi tháng',val:fmt(monthTotal)+'₫',color:'var(--orange)',sub:`Hôm nay: ${fmt(todaySpend)}₫`},
            {icon:'🔄',label:'Đăng ký/tháng',val:fmt(monthlySub)+'₫',color:'var(--purple)',sub:`${subs.filter(s=>s.active).length} dịch vụ`},
            {icon:'⚠️',label:'Sắp hết hạn',val:upcomingSubs.length,color:upcomingSubs.length>0?'var(--orange)':'var(--green)',sub:upcomingSubs.length?upcomingSubs[0].name:'Không có trong 7 ngày'},
          ].map(({icon,label,val,color,sub})=>(
            <div key={label} className="db-fin-kpi card">
              <div className="db-fin-kpi__icon">{icon}</div>
              <div className="db-fin-kpi__val" style={{color}}>{val}</div>
              <div className="db-fin-kpi__label">{label}</div>
              <div className="db-fin-kpi__sub">{sub}</div>
            </div>
          ))}
        </div>

        {expEnabled && byCategory.length > 0 && (
          <div className="card db-section">
            <div className="dash-card-title">🥧 Phân Bổ Chi Tiêu Tháng</div>
            <FinancePie byCategory={byCategory} total={monthTotal}/>
          </div>
        )}


        {/* ── ACTIVITY HEATMAP ── */}
        <SectionTitle icon="📅" title="Hoạt Động" action={<Link to="/life-log" className="btn btn-ghost" style={{fontSize:'.8rem'}}>Life Log →</Link>}/>
        <div className="card db-section">
          <div className="dash-card-title">🗓 Lịch Sử Hoạt Động</div>
          <ActivityHeatmap/>
        </div>

        {/* ── MOOD TREND ── */}
        <SectionTitle icon="😊" title="Tâm Trạng" />
        <div className="card db-section">
          <div className="dash-card-title">😊 Xu Hướng Tâm Trạng</div>
          <MoodTrendChart moodLog={moodLog}/>
        </div>

        {/* ── FOCUS BREAKDOWN ── */}
        <SectionTitle icon="⏱" title="Focus" action={<Link to="/focus" className="btn btn-ghost" style={{fontSize:'.8rem'}}>Timer →</Link>}/>
        <div className="card db-section">
          <div className="dash-card-title">⏱ Focus 7 Ngày — Per Habit</div>
          <FocusBreakdown/>
        </div>

        {/* ── WEEKLY REVIEW ── */}
        <SectionTitle icon="📊" title="Tổng Kết" />
        <WeeklyReview data={data} streak={streak} xpLog={xpLog ?? []} todayMinutes={todayMinutes} expenses={expenses} moodLog={moodLog}/>

        {/* ── INSIGHTS ── */}
        <SectionTitle icon="💡" title="Phân Tích"/>
        <SkipInsight/>
        <div className="card db-section">
          <div className="dash-card-title">💡 Nhận Xét</div>
          <div className="dash-insight" style={{borderColor:insight.color,marginTop:'.75rem'}}>{insight.text}</div>
          {totalDone>=7&&(
            <div className="dash-insight" style={{borderColor:'var(--green)',marginTop:'.5rem'}}>
              ⚡ Bạn đã hoàn thành <strong>{totalDone} ngày</strong>. Tiếp tục đến <strong>{Math.ceil(totalDone/7)*7+7} ngày</strong>!
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
