import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useUserTasks } from '../../hooks/useUserTasks';
import { useFinance } from '../../hooks/useFinance';
import { useWorkouts } from '../../hooks/useWorkouts';
import { useToast } from '../../contexts/ToastContext';
import { collectSystemAlerts } from '../../utils/dashboardAlerts';
import { solarToLunar } from '../../utils/lunarUtils';
import { currentMonthPeriod, periodTotals } from '../../utils/financeLogic';
import { money } from '../finance/parts';
import TaskDetailModal from '../TaskDetailModal';
import AppIcon from '../AppIcon';
import '../../styles/dashboard.css';

const VN_WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export default function HomeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const taskModel = useUserTasks();
  const { tasks, todayTasks, completeTask, rolloverTask, addTask } = taskModel;

  const fin = useFinance();
  const { bills, cards, loans, lendings, deposits, budgets, transactions, today } = fin;

  const workoutModel = useWorkouts();
  const { activeRoutine, routineItems, sessions } = workoutModel;

  // State xem chi tiết nhiệm vụ và thu gọn task quá hạn
  const [selectedTask, setSelectedTask] = useState(null);
  const [expandedOverdueTasks, setExpandedOverdueTasks] = useState(false);

  // Lời chào theo buổi
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  }, []);

  // Ngày dương & Ngày âm
  const now = useMemo(() => new Date(), []);
  const dayName = VN_WEEKDAYS[now.getDay()];
  const solarDateStr = `${dayName}, ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  const lunar = useMemo(() => {
    try {
      return solarToLunar(now.getDate(), now.getMonth() + 1, now.getFullYear());
    } catch {
      return null;
    }
  }, [now]);

  // Thu thập toàn bộ cảnh báo hệ thống (Zero-blindspots)
  const alerts = useMemo(() => {
    return collectSystemAlerts({
      tasks,
      bills,
      cards,
      loans,
      lendings,
      deposits,
      budgets,
      transactions,
      today,
    });
  }, [tasks, bills, cards, loans, lendings, deposits, budgets, transactions, today]);

  // Phân loại cảnh báo khẩn cấp: Nghĩa vụ tài chính & Nhiệm vụ quá hạn
  // Task đến hạn hôm nay (todayTasks) tập trung hiển thị tại Tầng 2 (Checklist Hôm nay), tránh trùng lặp
  const criticalFinance = useMemo(() => alerts.critical.filter(a => a.domain !== 'task'), [alerts.critical]);
  const criticalTasks = useMemo(() => alerts.critical.filter(a => a.domain === 'task'), [alerts.critical]);
  const dueTodayFinance = useMemo(() => alerts.dueToday.filter(a => a.domain !== 'task'), [alerts.dueToday]);

  const urgentCount = criticalFinance.length + dueTodayFinance.length + criticalTasks.length;
  const overdueCount = criticalFinance.length + criticalTasks.length;
  const dueFinanceCount = dueTodayFinance.length;

  // Ngân sách tháng hiện tại
  const monthBudget = useMemo(() => {
    const curMonth = currentMonthPeriod(today);
    const totals = periodTotals(transactions, curMonth);
    const totalLimit = (budgets || []).reduce((sum, b) => sum + (b.limit_amount || 0), 0);
    const pct = totalLimit > 0 ? Math.min(100, Math.round((totals.total / totalLimit) * 100)) : 0;
    return {
      spent: totals.total,
      limit: totalLimit,
      pct,
      isExceeded: totalLimit > 0 && totals.total > totalLimit,
    };
  }, [transactions, budgets, today]);

  // Buổi tập Body hôm nay (Chuẩn hóa 4 trạng thái rõ ràng)
  const todayCompletedSession = useMemo(() => {
    return (sessions || []).find(s => s.status === 'completed' && s.local_date === today);
  }, [sessions, today]);

  const inProgressSession = useMemo(() => {
    return (sessions || []).find(s => s.status === 'in_progress');
  }, [sessions]);

  const todayWeekday = useMemo(() => {
    const jsDay = now.getDay();
    return jsDay === 0 ? 7 : jsDay;
  }, [now]);

  const todayRoutineItems = useMemo(() => {
    return (routineItems || []).filter(item => item.weekday === todayWeekday);
  }, [routineItems, todayWeekday]);

  // Quick Task Input
  const [quickTitle, setQuickTitle] = useState('');
  const handleQuickAdd = async (e) => {
    e.preventDefault();
    const clean = quickTitle.trim();
    if (!clean) return;
    const ok = await addTask({ title: clean, dueDate: today });
    if (ok) {
      setQuickTitle('');
      showToast(`Đã thêm việc hôm nay: ${clean}`, { icon: 'plus' });
    }
  };

  // Dời toàn bộ task quá hạn sang hôm nay (Bulk Rollover)
  const handleRolloverAll = async () => {
    if (criticalTasks.length === 0) return;
    await Promise.all(criticalTasks.map(item => rolloverTask(item.raw.id)));
    showToast(`Đã dời ${criticalTasks.length} nhiệm vụ quá hạn sang hôm nay`, { icon: 'calendar' });
  };

  // Hành động xử lý cảnh báo
  const handleAlertAction = async (alert, actionKey) => {
    if (alert.domain === 'task') {
      if (actionKey === 'complete') {
        const ok = await completeTask(alert.raw.id);
        if (ok) showToast(`Đã xong: ${alert.title}`, { icon: 'checkCircle' });
      } else if (actionKey === 'rollover') {
        const ok = await rolloverTask(alert.raw.id);
        if (ok) showToast(`Đã dời sang hôm nay: ${alert.title}`, { icon: 'calendar' });
      }
      return;
    }

    if (alert.actionType === 'bill_pay') {
      if (actionKey === 'skip') {
        const ok = await fin.skipBillPeriod(alert.raw.id, alert.period);
        if (ok) showToast(`Đã bỏ kỳ ${alert.period} của ${alert.raw.name}`, { icon: 'calendar' });
      } else {
        navigate('/finance/recurring');
      }
      return;
    }

    navigate(alert.targetUrl || '/finance');
  };

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || '';

  // Danh sách task quá hạn hiển thị (rút gọn Top 3 hoặc mở rộng)
  const visibleOverdueTasks = expandedOverdueTasks ? criticalTasks : criticalTasks.slice(0, 3);

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
                Âm lịch: {lunar.day}/{lunar.month}{lunar.leap ? ' (nhuận)' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="dash-header__right">
          {urgentCount === 0 ? (
            <div className="dash-status dash-status--ok">
              <AppIcon name="shieldCheck" size={16} weight="fill" />
              <span>Mọi nghĩa vụ & công việc đều đúng hạn</span>
            </div>
          ) : (
            <div className="dash-status dash-status--urgent">
              <AppIcon name="warning" size={16} weight="fill" />
              <span>
                {overdueCount > 0 ? `${overdueCount} mục quá hạn` : ''}
                {overdueCount > 0 && dueFinanceCount > 0 ? ' · ' : ''}
                {dueFinanceCount > 0 ? `${dueFinanceCount} tài chính đến hạn hôm nay` : ''}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ── VÙNG CUỘN NỘI BỘ (Workspace Scroll Container) ─────────────── */}
      <div className="dash-scroll">
        {/* ═════════════════════════════════════════════════════════════════════════
            TẦNG 1: 🚨 CẦN XỬ LÝ NGAY (Action Required / Overdue & Financial Due Today)
            ═════════════════════════════════════════════════════════════════════════ */}
        {urgentCount > 0 ? (
          <section className="dash-critical-box" aria-label="Nghĩa vụ và công việc cần xử lý ngay">
            <div className="dash-critical-box__head">
              <div className="dash-critical-box__title">
                <AppIcon name="warning" size={18} weight="fill" />
                <span>Cần xử lý ngay ({urgentCount})</span>
              </div>
              <span className="dash-critical-box__count">
                {overdueCount > 0 ? `${overdueCount} quá hạn` : `${dueFinanceCount} đến hạn`}
              </span>
            </div>

            <div className="dash-critical-list">
              {/* ── 1. Nghĩa vụ Tài chính khẩn cấp (Hóa đơn, thẻ, nợ vay quá hạn) ── */}
              {criticalFinance.length > 0 && (
                <>
                  <div className="dash-alert-subhead">
                    <span>Nghĩa vụ tài chính quá hạn ({criticalFinance.length})</span>
                  </div>
                  {criticalFinance.map(item => (
                    <div
                      key={item.id}
                      className="dash-alert-row dash-alert-row--critical dash-alert-row--clickable"
                      onClick={() => handleAlertAction(item, item.actionType === 'bill_pay' ? 'pay' : 'action')}
                      title="Bấm để xử lý"
                    >
                      <div className="dash-alert-row__icon-wrap">
                        <AppIcon name={item.icon} size={18} weight="fill" />
                      </div>
                      <div className="dash-alert-row__main">
                        <span className="dash-alert-row__title">{item.title}</span>
                        <span className="dash-alert-row__subtitle">{item.subtitle}</span>
                      </div>
                      <div className="dash-alert-row__badge-box">
                        <span className="dash-alert-row__badge">{item.badge}</span>
                        {item.amount != null && (
                          <span className="dash-alert-row__amount">{money(item.amount)}</span>
                        )}
                      </div>
                      <div className="dash-alert-row__actions">
                        {item.actionType === 'bill_pay' ? (
                          <>
                            <button
                              type="button"
                              className="dash-btn dash-btn--danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAlertAction(item, 'pay');
                              }}
                            >
                              {item.actionLabel}
                            </button>
                            <button
                              type="button"
                              className="dash-btn dash-btn--secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAlertAction(item, 'skip');
                              }}
                            >
                              Bỏ kỳ
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="dash-btn dash-btn--danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAlertAction(item, 'action');
                            }}
                          >
                            {item.actionLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* ── 2. Nghĩa vụ Tài chính đến hạn hôm nay ── */}
              {dueTodayFinance.length > 0 && (
                <>
                  <div className="dash-alert-subhead">
                    <span>Tài chính đến hạn hôm nay ({dueTodayFinance.length})</span>
                  </div>
                  {dueTodayFinance.map(item => (
                    <div
                      key={item.id}
                      className="dash-alert-row dash-alert-row--today dash-alert-row--clickable"
                      onClick={() => handleAlertAction(item, 'action')}
                      title="Bấm để xử lý"
                    >
                      <div className="dash-alert-row__icon-wrap">
                        <AppIcon name={item.icon} size={18} weight="fill" />
                      </div>
                      <div className="dash-alert-row__main">
                        <span className="dash-alert-row__title">{item.title}</span>
                        <span className="dash-alert-row__subtitle">{item.subtitle}</span>
                      </div>
                      <div className="dash-alert-row__badge-box">
                        <span className="dash-alert-row__badge">{item.badge}</span>
                        {item.amount != null && (
                          <span className="dash-alert-row__amount">{money(item.amount)}</span>
                        )}
                      </div>
                      <div className="dash-alert-row__actions">
                        <button
                          type="button"
                          className="dash-btn dash-btn--primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAlertAction(item, 'action');
                          }}
                        >
                          {item.actionLabel}
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* ── 3. Nhiệm vụ quá hạn (Tự động thu gọn nếu > 3 việc) ── */}
              {criticalTasks.length > 0 && (
                <>
                  <div className="dash-alert-subhead">
                    <span>Nhiệm vụ quá hạn ({criticalTasks.length})</span>
                    <div className="dash-alert-subhead__actions">
                      {criticalTasks.length > 1 && (
                        <button
                          type="button"
                          className="dash-btn dash-btn--secondary"
                          onClick={handleRolloverAll}
                          style={{ height: '24px', fontSize: '11px', padding: '0 8px' }}
                          title="Chuyển toàn bộ task quá hạn sang hôm nay"
                        >
                          <AppIcon name="calendar" size={12} /> Dời tất cả sang hôm nay
                        </button>
                      )}
                    </div>
                  </div>

                  {visibleOverdueTasks.map(item => (
                    <div
                      key={item.id}
                      className="dash-alert-row dash-alert-row--critical dash-alert-row--clickable"
                      onClick={() => setSelectedTask(item.raw)}
                      title="Bấm để mở xem chi tiết nhiệm vụ"
                    >
                      <div className="dash-alert-row__icon-wrap">
                        <AppIcon name={item.icon} size={18} weight="fill" />
                      </div>
                      <div className="dash-alert-row__main">
                        <span className="dash-alert-row__title">{item.title}</span>
                        <span className="dash-alert-row__subtitle">{item.subtitle}</span>
                      </div>
                      <div className="dash-alert-row__badge-box">
                        <span className="dash-alert-row__badge">{item.badge}</span>
                      </div>
                      <div className="dash-alert-row__actions">
                        <button
                          type="button"
                          className="dash-btn dash-btn--success"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAlertAction(item, 'complete');
                          }}
                          title="Hoàn thành task này"
                        >
                          <AppIcon name="check" size={14} /> Xong
                        </button>
                        <button
                          type="button"
                          className="dash-btn dash-btn--secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAlertAction(item, 'rollover');
                          }}
                          title="Dời task sang hôm nay"
                        >
                          Dời hôm nay
                        </button>
                      </div>
                    </div>
                  ))}

                  {criticalTasks.length > 3 && (
                    <button
                      type="button"
                      className="dash-expand-btn"
                      onClick={() => setExpandedOverdueTasks(!expandedOverdueTasks)}
                    >
                      <AppIcon name={expandedOverdueTasks ? 'caretUp' : 'caretDown'} size={14} />
                      <span>
                        {expandedOverdueTasks
                          ? 'Thu gọn về Top 3 việc gấp'
                          : `Xem thêm ${criticalTasks.length - 3} nhiệm vụ quá hạn khác`}
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>
          </section>
        ) : (
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
        )}

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
              {todayTasks.length > 0 ? (
                todayTasks.map(t => (
                  <div
                    key={t.id}
                    className="dash-task-item"
                    onClick={() => setSelectedTask(t)}
                    title="Bấm để mở xem chi tiết"
                  >
                    <button
                      type="button"
                      className="dash-task-check"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAlertAction({ domain: 'task', raw: t, title: t.title }, 'complete');
                      }}
                      aria-label={`Hoàn thành ${t.title}`}
                    >
                      <AppIcon name="check" size={12} weight="bold" />
                    </button>
                    <span className="dash-task-item__title">{t.title}</span>
                    {t.priority && (
                      <span className={`dash-task-priority dash-task-priority--p${t.priority}`}>
                        P{t.priority}
                      </span>
                    )}
                    {t.due_time && <span className="dash-task-item__time">{t.due_time}</span>}
                  </div>
                ))
              ) : (
                <div className="dash-card-empty">
                  <AppIcon name="checkCircle" size={24} weight="duotone" />
                  <span>Chưa có việc nào hẹn cho hôm nay.</span>
                </div>
              )}

              <form onSubmit={handleQuickAdd} className="dash-quick-form">
                <input
                  type="text"
                  placeholder="+ Thêm nhanh việc hôm nay..."
                  value={quickTitle}
                  onChange={e => setQuickTitle(e.target.value)}
                  className="dash-quick-input"
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
              {inProgressSession ? (
                /* ── 1. ĐANG TẬP DỞ (In Progress) ── */
                <div
                  className="dash-workout-banner"
                  style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    borderColor: 'rgba(245, 158, 11, 0.3)'
                  }}
                >
                  <div className="dash-workout-banner__name" style={{ color: '#f59e0b' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: '#f59e0b',
                          display: 'inline-block'
                        }}
                      />
                      {inProgressSession.day_type || inProgressSession.title || 'Buổi tập đang diễn ra'}
                    </span>
                    <span
                      className="dash-workout-banner__badge"
                      style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}
                    >
                      Đang tập dở
                    </span>
                  </div>
                  <span className="dash-workout-exercises">
                    Bạn có một buổi tập chưa hoàn thành. Bấm tiếp tục để không bỏ dở tiến độ hôm nay!
                  </span>
                  <button
                    type="button"
                    className="dash-btn"
                    style={{
                      marginTop: '4px',
                      width: '100%',
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      color: '#ffffff',
                      fontWeight: 700
                    }}
                    onClick={() => navigate('/body/session')}
                  >
                    <AppIcon name="play" size={14} weight="fill" /> Tiếp tục buổi tập
                  </button>
                </div>
              ) : todayCompletedSession ? (
                /* ── 2. ĐÃ HOÀN THÀNH (Completed) ── */
                <div className="dash-workout-banner" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
                  <div className="dash-workout-banner__name" style={{ color: '#10b981' }}>
                    <span>{todayCompletedSession.day_type || todayCompletedSession.title || 'Đã hoàn thành buổi tập!'}</span>
                    <span className="dash-workout-banner__badge" style={{ background: 'rgba(16, 185, 129, 0.18)', color: '#10b981' }}>
                      Xong
                    </span>
                  </div>
                  <span className="dash-workout-exercises">
                    {todayCompletedSession.duration_seconds
                      ? `Thời gian tập: ~${Math.max(1, Math.round(todayCompletedSession.duration_seconds / 60))} phút · Tuyệt vời, bạn đã duy trì phong độ đều đặn!`
                      : 'Tuyệt vời! Bạn đã hoàn thành buổi tập hôm nay.'}
                  </span>
                  <button
                    type="button"
                    className="dash-btn dash-btn--secondary"
                    style={{ marginTop: '4px', width: '100%' }}
                    onClick={() => navigate('/body/history')}
                  >
                    <AppIcon name="trophy" size={14} /> Xem lại tiến bộ
                  </button>
                </div>
              ) : todayRoutineItems.length > 0 ? (
                /* ── 3. CHƯA TẬP, CÓ LỊCH HÔM NAY ── */
                <div className="dash-workout-banner">
                  <div className="dash-workout-banner__name">
                    <span>{todayRoutineItems[0]?.day_name || activeRoutine?.name || 'Lịch tập hôm nay'}</span>
                    <span className="dash-workout-banner__badge">
                      {todayRoutineItems.length} bài tập
                    </span>
                  </div>
                  <div className="dash-workout-exercises">
                    {todayRoutineItems.slice(0, 4).map((item, idx) => (
                      <span key={item.id || idx}>
                        {idx + 1}. {item.exercise_name || item.name || 'Bài tập'}{idx < Math.min(3, todayRoutineItems.length - 1) ? ' · ' : ''}
                      </span>
                    ))}
                    {todayRoutineItems.length > 4 && <span> +{todayRoutineItems.length - 4} bài khác</span>}
                  </div>
                  <button
                    type="button"
                    className="dash-btn dash-btn--primary"
                    style={{ marginTop: '4px', width: '100%' }}
                    onClick={() => navigate('/body')}
                  >
                    <AppIcon name="play" size={14} weight="fill" /> Bắt đầu buổi tập
                  </button>
                </div>
              ) : activeRoutine ? (
                /* ── 4. NGÀY NGHỈ PHỤC HỒI (Rest Day) ── */
                <div className="dash-card-empty">
                  <AppIcon name="sparkle" size={24} weight="duotone" />
                  <span>Hôm nay là Ngày nghỉ ngơi phục hồi (Rest day).</span>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Lộ trình: {activeRoutine.name}
                  </span>
                  <button
                    type="button"
                    className="dash-btn dash-btn--secondary"
                    style={{ marginTop: '4px' }}
                    onClick={() => navigate('/body/routine')}
                  >
                    Xem Lộ trình tập
                  </button>
                </div>
              ) : (
                /* ── 5. CHƯA CÓ LỘ TRÌNH ── */
                <div className="dash-card-empty">
                  <AppIcon name="barbell" size={24} weight="duotone" />
                  <span>Chưa có lộ trình tập luyện nào.</span>
                  <button
                    type="button"
                    className="dash-btn dash-btn--secondary"
                    style={{ marginTop: '4px' }}
                    onClick={() => navigate('/body/routine')}
                  >
                    Tạo lộ trình tập
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Card 3: Sắp tới hạn (Heads-Up: 1–3 ngày tới) */}
          <section className="dash-card">
            <div className="dash-card__head">
              <div className="dash-card__title">
                <AppIcon name="calendar" size={16} weight="fill" />
                <span>Sắp tới hạn ({alerts.headsUp.length})</span>
              </div>
              <Link to="/finance/recurring" className="dash-card__link">
                Định kỳ <AppIcon name="caretRight" size={12} />
              </Link>
            </div>
            <div className="dash-card__body">
              {alerts.headsUp.length > 0 ? (
                alerts.headsUp.slice(0, 5).map(item => (
                  <div key={item.id} className="dash-headsup-item">
                    <div className="dash-headsup-item__left">
                      <AppIcon name={item.icon} size={15} />
                      <span className="dash-headsup-item__title">{item.title}</span>
                    </div>
                    <span className="dash-headsup-item__badge">{item.badge}</span>
                  </div>
                ))
              ) : (
                <div className="dash-card-empty">
                  <AppIcon name="checkCircle" size={24} weight="duotone" />
                  <span>Không có sự kiện hay hóa đơn nào sắp đến hạn trong vài ngày tới.</span>
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
                <span>Tiến độ ngân sách tháng {now.getMonth() + 1}/{now.getFullYear()}</span>
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

            <div className="dash-budget-widget__foot">
              <span>Đã sử dụng: <strong>{monthBudget.pct}%</strong></span>
              <Link to="/finance/overview" style={{ color: '#8b5cf6', textDecoration: 'none', fontWeight: 600 }}>
                Chi tiết báo cáo →
              </Link>
            </div>
          </div>

          {/* Lối tắt 5 Module chính */}
          <div className="dash-modules-grid">
            <Link to="/tasks" className="dash-module-btn">
              <div className="dash-module-btn__icon" style={{ color: '#22d3ee' }}>
                <AppIcon name="pushPin" size={20} weight="fill" />
              </div>
              <span className="dash-module-btn__name">Nhiệm Vụ</span>
            </Link>

            <Link to="/finance" className="dash-module-btn">
              <div className="dash-module-btn__icon" style={{ color: '#10b981' }}>
                <AppIcon name="wallet" size={20} weight="fill" />
              </div>
              <span className="dash-module-btn__name">Tài Chính</span>
            </Link>

            <Link to="/body" className="dash-module-btn">
              <div className="dash-module-btn__icon" style={{ color: '#f59e0b' }}>
                <AppIcon name="barbell" size={20} weight="fill" />
              </div>
              <span className="dash-module-btn__name">Body</span>
            </Link>

            <Link to="/collect" className="dash-module-btn">
              <div className="dash-module-btn__icon" style={{ color: '#a78bfa' }}>
                <AppIcon name="brain" size={20} weight="fill" />
              </div>
              <span className="dash-module-btn__name">Knowledge</span>
            </Link>

            <Link to="/accounts" className="dash-module-btn">
              <div className="dash-module-btn__icon" style={{ color: '#ec4899' }}>
                <AppIcon name="lock" size={20} weight="fill" />
              </div>
              <span className="dash-module-btn__name">Vault</span>
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
            await completeTask(tId);
            showToast('Đã hoàn thành nhiệm vụ', { icon: 'checkCircle' });
            setSelectedTask(null);
          }}
          onDelete={async (task) => {
            const tId = typeof task === 'object' && task?.id ? task.id : task;
            await taskModel.deleteTask(tId);
            showToast('Đã xóa nhiệm vụ', { icon: 'trash' });
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
    </div>
  );
}
