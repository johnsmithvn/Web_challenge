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

export function sanitizeDigits(value, maxLength = 18) {
  return String(value ?? '').replace(/\D/g, '').slice(0, maxLength);
}

/**
 * Chèn dấu phân cách nghìn để HIỂN THỊ trong ô nhập tiền: "45000" → "45.000".
 *
 * State vẫn giữ chuỗi digit thuần (`sanitizeDigits` lọc lại mọi thứ không phải
 * số ở onChange), nên `parseCurrencyInput` không cần biết gì về dấu `.` và không
 * có đường nào lưu sai số. Dấu `.` theo quy ước VN, khớp với `formatVND`.
 *
 * ponytail: sửa ở GIỮA chuỗi thì caret nhảy về cuối, vì value được format lại
 * mỗi lần render. Chấp nhận được với ô tiền (người ta gõ trái→phải rồi xoá cả
 * cụm). Muốn caret đúng thì phải tự quản `selectionStart` — không đáng.
 */
export function groupDigits(value) {
  return String(value ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Số THẬT SỰ SẼ ĐƯỢC LƯU khi ô tiền đang hiện `raw` — chỉ trả về khi nó KHÁC con
 * số người dùng đang nhìn thấy, tức là lúc auto-K vừa lặng lẽ nhân thêm 1.000.
 *
 * Ô tiền hiện "5.000 ₫" nhưng lưu 5.000.000₫ là kiểu sai tệ nhất: im lặng, gấp
 * 1000 lần, và chỉ lộ ra khi xem lại báo cáo cuối tháng. Auto-K vẫn giữ nguyên
 * (nó là thứ làm việc nhập nhanh) — chỉ bắt nó hiện mặt ra trước khi bấm Lưu.
 *
 * @param {string} raw chuỗi digit thuần đang nằm trong state của ô nhập
 * @returns {string} số đã chèn dấu nghìn, hoặc '' khi không có gì để cảnh báo
 */
export function autoKPreview(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  const parsed = parseCurrencyInput(digits);
  return parsed && parsed !== Number(digits) ? groupDigits(String(parsed)) : '';
}

export function sanitizeDecimal(value, maxIntegerDigits = 6, maxFractionDigits = 4) {
  const raw = String(value ?? '').replace(',', '.').replace(/[^\d.]/g, '');
  if (!raw) return '';

  const separator = raw.indexOf('.');
  if (separator === -1) return raw.slice(0, maxIntegerDigits);

  const whole = (raw.slice(0, separator) || '0').slice(0, maxIntegerDigits);
  const fraction = raw.slice(separator + 1).replace(/\./g, '').slice(0, maxFractionDigits);
  return `${whole}.${fraction}`;
}

export function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
}

/**
 * Chữ chỉ độ lớn mà người Việt gõ sau số tiền. NGUỒN DUY NHẤT — cả
 * `parseCurrencyInput` (để nhân) và `stripAmountWords` (để bóc khỏi tiêu đề) đều
 * đọc từ đây, nên không có đường lệch nhau.
 *
 * Trước đây chỉ hiểu `k`/`m`, còn "50 nghìn" ra đúng 50.000 CHỈ NHỜ heuristic
 * auto-k (`val < 10000` → ×1000). Tắt auto-k trong Cài đặt là nó lưu 50 đồng.
 */
const MAGNITUDE = {
  k: 1e3, nghìn: 1e3, nghin: 1e3, ngàn: 1e3, ngan: 1e3,
  m: 1e6, triệu: 1e6, trieu: 1e6, tr: 1e6, củ: 1e6, cu: 1e6,
};
const MAGNITUDE_ALT = Object.keys(MAGNITUDE).sort((a, b) => b.length - a.length).join('|');

/**
 * Bóc số tiền + chữ chỉ độ lớn khỏi câu gõ tự nhiên, để phần còn lại làm tiêu đề:
 * "xăng 50 nghìn" → "xăng", "netflix 260k" → "netflix".
 *
 * `(?![\p{L}])` là phần KHÔNG ĐƯỢC BỎ: chữ chỉ độ lớn chỉ bóc khi nó không dính
 * vào một từ khác. Thiếu nó thì "2 cuốn sách" → "ốn sách" (khớp `cu`) và
 * "1 trứng" → "ứng" (khớp `tr`). `\b` không cứu được vì chữ Việt có dấu không
 * phải `\w` nên chỗ nào cũng thành boundary.
 */
export function stripAmountWords(text) {
  return String(text ?? '')
    .replace(new RegExp(`\\d[\\d.,]*\\s*(?:${MAGNITUDE_ALT})?(?![\\p{L}])`, 'giu'), '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Chuyển chuỗi nhập liệu của người dùng thành số nguyên VND.
 * Ví dụ:
 * - "50" -> 50000 (tự động nhân 1000 đối với số ngắn < 10000 khi getAutoK() bật)
 * - "50k" / "50 nghìn" -> 50000
 * - "1.5m" / "1.5 triệu" / "1.5tr" -> 1500000
 * - "89$" hoặc "89 usd" -> 2260600 (sử dụng tỷ giá cấu hình)
 * - "120.000" -> 120000
 */
export function parseCurrencyInput(value) {
  if (!value) return 0;

  const str = String(value).trim().replace(/\s+/g, '');
  const isUsd = /[$]|usd/i.test(str);

  // Tách phần số (hỗ trợ cả chấm/phẩy thập phân) và chữ chỉ độ lớn nếu có
  const m = str.match(new RegExp(`(\\d[\\d.,]*)\\s*(${MAGNITUDE_ALT})?`, 'i'));
  if (!m) return 0;

  const { num: val, hasDecimal } = parseNumericPart(m[1]);
  if (isNaN(val)) return 0;

  let result = val;
  const multiplier = MAGNITUDE[(m[2] || '').toLowerCase()];

  if (isUsd) {
    result = val * getUsdRate();
  } else if (multiplier) {
    result *= multiplier;
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
