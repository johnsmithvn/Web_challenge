import { useState, useMemo, useLayoutEffect } from 'react';
import AppIcon from '../AppIcon';
import BASE_EXERCISES from '../../data/body-exercises.json';
import {
  DAY_TYPE_COLORS,
  buildExerciseHistory,
  summarizeTrainedExercises,
  niceAxis,
  nextTargetFor,
  dayColorOf,
  splitDayName,
  splitExerciseName,
  formatValWithUnit
} from '../../utils/workoutLogic';
import { toDateStr } from '../../utils/dateUtils';
import { useElementWidth } from '../../hooks/useElementWidth';

const WD_LONG = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const WD_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WEEK_HEAD = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const ROWS_PREVIEW = 4;

const pad2 = n => String(n).padStart(2, '0');
const dateOf = str => {
  const [y, m, d] = String(str).split('-').map(Number);
  return new Date(y, m - 1, d);
};
const dmOf = d => `${d.getDate()}/${d.getMonth() + 1}`;
const unitText = unit => (unit === 's' ? 'giây' : unit || 'rep');
const valText = (v, unit) => (v == null ? 'bỏ' : unit === 's' ? `${v}s` : String(v));

// Nhãn + màu loại buổi: "Ngày A - …" theo chữ cái, còn lại theo Chân/Đẩy/Kéo/Toàn thân có trong tên; tập tự do màu amber
function dayTypeOf(session) {
  const raw = session?.day_type || String(session?.title || '').replace(/^Buổi\s+/, '');
  const { tag, title } = splitDayName(raw);
  if (!session?.routine_id && !session?.planned_weekday) return { label: 'Tự do', color: 'var(--body-amber)', title: splitExerciseName(title).vn || 'Buổi tự do', off: true };
  const typeKey = Object.keys(DAY_TYPE_COLORS).find(k => raw.includes(k));
  return { label: tag || typeKey || 'Buổi tập', color: dayColorOf(raw), title: title || 'Buổi tập' };
}

// Đường cột bo 2 góc trên
const barPath = (x, yTop, w, base, r) => {
  const rr = Math.max(0, Math.min(r, (base - yTop) / 1.2, w / 2));
  const f = v => Math.round(v * 10) / 10;
  return `M${f(x)} ${f(base)}V${f(yTop + rr)}Q${f(x)} ${f(yTop)} ${f(x + rr)} ${f(yTop)}H${f(x + w - rr)}Q${f(x + w)} ${f(yTop)} ${f(x + w)} ${f(yTop + rr)}V${f(base)}Z`;
};

/**
 * Biểu đồ cột theo từng set: mỗi buổi một cụm cột 13px (set chưa đạt mờ đi, cụm kỷ lục màu amber), số tốt nhất
 * trên cụm, đường mục tiêu nét đứt kèm nhãn số ở mép trái, cụm "Buổi tới" nét đứt.
 * Khung hẹp (< 520px) thì thấp hơn, hiện nhiều buổi hơn; thiếu chỗ thì cuộn ngang, mở sẵn ở buổi mới nhất.
 */
function SetChart({ history, unit, target, next }) {
  const [ref, W] = useElementWidth();
  const compact = W > 0 && W < 520;
  const H = compact ? 200 : 280;
  const shown = useMemo(() => history.slice(compact ? -12 : -8), [history, compact]);

  const chart = useMemo(() => {
    if (W < 120) return null;
    const padL = 42;
    const padR = 8;
    const padT = 26;
    const padB = 36;
    const bw = 13;
    const gap = 4;
    const ph = H - padT - padB;
    const base = padT + ph;
    const allVals = shown.flatMap(g => g.vals.filter(v => v != null));
    const axis = niceAxis(Math.max(...allVals, next?.val || 0, target || 0, 1) * 1.15, 4);
    const y = v => base - (v / axis.max) * ph;
    const groupW = sets => sets * bw + (sets - 1) * gap;
    const n = shown.length + (next ? 1 : 0);
    const maxSets = Math.max(...shown.map(g => g.vals.length), next?.sets || 0, 1);
    const fit = W - padL - padR;
    const slot = Math.max(groupW(maxSets) + 16, fit / Math.max(n, 4));
    const pw = Math.max(fit, slot * n);
    const off = padL + (pw - slot * n) / 2;
    // Trục y 3 vạch: 0 · giữa (làm tròn theo bước) · đỉnh
    const mid = axis.step * Math.round(axis.max / 2 / axis.step);
    const ticks = [...new Set([0, mid, axis.max])].map(v => ({ v, y: y(v) }));

    const groups = shown.map((g, i) => {
      const cx = off + slot * (i + 0.5);
      const x0 = cx - groupW(g.vals.length) / 2;
      const d = dateOf(g.date);
      return {
        key: g.sessionId,
        cx,
        pr: g.pr,
        best: g.best,
        bestY: g.best != null ? y(g.best) : null,
        bars: g.vals.map((v, j) => {
          const x = x0 + j * (bw + gap);
          return v == null ? { x, v } : { x, v, met: v >= g.target, d: barPath(x, y(Math.max(v, axis.max * 0.015)), bw, base, 6) };
        }),
        t1: dmOf(d),
        t2: WD_SHORT[d.getDay()]
      };
    });

    let ghost = null;
    if (next) {
      const cx = off + slot * (n - 0.5);
      ghost = {
        cx,
        yTop: y(next.val),
        xs: Array.from({ length: next.sets }, (_, j) => cx - groupW(next.sets) / 2 + j * (bw + gap))
      };
    }
    return { padL, sw: padL + pw + padR, pw, base, bw, ticks, groups, ghost, targetY: target ? y(target) : null };
  }, [W, H, shown, next, target]);

  const sw = chart?.sw;
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [ref, sw]);

  return (
    <div ref={ref} className={`body-pg-chart${compact ? ' is-compact' : ''}`} style={{ minHeight: H }}>
      {chart && (
        <svg width={chart.sw} height={H} viewBox={`0 0 ${chart.sw} ${H}`} role="img" aria-label="Biểu đồ từng set qua các buổi">
          <defs>
            <linearGradient id="pgBarFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className="pg-stop" />
              <stop offset="1" className="pg-stop is-end" />
            </linearGradient>
            <linearGradient id="pgPrFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className="pg-stop is-pr" />
              <stop offset="1" className="pg-stop is-pr is-end" />
            </linearGradient>
          </defs>

          {chart.ticks.map(t => (
            <line key={t.v} x1={chart.padL} x2={chart.padL + chart.pw} y1={t.y} y2={t.y} className={t.v === 0 ? 'pg-axis' : 'pg-grid'} />
          ))}
          {chart.targetY != null && (
            <line x1={chart.padL} x2={chart.padL + chart.pw} y1={chart.targetY} y2={chart.targetY} className="pg-target" />
          )}

          {chart.groups.map(g => (
            <g key={g.key}>
              {g.bars.map((b, j) => (b.v == null ? (
                <rect key={j} x={b.x} y={chart.base - 3} width={chart.bw} height={3} rx={1.5} className="pg-skip">
                  <title>{`Set ${j + 1}: bỏ`}</title>
                </rect>
              ) : (
                <path key={j} d={b.d} fill={`url(#${g.pr ? 'pgPrFill' : 'pgBarFill'})`} className={`pg-bar${b.met ? '' : ' is-low'}`}>
                  <title>{`Set ${j + 1}: ${b.v} ${unitText(unit)}`}</title>
                </path>
              )))}
              {g.bestY != null && (
                <text x={g.cx} y={g.bestY - 8} textAnchor="middle" className="pg-best">{g.best}</text>
              )}
              {g.pr && g.bestY != null && (
                <AppIcon name="starFour" size={14} weight="fill" x={g.cx - 7} y={g.bestY - 34} className="pg-star" />
              )}
              <text x={g.cx} y={chart.base + 16} textAnchor="middle" className="pg-x1">{g.t1}</text>
              <text x={g.cx} y={chart.base + 29} textAnchor="middle" className="pg-x2">{g.t2}</text>
            </g>
          ))}

          {chart.ghost && (
            <g>
              {chart.ghost.xs.map((x, j) => (
                <rect key={j} x={x} y={chart.ghost.yTop} width={chart.bw} height={Math.max(2, chart.base - chart.ghost.yTop)} rx={6} className="pg-ghost" />
              ))}
              <text x={chart.ghost.cx} y={chart.ghost.yTop - 8} textAnchor="middle" className="pg-best is-next">{next.val}</text>
              <text x={chart.ghost.cx} y={chart.base + 16} textAnchor="middle" className="pg-x1 is-next">Buổi tới</text>
              <text x={chart.ghost.cx} y={chart.base + 29} textAnchor="middle" className="pg-x2">dự kiến</text>
            </g>
          )}

          {chart.ticks.map(t => (
            <text key={t.v} x={chart.padL - 10} y={t.y + 3.5} textAnchor="end" className="pg-tick">{t.v}</text>
          ))}
          {chart.targetY != null && (
            <g>
              <rect x={chart.padL - 40} y={chart.targetY - 9} width={36} height={18} rx={6} className="pg-target-box" />
              <text x={chart.padL - 22} y={chart.targetY + 3.5} textAnchor="middle" className="pg-target-val">{target}</text>
            </g>
          )}
        </svg>
      )}
    </div>
  );
}

export default function WorkoutHistoryScreen({
  sessions = [],
  recentSets = [],
  routineItems = [],
  exerciseMap,
  onNavigate
}) {
  const [today] = useState(() => new Date());
  const todayKey = toDateStr(today);
  const [view, setView] = useState(() => ({ y: today.getFullYear(), m: today.getMonth() + 1 }));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [selectedKey, setSelectedKey] = useState(null);
  const [showAllRows, setShowAllRows] = useState(false);

  const exDef = key => exerciseMap?.get?.(key) || BASE_EXERCISES.find(e => e.key === key) || null;
  const namesOf = (key, fallback) => splitExerciseName(exDef(key)?.name || fallback || key);

  const completed = useMemo(() => sessions.filter(s => s.status === 'completed'), [sessions]);

  // ── TIẾN BỘ TỪNG BÀI ─────────────────────────────────────────
  const trained = useMemo(() => summarizeTrainedExercises(recentSets, sessions), [recentSets, sessions]);
  const active = trained.find(e => e.key === selectedKey) || trained[0] || null;
  const activeNm = active ? namesOf(active.key, active.name) : null;
  const history = useMemo(
    () => (active ? buildExerciseHistory(recentSets, sessions, active.key) : []),
    [recentSets, sessions, active]
  );
  const unit = active?.unit || 'rep';
  // Bài có thể nằm ở nhiều thứ: lấy mục của ngày gần nhất sắp tới (sau hôm nay) — đó là "buổi tới"
  const todayIso = today.getDay() || 7;
  const routineItem = active
    ? routineItems
      .filter(it => it.exercise_key === active.key)
      .sort((a, b) => ((a.weekday - todayIso + 6) % 7) - ((b.weekday - todayIso + 6) % 7))[0] || null
    : null;
  const next = nextTargetFor(history, routineItem);
  const lastTarget = history.length ? history[history.length - 1].target : routineItem ? Number(routineItem.target_val) : null;
  const allVals = history.flatMap(g => g.vals.filter(v => v != null));
  const bestVal = allVals.length ? Math.max(...allVals) : null;
  const gain = history.length > 1 && history[0].best != null && history[history.length - 1].best != null
    ? history[history.length - 1].best - history[0].best
    : null;

  const kpis = [
    { key: 'best', label: 'Cao nhất', hint: 'Cao nhất đạt được', value: bestVal ?? '—', unit: bestVal != null ? unitText(unit) : '', tone: 'amber' },
    { key: 'next', label: 'Mục tiêu', hint: 'Mục tiêu buổi tới', value: next?.val ?? '—', unit: next ? `${unitText(unit)} × ${next.sets}` : '', tone: 'blue' },
    { key: 'count', label: 'Số buổi', hint: 'Số buổi đã tập', value: history.length, unit: '' },
    {
      key: 'gain',
      label: 'So với buổi đầu',
      hint: 'Set tốt nhất buổi mới nhất so với buổi đầu',
      value: gain == null ? '—' : gain > 0 ? `+${gain}` : gain < 0 ? `−${Math.abs(gain)}` : '±0',
      unit: gain == null ? '' : unitText(unit),
      tone: gain == null ? null : gain >= 0 ? 'up' : 'down'
    }
  ];

  // Kỷ lục cá nhân: buổi đầu tiên đạt số cao nhất, so với mục tiêu hiện tại
  const bestGroup = bestVal != null ? history.find(g => g.best === bestVal) : null;
  const goal = next
    ? { val: next.val, text: `${next.val} ${unitText(unit)} × ${next.sets}` }
    : lastTarget ? { val: lastTarget, text: `${lastTarget} ${unitText(unit)}` } : null;
  const bestPct = bestVal != null && goal?.val ? Math.round((bestVal / goal.val) * 100) : null;

  const rows = history.map((g, i) => {
    const prev = history[i - 1];
    const delta = prev && prev.best != null && g.best != null ? g.best - prev.best : null;
    const d = dateOf(g.date);
    const badge = g.pr
      ? { text: 'Kỷ lục mới', tone: 'pr', icon: 'trophy' }
      : i === 0
        ? { text: 'Buổi đầu', tone: 'muted', icon: 'flag' }
        : g.met
          ? { text: 'Đạt mục tiêu', tone: 'ok', icon: 'checkCircle' }
          : { text: 'Chưa đạt', tone: 'muted', icon: 'circle' };
    return {
      key: g.sessionId,
      date: dmOf(d),
      wd: WD_SHORT[d.getDay()],
      vals: g.vals,
      target: g.target,
      best: g.best,
      delta,
      badge
    };
  }).reverse();
  const visibleRows = showAllRows ? rows : rows.slice(0, ROWS_PREVIEW);

  // ── LỊCH THÁNG ───────────────────────────────────────────────
  const plannedWeekdays = useMemo(() => {
    const map = new Map();
    routineItems.forEach(it => {
      if (!map.has(it.weekday)) map.set(it.weekday, it.day_name || '');
    });
    return map;
  }, [routineItems]);

  const sessionsByDate = useMemo(() => {
    const map = new Map();
    completed.forEach(s => {
      if (!s.local_date) return;
      if (!map.has(s.local_date)) map.set(s.local_date, []);
      map.get(s.local_date).push(s);
    });
    return map;
  }, [completed]);

  const calendar = useMemo(() => {
    const { y, m } = view;
    const dim = new Date(y, m, 0).getDate();
    const first = new Date(y, m - 1, 1).getDay();
    const offset = first === 0 ? 6 : first - 1;
    const prefix = `${y}-${pad2(m)}`;
    let count = 0;
    const cells = [];
    for (let d = 1; d <= dim; d++) {
      const key = `${prefix}-${pad2(d)}`;
      const list = sessionsByDate.get(key) || [];
      const jsDay = new Date(y, m - 1, d).getDay();
      const iso = jsDay || 7;
      const planName = plannedWeekdays.get(iso);
      count += list.length;
      // Mỗi loại buổi trong ngày một chấm màu (vd sáng theo lộ trình + chiều tập lẻ)
      const colors = [...new Set(list.map(s => dayTypeOf(s).color))].slice(0, 3);
      const plan = !list.length && planName != null && key > todayKey ? dayColorOf(planName) : null;
      cells.push({ d, key, done: list.length > 0, colors, plan, future: key > todayKey, isToday: key === todayKey });
    }
    const monthSessionIds = new Set(completed.filter(s => String(s.local_date).startsWith(prefix)).map(s => s.id));
    const prs = new Set(recentSets.filter(s => s.is_pr && monthSessionIds.has(s.session_id)).map(s => `${s.session_id}:${s.exercise_key}`)).size;
    const legend = [];
    completed.filter(s => String(s.local_date).startsWith(prefix)).forEach(s => {
      const t = dayTypeOf(s);
      if (!legend.some(l => l.label === t.label)) legend.push(t);
    });
    return {
      offset,
      cells,
      title: `Tháng ${m} · ${y}`,
      sum: count ? `${count} buổi đã hoàn thành · ${prs} kỷ lục mới` : 'Chưa có buổi tập nào trong tháng',
      legend
    };
  }, [view, sessionsByDate, plannedWeekdays, todayKey, completed, recentSets]);

  // Đổi tháng: tháng hiện tại thì chọn hôm nay, tháng khác chọn ngày 1
  const shiftMonth = delta => {
    const d = new Date(view.y, view.m - 1 + delta, 1);
    const nextView = { y: d.getFullYear(), m: d.getMonth() + 1 };
    setView(nextView);
    setSelectedDate(nextView.y === today.getFullYear() && nextView.m === today.getMonth() + 1
      ? todayKey
      : `${nextView.y}-${pad2(nextView.m)}-01`);
  };

  // ── CHI TIẾT NGÀY ĐANG CHỌN ─────────────────────────────────
  const day = useMemo(() => {
    const d = dateOf(selectedDate);
    const dateLabel = `${WD_LONG[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    const list = sessionsByDate.get(selectedDate) || [];
    const planName = plannedWeekdays.get(d.getDay() || 7);
    const plannedItems = planName != null ? routineItems.filter(it => it.weekday === (d.getDay() || 7)) : [];

    if (list.length) {
      return {
        dateLabel,
        sessions: list.map(s => {
          const type = dayTypeOf(s);
          const sets = recentSets.filter(x => x.session_id === s.id);
          const byKey = new Map();
          sets
            .slice()
            .sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0) || (a.set_no || 0) - (b.set_no || 0))
            .forEach(x => {
              const it = byKey.get(x.exercise_key) || { key: x.exercise_key, name: x.exercise_name, unit: x.unit || 'rep', target: Number(x.target_val) || 0, vals: [], pr: false };
              it.vals[(Number(x.set_no) || it.vals.length + 1) - 1] = x.actual_val == null ? null : Number(x.actual_val);
              if (x.is_pr) it.pr = true;
              byKey.set(x.exercise_key, it);
            });
          return {
            id: s.id,
            title: type.title,
            type,
            minutes: s.duration_seconds ? Math.max(1, Math.round(s.duration_seconds / 60)) : null,
            inRoutine: Boolean(s.routine_id),
            items: Array.from(byKey.values()).map(it => ({ ...it, vals: Array.from(it.vals, v => (v === undefined ? null : v)) }))
          };
        })
      };
    }

    if (plannedItems.length) {
      const future = selectedDate >= todayKey;
      const { tag, title } = splitDayName(planName || '');
      return {
        dateLabel,
        planned: {
          title: title || 'Buổi theo lộ trình',
          status: future ? 'planned' : 'missed',
          type: { label: tag || 'Theo lộ trình', color: dayColorOf(planName || '') },
          items: plannedItems.map(it => ({
            key: it.id,
            exKey: it.exercise_key,
            target: `${it.target_sets} × ${formatValWithUnit(it.target_val, it.unit)}`
          }))
        }
      };
    }

    return { dateLabel, rest: true };
  }, [selectedDate, sessionsByDate, plannedWeekdays, routineItems, recentSets, todayKey]);

  // ── KHỐI GIAO DIỆN ───────────────────────────────────────────
  const chipsOf = (vals, target, unitKey) => vals.map((v, j) => (
    <span key={j} className={`body-pg-chip${v == null ? ' is-skip' : v >= target ? ' is-ok' : ''}`}>{valText(v, unitKey)}</span>
  ));

  const deltaText = d => (d == null ? '—' : d > 0 ? `+${d} ${unitText(unit)}` : d < 0 ? `−${Math.abs(d)} ${unitText(unit)}` : '±0');
  const deltaTone = d => (d == null || d === 0 ? '' : d > 0 ? ' is-up' : ' is-down');

  const calendarCard = (
    <section className="body-card body-pg-cal">
      <div className="body-pg-cal-head">
        <span className="body-pg-cal-titles">
          <b>{calendar.title}</b>
          <small>{calendar.sum}</small>
        </span>
        <span className="body-pg-cal-nav">
          <button type="button" className="body-icon-btn" onClick={() => shiftMonth(-1)} aria-label="Tháng trước"><AppIcon name="caretLeft" size={14} /></button>
          <button type="button" className="body-icon-btn" onClick={() => shiftMonth(1)} aria-label="Tháng sau"><AppIcon name="caretRight" size={14} /></button>
        </span>
      </div>
      <div className="body-pg-cal-grid">
        {WEEK_HEAD.map(w => <span key={w} className="body-pg-cal-wd">{w}</span>)}
        {Array.from({ length: calendar.offset }, (_, i) => <span key={`e${i}`} />)}
        {calendar.cells.map(c => (
          <button
            key={c.key}
            type="button"
            className={`body-pg-day${c.done ? ' is-done' : ''}${c.plan ? ' is-plan' : ''}${c.future ? ' is-future' : ''}${c.key === selectedDate ? ' is-selected' : ''}${c.isToday ? ' is-today' : ''}`}
            style={{ '--dc': c.colors[0] || c.plan || undefined }}
            onClick={() => setSelectedDate(c.key)}
            aria-pressed={c.key === selectedDate}
            aria-label={`Ngày ${c.d}${c.done ? ', đã tập' : c.plan ? ', có lịch' : ''}`}
          >
            <b>{c.d}</b>
            <span className="body-pg-day-marks">
              {c.done ? c.colors.map(col => <i key={col} style={{ '--dc': col }} />) : c.plan && <i />}
            </span>
          </button>
        ))}
      </div>
      {(calendar.legend.length > 0 || plannedWeekdays.size > 0) && (
        <div className="body-pg-legend">
          {calendar.legend.map(l => (
            <span key={l.label}><i style={{ '--dc': l.color }} />{l.label}</span>
          ))}
          {plannedWeekdays.size > 0 && <span><i className="is-plan" />Dự kiến</span>}
        </div>
      )}
    </section>
  );

  const dayCard = (
    <section className="body-card body-pg-dayc">
      {day.sessions?.map((s, si) => (
        <div key={s.id} className="body-pg-dayc-block">
          <div className="body-pg-dayc-head">
            <span className="body-pg-dayc-titles">
              {si === 0 && <small>{day.dateLabel}</small>}
              <b>{s.title}</b>
            </span>
            <span className="body-pg-status is-ok"><AppIcon name="checkCircle" size={12} weight="fill" />Hoàn thành</span>
          </div>
          <div className="body-pg-meta">
            <span className="is-type"><i style={{ '--dc': s.type.color }} />{s.type.label}</span>
            {s.minutes && <span><AppIcon name="timer" size={12} />{s.minutes} phút</span>}
            {!s.type.off && <span><AppIcon name={s.inRoutine ? 'path' : 'shuffle'} size={12} />{s.inRoutine ? 'Theo lộ trình' : 'Ngoài lộ trình'}</span>}
          </div>
          <div className="body-pg-dayc-list">
            {s.items.map(it => {
              const nm = namesOf(it.key, it.name);
              return (
                <div key={it.key} className="body-pg-dayc-item">
                  <span className="body-pg-dayc-name">
                    <b>{nm.vn}{it.pr && <AppIcon name="trophy" size={13} weight="fill" className="body-pg-trophy" />}</b>
                    <small>{nm.en ? `${nm.en} · ` : ''}mục tiêu {it.vals.length} × {formatValWithUnit(it.target, it.unit)}</small>
                  </span>
                  <span className="body-pg-chips">{chipsOf(it.vals, it.target, it.unit)}</span>
                </div>
              );
            })}
            {s.items.length === 0 && (
              <div className="body-pg-note">
                <AppIcon name="info" size={16} />
                <span>Chi tiết từng set của buổi này đã cũ, không còn trong dữ liệu tải gần đây.</span>
              </div>
            )}
          </div>
        </div>
      ))}

      {day.planned && (
        <div className="body-pg-dayc-block">
          <div className="body-pg-dayc-head">
            <span className="body-pg-dayc-titles">
              <small>{day.dateLabel}</small>
              <b>{day.planned.title}</b>
            </span>
            {day.planned.status === 'planned' ? (
              <span className="body-pg-status is-plan"><AppIcon name="clock" size={12} />Dự kiến</span>
            ) : (
              <span className="body-pg-status is-miss"><AppIcon name="warning" size={12} />Bỏ lỡ</span>
            )}
          </div>
          <div className="body-pg-meta">
            <span className="is-type"><i style={{ '--dc': day.planned.type.color }} />{day.planned.type.label}</span>
            <span><AppIcon name="path" size={12} />Theo lộ trình</span>
          </div>
          <div className="body-pg-dayc-list">
            {day.planned.items.map(it => {
              const nm = namesOf(it.exKey);
              return (
                <div key={it.key} className="body-pg-dayc-item is-plan">
                  <span className="body-pg-dayc-name">
                    <b>{nm.vn}</b>
                    {nm.en && <small>{nm.en}</small>}
                  </span>
                  <span className="body-pg-plan-target">{it.target}</span>
                </div>
              );
            })}
          </div>
          <div className="body-pg-note">
            <AppIcon name={day.planned.status === 'planned' ? 'barbell' : 'info'} size={16} />
            <span>
              {day.planned.status === 'planned'
                ? 'Kết quả từng set sẽ hiện ở đây sau khi bạn hoàn thành buổi tập.'
                : 'Buổi này chưa được tập. Có thể tập bù bất kỳ lúc nào từ Lộ trình.'}
            </span>
            {onNavigate && (
              <button type="button" className="body-pg-link" onClick={() => onNavigate('routine')}>
                Mở Lộ trình<AppIcon name="arrowRight" size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {day.rest && (
        <div className="body-pg-dayc-block">
          <div className="body-pg-dayc-head">
            <span className="body-pg-dayc-titles">
              <small>{day.dateLabel}</small>
              <b>Ngày nghỉ</b>
            </span>
            <span className="body-pg-status is-rest"><AppIcon name="moon" size={12} />Nghỉ</span>
          </div>
          <div className="body-pg-note">
            <AppIcon name="moonStars" size={16} />
            <span>Không có buổi tập nào ngày này. Nghỉ ngơi giúp cơ bắp tái tạo glycogen và phục hồi.</span>
          </div>
        </div>
      )}
    </section>
  );

  const emptyProgress = (
    <div className="body-pg-empty">
      <span className="body-pg-empty-ic"><AppIcon name="chartBar" size={26} /></span>
      <b>Chưa có buổi tập nào hoàn thành</b>
      <p>Hoàn thành và lưu một buổi tập để bắt đầu theo dõi tiến bộ từng set.</p>
      {onNavigate && (
        <button type="button" className="body-btn body-btn-primary" onClick={() => onNavigate('routine')}>
          Mở Lộ trình<AppIcon name="arrowRight" size={14} />
        </button>
      )}
    </div>
  );

  return (
    <div className="body-pg">
      <div className="body-pg-left">
        {active && (
          <div className="body-chip-row body-pg-exchips" role="group" aria-label="Chọn bài tập">
            {trained.map(e => {
              const nm = namesOf(e.key, e.name);
              const on = e.key === active.key;
              return (
                <button
                  key={e.key}
                  type="button"
                  className="body-chip"
                  aria-pressed={on}
                  title={`${nm.vn}${nm.en ? ` (${nm.en})` : ''} · tốt nhất ${e.best ?? '—'}${e.best != null ? ` ${unitText(e.unit)}` : ''} · ${e.sessions} buổi`}
                  onClick={ev => {
                    setSelectedKey(e.key);
                    setShowAllRows(false);
                    ev.currentTarget.scrollIntoView({ inline: 'center', block: 'nearest' });
                  }}
                >
                  {nm.vn}<span className="body-chip-count">{e.sessions}</span>
                </button>
              );
            })}
          </div>
        )}

        <section className="body-card body-pg-main">
          {!active ? emptyProgress : (
            <>
              <div className="body-pg-head">
                <span className="body-pg-titles">
                  <h2>{activeNm.vn}</h2>
                  <small>{activeNm.en ? `${activeNm.en} · ` : ''}set tốt nhất mỗi buổi</small>
                </span>
                <div className="body-pg-kpis">
                  {kpis.map(k => (
                    <div key={k.key} title={k.hint}>
                      <span>{k.label}</span>
                      <b className={k.tone ? `is-${k.tone}` : undefined}>{k.value}{k.unit && <small>{k.unit}</small>}</b>
                    </div>
                  ))}
                </div>
              </div>

              <SetChart key={active.key} history={history} unit={unit} target={lastTarget} next={next} />
              <div className="body-pg-chart-legend">
                <span><i />Đạt mục tiêu</span>
                <span><i className="is-low" />Chưa đạt</span>
                <span><i className="is-pr" />Kỷ lục</span>
                {lastTarget ? <span><i className="is-target" />Mục tiêu</span> : null}
                {next && <span><i className="is-next" />Buổi tới</span>}
              </div>

              <div className="body-pg-table">
                <div className="body-pg-trow is-head">
                  <span>NGÀY</span><span>CÁC SET</span><span>TỐT NHẤT</span><span>SO TRƯỚC</span><span>ĐÁNH GIÁ</span>
                </div>
                {visibleRows.map(r => (
                  <div key={r.key} className="body-pg-trow">
                    <span className="body-pg-tdate"><b>{r.date}</b><small>{r.wd}</small></span>
                    <span className="body-pg-chips body-pg-tsets">{chipsOf(r.vals, r.target, unit)}</span>
                    <span className="body-pg-tbest">{r.best != null ? `${r.best} ${unitText(unit)}` : '—'}</span>
                    <span className={`body-pg-tdelta${deltaTone(r.delta)}`}>{deltaText(r.delta)}</span>
                    <span className={`body-pg-badge is-${r.badge.tone}`}>
                      <AppIcon name={r.badge.icon} size={14} weight={r.badge.tone === 'muted' ? 'regular' : 'fill'} />{r.badge.text}
                    </span>
                  </div>
                ))}
                {rows.length > ROWS_PREVIEW && (
                  <button type="button" className="body-card-link body-pg-more" onClick={() => setShowAllRows(v => !v)} aria-expanded={showAllRows}>
                    {showAllRows ? 'Thu gọn' : `Xem tất cả ${rows.length} buổi`}
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <div className="body-pg-side">
        {calendarCard}
        {dayCard}
        {bestGroup && (
          <section className="body-hero body-pg-pr">
            <span className="body-pg-pr-star body-deco-floaty" aria-hidden="true"><AppIcon name="starFour" size={64} weight="fill" /></span>
            <span className="body-pg-pr-eyebrow">KỶ LỤC CÁ NHÂN</span>
            <span className="body-pg-pr-num">{bestVal}<small>{unitText(unit)}</small></span>
            <span className="body-pg-pr-text">
              {activeNm.vn} · đạt ngày {dmOf(dateOf(bestGroup.date))}.{goal && ` Mục tiêu hiện tại ${goal.text}.`}
            </span>
            {bestPct != null && (
              <div className="body-pg-pr-foot">
                <span>Kỷ lục so với mục tiêu<b>{bestPct}%</b></span>
                <div className="body-bar" style={{ '--bar-c': 'var(--body-amber)' }}><i style={{ width: `${Math.min(100, bestPct)}%` }} /></div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
