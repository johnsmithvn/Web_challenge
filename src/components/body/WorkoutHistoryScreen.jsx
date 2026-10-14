import { useState, useMemo } from 'react';
import AppIcon from '../AppIcon';
import BASE_EXERCISES from '../../data/body-exercises.json';
import {
  DAY_TAG_COLORS,
  DAY_TYPE_COLORS,
  buildExerciseHistory,
  summarizeTrainedExercises,
  niceAxis,
  nextTargetFor,
  splitDayName,
  splitExerciseName,
  formatValWithUnit
} from '../../utils/workoutLogic';
import { toDateStr } from '../../utils/dateUtils';
import { useElementWidth } from '../../hooks/useElementWidth';

const WD_LONG = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const WD_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WEEK_HEAD = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const OFF_ROUTINE_COLOR = '#8A8A84';

const pad2 = n => String(n).padStart(2, '0');
const dateOf = str => {
  const [y, m, d] = String(str).split('-').map(Number);
  return new Date(y, m - 1, d);
};
const unitText = unit => (unit === 's' ? 'giây' : unit || 'rep');
const valText = (v, unit) => (v == null ? 'bỏ' : unit === 's' ? `${v}s` : String(v));

// Nhãn + màu loại buổi: "Ngày A - …" theo chữ cái, còn lại theo Chân/Đẩy/Kéo/Toàn thân có trong tên
function dayTypeOf(session) {
  const raw = session?.day_type || String(session?.title || '').replace(/^Buổi\s+/, '');
  const { tag, letter, title } = splitDayName(raw);
  if (!session?.routine_id && !session?.planned_weekday) return { label: 'Ngoài lộ trình', color: OFF_ROUTINE_COLOR, title: splitExerciseName(title).vn || 'Buổi tự do', off: true };
  if (tag) return { label: tag, color: DAY_TAG_COLORS[letter] || 'var(--body-accent)', title };
  const typeKey = Object.keys(DAY_TYPE_COLORS).find(k => raw.includes(k));
  return { label: typeKey || 'Buổi tập', color: typeKey ? DAY_TYPE_COLORS[typeKey] : 'var(--body-accent)', title: title || 'Buổi tập' };
}

// Đường cột bo 2 góc trên
const barPath = (x, yTop, w, base, r) => {
  const rr = Math.max(0, Math.min(r, (base - yTop) / 1.2, w / 2));
  const f = v => Math.round(v * 10) / 10;
  return `M${f(x)} ${f(base)}V${f(yTop + rr)}Q${f(x)} ${f(yTop)} ${f(x + rr)} ${f(yTop)}H${f(x + w - rr)}Q${f(x + w)} ${f(yTop)} ${f(x + w)} ${f(yTop + rr)}V${f(base)}Z`;
};

/**
 * Biểu đồ cột theo từng set: mỗi buổi 1 cụm cột, đường mục tiêu nét đứt, cụm "Buổi tới" nét đứt,
 * nhãn số trên cột, huy hiệu kỷ lục, trục Y "đẹp".
 */
function SetChart({ history, unit, target, next, mobile }) {
  const [ref, W] = useElementWidth();
  const H = mobile ? 214 : 290;
  const shown = history.slice(mobile ? -4 : -6);

  const chart = useMemo(() => {
    if (W < 120) return null;
    const padL = mobile ? 28 : 40;
    const padR = mobile ? 46 : 74;
    const padT = 34;
    const padB = mobile ? 38 : 44;
    const pw = W - padL - padR;
    const ph = H - padT - padB;
    const base = padT + ph;
    const allVals = shown.flatMap(g => g.vals.filter(v => v != null));
    const axis = niceAxis(Math.max(...allVals, next?.val || 0, target || 0, 1) * 1.18, 4);
    const y = v => base - (v / axis.max) * ph;
    const n = shown.length + (next ? 1 : 0);
    const slot = pw / Math.max(n, mobile ? 3 : 4);
    const off = padL + (pw - slot * n) / 2;
    const maxSets = Math.max(...shown.map(g => g.vals.length), next?.sets || 0, 1);
    const gap = mobile ? 4 : 6;
    const bw = Math.max(6, Math.min(mobile ? 15 : 24, (slot * 0.82 - gap * (maxSets - 1)) / maxSets));
    const r = mobile ? 4 : 6;

    const grid = [];
    for (let v = 0; v <= axis.max + 1e-9; v += axis.step) grid.push({ v, y: y(v) });

    const groups = shown.map((g, i) => {
      const cx = off + slot * (i + 0.5);
      const gw = g.vals.length * bw + (g.vals.length - 1) * gap;
      const x0 = cx - gw / 2;
      const bars = g.vals.map((v, j) => {
        const x = x0 + j * (bw + gap);
        if (v == null) return { x, skip: true, yTop: base - 3, label: 'bỏ' };
        const yTop = y(Math.max(v, axis.max * 0.015));
        return { x, yTop, met: v >= g.target, label: String(v), d: barPath(x, yTop, bw, base, r) };
      });
      const d = dateOf(g.date);
      return {
        key: g.sessionId,
        cx,
        bars,
        pr: g.pr && g.best != null ? { y: y(g.best) } : null,
        t1: `${d.getDate()}/${d.getMonth() + 1}`,
        t2: WD_SHORT[d.getDay()]
      };
    });

    let ghost = null;
    if (next) {
      const cx = off + slot * (n - 0.5);
      const gw = next.sets * bw + (next.sets - 1) * gap;
      const yTop = y(next.val);
      ghost = {
        cx,
        yTop,
        bars: Array.from({ length: next.sets }, (_, j) => ({ x: cx - gw / 2 + j * (bw + gap) }))
      };
    }
    return { padL, padR, pw, base, grid, groups, ghost, bw, targetY: target ? y(target) : null };
  }, [W, H, mobile, shown, next, target]);

  return (
    <div ref={ref} className={`body-pg-chart${mobile ? ' is-mobile' : ''}`} style={{ height: H }}>
      {chart && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Biểu đồ từng set qua các buổi">
          <defs>
            <linearGradient id={`pgMet${mobile ? 'M' : 'D'}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8C70FF" />
              <stop offset="1" stopColor="#6949E8" />
            </linearGradient>
            <linearGradient id={`pgLow${mobile ? 'M' : 'D'}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#F6CB8E" />
              <stop offset="1" stopColor="#EAA14E" />
            </linearGradient>
          </defs>

          {chart.grid.map(g => (
            <g key={g.v}>
              <line x1={chart.padL} x2={chart.padL + chart.pw} y1={g.y} y2={g.y} className={g.v === 0 ? 'pg-axis' : 'pg-grid'} />
              <text x={chart.padL - 8} y={g.y + 3.5} textAnchor="end" className="pg-tick">{g.v}</text>
            </g>
          ))}

          {chart.targetY != null && (
            <g>
              <line x1={chart.padL} x2={chart.padL + chart.pw} y1={chart.targetY} y2={chart.targetY} className="pg-target" />
              <text x={chart.padL + chart.pw + 8} y={chart.targetY - 4} className="pg-target-cap">{mobile ? 'mục tiêu' : 'Mục tiêu'}</text>
              <text x={chart.padL + chart.pw + 8} y={chart.targetY + 11} className="pg-target-val">{target} {mobile ? '' : unitText(unit)}</text>
            </g>
          )}

          {chart.groups.map(g => (
            <g key={g.key}>
              {g.bars.map((b, j) => (b.skip ? (
                <g key={j}>
                  <rect x={b.x} y={b.yTop} width={chart.bw} height={3} rx={1.5} className="pg-skip" />
                  <text x={b.x + chart.bw / 2} y={b.yTop - 6} textAnchor="middle" className="pg-val is-skip">{b.label}</text>
                </g>
              ) : (
                <g key={j}>
                  <path d={b.d} fill={`url(#${b.met ? 'pgMet' : 'pgLow'}${mobile ? 'M' : 'D'})`}>
                    <title>{`Set ${j + 1}: ${b.label} ${unitText(unit)}`}</title>
                  </path>
                  <text x={b.x + chart.bw / 2} y={b.yTop - 6} textAnchor="middle" className={`pg-val${b.met ? ' is-met' : ' is-low'}`}>{b.label}</text>
                </g>
              )))}
              {g.pr && (
                <g transform={`translate(${g.cx} ${g.pr.y - (mobile ? 26 : 30)})`}>
                  <rect x={mobile ? -14 : -30} y={-15} width={mobile ? 28 : 60} height={mobile ? 16 : 19} rx={9} className="pg-pr" />
                  <text x={0} y={mobile ? -3.5 : -2} textAnchor="middle" className="pg-pr-text">{mobile ? 'PR' : '★ Kỷ lục'}</text>
                </g>
              )}
              <text x={g.cx} y={chart.base + 18} textAnchor="middle" className="pg-x1">{g.t1}</text>
              <text x={g.cx} y={chart.base + (mobile ? 31 : 33)} textAnchor="middle" className="pg-x2">{g.t2}</text>
            </g>
          ))}

          {chart.ghost && (
            <g>
              {chart.ghost.bars.map((b, j) => (
                <rect
                  key={j}
                  x={b.x}
                  y={chart.ghost.yTop}
                  width={chart.bw}
                  height={Math.max(2, chart.base - chart.ghost.yTop)}
                  rx={mobile ? 4 : 6}
                  className="pg-ghost"
                />
              ))}
              <text x={chart.ghost.cx} y={chart.ghost.yTop - 6} textAnchor="middle" className="pg-ghost-val">
                {next.val}{mobile ? '' : ` ${unitText(unit)}`}
              </text>
              <text x={chart.ghost.cx} y={chart.base + 18} textAnchor="middle" className="pg-x1 is-next">Buổi tới</text>
              <text x={chart.ghost.cx} y={chart.base + (mobile ? 31 : 33)} textAnchor="middle" className="pg-x2">dự kiến</text>
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

  const exDef = key => exerciseMap?.get?.(key) || BASE_EXERCISES.find(e => e.key === key) || null;
  const namesOf = (key, fallback) => splitExerciseName(exDef(key)?.name || fallback || key);

  const completed = useMemo(() => sessions.filter(s => s.status === 'completed'), [sessions]);

  // ── TIẾN BỘ TỪNG BÀI ─────────────────────────────────────────
  const trained = useMemo(() => summarizeTrainedExercises(recentSets, sessions), [recentSets, sessions]);
  const active = trained.find(e => e.key === selectedKey) || trained[0] || null;
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
    { key: 'best', label: 'Cao nhất đạt được', short: 'Cao nhất', value: bestVal ?? '—', unit: bestVal != null ? unitText(unit) : '' },
    { key: 'next', label: 'Mục tiêu buổi tới', short: 'Buổi tới', value: next?.val ?? '—', unit: next ? `${unitText(unit)} × ${next.sets}` : '', tone: 'accent' },
    { key: 'count', label: 'Số buổi đã tập', value: history.length, unit: 'buổi' },
    {
      key: 'gain',
      label: 'So với buổi đầu',
      short: 'So buổi đầu',
      value: gain == null ? '—' : gain > 0 ? `+${gain}` : gain < 0 ? `−${Math.abs(gain)}` : '±0',
      unit: gain == null ? '' : unitText(unit),
      tone: gain > 0 ? 'up' : gain < 0 ? 'down' : null
    }
  ];

  const rows = history.map((g, i) => {
    const prev = history[i - 1];
    const delta = prev && prev.best != null && g.best != null ? g.best - prev.best : null;
    const d = dateOf(g.date);
    const badge = g.pr
      ? { text: 'Kỷ lục mới', tone: 'pr', icon: 'trophy' }
      : i === 0
        ? { text: 'Buổi đầu', tone: 'muted', icon: 'flag' }
        : g.met
          ? { text: 'Đạt mục tiêu', tone: 'ok', icon: 'check' }
          : { text: 'Chưa đạt', tone: 'muted', icon: 'minus' };
    return {
      key: g.sessionId,
      date: `${d.getDate()}/${d.getMonth() + 1}`,
      wd: WD_SHORT[d.getDay()],
      vals: g.vals,
      target: g.target,
      best: g.best,
      delta,
      badge
    };
  }).reverse();

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
      // Mỗi loại buổi trong ngày một vạch màu (vd sáng theo lộ trình + chiều tập lẻ)
      const colors = [...new Set(list.map(s => dayTypeOf(s).color))].slice(0, 3);
      const plan = !list.length && planName != null && key > todayKey
        ? DAY_TAG_COLORS[splitDayName(planName).letter] || 'var(--body-accent)'
        : null;
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
      title: `Tháng ${m}, ${y}`,
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
      const { tag, letter, title } = splitDayName(planName || '');
      return {
        dateLabel,
        planned: {
          title: title || 'Buổi theo lộ trình',
          status: future ? 'planned' : 'missed',
          type: { label: tag || 'Theo lộ trình', color: DAY_TAG_COLORS[letter] || 'var(--body-accent)' },
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

  // ── KHỐI GIAO DIỆN DÙNG CHUNG DESKTOP / MOBILE ───────────────
  const chipsOf = (vals, target, unitKey) => vals.map((v, j) => (
    <span key={j} className={`body-pg-chip${v == null ? ' is-skip' : v >= target ? ' is-ok' : ' is-low'}`}>{valText(v, unitKey)}</span>
  ));

  const calendarCard = (
    <section className="body-pg-card body-pg-cal">
      <div className="body-pg-cal-head">
        <span className="body-pg-cal-titles">
          <b>{calendar.title}</b>
          <small>{calendar.sum}</small>
        </span>
        <span className="body-pg-cal-nav">
          <button type="button" className="body-pg-icon-btn" onClick={() => shiftMonth(-1)} aria-label="Tháng trước"><AppIcon name="caretLeft" size={14} /></button>
          <button type="button" className="body-pg-icon-btn" onClick={() => shiftMonth(1)} aria-label="Tháng sau"><AppIcon name="caretRight" size={14} /></button>
        </span>
      </div>
      <div className="body-pg-cal-week">{WEEK_HEAD.map(w => <span key={w}>{w}</span>)}</div>
      <div className="body-pg-cal-grid">
        {Array.from({ length: calendar.offset }, (_, i) => <span key={`e${i}`} />)}
        {calendar.cells.map(c => (
          <button
            key={c.key}
            type="button"
            className={`body-pg-day${c.key === selectedDate ? ' is-selected' : ''}${c.done ? ' is-done' : ''}${c.isToday ? ' is-today' : ''}${c.future ? ' is-future' : ''}`}
            onClick={() => setSelectedDate(c.key)}
            aria-pressed={c.key === selectedDate}
            aria-label={`Ngày ${c.d}${c.done ? ', đã tập' : c.plan ? ', có lịch' : ''}`}
          >
            <b>{c.d}</b>
            {c.done && <span className="body-pg-day-marks">{c.colors.map(col => <i key={col} className="is-done" style={{ background: col }} />)}</span>}
            {!c.done && c.plan && <i className="is-plan" style={{ borderColor: c.plan }} />}
          </button>
        ))}
      </div>
      {(calendar.legend.length > 0 || plannedWeekdays.size > 0) && (
        <div className="body-pg-legend">
          {calendar.legend.map(l => (
            <span key={l.label}><i style={{ background: l.color }} />{l.label}</span>
          ))}
          {plannedWeekdays.size > 0 && <span><i className="is-plan" />Dự kiến</span>}
        </div>
      )}
    </section>
  );

  const dayCard = (
    <section className="body-pg-card body-pg-dayc">
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
            <span className="is-type"><i style={{ background: s.type.color }} />{s.type.label}</span>
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
            <span className="is-type"><i style={{ background: day.planned.type.color }} />{day.planned.type.label}</span>
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
      <span><AppIcon name="chartBar" size={22} /></span>
      <b>Chưa có buổi tập nào hoàn thành</b>
      <p>Hoàn thành và lưu một buổi tập để bắt đầu theo dõi tiến bộ từng set.</p>
      {onNavigate && (
        <button type="button" className="body-pg-btn" onClick={() => onNavigate('routine')}>
          Mở Lộ trình<AppIcon name="arrowRight" size={14} />
        </button>
      )}
    </div>
  );

  const deltaText = d => (d == null ? '—' : d > 0 ? `+${d} ${unitText(unit)}` : d < 0 ? `−${Math.abs(d)} ${unitText(unit)}` : '±0');
  const deltaTone = d => (d == null || d === 0 ? '' : d > 0 ? ' is-up' : ' is-down');

  return (
    <div className="body-pg">
      {/* ── DESKTOP ─────────────────────────────────────────────── */}
      <div className="body-pg-desktop">
        <section className="body-pg-card body-pg-main">
          <div className="body-pg-main-head">
            <span className="body-pg-main-titles">
              <b>Tiến bộ từng bài tập</b>
              <small>Mỗi cột là một set, so với mục tiêu của bài</small>
            </span>
            <span className="body-pg-chart-legend">
              <span><i className="is-met" />Đạt mục tiêu</span>
              <span><i className="is-low" />Chưa đạt</span>
              <span><i className="is-next" />Buổi tới</span>
            </span>
          </div>

          {!active ? emptyProgress : (
            <div className="body-pg-main-grid">
              <div className="body-pg-exlist">
                <span className="body-pg-label">BÀI ĐÃ TẬP · {trained.length}</span>
                {trained.map(e => {
                  const nm = namesOf(e.key, e.name);
                  const on = e.key === active.key;
                  return (
                    <button key={e.key} type="button" className={`body-pg-ex${on ? ' is-on' : ''}`} onClick={() => setSelectedKey(e.key)} aria-pressed={on}>
                      <span className="body-pg-ex-name">
                        <b>{nm.vn}</b>
                        {nm.en && <small>{nm.en}</small>}
                      </span>
                      <span className="body-pg-ex-best">
                        <b>{e.best ?? '—'}{e.best != null ? ` ${unitText(e.unit)}` : ''}</b>
                        <small>{e.sessions} buổi</small>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="body-pg-detail">
                <div className="body-pg-kpis">
                  {kpis.map(k => (
                    <div key={k.key}>
                      <span>{k.label}</span>
                      <b className={k.tone ? `is-${k.tone}` : ''}>{k.value}<small>{k.unit}</small></b>
                    </div>
                  ))}
                </div>
                <SetChart history={history} unit={unit} target={lastTarget} next={next} />
                <div className="body-pg-table">
                  <div className="body-pg-trow is-head">
                    <span>NGÀY</span><span>CÁC SET</span><span>TỐT NHẤT</span><span>SO LẦN TRƯỚC</span><span>ĐÁNH GIÁ</span>
                  </div>
                  {rows.map(r => (
                    <div key={r.key} className="body-pg-trow">
                      <span className="body-pg-date"><b>{r.date}</b><small>{r.wd}</small></span>
                      <span className="body-pg-chips">{chipsOf(r.vals, r.target, unit)}</span>
                      <span className="body-pg-mono">{r.best != null ? `${r.best} ${unitText(unit)}` : '—'}</span>
                      <span className={`body-pg-mono body-pg-delta${deltaTone(r.delta)}`}>{deltaText(r.delta)}</span>
                      <span className={`body-pg-badge is-${r.badge.tone}`}>
                        <AppIcon name={r.badge.icon} size={12} weight={r.badge.tone === 'pr' ? 'fill' : 'regular'} />{r.badge.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <div className="body-pg-side">
          {calendarCard}
          {dayCard}
        </div>
      </div>

      {/* ── MOBILE ──────────────────────────────────────────────── */}
      <div className="body-pg-mobile">
        {calendarCard}
        {dayCard}
        <section className="body-pg-card body-pg-mprog">
          <div className="body-pg-mprog-head">
            <b>Tiến bộ từng bài</b>
            <small>mỗi cột là một set</small>
          </div>
          {!active ? emptyProgress : (
            <>
              <div className="body-pg-mex">
                {trained.map(e => (
                  <button key={e.key} type="button" className={e.key === active.key ? 'is-on' : ''} onClick={() => setSelectedKey(e.key)} aria-pressed={e.key === active.key}>
                    {namesOf(e.key, e.name).vn}
                  </button>
                ))}
              </div>
              <div className="body-pg-mkpis">
                {[kpis[0], kpis[1], kpis[3]].map(k => (
                  <div key={k.key}>
                    <span title={k.label}>{k.short}</span>
                    <b className={k.tone ? `is-${k.tone}` : ''}>{k.value}<small>{k.unit}</small></b>
                  </div>
                ))}
              </div>
              <SetChart history={history} unit={unit} target={lastTarget} next={next} mobile />
              <div className="body-pg-mrows">
                {rows.map(r => (
                  <div key={r.key} className="body-pg-mrow">
                    <div>
                      <span className="body-pg-date"><b>{r.date}</b><small>{r.wd}</small></span>
                      <span className={`body-pg-badge is-${r.badge.tone}`}>
                        <AppIcon name={r.badge.icon} size={11} weight={r.badge.tone === 'pr' ? 'fill' : 'regular'} />{r.badge.text}
                      </span>
                    </div>
                    <div>
                      <span className="body-pg-chips">{chipsOf(r.vals, r.target, unit)}</span>
                      <span className={`body-pg-mono body-pg-delta${deltaTone(r.delta)}`}>{deltaText(r.delta)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
