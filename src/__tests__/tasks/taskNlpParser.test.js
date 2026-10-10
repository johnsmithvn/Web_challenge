import assert from 'node:assert/strict';
import { parseTaskQuickText, shiftDateDays, formatFriendlyDate } from '../../utils/taskNlpParser.js';

console.log('Testing taskNlpParser pure functions...');

const BASE_DATE = '2026-10-10'; // Thứ 7

// 1. Phân tích đầy đủ cú pháp: "Họp thiết kế mai 9h !cao #UI #Mobile"
const res1 = parseTaskQuickText('Họp thiết kế mai 9h !cao #UI #Mobile', BASE_DATE);
assert.equal(res1.title, 'Họp thiết kế');
assert.equal(res1.due_date, '2026-10-11');
assert.equal(res1.due_time, '09:00');
assert.equal(res1.priority, 4);
assert.deepEqual(res1.tags, ['UI', 'Mobile']);
assert.equal(res1.chips.length, 4); // Date, Priority, 2 Tags

// 2. Phân tích hôm nay và độ ưu tiên khẩn cấp (!khẩn)
const res2 = parseTaskQuickText('Fix bug crash nay 14h30 !khẩn', BASE_DATE);
assert.equal(res2.title, 'Fix bug crash');
assert.equal(res2.due_date, '2026-10-10');
assert.equal(res2.due_time, '14:30');
assert.equal(res2.priority, 5);

// 3. Phân tích thứ trong tuần: "t2" (Thứ Hai tuần sau kể từ Thứ 7 2026-10-10) -> 2026-10-12
const res3 = parseTaskQuickText('Nộp báo cáo tuần t2 8:00 !2', BASE_DATE);
assert.equal(res3.title, 'Nộp báo cáo tuần');
assert.equal(res3.due_date, '2026-10-12');
assert.equal(res3.due_time, '08:00');
assert.equal(res3.priority, 4);

// 4. Chuỗi rỗng hoặc chỉ có khoảng trắng
const res4 = parseTaskQuickText('   ', BASE_DATE);
assert.equal(res4.title, '');
assert.equal(res4.due_date, null);
assert.equal(res4.due_time, null);
assert.equal(res4.priority, 0);
assert.deepEqual(res4.tags, []);

// 5. Chuỗi thường không có ký tự đặc biệt
const res5 = parseTaskQuickText('Đi siêu thị mua hoa quả', BASE_DATE);
assert.equal(res5.title, 'Đi siêu thị mua hoa quả');
assert.equal(res5.due_date, null);
assert.equal(res5.due_time, null);
assert.equal(res5.priority, 0);

// 6. shiftDateDays và formatFriendlyDate
assert.equal(shiftDateDays(1, '2026-10-10'), '2026-10-11');
assert.equal(shiftDateDays(-1, '2026-10-10'), '2026-10-09');
assert.equal(formatFriendlyDate('2026-10-10', '2026-10-10'), 'Hôm nay');
assert.equal(formatFriendlyDate('2026-10-11', '2026-10-10'), 'Ngày mai');

console.log('✅ taskNlpParser check: OK');
