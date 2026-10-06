import { useState, useEffect, useMemo, useCallback } from 'react';
import AppIcon from './AppIcon';
import { toDateStr } from '../utils/dateUtils';
import { mergeChildTasks } from '../utils/subtaskUtils';
import { PRIORITY_OPTIONS } from '../utils/taskFields';
import '../styles/tasks.css';

const fmtDM = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/**
 * Chip "↳ Tên task cha" trên task con (thẻ Kanban, hàng Danh sách, popup Chi tiết).
 * `parent` có thể thiếu khi task cha không nằm trong state (đã xong ngày cũ) → chỉ hiện nhãn.
 */
export function ParentChip({ parent, onOpen }) {
  const clickable = Boolean(parent && onOpen);
  const open = (e) => { e.stopPropagation(); onOpen(parent); };
  return (
    <span
      className={`task-parent-chip${clickable ? ' task-parent-chip--link' : ''}`}
      title={parent ? `Task con của: ${parent.title}` : 'Task con'}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? open : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); } } : undefined}
    >
      ↳ {parent?.title || 'Task cha'}
    </span>
  );
}

/** Badge số task con CHƯA xong trên task cha. */
export function ChildCountBadge({ count }) {
  if (!count) return null;
  return (
    <span className="task-child-badge" title={`${count} task con chưa xong`}>
      <AppIcon name="tree" size={12} weight="bold" /> {count}
    </span>
  );
}

/**
 * ChildTaskList — khu "Task con" trong popup Chi tiết của task cha (v6.19.0).
 * Task con là task THẬT (parent_task_id): tick = hoàn thành/bỏ hoàn thành task con
 * (+XP, sinh kỳ lặp như task thường), bấm tên = mở popup Chi tiết của task con,
 * Enter ở ô cuối = tạo task con (hạn = hạn task cha).
 *
 * Dữ liệu = DB (đủ cả task con xong ngày cũ) gộp với state useUserTasks (mới hơn) —
 * xem mergeChildTasks.
 */
export default function ChildTaskList({ parent, taskModel, onOpenTask }) {
  const { tasks = [], getChildTasks, addTask, completeTask, uncompleteTask } = taskModel;
  const [fetched, setFetched] = useState([]);
  const [draft, setDraft] = useState('');
  const today = toDateStr();

  const load = useCallback(() => {
    if (!getChildTasks) return Promise.resolve();
    return getChildTasks(parent.id).then(setFetched);
  }, [getChildTasks, parent.id]);

  useEffect(() => {
    if (!getChildTasks) return;
    let stale = false;
    getChildTasks(parent.id).then((rows) => { if (!stale) setFetched(rows); });
    return () => { stale = true; };
  }, [getChildTasks, parent.id]);

  const children = useMemo(() => mergeChildTasks(parent.id, fetched, tasks), [parent.id, fetched, tasks]);
  const doneCount = children.filter((c) => c.completed).length;

  const toggle = async (child) => {
    if (child.completed) await uncompleteTask(child.id);
    else await completeTask(child.id);
    // Task con đã xong ngày cũ không nằm trong state → tải lại để hiện đúng trạng thái.
    load();
  };

  const add = async () => {
    const title = draft.trim();
    if (!title) return;
    setDraft('');
    await addTask({ title, dueDate: parent.due_date, parentTaskId: parent.id });
  };

  return (
    <div className="subtask-list subtask-list--edit child-task-list">
      <div className="subtask-list__head">
        <span><AppIcon name="tree" size={14} /> Task con{children.length > 0 && ` · ${doneCount}/${children.length}`}</span>
        {children.length > 0 && (
          <span className="subtask-list__bar" aria-hidden="true">
            <span style={{ width: `${Math.round((doneCount / children.length) * 100)}%` }} />
          </span>
        )}
      </div>

      {children.map((c) => {
        const overdue = !c.completed && c.due_date && c.due_date < today;
        const pri = PRIORITY_OPTIONS.find((p) => p.value === (c.priority || 0));
        return (
          <div key={c.id} className={`subtask-row${c.completed ? ' subtask-row--done' : ''}`}>
            <input
              type="checkbox"
              className="subtask-row__check"
              checked={Boolean(c.completed)}
              onChange={() => toggle(c)}
              aria-label={`${c.completed ? 'Bỏ hoàn thành' : 'Hoàn thành'} task con: ${c.title}`}
            />
            {c.priority > 0 && pri && (
              <span className="child-task-list__pri" style={{ background: pri.color }} title={`Ưu tiên: ${pri.label}`} />
            )}
            <button type="button" className="subtask-row__title child-task-list__open" onClick={() => onOpenTask(c)} title="Mở chi tiết task con">
              {c.title}
            </button>
            {c.due_date && (
              <span className={`subtask-due${overdue ? ' subtask-due--overdue' : ''}`} title={overdue ? 'Quá hạn' : 'Hạn'}>
                <AppIcon name="calendar" size={11} /> {fmtDM(c.due_date)}
              </span>
            )}
            <AppIcon name="caretRight" size={12} />
          </div>
        );
      })}

      <input
        className="auth-input subtask-list__add"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Thêm task con… (Enter để thêm tiếp)"
        aria-label="Thêm task con"
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
      />
    </div>
  );
}
