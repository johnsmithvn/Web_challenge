/**
 * taskFields — logic thuần quanh "field của 1 task": tên gọi, cách so sánh khi
 * có thay đổi, và cách đọc 1 dòng activity log thành câu tiếng Việt.
 *
 * Tách khỏi React/Supabase để test bằng node:assert (xem
 * src/__tests__/taskFields.test.js), cùng lý do như recurrenceUtils.js.
 *
 * Hai phía dùng chung file này:
 *   - PHÍA GHI: useUserTasks.js gọi diffTaskFields() để biết field nào đã đổi.
 *   - PHÍA ĐỌC: TaskDetailModal hiển thị nhãn + giá trị + câu mô tả.
 * Một nguồn duy nhất nên hai phía không bao giờ lệch nhau.
 *
 * ACTIONS nằm ở đây (dù có cả action ngoài phạm vi task như expense_add) vì
 * migration v5.0.0 CỐ Ý không đặt CHECK constraint cho cột `action` — mọi lệnh
 * ghi log đều fire-and-forget nuốt lỗi, nên CHECK bị vi phạm sẽ làm log biến
 * mất âm thầm. Hằng số dùng chung là thứ thay thế: gõ sai thì lỗi ở tầng JS,
 * thấy ngay.
 */

// ── Tuỳ chọn field của task (dời từ TaskListSection.jsx v5.0.0) ─────────────
// Dời ra đây để TaskDetailModal dùng lại mà không phải import ngược
// TaskListSection (vòng tròn import — vỡ với Vite HMR).
export const PRIORITY_OPTIONS = [
  { value: 0, label: 'Không', icon: '➖', color: 'var(--text-muted)' },
  { value: 1, label: 'Rất thấp', icon: '⬇️', color: '#94a3b8' },
  { value: 2, label: 'Thấp', icon: '🔽', color: '#60a5fa' },
  { value: 3, label: 'Trung bình', icon: '▶️', color: '#eab308' },
  { value: 4, label: 'Cao', icon: '🔼', color: '#f97316' },
  { value: 5, label: 'Khẩn cấp', icon: '⚡', color: '#ef4444' },
];

/** Index = Date.getDay() (0 = Chủ Nhật), khớp `recurrence_rule.weekday`. */
export const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

// ── Vốn từ của activity_logs.action ────────────────────────────────────────
// MỌI action đều gắn với 1 task (activity_logs.task_id luôn có giá trị).
// v5.0.0 đã bỏ hết action rời rạc (expense_add, inbox_*, focus_done,
// challenge_done, habit_done…): heatmap Life Log là người đọc duy nhất của
// chúng, mà Life Log + KPI "Hoạt động hôm nay" đã bị gỡ.
export const ACTIONS = {
  TASK_CREATED: 'task_created',
  TASK_COMPLETED: 'task_completed',
  TASK_UNCOMPLETED: 'task_uncompleted',
  TASK_UPDATE: 'task_update',       // dòng field-diff, luôn kèm cột `field`
  TASK_TAG_ADD: 'task_tag_add',
  TASK_TAG_REMOVE: 'task_tag_remove',
  TASK_LINK_ADD: 'task_link_add',
  TASK_LINK_REMOVE: 'task_link_remove',
  NOTE: 'note',                     // ghi chú cá nhân, nội dung ở cột `note`
};

// ── Nhãn tiếng Việt cho từng cột của user_tasks ─────────────────────────────
// `tags` / `collections` là field ẢO (dữ liệu nằm ở bảng junction, không phải
// cột của user_tasks) nhưng về nghiệp vụ vẫn là "đổi field của task".
export const TASK_FIELD_LABELS = {
  title: 'Tiêu đề',
  description: 'Mô tả',
  due_date: 'Hạn chót',
  due_time: 'Giờ hẹn',
  priority: 'Độ ưu tiên',
  recurrence_rule: 'Lặp lại',
  recurrence_parent_id: 'Chuỗi lặp',
  completed: 'Trạng thái',
  completed_at: 'Thời điểm hoàn thành',
  notified: 'Đã nhắc',
  created_at: 'Ngày tạo',
  updated_at: 'Cập nhật lúc',
  tags: 'Tag',
  collections: 'Bài viết liên kết',
};

/** Nhãn của 1 field; field lạ → trả nguyên tên cột (diff là generic, cột thêm
 *  sau này vẫn hiện được, chỉ là chưa dịch). */
export function fieldLabel(field) {
  return TASK_FIELD_LABELS[field] || field;
}

// ── Diff ────────────────────────────────────────────────────────────────────

/**
 * Cột không bao giờ được coi là "user sửa field": khoá, dấu thời gian tự động.
 * `updated_at` do trigger DB ghi, log lại là nhiễu.
 */
const DIFF_IGNORED = new Set(['id', 'user_id', 'created_at', 'updated_at']);

/**
 * Chuẩn hoá 1 giá trị về chuỗi (hoặc null) để so sánh VÀ để lưu xuống
 * old_value/new_value — cả 2 cột đều là TEXT.
 *
 * Ba cái bẫy thật đã gặp trong repo này, xử lý hết ở đây:
 *  - `due_time`: DB trả 'HH:MM:SS' còn form gửi 'HH:MM' → không cắt thì mỗi lần
 *    bấm Lưu đẻ 1 dòng log giả.
 *  - `recurrence_rule`: JSONB, so sánh bằng === luôn khác nhau kể cả nội dung
 *    y hệt → phải stringify.
 *  - description trống: chỗ thì `''`, chỗ thì `null` → gộp về null.
 */
export function normalizeFieldValue(field, value) {
  if (value === undefined || value === null || value === '') return null;
  if (field === 'due_time') return String(value).substring(0, 5);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * So task cũ với payload thay đổi → danh sách field thật sự đổi.
 *
 * GENERIC theo thiết kế: duyệt key có trong `changes` chứ không có danh sách
 * field cứng, nên cột thêm sau này (parent_id, depends_on_id…) tự động được
 * log, miễn nó đi qua updateTask().
 *
 * PHẢI so GIÁ TRỊ, không so sự tồn tại của key: form Sửa của TaskListSection
 * luôn gửi đủ 6 key kể cả key không đổi.
 *
 * @param {object|undefined} oldTask — task trước khi sửa (có thể undefined nếu
 *        task không nằm trong state cục bộ; khi đó old_value = null)
 * @param {object} changes — payload snake_case gửi cho Supabase
 * @returns {Array<{field:string, old_value:string|null, new_value:string|null}>}
 */
export function diffTaskFields(oldTask, changes) {
  if (!changes) return [];
  const diffs = [];
  for (const field of Object.keys(changes)) {
    // Key tiền tố `_` là dữ liệu join client-side (_tags, _collections), không
    // phải cột DB. Chặn theo tiền tố nên key join thêm sau này tự động đúng.
    if (field.startsWith('_')) continue;
    if (DIFF_IGNORED.has(field)) continue;

    const oldValue = normalizeFieldValue(field, oldTask ? oldTask[field] : undefined);
    const newValue = normalizeFieldValue(field, changes[field]);
    if (oldValue === newValue) continue;

    diffs.push({ field, old_value: oldValue, new_value: newValue });
  }
  return diffs;
}

// ── Hiển thị ────────────────────────────────────────────────────────────────

/**
 * Mô tả quy tắc lặp thành tiếng Việt. Nhận cả object lẫn chuỗi JSON (diff lưu
 * xuống DB dạng chuỗi), JSON hỏng thì trả nguyên chuỗi thay vì ném lỗi.
 */
export function describeRecurrence(rule) {
  if (!rule) return 'Không lặp';
  let parsed = rule;
  if (typeof rule === 'string') {
    try {
      parsed = JSON.parse(rule);
    } catch {
      return rule;
    }
  }
  if (!parsed || typeof parsed !== 'object') return String(rule);
  if (parsed.type === 'interval') return `Mỗi ${parsed.days} ngày`;
  if (parsed.type === 'weekly') return `Hàng tuần vào ${WEEKDAYS[parsed.weekday] ?? parsed.weekday}`;
  if (parsed.type === 'monthly') return `Hàng tháng ngày ${parsed.day}`;
  return 'Không lặp';
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Giá trị 1 field → chuỗi người đọc được. Dùng cho cả lưới field lẫn feed log. */
export function formatTaskFieldValue(field, raw) {
  if (raw === undefined || raw === null || raw === '') return 'trống';

  switch (field) {
    case 'due_date': {
      // Chuỗi 'yyyy-MM-dd' phải ghép 'T00:00:00' mới được hiểu là giờ ĐỊA PHƯƠNG;
      // để trần thì new Date() parse như UTC và lùi 1 ngày ở GMT+7.
      const str = String(raw);
      return ISO_DATE.test(str)
        ? new Date(`${str}T00:00:00`).toLocaleDateString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
          })
        : str;
    }
    case 'due_time':
      return String(raw).substring(0, 5);
    case 'priority': {
      const opt = PRIORITY_OPTIONS.find(p => p.value === Number(raw));
      return opt ? `${opt.icon} ${opt.label}` : String(raw);
    }
    case 'recurrence_rule':
      return describeRecurrence(raw);
    case 'recurrence_parent_id':
      return 'Thuộc chuỗi lặp';
    case 'completed':
      return String(raw) === 'true' ? 'Đã hoàn thành' : 'Chưa hoàn thành';
    case 'notified':
      return String(raw) === 'true' ? 'Đã nhắc' : 'Chưa nhắc';
    case 'completed_at':
    case 'created_at':
    case 'updated_at':
      return new Date(raw).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    default:
      return String(raw);
  }
}

/** Độ dài tối đa của 1 giá trị hiện thẳng trong feed; dài hơn thì cắt + "Xem thêm". */
export const LOG_VALUE_PREVIEW_LEN = 80;

/** Cắt giá trị dài để không phá layout feed. Trả { text, truncated }. */
export function previewValue(text) {
  const str = text == null ? '' : String(text);
  if (str.length <= LOG_VALUE_PREVIEW_LEN) return { text: str, truncated: false };
  return { text: `${str.slice(0, LOG_VALUE_PREVIEW_LEN)}…`, truncated: true };
}

/**
 * 1 dòng activity_logs → cách hiển thị.
 *
 * @returns {{icon:string, text:string, oldText:string|null, newText:string|null}}
 *   oldText/newText = null nghĩa là dòng đó không cần dòng giá trị phụ.
 */
export function describeActivity(row) {
  const { action, field, old_value: oldValue, new_value: newValue } = row || {};

  switch (action) {
    case ACTIONS.TASK_CREATED:
      return { icon: '✳️', text: 'Tạo nhiệm vụ', oldText: null, newText: null };
    case ACTIONS.TASK_COMPLETED:
      return { icon: '✅', text: 'Đánh dấu hoàn thành', oldText: null, newText: null };
    case ACTIONS.TASK_UNCOMPLETED:
      return { icon: '↩️', text: 'Bỏ đánh dấu hoàn thành', oldText: null, newText: null };
    case ACTIONS.TASK_TAG_ADD:
      return { icon: '🏷', text: `Thêm tag: ${newValue}`, oldText: null, newText: null };
    case ACTIONS.TASK_TAG_REMOVE:
      return { icon: '🏷', text: `Bỏ tag: ${oldValue}`, oldText: null, newText: null };
    case ACTIONS.TASK_LINK_ADD:
      return { icon: '🔗', text: `Liên kết bài viết: ${newValue}`, oldText: null, newText: null };
    case ACTIONS.TASK_LINK_REMOVE:
      return { icon: '🔗', text: `Bỏ liên kết: ${oldValue}`, oldText: null, newText: null };

    case ACTIONS.TASK_UPDATE: {
      const label = fieldLabel(field);
      const before = oldValue == null ? null : formatTaskFieldValue(field, oldValue);
      const after = newValue == null ? null : formatTaskFieldValue(field, newValue);
      // Đặt/Xoá đọc tự nhiên hơn "Đổi X: trống → Y"
      if (before === null) return { icon: '✏️', text: `Đặt ${label}`, oldText: null, newText: after };
      if (after === null) return { icon: '✏️', text: `Xoá ${label}`, oldText: before, newText: null };
      return { icon: '✏️', text: `Đổi ${label}`, oldText: before, newText: after };
    }

    // Không khớp → hiện action thô. Diff là generic nên dòng lạ vẫn phải đọc
    // được, tuyệt đối không rơi vào `undefined`.
    default:
      return { icon: '•', text: action || 'Hoạt động', oldText: null, newText: null };
  }
}
