/**
 * snippetUtils — logic thuần của Sổ lệnh (Knowledge): kiểm dữ liệu, tìm, nhóm, "Hay dùng".
 * Không Supabase / React. Test: src/__tests__/core/snippetUtils.test.js
 */
import { normalizeVi } from './kbDeriveUtils.js';

export const UNGROUPED_LABEL = 'Chưa xếp';

// Giới hạn khớp CHECK của bảng snippets (migration v6.36.0)
const LIMITS = { title: 200, code: 100000, tool: 30, group_name: 40, note: 2000, warning: 500 };

const byTitle = (a, b) => a.title.localeCompare(b.title, 'vi');

/**
 * Chuẩn hoá bản nháp từ form. Công cụ viết thường (cmd, ffmpeg) để "CMD" và "cmd" là một chip;
 * code chỉ bỏ dòng trống hai đầu, giữ thụt lề.
 * @returns {{ value: Object } | { error: string }}
 */
export function cleanSnippet(draft) {
  const value = {
    title: (draft.title || '').trim(),
    code: (draft.code || '').replace(/^\s*\n/, '').trimEnd(),
    tool: (draft.tool || '').trim().toLowerCase(),
    group_name: (draft.group_name || '').trim(),
    note: (draft.note || '').trim(),
    warning: (draft.warning || '').trim(),
  };
  if (!value.title) return { error: 'Ghi tên việc cần làm.' };
  if (!value.code.trim()) return { error: 'Dán lệnh hoặc code vào.' };
  const over = Object.keys(LIMITS).find(k => value[k].length > LIMITS[k]);
  if (over) return { error: `Ô ${over === 'group_name' ? 'nhóm' : over} quá dài (tối đa ${LIMITS[over]} ký tự).` };
  return { value };
}

/** Tìm không dấu, mọi từ phải khớp, trên tên · lệnh · ghi chú · cảnh báo · nhóm · công cụ; `tool` lọc đúng công cụ. */
export function filterSnippets(list, { q = '', tool = '' } = {}) {
  const words = normalizeVi(q).split(/\s+/).filter(Boolean);
  return list.filter(s => {
    if (tool && s.tool !== tool) return false;
    if (!words.length) return true;
    const hay = normalizeVi([s.title, s.code, s.note, s.warning, s.group_name, s.tool].join(' '));
    return words.every(w => hay.includes(w));
  });
}

/** Nhóm theo group_name, nhóm xếp theo tên (vi), "Chưa xếp" cuối; lệnh trong nhóm theo tên. */
export function groupSnippets(list) {
  const map = new Map();
  list.forEach(s => {
    const name = s.group_name || '';
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(s);
  });
  return [...map.entries()]
    .map(([name, items]) => ({ name, label: name || UNGROUPED_LABEL, items: items.sort(byTitle) }))
    .sort((a, b) => (!a.name) - (!b.name) || a.name.localeCompare(b.name, 'vi'));
}

/** "Hay dùng": n lệnh copy nhiều nhất (đã copy ít nhất một lần). */
export function topSnippets(list, n = 5) {
  return list
    .filter(s => s.copy_count > 0)
    .sort((a, b) => b.copy_count - a.copy_count || byTitle(a, b))
    .slice(0, n);
}

/** Chip công cụ: [{ tool, count }], nhiều trước; bỏ lệnh không ghi công cụ. */
export function countTools(list) {
  const counts = new Map();
  list.forEach(s => { if (s.tool) counts.set(s.tool, (counts.get(s.tool) || 0) + 1); });
  return [...counts.entries()]
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count || a.tool.localeCompare(b.tool));
}
