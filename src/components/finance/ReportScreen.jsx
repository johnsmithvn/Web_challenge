import { useState, useMemo, useEffect, useRef } from 'react';
import {
  parseYmd, toDateStr, monthStart, monthEnd,
} from '../../utils/financeLogic';
import { money, catInfo } from './parts';
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
  sparks: true,
  trend: true,
  rank: true,
  dow: true,
  treemap: true,
  pareto: true,
  hist: false,
  merchants: false,
};

const CARD_DEFS = [
  { id: 'sparks', name: 'Sparkline sáu nhóm', size: 'full' },
  { id: 'trend', name: 'Chi 12 tháng', size: '2/3' },
  { id: 'rank', name: 'Xếp hạng nhóm', size: '1/3' },
  { id: 'dow', name: 'Chi theo thứ', size: '1/3' },
  { id: 'treemap', name: 'Bản đồ danh mục', size: '1/3' },
  { id: 'pareto', name: 'Pareto 80/20', size: '1/3' },
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

export default function ReportScreen({ fin, nav }) {
  // ── 1. Quản lý chế độ & kỳ báo cáo ─────────────────────────────────────────
  const [mode, setMode] = useState('month'); // 'month' | 'quarter' | 'year'
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
      } catch {}
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
      return {
        key: g.key,
        name: g.label,
        amount,
        pct,
        col: palette.col,
        soft: palette.soft,
      };
    }).sort((a, b) => b.amount - a.amount);
  }, [expenseGroups, catSums, totalSpend]);

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
    let cum = 0;
    const list = catRows.slice(0, 6);
    const pareto = list.map((c, i) => {
      cum += c.pct;
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
        {/* 1. Thẻ tối đầu trang (Hero dark card) */}
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

        {/* 2. Dải Sparkline sáu nhóm */}
        {cards.sparks && (
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
        )}

        {/* 3. Row 2: Chi 12 tháng & Xếp hạng nhóm */}
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

          {cards.rank && (
            <div className="fin-report__card">
              <div className="fin-report__card-title">Xếp hạng nhóm</div>
              <div className="fin-report__card-sub">Kỳ này, theo số tiền</div>
              <div className="fin-report__rank-list">
                {catRows.slice(0, 6).map(c => (
                  <div key={c.key}>
                    <div className="fin-report__rank-row-head">
                      <span className="fin-report__rank-name">{c.name}</span>
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
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

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

          {/* Thẻ Nơi chi nhiều nhất (Merchants) */}
          {cards.merchants && (
            <div className="fin-report__card">
              <div className="fin-report__card-title">Nơi chi nhiều nhất</div>
              <div className="fin-report__card-sub">Gộp theo nhà cung cấp</div>
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
          )}
        </div>
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
