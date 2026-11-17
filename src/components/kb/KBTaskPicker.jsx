import { useState } from 'react';
import { normalizeVi, suggestByTitle } from '../../utils/kbDeriveUtils';
import { statusKeyOf, taskDue } from '../../utils/kanbanUtils';
import { toDateStr } from '../../utils/dateUtils';
import LinkPicker from '../LinkPicker';

/**
 * KBTaskPicker — bộ chọn "Gắn bài vào việc" (LinkPicker): nhóm Đã gắn / Gợi ý / Đang làm / Cần làm, gõ để tìm.
 * Dùng ở cột phải trang đọc và menu ⋯ của Danh sách. Mount khi mở, `onClose` để đóng.
 * `article` phải là bản sống (có _linkedTaskIds / _linkedTasks mới nhất) để dấu đã gắn cập nhật khi bấm.
 * `pickTasks`: việc chưa xong (cấp đầu) · `onLinkTask(task, linked)` · `onCreateTask()`: tạo việc tên = tên bài.
 */
export default function KBTaskPicker({ article, anchorEl, pickTasks, onLinkTask, onCreateTask, onClose }) {
  const [query, setQuery] = useState('');
  // Việc đã gắn lúc mở: nhóm "Đã gắn" đứng yên khi gắn / bỏ
  const [start] = useState(() => (article._linkedTasks || []).filter(t => statusKeyOf(t) !== 'done'));
  const linkedIds = new Set(article._linkedTaskIds || []);
  const today = toDateStr();

  const pickItem = (t) => {
    const due = taskDue(t, today);
    return { id: t.id, title: t.title, linked: linkedIds.has(t.id), meta: due.text, metaTone: due.late ? 'late' : undefined, raw: t };
  };

  let groups;
  const q = normalizeVi(query.trim());
  if (q) {
    groups = [{ key: 'found', label: 'Kết quả', items: pickTasks.filter(t => normalizeVi(t.title).includes(q)).slice(0, 30).map(pickItem) }];
  } else {
    const startIds = new Set(start.map(t => t.id));
    const rest = pickTasks.filter(t => !startIds.has(t.id));
    const sugg = suggestByTitle(article.title, rest);
    const shown = new Set(sugg.map(t => t.id));
    const byStatus = st => rest.filter(t => !shown.has(t.id) && statusKeyOf(t) === st).slice(0, 8);
    groups = [
      { key: 'linked', label: 'Đã gắn', items: start.map(pickItem) },
      { key: 'sugg', label: 'Gợi ý · trùng chữ với tên bài', items: sugg.map(pickItem) },
      { key: 'doing', label: 'Đang làm', items: byStatus('doing').map(pickItem) },
      { key: 'todo', label: 'Cần làm', items: byStatus('todo').map(pickItem) },
    ];
  }

  return (
    <LinkPicker
      anchorEl={anchorEl}
      label="Gắn bài vào việc"
      placeholder="Tìm việc…"
      groups={groups}
      query={query}
      onQuery={setQuery}
      onToggle={item => onLinkTask(item.raw, !item.linked)}
      createLabel={`Tạo việc “${article.title}”`}
      onCreate={() => {
        onClose();
        onCreateTask();
      }}
      emptyText={query.trim() ? 'Không có việc nào khớp.' : 'Chưa có việc nào đang mở.'}
      onClose={onClose}
    />
  );
}
