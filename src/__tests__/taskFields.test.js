/**
 * Self-check cho taskFields — chạy: `node src/__tests__/taskFields.test.js`
 *
 * Khoá lại 3 nhóm dễ vỡ nhất:
 *  (1) diffTaskFields KHÔNG được đẻ log rác — form Sửa luôn gửi đủ 6 key kể cả
 *      key không đổi, `due_time` lệch định dạng giữa DB và form, recurrence_rule
 *      là object nên so === luôn khác, `_tags`/`_collections` là key join ảo.
 *  (2) Fallback bắt buộc: field/action lạ phải hiện được, không ra `undefined`
 *      (diff là generic — cột thêm sau này sẽ lên log trước khi ai kịp dịch nhãn).
 *  (3) formatTaskFieldValue với due_date phải giữ đúng ngày ở GMT+7.
 */
import assert from 'node:assert/strict';
import {
  diffTaskFields,
  normalizeFieldValue,
  formatTaskFieldValue,
  describeRecurrence,
  describeActivity,
  fieldLabel,
  previewValue,
  ACTIONS,
} from '../utils/taskFields.js';

/* ── normalizeFieldValue: gộp mọi kiểu "rỗng" về null ────────── */
assert.equal(normalizeFieldValue('description', null), null);
assert.equal(normalizeFieldValue('description', ''), null);
assert.equal(normalizeFieldValue('description', undefined), null);
// due_time: DB trả 'HH:MM:SS', form gửi 'HH:MM' → phải cùng dạng mới so được
assert.equal(normalizeFieldValue('due_time', '14:30:00'), '14:30');
assert.equal(normalizeFieldValue('due_time', '14:30'), '14:30');
// object (recurrence_rule JSONB) → chuỗi JSON
assert.equal(
  normalizeFieldValue('recurrence_rule', { type: 'interval', days: 7 }),
  '{"type":"interval","days":7}'
);
assert.equal(normalizeFieldValue('priority', 3), '3');
assert.equal(normalizeFieldValue('completed', false), 'false');
// 0 KHÔNG phải "rỗng" — priority 0 là giá trị thật ("Không")
assert.equal(normalizeFieldValue('priority', 0), '0');

/* ── diffTaskFields: không đổi thì KHÔNG log ─────────────────── */
const task = {
  id: 't1',
  user_id: 'u1',
  title: 'Viết báo cáo',
  description: null,
  due_date: '2026-08-05',
  due_time: '23:59:00',              // DB trả kèm giây
  priority: 3,
  recurrence_rule: { type: 'interval', days: 7 },
  completed: false,
  created_at: '2026-08-01T10:00:00Z',
  _tags: [{ id: 'g1', name: 'Việc' }],
};

// Payload y hệt form Sửa gửi: đủ 6 key, KHÔNG có gì đổi thật → 0 dòng log
assert.deepEqual(
  diffTaskFields(task, {
    title: 'Viết báo cáo',
    description: '',                  // '' vs null → cùng là "trống"
    due_date: '2026-08-05',
    due_time: '23:59',                // 'HH:MM' vs 'HH:MM:SS' → cùng giá trị
    priority: 3,
    recurrence_rule: { type: 'interval', days: 7 }, // object mới, nội dung y hệt
  }),
  []
);

/* ── diffTaskFields: chỉ log đúng field đã đổi ───────────────── */
assert.deepEqual(
  diffTaskFields(task, {
    title: 'Viết báo cáo',            // không đổi
    due_date: '2026-08-10',           // đổi
    priority: 5,                      // đổi
  }),
  [
    { field: 'due_date', old_value: '2026-08-05', new_value: '2026-08-10' },
    { field: 'priority', old_value: '3', new_value: '5' },
  ]
);

/* ── diffTaskFields: bỏ qua key join ảo + khoá + dấu thời gian tự động ── */
assert.deepEqual(
  diffTaskFields(task, {
    _tags: [],                        // join client-side, không phải cột DB
    _collections: [],
    id: 'khac',
    user_id: 'khac',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-09-09T00:00:00Z', // trigger DB ghi, log lại là nhiễu
  }),
  []
);

/* ── diffTaskFields: đặt giá trị mới / xoá giá trị ───────────── */
assert.deepEqual(
  diffTaskFields(task, { description: 'Nội dung mới' }),
  [{ field: 'description', old_value: null, new_value: 'Nội dung mới' }]
);
assert.deepEqual(
  diffTaskFields(task, { recurrence_rule: null }),
  [{ field: 'recurrence_rule', old_value: '{"type":"interval","days":7}', new_value: null }]
);

/* ── diffTaskFields: task không có trong state cục bộ → old_value null ── */
assert.deepEqual(
  diffTaskFields(undefined, { title: 'Mới' }),
  [{ field: 'title', old_value: null, new_value: 'Mới' }]
);
assert.deepEqual(diffTaskFields(task, null), []);

/* ── diffTaskFields: field MỚI chưa ai dịch nhãn vẫn phải được log ── */
assert.deepEqual(
  diffTaskFields(task, { depends_on_id: 'abc' }),
  [{ field: 'depends_on_id', old_value: null, new_value: 'abc' }]
);

/* ── fieldLabel: fallback về tên cột thô ─────────────────────── */
assert.equal(fieldLabel('due_date'), 'Hạn chót');
assert.equal(fieldLabel('depends_on_id'), 'depends_on_id');

/* ── describeRecurrence: nhận cả object, chuỗi JSON, JSON hỏng ── */
assert.equal(describeRecurrence({ type: 'interval', days: 7 }), 'Mỗi 7 ngày');
assert.equal(describeRecurrence('{"type":"interval","days":3}'), 'Mỗi 3 ngày');
assert.equal(describeRecurrence({ type: 'weekly', weekday: 3 }), 'Hàng tuần vào T4');
assert.equal(describeRecurrence({ type: 'monthly', day: 5 }), 'Hàng tháng ngày 5');
assert.equal(describeRecurrence(null), 'Không lặp');
assert.equal(describeRecurrence('{hỏng'), '{hỏng');   // không được ném lỗi

/* ── formatTaskFieldValue ────────────────────────────────────── */
assert.equal(formatTaskFieldValue('due_date', null), 'trống');
// Ở GMT+7, parse 'yyyy-MM-dd' trần sẽ ra ngày 04 — phải giữ đúng 05
assert.equal(formatTaskFieldValue('due_date', '2026-08-05'), '05/08/2026');
assert.equal(formatTaskFieldValue('due_time', '14:30:00'), '14:30');
assert.equal(formatTaskFieldValue('priority', '0'), 'Không');
assert.equal(formatTaskFieldValue('priority', '4'), 'Cao');
assert.equal(formatTaskFieldValue('completed', 'true'), 'Đã hoàn thành');
assert.equal(formatTaskFieldValue('completed', 'false'), 'Chưa hoàn thành');
assert.equal(formatTaskFieldValue('title', 'Xin chào'), 'Xin chào');
// Field lạ → String(raw), không ném lỗi
assert.equal(formatTaskFieldValue('depends_on_id', 'abc'), 'abc');

/* ── previewValue: cắt giá trị dài ───────────────────────────── */
assert.deepEqual(previewValue('ngắn'), { text: 'ngắn', truncated: false });
const long = 'x'.repeat(200);
const cut = previewValue(long);
assert.equal(cut.truncated, true);
assert.equal(cut.text.length, 81);            // 80 ký tự + dấu …
assert.deepEqual(previewValue(null), { text: '', truncated: false });

/* ── describeActivity: sự kiện rời rạc không có dòng giá trị ─── */
assert.deepEqual(
  describeActivity({ action: ACTIONS.TASK_COMPLETED }),
  { icon: 'checkCircle', text: 'Đánh dấu hoàn thành', oldText: null, newText: null }
);
assert.deepEqual(
  describeActivity({ action: ACTIONS.TASK_TAG_ADD, new_value: 'Việc' }),
  { icon: 'tag', text: 'Thêm tag: Việc', oldText: null, newText: null }
);

/* ── describeActivity: field-diff → Đổi / Đặt / Xoá ──────────── */
assert.deepEqual(
  describeActivity({
    action: ACTIONS.TASK_UPDATE, field: 'due_date',
    old_value: '2026-08-05', new_value: '2026-08-10',
  }),
  { icon: 'pencil', text: 'Đổi Hạn chót', oldText: '05/08/2026', newText: '10/08/2026' }
);
assert.deepEqual(
  describeActivity({
    action: ACTIONS.TASK_UPDATE, field: 'description',
    old_value: null, new_value: 'abc',
  }),
  { icon: 'pencil', text: 'Đặt Mô tả', oldText: null, newText: 'abc' }
);
assert.deepEqual(
  describeActivity({
    action: ACTIONS.TASK_UPDATE, field: 'description',
    old_value: 'abc', new_value: null,
  }),
  { icon: 'pencil', text: 'Xoá Mô tả', oldText: 'abc', newText: null }
);
// Field lạ vẫn đọc được, dùng tên cột thô làm nhãn
assert.equal(
  describeActivity({
    action: ACTIONS.TASK_UPDATE, field: 'depends_on_id',
    old_value: null, new_value: 'abc',
  }).text,
  'Đặt depends_on_id'
);

/* ── describeActivity: action lạ → hiện thô, KHÔNG undefined ─── */
assert.deepEqual(
  describeActivity({ action: 'hanh_dong_la' }),
  { icon: 'dots', text: 'hanh_dong_la', oldText: null, newText: null }
);
assert.equal(describeActivity({}).text, 'Hoạt động');
assert.equal(describeActivity(null).text, 'Hoạt động');

console.log('taskFields check: OK');
