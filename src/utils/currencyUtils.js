export function getUsdRate() {
  const saved = localStorage.getItem('lh_usd_rate');
  return saved ? parseFloat(saved) : 25400;
}

export function getAutoK() {
  const saved = localStorage.getItem('lh_auto_k');
  return saved === null ? true : saved === 'true';
}

export function setUsdRate(rate) {
  localStorage.setItem('lh_usd_rate', String(rate));
}

export function setAutoK(enabled) {
  localStorage.setItem('lh_auto_k', String(enabled));
}

export function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
}

/**
 * Nguồn sự thật duy nhất cho chu kỳ subscription — trước đây giá trị này bị
 * viết tay độc lập ở FinancePage.jsx (calcNextDue, option list, label map) và
 * useSubscriptions.js (auto-advance, getMonthlyCost), từng lệch nhau thật ở v4.4.0.
 */
export const SUBSCRIPTION_CYCLES = [
  { key: 'monthly', label: '1 tháng', unit: 'tháng',   months: 1 },
  { key: '3month',  label: '3 tháng', unit: '3 tháng', months: 3 },
  { key: '6month',  label: '6 tháng', unit: '6 tháng', months: 6 },
  { key: 'yearly',  label: '1 năm',   unit: 'năm',     months: 12 },
];

export function cycleMonths(cycle) {
  return SUBSCRIPTION_CYCLES.find(c => c.key === cycle)?.months || 1;
}

/** Trả về Date mới, lùi tới kỳ tiếp theo của `cycle` tính từ `date`. */
export function advanceByCycle(date, cycle) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + cycleMonths(cycle));
  return d;
}

/** Quy đổi `amount` của 1 subscription về chi phí trung bình/tháng. */
export function monthlyCostForCycle(amount, cycle) {
  return Math.round(amount / cycleMonths(cycle));
}

/**
 * Chuyển chuỗi nhập liệu của người dùng thành số nguyên VND.
 * Ví dụ:
 * - "50" -> 50000 (tự động nhân 1000 đối với số ngắn < 10000 khi getAutoK() bật)
 * - "50k" -> 50000
 * - "1.5m" -> 1500000
 * - "89$" hoặc "89 usd" -> 2260600 (sử dụng tỷ giá cấu hình)
 * - "120.000" -> 120000
 */
export function parseCurrencyInput(value) {
  if (!value) return 0;

  const str = String(value).trim().replace(/\s+/g, '');
  const isUsd = /[$]|usd/i.test(str);

  // Tách phần số (hỗ trợ cả chấm/phẩy thập phân) và hậu tố nhân (k, m) nếu có
  const m = str.match(/(\d[\d.,]*)[\s]*([kKmM]?)/);
  if (!m) return 0;

  const { num: val, hasDecimal } = parseNumericPart(m[1]);
  if (isNaN(val)) return 0;

  let result = val;
  const suffix = m[2];

  if (isUsd) {
    result = val * getUsdRate();
  } else if (/[kK]/.test(suffix)) {
    result *= 1000;
  } else if (/[mM]/.test(suffix)) {
    result *= 1000000;
  } else if (!hasDecimal && getAutoK() && val < 10000) {
    // Auto-K: số nguyên ngắn như "50" nghĩa là 50.000.
    // Bỏ qua khi người dùng nhập số thập phân rõ ràng (vd "12.50") để tránh nhân nhầm 1000.
    result *= 1000;
  }

  return Math.round(result);
}

/**
 * Phân tích token số có thể dùng '.'/',' làm dấu ngăn cách nghìn và/hoặc dấu thập phân.
 * Quy ước: nhóm 1-2 chữ số sau dấu cuối cùng = thập phân; nhóm 3 chữ số = ngăn cách nghìn.
 * Ví dụ: "120.000" -> 120000 (nghìn); "12.50" -> 12.5 (thập phân); "1.234.567" -> 1234567.
 * @param {string} token
 * @returns {{ num: number, hasDecimal: boolean }}
 */
function parseNumericPart(token) {
  const lastSep = Math.max(token.lastIndexOf('.'), token.lastIndexOf(','));
  if (lastSep === -1) return { num: parseFloat(token), hasDecimal: false };

  const after = token.slice(lastSep + 1);
  if (/^\d{1,2}$/.test(after)) {
    const intPart = token.slice(0, lastSep).replace(/[.,]/g, '');
    return { num: parseFloat(`${intPart}.${after}`), hasDecimal: true };
  }
  return { num: parseFloat(token.replace(/[.,]/g, '')), hasDecimal: false };
}
