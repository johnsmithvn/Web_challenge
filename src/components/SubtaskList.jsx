import { useState } from 'react';
import AppIcon from './AppIcon';
import { toDateStr } from '../utils/dateUtils';
import {
  addSubtask, toggleSubtask, renameSubtask, setSubtaskDue, removeSubtask, moveSubtask,
  subtaskProgress, isSubtaskOverdue,
} from '../utils/subtaskUtils';
import '../styles/tasks.css';

const fmtDM = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Badge tiến độ `☑ 2/4` cho mặt trước thẻ (Kanban, hàng Danh sách). */
export function SubtaskBadge({ items }) {
  const { done, total } = subtaskProgress(items);
  if (!total) return null;
  return (
    <span className={`subtask-badge${done === total ? ' subtask-badge--done' : ''}`} title="Việc con đã xong">
      <AppIcon name="checkSquare" size={12} weight="bold" /> {done}/{total}
    </span>
  );
}

/**
 * SubtaskList — checklist việc con (kiểu checklist của card Trello).
 *
 * mode="edit": thêm (Enter thêm tiếp), tick, đổi tên (bấm vào tên), hạn riêng,
 *   kéo thả sắp xếp (Alt+↑/↓ trên tay nắm khi dùng phím), xoá, và — nếu có
 *   `onConvert` — chuyển thành task con (task thật có parent_task_id). Dùng ở popup Chi tiết và TaskForm.
 * mode="tick": chỉ tick, cho mặt trước thẻ.
 *
 * Không tự ghi DB: mọi thao tác gọi `onChange(mảngMới)`; nơi gọi lưu (updateTask)
 * hoặc giữ trong state form. Logic thuần ở utils/subtaskUtils.
 */
export default function SubtaskList({ items, onChange, mode = 'edit', onConvert }) {
  const list = Array.isArray(items) ? items : [];
  const editable = mode === 'edit';
  const today = toDateStr();
  const [draft, setDraft] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [dueEditId, setDueEditId] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const { done, total } = subtaskProgress(list);

  const commitAdd = () => {
    if (!draft.trim()) return;
    onChange(addSubtask(list, draft));
    setDraft('');
  };

  const commitRename = (id) => {
    onChange(renameSubtask(list, id, renameDraft));
    setRenamingId(null);
  };

  return (
    // Chặn click nổi bọt (thẻ Kanban / hàng Danh sách bọc ngoài có onClick riêng). Phím
    // chỉ chặn ở mode tick — mode edit nằm trong TaskForm, Ctrl+Enter phải tới được form.
    <div
      className={`subtask-list subtask-list--${mode}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={editable ? undefined : (e) => e.stopPropagation()}
    >
      {editable && (
        <div className="subtask-list__head">
          <span><AppIcon name="listChecks" size={14} /> Việc con{total > 0 && ` · ${done}/${total}`}</span>
          {total > 0 && (
            <span className="subtask-list__bar" aria-hidden="true">
              <span style={{ width: `${Math.round((done / total) * 100)}%` }} />
            </span>
          )}
        </div>
      )}

      {list.map((s, i) => {
        const overdue = isSubtaskOverdue(s, today);
        return (
          <div
            key={s.id}
            className={`subtask-row${s.done ? ' subtask-row--done' : ''}${dragIndex === i ? ' subtask-row--dragging' : ''}`}
            draggable={editable && renamingId !== s.id}
            onDragStart={editable ? (e) => { setDragIndex(i); e.dataTransfer.effectAllowed = 'move'; } : undefined}
            onDragOver={editable ? (e) => e.preventDefault() : undefined}
            onDrop={editable ? (e) => {
              e.preventDefault();
              if (dragIndex !== null) onChange(moveSubtask(list, dragIndex, i));
              setDragIndex(null);
            } : undefined}
            onDragEnd={editable ? () => setDragIndex(null) : undefined}
          >
            {editable && (
              <button
                type="button"
                className="subtask-row__grip"
                aria-label={`Kéo để sắp xếp: ${s.title} (Alt + mũi tên lên/xuống)`}
                onKeyDown={(e) => {
                  if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
                  e.preventDefault();
                  onChange(moveSubtask(list, i, e.key === 'ArrowUp' ? i - 1 : i + 1));
                }}
              >
                <AppIcon name="dotsSix" size={14} />
              </button>
            )}

            <input
              type="checkbox"
              className="subtask-row__check"
              checked={Boolean(s.done)}
              onChange={() => onChange(toggleSubtask(list, s.id))}
              aria-label={`${s.done ? 'Bỏ tick' : 'Tick'}: ${s.title}`}
            />

            {editable && renamingId === s.id ? (
              <input
                className="auth-input subtask-row__rename"
                value={renameDraft}
                autoFocus
                onChange={(e) => setRenameDraft(e.target.value)}
                onBlur={() => commitRename(s.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitRename(s.id); }
                  // Escape chỉ huỷ đổi tên — không để nổi lên document đóng popup Chi tiết.
                  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setRenamingId(null); }
                }}
              />
            ) : (
              <span
                className="subtask-row__title"
                onClick={editable ? () => { setRenamingId(s.id); setRenameDraft(s.title); } : undefined}
                title={editable ? 'Bấm để đổi tên' : undefined}
              >
                {s.title}
              </span>
            )}

            {editable && dueEditId === s.id ? (
              <input
                type="date"
                className="auth-input subtask-row__date"
                value={s.due_date || ''}
                autoFocus
                onChange={(e) => { onChange(setSubtaskDue(list, s.id, e.target.value)); setDueEditId(null); }}
                onBlur={() => setDueEditId(null)}
                onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setDueEditId(null); } }}
              />
            ) : s.due_date ? (
              <button
                type="button"
                className={`subtask-due${overdue ? ' subtask-due--overdue' : ''}`}
                onClick={editable ? () => setDueEditId(s.id) : undefined}
                disabled={!editable}
                title={overdue ? 'Quá hạn' : 'Hạn việc con'}
              >
                <AppIcon name="calendar" size={11} /> {fmtDM(s.due_date)}
              </button>
            ) : editable && (
              <button type="button" className="subtask-row__icon" onClick={() => setDueEditId(s.id)} aria-label={`Đặt hạn: ${s.title}`} title="Đặt hạn">
                <AppIcon name="calendar" size={13} />
              </button>
            )}

            {editable && onConvert && (
              <button type="button" className="subtask-row__icon" onClick={() => onConvert(s)} aria-label={`Chuyển thành task con: ${s.title}`} title="Chuyển thành task con (đủ chi tiết, vẫn thuộc task này)">
                <AppIcon name="external" size={13} />
              </button>
            )}
            {editable && (
              <button type="button" className="subtask-row__icon subtask-row__icon--danger" onClick={() => onChange(removeSubtask(list, s.id))} aria-label={`Xoá việc con: ${s.title}`} title="Xoá">
                <AppIcon name="x" size={13} />
              </button>
            )}
          </div>
        );
      })}

      {editable && (
        <input
          className="auth-input subtask-list__add"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Thêm việc con… (Enter để thêm tiếp)"
          aria-label="Thêm việc con"
          onKeyDown={(e) => {
            // Enter thêm việc con, KHÔNG submit form bọc ngoài (TaskForm).
            if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); commitAdd(); }
          }}
          onBlur={commitAdd}
        />
      )}
    </div>
  );
}
