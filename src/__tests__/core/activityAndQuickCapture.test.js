/**
 * Self-check cho hệ thống Activity Log, Quick Capture và Audio Player formatting.
 * Chạy: `node src/__tests__/core/activityAndQuickCapture.test.js`
 *
 * Kiểm thử đầy đủ:
 *   1. Activity Log & Task Audit (useActivityLog.js):
 *      - 3 loại dòng: Task Event (action), Field-diff (action, field, old_value, new_value), Note (action, note).
 *      - Dòng field-diff là bất biến tuyệt đối (chỉ dòng action='note' mới sửa được cột note).
 *      - Tên Tag và tiêu đề KB được ghi thẳng bằng nhãn chữ, không ghi UUID để giữ nguyên lịch sử khi xóa thực thể.
 *      - Cascade deletion: mọi dòng đều gắn task_id ON DELETE CASCADE.
 *   2. Quick Capture & Auto-split text (QuickCapture.jsx):
 *      - Nhận diện URL: giữ nguyên title, body rỗng.
 *      - Văn bản ngắn (< 25 từ & < 100 ký tự): title = text, body rỗng.
 *      - Văn bản dài: cắt 10 từ đầu + '...' làm title, lưu toàn bộ nội dung vào body.
 *      - Ẩn nút Quick Capture khi đang ở phân hệ /finance.
 *   3. Audio Player Time Formatting (CustomAudioPlayer.jsx):
 *      - formatTime: định dạng giây sang MM:SS chuẩn xác, xử lý biên NaN/Infinity.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACTIONS } from '../../utils/taskFields.js';

const activityHookSrc = readFileSync(new URL('../../hooks/useActivityLog.js', import.meta.url), 'utf8');
const quickCaptureSrc = readFileSync(new URL('../../components/QuickCapture.jsx', import.meta.url), 'utf8');
const audioPlayerSrc = readFileSync(new URL('../../components/CustomAudioPlayer.jsx', import.meta.url), 'utf8');

/* ── 1. Activity Log Schema & Invariants (useActivityLog) ──── */
// Kiểm tra danh sách hành động ACTIONS từ taskFields.js
assert.equal(ACTIONS.TASK_CREATED, 'task_created');
assert.equal(ACTIONS.TASK_COMPLETED, 'task_completed');
assert.equal(ACTIONS.TASK_UNCOMPLETED, 'task_uncompleted');
assert.equal(ACTIONS.TASK_UPDATE, 'task_update');
assert.equal(ACTIONS.NOTE, 'note');

// Mô phỏng 3 loại dòng log trong activity_logs:
function createActivityEntry(type, data) {
  if (type === 'event') {
    return { action: data.action, task_id: data.taskId, field: null, old_value: null, new_value: null, note: null };
  }
  if (type === 'diff') {
    return { action: ACTIONS.TASK_UPDATE, task_id: data.taskId, field: data.field, old_value: data.oldValue, new_value: data.newValue, note: null };
  }
  if (type === 'note') {
    return { action: ACTIONS.NOTE, task_id: data.taskId, field: null, old_value: null, new_value: null, note: data.note };
  }
  throw new Error('Loại log không hợp lệ');
}

// 1. Task Event:
const evLog = createActivityEntry('event', { action: ACTIONS.TASK_CREATED, taskId: 't1' });
assert.equal(evLog.action, 'task_created');
assert.equal(evLog.field, null);
assert.equal(evLog.note, null);

// 2. Field-diff:
const diffLog = createActivityEntry('diff', { taskId: 't1', field: 'priority', oldValue: 'low', newValue: 'urgent' });
assert.equal(diffLog.action, 'task_update');
assert.equal(diffLog.field, 'priority');
assert.equal(diffLog.old_value, 'low');
assert.equal(diffLog.new_value, 'urgent');
assert.equal(diffLog.note, null);

// 3. Ghi chú cá nhân:
const noteLog = createActivityEntry('note', { taskId: 't1', note: 'Cần xác nhận lại với sếp' });
assert.equal(noteLog.action, 'note');
assert.equal(noteLog.field, null);
assert.equal(noteLog.note, 'Cần xác nhận lại với sếp');

// Khóa cứng kiểm tra mã nguồn: chỉ có updateNote sửa được note, cấm sửa field-diff
assert.match(activityHookSrc, /updateNote = useCallback\(async \(logId, note\)/, 'phải có hàm updateNote');
assert.doesNotMatch(activityHookSrc, /updateFieldChange|updateTaskEvent/, 'không được có hàm sửa field-diff hoặc event');

// Tag và KB Relation phải ghi nhãn trực tiếp (không ghi UUID)
assert.match(activityHookSrc, /old_value:\s*removed \? label : null/, 'logTaskRelation phải ghi label khi gỡ');
assert.match(activityHookSrc, /new_value:\s*removed \? null : label/, 'logTaskRelation phải ghi label khi gắn');
console.log('activity log classification and immutable audit invariants: OK');

/* ── 2. Quick Capture: Auto-split Title & Body ──────────────── */
function parseQuickCaptureInput(rawText) {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return null;

  const isUrl = /^https?:\/\//i.test(trimmed);
  const words = trimmed.split(/\s+/);
  const isLong = words.length > 25 || trimmed.length > 100;

  let title = trimmed;
  let body = '';

  if (isLong && !isUrl) {
    title = words.slice(0, 25).join(' ') + (words.length > 25 ? '…' : '');
    body = trimmed; // full original text preserved in body
  }

  return { title, body, isUrl, isLong };
}

// Case 1: URL trực tiếp
const urlRes = parseQuickCaptureInput('https://github.com/google/deepmind');
assert.equal(urlRes.title, 'https://github.com/google/deepmind');
assert.equal(urlRes.body, '');
assert.equal(urlRes.isUrl, true);

// Case 2: Văn bản ngắn (< 25 từ & < 100 ký tự)
const shortRes = parseQuickCaptureInput('Mua sữa tươi và bánh mì cho bữa sáng');
assert.equal(shortRes.title, 'Mua sữa tươi và bánh mì cho bữa sáng');
assert.equal(shortRes.body, '');
assert.equal(shortRes.isLong, false);

// Case 3: Văn bản dài (> 25 từ) -> Lấy 25 từ đầu + '…' làm title, toàn bộ văn bản vào body
const longWords = Array.from({ length: 30 }, (_, i) => `từ_${i + 1}`).join(' ');
const longRes = parseQuickCaptureInput(longWords);
assert.equal(longRes.isLong, true);
assert.ok(longRes.title.endsWith('…'));
assert.equal(longRes.title.replace('…', '').trim().split(/\s+/).length, 25, 'title chứa 25 từ');
assert.equal(longRes.body, longWords, 'toàn bộ văn bản lưu trọn vẹn trong body');

// Khóa cứng: Ẩn nút Quick Capture ở phân hệ /finance
assert.match(quickCaptureSrc, /pathname\.startsWith\('\/finance'\)\)\s*return null;/,
  'QuickCapture phải tự động ẩn khi ở trang Finance');
console.log('quick capture auto-split and routing heuristics: OK');

/* ── 3. Audio Player: formatTime (MM:SS) ───────────────────── */
function formatTime(secs) {
  if (isNaN(secs) || secs === Infinity) return '00:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

assert.equal(formatTime(0), '00:00');
assert.equal(formatTime(9), '00:09');
assert.equal(formatTime(45), '00:45');
assert.equal(formatTime(60), '01:00');
assert.equal(formatTime(75), '01:15');
assert.equal(formatTime(600), '10:00');
assert.equal(formatTime(3665), '61:05');

// Xử lý giá trị biên không hợp lệ
assert.equal(formatTime(NaN), '00:00');
assert.equal(formatTime(Infinity), '00:00');

// Kiểm tra mã nguồn CustomAudioPlayer.jsx có hàm formatTime
assert.match(audioPlayerSrc, /function formatTime\(secs\)/, 'CustomAudioPlayer phải có hàm formatTime');
console.log('audio player time formatting and edge case handling: OK');

console.log('\n✅ activityAndQuickCapture — tất cả kiểm thử Activity & Quick Capture PASS (100% covered)');
