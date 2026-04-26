import { useMemo, useState, useEffect, memo } from 'react';
import { Link } from 'react-router-dom';
import { useHabitStore } from '../hooks/useHabitStore';
import { useXpStore, computeLevel } from '../hooks/useXpStore';
import { useSkipReasons } from '../hooks/useMoodSkip';
import { useExpenses } from '../hooks/useExpenses';
import { useSubscriptions } from '../hooks/useSubscriptions';
import { useActivityLog } from '../hooks/useActivityLog';
import { useFocusTimer } from '../hooks/useFocusTimer';
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

/* ── Mood 7-Day Chart ───────────────────────────────────── */
const MoodChart7Day = memo(function MoodChart7Day({ moodLog }) {
  const days = useMemo(() => {
    const res = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const mood = moodLog[key] ?? null;
      const score = mood ? (MOOD_SCORE[mood.label] ?? 3) : null;
      res.push({
        key,
        label: d.toLocaleDateString('vi-VN', { weekday: 'short' }).replace('Th ', 'T'),
        emoji: mood?.emoji ?? null,
        score,
        color: score ? MOOD_COLOR[score] : 'rgba(255,255,255,0.08)',
      });
    }
    return res;
  }, [moodLog]);

  const hasData = days.some(d => d.score !== null);
  const W = 420, H = 90, PAD = 24, BAR_W = 40;
  const slotW = (W - PAD * 2) / 7;

  if (!hasData) {
    return (
      <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '.85rem' }}>
        Chưa có dữ liệu tâm trạng 7 ngày này
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H + 44}`} style={{ minWidth: 280 }}>
        {days.map((d, i) => {
          const x = PAD + i * slotW + slotW / 2;
          const barH = d.score ? ((d.score / 5) * (H - 16)) : 4;
          const y = H - barH + 8;
          return (
            <g key={d.key}>
              {/* bar */}
              <rect
                x={x - BAR_W / 2} y={y}
                width={BAR_W} height={barH}
                rx="6"
                fill={d.score ? d.color : 'rgba(255,255,255,0.05)'}
                opacity={d.score ? 0.85 : 1}
              />
              {/* emoji */}
              {d.emoji && (
                <text x={x} y={y - 4} textAnchor="middle" fontSize="14">{d.emoji}</text>
              )}
              {/* day label */}
              <text
                x={x} y={H + 22}
                textAnchor="middle"
                fill={i === 6 ? 'var(--purple-light)' : 'var(--text-muted)'}
                fontSize="10"
                fontWeight={i === 6 ? '700' : '400'}
              >
                {i === 6 ? 'Hôm nay' : d.label}
              </text>
            </g>
          );
        })}
      </svg>
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
