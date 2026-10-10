import { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useUserTasks } from '../../hooks/useUserTasks';
import { useFinance } from '../../hooks/useFinance';
import { useWorkouts } from '../../hooks/useWorkouts';
import { useBiometrics } from '../../hooks/useBiometrics';
import { useCollections } from '../../hooks/useCollections';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../ConfirmModal';
import { collectSystemAlerts } from '../../utils/dashboardAlerts';
import {
  compactMoney, priorityTag, monthSpend, spendForecast, topCategories, paymentCalendar,
  groupByDueDate, weekTraining, muscleRecoveryGroups, weightTrend, taskCompletionStats,
  dailySpendStats, knowledgeActivity, upcomingTaskSuggestions, shortDueLabel, pullToTodayChanges,
} from '../../utils/dashboardMetrics';
import { solarToLunar, getCanChiYear } from '../../utils/lunarUtils';
import { addDaysStr, shiftMonth } from '../../utils/financeLogic';
import { money } from '../finance/parts';
import MUSCLES from '../../data/body-muscles.json';
import TaskDetailModal from '../TaskDetailModal';
import AppIcon from '../AppIcon';
import '../../styles/dashboard.css';

const VN_WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const SHORT_WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const OVERDUE_PREVIEW = 3;
const CHART_W = 600;
const CHART_H = 160;
const CAL_LEGEND = [['paid', 'Đã trả'], ['over', 'Quá hạn'], ['today', 'Hôm nay'], ['up', 'Sắp tới']];

/** Phần tử không phải <button> mà bấm được: chuột + Enter/Space, bỏ qua phím từ nút con. */
function activateProps(onActivate, title) {
  return {
    role: 'button',
    tabIndex: 0,
    title,
    onClick: onActivate,
    onKeyDown: (e) => {
      if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      onActivate();
    },
  };
}

function SparkBars({ values, tone }) {
  const max = Math.max(1, ...values);
  return (
    <div className={`dash-sparklines-${values.length} dash-spark--${tone}`}>
      {values.map((v, i) => (
        <span
          key={i}
          className={`dash-spark-bar${i === values.length - 1 ? ' is-current' : ''}`}
          style={{ height: `${(v / max) * 100}%` }}
        />
      ))}
    </div>
  );
}

function WeightSpark({ points, goal }) {
  if (points.length < 2) return <div className="dash-mod-card__spark-empty">Cần ít nhất 2 lần cân trong 30 ngày</div>;
  const values = goal != null ? [...points, goal] : points;
  const min = Math.min(...values) - 0.3;
  const max = Math.max(...values) + 0.3;
  const Y = (v) => 50 - ((v - min) / (max - min)) * 48;
  const line = points.map((v, i) => `${i ? 'L' : 'M'}${((i / (points.length - 1)) * 200).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox="0 0 200 52" preserveAspectRatio="none" className="dash-weight-spark" aria-hidden="true">
      {goal != null && <path d={`M0 ${Y(goal).toFixed(1)} L200 ${Y(goal).toFixed(1)}`} className="dash-weight-spark__goal" vectorEffect="non-scaling-stroke" />}
      <path d={line} className="dash-weight-spark__line" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function HomeDashboard() {
  const { user, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { confirm, ConfirmModal } = useConfirm();

  const taskModel = useUserTasks();
  const {
    tasks, todayTasks, futureTasks, completedToday, completeTask, uncompleteTask, rolloverTask, updateTask, addTask,
    getCompletedTasksRange,
  } = taskModel;

  const fin = useFinance();
  const { bills, cards, loans, lendings, deposits, transactions, cats, today } = fin;

  const { activeRoutine, routineItems, sessions, recentSets, exerciseMap, hasLoaded: workoutsLoaded } = useWorkouts();
  const { measurements, profile: bodyProfile } = useBiometrics();
  const { fetchStats: fetchKnowledgeStats } = useCollections();

  const [selectedTask, setSelectedTask] = useState(null);
  const [expandedOverdueTasks, setExpandedOverdueTasks] = useState(false);
  const quickInputRef = useRef(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [pullingToToday, setPullingToToday] = useState(false);

  // Đồng hồ trang chủ: tab để mở qua đêm thì lời chào, ngày và lịch tập phải tự sang ngày mới
  // (`today` của các hook cũng tính lại ở mỗi lần render này).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const solarDateStr = `${VN_WEEKDAYS[now.getDay()]}, ${day}/${month}/${year}`;
  const lunar = useMemo(() => {
    try {
      return solarToLunar(day, month, year);
    } catch {
      return null;
    }
  }, [day, month, year]);

  // Tên sửa ở Settings nằm ở `profiles`; metadata chỉ là bản lúc đăng ký.
  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'bạn';

  // Chưa tải xong thì CHƯA BIẾT — frame đầu các mảng còn rỗng, không được nói "đúng hạn".
  const finReady = !fin.enabled || fin.hasLoaded;
  const isReady = finReady && taskModel.hasLoaded;
  const finError = fin.error;

  // ── Dữ liệu cho 2 ô module cần hỏi thêm server (một lần mỗi ngày) ──
  const [completedRange, setCompletedRange] = useState(null);
  useEffect(() => {
    let alive = true;
    getCompletedTasksRange(addDaysStr(today, -13), today).then(rows => { if (alive) setCompletedRange(rows); });
    return () => { alive = false; };
  }, [getCompletedTasksRange, today]);

  const [knowledgeStats, setKnowledgeStats] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchKnowledgeStats(addDaysStr(today, -56)).then(stats => { if (alive) setKnowledgeStats(stats); });
    return () => { alive = false; };
  }, [fetchKnowledgeStats, today]);

  // ── Tầng 1: cảnh báo ──
  const alerts = useMemo(() => collectSystemAlerts({
    tasks, bills, cards, loans, lendings, deposits, transactions, today,
  }), [tasks, bills, cards, loans, lendings, deposits, transactions, today]);

  const criticalTasks = useMemo(() => alerts.critical.filter(a => a.domain === 'task'), [alerts.critical]);
  // Task đến hạn hôm nay đã có ở card "Nhiệm vụ hôm nay" — không lặp lại trong khối gấp.
  const urgentFinanceList = useMemo(() => [
    ...alerts.critical.filter(a => a.domain !== 'task').map(f => ({ ...f, isOverdue: true, tag: 'Quá hạn' })),
    ...alerts.dueToday.filter(a => a.domain !== 'task').map(f => ({ ...f, isOverdue: false, tag: 'Hôm nay' })),
  ], [alerts.critical, alerts.dueToday]);

  const urgentCount = urgentFinanceList.length + criticalTasks.length;
  const showFinCol = urgentFinanceList.length > 0;
  const showTaskCol = criticalTasks.length > 0;
  const hasUrgent = urgentCount > 0;
  const allClear = isReady && !finError && !hasUrgent;
  const visibleOverdueTasks = expandedOverdueTasks ? criticalTasks : criticalTasks.slice(0, OVERDUE_PREVIEW);

  // ── Tầng 2: nhiệm vụ hôm nay (việc đã xong vẫn ở lại, gạch ngang, bỏ tick được) ──
  const todayChecklist = useMemo(() => [
    ...todayTasks.map(task => ({ task, done: false })),
    ...(completedToday || []).filter(t => t.due_date === today).map(task => ({ task, done: true })),
  ], [todayTasks, completedToday, today]);
  const todayDoneCount = todayChecklist.filter(i => i.done).length;
  // Danh sách trống → gợi ý kéo việc có hạn trong tuần tới về hôm nay
  const todaySuggestions = useMemo(() => upcomingTaskSuggestions(futureTasks, today), [futureTasks, today]);
  const todayProgressPct = todayChecklist.length ? `${Math.round((todayDoneCount / todayChecklist.length) * 100)}%` : '0%';

  // ── Tầng 2: Body ──
  const todayCompletedSession = useMemo(
    () => (sessions || []).find(s => s.status === 'completed' && s.local_date === today),
    [sessions, today],
  );
  // Buổi tập dở chỉ giữ tới hết ngày — buổi bỏ dở hôm qua không còn là "đang tập".
  const inProgressSession = useMemo(
    () => (sessions || []).find(s => s.status === 'in_progress' && s.local_date === today),
    [sessions, today],
  );
  const todayWeekday = now.getDay() === 0 ? 7 : now.getDay(); // 1 = T2 ... 7 = CN, khớp body_routine_items
  const todayRoutineItems = useMemo(
    () => (routineItems || []).filter(item => item.weekday === todayWeekday),
    [routineItems, todayWeekday],
  );

  const body = useMemo(() => {
    const exerciseName = (item) => exerciseMap?.get(item.exercise_key)?.name || item.exercise_key;
    const loggedSets = (sessionId) => (recentSets || []).filter(s => s.session_id === sessionId
      && (s.actual_val != null || s.weight != null || s.reps != null)).length;

    if (inProgressSession) {
      const plannedItems = (routineItems || []).filter(i => i.weekday === (inProgressSession.planned_weekday || todayWeekday));
      const planned = plannedItems.reduce((sum, i) => sum + (Number(i.target_sets) || 0), 0);
      const done = loggedSets(inProgressSession.id);
      return {
        state: 'live', badge: 'Đang dở', badgeIcon: 'pause',
        title: inProgressSession.day_type || inProgressSession.title || 'Buổi tập đang diễn ra',
        sub: `Đã xong ${done}${planned ? `/${planned}` : ''} set. Buổi tập còn giữ đến 23:59 tối nay.`,
        progress: planned ? Math.min(1, done / planned) : null,
        cta: 'Tiếp tục buổi tập', ctaIcon: 'play', to: '/body/session',
      };
    }
    if (todayCompletedSession) {
      const minutes = todayCompletedSession.duration_seconds
        ? Math.max(1, Math.round(todayCompletedSession.duration_seconds / 60)) : null;
      const sets = loggedSets(todayCompletedSession.id);
      const finishedAt = todayCompletedSession.ended_at
        ? new Date(todayCompletedSession.ended_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : null;
      return {
        state: 'done', badge: finishedAt ? `Xong ${finishedAt}` : 'Đã xong', badgeIcon: 'checkCircle',
        title: todayCompletedSession.day_type || todayCompletedSession.title || 'Buổi tập hôm nay',
        sub: [sets ? `${sets} set` : null, minutes ? `${minutes} phút` : null].filter(Boolean).join(' · ') || 'Đã hoàn thành buổi tập hôm nay.',
        progress: null, cta: 'Xem buổi tập', ctaIcon: 'listChecks', to: '/body/history',
      };
    }
    if (todayRoutineItems.length > 0) {
      const names = todayRoutineItems.slice(0, 3).map((item, idx) => `${idx + 1}. ${exerciseName(item)}`).join(' · ');
      return {
        state: 'plan', badge: 'Hôm nay', badgeIcon: 'calendar',
        title: todayRoutineItems[0]?.day_name || activeRoutine?.name || 'Lịch tập hôm nay',
        sub: `${todayRoutineItems.length} bài: ${names}${todayRoutineItems.length > 3 ? '…' : ''}`,
        progress: null, cta: 'Vào phòng tập', ctaIcon: 'barbell', to: '/body',
      };
    }
    if (activeRoutine) {
      // Buổi kế tiếp trong tuần (vòng sang tuần sau nếu hết)
      const weekdays = [...new Set((routineItems || []).map(i => i.weekday))].sort((a, b) => a - b);
      const next = weekdays.find(w => w > todayWeekday) ?? weekdays[0];
      const nextItems = (routineItems || []).filter(i => i.weekday === next);
      const nextLabel = next == null ? null : VN_WEEKDAYS[next % 7];
      return {
        state: 'rest', badge: 'Rest day', badgeIcon: 'moon', title: 'Ngày nghỉ phục hồi',
        sub: nextLabel
          ? `Buổi tới: ${nextLabel} · ${nextItems[0]?.day_name || 'Tập luyện'} · ${nextItems.length} bài.`
          : `Lộ trình ${activeRoutine.name} chưa có buổi nào trong tuần.`,
        progress: null, cta: 'Xem lộ trình', ctaIcon: 'listChecks', to: '/body/routine',
      };
    }
    return {
      state: 'none', badge: 'Chưa bắt đầu', badgeIcon: 'plus', title: 'Chưa có lộ trình',
      sub: 'Chọn một lộ trình mẫu, app sẽ xếp lịch tập cho từng ngày.',
      progress: null, cta: 'Tạo lộ trình', ctaIcon: 'plus', to: '/body/routine',
    };
  }, [inProgressSession, todayCompletedSession, todayRoutineItems, routineItems, recentSets, activeRoutine, exerciseMap, todayWeekday]);

  const recovery = useMemo(() => {
    const groups = muscleRecoveryGroups({ recentSets, exerciseMap, muscles: MUSCLES, nowMs: now.getTime() });
    const allReady = groups[2].muscles.length === Object.keys(MUSCLES).length;
    return allReady
      ? [{ id: 'ready', label: 'Sẵn sàng', text: 'Tất cả nhóm cơ' }]
      : groups.filter(g => g.muscles.length).map(g => ({
        id: g.id, label: g.label,
        text: g.muscles.length > 5 ? `${g.muscles.slice(0, 5).join(', ')} +${g.muscles.length - 5}` : g.muscles.join(', '),
      }));
  }, [recentSets, exerciseMap, now]);

  const week = useMemo(() => weekTraining({ sessions, routineItems, today }), [sessions, routineItems, today]);

  // ── Tầng 2: sắp tới hạn, nhóm theo ngày đến hạn thật ──
  const radarGroups = useMemo(() => groupByDueDate(alerts.headsUp, today), [alerts.headsUp, today]);

  // ── Tầng 3: lịch thanh toán (cũng là nguồn "chi cố định còn đến hạn" cho dự kiến) ──
  const calendar = useMemo(
    () => paymentCalendar({ bills, cards, loans, transactions, today }),
    [bills, cards, loans, transactions, today],
  );

  // ── Tầng 3: chi tiêu tháng — so với tháng trước, không có hạn mức (module Ngân sách đã gỡ) ──
  const spend = useMemo(() => monthSpend(transactions, today), [transactions, today]);
  // Dự kiến = cố định đã trả + cố định còn đến hạn trong tháng + biến đổi theo nhịp hiện tại.
  const forecast = spendForecast({
    spent: spend.spent,
    fixedSpent: spend.fixedSpent,
    upcomingFixed: calendar.upcomingFixedSpend,
    curDay: spend.curDay,
    daysInMonth: spend.daysInMonth,
  });
  const prevMonthTotal = spend.prevCumulative[spend.prevCumulative.length - 1] || 0;
  const vsPrevPct = spend.prevToDate > 0 ? Math.round(((spend.spent - spend.prevToDate) / spend.prevToDate) * 100) : null;
  const spendCats = useMemo(() => topCategories(transactions, today, cats), [transactions, today, cats]);
  const maxCatShare = Math.max(1, ...spendCats.map(c => c.share));

  const chart = useMemo(() => {
    const { cumulative, prevCumulative, curDay, daysInMonth, spent } = spend;
    const projected = forecast.projected;
    const prevEnd = prevCumulative[prevCumulative.length - 1] || 0;
    // Trục ngày dài bằng tháng dài hơn trong hai tháng — giống "Nhịp chi trong kỳ" bên Finance.
    const totalDays = Math.max(daysInMonth, prevCumulative.length);
    const maxY = Math.max(projected * 1.1, prevEnd * 1.1, spent * 1.1, 1);
    const X = (d) => ((d - 1) / Math.max(1, totalDays - 1)) * CHART_W;
    const Y = (v) => CHART_H - (v / maxY) * CHART_H;
    const f = (n) => n.toFixed(1);
    const pct = (v, total) => `${((v / total) * 100).toFixed(2)}%`;
    // Bậc thang: phẳng giữa hai ngày, nhảy lên đúng ngày có chi (tiền không chi rải đều).
    const step = (values) => values
      .map((v, i) => (i === 0 ? `M${f(X(1))} ${f(Y(v))}` : `L${f(X(i + 1))} ${f(Y(values[i - 1]))} L${f(X(i + 1))} ${f(Y(v))}`))
      .join(' ');
    const line = step(cumulative);
    const align = (d) => (d === 1 ? 'start' : d === totalDays ? 'end' : 'mid');
    const ticks = [1, 15, 22, daysInMonth]
      .filter(d => Math.abs(d - curDay) > 2)
      .map(d => ({ d, label: `${d}/${month}`, left: pct(X(d), CHART_W), align: align(d) }))
      .concat({ d: curDay, label: 'hôm nay', left: pct(X(curDay), CHART_W), align: align(curDay), isToday: true });
    return {
      line,
      area: cumulative.length ? `${line} L${f(X(curDay))} ${CHART_H} L${f(X(1))} ${CHART_H} Z` : '',
      prev: prevEnd > 0 ? step(prevCumulative) : '',
      proj: `M${f(X(curDay))} ${f(Y(spent))} L${f(X(daysInMonth))} ${f(Y(projected))}`,
      grid: [0.25, 0.5, 0.75].map(r => `M0 ${f(CHART_H * r)} L${CHART_W} ${f(CHART_H * r)}`).join(' ')
        + ` M${f(X(curDay))} 0 L${f(X(curDay))} ${CHART_H}`,
      prevTop: pct(Y(prevEnd), CHART_H),
      projTop: pct(Y(projected), CHART_H),
      dotLeft: pct(X(curDay), CHART_W),
      dotTop: pct(Y(spent), CHART_H),
      ticks,
    };
  }, [spend, forecast.projected, month]);

  // ── Tầng 3: 5 ô module ──
  const taskStats = useMemo(
    () => (completedRange ? taskCompletionStats([...completedRange, ...(completedToday || [])], today) : null),
    [completedRange, completedToday, today],
  );
  const spendStats = useMemo(() => dailySpendStats(transactions, today), [transactions, today]);
  const prevMonthNum = Number(shiftMonth(today, -1).slice(5, 7));
  const weight = useMemo(
    () => weightTrend(measurements, bodyProfile?.goal_weight_kg, today),
    [measurements, bodyProfile?.goal_weight_kg, today],
  );
  const knowledge = useMemo(
    () => (knowledgeStats ? knowledgeActivity(knowledgeStats.createdAt, today) : null),
    [knowledgeStats, today],
  );

  // ── Hành động ──
  const openFinance = (alert) => navigate(
    alert.targetUrl || '/finance',
    alert.targetSeg ? { state: { recurringSeg: alert.targetSeg } } : undefined,
  );

  // Khoản nào ghi trả được ngay (số tiền đã biết) thì nút là "Đã trả"; còn lại mở màn Định kỳ.
  const inlinePayment = (item) => {
    const { raw, period, amount } = item;
    if (item.actionType === 'bill_pay' && raw.amount_mode === 'fixed' && raw.amount > 0) {
      return { amount: raw.amount, run: () => fin.payBill(raw, { period }) };
    }
    if (item.actionType === 'card_pay' && amount > 0) {
      return { amount, run: () => fin.payCardStatement(raw, { amount, period }) };
    }
    if (item.actionType === 'loan_pay' && amount > 0) {
      return {
        amount,
        run: () => (raw.kind === 'interest'
          ? fin.payLoanInterest(raw, { amount, period })
          : fin.payLoanInstallment(raw, { amount, period })),
      };
    }
    return null;
  };

  const handleFinanceAction = async (item) => {
    const plan = inlinePayment(item);
    if (!plan) {
      openFinance(item);
      return;
    }
    const agreed = await confirm({
      title: `Ghi đã trả ${money(plan.amount)}?`,
      message: `${item.title}${item.period ? ` · kỳ ${item.period}` : ''}. Ghi ngày hôm nay, không gắn thẻ nguồn. `
        + 'Muốn đổi ngày, số tiền hoặc trả bằng thẻ thì mở màn Định kỳ.',
      confirmLabel: 'Ghi đã trả',
    });
    if (!agreed) return;
    const ok = await plan.run();
    showToast(ok ? `Đã ghi trả: ${item.title}` : `Không thể ghi trả ${item.title}. Thử lại hoặc mở màn Định kỳ.`,
      { icon: ok ? 'checkCircle' : 'warning' });
  };

  const handleSkipBill = async (alert) => {
    const agreed = await confirm({
      title: `Bỏ kỳ ${alert.period} của ${alert.raw.name}?`,
      message: 'Kỳ này sẽ không sinh giao dịch và không còn được nhắc ở bất kỳ màn nào. Chỉ bỏ khi kỳ này thật sự không phải trả.',
      confirmLabel: 'Bỏ kỳ',
      danger: true,
    });
    if (!agreed) return;
    const ok = await fin.skipBillPeriod(alert.raw.id, alert.period);
    showToast(ok
      ? `Đã bỏ kỳ ${alert.period} của ${alert.raw.name}`
      : `Không thể bỏ kỳ của ${alert.raw.name}. Thử lại sau.`,
    { icon: ok ? 'calendar' : 'warning' });
  };

  const handleCompleteTask = async (task) => {
    const ok = await completeTask(task.id);
    showToast(ok ? `Đã xong: ${task.title}` : `Không thể hoàn thành “${task.title}”. Thử lại sau.`,
      { icon: ok ? 'checkCircle' : 'warning' });
    return ok;
  };

  const handleRolloverTask = async (task) => {
    const ok = await rolloverTask(task.id);
    showToast(ok ? `Đã dời sang hôm nay: ${task.title}` : `Không thể dời “${task.title}”. Thử lại sau.`,
      { icon: ok ? 'calendar' : 'warning' });
  };

  const handleRolloverAll = async () => {
    if (criticalTasks.length === 0) return;
    const results = await Promise.all(criticalTasks.map(item => rolloverTask(item.raw.id)));
    const moved = results.filter(Boolean).length;
    const failed = results.length - moved;
    showToast(failed === 0
      ? `Đã dời ${moved} nhiệm vụ quá hạn sang hôm nay`
      : `Đã dời ${moved}/${results.length} nhiệm vụ — ${failed} việc chưa dời được, thử lại sau.`,
    { icon: failed ? 'warning' : 'calendar' });
  };

  const handleToggleToday = async ({ task, done }) => {
    if (!done) {
      await handleCompleteTask(task);
      return;
    }
    const ok = await uncompleteTask(task.id);
    if (!ok) showToast(`Không thể bỏ hoàn thành “${task.title}”. Thử lại sau.`, { icon: 'warning' });
  };

  const handlePullToToday = async (list) => {
    if (pullingToToday || list.length === 0) return;
    setPullingToToday(true);
    const results = await Promise.all(list.map(t => updateTask(t.id, pullToTodayChanges(t, today))));
    setPullingToToday(false);
    const moved = results.filter(Boolean).length;
    const failed = results.length - moved;
    showToast(failed === 0
      ? (list.length === 1 ? `Đã chuyển sang hôm nay: ${list[0].title}` : `Đã chuyển ${moved} việc sang hôm nay`)
      : `Đã chuyển ${moved}/${results.length} việc — ${failed} việc chưa chuyển được, thử lại sau.`,
    { icon: failed ? 'warning' : 'calendar' });
  };

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    const clean = quickTitle.trim();
    if (!clean) return;
    const created = await addTask({ title: clean, dueDate: today });
    if (created) {
      setQuickTitle('');
      showToast(`Đã thêm việc hôm nay: ${clean}`, { icon: 'plus' });
    } else {
      showToast('Không thể thêm việc. Nội dung vẫn giữ trong ô để thử lại.', { icon: 'warning' });
    }
  };

  return (
    <div className="dash-workspace">
      {/* ── HEADER CỐ ĐỊNH (Pinned Header) ────────────────────────────── */}
      <header className="dash-header">
        <div className="dash-header__left">
          <span className="dash-header__greeting">{greeting}, {displayName}</span>
          <div className="dash-header__date-meta">
            <span>{solarDateStr}</span>
            {lunar && (
              <span className="dash-header__lunar-badge">
                · {lunar.day}/{lunar.month} âm lịch{lunar.leap ? ' (nhuận)' : ''}, năm {getCanChiYear(lunar.year)}
              </span>
            )}
          </div>
        </div>

        <div className="dash-header__right">
          {!isReady ? (
            <div className="dash-status dash-status--muted" role="status">
              <AppIcon name="arrowsClockwise" size={15} />
              <span>Đang kiểm tra…</span>
            </div>
          ) : hasUrgent ? (
            <div className="dash-status dash-status--urgent" role="status">
              <span className="dash-pulse-dot" aria-hidden="true">
                <span className="dash-pulse-dot__ring" />
                <span className="dash-pulse-dot__core" />
              </span>
              <span>{urgentCount} mục cần xử lý</span>
            </div>
          ) : finError ? (
            <div className="dash-status dash-status--warn" role="status">
              <AppIcon name="warning" size={15} weight="fill" />
              <span>Chưa kiểm tra được Tài chính</span>
            </div>
          ) : (
            <div className="dash-status dash-status--ok" role="status">
              <AppIcon name="checkCircle" size={15} weight="fill" />
              <span>Mọi thứ đúng hạn</span>
            </div>
          )}

          <button
            type="button"
            className="dash-header-btn"
            onClick={() => quickInputRef.current?.focus()}
          >
            <AppIcon name="plus" size={14} weight="bold" />
            <span>Ghi nhanh</span>
          </button>

          <button
            type="button"
            className="dash-theme-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            aria-label="Đổi giao diện sáng/tối"
          >
            <AppIcon name={theme === 'dark' ? 'sun' : 'moon'} size={16} weight="fill" />
          </button>
        </div>
      </header>

      {/* ── VÙNG CUỘN NỘI BỘ (Workspace Scroll Container) ─────────────── */}
      <div className="dash-scroll">
        {finError && (
          <div className="dash-notice" role="alert">
            <AppIcon name="warning" size={18} weight="fill" />
            <div className="dash-notice__text">
              <strong>Không tải được dữ liệu Tài chính</strong>
              <span>Cảnh báo hóa đơn, thẻ và khoản vay bên dưới có thể đang thiếu. ({finError})</span>
            </div>
            <button type="button" className="dash-btn dash-btn--secondary" onClick={() => fin.fetchAll()}>
              <AppIcon name="arrowsClockwise" size={14} /> Tải lại
            </button>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════════
            TẦNG 1: CẦN XỬ LÝ NGAY (tài chính quá hạn/đến hạn + nhiệm vụ quá hạn)
            ═════════════════════════════════════════════════════════════════════════ */}
        {!isReady ? (
          <div className="dash-loading" role="status">
            <AppIcon name="arrowsClockwise" size={18} />
            <span>Đang tải nhiệm vụ và nghĩa vụ tài chính…</span>
          </div>
        ) : hasUrgent ? (
          <section className="dash-critical-box" aria-label="Cần xử lý ngay">
            <div className="dash-critical-box__top">
              <div className="dash-critical-box__top-left">
                <span className="dash-critical-box__top-icon">
                  <AppIcon name="warning" size={18} weight="fill" />
                </span>
                <span className="dash-critical-box__top-title">Cần xử lý ngay</span>
              </div>
              <div className="dash-critical-box__top-right">
                {!showFinCol && (finError ? (
                  <span className="dash-critical-box__clear-tag dash-critical-box__clear-tag--warn">
                    <AppIcon name="warning" size={13} weight="fill" />
                    Tài chính: lỗi kết nối
                  </span>
                ) : (
                  <span className="dash-critical-box__clear-tag">
                    <AppIcon name="checkCircle" size={13} weight="fill" />
                    Tài chính: đã xử lý
                  </span>
                ))}
                {!showTaskCol && (
                  <span className="dash-critical-box__clear-tag">
                    <AppIcon name="checkCircle" size={13} weight="fill" />
                    Nhiệm vụ: đã xử lý
                  </span>
                )}
              </div>
            </div>

            <div className={`dash-critical-grid${showFinCol && showTaskCol ? '' : ' dash-critical-grid--single'}`}>
              {/* CỘT TÀI CHÍNH */}
              {showFinCol && (
                <div className="dash-critical-col">
                  <div className="dash-critical-col__head">
                    <span>TÀI CHÍNH</span>
                  </div>
                  {urgentFinanceList.map((f) => {
                    const payable = Boolean(inlinePayment(f));
                    return (
                      <div key={f.id} className="dash-crit-fin-row">
                        <div className="dash-crit-fin-row__main">
                          <div className="dash-crit-fin-row__title-wrap">
                            <span className={`dash-crit-tag ${f.isOverdue ? 'dash-crit-tag--overdue' : 'dash-crit-tag--today'}`}>
                              {f.tag}
                            </span>
                            <button
                              type="button"
                              className="dash-crit-fin-row__name dash-link-btn"
                              onClick={() => openFinance(f)}
                              title="Mở màn Định kỳ"
                            >
                              {f.title}
                            </button>
                          </div>
                          <span className="dash-crit-fin-row__sub">{f.badge || f.subtitle}</span>
                        </div>
                        <span className="dash-crit-fin-row__amt">
                          {f.amount != null ? money(f.amount) : ''}
                        </span>
                        <div className="dash-crit-fin-row__actions">
                          <button type="button" className="dash-crit-action-btn" onClick={() => handleFinanceAction(f)}>
                            <AppIcon name={payable ? 'check' : 'arrowUpRight'} size={13} weight="bold" />
                            <span>{payable ? 'Đã trả' : f.actionLabel}</span>
                          </button>
                          {f.actionType === 'bill_pay' && (
                            <button
                              type="button"
                              className="dash-crit-skip-btn"
                              onClick={() => handleSkipBill(f)}
                              title="Bỏ kỳ hóa đơn này nếu không phải trả"
                            >
                              Bỏ kỳ
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* CỘT NHIỆM VỤ QUÁ HẠN */}
              {showTaskCol && (
                <div className="dash-critical-col">
                  <div className="dash-critical-col__head">
                    <span>NHIỆM VỤ QUÁ HẠN · {criticalTasks.length}</span>
                    {criticalTasks.length > 1 && (
                      <button type="button" className="dash-critical-rollover-btn" onClick={handleRolloverAll}>
                        <AppIcon name="calendar" size={13} />
                        <span>Dời tất cả</span>
                      </button>
                    )}
                  </div>

                  {visibleOverdueTasks.map((t) => {
                    const pill = priorityTag(t.raw?.priority);
                    return (
                      <div key={t.id} className="dash-crit-task-row">
                        {pill ? (
                          <span className={`dash-priority-pill dash-priority-pill--p${pill.rank}`} title={`Ưu tiên ${pill.label}`}>
                            {pill.text}
                          </span>
                        ) : <span aria-hidden="true" />}
                        <div className="dash-crit-task-row__main">
                          <button
                            type="button"
                            className="dash-crit-task-row__name dash-link-btn"
                            onClick={() => setSelectedTask(t.raw)}
                            title="Bấm để xem chi tiết"
                          >
                            {t.title}
                          </button>
                          <span className="dash-crit-task-row__sub">{t.badge}</span>
                        </div>
                        <div className="dash-crit-task-row__actions">
                          <button
                            type="button"
                            className="dash-crit-action-btn"
                            onClick={() => handleRolloverTask(t.raw)}
                            title="Dời sang hôm nay"
                          >
                            <span>Dời</span>
                          </button>
                          <button
                            type="button"
                            className="dash-crit-btn-done"
                            onClick={() => handleCompleteTask(t.raw)}
                            title="Đánh dấu hoàn thành"
                          >
                            <AppIcon name="check" size={13} weight="bold" />
                            <span>Xong</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {criticalTasks.length > OVERDUE_PREVIEW && (
                    <div className="dash-crit-more-bar">
                      <span>{expandedOverdueTasks ? 'Đang hiện tất cả' : `Còn ${criticalTasks.length - OVERDUE_PREVIEW} việc khác`}</span>
                      <button
                        type="button"
                        className="dash-crit-more-link dash-link-btn"
                        onClick={() => setExpandedOverdueTasks(!expandedOverdueTasks)}
                      >
                        {expandedOverdueTasks ? 'Thu gọn' : 'Xem tất cả'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        ) : allClear ? (
          <div className="dash-all-clear">
            <span className="dash-all-clear__icon-wrap">
              <AppIcon name="checkCircle" size={21} weight="fill" />
            </span>
            <div>
              <div className="dash-all-clear__title">Tuyệt vời, không có việc quá hạn</div>
              <div className="dash-all-clear__sub">Hóa đơn, khoản nợ và nhiệm vụ đều trong hạn.</div>
            </div>
          </div>
        ) : null}

        {/* ═════════════════════════════════════════════════════════════════════════
            TẦNG 2: TIÊU ĐIỂM HÔM NAY
            ═════════════════════════════════════════════════════════════════════════ */}
        <div>
          <div className="dash-section-head dash-section-head--spaced">
            <span className="dash-section-head__title">Tiêu điểm hôm nay</span>
          </div>

          <div className="dash-today-grid">
            {/* CỘT 1: NHIỆM VỤ HÔM NAY */}
            <div className="dash-card">
              <div className="dash-card__head">
                <span className="dash-card__title">Nhiệm vụ hôm nay</span>
                <span className="dash-card__meta">{todayDoneCount}/{todayChecklist.length} xong</span>
              </div>
              {todayChecklist.length > 0 && (
                <span className="dash-progress-track">
                  <span className="dash-progress-bar dash-progress-bar--blue" style={{ width: todayProgressPct }} />
                </span>
              )}

              <div className="dash-checklist">
                {!taskModel.hasLoaded ? (
                  <div className="dash-card-empty">Đang tải nhiệm vụ…</div>
                ) : todayChecklist.length > 0 ? (
                  todayChecklist.map((entry) => {
                    const { task: t, done } = entry;
                    const pill = priorityTag(t.priority);
                    return (
                      <div key={t.id} className="dash-task-row" {...activateProps(() => setSelectedTask(t), 'Bấm để xem chi tiết')}>
                        <button
                          type="button"
                          className={`dash-task-checkbox ${done ? 'dash-task-checkbox--checked' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleToday(entry);
                          }}
                          aria-label={done ? `Bỏ hoàn thành ${t.title}` : `Hoàn thành ${t.title}`}
                        >
                          {done && <AppIcon name="check" size={12} weight="bold" />}
                        </button>
                        <span className={`dash-task-row__name ${done ? 'dash-task-row__name--done' : ''}`}>{t.title}</span>
                        <span className="dash-task-row__time">{t.due_time ? String(t.due_time).slice(0, 5) : ''}</span>
                        {pill ? (
                          <span className={`dash-task-row__priority dash-priority-pill--p${pill.rank}`} title={`Ưu tiên ${pill.label}`}>
                            {pill.text}
                          </span>
                        ) : <span aria-hidden="true" />}
                      </div>
                    );
                  })
                ) : todaySuggestions.length > 0 ? (
                  <div className="dash-today-suggest">
                    <span className="dash-today-suggest__hint">Chưa có việc cho hôm nay. Có hạn trong tuần:</span>
                    {todaySuggestions.map((t) => {
                      const pill = priorityTag(t.priority);
                      return (
                        <div key={t.id} className="dash-suggest-row">
                          <div className="dash-suggest-row__main">
                            <button
                              type="button"
                              className="dash-suggest-row__name dash-link-btn"
                              onClick={() => setSelectedTask(t)}
                              title="Bấm để xem chi tiết"
                            >
                              {t.title}
                            </button>
                            <span className="dash-suggest-row__sub">
                              Hạn {shortDueLabel(t.due_date, today)}
                              {t.due_time ? ` · ${String(t.due_time).slice(0, 5)}` : ''}
                              {pill ? ` · ${pill.text}` : ''}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="dash-suggest-add-btn"
                            onClick={() => handlePullToToday([t])}
                            disabled={pullingToToday}
                          >
                            <AppIcon name="plus" size={12} weight="bold" />
                            <span>Hôm nay</span>
                          </button>
                        </div>
                      );
                    })}
                    {todaySuggestions.length > 1 && (
                      <button
                        type="button"
                        className="dash-suggest-all-btn"
                        onClick={() => handlePullToToday(todaySuggestions)}
                        disabled={pullingToToday}
                      >
                        Thêm cả {todaySuggestions.length}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="dash-card-empty">Chưa có việc nào cho hôm nay hay có hạn trong tuần.</div>
                )}
              </div>

              <form onSubmit={handleQuickAdd} className="dash-quick-add-wrap">
                <AppIcon name="plus" size={15} className="dash-quick-add-icon" />
                <input
                  ref={quickInputRef}
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  placeholder="Thêm việc cho hôm nay, Enter để lưu"
                  aria-label="Thêm nhanh việc hôm nay"
                  className="dash-quick-add-input"
                />
              </form>
            </div>

            {/* CỘT 2: BODY */}
            <div className={`dash-card dash-card--body dash-body--${body.state}`}>
              <div className="dash-card-body__top">
                <span className="dash-card__title">Body</span>
                <span className="dash-card-body__badge">
                  <AppIcon name={body.badgeIcon} size={12} weight="fill" />
                  <span>{body.badge}</span>
                </span>
              </div>

              {!workoutsLoaded ? (
                <div className="dash-card-body__content">
                  <div className="dash-card-empty">Đang tải lịch tập…</div>
                </div>
              ) : (
                <div className="dash-card-body__content">
                  <span className="dash-card-body__title">{body.title}</span>
                  <span className="dash-card-body__sub">{body.sub}</span>

                  {body.progress != null && (
                    <span className="dash-progress-track">
                      <span className="dash-progress-bar dash-progress-bar--yellow" style={{ width: `${Math.round(body.progress * 100)}%` }} />
                    </span>
                  )}

                  <div className="dash-rec-groups">
                    {recovery.map((g) => (
                      <div key={g.id} className={`dash-rec-row dash-rec--${g.id}`}>
                        <span className="dash-rec-label">
                          <span className="dash-rec-dot" />
                          <span>{g.label}</span>
                        </span>
                        <span className="dash-rec-text">{g.text}</span>
                      </div>
                    ))}
                  </div>

                  <button type="button" className="dash-body-cta-btn" onClick={() => navigate(body.to)}>
                    <AppIcon name={body.ctaIcon} size={15} weight="bold" />
                    <span>{body.cta}</span>
                  </button>
                </div>
              )}

              <div className="dash-body-week-bar">
                <div className="dash-body-week-grid">
                  {week.days.map((d) => (
                    <div key={d.date} className={`dash-body-day-col dash-body-day--${d.state}`} title={d.date}>
                      <span className="dash-body-day-pill" />
                      <span className="dash-body-day-name">{d.label}</span>
                    </div>
                  ))}
                </div>
                <span className="dash-body-week-stat">
                  {week.planned ? `${week.done}/${week.planned} buổi` : `${week.done} buổi`}
                </span>
              </div>
            </div>

            {/* CỘT 3: SẮP TỚI HẠN (nhóm theo ngày) */}
            <div className="dash-card">
              <div className="dash-card__head">
                <span className="dash-card__title">Sắp tới hạn</span>
                <span className="dash-card__meta">{alerts.headsUp.length} mục</span>
              </div>

              <div className="dash-radar-list">
                {!isReady ? (
                  <div className="dash-card-empty">Đang tải…</div>
                ) : radarGroups.length > 0 ? (
                  radarGroups.map((grp) => (
                    <div key={grp.date} className="dash-radar-group">
                      <span className="dash-radar-date-label">{grp.label}</span>
                      {grp.items.map((item) => (
                        <div
                          key={item.id}
                          className="dash-radar-item"
                          {...activateProps(
                            () => (item.domain === 'task' ? setSelectedTask(item.raw) : openFinance(item)),
                            item.domain === 'task' ? 'Bấm để xem chi tiết nhiệm vụ' : 'Mở màn Định kỳ',
                          )}
                        >
                          <span className={`dash-radar-item__icon dash-radar-item__icon--${item.domain === 'task' ? 'task' : 'finance'}`}>
                            <AppIcon name={item.icon || 'calendar'} size={16} />
                          </span>
                          <div className="dash-radar-item__main">
                            <span className="dash-radar-item__title">{item.title}</span>
                            <span className="dash-radar-item__sub">{item.subtitle}</span>
                          </div>
                          <span className="dash-radar-item__val">
                            {item.amount != null ? money(item.amount)
                              : item.raw?.due_time ? String(item.raw.due_time).slice(0, 5) : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))
                ) : (
                  <div className="dash-card-empty">Không có việc hay khoản nào sắp đến hạn trong vài ngày tới.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════════════
            TẦNG 3: BỨC TRANH NHỊP SỐNG
            ═════════════════════════════════════════════════════════════════════════ */}
        <div>
          <div className="dash-section-head dash-section-head--spaced">
            <span className="dash-section-head__title">Bức tranh nhịp sống</span>
            <span className="dash-section-head__sub">tháng {month} và 30 ngày qua</span>
          </div>

          <div className="dash-bottom-grid">
            {/* KHỐI TRÁI: CHI TIÊU THÁNG (so với tháng trước) */}
            <div className="dash-budget-card">
              <div className="dash-budget-card__head">
                <div className="dash-budget-card__title-box">
                  <span className="dash-budget-card__title">Chi tiêu tháng {month}</span>
                  <span className="dash-budget-card__main-num">
                    {spend.spent.toLocaleString('vi-VN')}
                    <span className="dash-budget-card__main-limit">
                      {' ₫'}
                      {vsPrevPct != null && ` · ${vsPrevPct > 0 ? '+' : ''}${vsPrevPct}% so cùng kỳ T${spend.prevMonth}`}
                    </span>
                  </span>
                </div>

                <div className="dash-budget-card__stats-box">
                  <div className="dash-budget-stat-item">
                    <span className="dash-budget-stat-item__label">Cùng kỳ tháng {spend.prevMonth}</span>
                    <span className="dash-budget-stat-item__val">{spend.prevToDate.toLocaleString('vi-VN')}</span>
                  </div>
                  <div
                    className="dash-budget-stat-item"
                    title={`Cố định ${money(forecast.fixed)} (đã trả + còn đến hạn trong tháng) + chi biến đổi theo nhịp hiện tại`}
                  >
                    <span className="dash-budget-stat-item__label">Dự kiến cuối tháng</span>
                    <span className={`dash-budget-stat-item__val ${prevMonthTotal > 0 && forecast.projected > prevMonthTotal ? 'dash-budget-stat-item__val--warn' : ''}`}>
                      {compactMoney(forecast.projected)}
                      {prevMonthTotal > 0 && ` · T${spend.prevMonth} ${compactMoney(prevMonthTotal)}`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="dash-budget-chart-box">
                <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none" className="dash-budget-svg" aria-hidden="true">
                  <path d={chart.grid} className="dash-chart-path dash-chart-path--grid" vectorEffect="non-scaling-stroke" />
                  {chart.prev && <path d={chart.prev} className="dash-chart-path dash-chart-path--prev" vectorEffect="non-scaling-stroke" />}
                  {chart.area && <path d={chart.area} className="dash-chart-path--area" />}
                  <path d={chart.proj} className="dash-chart-path dash-chart-path--proj" vectorEffect="non-scaling-stroke" />
                  {chart.line && <path d={chart.line} className="dash-chart-path dash-chart-path--line" vectorEffect="non-scaling-stroke" />}
                </svg>

                {chart.prev && (
                  <span className="dash-chart-prev-tag" style={{ top: chart.prevTop }}>
                    T{spend.prevMonth} {compactMoney(prevMonthTotal)}
                  </span>
                )}
                <span className="dash-chart-proj-tag" style={{ top: chart.projTop }}>{compactMoney(forecast.projected)}</span>
                <span className="dash-chart-dot" style={{ left: chart.dotLeft, top: chart.dotTop }} />
                <span className="dash-chart-tooltip" style={{ left: chart.dotLeft, top: chart.dotTop }}>
                  {compactMoney(spend.spent)}
                </span>
              </div>

              <div className="dash-chart-ticks">
                {chart.ticks.map((tk) => (
                  <span
                    key={`${tk.d}-${tk.isToday ? 'today' : 'tick'}`}
                    className={`dash-chart-tick dash-chart-tick--${tk.align} ${tk.isToday ? 'dash-chart-tick--today' : ''}`}
                    style={{ left: tk.left }}
                  >
                    {tk.label}
                  </span>
                ))}
              </div>

              <div className="dash-chart-legend">
                <span className="dash-chart-legend__item">
                  <span className="dash-legend-swatch dash-legend-swatch--line" />
                  <span>Tháng {month} cộng dồn</span>
                </span>
                {chart.prev && (
                  <span className="dash-chart-legend__item">
                    <span className="dash-legend-swatch dash-legend-swatch--prev" />
                    <span>Tháng {spend.prevMonth}</span>
                  </span>
                )}
                <span className="dash-chart-legend__item">
                  <span className="dash-legend-swatch dash-legend-swatch--proj" />
                  <span>Dự kiến</span>
                </span>
              </div>

              <div className="dash-budget-cats-grid">
                {spendCats.length > 0 ? spendCats.map((c) => (
                  <div
                    key={c.key}
                    className={`dash-budget-cat-item dash-budget-cat--${c.deltaPct == null ? 'none' : c.deltaPct > 0 ? 'warn' : 'ok'}`}
                    title={`Cùng kỳ tháng ${spend.prevMonth}: ${money(c.prevSpent)}`}
                  >
                    <div className="dash-budget-cat-head">
                      <span className="dash-budget-cat-name">{c.label}</span>
                      <span className="dash-budget-cat-pct">{c.share}%</span>
                    </div>
                    <span className="dash-progress-track">
                      <span className="dash-progress-bar dash-budget-cat-bar" style={{ width: `${(c.share / maxCatShare) * 100}%` }} />
                    </span>
                    <span className="dash-budget-cat-val">
                      {compactMoney(c.spent)}
                      {c.deltaPct == null ? ' · mới' : ` · ${c.deltaPct > 0 ? '▲' : c.deltaPct < 0 ? '▼' : '='} ${Math.abs(c.deltaPct)}%`}
                    </span>
                  </div>
                )) : (
                  <div className="dash-card-empty dash-budget-cats-empty">
                    {finReady ? 'Chưa có khoản chi nào trong tháng này.' : 'Đang tải…'}
                  </div>
                )}
              </div>
            </div>

            {/* KHỐI PHẢI: LỊCH THANH TOÁN */}
            <div className="dash-calendar-card">
              <div className="dash-card__head">
                <span className="dash-card__title">Lịch thanh toán tháng {month}</span>
                <span className="dash-card__meta">{calendar.paidCount}/{calendar.totalCount} đã trả</span>
              </div>

              <div className="dash-calendar-grid">
                {SHORT_WEEKDAYS.map((w) => (
                  <span key={w} className="dash-calendar-weekday">{w}</span>
                ))}
                {calendar.cells.map((cell, idx) => (cell ? (
                  <div
                    key={idx}
                    title={cell.items.map(i => `${i.name}: ${money(i.amount)}`).join('\n')}
                    className={[
                      'dash-cal-cell',
                      cell.status ? `dash-cal-cell--${cell.status}` : '',
                      cell.day === day ? 'is-today' : '',
                      cell.day < day ? 'is-past' : '',
                    ].join(' ')}
                  >
                    <span className="dash-cal-cell__day">{cell.day}</span>
                    <span className="dash-cal-cell__amt">{cell.items.length ? compactMoney(cell.amount) : ''}</span>
                  </div>
                ) : <span key={idx} className="dash-cal-cell dash-cal-cell--blank" aria-hidden="true" />))}
              </div>

              <div className="dash-cal-footer">
                <span className="dash-cal-footer__left">
                  {calendar.totalCount > 0
                    ? <>Còn phải trả <strong>{money(calendar.leftAmount)}</strong></>
                    : 'Chưa có khoản định kỳ nào đến hạn trong tháng.'}
                </span>
                <div className="dash-cal-legends">
                  {CAL_LEGEND.map(([key, label]) => (
                    <span key={key} className="dash-cal-legend-item">
                      <span className={`dash-cal-legend-box dash-cal-cell--${key}`} />
                      <span>{label}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 5 ô phân hệ — số liệu thật, chưa có thì hiện "—" chứ không bịa */}
          <div className="dash-modules-grid">
            <Link to="/tasks" className="dash-mod-card dash-mod--tasks">
              <div className="dash-mod-card__top">
                <span className="dash-mod-card__icon-box"><AppIcon name="pushPin" size={15} weight="fill" /></span>
                <span className="dash-mod-card__name">Nhiệm Vụ</span>
                <AppIcon name="arrowUpRight" size={14} className="dash-mod-card__arrow" />
              </div>
              <div className="dash-mod-card__main-stat">
                <span className="dash-mod-card__big-num">
                  {taskStats ? taskStats.done : '—'}<span className="dash-mod-card__big-unit"> việc xong</span>
                </span>
                <span className="dash-mod-card__sub-stat">
                  14 ngày{taskStats?.onTimePct != null ? ` · ${taskStats.onTimePct}% đúng hạn` : ''}
                </span>
              </div>
              <SparkBars values={taskStats?.bars || Array(14).fill(0)} tone="tasks" />
            </Link>

            <Link to="/finance" className="dash-mod-card dash-mod--finance">
              <div className="dash-mod-card__top">
                <span className="dash-mod-card__icon-box"><AppIcon name="wallet" size={15} weight="fill" /></span>
                <span className="dash-mod-card__name">Tài Chính</span>
                <AppIcon name="arrowUpRight" size={14} className="dash-mod-card__arrow" />
              </div>
              <div className="dash-mod-card__main-stat">
                <span className="dash-mod-card__big-num">
                  {finReady ? compactMoney(spendStats.avgPerDay) : '—'}<span className="dash-mod-card__big-unit"> / ngày</span>
                </span>
                <span className="dash-mod-card__sub-stat">
                  chi trung bình{spendStats.prevAvgPerDay != null ? ` · tháng ${prevMonthNum} là ${compactMoney(spendStats.prevAvgPerDay)}` : ' tháng này'}
                </span>
              </div>
              <SparkBars values={spendStats.bars} tone="finance" />
            </Link>

            <Link to="/body" className="dash-mod-card dash-mod--body">
              <div className="dash-mod-card__top">
                <span className="dash-mod-card__icon-box"><AppIcon name="heart" size={15} weight="fill" /></span>
                <span className="dash-mod-card__name">Body</span>
                <AppIcon name="arrowUpRight" size={14} className="dash-mod-card__arrow" />
              </div>
              <div className="dash-mod-card__main-stat">
                <span className="dash-mod-card__big-num">
                  {weight.latest != null ? weight.latest.toLocaleString('vi-VN') : '—'}<span className="dash-mod-card__big-unit"> kg</span>
                </span>
                <span className="dash-mod-card__sub-stat">
                  {weight.latest == null ? 'chưa có lần cân nào'
                    : weight.goal == null ? 'chưa đặt cân nặng mục tiêu'
                      : weight.toGoal === 0 ? `đã đạt mục tiêu ${weight.goal.toLocaleString('vi-VN')} kg`
                        : `còn ${Math.abs(weight.toGoal).toLocaleString('vi-VN')} kg tới ${weight.goal.toLocaleString('vi-VN')} kg`}
                </span>
              </div>
              <WeightSpark points={weight.points} goal={weight.goal} />
            </Link>

            <Link to="/collect" className="dash-mod-card dash-mod--knowledge">
              <div className="dash-mod-card__top">
                <span className="dash-mod-card__icon-box"><AppIcon name="brain" size={15} weight="fill" /></span>
                <span className="dash-mod-card__name">Knowledge</span>
                <AppIcon name="arrowUpRight" size={14} className="dash-mod-card__arrow" />
              </div>
              <div className="dash-mod-card__main-stat">
                <span className="dash-mod-card__big-num">
                  {knowledgeStats ? knowledgeStats.total : '—'}<span className="dash-mod-card__big-unit"> ghi chú</span>
                </span>
                <span className="dash-mod-card__sub-stat">
                  {knowledge ? `+${knowledge.thisWeek} tuần này` : 'đang tải…'}
                </span>
              </div>
              <SparkBars values={knowledge?.bars || Array(8).fill(0)} tone="knowledge" />
            </Link>

            {/* Vault mã hóa đầu-cuối: chưa mở khóa thì app không đọc được số mục hay hạn giấy tờ. */}
            <Link to="/accounts" className="dash-mod-card dash-mod--vault">
              <div className="dash-mod-card__top">
                <span className="dash-mod-card__icon-box"><AppIcon name="lock" size={15} weight="fill" /></span>
                <span className="dash-mod-card__name">Vault</span>
                <AppIcon name="arrowUpRight" size={14} className="dash-mod-card__arrow" />
              </div>
              <div className="dash-mod-card__main-stat">
                <span className="dash-mod-card__big-num dash-mod-card__big-num--text">Đã mã hóa</span>
                <span className="dash-mod-card__sub-stat">Mở khóa để xem mục và hạn giấy tờ</span>
              </div>
              <div className="dash-vault-preview">
                <div className="dash-vault-preview-row">
                  <span>Mã hóa trên máy trước khi lưu</span>
                  <AppIcon name="lock" size={12} className="dash-vault-preview-date" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* ── POPUP CHI TIẾT NHIỆM VỤ (TaskDetailModal) ───────────────────── */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onEdit={() => {
            setSelectedTask(null);
            navigate('/tasks');
          }}
          onComplete={async (task) => {
            const tId = typeof task === 'object' && task?.id ? task.id : task;
            const ok = await completeTask(tId);
            showToast(ok ? 'Đã hoàn thành nhiệm vụ' : 'Không thể hoàn thành nhiệm vụ. Thử lại sau.',
              { icon: ok ? 'checkCircle' : 'warning' });
            if (ok) setSelectedTask(null);
          }}
          onDelete={async (task) => {
            const tId = typeof task === 'object' && task?.id ? task.id : task;
            const ok = await taskModel.deleteTask(tId);
            showToast(ok ? 'Đã xóa nhiệm vụ' : 'Không thể xóa nhiệm vụ. Thử lại sau.',
              { icon: ok ? 'trash' : 'warning' });
            setSelectedTask(null);
          }}
          onUpdatePriority={async (newPri) => {
            if (selectedTask?.id) {
              await taskModel.updateTask(selectedTask.id, { priority: newPri });
              setSelectedTask((prev) => (prev ? { ...prev, priority: newPri } : prev));
            }
          }}
          taskModel={taskModel}
          onOpenTask={(taskToOpen) => setSelectedTask(taskToOpen)}
        />
      )}

      {ConfirmModal}
    </div>
  );
}
