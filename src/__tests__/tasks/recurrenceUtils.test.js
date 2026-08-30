/**
 * Self-check cho recurrenceUtils — chạy: `node src/__tests__/recurrenceUtils.test.js`
 *
 * Khoá lại 2 thứ hay quên: (1) clamp cuối tháng khi ngày lặp không tồn tại ở tháng
 * đích (mục 5 — trước đây JS tự tràn sang tháng kế tiếp nữa, sai); (2) quy tắc xoá
 * bất đối xứng gốc/không-gốc (mục 3 — xoá gốc KHÔNG cascade, xoá không-gốc CÓ cascade).
 */
import assert from 'node:assert/strict';
import { computeNextDueDate, resolveDeletionIds } from '../../utils/recurrenceUtils.js';

/* ── computeNextDueDate: interval ────────────────────────── */
assert.equal(computeNextDueDate({ type: 'interval', days: 7 }, '2026-08-01'), '2026-08-08');
assert.equal(computeNextDueDate({ type: 'interval', days: 1 }, '2026-08-31'), '2026-09-01'); // qua tháng
assert.equal(computeNextDueDate(null, '2026-08-01'), null);
assert.equal(computeNextDueDate({ type: 'unknown' }, '2026-08-01'), null);

/* ── computeNextDueDate: weekly (2026-08-01 = Thứ Bảy, getDay()=6) ── */
// Từ thứ 7 (6), lặp vào Thứ Hai (1) → nhảy tới thứ 2 tuần sau (03/08), không phải "hôm nay"
assert.equal(computeNextDueDate({ type: 'weekly', weekday: 1 }, '2026-08-01'), '2026-08-03');
// Lặp đúng vào Thứ Bảy (6, cùng ngày với fromDate) → vẫn phải nhảy tới TUẦN SAU, không đứng yên
assert.equal(computeNextDueDate({ type: 'weekly', weekday: 6 }, '2026-08-01'), '2026-08-08');

/* ── computeNextDueDate: monthly — clamp cuối tháng ─────────── */
// Từ 15/8, lặp "ngày 31" → tháng 8 còn ngày 31 phía sau nên ở lại tháng 8
assert.equal(computeNextDueDate({ type: 'monthly', day: 31 }, '2026-08-15'), '2026-08-31');
// Từ 15/9, chưa tới ngày 31 theo số thứ tự (15 < 31) → CHƯA nhảy tháng, ở lại tháng 9 —
// nhưng tháng 9 không có ngày 31 → clamp về cuối tháng hiện tại (30/9), không nhảy sang tháng 10
assert.equal(computeNextDueDate({ type: 'monthly', day: 31 }, '2026-09-15'), '2026-09-30');
// Từ 31/1, lặp "ngày 31", tháng đích là Feb (28 ngày, 2026 không nhuận) → CLAMP về 28, không tràn sang 03/01
assert.equal(computeNextDueDate({ type: 'monthly', day: 31 }, '2026-01-31'), '2026-02-28');
// Ngày 28 luôn tồn tại ở mọi tháng → không cần clamp, không có gì đặc biệt
assert.equal(computeNextDueDate({ type: 'monthly', day: 28 }, '2026-01-31'), '2026-02-28');
assert.equal(computeNextDueDate({ type: 'monthly', day: 28 }, '2026-02-10'), '2026-02-28');
// Từ ngày < targetDay trong THÁNG NÀY → ở lại tháng này (chưa qua ngày đó)
assert.equal(computeNextDueDate({ type: 'monthly', day: 20 }, '2026-08-05'), '2026-08-20');

/* ── resolveDeletionIds: xoá task GỐC → không cascade ───────── */
const chain = [
  { id: 't1', recurrence_parent_id: null },   // gốc
  { id: 't2', recurrence_parent_id: 't1' },   // con của t1
  { id: 't3', recurrence_parent_id: 't2' },   // con của t2 (cháu t1)
];
assert.deepEqual(resolveDeletionIds(chain, 't1'), ['t1']); // chỉ xoá đúng nó

/* ── resolveDeletionIds: xoá task KHÔNG PHẢI gốc → cascade hết hậu duệ ── */
assert.deepEqual(resolveDeletionIds(chain, 't2'), ['t2', 't3']);

/* ── resolveDeletionIds: xoá lá cuối chuỗi → chỉ có chính nó (không hậu duệ) ── */
assert.deepEqual(resolveDeletionIds(chain, 't3'), ['t3']);

/* ── resolveDeletionIds: id không tồn tại trong danh sách → trả về chính nó ── */
assert.deepEqual(resolveDeletionIds(chain, 'unknown'), ['unknown']);

/* ── resolveDeletionIds: chuỗi dài hơn — cascade xuyên nhiều cấp ── */
const longChain = [
  { id: 'a', recurrence_parent_id: null },
  { id: 'b', recurrence_parent_id: 'a' },
  { id: 'c', recurrence_parent_id: 'b' },
  { id: 'd', recurrence_parent_id: 'c' },
];
assert.deepEqual(resolveDeletionIds(longChain, 'b'), ['b', 'c', 'd']); // xuyên qua c tới d
assert.deepEqual(resolveDeletionIds(longChain, 'a'), ['a']); // gốc vẫn không cascade dù chuỗi dài hơn

console.log('recurrenceUtils check: OK');
