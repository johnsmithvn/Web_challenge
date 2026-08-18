import assert from 'node:assert/strict';

// `parseCurrencyInput` đọc localStorage (auto-k, tỷ giá USD) mà node không có →
// stub tối thiểu, `getItem` trả null nghĩa là dùng mặc định (auto-k BẬT).
// `autoK` để test được cả trạng thái TẮT — đó mới là chỗ bug thật nằm.
let autoK = null;
globalThis.localStorage = {
  getItem: (key) => (key === 'lh_auto_k' ? autoK : null),
  setItem: () => {},
};

const { autoKPreview, groupDigits, parseCurrencyInput, sanitizeDecimal, sanitizeDigits, stripAmountWords } =
  await import('../utils/currencyUtils.js');

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

/* parseCurrencyInput — chữ chỉ độ lớn tiếng Việt phải TƯỜNG MINH, không dựa
   vào heuristic auto-k (tắt auto-k là "50 nghìn" thành 50 đồng) */
assert.equal(parseCurrencyInput('50k'), 50000);
assert.equal(parseCurrencyInput('50 nghìn'), 50000);
assert.equal(parseCurrencyInput('50 ngàn'), 50000);
assert.equal(parseCurrencyInput('2.5 triệu'), 2500000);
assert.equal(parseCurrencyInput('3tr'), 3000000);
assert.equal(parseCurrencyInput('1 củ'), 1000000);
assert.equal(parseCurrencyInput('1.5m'), 1500000);
assert.equal(parseCurrencyInput('120.000'), 120000);
assert.equal(parseCurrencyInput(''), 0);

// ⚠️ Đây là bug thật đã sửa: TẮT auto-k thì "50 nghìn" vẫn phải là 50.000. Trước
//    đây parser chỉ hiểu k/m nên "nghìn" ra đúng CHỈ nhờ heuristic auto-k.
autoK = 'false';
assert.equal(parseCurrencyInput('50 nghìn'), 50000);
assert.equal(parseCurrencyInput('2 triệu'), 2000000);
assert.equal(parseCurrencyInput('50'), 50);      // không có chữ nào → đúng là 50 đồng
autoK = null;
assert.equal(parseCurrencyInput('50'), 50000);   // auto-k bật lại → 50 nghĩa là 50k

/* ── autoKPreview: ô tiền phải nói ra khi auto-k vừa nhân thêm 1.000 ──
   Ô hiện "5.000 ₫" mà lưu 5.000.000₫ là sai im lặng gấp 1000 lần. Preview chỉ
   được hiện ĐÚNG lúc số lưu khác số đang nhìn thấy, không phải lúc nào cũng hiện
   (hiện thừa thì user học cách phớt lờ, rồi bỏ qua luôn lúc nó quan trọng). */
assert.equal(autoKPreview('5000'), '5.000.000', 'số dưới 10.000 bị nhân → phải cảnh báo');
assert.equal(autoKPreview('50'), '50.000');
assert.equal(autoKPreview('10000'), '', 'từ 10.000 trở lên auto-k không đụng → im lặng');
assert.equal(autoKPreview('250000'), '');
assert.equal(autoKPreview(''), '');
assert.equal(autoKPreview('0'), '');
assert.equal(autoKPreview('12.345'), '', 'chuỗi đã format vẫn đọc ra 12345, không cảnh báo nhầm');
autoK = 'false';
assert.equal(autoKPreview('5000'), '', 'tắt auto-k thì không còn gì để cảnh báo');
autoK = null;

/* ── option `autoK: false`: đường Inbox → Giao dịch ──
   Ghi chú Inbox là câu user đã viết ra, không phải ô nhập nhanh: "đổ xăng 5000"
   phải ra 5.000đ. Nhưng chữ chỉ độ lớn thì VẪN phải hiểu — tắt auto-K không có
   nghĩa là làm parser ngu đi. */
assert.equal(parseCurrencyInput('5000', { autoK: false }), 5000);
assert.equal(parseCurrencyInput('50', { autoK: false }), 50);
assert.equal(parseCurrencyInput('50k', { autoK: false }), 50000, 'chữ k vẫn nhân');
assert.equal(parseCurrencyInput('2 triệu', { autoK: false }), 2000000);
assert.equal(parseCurrencyInput('250000', { autoK: false }), 250000);
// Truyền `true` = ép bật dù preference đang tắt; bỏ trống = theo preference.
autoK = 'false';
assert.equal(parseCurrencyInput('50'), 50, 'bỏ trống thì theo preference (đang tắt)');
assert.equal(parseCurrencyInput('50', { autoK: true }), 50000, 'ép bật thắng preference');
autoK = null;
assert.equal(parseCurrencyInput('50', { autoK: false }), 50, 'ép tắt thắng preference');
// Dòng cảnh báo phải im khi luồng đó vốn không áp auto-K — cảnh báo sai còn tệ hơn.
assert.equal(autoKPreview('5000', { autoK: false }), '');
assert.equal(autoKPreview('5000'), '5.000.000');

console.log('currency input tests passed');
