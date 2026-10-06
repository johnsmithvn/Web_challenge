import { useState, useEffect, useMemo, useCallback } from 'react';
import AppIcon from './AppIcon';
import { useConfirm } from './ConfirmModal';
import { toDateStr } from '../utils/dateUtils';
import { hasExplicitTime } from '../utils/calendarTimeUtils';
import { PRIORITY_OPTIONS } from '../utils/taskFields';
import { sortSubtasks, mergeSubtasks, moveItem } from '../utils/subtaskUtils';
import UI_STRINGS from '../data/ui-strings.json';
import '../styles/tasks.css';

const fmtDM = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Badge tiến độ `☑ 2/4` trên mặt trước thẻ task cha. `progress` từ subtaskProgressByParent. */
export function SubtaskBadge({ progress }) {
  if (!progress?.total) return null;
  const { done, total } = progress;
  return (
    <span className={`subtask-badge${done === total ? ' subtask-badge--done' : ''}`} title="Subtask đã xong">
      <AppIcon name="checkSquare" size={12} weight="bold" /> {done}/{total}
    </span>
  );
}

/** Chip "↳ Tên task cha" ở đầu popup Chi tiết của subtask — bấm để về task cha. */
export function ParentChip({ parent, onOpen }) {
  const clickable = Boolean(parent && onOpen);
  const open = (e) => { e.stopPropagation(); onOpen(parent); };
  return (
    <span
      className={`task-parent-chip${clickable ? ' task-parent-chip--link' : ''}`}
      title={parent ? `Subtask của: ${parent.title}` : 'Subtask'}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? open : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); } } : undefined}
    >
      ↳ {parent?.title || 'Task cha'}
    </span>
  );
}

/**
 * SubtaskList — subtask của 1 task cha (v6.20.0). Subtask là task thật (parent_task_id)
 * nhưng chỉ sống ở đây: Kanban/Danh sách/Lịch không hiện.
 *
 * mode="edit" (popup Chi tiết, form sửa): tick, bấm tên = mở popup Chi tiết của
 *   subtask (đủ mô tả, hạn, giờ, ưu tiên, tag, ghi chú…), kéo thả sắp xếp (Alt+↑/↓
 *   trên tay nắm khi dùng phím), xoá (có xác nhận), Enter ở ô cuối = thêm subtask.
 * mode="tick" (mặt trước thẻ Kanban / hàng Danh sách): tick + bấm tên để mở.
 *
 * Dữ liệu: state useUserTasks (tải đủ subtask của task cha đang có). mode edit gộp
 * thêm query DB cho task cha không nằm trong state (vd đã xong ngày cũ, mở từ Lịch).
 */
export default function SubtaskList({ parent, taskModel, onOpenTask, mode = 'edit' }) {
  const editable = mode === 'edit';
  const {
    tasks = [], addTask, completeTask, uncompleteTask, deleteTask, reorderSubtasks, getSubtasks,
  } = taskModel;
  const { confirm, ConfirmModal } = useConfirm();
  const [fetched, setFetched] = useState([]);
  const [draft, setDraft] = useState('');
  const [dragIndex, setDragIndex] = useState(null);
  const today = toDateStr();

  const load = useCallback(() => {
    if (!editable || !getSubtasks) return;
    getSubtasks(parent.id).then(setFetched);
  }, [editable, getSubtasks, parent.id]);

  useEffect(() => {
    if (!editable || !getSubtasks) return;
    let stale = false;
    getSubtasks(parent.id).then((rows) => { if (!stale) setFetched(rows); });
    return () => { stale = true; };
  }, [editable, getSubtasks, parent.id]);

  const items = useMemo(
    () => (editable
      ? mergeSubtasks(parent.id, fetched, tasks)
      : sortSubtasks(tasks.filter((t) => t.parent_task_id === parent.id))),
    [editable, parent.id, fetched, tasks]
  );
  const doneCount = items.filter((s) => s.completed).length;

  const toggle = async (s) => {
    if (s.completed) await uncompleteTask(s.id);
    else await completeTask(s.id);
    load(); // subtask không nằm trong state (task cha cũ) → tải lại cho đúng
  };

  const remove = async (s) => {
    const cfg = UI_STRINGS.confirm.deleteTask;
    if (!(await confirm({ ...cfg, message: cfg.message.replace('{name}', s.title) }))) return;
    await deleteTask(s.id);
    load();
  };

  const move = async (from, to) => {
    if (to < 0 || to >= items.length) return;
    await reorderSubtasks(moveItem(items, from, to));
    load();
  };

  const add = async () => {
    const title = draft.trim();
    if (!title) return;
    setDraft('');
    await addTask({ title, dueDate: parent.due_date, parentTaskId: parent.id });
  };

  if (!editable && items.length === 0) return null;

  return (
    // Chặn click nổi bọt: thẻ Kanban / hàng Danh sách bọc ngoài có onClick riêng.
    // Phím chỉ chặn ở mode tick — mode edit nằm trong TaskForm, Ctrl+Enter phải tới form.
    <div
      className={`subtask-list subtask-list--${mode}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={editable ? undefined : (e) => e.stopPropagation()}
    >
      {ConfirmModal}
      {editable && (
        <div className="subtask-list__head">
          <span><AppIcon name="listChecks" size={14} /> Subtask{items.length > 0 && ` · ${doneCount}/${items.length}`}</span>
          {items.length > 0 && (
            <span className="subtask-list__bar" aria-hidden="true">
              <span style={{ width: `${Math.round((doneCount / items.length) * 100)}%` }} />
            </span>
          )}
        </div>
      )}

      {items.map((s, i) => {
        const overdue = !s.completed && s.due_date < today;
        const pri = PRIORITY_OPTIONS.find((p) => p.value === (s.priority || 0));
        const time = s.start_time && s.end_time
          ? `${s.start_time.substring(0, 5)}–${s.end_time.substring(0, 5)}`
          : hasExplicitTime(s.due_time) ? s.due_time.substring(0, 5) : null;
        return (
          <div
            key={s.id}
            className={`subtask-row${s.completed ? ' subtask-row--done' : ''}${dragIndex === i ? ' subtask-row--dragging' : ''}`}
            draggable={editable}
            onDragStart={editable ? (e) => { setDragIndex(i); e.dataTransfer.effectAllowed = 'move'; } : undefined}
            onDragOver={editable ? (e) => e.preventDefault() : undefined}
            onDrop={editable ? (e) => {
              e.preventDefault();
              if (dragIndex !== null) move(dragIndex, i);
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
                  move(i, e.key === 'ArrowUp' ? i - 1 : i + 1);
                }}
              >
                <AppIcon name="dotsSix" size={14} />
              </button>
            )}

            <input
              type="checkbox"
              className="subtask-row__check"
              checked={Boolean(s.completed)}
              onChange={() => toggle(s)}
              aria-label={`${s.completed ? 'Bỏ hoàn thành' : 'Hoàn thành'} subtask: ${s.title}`}
            />

            {s.priority > 0 && pri && (
              <span className="subtask-row__pri" style={{ background: pri.color }} title={`Ưu tiên: ${pri.label}`} />
            )}

            <button
              type="button"
              className="subtask-row__title subtask-row__open"
              onClick={() => onOpenTask?.(s)}
              title="Mở chi tiết subtask"
            >
              {s.title}
            </button>

            {time && <span className="subtask-row__time">{time}</span>}
            {s.due_date && s.due_date !== parent.due_date && (
              <span className={`subtask-due${overdue ? ' subtask-due--overdue' : ''}`} title={overdue ? 'Quá hạn' : 'Hạn subtask'}>
                <AppIcon name="calendar" size={11} /> {fmtDM(s.due_date)}
              </span>
            )}

            {editable && (
              <button
                type="button"
                className="subtask-row__icon subtask-row__icon--danger"
                onClick={() => remove(s)}
                aria-label={`Xoá subtask: ${s.title}`}
                title="Xoá"
              >
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
          placeholder="Thêm subtask… (Enter để thêm tiếp)"
          aria-label="Thêm subtask"
          onKeyDown={(e) => {
            // Enter thêm subtask, KHÔNG submit form bọc ngoài (TaskForm).
            if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); add(); }
          }}
        />
      )}
    </div>
  );
}
