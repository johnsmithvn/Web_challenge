import { useEffect, useState } from 'react';
import AppIcon from './AppIcon';
import { statusKeyOf } from '../utils/kanbanUtils';
import { useConfirm } from './ConfirmModal';
import UI_STRINGS from '../data/ui-strings.json';

/*
 * TaskSubtaskModal — hộp chi tiết việc con (mockup "Nhiệm vụ · Kanban"): về việc cha,
 * ▲▼ chuyển qua lại giữa các việc con, đánh dấu xong, sửa tên + ghi chú (tự lưu khi rời ô),
 * xoá việc con.
 */
function SubtaskBody({ parent, sub, index, total, taskModel }) {
  const { updateTask, completeTask, uncompleteTask } = taskModel || {};
  const [title, setTitle] = useState(sub.title || '');
  const [desc, setDesc] = useState(sub.description || '');
  const done = statusKeyOf(sub) === 'done';

  const saveTitle = () => {
    const v = title.replace(/\n/g, ' ').trim();
    if (v && v !== sub.title) updateTask?.(sub.id, { title: v });
    else setTitle(sub.title || '');
  };
  const saveDesc = () => {
    if (desc !== (sub.description || '')) updateTask?.(sub.id, { description: desc });
  };
  const toggle = () => (done ? uncompleteTask?.(sub.id) : completeTask?.(sub.id));

  return (
    <div className="tk-submodal__body">
      <span className="tk-submodal__code">
        LH-{String(parent.id).slice(-4).toUpperCase()} · việc con {index + 1}/{total}
      </span>
      <div className="tk-submodal__title-row">
        <button type="button" className="tk-submodal__check" title={done ? 'Bỏ đánh dấu xong' : 'Đánh dấu xong'} onClick={toggle}>
          <AppIcon
            name={done ? 'checkCircle' : 'circle'}
            size={22}
            weight={done ? 'fill' : 'regular'}
            style={{ color: done ? 'var(--tk-st-done)' : 'var(--tk-text-mute)' }}
          />
        </button>
        <textarea
          className="tk-submodal__title"
          rows={2}
          value={title}
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, ' '))}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.target.blur();
            }
          }}
        />
      </div>
      <div className="tk-submodal__status">
        <button
          type="button"
          className="tk-submodal__chip"
          style={{ color: done ? 'var(--tk-st-done)' : 'var(--tk-text-sub)' }}
          onClick={toggle}
        >
          {done ? 'Đã xong' : 'Chưa xong'}
        </button>
      </div>
      <textarea
        className="tk-submodal__desc"
        value={desc}
        placeholder="Ghi chú cho việc con…"
        onChange={(e) => setDesc(e.target.value)}
        onBlur={saveDesc}
      />
    </div>
  );
}

export default function TaskSubtaskModal({ parent, subtasks, index, onIndex, onClose, onOpenParent, taskModel, onDeleted }) {
  const { confirm, ConfirmModal } = useConfirm();
  const sub = subtasks[index];
  const total = subtasks.length;

  // Esc đóng hộp; ↑/↓ khi không gõ chữ thì chuyển việc con
  useEffect(() => {
    const onKey = (e) => {
      if (document.querySelector('.cm-overlay')) return;
      const typing = /^(INPUT|TEXTAREA)$/.test(e.target.tagName);
      if (e.key === 'Escape') {
        e.preventDefault();
        if (typing) e.target.blur();
        onClose();
      } else if (!typing && e.key === 'ArrowUp' && index > 0) onIndex(index - 1);
      else if (!typing && e.key === 'ArrowDown' && index < total - 1) onIndex(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, total, onIndex, onClose]);

  if (!sub) return null;

  const handleDelete = async () => {
    const cfg = UI_STRINGS.confirm.deleteTask;
    if (!(await confirm({ ...cfg, message: cfg.message.replace('{name}', sub.title) }))) return;
    await taskModel?.deleteTask?.(sub.id);
    onDeleted?.(sub.id);
    if (total <= 1) onClose();
    else onIndex(Math.min(index, total - 2));
  };

  return (
    <div className="tk-modal-scrim" onClick={onClose}>
      {ConfirmModal}
      <div className="tk-submodal" role="dialog" aria-label="Chi tiết việc con" onClick={(e) => e.stopPropagation()}>
        <div className="tk-submodal__head">
          <button type="button" className="tk-submodal__parent" title="Mở việc cha" onClick={onOpenParent}>
            <AppIcon name="toParent" size={14} style={{ flex: 'none' }} />
            <span>{parent.title}</span>
          </button>
          <button
            type="button"
            className="tk-drawer__icon-btn"
            title="Việc con trước"
            disabled={index === 0}
            onClick={() => onIndex(index - 1)}
          >
            <AppIcon name="caretUp" size={14} />
          </button>
          <button
            type="button"
            className="tk-drawer__icon-btn"
            title="Việc con sau"
            disabled={index >= total - 1}
            onClick={() => onIndex(index + 1)}
          >
            <AppIcon name="caretDown" size={14} />
          </button>
          <button type="button" className="tk-drawer__icon-btn" title="Đóng (Esc)" onClick={onClose}>
            <AppIcon name="x" size={15} />
          </button>
        </div>

        <SubtaskBody key={sub.id} parent={parent} sub={sub} index={index} total={total} taskModel={taskModel} />

        <div className="tk-submodal__foot">
          <span className="tk-autosave">
            <AppIcon name="cloudCheck" size={14} />
            Tự lưu
          </span>
          <button type="button" className="tk-btn-ghost tk-btn-ghost--icon" onClick={handleDelete}>
            <AppIcon name="trash" size={15} />
            Xoá việc con
          </button>
        </div>
      </div>
    </div>
  );
}
