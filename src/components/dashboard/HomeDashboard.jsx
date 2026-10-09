import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useUserTasks } from '../../hooks/useUserTasks';
import { useFinance } from '../../hooks/useFinance';
import { useWorkouts } from '../../hooks/useWorkouts';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../ConfirmModal';
import { collectSystemAlerts } from '../../utils/dashboardAlerts';
import { solarToLunar, getCanChiYear } from '../../utils/lunarUtils';
import { currentMonthPeriod, periodTotals } from '../../utils/financeLogic';
import { money } from '../finance/parts';
import TaskDetailModal from '../TaskDetailModal';
import AppIcon from '../AppIcon';
import '../../styles/dashboard.css';

const VN_WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const OVERDUE_PREVIEW = 3;
const HEADS_UP_PREVIEW = 5;

// Lối tắt 5 module — màu đi theo class `--tone` (token theme), không viết hex ở JSX.
const MODULES = [
  { to: '/tasks', icon: 'pushPin', name: 'Nhiệm Vụ', tone: 'tasks' },
  { to: '/finance', icon: 'wallet', name: 'Tài Chính', tone: 'finance' },
  { to: '/body', icon: 'barbell', name: 'Body', tone: 'body' },
  { to: '/collect', icon: 'brain', name: 'Knowledge', tone: 'knowledge' },
  { to: '/accounts', icon: 'lock', name: 'Vault', tone: 'vault' },
];

/** Hàng bấm được bằng chuột lẫn bàn phím; phím bấm trên nút con không kích hoạt hàng. */
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

function AlertRow({ item, tone, onOpen, openTitle, children }) {
  return (
    <div className={`dash-alert-row dash-alert-row--${tone} dash-alert-row--clickable`} {...activateProps(onOpen, openTitle)}>
      <div className="dash-alert-row__icon-wrap">
        <AppIcon name={item.icon} size={18} weight="fill" />
      </div>
      <div className="dash-alert-row__main">
        <span className="dash-alert-row__title">{item.title}</span>
        <span className="dash-alert-row__subtitle">{item.subtitle}</span>
      </div>
      <div className="dash-alert-row__badge-box">
        <span className="dash-alert-row__badge">{item.badge}</span>
        {item.amount != null && <span className="dash-alert-row__amount">{money(item.amount)}</span>}
      </div>
      <div className="dash-alert-row__actions">{children}</div>
    </div>
  );
}

export default function HomeDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { confirm, ConfirmModal } = useConfirm();

  const taskModel = useUserTasks();
  const { tasks, todayTasks, completeTask, rolloverTask, addTask } = taskModel;

  const fin = useFinance();
  const { bills, cards, loans, lendings, deposits, budgets, transactions, cats, today } = fin;

  const { activeRoutine, routineItems, sessions, exerciseMap, hasLoaded: workoutsLoaded } = useWorkouts();

  const [selectedTask, setSelectedTask] = useState(null);
  const [expandedOverdueTasks, setExpandedOverdueTasks] = useState(false);
  const [expandedHeadsUp, setExpandedHeadsUp] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');

  // Đồng hồ trang chủ: tab để mở qua đêm thì lời chào, ngày và lịch tập phải tự sang
  // ngày mới (`today` của các hook cũng tính lại ở mỗi lần render này).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const day = now.getDate(), month = now.getMonth() + 1, year = now.getFullYear();
  const solarDateStr = `${VN_WEEKDAYS[now.getDay()]}, ${day}/${month}/${year}`;
  const lunar = useMemo(() => {
    try {
      return solarToLunar(day, month, year);
    } catch {
      return null;
    }
  }, [day, month, year]);

  // Tên hiển thị sửa ở Settings nằm ở `profiles`; metadata chỉ là bản lúc đăng ký.
  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || '';

  // Chưa tải xong thì CHƯA BIẾT — frame đầu các mảng còn rỗng, không được nói "đúng hạn".
  const isReady = (!fin.enabled || fin.hasLoaded) && taskModel.hasLoaded;
  const finError = fin.error;

  const alerts = useMemo(() => collectSystemAlerts({
    tasks, bills, cards, loans, lendings, deposits, budgets, transactions, cats, today,
  }), [tasks, bills, cards, loans, lendings, deposits, budgets, transactions, cats, today]);

  const criticalFinance = useMemo(() => alerts.critical.filter(a => a.domain !== 'task'), [alerts.critical]);
  const overdueTasks = useMemo(() => alerts.critical.filter(a => a.domain === 'task'), [alerts.critical]);
  const dueTodayFinance = useMemo(() => alerts.dueToday.filter(a => a.domain !== 'task'), [alerts.dueToday]);
  // Task đến hạn hôm nay đã có ở card "Nhiệm vụ hôm nay" — không lặp lại trong khối gấp.
  const urgentCount = criticalFinance.length + dueTodayFinance.length + overdueTasks.length;
  const overdueCount = criticalFinance.length + overdueTasks.length;
  const allClear = isReady && !finError && urgentCount === 0;

  const monthBudget = useMemo(() => {
    const totals = periodTotals(transactions, currentMonthPeriod(today));
    const limit = (budgets || []).reduce((sum, b) => sum + (b.limit_amount || 0), 0);
    return {
      spent: totals.total,
      limit,
      // % thật để đọc (chi 150% là 150%); chỉ thanh tiến độ mới chặn ở 100.
      pct: limit > 0 ? Math.round((totals.total / limit) * 100) : 0,
      isExceeded: limit > 0 && totals.total > limit,
    };
  }, [transactions, budgets, today]);

  // ── Body hôm nay ──
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
  // body_routine_items chỉ lưu `exercise_key`; tên bài nằm trong exerciseMap (built-in + custom).
  const exerciseName = (item) => exerciseMap?.get(item.exercise_key)?.name || item.exercise_key;

  // ── Hành động ──
  const openFinance = (alert) => navigate(
    alert.targetUrl || '/finance',
    alert.targetSeg ? { state: { recurringSeg: alert.targetSeg } } : undefined,
  );

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
    if (overdueTasks.length === 0) return;
    const results = await Promise.all(overdueTasks.map(item => rolloverTask(item.raw.id)));
    const moved = results.filter(Boolean).length;
    const failed = results.length - moved;
    showToast(failed === 0
      ? `Đã dời ${moved} nhiệm vụ quá hạn sang hôm nay`
      : `Đã dời ${moved}/${results.length} nhiệm vụ — ${failed} việc chưa dời được, thử lại sau.`,
    { icon: failed ? 'warning' : 'calendar' });
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

  const visibleOverdueTasks = expandedOverdueTasks ? overdueTasks : overdueTasks.slice(0, OVERDUE_PREVIEW);
  const headsUp = alerts.headsUp;
  const visibleHeadsUp = expandedHeadsUp ? headsUp : headsUp.slice(0, HEADS_UP_PREVIEW);

  return (
    <div className="dash-workspace">
      {/* ── HEADER CỐ ĐỊNH (Pinned Header) ────────────────────────────── */}
      <header className="dash-header">
        <div className="dash-header__left">
          <div className="dash-header__greeting">
            <AppIcon name="sparkle" size={20} weight="duotone" />
            <span>{greeting}{displayName ? `, ${displayName}` : ''}</span>
          </div>
          <div className="dash-header__date-meta">
            <span>{solarDateStr}</span>
            {lunar && (
              <span className="dash-header__lunar-badge">
                {lunar.day}/{lunar.month}{lunar.leap ? ' (nhuận)' : ''} âm lịch, năm {getCanChiYear(lunar.year)}
              </span>
            )}
          </div>
        </div>

        <div className="dash-header__right">
          {!isReady ? (
            <div className="dash-status dash-status--muted" role="status">
              <AppIcon name="arrowsClockwise" size={16} />
              <span>Đang kiểm tra hạn chót…</span>
            </div>
          ) : urgentCount > 0 ? (
            <div className="dash-status dash-status--urgent" role="status">
              <span className="dash-status__pulse" aria-hidden="true" />
              <span>{urgentCount} mục cần xử lý</span>
            </div>
          ) : finError ? (
            <div className="dash-status dash-status--warn" role="status">
              <AppIcon name="warning" size={16} weight="fill" />
              <span>Chưa kiểm tra được Tài chính</span>
            </div>
          ) : (
            <div className="dash-status dash-status--ok" role="status">
              <AppIcon name="shieldCheck" size={16} weight="fill" />
              <span>Mọi thứ đúng hạn</span>
            </div>
          )}
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
            TẦNG 1: 🚨 CẦN XỬ LÝ NGAY (khoản tài chính quá hạn/đến hạn + task quá hạn)
            ═════════════════════════════════════════════════════════════════════════ */}
        {!isReady ? (
          <div className="dash-loading" role="status">
            <AppIcon name="arrowsClockwise" size={18} />
            <span>Đang tải nhiệm vụ và nghĩa vụ tài chính…</span>
          </div>
        ) : urgentCount > 0 ? (
          <section className="dash-critical-box" aria-label="Nghĩa vụ và công việc cần xử lý ngay">
            <div className="dash-critical-box__head">
              <div className="dash-critical-box__title">
                <AppIcon name="warning" size={18} weight="fill" />
                <span>Cần xử lý ngay ({urgentCount})</span>
              </div>
              <span className="dash-critical-box__count">
                {overdueCount > 0 ? `${overdueCount} quá hạn` : 'Đến hạn hôm nay'}
              </span>
            </div>

            <div className="dash-critical-list">
              {/* ── 1. Nghĩa vụ Tài chính quá hạn ── */}
              {criticalFinance.length > 0 && (
                <>
                  <div className="dash-alert-subhead">
                    <span>Nghĩa vụ tài chính quá hạn ({criticalFinance.length})</span>
                  </div>
                  {criticalFinance.map(item => (
                    <AlertRow key={item.id} item={item} tone="critical"
                      onOpen={() => openFinance(item)} openTitle="Mở màn Định kỳ để xử lý">
                      <button type="button" className="dash-btn dash-btn--danger"
                        onClick={(e) => { e.stopPropagation(); openFinance(item); }}>
                        {item.actionLabel}
                      </button>
                      {item.actionType === 'bill_pay' && (
                        <button type="button" className="dash-btn dash-btn--secondary"
                          onClick={(e) => { e.stopPropagation(); handleSkipBill(item); }}>
                          Bỏ kỳ
                        </button>
                      )}
                    </AlertRow>
                  ))}
                </>
              )}

              {/* ── 2. Tài chính đến hạn hôm nay / cần xử lý hôm nay ── */}
              {dueTodayFinance.length > 0 && (
                <>
                  <div className="dash-alert-subhead">
                    <span>Tài chính đến hạn hôm nay ({dueTodayFinance.length})</span>
                  </div>
                  {dueTodayFinance.map(item => (
                    <AlertRow key={item.id} item={item} tone="today"
                      onOpen={() => openFinance(item)} openTitle="Mở màn Định kỳ để xử lý">
                      <button type="button" className="dash-btn dash-btn--primary"
                        onClick={(e) => { e.stopPropagation(); openFinance(item); }}>
                        {item.actionLabel}
                      </button>
                    </AlertRow>
                  ))}
                </>
              )}

              {/* ── 3. Nhiệm vụ quá hạn (thu gọn nếu > 3 việc) ── */}
              {overdueTasks.length > 0 && (
                <>
                  <div className="dash-alert-subhead">
                    <span>Nhiệm vụ quá hạn ({overdueTasks.length})</span>
                    {overdueTasks.length > 1 && (
                      <button
                        type="button"
                        className="dash-btn dash-btn--secondary dash-btn--sm"
                        onClick={handleRolloverAll}
                        title="Chuyển toàn bộ task quá hạn sang hôm nay"
                      >
                        <AppIcon name="calendar" size={12} /> Dời tất cả sang hôm nay
                      </button>
                    )}
                  </div>

                  {visibleOverdueTasks.map(item => (
                    <AlertRow key={item.id} item={item} tone="critical"
                      onOpen={() => setSelectedTask(item.raw)} openTitle="Bấm để mở xem chi tiết nhiệm vụ">
                      <button type="button" className="dash-btn dash-btn--success" title="Hoàn thành task này"
                        onClick={(e) => { e.stopPropagation(); handleCompleteTask(item.raw); }}>
                        <AppIcon name="check" size={14} /> Xong
                      </button>
                      <button type="button" className="dash-btn dash-btn--secondary" title="Dời task sang hôm nay"
                        onClick={(e) => { e.stopPropagation(); handleRolloverTask(item.raw); }}>
                        Dời hôm nay
                      </button>
                    </AlertRow>
                  ))}

                  {overdueTasks.length > OVERDUE_PREVIEW && (
                    <button
                      type="button"
                      className="dash-expand-btn"
                      onClick={() => setExpandedOverdueTasks(!expandedOverdueTasks)}
                    >
                      <AppIcon name={expandedOverdueTasks ? 'caretUp' : 'caretDown'} size={14} />
                      <span>
                        {expandedOverdueTasks
                          ? 'Thu gọn về Top 3 việc gấp'
                          : `Xem thêm ${overdueTasks.length - OVERDUE_PREVIEW} nhiệm vụ quá hạn khác`}
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>
          </section>
        ) : allClear ? (
          <div className="dash-all-clear">
            <div className="dash-all-clear__icon">
              <AppIcon name="checkCircle" size={24} weight="fill" />
            </div>
            <div>
              <div className="dash-all-clear__title">Tuyệt vời! Không có việc nào bị quá hạn</div>
              <div className="dash-all-clear__sub">
                Toàn bộ hóa đơn, thẻ tín dụng, khoản vay và deadline nhiệm vụ đều đang đúng hạn.
              </div>
            </div>
          </div>
        ) : null}

        {/* ═════════════════════════════════════════════════════════════════════════
            TẦNG 2: 🎯 TIÊU ĐIỂM HÔM NAY (Today Pulse Safe Grid)
            ═════════════════════════════════════════════════════════════════════════ */}
        <div className="dash-today-grid">
          {/* Card 1: Checklist Việc hôm nay */}
          <section className="dash-card">
            <div className="dash-card__head">
              <div className="dash-card__title">
                <AppIcon name="pushPin" size={16} weight="fill" />
                <span>Nhiệm vụ hôm nay ({todayTasks.length})</span>
              </div>
              <Link to="/tasks" className="dash-card__link">
                Xem tất cả <AppIcon name="caretRight" size={12} />
              </Link>
            </div>
            <div className="dash-card__body">
              {!taskModel.hasLoaded ? (
                <div className="dash-card-empty">
                  <span>Đang tải nhiệm vụ…</span>
                </div>
              ) : todayTasks.length > 0 ? (
                todayTasks.map(t => (
                  <div key={t.id} className="dash-task-item" {...activateProps(() => setSelectedTask(t), 'Bấm để mở xem chi tiết')}>
                    <button
                      type="button"
                      className="dash-task-check"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCompleteTask(t);
                      }}
                      aria-label={`Hoàn thành ${t.title}`}
                    >
                      <AppIcon name="check" size={12} weight="bold" />
                    </button>
                    <span className="dash-task-item__title">{t.title}</span>
                    {t.due_time && <span className="dash-task-item__time">{String(t.due_time).slice(0, 5)}</span>}
                  </div>
                ))
              ) : (
                <div className="dash-card-empty">
                  <AppIcon name="checkCircle" size={24} weight="duotone" />
                  <span>Chưa có việc nào hẹn cho hôm nay.</span>
                </div>
              )}

              <form onSubmit={handleQuickAdd} className="dash-quick-add">
                <input
                  type="text"
                  className="dash-quick-input"
                  placeholder="+ Thêm nhanh việc hôm nay, Enter để lưu"
                  aria-label="Thêm nhanh việc hôm nay"
                  value={quickTitle}
                  onChange={e => setQuickTitle(e.target.value)}
                />
              </form>
            </div>
          </section>

          {/* Card 2: Lịch tập Body hôm nay */}
          <section className="dash-card">
            <div className="dash-card__head">
              <div className="dash-card__title">
                <AppIcon name="barbell" size={16} weight="fill" />
                <span>Thể hình & Sức khỏe</span>
              </div>
              <Link to="/body" className="dash-card__link">
                Vào Body <AppIcon name="caretRight" size={12} />
              </Link>
            </div>
            <div className="dash-card__body">
              {!workoutsLoaded ? (
                <div className="dash-card-empty">
                  <span>Đang tải lịch tập…</span>
                </div>
              ) : inProgressSession ? (
                /* ── 1. ĐANG TẬP DỞ (chỉ buổi của hôm nay) ── */
                <div className="dash-workout-banner dash-workout-banner--live">
                  <div className="dash-workout-banner__name">
                    <span className="dash-workout-banner__live-name">
                      <span className="dash-workout-banner__dot" aria-hidden="true" />
                      {inProgressSession.day_type || inProgressSession.title || 'Buổi tập đang diễn ra'}
                    </span>
                    <span className="dash-workout-banner__badge">Đang tập dở</span>
                  </div>
                  <span className="dash-workout-exercises">
                    Buổi tập hôm nay chưa xong — tiếp tục trước 23:59 để giữ tiến độ.
                  </span>
                  <button type="button" className="dash-btn dash-btn--warn dash-btn--block"
                    onClick={() => navigate('/body/session')}>
                    <AppIcon name="play" size={14} weight="fill" /> Tiếp tục buổi tập
                  </button>
                </div>
              ) : todayCompletedSession ? (
                /* ── 2. ĐÃ HOÀN THÀNH ── */
                <div className="dash-workout-banner dash-workout-banner--done">
                  <div className="dash-workout-banner__name">
                    <span>{todayCompletedSession.day_type || todayCompletedSession.title || 'Đã hoàn thành buổi tập!'}</span>
                    <span className="dash-workout-banner__badge">Xong</span>
                  </div>
                  <span className="dash-workout-exercises">
                    {todayCompletedSession.duration_seconds
                      ? `Thời gian tập: ~${Math.max(1, Math.round(todayCompletedSession.duration_seconds / 60))} phút.`
                      : 'Bạn đã hoàn thành buổi tập hôm nay.'}
                  </span>
                  <button type="button" className="dash-btn dash-btn--secondary dash-btn--block"
                    onClick={() => navigate('/body/history')}>
                    <AppIcon name="trophy" size={14} /> Xem lại tiến bộ
                  </button>
                </div>
              ) : todayRoutineItems.length > 0 ? (
                /* ── 3. CHƯA TẬP, CÓ LỊCH HÔM NAY ── */
                <div className="dash-workout-banner">
                  <div className="dash-workout-banner__name">
                    <span>{todayRoutineItems[0]?.day_name || activeRoutine?.name || 'Lịch tập hôm nay'}</span>
                    <span className="dash-workout-banner__badge">{todayRoutineItems.length} bài tập</span>
                  </div>
                  <div className="dash-workout-exercises">
                    {todayRoutineItems.slice(0, 4).map((item, idx) => `${idx + 1}. ${exerciseName(item)}`).join(' · ')}
                    {todayRoutineItems.length > 4 && ` · +${todayRoutineItems.length - 4} bài khác`}
                  </div>
                  <button type="button" className="dash-btn dash-btn--primary dash-btn--block"
                    onClick={() => navigate('/body')}>
                    <AppIcon name="play" size={14} weight="fill" /> Bắt đầu buổi tập
                  </button>
                </div>
              ) : activeRoutine ? (
                /* ── 4. NGÀY NGHỈ PHỤC HỒI (Rest Day) ── */
                <div className="dash-card-empty">
                  <AppIcon name="sparkle" size={24} weight="duotone" />
                  <span>Hôm nay là ngày nghỉ phục hồi.</span>
                  <span className="dash-card-empty__hint">Lộ trình: {activeRoutine.name}</span>
                  <button type="button" className="dash-btn dash-btn--secondary"
                    onClick={() => navigate('/body/routine')}>
                    Xem lộ trình tập
                  </button>
                </div>
              ) : (
                /* ── 5. CHƯA CÓ LỘ TRÌNH ── */
                <div className="dash-card-empty">
                  <AppIcon name="barbell" size={24} weight="duotone" />
                  <span>Chưa có lộ trình tập luyện nào.</span>
                  <button type="button" className="dash-btn dash-btn--secondary"
                    onClick={() => navigate('/body/routine')}>
                    Tạo lộ trình tập
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Card 3: Sắp tới hạn (Heads-Up) */}
          <section className="dash-card">
            <div className="dash-card__head">
              <div className="dash-card__title">
                <AppIcon name="calendar" size={16} weight="fill" />
                <span>Sắp tới hạn ({headsUp.length})</span>
              </div>
              <Link to="/finance/recurring" className="dash-card__link">
                Định kỳ <AppIcon name="caretRight" size={12} />
              </Link>
            </div>
            <div className="dash-card__body">
              {!isReady ? (
                <div className="dash-card-empty">
                  <span>Đang tải…</span>
                </div>
              ) : headsUp.length > 0 ? (
                <>
                  {visibleHeadsUp.map(item => (
                    <div
                      key={item.id}
                      className="dash-headsup-item"
                      {...activateProps(
                        () => (item.domain === 'task' ? setSelectedTask(item.raw) : openFinance(item)),
                        item.domain === 'task' ? 'Bấm để mở xem chi tiết nhiệm vụ' : 'Mở màn Định kỳ',
                      )}
                    >
                      <div className="dash-headsup-item__left">
                        <AppIcon name={item.icon} size={15} />
                        <div className="dash-headsup-item__text">
                          <span className="dash-headsup-item__title">{item.title}</span>
                          <span className="dash-headsup-item__sub">{item.subtitle}</span>
                        </div>
                      </div>
                      <div className="dash-headsup-item__right">
                        <span className="dash-headsup-item__badge">{item.badge}</span>
                        {item.amount != null && <span className="dash-headsup-item__amount">{money(item.amount)}</span>}
                      </div>
                    </div>
                  ))}
                  {headsUp.length > HEADS_UP_PREVIEW && (
                    <button type="button" className="dash-expand-btn dash-expand-btn--inline"
                      onClick={() => setExpandedHeadsUp(!expandedHeadsUp)}>
                      <AppIcon name={expandedHeadsUp ? 'caretUp' : 'caretDown'} size={14} />
                      <span>{expandedHeadsUp ? 'Thu gọn' : `Xem thêm ${headsUp.length - HEADS_UP_PREVIEW} mục khác`}</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="dash-card-empty">
                  <AppIcon name="checkCircle" size={24} weight="duotone" />
                  <span>Không có việc hay khoản nào sắp đến hạn trong vài ngày tới.</span>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ═════════════════════════════════════════════════════════════════════════
            TẦNG 3: 📊 BỨC TRANH TOÀN CẢNH (Life Metrics & Quick Jump Hub)
            ═════════════════════════════════════════════════════════════════════════ */}
        <div className="dash-bottom-grid">
          {/* Widget Ngân sách tháng */}
          <div className="dash-budget-widget">
            <div className="dash-budget-widget__head">
              <div className="dash-budget-widget__title">
                <AppIcon name="wallet" size={17} weight="fill" />
                <span>Tiến độ ngân sách tháng {month}/{year}</span>
              </div>
              <div className="dash-budget-widget__figures">
                <span className="dash-budget-widget__spent">{money(monthBudget.spent)}</span>
                <span className="dash-budget-widget__limit">
                  {monthBudget.limit > 0 ? `/ ${money(monthBudget.limit)}` : '(Chưa đặt hạn mức)'}
                </span>
              </div>
            </div>

            <div className="dash-budget-bar">
              <div
                className={`dash-budget-bar__fill ${monthBudget.isExceeded ? 'dash-budget-bar__fill--warn' : ''}`}
                style={{ width: `${Math.min(100, monthBudget.pct)}%` }}
              />
            </div>

            {alerts.overBudget.length > 0 && (
              <ul className="dash-overbudget">
                {alerts.overBudget.map(item => (
                  <li key={item.id}>
                    <AppIcon name="warning" size={13} weight="fill" />
                    <span>{item.title}</span>
                    <strong>+{money(item.amount)}</strong>
                  </li>
                ))}
              </ul>
            )}

            <div className="dash-budget-widget__foot">
              <span>
                Đã sử dụng: <strong className={monthBudget.isExceeded ? 'dash-text-danger' : undefined}>{monthBudget.pct}%</strong>
              </span>
              <Link to="/finance/overview" className="dash-card__link">
                Chi tiết báo cáo <AppIcon name="caretRight" size={12} />
              </Link>
            </div>
          </div>

          {/* Lối tắt 5 Module chính */}
          <div className="dash-modules-grid">
            {MODULES.map(m => (
              <Link key={m.to} to={m.to} className={`dash-module-btn dash-module-btn--${m.tone}`}>
                <div className="dash-module-btn__icon">
                  <AppIcon name={m.icon} size={20} weight="fill" />
                </div>
                <span className="dash-module-btn__name">{m.name}</span>
              </Link>
            ))}
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
