/**
 * taskNlpParser.js — Bộ phân tích cú pháp ngôn ngữ tự nhiên cho tạo nhanh công việc.
 *
 * Hỗ trợ các cú pháp:
 * - Nhãn: `#UI`, `#backend`, `#marketing`
 * - Mức ưu tiên: `!khẩn`, `!cao`, `!vừa`, `!thấp` hoặc `!1`, `!2`, `!3`, `!4`
 * - Giờ: `9h`, `14h30`, `09:00`, `18h`
 * - Ngày: `hôm nay`, `nay`, `ngày mai`, `mai`, `t2`, `t3`, `t4`, `t5`, `t6`, `t7`, `cn`
 *
 * Hàm thuần (pure function), không phụ thuộc React, dễ dàng kiểm thử bằng node:assert.
 */

import { toDateStr } from './dateUtils.js';

export const PRIORITY_MAP = {
  'khẩn': 5,
  'khan': 5,
  'urgent': 5,
  '1': 5,
  'cao': 4,
  'high': 4,
  '2': 4,
  'vừa': 3,
  'vua': 3,
  'medium': 3,
  '3': 3,
  'thấp': 2,
  'thap': 2,
  'low': 2,
  '4': 2,
  '5': 1,
};

export const PRIORITY_LABELS = {
  5: { label: 'Khẩn cấp', icon: 'fire', color: '#EF4444' },
  4: { label: 'Ưu tiên cao', icon: 'arrowUp', color: '#F97316' },
  3: { label: 'Ưu tiên vừa', icon: 'arrowRight', color: '#EAB308' },
  2: { label: 'Ưu tiên thấp', icon: 'arrowDown', color: '#3B82F6' },
  1: { label: 'Rất thấp', icon: 'arrowDown', color: '#94A3B8' },
  0: { label: 'Không ưu tiên', icon: 'minus', color: 'var(--tk-text-mute, #8A93AD)' },
};

/**
 * Cộng thêm n ngày từ mốc dateStr (hoặc hôm nay) theo định dạng YYYY-MM-DD
 */
export function shiftDateDays(daysToAdd, baseDateStr = toDateStr()) {
  const [y, m, d] = baseDateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + daysToAdd);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Nhãn hiển thị ngày thân thiện
 */
export function formatFriendlyDate(dateStr, baseDateStr = toDateStr()) {
  if (!dateStr) return '';
  if (dateStr === baseDateStr) return 'Hôm nay';
  if (dateStr === shiftDateDays(1, baseDateStr)) return 'Ngày mai';
  if (dateStr === shiftDateDays(-1, baseDateStr)) return 'Hôm qua';

  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  return `${DOW[dt.getDay()]} ${d}/${m}`;
}

/**
 * Phân tích chuỗi nhập nhanh thành các thuộc tính task
 *
 * @param {string} raw Chuỗi người dùng nhập (ví dụ: "Thiết kế màn hình mai 9h !cao #UI")
 * @param {string} [baseDateStr] Ngày làm mốc tính toán (mặc định hôm nay YYYY-MM-DD)
 * @returns {{
 *   title: string,
 *   due_date: string|null,
 *   due_time: string|null,
 *   priority: number,
 *   tags: string[],
 *   chips: Array<{ ic: string, n: string }>
 * }}
 */
export function parseTaskQuickText(raw, baseDateStr = toDateStr()) {
  if (!raw || !raw.trim()) {
    return {
      title: '',
      due_date: null,
      due_time: null,
      priority: 0,
      tags: [],
      chips: [],
    };
  }

  let s = ' ' + raw + ' ';
  let due = null;
  let tm = null;
  let pr = 0;
  const tags = [];

  // 1. Tách nhãn (#tag)
  s = s.replace(/\s#([\p{L}\d_-]+)/gu, (_, g) => {
    if (!tags.includes(g)) tags.push(g);
    return ' ';
  });

  // 2. Tách độ ưu tiên (!cao, !khẩn, !vừa, !thấp, !1, !2, !3, !4, !5)
  s = s.replace(/\s!(khẩn|khan|urgent|cao|high|vừa|vua|medium|thấp|thap|low|[1-5])(?=\s)/giu, (_, g) => {
    pr = PRIORITY_MAP[g.toLowerCase()] || 0;
    return ' ';
  });

  // 3. Tách giờ (9h, 14h30, 09:00, 18:30)
  s = s.replace(/\s(\d{1,2})(?:h|:)(\d{2})?(?=\s)/gi, (m, h, mm) => {
    const hh = Number(h);
    if (hh >= 0 && hh < 24) {
      tm = String(hh).padStart(2, '0') + ':' + (mm || '00');
      return ' ';
    }
    return m;
  });

  // 4. Tách ngày hôm nay / nay
  s = s.replace(/\s(hôm nay|nay)(?=\s)/giu, () => {
    due = baseDateStr;
    return ' ';
  });

  // 5. Tách ngày mai / mai
  s = s.replace(/\s(ngày mai|mai)(?=\s)/giu, () => {
    due = shiftDateDays(1, baseDateStr);
    return ' ';
  });

  // 6. Tách thứ trong tuần: t2..t7 hoặc cn
  s = s.replace(/\s(t[2-7]|cn)(?=\s)/gi, (_, g) => {
    const [y, m, d] = baseDateStr.split('-').map(Number);
    const currDay = new Date(y, m - 1, d).getDay(); // 0 là CN, 1 là T2...
    const targetDay = g.toLowerCase() === 'cn' ? 0 : Number(g[1]) - 1; // 0 là CN, 1 là T2...
    let diff = (targetDay - currDay + 7) % 7;
    if (diff === 0) diff = 7; // Nếu trùng thứ hôm nay thì tính sang tuần sau
    due = shiftDateDays(diff, baseDateStr);
    return ' ';
  });

  // Nếu có giờ mà chưa có ngày -> mặc định là hôm nay
  if (tm && !due) {
    due = baseDateStr;
  }

  // Tạo preview chips cho UI
  const chips = [];
  if (due) {
    chips.push({
      ic: 'ph ph-calendar-blank',
      n: formatFriendlyDate(due, baseDateStr) + (tm ? ' · ' + tm : ''),
    });
  }
  if (pr > 0 && PRIORITY_LABELS[pr]) {
    chips.push({
      ic: PRIORITY_LABELS[pr].icon,
      n: PRIORITY_LABELS[pr].label,
    });
  }
  tags.forEach((tag) => {
    chips.push({
      ic: 'ph ph-hash',
      n: tag,
    });
  });

  return {
    title: s.replace(/\s+/g, ' ').trim(),
    due_date: due,
    due_time: tm,
    priority: pr,
    tags,
    chips,
  };
}
