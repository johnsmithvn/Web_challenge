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
  
  // Chuẩn hóa dấu chấm/phẩy thập phân
  let val = parseFloat(m[1].replace(/[.,](?=\d{3})/g, '').replace(',', '.'));
  if (isNaN(val)) return 0;
  
  const suffix = m[2];
  
  if (isUsd) {
    val = val * getUsdRate();
  } else {
    if (/[kK]/.test(suffix)) {
      val *= 1000;
    } else if (/[mM]/.test(suffix)) {
      val *= 1000000;
    } else if (getAutoK() && val < 10000) { // Chỉ nhân thêm 1000 khi tuỳ chọn Auto-K được bật
      val *= 1000;
    }
  }
  
  return Math.round(val);
}
