import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Auto-K và tỷ giá USD đã bỏ (2026-10-11): ô tiền gõ số nào lưu số đó, chỉ nhân khi
// có chữ chỉ độ lớn (k, nghìn, triệu, tr, củ…). Parser không còn đọc localStorage.
const {
  groupDigits, parseCurrencyInput, sanitizeDecimal, sanitizeDigits, stripAmountWords, formatVND,
} = await import('../../utils/currencyUtils.js');

assert.equal(sanitizeDigits('12abc.345 ₫'), '12345');
assert.equal(sanitizeDigits('123456', 4), '1234');
assert.equal(sanitizeDigits(''), '');

assert.equal(sanitizeDecimal('12,5%'), '12.5');
assert.equal(sanitizeDecimal('1.2.3abc'), '1.23');
assert.equal(sanitizeDecimal('.75'), '0.75');
assert.equal(sanitizeDecimal('1234567.89123', 6, 4), '123456.8912');
assert.equal(sanitizeDecimal(''), '');

/* groupDigits — chỉ để HIỂN THỊ, state vẫn là digit thuần */
assert.equal(groupDigits('45000'), '45.000');
assert.equal(groupDigits('1234567'), '1.234.567');
assert.equal(groupDigits('999'), '999');       // dưới 4 số thì không có dấu nào
assert.equal(groupDigits('1000'), '1.000');    // biên 4 số
assert.equal(groupDigits(''), '');
assert.equal(groupDigits(null), '');
// Bất biến: sanitizeDigits phải huỷ được đúng cái groupDigits vừa thêm, nếu không
// thì gõ lần thứ hai vào ô tiền là số bị nhân lên.
assert.equal(sanitizeDigits(groupDigits('45000')), '45000');
assert.equal(sanitizeDigits(groupDigits('1234567')), '1234567');

/* stripAmountWords — bóc số + chữ chỉ độ lớn, giữ lại phần làm tiêu đề */
assert.equal(stripAmountWords('nước ép 45k'), 'nước ép');
assert.equal(stripAmountWords('xăng 50 nghìn'), 'xăng');   // bug cũ: ra "xăng nghìn"
assert.equal(stripAmountWords('netflix 260k'), 'netflix');
assert.equal(stripAmountWords('vé máy bay 2.5 triệu'), 'vé máy bay');
assert.equal(stripAmountWords('tiền nhà 3tr'), 'tiền nhà');
assert.equal(stripAmountWords('lì xì 1 củ'), 'lì xì');
// ⚠️ Bất biến: chữ chỉ độ lớn CHỈ bóc khi không dính vào từ khác. Không có
//    lookahead `(?![\p{L}])` thì "cu"/"tr" ăn vào giữa chữ và tiêu đề thành rác.
assert.equal(stripAmountWords('2 cuốn sách 90k'), 'cuốn sách');
assert.equal(stripAmountWords('1 trứng'), 'trứng');
assert.equal(stripAmountWords('cà phê'), 'cà phê');        // không có số thì giữ nguyên
assert.equal(stripAmountWords(''), '');

/* parseCurrencyInput — chỉ nhân khi có chữ chỉ độ lớn TƯỜNG MINH */
assert.equal(parseCurrencyInput('50k'), 50000);
assert.equal(parseCurrencyInput('50 nghìn'), 50000);
assert.equal(parseCurrencyInput('50 ngàn'), 50000);
assert.equal(parseCurrencyInput('2.5 triệu'), 2500000);
assert.equal(parseCurrencyInput('3tr'), 3000000);
assert.equal(parseCurrencyInput('1 củ'), 1000000);
assert.equal(parseCurrencyInput('1.5m'), 1500000);
assert.equal(parseCurrencyInput('120.000'), 120000);
assert.equal(parseCurrencyInput(''), 0);

// Gõ số trần thì lưu đúng số đó — không còn tự ×1.000 cho số dưới 10.000
assert.equal(parseCurrencyInput('50'), 50);
assert.equal(parseCurrencyInput('5000'), 5000);
assert.equal(parseCurrencyInput('250000'), 250000);
// Ký hiệu $ / usd không còn đổi theo tỷ giá: chỉ đọc phần số
assert.equal(parseCurrencyInput('10$'), 10);
assert.equal(parseCurrencyInput('2 usd'), 2);

/* ── Không còn chỗ nào dùng Auto-K / tỷ giá ──
   Soi source để một lần refactor sau không lén đưa tham số/cảnh báo Auto-K quay lại. */
const src = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
for (const file of ['ListScreen', 'RecurringScreen', 'AddScreen', 'AnalyzeScreen']) {
  const code = src(`../../components/finance/${file}.jsx`);
  assert.equal(/autoK|Auto-K/.test(code), false, `${file} không còn dính Auto-K`);
}
assert.equal(/getUsdRate|getAutoK|lh_auto_k|lh_usd_rate/.test(src('../../utils/currencyUtils.js')), false,
  'currencyUtils không còn tỷ giá / Auto-K');

/* ── formatVND ── */
assert.ok(formatVND(50000).endsWith('₫'));
assert.ok(formatVND(50000).replace(/\s/g, '').includes('50.000'));
assert.ok(formatVND(0).endsWith('₫'));

/* Các biến thể không dấu tiếng Việt của độ lớn */
assert.equal(parseCurrencyInput('50 nghin'), 50000);
assert.equal(parseCurrencyInput('50 ngan'), 50000);
assert.equal(parseCurrencyInput('2 trieu'), 2000000);
assert.equal(parseCurrencyInput('2 cu'), 2000000);
assert.equal(parseCurrencyInput('1,5tr'), 1500000, 'dấu phẩy thập phân với tr');
assert.equal(parseCurrencyInput('1.5tr'), 1500000, 'dấu chấm thập phân với tr');
assert.equal(parseCurrencyInput('1,234,567'), 1234567, 'dấu phẩy ngăn cách hàng nghìn');
assert.equal(parseCurrencyInput('1.234.567'), 1234567, 'dấu chấm ngăn cách hàng nghìn');
assert.equal(parseCurrencyInput('0'), 0);
assert.equal(parseCurrencyInput('text khong co so'), 0);

/* stripAmountWords đa dạng */
assert.equal(stripAmountWords('cơm tấm 35k'), 'cơm tấm');
assert.equal(stripAmountWords('mua cafe 25 ngàn'), 'mua cafe');
assert.equal(stripAmountWords('tiền trọ 3.5 triệu'), 'tiền trọ');
assert.equal(stripAmountWords('tiền thưởng 10tr'), 'tiền thưởng');
assert.equal(stripAmountWords('mượn 2 củ'), 'mượn');

console.log('currency input tests passed');

