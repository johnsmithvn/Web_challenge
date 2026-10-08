import { useState, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
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
const SHORT_WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

// Format rút gọn số tiền (ví dụ: 180 -> 180k, 4280 -> 4,28tr)
const formatShortK = (amtInThousands) => {
  if (amtInThousands == null || isNaN(amtInThousands)) return '';
  if (amtInThousands < 1000) return `${amtInThousands}k`;
  const mil = amtInThousands / 1000;
  return `${mil.toFixed(mil % 1 === 0 ? 0 : 2).replace('.', ',')}tr`;
};

export default function HomeDashboard() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const taskModel = useUserTasks();
  const { tasks, todayTasks, completeTask, uncompleteTask, rolloverTask, addTask } = taskModel;

  const fin = useFinance();
  const { bills, cards, loans, lendings, deposits, budgets, transactions, today } = fin;

  const workoutModel = useWorkouts();
  const { activeRoutine, routineItems, sessions } = workoutModel;

  // State xem chi tiết nhiệm vụ và thu gọn task quá hạn
  const [selectedTask, setSelectedTask] = useState(null);
  const [expandedOverdueTasks, setExpandedOverdueTasks] = useState(false);

  // Quick Task Input Ref để hỗ trợ nút "+ Ghi nhanh"
  const quickInputRef = useRef(null);
  const [quickTitle, setQuickTitle] = useState('');

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
  const solarDateStr = `${dayName}, ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

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

  // Phân loại cảnh báo khẩn cấp (Tầng 1)
  const criticalFinance = useMemo(() => alerts.critical.filter(a => a.domain !== 'task'), [alerts.critical]);
  const dueTodayFinance = useMemo(() => alerts.dueToday.filter(a => a.domain !== 'task'), [alerts.dueToday]);
  const criticalTasks = useMemo(() => alerts.critical.filter(a => a.domain === 'task'), [alerts.critical]);

  // Danh sách tài chính khẩn cấp hiển thị bên trái Tầng 1
  const urgentFinanceList = useMemo(() => {
    return [
      ...criticalFinance.map(f => ({ ...f, isOverdue: true, tag: 'Quá hạn' })),
      ...dueTodayFinance.map(f => ({ ...f, isOverdue: false, tag: 'Hôm nay' }))
    ];
  }, [criticalFinance, dueTodayFinance]);

  const urgentCount = urgentFinanceList.length + criticalTasks.length;
  const hasUrgent = urgentCount > 0;
  const allClear = !hasUrgent;

  // Danh sách task quá hạn hiển thị (Top 3 hoặc mở rộng)
  const visibleOverdueTasks = expandedOverdueTasks ? criticalTasks : criticalTasks.slice(0, 3);

  // Ngân sách tháng hiện tại
  const monthBudget = useMemo(() => {
    const curMonth = currentMonthPeriod(today);
    const totals = periodTotals(transactions, curMonth);
    const totalLimit = (budgets || []).reduce((sum, b) => sum + (b.limit_amount || 0), 0) || 18000000;
    const spent = totals.total || 6120000;
    const curDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // Nhịp đều lý thuyết đến hôm nay
    const paceToToday = Math.round((totalLimit / daysInMonth) * curDay);
    // Dự kiến chi cả tháng theo tốc độ hiện tại
    const projectedEnd = curDay > 0 ? Math.round((spent / curDay) * daysInMonth) : spent;
    const diffFromLimit = projectedEnd - totalLimit;

    return {
      spent,
      limit: totalLimit,
      curDay,
      daysInMonth,
      paceToToday,
      projectedEnd,
      diffFromLimit,
      isExceeded: projectedEnd > totalLimit,
      pct: Math.min(100, Math.round((spent / totalLimit) * 100)),
    };
  }, [transactions, budgets, today, now]);

  // Biểu đồ SVG Ngân sách tháng theo mockup tong_quan.dc.html
  const budgetChart = useMemo(() => {
    const W = 600;
    const H = 160;
    const { daysInMonth, curDay, spent, limit, projectedEnd } = monthBudget;
    const limitM = limit / 1000000;
    const spentM = spent / 1000000;
    const projM = projectedEnd / 1000000;
    const maxY = Math.max(limitM * 1.15, projM * 1.1, 21);

    const X = (d) => ((d - 1) / (daysInMonth - 1)) * W;
    const Y = (v) => H - (v / maxY) * H;
    const pctH = (v) => `${((v / H) * 100).toFixed(2)}%`;
    const pctW = (v) => `${((v / W) * 100).toFixed(2)}%`;

    // Giả lập đường chi tiêu cộng dồn đến hôm nay
    const stepSpent = spentM / Math.max(1, curDay);
    const cumPoints = Array.from({ length: curDay }, (_, i) => {
      const day = i + 1;
      const val = Math.min(spentM, Number((stepSpent * day * (0.85 + 0.3 * Math.sin(day * 0.8))).toFixed(2)));
      return day === curDay ? spentM : val;
    });

    const linePath = cumPoints
      .map((v, i) => `${i ? 'L' : 'M'}${X(i + 1).toFixed(1)} ${Y(v).toFixed(1)}`)
      .join(' ');

    const areaPath = `${linePath} L${X(curDay).toFixed(1)} ${H} L${X(1).toFixed(1)} ${H} Z`;
    const pacePath = `M${X(1).toFixed(1)} ${Y(limitM / daysInMonth).toFixed(1)} L${X(daysInMonth).toFixed(1)} ${Y(limitM).toFixed(1)}`;
    const projPath = `M${X(curDay).toFixed(1)} ${Y(spentM).toFixed(1)} L${X(daysInMonth).toFixed(1)} ${Y(projM).toFixed(1)}`;
    const limitPath = `M0 ${Y(limitM).toFixed(1)} L${W} ${Y(limitM).toFixed(1)}`;
    const gridPath = [5, 10, 15]
      .filter(v => v < maxY)
      .map(v => `M0 ${Y(v).toFixed(1)} L${W} ${Y(v).toFixed(1)}`)
      .join(' ') + ` M${X(curDay).toFixed(1)} 0 L${X(curDay).toFixed(1)} ${H}`;

    const ticks = [
      { d: 1, label: `1/${now.getMonth() + 1}`, left: pctW(X(1)), transform: 'none' },
      { d: curDay, label: 'hôm nay', left: pctW(X(curDay)), transform: 'translateX(-50%)', isToday: true },
      { d: 15, label: `15/${now.getMonth() + 1}`, left: pctW(X(15)), transform: 'translateX(-50%)' },
      { d: 22, label: `22/${now.getMonth() + 1}`, left: pctW(X(22)), transform: 'translateX(-50%)' },
      { d: daysInMonth, label: `${daysInMonth}/${now.getMonth() + 1}`, left: pctW(X(daysInMonth)), transform: 'translateX(-100%)' },
    ];

    return {
      line: linePath,
      area: areaPath,
      pace: pacePath,
      proj: projPath,
      limit: limitPath,
      grid: gridPath,
      limitTop: pctH(Y(limitM)),
      projTop: pctH(Y(projM)),
      dotL: pctW(X(curDay)),
      dotT: pctH(Y(spentM)),
      limitText: `${(limit / 1000000).toFixed(limit % 1000000 === 0 ? 0 : 1)} tr`,
      projText: `${projM.toFixed(1).replace('.', ',')} tr`,
      spentText: `${spentM.toFixed(2).replace('.', ',')} tr`,
      ticks,
    };
  }, [monthBudget, now]);

  // 4 Danh mục ngân sách
  const budgetCategories = useMemo(() => {
    return [
      { name: 'Ăn uống', spent: 2.48, limit: 5.5, color: '#E0A23C' },
      { name: 'Nhà & hóa đơn', spent: 1.9, limit: 4.2, color: '#2F8A57' },
      { name: 'Di chuyển', spent: 0.74, limit: 1.5, color: '#2F8A57' },
      { name: 'Mua sắm', spent: 0.52, limit: 2.5, color: '#2F8A57' },
    ].map(cat => {
      const pct = Math.round((cat.spent / cat.limit) * 100);
      return {
        ...cat,
        pct: `${pct}%`,
        valText: `${cat.spent.toFixed(2).replace('.', ',')} / ${cat.limit.toFixed(1).replace('.', ',')} tr`,
      };
    });
  }, []);

  // Lịch thanh toán tháng (Payment Calendar 35 ô)
  const paymentCalendar = useMemo(() => {
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const curDay = now.getDate();
    const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();

    // Xác định thứ của ngày 1 trong tháng (0 = CN, 1 = T2,... 6 = T7)
    // Map về: T2=0, T3=1, T4=2, T5=3, T6=4, T7=5, CN=6
    const firstJsDay = new Date(curYear, curMonth, 1).getDay();
    const firstCol = firstJsDay === 0 ? 6 : firstJsDay - 1;

    // Dữ liệu mock thanh toán kết hợp từ bills & mẫu chuẩn tong_quan.dc.html
    const payMap = {
      3: { name: 'Viettel', amtK: 180, status: 'paid' },
      4: { name: 'Netflix', amtK: 260, status: 'paid' },
      5: { name: 'Sao kê VIB', amtK: 4280, status: 'over' },
      6: { name: 'Trả góp FPT Shop', amtK: 1150, status: 'over' },
      8: { name: 'Điện EVN', amtK: 612, status: 'today' },
      9: { name: 'Internet FPT', amtK: 265, status: 'up' },
      11: { name: 'Phí thường niên TPBank', amtK: 590, status: 'up' },
      15: { name: 'Nước', amtK: 140, status: 'up' },
      20: { name: 'Bảo hiểm sức khỏe', amtK: 850, status: 'up' },
      25: { name: 'Gym', amtK: 500, status: 'up' },
      28: { name: 'iCloud', amtK: 59, status: 'up' },
    };

    // Nếu có bills thực tế từ Supabase, cập nhật vào payMap
    (bills || []).forEach(b => {
      if (b.due_day && b.due_day >= 1 && b.due_day <= daysInMonth) {
        const amtK = Math.round((b.amount || 0) / 1000);
        let status = 'up';
        if (b.due_day < curDay) status = 'over';
        else if (b.due_day === curDay) status = 'today';
        payMap[b.due_day] = { name: b.name, amtK, status };
      }
    });

    const statusStyles = {
      paid: { bg: '#E3F2E8', fg: '#2F7A4E' },
      over: { bg: '#FBE3DD', fg: '#B4321C' },
      today: { bg: '#FBF0DC', fg: '#9A6514' },
      up: { bg: '#F0EFEB', fg: '#15161A' },
    };

    let totalBillsCount = 0;
    let paidBillsCount = 0;
    let unpaidTotalK = 0;

    Object.values(payMap).forEach(item => {
      totalBillsCount++;
      if (item.status === 'paid') paidBillsCount++;
      else unpaidTotalK += item.amtK;
    });

    const cells = Array.from({ length: 35 }, (_, idx) => {
      const dayNum = idx - firstCol + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        return { dayNum: '', amtText: '', title: '', bg: 'transparent', fg: 'transparent', isToday: false };
      }

      const bill = payMap[dayNum];
      const isToday = dayNum === curDay;
      const stStyle = bill ? statusStyles[bill.status] : null;

      return {
        dayNum,
        amtText: bill ? formatShortK(bill.amtK) : '',
        title: bill ? `${bill.name} (${formatShortK(bill.amtK)})` : '',
        bg: stStyle ? stStyle.bg : 'transparent',
        fg: stStyle ? stStyle.fg : (dayNum < curDay ? '#B5B4AE' : '#6B6960'),
        isToday,
        isBold: Boolean(bill || isToday),
      };
    });

    return {
      cells,
      paidCount: paidBillsCount,
      totalCount: totalBillsCount,
      payLeftText: (unpaidTotalK * 1000).toLocaleString('vi-VN') + ' ₫',
    };
  }, [now, bills]);

  // Trạng thái Body hôm nay
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

  const bodyStateInfo = useMemo(() => {
    if (inProgressSession) {
      return {
        badge: 'Đang dở',
        badgeBg: '#FBF0DC',
        badgeFg: '#9A6514',
        badgeIcon: 'pause',
        title: inProgressSession.day_type || inProgressSession.title || 'Chân · Đùi trước, Mông, Bắp chân',
        sub: 'Đã hoàn thành một phần bài tập. Buổi tập được lưu giữ đến 23:59 tối nay.',
        hasProg: true,
        progPct: '60%',
        ctaLabel: 'Tiếp tục buổi tập',
        ctaIcon: 'play',
        ctaBg: '#15161A',
        ctaFg: '#FFFFFF',
        ctaAction: () => navigate('/body/session'),
      };
    }
    if (todayCompletedSession) {
      return {
        badge: 'Đã xong',
        badgeBg: '#E3F2E8',
        badgeFg: '#2F7A4E',
        badgeIcon: 'checkCircle',
        title: todayCompletedSession.day_type || todayCompletedSession.title || 'Chân · Đùi trước, Mông, Bắp chân',
        sub: 'Bạn đã hoàn thành buổi tập hôm nay. Phong độ phục hồi rất ổn định!',
        hasProg: false,
        ctaLabel: 'Xem buổi tập',
        ctaIcon: 'checkSquare',
        ctaBg: '#F3F2EE',
        ctaFg: '#15161A',
        ctaAction: () => navigate('/body/history'),
      };
    }
    if (todayRoutineItems.length > 0) {
      return {
        badge: 'Hôm nay',
        badgeBg: '#EEEAFD',
        badgeFg: '#5238C9',
        badgeIcon: 'calendar',
        title: todayRoutineItems[0]?.day_name || activeRoutine?.name || 'Chân · Đùi trước, Mông, Bắp chân',
        sub: `${todayRoutineItems.length} bài tập · khoảng 45 phút. Các nhóm cơ đã sẵn sàng.`,
        hasProg: false,
        ctaLabel: 'Vào phòng tập',
        ctaIcon: 'barbell',
        ctaBg: '#6949E8',
        ctaFg: '#FFFFFF',
        ctaAction: () => navigate('/body'),
      };
    }
    if (activeRoutine) {
      return {
        badge: 'Rest day',
        badgeBg: '#F0EFEB',
        badgeFg: '#5F606A',
        badgeIcon: 'moon',
        title: 'Ngày nghỉ phục hồi',
        sub: `Cơ bắp đang trong pha tái tạo mô. Lộ trình đang theo: ${activeRoutine.name}.`,
        hasProg: false,
        ctaLabel: 'Xem lộ trình',
        ctaIcon: 'listChecks',
        ctaBg: '#F3F2EE',
        ctaFg: '#15161A',
        ctaAction: () => navigate('/body/routine'),
      };
    }
    return {
      badge: 'Chưa bắt đầu',
      badgeBg: '#F0EFEB',
      badgeFg: '#5F606A',
      badgeIcon: 'plus',
      title: 'Chưa có lộ trình tập',
      sub: 'Chọn một lộ trình mẫu để app lên lịch tập đều đặn mỗi tuần.',
      hasProg: false,
      ctaLabel: 'Tạo lộ trình',
      ctaIcon: 'plus',
      ctaBg: '#6949E8',
      ctaFg: '#FFFFFF',
      ctaAction: () => navigate('/body/routine'),
    };
  }, [inProgressSession, todayCompletedSession, todayRoutineItems, activeRoutine, navigate]);

  // Nhóm cơ phục hồi chuẩn theo mockup
  const recoveryGroups = [
    { name: 'Cần nghỉ', color: '#C23B22', muscles: 'Xô, Tay trước' },
    { name: 'Đang hồi', color: '#B57A12', muscles: 'Cầu vai, Ngực, Vai, Tay sau' },
    { name: 'Sẵn sàng', color: '#2F8A57', muscles: 'Chân, Bụng' },
  ];

  // Thanh tuần 7 ngày của Body
  const bodyWeekDays = useMemo(() => {
    const jsDay = now.getDay();
    const currentWeekIdx = jsDay === 0 ? 6 : jsDay - 1; // 0..6 (T2..CN)

    return SHORT_WEEKDAYS.map((name, idx) => {
      let bg = '#F0EEE9';
      let border = 'none';
      let isBold = false;
      let textColor = '#8A8A84';

      if (idx < currentWeekIdx) {
        bg = '#6949E8'; // Đã tập xong
      } else if (idx === currentWeekIdx) {
        bg = '#C4B6F4'; // Ngày hôm nay
        textColor = '#15161A';
        isBold = true;
      } else if (idx === currentWeekIdx + 1) {
        bg = 'transparent';
        border = '1.5px dashed #C9C6BE'; // Dự kiến
      }

      return { name, bg, border, isBold, textColor };
    });
  }, [now]);

  // Radar 3 ngày tới
  const radarGrouped = useMemo(() => {
    const groups = [
      {
        dayLabel: 'MAI · THỨ SÁU 9/10',
        items: [
          {
            icon: 'wifiHigh',
            iconColor: '#2F8A57',
            iconBg: 'rgba(47, 138, 87, 0.12)',
            title: 'Internet FPT',
            subtitle: 'Hóa đơn tháng 10',
            val: '265.000 ₫',
          },
        ],
      },
      {
        dayLabel: 'THỨ BẢY 10/10',
        items: [
          {
            icon: 'pushPin',
            iconColor: '#3B6FD8',
            iconBg: 'rgba(59, 111, 216, 0.12)',
            title: 'Báo cáo quý III',
            subtitle: 'Nhiệm vụ · P1',
            val: '17:00',
          },
        ],
      },
      {
        dayLabel: 'CHỦ NHẬT 11/10',
        items: [
          {
            icon: 'creditCard',
            iconColor: '#2F8A57',
            iconBg: 'rgba(47, 138, 87, 0.12)',
            title: 'Phí thường niên thẻ TPBank',
            subtitle: 'Tự trừ vào thẻ',
            val: '590.000 ₫',
          },
          {
            icon: 'listChecks',
            iconColor: '#6949E8',
            iconBg: 'rgba(105, 73, 232, 0.12)',
            title: 'Check-in tuần Body',
            subtitle: 'Cân sáng và vòng eo',
            val: '',
          },
        ],
      },
    ];

    // Bổ sung các cảnh báo headsUp thực tế nếu có
    if (alerts.headsUp.length > 0) {
      alerts.headsUp.slice(0, 3).forEach((item, i) => {
        if (!groups[i % groups.length].items.some(x => x.title === item.title)) {
          groups[i % groups.length].items.push({
            icon: item.icon || 'calendar',
            iconColor: '#2F8A57',
            iconBg: 'rgba(47, 138, 87, 0.12)',
            title: item.title,
            subtitle: item.subtitle || item.badge,
            val: item.amount ? money(item.amount) : item.badge,
          });
        }
      });
    }

    return groups;
  }, [alerts.headsUp]);

  // Nhiệm vụ hôm nay Checklist
  const todayDoneCount = useMemo(() => {
    return todayTasks.filter(t => t.status === 'done' || t.completed_at).length;
  }, [todayTasks]);

  const todayTotalCount = todayTasks.length;
  const todayProgressPct = todayTotalCount > 0 ? `${Math.round((todayDoneCount / todayTotalCount) * 100)}%` : '0%';

  // Sparklines dữ liệu cho 5 thẻ phân hệ
  const taskBars = [3, 4, 2, 5, 3, 1, 2, 4, 3, 5, 2, 4, 3, 5];
  const finBars = [0.42, 0.46, 0.47, 1.55, 0.5, 0.7, 1.26, 0.76];
  const knowledgeBars = [4, 7, 5, 9, 6, 8, 11, 9];

  // Handler thêm task nhanh
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

  // Handler dời tất cả task quá hạn sang hôm nay
  const handleRolloverAll = async () => {
    if (criticalTasks.length === 0) return;
    await Promise.all(criticalTasks.map(item => rolloverTask(item.raw.id)));
    showToast(`Đã dời ${criticalTasks.length} nhiệm vụ quá hạn sang hôm nay`, { icon: 'calendar' });
  };

  // Handler xử lý hành động khẩn cấp
  const handleAlertAction = async (item, actionKey) => {
    if (item.domain === 'task') {
      if (actionKey === 'complete') {
        const ok = await completeTask(item.raw.id);
        if (ok) showToast(`Đã xong: ${item.title}`, { icon: 'checkCircle' });
      } else if (actionKey === 'rollover') {
        const ok = await rolloverTask(item.raw.id);
        if (ok) showToast(`Đã dời sang hôm nay: ${item.title}`, { icon: 'calendar' });
      }
      return;
    }

    if (item.actionType === 'bill_pay') {
      navigate('/finance/recurring');
      return;
    }

    navigate(item.targetUrl || '/finance');
  };

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Minh';

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
                · {lunar.day}/{lunar.month} âm lịch{lunar.leap ? ' (nhuận)' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="dash-header__right">
          {hasUrgent ? (
            <div className="dash-status dash-status--urgent">
              <span className="dash-pulse-dot">
                <span className="dash-pulse-dot__ring" />
                <span className="dash-pulse-dot__core" />
              </span>
              <span>{urgentCount} mục cần xử lý</span>
            </div>
          ) : (
            <div className="dash-status dash-status--ok">
              <AppIcon name="checkCircle" size={15} weight="fill" />
              <span>Mọi thứ đúng hạn</span>
            </div>
          )}

          <button
            type="button"
            className="dash-header-btn"
            onClick={() => {
              if (quickInputRef.current) {
                quickInputRef.current.focus();
              } else {
                navigate('/tasks');
              }
            }}
          >
            <AppIcon name="plus" size={14} weight="bold" />
            <span>Ghi nhanh</span>
          </button>

          <button
            type="button"
            className="dash-theme-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            aria-label="Đổi theme"
          >
            <AppIcon name={theme === 'dark' ? 'sun' : 'moon'} size={16} weight="fill" />
          </button>
        </div>
      </header>

      {/* ── VÙNG CUỘN NỘI BỘ (Workspace Scroll Container) ─────────────── */}
      <div className="dash-scroll">
        {/* ═════════════════════════════════════════════════════════════════════════
            TẦNG 1: 🚨 CẦN XỬ LÝ NGAY (Action Required Grid)
            ═════════════════════════════════════════════════════════════════════════ */}
        {hasUrgent ? (
          <section className="dash-critical-box" aria-label="Cần xử lý ngay">
            <div className="dash-critical-box__top">
              <span className="dash-critical-box__top-icon">
                <AppIcon name="warning" size={19} weight="fill" />
              </span>
              <span className="dash-critical-box__top-title">Cần xử lý ngay</span>
              <span className="dash-critical-box__top-sub">quá hạn hoặc đến hạn trong hôm nay</span>
            </div>

            <div className="dash-critical-grid">
              {/* CỘT TRÁI: TÀI CHÍNH */}
              <div className="dash-critical-col">
                <div className="dash-critical-col__head">
                  <span>TÀI CHÍNH</span>
                </div>
                {urgentFinanceList.length > 0 ? (
                  urgentFinanceList.map((f) => (
                    <div key={f.id} className="dash-crit-fin-row">
                      <div className="dash-crit-fin-row__main">
                        <div className="dash-crit-fin-row__title-wrap">
                          <span className={`dash-crit-tag ${f.isOverdue ? 'dash-crit-tag--overdue' : 'dash-crit-tag--today'}`}>
                            {f.tag}
                          </span>
                          <span className="dash-crit-fin-row__name">{f.title}</span>
                        </div>
                        <span className="dash-crit-fin-row__sub">{f.subtitle}</span>
                      </div>
                      <span className="dash-crit-fin-row__amt">
                        {f.amount != null ? money(f.amount) : ''}
                      </span>
                      <button
                        type="button"
                        className="dash-crit-action-btn"
                        onClick={() => handleAlertAction(f, 'pay')}
                      >
                        <AppIcon name="check" size={13} weight="bold" />
                        <span>{f.actionLabel || 'Đã trả'}</span>
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="dash-crit-empty-row">
                    <AppIcon name="checkCircle" size={15} weight="fill" />
                    <span>Đã xử lý hết khoản gấp</span>
                  </div>
                )}
              </div>

              {/* CỘT PHẢI: NHIỆM VỤ QUÁ HẠN */}
              <div className="dash-critical-col">
                <div className="dash-critical-col__head">
                  <span>NHIỆM VỤ QUÁ HẠN · {criticalTasks.length}</span>
                  {criticalTasks.length > 0 && (
                    <button
                      type="button"
                      className="dash-critical-rollover-btn"
                      onClick={handleRolloverAll}
                    >
                      <AppIcon name="calendar" size={14} />
                      <span>Dời tất cả sang hôm nay</span>
                    </button>
                  )}
                </div>

                {criticalTasks.length > 0 ? (
                  <>
                    {visibleOverdueTasks.map((t) => (
                      <div key={t.id} className="dash-crit-task-row">
                        <span className={`dash-priority-pill dash-priority-pill--p${t.raw?.priority || 3}`}>
                          P{t.raw?.priority || 3}
                        </span>
                        <div className="dash-crit-task-row__main">
                          <span
                            className="dash-crit-task-row__name"
                            onClick={() => setSelectedTask(t.raw)}
                            title="Bấm để xem chi tiết"
                          >
                            {t.title}
                          </span>
                          <span className="dash-crit-task-row__sub">{t.subtitle}</span>
                        </div>
                        <button
                          type="button"
                          className="dash-crit-action-btn"
                          onClick={() => handleAlertAction(t, 'rollover')}
                        >
                          Dời hôm nay
                        </button>
                        <button
                          type="button"
                          className="dash-crit-btn-done"
                          onClick={() => handleAlertAction(t, 'complete')}
                        >
                          <AppIcon name="check" size={13} weight="bold" />
                          <span>Xong</span>
                        </button>
                      </div>
                    ))}

                    {criticalTasks.length > 3 && (
                      <div className="dash-crit-more-bar">
                        và {criticalTasks.length - 3} việc quá hạn khác ·{' '}
                        <span
                          className="dash-crit-more-link"
                          onClick={() => setExpandedOverdueTasks(!expandedOverdueTasks)}
                        >
                          {expandedOverdueTasks ? 'Thu gọn' : 'Xem tất cả'}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="dash-crit-empty-row">
                    <AppIcon name="checkCircle" size={15} weight="fill" />
                    <span>Không còn việc quá hạn</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : (
          <div className="dash-all-clear">
            <span className="dash-all-clear__icon-wrap">
              <AppIcon name="checkCircle" size={21} weight="fill" />
            </span>
            <div>
              <div className="dash-all-clear__title">Tuyệt vời, không có việc quá hạn</div>
              <div className="dash-all-clear__sub">Hóa đơn, khoản nợ và nhiệm vụ đều trong hạn.</div>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════════
            TẦNG 2: 🎯 TIÊU ĐIỂM HÔM NAY (Today Focus 3-Column Grid)
            ═════════════════════════════════════════════════════════════════════════ */}
        <div>
          <div className="dash-section-head" style={{ marginBottom: 14 }}>
            <span className="dash-section-head__title">Tiêu điểm hôm nay</span>
          </div>

          <div className="dash-today-grid">
            {/* CỘT 1: NHIỆM VỤ HÔM NAY */}
            <div className="dash-card">
              <div className="dash-card__head">
                <span className="dash-card__title">Nhiệm vụ hôm nay</span>
                <span className="dash-card__meta">
                  {todayDoneCount}/{todayTotalCount} xong
                </span>
              </div>
              <span className="dash-progress-track">
                <span
                  className="dash-progress-bar dash-progress-bar--blue"
                  style={{ width: todayProgressPct }}
                />
              </span>

              <div className="dash-checklist">
                {todayTasks.length > 0 ? (
                  todayTasks.map((t) => {
                    const isDone = t.status === 'done' || Boolean(t.completed_at);
                    return (
                      <div
                        key={t.id}
                        className="dash-task-row"
                        onClick={() => setSelectedTask(t)}
                      >
                        <button
                          type="button"
                          className={`dash-task-checkbox ${isDone ? 'dash-task-checkbox--checked' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isDone) {
                              uncompleteTask(t.id);
                            } else {
                              completeTask(t.id);
                            }
                          }}
                          aria-label={isDone ? 'Bỏ chọn' : 'Hoàn thành'}
                        >
                          {isDone && <AppIcon name="check" size={12} weight="bold" />}
                        </button>
                        <span className={`dash-task-row__name ${isDone ? 'dash-task-row__name--done' : ''}`}>
                          {t.title}
                        </span>
                        <span className="dash-task-row__time">{t.due_time || ''}</span>
                        <span
                          className={`dash-task-row__priority dash-priority-pill--p${t.priority || 3}`}
                          style={{ width: 26 }}
                        >
                          P{t.priority || 3}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: '#8A8A84', fontSize: 13 }}>
                    Chưa có việc nào hẹn cho hôm nay.
                  </div>
                )}
              </div>

              <form onSubmit={handleQuickAdd} className="dash-quick-add-wrap">
                <AppIcon name="plus" size={15} style={{ color: '#8A8A84' }} />
                <input
                  ref={quickInputRef}
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  placeholder="Thêm việc cho hôm nay, Enter để lưu"
                  className="dash-quick-add-input"
                />
              </form>
            </div>

            {/* CỘT 2: BODY */}
            <div className="dash-card dash-card--body">
              <div className="dash-card-body__top">
                <span className="dash-card__title">Body</span>
                <span
                  className="dash-card-body__badge"
                  style={{
                    background: bodyStateInfo.badgeBg,
                    color: bodyStateInfo.badgeFg,
                  }}
                >
                  <AppIcon name={bodyStateInfo.badgeIcon} size={12} weight="fill" />
                  <span>{bodyStateInfo.badge}</span>
                </span>
              </div>

              <div className="dash-card-body__content">
                <span className="dash-card-body__title">{bodyStateInfo.title}</span>
                <span className="dash-card-body__sub">{bodyStateInfo.sub}</span>

                {bodyStateInfo.hasProg && (
                  <span className="dash-progress-track">
                    <span
                      className="dash-progress-bar dash-progress-bar--yellow"
                      style={{ width: bodyStateInfo.progPct }}
                    />
                  </span>
                )}

                <div className="dash-rec-groups">
                  {recoveryGroups.map((g) => (
                    <div key={g.name} className="dash-rec-row">
                      <span className="dash-rec-label" style={{ color: g.color }}>
                        <span className="dash-rec-dot" style={{ background: g.color }} />
                        <span>{g.name}</span>
                      </span>
                      <span className="dash-rec-text">{g.muscles}</span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="dash-body-cta-btn"
                  style={{
                    background: bodyStateInfo.ctaBg,
                    color: bodyStateInfo.ctaFg,
                  }}
                  onClick={bodyStateInfo.ctaAction}
                >
                  <AppIcon name={bodyStateInfo.ctaIcon} size={15} weight="bold" />
                  <span>{bodyStateInfo.ctaLabel}</span>
                </button>
              </div>

              <div className="dash-body-week-bar">
                <div className="dash-body-week-grid">
                  {bodyWeekDays.map((d, i) => (
                    <div key={i} className="dash-body-day-col">
                      <span
                        className="dash-body-day-pill"
                        style={{ background: d.bg, border: d.border }}
                      />
                      <span
                        className="dash-body-day-name"
                        style={{
                          color: d.textColor,
                          fontWeight: d.isBold ? 600 : 500,
                        }}
                      >
                        {d.name}
                      </span>
                    </div>
                  ))}
                </div>
                <span className="dash-body-week-stat">3/4 buổi</span>
              </div>
            </div>

            {/* CỘT 3: SẮP TỚI HẠN (Radar 3 ngày) */}
            <div className="dash-card">
              <div className="dash-card__head">
                <span className="dash-card__title">Sắp tới hạn</span>
                <span className="dash-card__meta">3 ngày tới</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {radarGrouped.map((grp, idx) => (
                  <div key={idx} className="dash-radar-group">
                    <span className="dash-radar-date-label">{grp.dayLabel}</span>
                    {grp.items.map((item, itemIdx) => (
                      <div key={itemIdx} className="dash-radar-item">
                        <span
                          className="dash-radar-item__icon"
                          style={{ background: item.iconBg, color: item.iconColor }}
                        >
                          <AppIcon name={item.icon} size={16} />
                        </span>
                        <div className="dash-radar-item__main">
                          <span className="dash-radar-item__title">{item.title}</span>
                          <span className="dash-radar-item__sub">{item.subtitle}</span>
                        </div>
                        <span className="dash-radar-item__val">{item.val}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════════════
            TẦNG 3: 📊 BỨC TRANH NHỊP SỐNG (Life Canvas Grid)
            ═════════════════════════════════════════════════════════════════════════ */}
        <div>
          <div className="dash-section-head" style={{ marginBottom: 14 }}>
            <span className="dash-section-head__title">Bức tranh nhịp sống</span>
            <span className="dash-section-head__sub">
              tháng {now.getMonth() + 1} và 30 ngày qua
            </span>
          </div>

          <div className="dash-bottom-grid">
            {/* KHỐI TRÁI: NGÂN SÁCH THÁNG */}
            <div className="dash-budget-card">
              <div className="dash-budget-card__head">
                <div className="dash-budget-card__title-box">
                  <span className="dash-budget-card__title">
                    Ngân sách tháng {now.getMonth() + 1}
                  </span>
                  <span className="dash-budget-card__main-num">
                    {monthBudget.spent.toLocaleString('vi-VN')}
                    <span className="dash-budget-card__main-limit">
                      {' '}/ {monthBudget.limit.toLocaleString('vi-VN')} ₫
                    </span>
                  </span>
                </div>

                <div className="dash-budget-card__stats-box">
                  <div className="dash-budget-stat-item">
                    <span className="dash-budget-stat-item__label">
                      Theo nhịp đến {now.getDate()}/{now.getMonth() + 1}
                    </span>
                    <span className="dash-budget-stat-item__val">
                      {monthBudget.paceToToday.toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <div className="dash-budget-stat-item">
                    <span className="dash-budget-stat-item__label">Dự kiến cuối tháng</span>
                    <span className="dash-budget-stat-item__val dash-budget-stat-item__val--warn">
                      {(monthBudget.projectedEnd / 1000000).toFixed(1).replace('.', ',')} tr
                      {monthBudget.diffFromLimit > 0
                        ? ` · vượt ${(monthBudget.diffFromLimit / 1000000).toFixed(1).replace('.', ',')} tr`
                        : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Biểu đồ SVG */}
              <div className="dash-budget-chart-box">
                <svg
                  viewBox="0 0 600 160"
                  preserveAspectRatio="none"
                  className="dash-budget-svg"
                >
                  <path
                    d={budgetChart.grid}
                    fill="none"
                    stroke="#F0EFEB"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d={budgetChart.limit}
                    fill="none"
                    stroke="#C23B22"
                    strokeWidth="1.25"
                    strokeDasharray="2 4"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d={budgetChart.pace}
                    fill="none"
                    stroke="#B9B7B0"
                    strokeWidth="1.25"
                    strokeDasharray="5 5"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path d={budgetChart.area} fill="rgba(224, 162, 60, 0.14)" />
                  <path
                    d={budgetChart.proj}
                    fill="none"
                    stroke="#E0A23C"
                    strokeWidth="1.75"
                    strokeDasharray="1 5"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d={budgetChart.line}
                    fill="none"
                    stroke="#E0A23C"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>

                <span
                  className="dash-chart-limit-tag"
                  style={{ top: budgetChart.limitTop }}
                >
                  hạn mức {budgetChart.limitText}
                </span>
                <span
                  className="dash-chart-proj-tag"
                  style={{ top: budgetChart.projTop }}
                >
                  {budgetChart.projText}
                </span>

                <span
                  className="dash-chart-dot"
                  style={{ left: budgetChart.dotL, top: budgetChart.dotT }}
                />
                <span
                  className="dash-chart-tooltip"
                  style={{ left: budgetChart.dotL, top: budgetChart.dotT }}
                >
                  {budgetChart.spentText}
                </span>
              </div>

              {/* Mốc thời gian trục X */}
              <div className="dash-chart-ticks">
                {budgetChart.ticks.map((tk, idx) => (
                  <span
                    key={idx}
                    className="dash-chart-tick"
                    style={{
                      left: tk.left,
                      transform: tk.transform,
                      color: tk.isToday ? 'var(--dash-text)' : 'var(--dash-text-muted)',
                      fontWeight: tk.isToday ? 600 : 400,
                    }}
                  >
                    {tk.label}
                  </span>
                ))}
              </div>

              {/* Legend biểu đồ */}
              <div className="dash-chart-legend">
                <span className="dash-chart-legend__item">
                  <span style={{ width: 14, height: 2.5, borderRadius: 2, background: '#E0A23C' }} />
                  <span>Đã chi cộng dồn</span>
                </span>
                <span className="dash-chart-legend__item">
                  <span style={{ width: 14, borderTop: '1.5px dashed #B9B7B0' }} />
                  <span>Nhịp đều theo ngày</span>
                </span>
                <span className="dash-chart-legend__item">
                  <span style={{ width: 14, borderTop: '1.5px dotted #E0A23C' }} />
                  <span>Dự kiến</span>
                </span>
              </div>

              {/* 4 Danh mục con */}
              <div className="dash-budget-cats-grid">
                {budgetCategories.map((c) => (
                  <div key={c.name} className="dash-budget-cat-item">
                    <div className="dash-budget-cat-head">
                      <span className="dash-budget-cat-name">{c.name}</span>
                      <span className="dash-budget-cat-pct">{c.pct}</span>
                    </div>
                    <span className="dash-progress-track">
                      <span
                        className="dash-progress-bar"
                        style={{ width: c.pct, background: c.color }}
                      />
                    </span>
                    <span className="dash-budget-cat-val">{c.valText}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* KHỐI PHẢI: LỊCH THANH TOÁN (Payment Calendar) */}
            <div className="dash-calendar-card">
              <div className="dash-card__head">
                <span className="dash-card__title">
                  Lịch thanh toán tháng {now.getMonth() + 1}
                </span>
                <span className="dash-card__meta">
                  {paymentCalendar.paidCount}/{paymentCalendar.totalCount} đã trả
                </span>
              </div>

              <div className="dash-calendar-grid">
                {SHORT_WEEKDAYS.map((w) => (
                  <span key={w} className="dash-calendar-weekday">
                    {w}
                  </span>
                ))}

                {paymentCalendar.cells.map((cell, idx) => (
                  <div
                    key={idx}
                    title={cell.title}
                    className="dash-cal-cell"
                    style={{
                      background: cell.bg,
                      boxShadow: cell.isToday ? 'inset 0 0 0 1.5px #15161A' : 'none',
                    }}
                  >
                    <span
                      className="dash-cal-cell__day"
                      style={{
                        color: cell.fg,
                        fontWeight: cell.isBold ? 600 : 400,
                      }}
                    >
                      {cell.dayNum}
                    </span>
                    <span
                      className="dash-cal-cell__amt"
                      style={{ color: cell.fg }}
                    >
                      {cell.amtText}
                    </span>
                  </div>
                ))}
              </div>

              <div className="dash-cal-footer">
                <span className="dash-cal-footer__left">
                  Còn phải trả <strong>{paymentCalendar.payLeftText}</strong>
                </span>

                <div className="dash-cal-legends">
                  <span className="dash-cal-legend-item">
                    <span className="dash-cal-legend-box" style={{ background: '#E3F2E8' }} />
                    <span>Đã trả</span>
                  </span>
                  <span className="dash-cal-legend-item">
                    <span className="dash-cal-legend-box" style={{ background: '#FBE3DD' }} />
                    <span>Quá hạn</span>
                  </span>
                  <span className="dash-cal-legend-item">
                    <span className="dash-cal-legend-box" style={{ background: '#FBF0DC' }} />
                    <span>Hôm nay</span>
                  </span>
                  <span className="dash-cal-legend-item">
                    <span className="dash-cal-legend-box" style={{ background: '#F0EFEB' }} />
                    <span>Sắp tới</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 5 Card Phân hệ cốt lõi (Module Hub) */}
          <div className="dash-modules-grid" style={{ marginTop: 14 }}>
            {/* Module 1: Nhiệm Vụ */}
            <Link to="/tasks" className="dash-mod-card">
              <div className="dash-mod-card__top">
                <span
                  className="dash-mod-card__icon-box"
                  style={{ background: 'rgba(59, 111, 216, 0.12)', color: '#3B6FD8' }}
                >
                  <AppIcon name="pushPin" size={15} weight="fill" />
                </span>
                <span className="dash-mod-card__name">Nhiệm Vụ</span>
                <AppIcon name="arrowUpRight" size={14} className="dash-mod-card__arrow" />
              </div>
              <div className="dash-mod-card__main-stat">
                <span className="dash-mod-card__big-num">
                  41<span className="dash-mod-card__big-unit"> việc xong</span>
                </span>
                <span className="dash-mod-card__sub-stat">14 ngày · 86% đúng hạn</span>
              </div>
              <div className="dash-sparklines-14">
                {taskBars.map((v, i) => (
                  <span
                    key={i}
                    className="dash-spark-bar"
                    style={{
                      height: `${(v / 5) * 100}%`,
                      background: i === taskBars.length - 1 ? '#3B6FD8' : 'rgba(59, 111, 216, 0.32)',
                    }}
                  />
                ))}
              </div>
            </Link>

            {/* Module 2: Tài Chính */}
            <Link to="/finance" className="dash-mod-card">
              <div className="dash-mod-card__top">
                <span
                  className="dash-mod-card__icon-box"
                  style={{ background: 'rgba(47, 138, 87, 0.12)', color: '#2F8A57' }}
                >
                  <AppIcon name="wallet" size={15} weight="fill" />
                </span>
                <span className="dash-mod-card__name">Tài Chính</span>
                <AppIcon name="arrowUpRight" size={14} className="dash-mod-card__arrow" />
              </div>
              <div className="dash-mod-card__main-stat">
                <span className="dash-mod-card__big-num">
                  765k<span className="dash-mod-card__big-unit"> / ngày</span>
                </span>
                <span className="dash-mod-card__sub-stat">chi trung bình · tháng trước 820k</span>
              </div>
              <div className="dash-sparklines-8">
                {finBars.map((v, i) => (
                  <span
                    key={i}
                    className="dash-spark-bar"
                    style={{
                      height: `${(v / 1.55) * 100}%`,
                      background: i === finBars.length - 1 ? '#2F8A57' : 'rgba(47, 138, 87, 0.32)',
                    }}
                  />
                ))}
              </div>
            </Link>

            {/* Module 3: Body */}
            <Link to="/body" className="dash-mod-card">
              <div className="dash-mod-card__top">
                <span
                  className="dash-mod-card__icon-box"
                  style={{ background: 'rgba(105, 73, 232, 0.12)', color: '#6949E8' }}
                >
                  <AppIcon name="heart" size={15} weight="fill" />
                </span>
                <span className="dash-mod-card__name">Body</span>
                <AppIcon name="arrowUpRight" size={14} className="dash-mod-card__arrow" />
              </div>
              <div className="dash-mod-card__main-stat">
                <span className="dash-mod-card__big-num">
                  64,95<span className="dash-mod-card__big-unit"> kg</span>
                </span>
                <span className="dash-mod-card__sub-stat">còn 1,95 kg tới 63 kg</span>
              </div>
              <svg viewBox="0 0 200 52" preserveAspectRatio="none" style={{ width: '100%', height: 52 }}>
                <path
                  d="M0 38 L200 38"
                  fill="none"
                  stroke="#2F8A57"
                  strokeWidth="1.25"
                  strokeDasharray="3 4"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d="M0 12 Q 50 18, 100 24 T 200 35"
                  fill="none"
                  stroke="#6949E8"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </Link>

            {/* Module 4: Knowledge */}
            <Link to="/collect" className="dash-mod-card">
              <div className="dash-mod-card__top">
                <span
                  className="dash-mod-card__icon-box"
                  style={{ background: 'rgba(224, 162, 60, 0.16)', color: '#B57A12' }}
                >
                  <AppIcon name="brain" size={15} weight="fill" />
                </span>
                <span className="dash-mod-card__name">Knowledge</span>
                <AppIcon name="arrowUpRight" size={14} className="dash-mod-card__arrow" />
              </div>
              <div className="dash-mod-card__main-stat">
                <span className="dash-mod-card__big-num">
                  214<span className="dash-mod-card__big-unit"> ghi chú</span>
                </span>
                <span className="dash-mod-card__sub-stat">+9 tuần này · 3 thẻ cần ôn</span>
              </div>
              <div className="dash-sparklines-8">
                {knowledgeBars.map((v, i) => (
                  <span
                    key={i}
                    className="dash-spark-bar"
                    style={{
                      height: `${(v / 11) * 100}%`,
                      background: i === knowledgeBars.length - 1 ? '#E0A23C' : 'rgba(224, 162, 60, 0.35)',
                    }}
                  />
                ))}
              </div>
            </Link>

            {/* Module 5: Vault */}
            <Link to="/accounts" className="dash-mod-card">
              <div className="dash-mod-card__top">
                <span
                  className="dash-mod-card__icon-box"
                  style={{ background: '#ECEBE6', color: '#15161A' }}
                >
                  <AppIcon name="lock" size={15} weight="fill" />
                </span>
                <span className="dash-mod-card__name">Vault</span>
                <AppIcon name="arrowUpRight" size={14} className="dash-mod-card__arrow" />
              </div>
              <div className="dash-mod-card__main-stat">
                <span className="dash-mod-card__big-num">
                  86<span className="dash-mod-card__big-unit"> mục</span>
                </span>
                <span className="dash-mod-card__sub-stat dash-mod-card__sub-stat--warn">
                  2 giấy tờ hết hạn trong 60 ngày
                </span>
              </div>
              <div className="dash-vault-preview">
                <div className="dash-vault-preview-row">
                  <span>Hộ chiếu</span>
                  <span className="dash-vault-preview-date">14/11</span>
                </div>
                <div className="dash-vault-preview-row">
                  <span>Bảo hiểm xe máy</span>
                  <span className="dash-vault-preview-date">2/12</span>
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
