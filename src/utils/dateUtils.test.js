/**
 * Self-check cho dateUtils — chạy: `node src/utils/dateUtils.test.js`
 *
 * Điểm chính cần khoá: `toDateStr` phải dùng giờ **địa phương**. Trước v4.26.1 repo có
 * 4 bản copy của hàm này, và nhiều chỗ khác dùng `toISOString().split('T')[0]` (UTC) —
 * ở GMT+7 khoảng 00:00–06:59 hai cách cho ra 2 ngày khác nhau. Case 00:30 dưới đây
 * fail ngay nếu ai đó "dọn" hàm này thành toISOString.
 */
import assert from 'node:assert/strict';
import { toDateStr, formatDate, formatDateTime } from './dateUtils.js';

/* toDateStr — local, không UTC */
assert.equal(toDateStr(new Date(2026, 6, 28)), '2026-07-28');       // tháng 0-index
assert.equal(toDateStr(new Date(2026, 0, 5)),  '2026-01-05');       // pad ngày + tháng
assert.equal(toDateStr(new Date(2026, 11, 31)), '2026-12-31');

// 00:30 sáng giờ địa phương: toISOString ở GMT+7 sẽ lùi về ngày hôm trước
const earlyMorning = new Date(2026, 0, 5, 0, 30);
assert.equal(toDateStr(earlyMorning), '2026-01-05', 'toDateStr phải theo giờ local');

// mặc định = hôm nay, và luôn đúng dạng yyyy-MM-dd
assert.match(toDateStr(), /^\d{4}-\d{2}-\d{2}$/);
assert.equal(toDateStr(), toDateStr(new Date()));

/* formatDate / formatDateTime — falsy trả '—' thay vì "Invalid Date" */
assert.equal(formatDate(null), '—');
assert.equal(formatDate(''), '—');
assert.equal(formatDateTime(undefined), '—');
assert.match(formatDate('2026-07-28T10:00:00Z'), /^\d{2}\/\d{2}\/\d{4}$/);
// formatDateTime phải giữ được giờ:phút (dùng toLocaleString, không phải toLocaleDateString)
assert.match(formatDateTime('2026-07-28T10:00:00Z'), /\d{2}:\d{2}/);

console.log('dateUtils check: OK');
