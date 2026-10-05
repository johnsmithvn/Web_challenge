import { useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { formatDate } from '../../utils/dateUtils';
import {
  parseYmd, monthStart, monthEnd,
} from '../../utils/financeLogic';
import { money, catInfo, subLabel } from './parts';
import AppIcon from '../AppIcon';
import '../../styles/finance-report.css';

// ── Bảng màu chuẩn quy chuẩn thiết kế (Ruler spec) ──────────────────────────
const GROUP_PALETTE = {
  debt: { col: '#6949E8', soft: '#EFEBFE' },      // Tài chính & Nợ
  housing: { col: '#12A594', soft: '#E2F5F2' },   // Nhà ở & Hóa đơn
  food: { col: '#E08A20', soft: '#FBEEDC' },      // Ăn uống
  transport: { col: '#2F80ED', soft: '#E4EFFD' }, // Đi lại
  personal: { col: '#E0446D', soft: '#FCE7EC' },  // Cá nhân & Giải trí
  family: { col: '#9A4FE0', soft: '#F3E8FD' },    // Gia đình & Học tập
};

const DEFAULT_CARDS = {
  metrics: true,
  sparks: true,
  periodDiff: true,
  outliers: true,
  trend: true,
  yoy: true,
  rank: true,
  dow: true,
  treemap: true,
  pareto: true,
  necessity: true,
  calHeatmap: true,
  hist: false,
  merchants: true,
};

const CARD_DEFS = [
  { id: 'metrics', name: 'So kỳ trước & Cố định', size: '1/2' },
  { id: 'sparks', name: 'Sparkline sáu nhóm', size: 'full' },
  { id: 'periodDiff', name: 'Kỳ này với kỳ trước', size: 'full' },
  { id: 'outliers', name: 'Khoản lớn bất thường', size: '1/2' },
  { id: 'trend', name: 'Chi 12 tháng', size: 'full' },
  { id: 'yoy', name: 'Cùng kỳ năm trước', size: 'full' },
  { id: 'rank', name: 'Xếp hạng nhóm', size: '1/2' },
  { id: 'dow', name: 'Chi theo thứ', size: '1/3' },
  { id: 'treemap', name: 'Bản đồ danh mục', size: '1/3' },
  { id: 'pareto', name: 'Pareto 80/20', size: '1/3' },
  { id: 'necessity', name: 'Phải trả và Tùy chọn', size: '1/3' },
  { id: 'calHeatmap', name: 'Lịch chi tháng', size: '1/3' },
  { id: 'hist', name: 'Phân bố số tiền', size: '1/3' },
  { id: 'merchants', name: 'Nơi chi nhiều nhất', size: '1/3' },
];

function compactVND(val) {
  const n = Math.abs(Number(val) || 0);
  if (n >= 1_000_000) {
    const tr = (n / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
    return `${tr}tr`;
  }
  if (n >= 1_000) {
    return `${Math.round(n / 1_000)}k`;
  }
  return money(n);
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

// `lead(period)`: nội dung Tổng quan vẽ phía trên Báo cáo, dùng chung bộ chọn kỳ.
export default function ReportScreen({ fin, nav, lead, footer }) {
  const [expandedDiffGroups, setExpandedDiffGroups] = useState(() => new Set());

  const toggleExpandDiffGroup = (groupKey) => {
    setExpandedDiffGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };
  // ── 1. Quản lý chế độ & kỳ báo cáo ─────────────────────────────────────────
  const [mode, setMode] = useState('month'); // 'month' | 'quarter' | 'year'
  const [showAllRanks, setShowAllRanks] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());

  const toggleExpandGroup = (groupKey) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const todayDate = useMemo(() => parseYmd(fin.today), [fin.today]);
  const [targetYear, setTargetYear] = useState(() => todayDate.getFullYear());
  const [targetMonth, setTargetMonth] = useState(() => todayDate.getMonth()); // 0 - 11

  // Tính ngày bắt đầu và kết thúc của kỳ hiện tại
  const period = useMemo(() => {
    if (mode === 'year') {
      return {
        from: `${targetYear}-01-01`,
        to: `${targetYear}-12-31`,
        label: `Năm ${targetYear}`,
      };
    }
    if (mode === 'quarter') {
      const q = Math.floor(targetMonth / 3); // 0, 1, 2, 3
      const startM = q * 3;
      const endM = q * 3 + 2;
      return {
        from: monthStart(targetYear, startM),
        to: monthEnd(targetYear, endM),
        label: `Quý ${q + 1}/${targetYear}`,
      };
    }
    // 'month'
    return {
      from: monthStart(targetYear, targetMonth),
      to: monthEnd(targetYear, targetMonth),
      label: `Tháng ${targetMonth + 1}/${targetYear}`,
    };
  }, [mode, targetYear, targetMonth]);

  // Stepper previous / next
  const stepPeriod = (dir) => {
    if (mode === 'year') {
      setTargetYear(y => y + dir);
    } else if (mode === 'quarter') {
      const q = Math.floor(targetMonth / 3) + dir;
      if (q < 0) {
        setTargetYear(y => y - 1);
        setTargetMonth(9);
      } else if (q > 3) {
        setTargetYear(y => y + 1);
        setTargetMonth(0);
      } else {
        setTargetMonth(q * 3);
      }
    } else {
      let m = targetMonth + dir;
      let y = targetYear;
      if (m < 0) {
        m = 11;
        y -= 1;
      } else if (m > 11) {
        m = 0;
        y += 1;
      }
      setTargetMonth(m);
      setTargetYear(y);
    }
  };

  // ── 2. Quản lý hiển thị thẻ (Card Manager) ──────────────────────────────────
  const [cards, setCards] = useState(() => {
    try {
      const saved = localStorage.getItem('vl_report_cards');
      return saved ? { ...DEFAULT_CARDS, ...JSON.parse(saved) } : DEFAULT_CARDS;
    } catch {
      return DEFAULT_CARDS;
    }
  });
  const [mgrOpen, setMgrOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const mgrRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!isMobile && mgrRef.current && !mgrRef.current.contains(e.target)) {
        setMgrOpen(false);
      }
    };
    if (mgrOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mgrOpen, isMobile]);

  const toggleCard = (id) => {
    setCards(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem('vl_report_cards', JSON.stringify(next));
      } catch {
        void 0;
      }
      return next;
    });
  };

  const shownCount = CARD_DEFS.filter(c => cards[c.id]).length;

  // ── 3. Lọc & Tính toán dữ liệu chi tiêu ─────────────────────────────────────
  // Giao dịch chi tiêu trong kỳ
  const periodTxs = useMemo(() => {
    return fin.transactions.filter(t => t.type === 'expense' && !t.excluded
      && t.occurred_at >= period.from && t.occurred_at <= period.to);
  }, [fin.transactions, period]);

  const totalSpend = useMemo(() => {
    return periodTxs.reduce((sum, t) => sum + t.amount, 0);
  }, [periodTxs]);

  const activeDays = useMemo(() => {
    return new Set(periodTxs.map(t => t.occurred_at)).size;
  }, [periodTxs]);

  // Kỳ cùng kỳ năm trước (YoY) hoặc kỳ liền trước
  const prevPeriod = useMemo(() => {
    if (mode === 'year') {
      const py = targetYear - 1;
      return { from: `${py}-01-01`, to: `${py}-12-31` };
    }
    if (mode === 'quarter') {
      const py = targetYear - 1;
      const q = Math.floor(targetMonth / 3);
      return { from: monthStart(py, q * 3), to: monthEnd(py, q * 3 + 2) };
    }
    // Month: so sánh cùng kỳ năm trước (YoY)
    const py = targetYear - 1;
    return { from: monthStart(py, targetMonth), to: monthEnd(py, targetMonth) };
  }, [mode, targetYear, targetMonth]);

  const prevTotal = useMemo(() => {
    return fin.transactions
      .filter(t => t.type === 'expense' && !t.excluded
        && t.occurred_at >= prevPeriod.from && t.occurred_at <= prevPeriod.to)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [fin.transactions, prevPeriod]);

  const yoyDelta = useMemo(() => {
    if (!prevTotal) return null;
    return Math.round(((totalSpend - prevTotal) / prevTotal) * 100);
  }, [totalSpend, prevTotal]);

  // Giao dịch kỳ liền trước (dành cho so sánh Kỳ này với kỳ trước: T9 vs T8, Q3 vs Q2, Năm N vs Năm N-1)
  const prevPeriodTxs = useMemo(() => {
    let pFrom = '';
    let pTo = '';
    if (mode === 'year') {
      pFrom = `${targetYear - 1}-01-01`;
      pTo = `${targetYear - 1}-12-31`;
    } else if (mode === 'quarter') {
      const q = Math.floor(targetMonth / 3);
      const prevQ = q === 0 ? 3 : q - 1;
      const prevY = q === 0 ? targetYear - 1 : targetYear;
      pFrom = monthStart(prevY, prevQ * 3);
      pTo = monthEnd(prevY, prevQ * 3 + 2);
    } else {
      const prevM = targetMonth === 0 ? 11 : targetMonth - 1;
      const prevY = targetMonth === 0 ? targetYear - 1 : targetYear;
      pFrom = monthStart(prevY, prevM);
      pTo = monthEnd(prevY, prevM);
    }

    return fin.transactions.filter(t =>
      t.type === 'expense' && !t.excluded &&
      t.occurred_at >= pFrom && t.occurred_at <= pTo
    );
  }, [fin.transactions, mode, targetYear, targetMonth]);

  // Nhóm chi tiêu và màu sắc
  const expenseGroups = useMemo(() => {
    return (fin.cats?.expenseGroups || []).filter(g => !g.hidden);
  }, [fin.cats]);

  const catSums = useMemo(() => {
    const map = {};
    for (const t of periodTxs) {
      const k = t.category_id || 'other';
      map[k] = (map[k] || 0) + t.amount;
    }
    return map;
  }, [periodTxs]);

  // Danh sách các nhóm chi có số liệu hoặc mặc định
  const catRows = useMemo(() => {
    return expenseGroups.map(g => {
      const amount = catSums[g.key] || 0;
      const pct = totalSpend ? (amount / totalSpend) * 100 : 0;
      const palette = GROUP_PALETTE[g.key] || { col: g.color || '#6949E8', soft: '#EFEBFE' };

      // Breakdown danh mục con trong nhóm này
      const groupTxs = periodTxs.filter(t => (t.category_id || 'other') === g.key);
      const subMap = {};
      let unassignedAmount = 0;
      for (const t of groupTxs) {
        if (t.subcategory_id) {
          subMap[t.subcategory_id] = (subMap[t.subcategory_id] || 0) + t.amount;
        } else {
          unassignedAmount += t.amount;
        }
      }
      const subRows = Object.entries(subMap).map(([subId, subAmt]) => ({
        key: subId,
        name: subLabel(subId, fin.cats) || subId,
        amount: subAmt,
        pct: amount ? (subAmt / amount) * 100 : 0,
      })).sort((a, b) => b.amount - a.amount);

      if (unassignedAmount > 0) {
        subRows.push({
          key: `${g.key}.other`,
          name: 'Chưa phân loại con',
          amount: unassignedAmount,
          pct: amount ? (unassignedAmount / amount) * 100 : 0,
        });
      }

      return {
        key: g.key,
        name: g.label,
        amount,
        pct,
        col: palette.col,
        soft: palette.soft,
        subs: subRows,
      };
    }).sort((a, b) => b.amount - a.amount);
  }, [expenseGroups, catSums, totalSpend, periodTxs, fin.cats]);

  // Các nhóm có chi tiêu trong kỳ & số lượng ẩn
  const activeCatRows = useMemo(() => catRows.filter(c => c.amount > 0), [catRows]);
  const displayedRankRows = showAllRanks ? activeCatRows : activeCatRows.slice(0, 6);
  const hiddenCount = Math.max(0, activeCatRows.length - 6);
  const hiddenAmount = useMemo(() => {
    if (hiddenCount <= 0) return 0;
    return activeCatRows.slice(6).reduce((sum, c) => sum + c.amount, 0);
  }, [activeCatRows, hiddenCount]);

  const topCategory = catRows[0] || { name: 'Chưa có', amount: 0, pct: 0, col: '#6949E8' };
  const maxCategoryAmount = topCategory.amount || 1;

  // Donut slices SVG
  const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 70; // ~439.82
  const donutSlices = useMemo(() => {
    if (!totalSpend) return [];
    let acc = 0;
    return catRows.filter(c => c.amount > 0).map(c => {
      const len = (CIRCLE_CIRCUMFERENCE * c.pct) / 100;
      const dash = `${Math.max(0, len - 2.5).toFixed(1)} ${(CIRCLE_CIRCUMFERENCE - len + 2.5).toFixed(1)}`;
      const off = (-acc).toFixed(1);
      acc += len;
      return { col: c.col, dash, off };
    });
  }, [catRows, totalSpend, CIRCLE_CIRCUMFERENCE]);

  // Top 3 nhóm chi trên dark card
  const top3 = useMemo(() => {
    return catRows.slice(0, 3).map((c) => {
      const count = periodTxs.filter(t => t.category_id === c.key).length;
      return {
        key: c.key,
        n: c.name,
        v: money(c.amount),
        col: c.col,
        w: Math.round((c.amount / maxCategoryAmount) * 100),
        note: `${count} khoản · ${c.pct.toFixed(1).replace('.', ',')}%`,
      };
    });
  }, [catRows, periodTxs, maxCategoryAmount]);

  // ── 4. Dải Sparkline 6 nhóm (6 tháng gần nhất) ─────────────────────────────
  const sparklineData = useMemo(() => {
    // 6 tháng tính lùi từ targetYear, targetMonth
    const pastMonths = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(targetYear, targetMonth - i, 1);
      const y = d.getFullYear(), m = d.getMonth();
      pastMonths.push({
        from: monthStart(y, m),
        to: monthEnd(y, m),
      });
    }

    const poly = (arr, w, h, pad) => {
      const mx = Math.max.apply(null, arr), mnv = Math.min.apply(null, arr), rng = (mx - mnv) || 1;
      return arr.map((v, idx) => (idx * (w / (arr.length - 1))).toFixed(1) + ',' + (h - pad - ((v - mnv) / rng) * (h - pad * 2)).toFixed(1));
    };

    return catRows.slice(0, 6).map(c => {
      const monthlyValues = pastMonths.map(pm => {
        return fin.transactions
          .filter(t => t.category_id === c.key && t.type === 'expense' && !t.excluded
            && t.occurred_at >= pm.from && t.occurred_at <= pm.to)
          .reduce((sum, t) => sum + t.amount, 0);
      });

      const p = poly(monthlyValues, 120, 34, 4);
      const last = monthlyValues[5] || 0;
      const prev = monthlyValues[4] || 0;
      let d = '0%';
      let dfg = '#8A8A84';
      if (!prev && last > 0) {
        d = 'mới';
      } else if (prev > 0) {
        const diff = Math.round(((last - prev) / prev) * 100);
        if (diff > 0) {
          d = `+${diff}%`;
          dfg = '#B42318';
        } else if (diff < 0) {
          d = `${diff}%`.replace('-', '−');
          dfg = '#067647';
        }
      }

      return {
        key: c.key,
        n: c.name,
        v: compactVND(c.amount),
        d,
        dfg,
        col: c.col,
        soft: c.soft,
        path: 'M' + p.join(' L'),
        area: 'M' + p.join(' L') + ' L120,34 L0,34 Z',
      };
    });
  }, [catRows, targetYear, targetMonth, fin.transactions]);

  // ── 5. Chi 12 tháng (trend) ───────────────────────────────────────────────
  const trendData = useMemo(() => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(targetYear, targetMonth - i, 1);
      const y = d.getFullYear(), m = d.getMonth();
      months.push({
        n: `T${m + 1}`,
        from: monthStart(y, m),
        to: monthEnd(y, m),
        isCurrent: i === 0,
      });
    }

    const values = months.map(m => {
      return fin.transactions
        .filter(t => t.type === 'expense' && !t.excluded && t.occurred_at >= m.from && t.occurred_at <= m.to)
        .reduce((sum, t) => sum + t.amount, 0);
    });

    const total12 = values.reduce((a, b) => a + b, 0);
    const avgMonthly = total12 ? total12 / 12 : 0;
    const avgMillions = (avgMonthly / 1_000_000).toFixed(2).replace('.', ',');

    const W = 720, H = 170;
    const maxVal = Math.max(1_000_000, ...values);
    const pts = values.map((v, idx) => {
      const x = +(idx * (W / 11)).toFixed(1);
      const y = +(H - (v / maxVal) * 150).toFixed(1);
      return [x, y];
    });

    const trendLine = 'M' + pts.map(p => p[0] + ',' + p[1]).join(' L');
    const trendArea = trendLine + ' L' + W + ',' + H + ' L0,' + H + ' Z';
    const trendDots = pts.map((p, idx) => ({
      x: p[0],
      y: p[1],
      r: idx === 11 ? 5 : 3,
      fill: idx === 11 ? '#6949E8' : '#B4A6F5',
      sw: idx === 11 ? 2.5 : 0,
    }));

    const avgY = +(H - (avgMonthly / maxVal) * 150).toFixed(1);

    return {
      trendLine,
      trendArea,
      trendDots,
      avgY,
      avgMillions,
      months,
    };
  }, [targetYear, targetMonth, fin.transactions]);

  // ── 6. Chi theo thứ (DOW) ──────────────────────────────────────────────────
  const dowData = useMemo(() => {
    // 12 tháng gần nhất
    const startRange = monthStart(targetYear, targetMonth - 11);
    const endRange = monthEnd(targetYear, targetMonth);
    const txs = fin.transactions.filter(t => t.type === 'expense' && !t.excluded
      && t.occurred_at >= startRange && t.occurred_at <= endRange);

    const DOW_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const sums = [0, 0, 0, 0, 0, 0, 0];
    for (const t of txs) {
      const dayIdx = parseYmd(t.occurred_at).getDay(); // 0: CN, 1: T2...
      sums[dayIdx] += t.amount;
    }

    // Đưa T2 lên đầu: [T2, T3, T4, T5, T6, T7, CN]
    const ordered = [
      { n: 'T2', amount: sums[1] },
      { n: 'T3', amount: sums[2] },
      { n: 'T4', amount: sums[3] },
      { n: 'T5', amount: sums[4] },
      { n: 'T6', amount: sums[5] },
      { n: 'T7', amount: sums[6] },
      { n: 'CN', amount: sums[0] },
    ];

    const maxDow = Math.max(1, ...ordered.map(d => d.amount));
    const peak = ordered.reduce((p, d) => d.amount > p.amount ? d : p, ordered[0]);

    return {
      peakName: peak.n === 'CN' ? 'Chủ nhật' : `thứ ${peak.n.slice(1)}`,
      bars: ordered.map(d => {
        const isPeak = d.amount === peak.amount && d.amount > 0;
        return {
          n: d.n,
          v: (d.amount / 1_000_000).toFixed(1).replace('.', ','),
          h: Math.max(4, Math.round((d.amount / maxDow) * 100)),
          bg: isPeak ? '#6949E8' : '#DEDCD5',
          vfg: isPeak ? '#15161A' : '#B5B4AE',
        };
      }),
    };
  }, [targetYear, targetMonth, fin.transactions]);

  // ── 7. Bản đồ danh mục (Treemap) ──────────────────────────────────────────
  const treemapItems = useMemo(() => {
    const list = catRows.filter(c => c.amount > 0);
    return {
      major: list[0] || null,
      sub1: list[1] || null,
      sub2: list[2] || null,
      sub3: list[3] || null,
      sub4: list[4] || null,
      sub5: list[5] || null,
      remaining: list.slice(4),
    };
  }, [catRows]);

  // ── 8. Pareto 80/20 ───────────────────────────────────────────────────────
  const paretoData = useMemo(() => {
    const list = catRows.slice(0, 6);
    const pareto = list.map((c, i) => {
      const cum = list.slice(0, i + 1).reduce((sum, item) => sum + item.pct, 0);
      const h = Math.max(4, Math.round((c.amount / maxCategoryAmount) * 140));
      return {
        x: 8 + i * 69,
        y: 170 - h,
        h,
        col: c.col,
        short: c.name.split('&')[0].trim(),
        cx: 30 + i * 69,
        cy: +(170 - (cum / 100) * 140).toFixed(1),
        cumPct: Math.round(cum),
      };
    });

    const paretoLine = pareto.length ? 'M' + pareto.map(p => p.cx + ',' + p.cy).join(' L') : '';
    const top2Pct = pareto.length >= 2 ? pareto[1].cumPct : (pareto[0]?.cumPct || 0);

    return {
      bars: pareto,
      paretoLine,
      top2Pct,
    };
  }, [catRows, maxCategoryAmount]);

  // ── 9. Phân bố số tiền (Histogram) ─────────────────────────────────────────
  const histData = useMemo(() => {
    const buckets = [
      { n: 'dưới 50k', min: 0, max: 50_000, c: 0 },
      { n: '50k–200k', min: 50_000, max: 200_000, c: 0 },
      { n: '200k–500k', min: 200_000, max: 500_000, c: 0 },
      { n: '500k–1tr', min: 500_000, max: 1_000_000, c: 0 },
      { n: 'trên 1tr', min: 1_000_000, max: Infinity, c: 0 },
    ];

    for (const t of periodTxs) {
      const b = buckets.find(item => t.amount >= item.min && t.amount < item.max);
      if (b) b.c += 1;
    }

    const maxCount = Math.max(1, ...buckets.map(b => b.c));
    return buckets.map(b => ({
      n: b.n,
      c: b.c,
      h: Math.max(3, Math.round((b.c / maxCount) * 100)),
      bg: b.c === 0 ? '#F0EFEA' : '#6949E8',
    }));
  }, [periodTxs]);

  // ── 10. Nơi chi nhiều nhất (Merchants) ─────────────────────────────────────
  const merchantData = useMemo(() => {
    const map = {};
    for (const t of periodTxs) {
      const name = (t.merchant || t.note || 'Chi tiêu khác').trim();
      if (!map[name]) {
        map[name] = { amount: 0, catId: t.category_id };
      }
      map[name].amount += t.amount;
    }

    const sorted = Object.entries(map).map(([name, data]) => ({
      n: name,
      amount: data.amount,
      col: GROUP_PALETTE[data.catId]?.col || '#6949E8',
    })).sort((a, b) => b.amount - a.amount).slice(0, 5);

    const maxM = sorted[0]?.amount || 1;
    return sorted.map(m => ({
      ...m,
      v: money(m.amount),
      p: Math.max(4, Math.round((m.amount / maxM) * 100)),
    }));
  }, [periodTxs]);

  // ── 10b. Biểu đồ Kỳ này với kỳ trước (so sánh từng nhóm và danh mục con) ───
  const periodDiffData = useMemo(() => {
    const curLabel = period.label.split('/')[0] || period.label;
    const curLabelShort = mode === 'month' ? `T${targetMonth + 1}` : mode === 'quarter' ? `Q${Math.floor(targetMonth / 3) + 1}` : `${targetYear}`;
    let prevLabelShort = 'Kỳ trước';
    if (mode === 'month') {
      const pm = targetMonth === 0 ? 12 : targetMonth;
      prevLabelShort = `T${pm}`;
    } else if (mode === 'quarter') {
      const pq = Math.floor(targetMonth / 3) === 0 ? 4 : Math.floor(targetMonth / 3);
      prevLabelShort = `Q${pq}`;
    } else {
      prevLabelShort = `${targetYear - 1}`;
    }
    const prevLabel = `Kỳ trước (${prevLabelShort})`;

    const groupRows = expenseGroups.map(g => {
      const palette = GROUP_PALETTE[g.key] || { col: '#6949E8' };
      const curGroupTxs = periodTxs.filter(t => (t.category_id || 'other') === g.key);
      const prevGroupTxs = prevPeriodTxs.filter(t => (t.category_id || 'other') === g.key);

      const curAmt = curGroupTxs.reduce((s, t) => s + t.amount, 0);
      const prevAmt = prevGroupTxs.reduce((s, t) => s + t.amount, 0);

      // Chi tiết theo subcategory
      const subKeys = new Set([
        ...curGroupTxs.map(t => t.subcategory_id || 'other'),
        ...prevGroupTxs.map(t => t.subcategory_id || 'other'),
      ]);

      const subs = Array.from(subKeys).map(subId => {
        const cSubAmt = curGroupTxs
          .filter(t => (t.subcategory_id || 'other') === subId)
          .reduce((s, t) => s + t.amount, 0);
        const pSubAmt = prevGroupTxs
          .filter(t => (t.subcategory_id || 'other') === subId)
          .reduce((s, t) => s + t.amount, 0);

        const sDelta = cSubAmt - pSubAmt;
        const sPct = pSubAmt > 0 ? Math.round((sDelta / pSubAmt) * 100) : 0;
        const sName = subId === 'other' ? 'Chưa phân loại' : (subLabel(subId, fin.cats) || subId);

        return {
          key: subId,
          name: sName,
          curAmt: cSubAmt,
          prevAmt: pSubAmt,
          delta: sDelta,
          pct: sPct,
          isNew: pSubAmt === 0 && cSubAmt > 0,
        };
      }).filter(s => s.curAmt > 0 || s.prevAmt > 0)
        .sort((a, b) => b.curAmt - a.curAmt);

      const delta = curAmt - prevAmt;
      const pct = prevAmt > 0 ? Math.round((delta / prevAmt) * 100) : 0;

      return {
        key: g.key,
        name: g.label,
        col: palette.col,
        curAmt,
        prevAmt,
        delta,
        pct,
        isNew: prevAmt === 0 && curAmt > 0,
        subs,
      };
    }).filter(r => r.curAmt > 0 || r.prevAmt > 0)
      .sort((a, b) => b.curAmt - a.curAmt);

    const maxRowVal = Math.max(
      ...groupRows.flatMap(r => [r.curAmt, r.prevAmt]),
      1
    );

    return {
      curLabel,
      curLabelShort,
      prevLabel,
      prevLabelShort,
      rows: groupRows,
      maxRowVal,
    };
  }, [period.label, mode, targetMonth, targetYear, expenseGroups, periodTxs, prevPeriodTxs, fin.cats]);

  // ── 10c. Biểu đồ Khoản lớn bất thường (Outliers so với mức thường 3 tháng) ──
  const outlierData = useMemo(() => {
    const threeMonthsAgoStart = monthStart(targetYear, targetMonth - 3);
    const prevMonthEnd = monthEnd(targetYear, targetMonth - 1);

    const past3mTxs = fin.transactions.filter(t =>
      t.type === 'expense' && !t.excluded &&
      t.occurred_at >= threeMonthsAgoStart && t.occurred_at <= prevMonthEnd
    );

    const subStats = {};
    for (const t of past3mTxs) {
      const k = t.subcategory_id || t.category_id || 'other';
      if (!subStats[k]) subStats[k] = { total: 0, count: 0 };
      subStats[k].total += t.amount;
      subStats[k].count += 1;
    }

    const items = [];
    let normalCount = 0;

    for (const t of periodTxs) {
      const k = t.subcategory_id || t.category_id || 'other';
      const stats = subStats[k];
      const avg3m = stats && stats.count > 0 ? Math.round(stats.total / stats.count) : 0;
      const subName = subLabel(t.subcategory_id, fin.cats) || catInfo(t.category_id, fin.cats).label;
      const name = (t.merchant || t.note || subName).trim();
      const dateStr = t.occurred_at ? formatDate(t.occurred_at).slice(0, 5) : '';

      if (avg3m > 0 && t.amount >= avg3m * 1.4 && t.amount >= 200_000) {
        const ratio = (t.amount / avg3m).toFixed(1).replace('.', ',');
        items.push({
          id: t.id,
          date: dateStr,
          subName,
          name,
          amount: t.amount,
          avg3m,
          ratio,
          type: 'surge',
          badge: `×${ratio}`,
          note: `Mức thường 3 tháng: ${money(avg3m)} (vạch đen)`,
        });
      } else if (!stats && t.amount >= 500_000) {
        items.push({
          id: t.id,
          date: dateStr,
          subName,
          name,
          amount: t.amount,
          avg3m: 0,
          type: 'new',
          badge: 'Lần đầu',
          note: 'Chưa có khoản này trong các tháng trước',
        });
      } else {
        normalCount += 1;
      }
    }

    items.sort((a, b) => b.amount - a.amount);

    return {
      items: items.slice(0, 5),
      normalCount,
    };
  }, [fin.transactions, periodTxs, targetYear, targetMonth, fin.cats]);

  // ── 10d. Biểu đồ Cùng kỳ năm trước (YoY 12 tháng năm nay vs năm trước) ──────
  const yoyMonthsData = useMemo(() => {
    const curYear = targetYear;
    const prevYear = targetYear - 1;

    let totalCurYTD = 0;
    let totalPrevYTD = 0;

    const months = [];
    for (let m = 0; m < 12; m++) {
      const curFrom = monthStart(curYear, m);
      const curTo = monthEnd(curYear, m);
      const prevFrom = monthStart(prevYear, m);
      const prevTo = monthEnd(prevYear, m);

      const cAmt = fin.transactions
        .filter(t => t.type === 'expense' && !t.excluded && t.occurred_at >= curFrom && t.occurred_at <= curTo)
        .reduce((sum, t) => sum + t.amount, 0);

      const pAmt = fin.transactions
        .filter(t => t.type === 'expense' && !t.excluded && t.occurred_at >= prevFrom && t.occurred_at <= prevTo)
        .reduce((sum, t) => sum + t.amount, 0);

      const delta = cAmt - pAmt;
      const pct = pAmt > 0 ? Math.round((delta / pAmt) * 100) : null;
      const isCur = m === targetMonth;

      if (m <= targetMonth) {
        totalCurYTD += cAmt;
        totalPrevYTD += pAmt;
      }

      months.push({
        m: `T${m + 1}`,
        mNum: m + 1,
        cAmt,
        pAmt,
        pct,
        isCur,
      });
    }

    const maxVal = Math.max(...months.flatMap(m => [m.cAmt, m.pAmt]), 1);
    const totalCurMillions = totalCurYTD > 0 ? (totalCurYTD / 1_000_000).toFixed(1).replace('.', ',') : null;
    const deltaYTD = totalPrevYTD > 0 ? Math.round(((totalCurYTD - totalPrevYTD) / totalPrevYTD) * 100) : null;

    return {
      curYear,
      prevYear,
      months,
      maxVal,
      totalCurMillions,
      deltaYTD,
      monthsCount: targetMonth + 1,
    };
  }, [fin.transactions, targetYear, targetMonth]);

  // ── 10e. Biểu đồ Phải trả và Tùy chọn (Stacked bars 12 tháng) ───────────────
  const necessityData = useMemo(() => {
    const MUST_CATEGORIES = new Set(['debt', 'housing', 'bills', 'utilities', 'rent', 'loan']);

    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(targetYear, targetMonth - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const f = monthStart(y, m);
      const t = monthEnd(y, m);

      const txs = fin.transactions.filter(tr =>
        tr.type === 'expense' && !tr.excluded && tr.occurred_at >= f && tr.occurred_at <= t
      );

      let mustAmt = 0;
      let wantAmt = 0;
      for (const tr of txs) {
        if (MUST_CATEGORIES.has(tr.category_id)) {
          mustAmt += tr.amount;
        } else {
          wantAmt += tr.amount;
        }
      }

      const total = mustAmt + wantAmt;
      const isCurrent = i === 0;

      months.push({
        n: `${m + 1}`,
        total,
        mustAmt,
        wantAmt,
        isCurrent,
      });
    }

    const maxMonthSpend = Math.max(...months.map(m => m.total), 1);
    const formattedMonths = months.map(m => ({
      ...m,
      mustH: Math.max(m.mustAmt > 0 ? 3 : 0, Math.round((m.mustAmt / maxMonthSpend) * 100)),
      wantH: Math.max(m.wantAmt > 0 ? 3 : 0, Math.round((m.wantAmt / maxMonthSpend) * 100)),
    }));

    const curMonth = formattedMonths[formattedMonths.length - 1];
    const curMustPct = curMonth && curMonth.total > 0 ? Math.round((curMonth.mustAmt / curMonth.total) * 100) : 0;
    const curMustStr = curMonth ? compactVND(curMonth.mustAmt) : '0';
    const curWantStr = curMonth ? compactVND(curMonth.wantAmt) : '0';

    return {
      months: formattedMonths,
      curMonthNum: targetMonth + 1,
      curMustPct,
      curMustStr,
      curWantStr,
    };
  }, [fin.transactions, targetYear, targetMonth]);

  // ── 10f. Lịch chi tháng (Calendar Heatmap) ─────────────────────────────────
  const calHeatmapData = useMemo(() => {
    const y = targetYear;
    const m = targetMonth;
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    const dailyMap = {};
    for (const t of periodTxs) {
      const day = t.occurred_at ? Number(t.occurred_at.slice(8, 10)) : null;
      if (day && day >= 1 && day <= daysInMonth) {
        dailyMap[day] = (dailyMap[day] || 0) + t.amount;
      }
    }

    const firstDayDow = new Date(y, m, 1).getDay();
    const blankCount = firstDayDow === 0 ? 6 : firstDayDow - 1;

    let daysWithSpend = 0;
    let daysOver1m = 0;
    let peakDay = 1;
    let peakAmount = 0;

    const cells = [];
    for (let i = 0; i < blankCount; i++) {
      cells.push({ key: `blank-${i}`, isEmpty: true });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const amt = dailyMap[d] || 0;
      if (amt > 0) daysWithSpend += 1;
      if (amt >= 1_000_000) daysOver1m += 1;
      if (amt > peakAmount) {
        peakAmount = amt;
        peakDay = d;
      }

      let level = 0;
      if (amt > 1_500_000) level = 4;
      else if (amt >= 800_000) level = 3;
      else if (amt >= 300_000) level = 2;
      else if (amt > 0) level = 1;

      cells.push({
        key: `d-${d}`,
        day: d,
        amount: amt,
        level,
        isEmpty: false,
      });
    }

    return {
      monthNum: m + 1,
      cells,
      daysWithSpend,
      daysOver1m,
      peakDay: `${peakDay}/${m + 1}`,
      peakAmount,
    };
  }, [periodTxs, targetYear, targetMonth]);

  // ── 11. Xuất file CSV ─────────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (!periodTxs.length) {
      nav.showToast('Không có giao dịch nào trong kỳ này để xuất CSV', { icon: 'warning' });
      return;
    }
    const headers = ['Mã', 'Ngày', 'Số tiền (VNĐ)', 'Nhóm', 'Mục con', 'Nơi chi / Đơn vị', 'Ghi chú'];
    const rows = periodTxs.map(t => [
      t.id,
      t.occurred_at,
      t.amount,
      catInfo(t.category_id, fin.cats).label,
      t.subcategory_id || '',
      t.merchant || '',
      t.note || '',
    ]);

    const csvContent = '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bao_cao_chi_tieu_${period.label.replaceAll(' ', '_').replaceAll('/', '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    nav.showToast(`Đã xuất CSV cho ${period.label}`, { icon: 'receipt' });
  };

  // Ba khối này do Tổng quan sắp xếp (xem `lead`), nên khai báo ở đây rồi truyền ra.
  const hero = (
  <div className="fin-report__hero">
    <div className="fin-report__hero-total">
      <div className="fin-report__hero-label">TỔNG CHI {period.label}</div>
      <div className="fin-report__hero-sum">{money(totalSpend)}</div>
      <div className="fin-report__hero-meta">
        <span className="fin-report__hero-badge">
          {yoyDelta != null ? `${yoyDelta > 0 ? '+' : ''}${yoyDelta}% YoY` : 'Kỳ này'}
        </span>
        <span className="fin-report__hero-count">
          {periodTxs.length} khoản · {activeDays} ngày
        </span>
      </div>
    </div>

    <svg viewBox="0 0 180 180" className="fin-report__hero-donut" aria-label="Vòng cơ cấu nhóm chi">
      <circle cx="90" cy="90" r="70" fill="none" stroke="#232429" strokeWidth="17" />
      {donutSlices.map((d, i) => (
        <circle
          key={i}
          cx="90"
          cy="90"
          r="70"
          fill="none"
          stroke={d.col}
          strokeWidth="17"
          strokeDasharray={d.dash}
          strokeDashoffset={d.off}
          transform="rotate(-90 90 90)"
        />
      ))}
      <text x="90" y="85" textAnchor="middle" style={{ font: "500 9.5px/1 'JetBrains Mono', monospace", fill: '#8A8B93', letterSpacing: '.07em' }}>
        NHÓM DẪN ĐẦU
      </text>
      <text x="90" y="108" textAnchor="middle" style={{ font: "600 21px/1 'Be Vietnam Pro', sans-serif", fill: '#FAFAF8' }}>
        {Math.round(topCategory.pct)}%
      </text>
    </svg>

    <div className="fin-report__hero-top3">
      {top3.map(t => (
        <div key={t.key} className="fin-report__hero-top-item">
          <div className="fin-report__hero-top-head">
            <span className="fin-report__hero-top-dot" style={{ background: t.col }} />
            <span className="fin-report__hero-top-title">{t.n}</span>
          </div>
          <div className="fin-report__hero-top-val">{t.v}</div>
          <div className="fin-report__hero-top-note">{t.note}</div>
          <div className="fin-report__hero-top-bar">
            <span className="fin-report__hero-top-bar-fill" style={{ background: t.col, width: `${t.w}%` }} />
          </div>
        </div>
      ))}
    </div>
  </div>
  );

  const sparks = cards.sparks && (
    <div className="fin-report__sparks-grid">
      {sparklineData.map(s => (
        <div key={s.key} className="fin-report__spark-card">
          <div className="fin-report__spark-head">
            <span className="fin-report__spark-dot" style={{ background: s.col }} />
            <span className="fin-report__spark-title">{s.n}</span>
          </div>
          <div className="fin-report__spark-val">{s.v}</div>
          <div className="fin-report__spark-delta" style={{ color: s.dfg }}>{s.d}</div>
          <svg viewBox="0 0 120 34" className="fin-report__spark-svg" aria-label="Sparkline nhóm">
            <path d={s.area} fill={s.soft} />
            <path d={s.path} fill="none" stroke={s.col} strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </div>
      ))}
    </div>
  );

  const rank = cards.rank && (
      <div className="fin-report__card">
        <div className="fin-report__card-head">
          <div>
            <div className="fin-report__card-title">Xếp hạng nhóm</div>
            <div className="fin-report__card-sub">
              Kỳ này, theo số tiền · Bấm nhóm để xem danh mục con
            </div>
          </div>
          {activeCatRows.length > 0 && (
            <span className="fin-report__card-unit">
              {activeCatRows.length} NHÓM
            </span>
          )}
        </div>

        <div className="fin-report__rank-list">
          {displayedRankRows.length === 0 ? (
            <div className="fin-report__empty-hint">Chưa có chi tiêu trong kỳ này</div>
          ) : (
            displayedRankRows.map(c => {
              const isExpanded = expandedGroups.has(c.key);
              const hasSubs = c.subs && c.subs.length > 0;
              return (
                <div key={c.key} className={`fin-report__rank-item ${isExpanded ? 'is-expanded' : ''}`}>
                  <div
                    className={`fin-report__rank-row-head ${hasSubs ? 'has-subs' : ''}`}
                    onClick={() => hasSubs && toggleExpandGroup(c.key)}
                    role={hasSubs ? 'button' : undefined}
                    tabIndex={hasSubs ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (hasSubs && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        toggleExpandGroup(c.key);
                      }
                    }}
                    title={hasSubs ? (isExpanded ? 'Thu gọn danh mục con' : 'Xem chi tiết danh mục con') : undefined}
                  >
                    <div className="fin-report__rank-name-wrap">
                      {hasSubs && (
                        <span className="fin-report__rank-chevron" aria-hidden="true">
                          <AppIcon name={isExpanded ? 'caretDown' : 'caretRight'} size={11} />
                        </span>
                      )}
                      <span className="fin-report__rank-name">{c.name}</span>
                      {hasSubs && (
                        <span className="fin-report__rank-sub-count">
                          {c.subs.length}
                        </span>
                      )}
                    </div>
                    <span className="fin-report__rank-val">{money(c.amount)}</span>
                  </div>
                  <div className="fin-report__rank-track">
                    <span
                      className="fin-report__rank-fill"
                      style={{
                        background: c.col,
                        width: `${Math.max(2, Math.round((c.amount / maxCategoryAmount) * 100))}%`,
                      }}
                    />
                  </div>

                  {/* Danh mục con bung ra khi nhóm được mở */}
                  {isExpanded && hasSubs && (
                    <div className="fin-report__rank-subs">
                      {c.subs.map(s => (
                        <div key={s.key} className="fin-report__rank-sub-item">
                          <div className="fin-report__rank-sub-head">
                            <span className="fin-report__rank-sub-name">{s.name}</span>
                            <div className="fin-report__rank-sub-meta">
                              <span className="fin-report__rank-sub-pct">{Math.round(s.pct)}%</span>
                              <span className="fin-report__rank-sub-val">{money(s.amount)}</span>
                            </div>
                          </div>
                          <div className="fin-report__rank-sub-track">
                            <span
                              className="fin-report__rank-sub-fill"
                              style={{
                                background: c.col,
                                opacity: 0.75,
                                width: `${Math.max(2, Math.round(s.pct))}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {hiddenCount > 0 && (
            <button
              type="button"
              className="fin-report__rank-toggle-btn"
              onClick={() => setShowAllRanks(!showAllRanks)}
            >
              <AppIcon name={showAllRanks ? 'caretUp' : 'caretDown'} size={13} />
              <span>
                {showAllRanks
                  ? 'Thu gọn về Top 6'
                  : `Xem thêm ${hiddenCount} nhóm khác (${compactVND(hiddenAmount)})`}
              </span>
            </button>
          )}
        </div>
      </div>
  );

  const merchants = cards.merchants && (
    <div className="fin-report__card">
      <div className="fin-report__card-head">
        <div>
          <div className="fin-report__card-title">Nơi chi nhiều nhất</div>
          <div className="fin-report__card-sub">Gộp theo nhà cung cấp</div>
        </div>
      </div>
      <div className="fin-report__merchants-list">
        {merchantData.map(m => (
          <div key={m.n}>
            <div className="fin-report__rank-row-head">
              <span className="fin-report__merchants-name">{m.n}</span>
              <span className="fin-report__rank-val">{m.v}</span>
            </div>
            <div className="fin-report__rank-track">
              <span
                className="fin-report__rank-fill"
                style={{ background: m.col, width: `${m.p}%` }}
              />
            </div>
          </div>
        ))}
        {!merchantData.length && (
          <div style={{ color: '#93938C', fontSize: '12px', textAlign: 'center', padding: '24px 0' }}>
            Chưa có giao dịch nào trong kỳ
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="fin-report">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="fin-report__header">
        <div className="fin-report__title-wrap">
          <h1 className="fin-report__title">Báo cáo chi tiêu</h1>
          <div className="fin-report__stepper">
            <button
              type="button"
              className="fin-report__step-btn"
              onClick={() => stepPeriod(-1)}
              aria-label="Kỳ trước"
            >
              ‹
            </button>
            <span className="fin-report__step-label">{period.label}</span>
            <button
              type="button"
              className="fin-report__step-btn"
              onClick={() => stepPeriod(1)}
              aria-label="Kỳ sau"
            >
              ›
            </button>
          </div>
        </div>

        <div className="fin-report__actions" ref={mgrRef}>
          <div className="fin-report__mode-toggle">
            <button
              type="button"
              className={`fin-report__mode-btn ${mode === 'month' ? 'is-active' : ''}`}
              onClick={() => setMode('month')}
            >
              Tháng
            </button>
            <button
              type="button"
              className={`fin-report__mode-btn ${mode === 'quarter' ? 'is-active' : ''}`}
              onClick={() => setMode('quarter')}
            >
              Quý
            </button>
            <button
              type="button"
              className={`fin-report__mode-btn ${mode === 'year' ? 'is-active' : ''}`}
              onClick={() => setMode('year')}
            >
              Năm
            </button>
          </div>

          <button
            type="button"
            className={`fin-report__btn fin-report__btn--mgr ${mgrOpen ? 'is-open' : ''}`}
            onClick={() => setMgrOpen(!mgrOpen)}
          >
            <svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
              <path d="M104,40H56A16,16,0,0,0,40,56v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,104,40Zm0,64H56V56h48ZM200,40H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,64H152V56h48ZM104,136H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm0,64H56V152h48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Zm0,64H152V152h48Z" />
            </svg>
            <span>Thẻ hiển thị · {shownCount}</span>
          </button>

          <button
            type="button"
            className="fin-report__btn fin-report__btn--csv"
            onClick={handleExportCSV}
          >
            Xuất CSV
          </button>

          {/* Popover Card Manager trên Desktop */}
          {mgrOpen && !isMobile && (
            <div className="fin-report__mgr-popover">
              <div className="fin-report__mgr-heading">THẺ TRONG BÁO CÁO</div>
              <div className="fin-report__mgr-list">
                {CARD_DEFS.map(c => {
                  const on = !!cards[c.id];
                  return (
                    <div
                      key={c.id}
                      className={`fin-report__mgr-item ${on ? 'is-active' : ''}`}
                      onClick={() => toggleCard(c.id)}
                    >
                      <span className={`fin-report__mgr-switch ${on ? 'is-checked' : ''}`}>
                        <span className="fin-report__mgr-knob" />
                      </span>
                      <span className="fin-report__mgr-name">{c.name}</span>
                      <span className="fin-report__mgr-size">{c.size}</span>
                    </div>
                  );
                })}
              </div>
              <div className="fin-report__mgr-footer">
                <span className="fin-report__mgr-hint">Kéo thẻ trên trang để đổi thứ tự</span>
                <button
                  type="button"
                  className="fin-report__mgr-done"
                  onClick={() => setMgrOpen(false)}
                >
                  Xong
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Nội dung Báo cáo ────────────────────────────────────────────────── */}
      <div className="fin-report__body">
        {lead?.({ ...period, mode, unit: mode === 'month' ? 'day' : 'month' }, { hero, sparks, rank, merchants, cards })}

        {/* 2b. Row: Kỳ này với kỳ trước & Khoản lớn bất thường */}
        {(cards.periodDiff || cards.outliers) && (
          <div className="fin-report__diff-row">
            {cards.periodDiff && (
              <div className="fin-report__card fin-report__card--diff">
                <div className="fin-report__card-head">
                  <div>
                    <div className="fin-report__card-title">Kỳ này với kỳ trước</div>
                    <div className="fin-report__card-sub">
                      Bấm một nhóm để so từng danh mục con
                    </div>
                  </div>
                  <div className="fin-report__diff-legend">
                    <span className="fin-report__diff-legend-item">
                      <span className="fin-report__diff-legend-dot" style={{ background: '#6949E8' }} />
                      <span>{periodDiffData.curLabel} · màu nhóm</span>
                    </span>
                    <span className="fin-report__diff-legend-item">
                      <span className="fin-report__diff-legend-bar-sample" />
                      <span>{periodDiffData.prevLabel}</span>
                    </span>
                  </div>
                </div>

                <div className="fin-report__diff-table-wrap">
                  <table className="fin-report__diff-table">
                    <thead>
                      <tr>
                        <th style={{ width: '38%' }}>NHÓM</th>
                        <th style={{ textAlign: 'right', width: '18%' }}>{periodDiffData.curLabelShort}</th>
                        <th style={{ textAlign: 'right', width: '18%' }}>{periodDiffData.prevLabelShort}</th>
                        <th style={{ textAlign: 'right', width: '26%' }}>CHÊNH LỆCH</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periodDiffData.rows.map(r => {
                        const isOpen = expandedDiffGroups.has(r.key);
                        const curW = r.curAmt > 0 ? Math.max(3, Math.round((r.curAmt / periodDiffData.maxRowVal) * 100)) : 0;
                        const prevW = r.prevAmt > 0 ? Math.max(3, Math.round((r.prevAmt / periodDiffData.maxRowVal) * 100)) : 0;

                        return (
                          <Fragment key={r.key}>
                            <tr
                              className={`fin-report__diff-row-tr ${isOpen ? 'is-open' : ''}`}
                              onClick={() => toggleExpandDiffGroup(r.key)}
                            >
                              <td>
                                <div className="fin-report__diff-group-cell">
                                  <span className="fin-report__diff-caret">
                                    <AppIcon name={isOpen ? 'caretDown' : 'caretRight'} size={12} />
                                  </span>
                                  <span className="fin-report__diff-dot" style={{ background: r.col }} />
                                  <strong className="fin-report__diff-name">{r.name}</strong>
                                  <div className="fin-report__diff-minibars">
                                    <span className="fin-report__diff-bar-cur" style={{ background: r.col, width: `${curW}%` }} />
                                    <span className="fin-report__diff-bar-prev" style={{ width: `${prevW}%` }} />
                                  </div>
                                </div>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <span className="fin-report__diff-val">{r.curAmt ? compactVND(r.curAmt) : '—'}</span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <span className="fin-report__diff-prev-val">{r.prevAmt ? compactVND(r.prevAmt) : '—'}</span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {r.isNew ? (
                                  <span className="fin-diff-badge fin-diff-badge--new">
                                    +{compactVND(r.curAmt)} · mới
                                  </span>
                                ) : r.delta > 0 ? (
                                  <span className="fin-diff-badge fin-diff-badge--up">
                                    +{compactVND(r.delta)} · +{r.pct}%
                                  </span>
                                ) : r.delta < 0 ? (
                                  <span className="fin-diff-badge fin-diff-badge--down">
                                    -{compactVND(Math.abs(r.delta))} · {r.pct}%
                                  </span>
                                ) : (
                                  <span className="fin-diff-badge fin-diff-badge--same">0%</span>
                                )}
                              </td>
                            </tr>

                            {isOpen && r.subs.map(s => {
                              const subCurW = s.curAmt > 0 ? Math.max(3, Math.round((s.curAmt / (r.curAmt || 1)) * 100)) : 0;
                              const subPrevW = s.prevAmt > 0 ? Math.max(3, Math.round((s.prevAmt / (r.prevAmt || 1)) * 100)) : 0;
                              return (
                                <tr key={s.key} className="fin-report__diff-sub-tr">
                                  <td style={{ paddingLeft: '32px' }}>
                                    <div className="fin-report__diff-sub-cell">
                                      <span className="fin-report__diff-sub-name">{s.name}</span>
                                      <div className="fin-report__diff-minibars">
                                        <span className="fin-report__diff-bar-cur" style={{ background: r.col, width: `${subCurW}%` }} />
                                        <span className="fin-report__diff-bar-prev" style={{ width: `${subPrevW}%` }} />
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <span className="fin-report__diff-sub-val">{s.curAmt ? compactVND(s.curAmt) : '—'}</span>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <span className="fin-report__diff-sub-prev-val">{s.prevAmt ? compactVND(s.prevAmt) : '—'}</span>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    {s.isNew ? (
                                      <span className="fin-diff-badge fin-diff-badge--new fin-diff-badge--sm">mới</span>
                                    ) : s.delta > 0 ? (
                                      <span className="fin-diff-badge fin-diff-badge--up fin-diff-badge--sm">+{compactVND(s.delta)}</span>
                                    ) : s.delta < 0 ? (
                                      <span className="fin-diff-badge fin-diff-badge--down fin-diff-badge--sm">-{compactVND(Math.abs(s.delta))}</span>
                                    ) : (
                                      <span className="fin-diff-badge fin-diff-badge--same fin-diff-badge--sm">0%</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </Fragment>
                        );
                      })}
                      {periodDiffData.rows.length === 0 && (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '28px 0', color: '#93938C', fontSize: '12px' }}>
                            Chưa có dữ liệu chi tiêu trong kỳ này
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {cards.outliers && (
              <div className="fin-report__card fin-report__card--outlier">
                <div className="fin-report__card-head">
                  <div>
                    <div className="fin-report__card-title">Khoản lớn bất thường</div>
                    <div className="fin-report__card-sub">
                      So với mức thường của cùng danh mục
                    </div>
                  </div>
                </div>

                <div className="fin-report__outlier-list">
                  {outlierData.items.map(item => (
                    <div key={item.id} className="fin-report__outlier-item">
                      <div className="fin-report__outlier-top">
                        <div className="fin-report__outlier-meta">
                          <span>{item.date} · {item.subName}</span>
                        </div>
                        <span className={`fin-outlier-badge fin-outlier-badge--${item.type}`}>
                          {item.badge}
                        </span>
                      </div>

                      <div className="fin-report__outlier-row">
                        <strong className="fin-report__outlier-name">{item.name}</strong>
                        <span className="fin-report__outlier-amount">{money(item.amount)}</span>
                      </div>

                      {item.type === 'surge' ? (
                        <div className="fin-report__outlier-bar-wrap">
                          <div className="fin-report__outlier-bar">
                            <span
                              className="fin-report__outlier-marker"
                              style={{ left: `${Math.min(90, Math.max(10, Math.round((item.avg3m / item.amount) * 100)))}%` }}
                              title={item.note}
                            />
                          </div>
                          <small className="fin-report__outlier-hint">{item.note}</small>
                        </div>
                      ) : (
                        <small className="fin-report__outlier-hint" style={{ color: '#E08A20' }}>
                          {item.note}
                        </small>
                      )}
                    </div>
                  ))}

                  {!outlierData.items.length && (
                    <div style={{ color: '#93938C', fontSize: '12px', textAlign: 'center', padding: '24px 0' }}>
                      Tất cả các khoản chi trong kỳ đều nằm trong mức thông thường
                    </div>
                  )}
                </div>

                {outlierData.normalCount > 0 && (
                  <div className="fin-report__outlier-footer">
                    {outlierData.normalCount} khoản còn lại nằm trong mức thường
                  </div>
                )}
              </div>
            )}
          </div>
        )}


        {/* 3. Chi 12 tháng */}
        <div className="fin-report__row-2">
          {cards.trend && (
            <div className="fin-report__card">
              <div className="fin-report__card-head">
                <div>
                  <div className="fin-report__card-title">Chi 12 tháng</div>
                  <div className="fin-report__card-sub">
                    Đường đứt là trung bình {trendData.avgMillions} triệu mỗi tháng
                  </div>
                </div>
                <span className="fin-report__card-unit">TRIỆU ₫</span>
              </div>
              <svg viewBox="0 0 720 170" className="fin-report__trend-svg" aria-label="Chi 12 tháng">
                <defs>
                  <linearGradient id="gTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#6949E8" stopOpacity="0.28" />
                    <stop offset="1" stopColor="#6949E8" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <rect x="643" y="0" width="77" height="170" rx="6" fill="#F3F0FE" />
                <line x1="0" y1="170" x2="720" y2="170" stroke="#EDECE7" />
                <line x1="0" y1="115" x2="720" y2="115" stroke="#EDECE7" />
                <line x1="0" y1="60" x2="720" y2="60" stroke="#EDECE7" />
                <line x1="0" y1="5" x2="720" y2="5" stroke="#EDECE7" />
                <path d={trendData.trendArea} fill="url(#gTrend)" />
                <path d={trendData.trendLine} fill="none" stroke="#6949E8" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
                <line x1="0" y1={trendData.avgY} x2="720" y2={trendData.avgY} stroke="#BEBBB2" strokeWidth="1" strokeDasharray="4 5" />
                {trendData.trendDots.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={p.r}
                    fill={p.fill}
                    stroke="#fff"
                    strokeWidth={p.sw}
                  />
                ))}
              </svg>
              <div className="fin-report__trend-months">
                {trendData.months.map(m => (
                  <span
                    key={m.n}
                    className="fin-report__trend-month"
                    style={{ color: m.isCurrent ? '#6949E8' : '#B0B0AA', fontWeight: m.isCurrent ? 600 : 400 }}
                  >
                    {m.n}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 4. Cùng kỳ năm trước (YoY 12 tháng) */}
        {cards.yoy && (
          <div className="fin-report__card fin-report__card--yoy">
            <div className="fin-report__card-head">
              <div>
                <div className="fin-report__card-title">Cùng kỳ năm trước</div>
                <div className="fin-report__card-sub">
                  Mỗi tháng {yoyMonthsData.curYear} đặt cạnh cùng tháng {yoyMonthsData.prevYear} · triệu ₫
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '11.5px', color: '#6A6A64' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: '#DEDCD5' }} />
                  <span>{yoyMonthsData.prevYear}</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: '#6949E8' }} />
                  <strong style={{ color: '#15161A' }}>{yoyMonthsData.curYear}</strong>
                </span>
                {yoyMonthsData.totalCurMillions && (
                  <span style={{ borderLeft: '1px solid #E8E7E2', paddingLeft: '12px', color: '#15161A' }}>
                    {yoyMonthsData.monthsCount} tháng {yoyMonthsData.curYear} <strong>{yoyMonthsData.totalCurMillions}tr</strong>{' '}
                    {yoyMonthsData.deltaYTD != null && (
                      <span style={{ color: yoyMonthsData.deltaYTD > 0 ? '#E0446D' : '#12A594', fontWeight: 600 }}>
                        {yoyMonthsData.deltaYTD > 0 ? '+' : ''}{yoyMonthsData.deltaYTD}%
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>

            <div className="fin-report__yoy-grid">
              {yoyMonthsData.months.map(m => {
                const pH = Math.max(4, Math.round((m.pAmt / yoyMonthsData.maxVal) * 100));
                const cH = Math.max(4, Math.round((m.cAmt / yoyMonthsData.maxVal) * 100));
                const isCurrent = m.isCur;

                return (
                  <div key={m.m} className={`fin-report__yoy-col ${isCurrent ? 'is-current' : ''}`}>
                    <div className="fin-report__yoy-bars-pair">
                      <div className="fin-report__yoy-bar-wrap" title={`${yoyMonthsData.prevYear}: ${money(m.pAmt)}`}>
                        <span
                          className="fin-report__yoy-bar fin-report__yoy-bar--prev"
                          style={{ height: m.pAmt > 0 ? `${pH}%` : '0px' }}
                        />
                      </div>
                      <div className="fin-report__yoy-bar-wrap" title={`${yoyMonthsData.curYear}: ${money(m.cAmt)}`}>
                        <span
                          className="fin-report__yoy-bar fin-report__yoy-bar--cur"
                          style={{
                            height: m.cAmt > 0 ? `${cH}%` : '0px',
                            background: isCurrent ? '#6949E8' : '#A594F9',
                          }}
                        />
                      </div>
                    </div>
                    <span className="fin-report__yoy-lbl" style={{ color: isCurrent ? '#6949E8' : '#73736C', fontWeight: isCurrent ? 600 : 500 }}>
                      {m.m}
                    </span>
                    <span
                      className="fin-report__yoy-pct"
                      style={{
                        color: m.pct == null ? '#C4C2BA' : m.pct > 0 ? '#E0446D' : '#12A594',
                        fontWeight: m.pct != null ? 600 : 400,
                      }}
                    >
                      {m.pct == null ? '—' : `${m.pct > 0 ? '+' : ''}${m.pct}%`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. Row 3: Chi theo thứ, Bản đồ danh mục, Pareto 80/20 */}
        <div className="fin-report__row-3">
          {cards.dow && (
            <div className="fin-report__card">
              <div className="fin-report__card-title">Chi theo thứ</div>
              <div className="fin-report__card-sub">
                Cộng dồn 12 tháng · {dowData.peakName} nhiều nhất
              </div>
              <div className="fin-report__dow-bars">
                {dowData.bars.map(d => (
                  <div key={d.n} className="fin-report__dow-col">
                    <span className="fin-report__dow-val" style={{ color: d.vfg }}>{d.v}</span>
                    <span className="fin-report__dow-bar" style={{ background: d.bg, height: `${d.h}%` }} />
                    <span className="fin-report__dow-name">{d.n}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cards.treemap && (
            <div className="fin-report__card">
              <div className="fin-report__card-title">Bản đồ danh mục</div>
              <div className="fin-report__card-sub">Diện tích tỉ lệ với số tiền đã chi</div>
              <div className="fin-report__treemap-box">
                {treemapItems.major && (
                  <div className="fin-report__treemap-major">
                    <span className="fin-report__treemap-pct">
                      {treemapItems.major.pct.toFixed(1).replace('.', ',')}%
                    </span>
                    <div>
                      <div className="fin-report__treemap-major-title">{treemapItems.major.name}</div>
                      <div className="fin-report__treemap-major-val">{money(treemapItems.major.amount)}</div>
                    </div>
                  </div>
                )}
                <div className="fin-report__treemap-col">
                  {treemapItems.sub1 && (
                    <div className="fin-report__treemap-sub1">
                      <span className="fin-report__treemap-sub1-pct">
                        {treemapItems.sub1.pct.toFixed(1).replace('.', ',')}%
                      </span>
                      <div>
                        <div className="fin-report__treemap-sub1-title">{treemapItems.sub1.name}</div>
                        <div className="fin-report__treemap-sub1-val">{money(treemapItems.sub1.amount)}</div>
                      </div>
                    </div>
                  )}
                  <div className="fin-report__treemap-minor-row">
                    {treemapItems.sub2 && (
                      <div className="fin-report__treemap-sub2">
                        <div className="fin-report__treemap-sub2-title">{treemapItems.sub2.name}</div>
                        <div className="fin-report__treemap-sub2-pct">
                          {treemapItems.sub2.pct.toFixed(1).replace('.', ',')}%
                        </div>
                      </div>
                    )}
                    <div className="fin-report__treemap-minors">
                      {treemapItems.sub3 && (
                        <div className="fin-report__treemap-sub3">
                          <span>{treemapItems.sub3.name}</span>
                        </div>
                      )}
                      <div className="fin-report__treemap-micro-row">
                        <div className="fin-report__treemap-sub4" />
                        <div className="fin-report__treemap-sub5" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="fin-report__treemap-legend">
                {treemapItems.sub4 && (
                  <span className="fin-report__treemap-legend-item">
                    <span className="fin-report__treemap-legend-dot" style={{ background: '#E0446D' }} />
                    {treemapItems.sub4.name} {treemapItems.sub4.pct.toFixed(1).replace('.', ',')}%
                  </span>
                )}
                {treemapItems.sub5 && (
                  <span className="fin-report__treemap-legend-item">
                    <span className="fin-report__treemap-legend-dot" style={{ background: '#9A4FE0' }} />
                    {treemapItems.sub5.name} {treemapItems.sub5.pct.toFixed(1).replace('.', ',')}%
                  </span>
                )}
              </div>
            </div>
          )}

          {cards.pareto && (
            <div className="fin-report__card">
              <div className="fin-report__card-head">
                <div>
                  <div className="fin-report__card-title">Pareto 80/20</div>
                  <div className="fin-report__card-sub">
                    Hai nhóm đầu đã chiếm {paretoData.top2Pct}%
                  </div>
                </div>
                <span className="fin-report__card-unit">LŨY KẾ %</span>
              </div>
              <svg viewBox="0 0 420 180" className="fin-report__pareto-svg" aria-label="Biểu đồ Pareto">
                <line x1="0" y1="170" x2="420" y2="170" stroke="#EDECE7" />
                <line x1="0" y1="113" x2="420" y2="113" stroke="#EDECE7" />
                <line x1="0" y1="56" x2="420" y2="56" stroke="#EDECE7" />
                {paretoData.bars.map((p, i) => (
                  <rect key={i} x={p.x} y={p.y} width="44" height={p.h} rx="5" fill={p.col} />
                ))}
                {paretoData.paretoLine && (
                  <path d={paretoData.paretoLine} fill="none" stroke="#15161A" strokeWidth="2" strokeDasharray="3 3" />
                )}
                {paretoData.bars.map((p, i) => (
                  <circle key={i} cx={p.cx} cy={p.cy} r="3.2" fill="#15161A" />
                ))}
              </svg>
              <div className="fin-report__pareto-labels">
                {paretoData.bars.map((p, i) => (
                  <span key={i} className="fin-report__pareto-label">{p.short}</span>
                ))}
              </div>
            </div>
          )}

          {cards.necessity && (
            <div className="fin-report__card">
              <div className="fin-report__card-head">
                <div>
                  <div className="fin-report__card-title">Phải trả và Tùy chọn</div>
                  <div className="fin-report__card-sub">
                    12 tháng · tháng {necessityData.curMonthNum} có {necessityData.curMustPct}% là phải trả
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '8px 0 14px', fontSize: '11px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#15161A' }} />
                  <span>Phải trả <strong>{necessityData.curMustStr}</strong></span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#E8D5B5' }} />
                  <span>Tùy chọn <strong>{necessityData.curWantStr}</strong></span>
                </span>
              </div>

              <div className="fin-report__stacked-bars">
                {necessityData.months.map(m => (
                  <div key={m.n} className="fin-report__stacked-col">
                    <div className="fin-report__stacked-bar-wrap">
                      <span
                        className="fin-report__stacked-bar-want"
                        style={{
                          height: `${m.wantH}%`,
                          background: m.isCurrent ? '#F2DEB9' : '#EAE4D5',
                        }}
                        title={`Tùy chọn: ${money(m.wantAmt)}`}
                      />
                      <span
                        className="fin-report__stacked-bar-must"
                        style={{
                          height: `${m.mustH}%`,
                          background: m.isCurrent ? '#15161A' : '#8A8A85',
                        }}
                        title={`Phải trả: ${money(m.mustAmt)}`}
                      />
                    </div>
                    <span className="fin-report__stacked-lbl" style={{ color: m.isCurrent ? '#15161A' : '#A8A8A2', fontWeight: m.isCurrent ? 600 : 400 }}>
                      {m.n}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cards.calHeatmap && mode === 'month' && calHeatmapData && (
            <div className="fin-report__card">
              <div className="fin-report__card-head">
                <div>
                  <div className="fin-report__card-title">Lịch chi tháng {calHeatmapData.monthNum}</div>
                  <div className="fin-report__card-sub">
                    {calHeatmapData.daysWithSpend} ngày có chi · {calHeatmapData.daysOver1m} ngày trên 1 triệu
                  </div>
                </div>
              </div>

              <div className="fin-report__cal-wrap">
                <div className="fin-report__cal-dow-row">
                  {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
                    <span key={d} className="fin-report__cal-dow">{d}</span>
                  ))}
                </div>
                <div className="fin-report__cal-grid">
                  {calHeatmapData.cells.map(c => {
                    if (c.isEmpty) {
                      return <div key={c.key} className="fin-report__cal-cell fin-report__cal-cell--empty" />;
                    }
                    return (
                      <div
                        key={c.key}
                        className={`fin-report__cal-cell fin-report__cal-cell--lvl${c.level}`}
                        title={`${c.day}/${calHeatmapData.monthNum}: ${money(c.amount)}`}
                      >
                        <span>{c.day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="fin-report__cal-footer">
                <span className="fin-report__cal-peak">
                  Đậm nhất {calHeatmapData.peakDay} · {compactVND(calHeatmapData.peakAmount)}
                </span>
                <div className="fin-report__cal-legend">
                  <span>Ít</span>
                  <span className="fin-report__cal-swatch fin-report__cal-cell--lvl0" />
                  <span className="fin-report__cal-swatch fin-report__cal-cell--lvl1" />
                  <span className="fin-report__cal-swatch fin-report__cal-cell--lvl2" />
                  <span className="fin-report__cal-swatch fin-report__cal-cell--lvl3" />
                  <span className="fin-report__cal-swatch fin-report__cal-cell--lvl4" />
                  <span>Nhiều</span>
                </div>
              </div>
            </div>
          )}

          {/* Thẻ Phân bố số tiền (Histogram) */}
          {cards.hist && (
            <div className="fin-report__card">
              <div className="fin-report__card-title">Phân bố số tiền</div>
              <div className="fin-report__card-sub">Mỗi khoản kỳ này</div>
              <div className="fin-report__hist-bars">
                {histData.map(h => (
                  <div key={h.n} className="fin-report__hist-col">
                    <span className="fin-report__hist-count">{h.c}</span>
                    <span className="fin-report__hist-bar" style={{ background: h.bg, height: `${h.h}%` }} />
                    <span className="fin-report__hist-label">{h.n}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Thẻ Nơi chi nhiều nhất (Merchants) — chỉ vẽ ở đáy nếu không có lead */}
          {!lead && cards.merchants && merchants}
        </div>

        {footer}
      </div>

      {/* ── Mobile Bottom Sheet (Card Manager) ──────────────────────────────── */}
      {mgrOpen && isMobile && (
        <div className="fin-report__mobile-backdrop" onClick={() => setMgrOpen(false)}>
          <div className="fin-report__mobile-sheet" onClick={e => e.stopPropagation()}>
            <span className="fin-report__mobile-handle" />
            <div>
              <div className="fin-report__mobile-title">Thẻ hiển thị</div>
              <div className="fin-report__mobile-sub">
                Bật thẻ cần theo dõi, tắt thẻ không dùng. Kéo tay nắm để đổi thứ tự.
              </div>
            </div>
            <div className="fin-report__mobile-list">
              {CARD_DEFS.map(c => {
                const on = !!cards[c.id];
                return (
                  <div
                    key={c.id}
                    className={`fin-report__mobile-row ${on ? 'is-active' : ''}`}
                    onClick={() => toggleCard(c.id)}
                  >
                    <span className="fin-report__mobile-drag">⠿</span>
                    <span className="fin-report__mobile-name">{c.name}</span>
                    <span className={`fin-report__mobile-switch ${on ? 'is-checked' : ''}`}>
                      <span className="fin-report__mobile-knob" />
                    </span>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              className="fin-report__mobile-done-btn"
              onClick={() => setMgrOpen(false)}
            >
              Xong
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
