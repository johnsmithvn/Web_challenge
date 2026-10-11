import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import AppIcon from './AppIcon';
import { StatusPopover, PriorityPopover, TaskDatePickerPopover, RecurrencePopover } from './TaskFloatingPopovers';
import TaskSubtaskModal from './TaskSubtaskModal';
import { useActivityLog } from '../hooks/useActivityLog';
import { useAuth } from '../contexts/AuthContext';
import { toDateStr, formatDate } from '../utils/dateUtils';
import { PRIORITY_LABELS } from '../utils/taskNlpParser';
import { STATUS_META, statusKeyOf } from '../utils/kanbanUtils';
import { describeRecurrence, describeActivity } from '../utils/taskFields';
import { formatSpent } from '../utils/calendarTimeUtils';
import { sortSubtasks } from '../utils/subtaskUtils';
import { useConfirm } from './ConfirmModal';
import { useTags } from '../hooks/useTags';
import UI_STRINGS from '../data/ui-strings.json';

/*
 * TaskDetailDrawer — ngăn chi tiết bên phải theo mockup "Nhiệm vụ · Kanban tối & sáng":
 * tên sửa tại chỗ, lưới thuộc tính (Trạng thái · Hạn · Ưu tiên · Lặp lại · Thực tế · Nhãn),
 * mô tả Markdown có Lưu/Huỷ, việc con, tab Hoạt động / Ghi chú, chân có meta + Xoá.
 */

// Markdown: bọc vùng chọn hoặc chèn đầu dòng (như md() của mockup)
const MD_WRAP = { b: ['**', '**'], i: ['_', '_'], s: ['~~', '~~'], code: ['`', '`'], link: ['[', '](https://)'] };
const MD_LINE = { ul: '- ', ol: '1. ', todo: '- [ ] ' };
const MD_DESC_TOOLS = [['b', 'textBold', 'Đậm'], ['i', 'textItalic', 'Nghiêng'], ['s', 'textStrike', 'Gạch ngang'], '|',
  ['ul', 'listBullets', 'Danh sách'], ['ol', 'listNumbers', 'Danh sách số'], ['todo', 'checklist', 'Checklist'], '|',
  ['link', 'linkSimple', 'Chèn link'], ['code', 'code', 'Code']];
const MD_NOTE_TOOLS = [['b', 'textBold', 'Đậm'], ['i', 'textItalic', 'Nghiêng'], '|',
  ['ul', 'listBullets', 'Danh sách'], ['todo', 'checklist', 'Checklist'], '|', ['link', 'linkSimple', 'Chèn link'], ['code', 'code', 'Code']];

function applyMarkdown(el, value, kind) {
  const a = el.selectionStart;
  const b = el.selectionEnd;
  if (MD_WRAP[kind]) {
    const [pre, post] = MD_WRAP[kind];
    return { next: value.slice(0, a) + pre + value.slice(a, b) + post + value.slice(b), ca: a + pre.length, cb: b + pre.length };
  }
  const ls = value.lastIndexOf('\n', a - 1) + 1;
  const ins = MD_LINE[kind];
  return { next: value.slice(0, ls) + ins + value.slice(ls), ca: a + ins.length, cb: b + ins.length };
}

function MdToolbar({ tools, onTool }) {
  return (
    <div className="tk-md-toolbar">
      {tools.map((t, i) => (t === '|' ? (
        <span key={`sep${i}`} className="tk-md-toolbar__sep" />
      ) : (
        <button
          key={t[0]}
          type="button"
          title={t[2]}
          className="tk-md-toolbar__btn"
          onMouseDown={(e) => {
            e.preventDefault();
            onTool(t[0]);
          }}
        >
          <AppIcon name={t[1]} size={15} />
        </button>
      )))}
    </div>
  );
}

// Nhãn ngày cho nhóm log: Hôm nay / Hôm qua / dd/mm/yyyy
const dayLabel = (iso) => {
  const d = toDateStr(new Date(iso));
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (d === toDateStr()) return 'Hôm nay';
  if (d === toDateStr(y)) return 'Hôm qua';
  return formatDate(d);
};
const hhmm = (iso) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const dmHm = (iso) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1} ${hhmm(iso)}`;
};
const dueLabel = (task, today) => {
  if (!task.due_date) return 'Đặt hạn';
  const tm = task.due_time ? ` · ${task.due_time.slice(0, 5)}` : '';
  if (task.due_date === today) return `Hôm nay${tm}`;
  const d = new Date(`${task.due_date}T00:00:00`);
  return `${['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}${tm}`;
};

// Màu biểu tượng nhật ký theo loại thay đổi (token --tk-act-*)
const actColor = (row) => {
  if (row.action === 'task_created') return 'var(--tk-act-create)';
  if (row.action === 'task_completed' || row.action === 'task_uncompleted' || row.field === 'status') return 'var(--tk-act-st)';
  if (['due_date', 'due_time', 'start_date', 'start_time'].includes(row.field)) return 'var(--tk-act-due)';
  if (row.field === 'priority') return 'var(--tk-act-pr)';
  return 'var(--tk-text-sub)';
};

export default function TaskDetailDrawer({ task, onClose, taskModel }) {
  const { user } = useAuth();
  const { confirm, ConfirmModal } = useConfirm();
  const { getTaskLogs, addNote, deleteLog } = useActivityLog();
  const { updateTask, completeTask, uncompleteTask, deleteTask, linkTaskTag, unlinkTaskTag } = taskModel || {};
  const { addTag } = useTags();
  const today = toDateStr();

  const [titleDraft, setTitleDraft] = useState(task?.title || '');
  const [titleEditing, setTitleEditing] = useState(false);
  const [descDraft, setDescDraft] = useState(task?.description || '');
  const [descEditing, setDescEditing] = useState(false);
  const [tagInput, setTagInput] = useState(null); // null = đang ẩn ô nhập nhãn
  const [subtaskInput, setSubtaskInput] = useState('');
  const [subIndex, setSubIndex] = useState(null); // hộp việc con đang mở
  const [footerTab, setFooterTab] = useState('activity');
  const [logs, setLogs] = useState([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteFocus, setNoteFocus] = useState(false);
  const [popover, setPopover] = useState(null); // { type, x, y }
  const [fetchedSubs, setFetchedSubs] = useState([]);
  const descRef = useRef(null);
  const noteRef = useRef(null);

  // Bản nháp khởi tạo từ task lúc mở (TasksPage gắn key = task.id nên đổi việc là mount lại).
  const taskId = task?.id;
  const savedDesc = task?.description || '';
  const allTasks = taskModel?.tasks;
  const [logsVersion, setLogsVersion] = useState(0);
  const reloadLogs = () => setLogsVersion((v) => v + 1);

  useEffect(() => {
    if (!taskId || !user || !getTaskLogs) return undefined;
    let stale = false;
    getTaskLogs(taskId).then((rows) => {
      if (!stale) setLogs(rows || []);
    });
    return () => { stale = true; };
  }, [taskId, user, getTaskLogs, logsVersion]);

  useEffect(() => {
    if (!taskId || !taskModel?.getSubtasks) return undefined;
    let stale = false;
    taskModel.getSubtasks(taskId).then((rows) => {
      if (!stale && rows) setFetchedSubs(rows);
    });
    return () => { stale = true; };
  }, [taskId, taskModel]);

  // Việc con: bản fetch (gồm cả việc xong cũ) + state (cập nhật tức thì)
  const subtasks = useMemo(() => {
    if (!taskId) return [];
    const map = new Map(fetchedSubs.map((s) => [s.id, s]));
    for (const s of allTasks || []) if (s.parent_task_id === taskId) map.set(s.id, s);
    return sortSubtasks([...map.values()]);
  }, [fetchedSubs, allTasks, taskId]);

  const descDirty = descDraft !== savedDesc;

  const saveDesc = useCallback(() => {
    if (descDirty) updateTask?.(taskId, { description: descDraft });
    setDescEditing(false);
    descRef.current?.blur();
  }, [descDirty, descDraft, taskId, updateTask]);

  // Đóng ngăn: mô tả chưa lưu thì lưu luôn để không mất chữ
  const handleClose = useCallback(() => {
    if (descDirty) updateTask?.(taskId, { description: descDraft });
    onClose();
  }, [descDirty, descDraft, taskId, updateTask, onClose]);

  // Esc đóng ngăn (khi không có popover / hộp việc con đang mở)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || subIndex !== null || document.querySelector('.tk-popover')) return;
      handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose, subIndex]);

  if (!task) return null;

  const stKey = statusKeyOf(task);
  const st = STATUS_META[stKey];
  const isDone = stKey === 'done';
  const pr = PRIORITY_LABELS[Number(task.priority) || 0] || PRIORITY_LABELS[0];
  const daysLate = !isDone && task.status !== 'skip' && task.due_date && task.due_date < today
    ? Math.round((new Date(`${today}T00:00:00`) - new Date(`${task.due_date}T00:00:00`)) / 864e5)
    : 0;
  const doneSubs = subtasks.filter((s) => statusKeyOf(s) === 'done').length;
  const subPct = subtasks.length ? Math.round((doneSubs / subtasks.length) * 100) : 0;
  const activityLogs = logs.filter((l) => l.action !== 'note');
  const notes = logs.filter((l) => l.action === 'note');
  const activityGroups = [];
  for (const lg of activityLogs) {
    const day = lg.created_at ? dayLabel(lg.created_at) : '';
    const last = activityGroups[activityGroups.length - 1];
    if (last && last.day === day) last.items.push(lg);
    else activityGroups.push({ day, items: [lg] });
  }
  const meta = [
    task.created_at && `Tạo ${dmHm(task.created_at)}`,
    task.updated_at && task.updated_at !== task.created_at && `Sửa ${dmHm(task.updated_at)}`,
  ].filter(Boolean).join(' · ');
  const initial = (user?.email || 'B')[0].toUpperCase();

  const openPop = (type) => (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPopover({ type, x: r.left, y: r.bottom + 6 });
  };
  const popStyle = popover ? { position: 'fixed', top: `${popover.y}px`, left: `${popover.x}px` } : null;

  const changeStatus = (next) => {
    if (next === 'done') completeTask?.(task.id);
    else if (isDone) uncompleteTask?.(task.id, next);
    else updateTask?.(task.id, { status: next });
  };

  const commitTitle = () => {
    const v = titleDraft.replace(/\n/g, ' ').trim();
    if (v && v !== task.title) updateTask?.(task.id, { title: v });
    else setTitleDraft(task.title || '');
    setTitleEditing(false);
  };

  const runMd = (ref, value, setValue, kind) => {
    const el = ref.current;
    if (!el) return;
    const { next, ca, cb } = applyMarkdown(el, value, kind);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(ca, cb);
    });
  };

  const handleAddTag = async () => {
    const name = (tagInput || '').replace(/^#/, '').trim();
    setTagInput(null);
    if (!name || !addTag || !linkTaskTag) return;
    const tag = await addTag(name);
    if (tag && !(task._tags || []).some((t) => t.id === tag.id)) await linkTaskTag(task.id, tag);
  };

  const handleAddSubtask = async () => {
    const v = subtaskInput.trim();
    if (!v || !taskModel?.addTask) return;
    setSubtaskInput('');
    await taskModel.addTask({ title: v, dueDate: task.due_date, parentTaskId: task.id });
    const rows = await taskModel.getSubtasks?.(task.id);
    if (rows) setFetchedSubs(rows);
  };

  const handleAddNote = async () => {
    const v = noteDraft.trim();
    if (!v || !addNote) return;
    await addNote(task.id, v);
    setNoteDraft('');
    reloadLogs();
  };

  const handleDelete = async () => {
    const cfg = UI_STRINGS.confirm.deleteTask;
    if (!(await confirm({ ...cfg, message: cfg.message.replace('{name}', task.title) }))) return;
    await deleteTask?.(task.id);
    onClose();
  };

  return (
    <>
      {ConfirmModal}
      {/* Mobile: phủ mờ sau sheet; desktop: ẩn (bảng vẫn bấm được, như mockup) */}
      <div className="tk-drawer-backdrop" onClick={handleClose} />

      {popover?.type === 'status' && (
        <StatusPopover currentStatus={stKey} onSelect={changeStatus} onClose={() => setPopover(null)} style={popStyle} />
      )}
      {popover?.type === 'date' && (
        <TaskDatePickerPopover
          initialDate={task.due_date}
          initialTime={task.due_time}
          onSave={(d, t) => updateTask?.(task.id, { due_date: d, due_time: t })}
          onClose={() => setPopover(null)}
          style={popStyle}
        />
      )}
      {popover?.type === 'priority' && (
        <PriorityPopover
          currentPriority={task.priority}
          onSelect={(p) => updateTask?.(task.id, { priority: p })}
          onClose={() => setPopover(null)}
          style={popStyle}
        />
      )}
      {popover?.type === 'recurrence' && (
        <RecurrencePopover
          currentRule={task.recurrence_rule}
          onSelect={(rule) => updateTask?.(task.id, { recurrence_rule: rule })}
          onClose={() => setPopover(null)}
          style={popStyle}
        />
      )}

      <aside className="tk-drawer" aria-label="Chi tiết việc">
        <div className="tk-drawer__head">
          <span className="tk-drawer__code">LH-{String(task.id).slice(-4).toUpperCase()}</span>
          <button type="button" className="tk-drawer__icon-btn" onClick={handleClose} title="Đóng (Esc)" aria-label="Đóng">
            <AppIcon name="x" size={16} />
          </button>
        </div>

        <div className="tk-drawer__body">
          {/* Tên việc */}
          <div className="tk-drawer__title-wrap">
            <textarea
              className="tk-drawer__title"
              value={titleDraft}
              rows={2}
              placeholder="Tên việc…"
              onFocus={() => setTitleEditing(true)}
              onChange={(e) => setTitleDraft(e.target.value.replace(/\n/g, ' '))}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.target.blur();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  setTitleDraft(task.title || '');
                  const el = e.target;
                  setTimeout(() => el.blur(), 0);
                }
              }}
            />
            {titleEditing && <span className="tk-drawer__hint">↵ lưu · Esc huỷ</span>}
          </div>

          {/* Lưới thuộc tính */}
          <div className="tk-props">
            <span className="tk-props__label">Trạng thái</span>
            <button type="button" className="tk-props__value" onClick={openPop('status')}>
              <AppIcon name={st.icon} size={16} weight={st.weight} style={{ color: st.color }} />
              {st.label}
            </button>

            <span className="tk-props__label">Hạn</span>
            <button
              type="button"
              className="tk-props__value tk-props__value--mono"
              style={{ color: daysLate ? 'var(--tk-ks-late-fg)' : task.due_date ? 'var(--tk-text-main)' : 'var(--tk-text-mute)' }}
              onClick={openPop('date')}
            >
              <AppIcon name="calendar" size={15} />
              {dueLabel(task, today)}
              {daysLate > 0 && <span className="tk-props__late">trễ {daysLate} ngày</span>}
            </button>

            <span className="tk-props__label">Ưu tiên</span>
            <button type="button" className="tk-props__value" onClick={openPop('priority')}>
              <AppIcon name={pr.icon} size={15} weight={Number(task.priority) === 5 ? 'fill' : 'regular'} style={{ color: pr.color }} />
              {task.priority ? pr.label : 'Không ưu tiên'}
            </button>

            <span className="tk-props__label">Lặp lại</span>
            <button type="button" className="tk-props__value tk-props__value--soft" onClick={openPop('recurrence')}>
              <AppIcon name="repeat" size={15} style={{ color: 'var(--tk-text-mute)' }} />
              {describeRecurrence(task.recurrence_rule)}
            </button>

            <span className="tk-props__label">Thực tế</span>
            <span
              className="tk-props__actual"
              title={task.started_at ? `Bắt đầu ${dmHm(task.started_at)}${task.completed_at ? ` · Hoàn thành ${dmHm(task.completed_at)}` : ''}` : undefined}
            >
              {task.started_at ? (
                <>
                  <span className="tk-props__run">
                    <AppIcon name="play" size={11} style={{ color: 'var(--tk-accent)' }} />
                    {dmHm(task.started_at)}
                    <AppIcon name="arrowRight" size={11} style={{ color: 'var(--tk-text-mute)' }} />
                    <span style={{ color: isDone ? 'var(--tk-text-main)' : 'var(--tk-st-doing)' }}>
                      {isDone && task.completed_at ? dmHm(task.completed_at) : 'đang làm'}
                    </span>
                  </span>
                  <span className="tk-props__chip">
                    <AppIcon name="timer" size={12} />
                    {formatSpent(task.started_at, isDone && task.completed_at ? task.completed_at : new Date().toISOString())}
                  </span>
                </>
              ) : (
                <>
                  <span className="tk-props__muted">Chưa bắt đầu</span>
                  {!isDone && (
                    <button type="button" className="tk-props__chip tk-props__chip--btn" onClick={() => changeStatus('doing')}>
                      <AppIcon name="play" size={11} style={{ color: 'var(--tk-accent)' }} />
                      Bắt đầu
                    </button>
                  )}
                </>
              )}
            </span>

            <span className="tk-props__label">Nhãn</span>
            <div className="tk-props__tags">
              {(task._tags || []).map((t) => (
                <span key={t.id} className="tk-tag">
                  #{t.name}
                  {unlinkTaskTag && (
                    <button type="button" title="Bỏ nhãn" onClick={() => unlinkTaskTag(task.id, t.id)}>
                      <AppIcon name="x" size={10} />
                    </button>
                  )}
                </span>
              ))}
              {tagInput === null ? (
                <button type="button" className="tk-tag-add" onClick={() => setTagInput('')}>
                  <AppIcon name="plus" size={11} />
                  Nhãn
                </button>
              ) : (
                <input
                  autoFocus
                  className="tk-tag-input"
                  value={tagInput}
                  placeholder="tên nhãn"
                  onChange={(e) => setTagInput(e.target.value)}
                  onBlur={handleAddTag}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.target.blur();
                    } else if (e.key === 'Escape') {
                      e.stopPropagation();
                      setTagInput(null);
                    }
                  }}
                />
              )}
            </div>
          </div>

          {/* Mô tả — lưu bằng nút / ⌘↵, đóng ngăn thì tự lưu */}
          <section className="tk-drawer__section">
            <div className="tk-section-head">
              <span className="tk-section-head__label">MÔ TẢ</span>
              {descDirty && (
                <span className="tk-unsaved">
                  <span className="tk-unsaved__dot" />
                  Chưa lưu
                </span>
              )}
              <span className="tk-section-head__aside">
                <AppIcon name="markdown" size={13} />
                Hỗ trợ Markdown
              </span>
            </div>
            <div className={`tk-editor${descEditing ? ' is-active' : ''}`}>
              {descEditing && <MdToolbar tools={MD_DESC_TOOLS} onTool={(k) => runMd(descRef, descDraft, setDescDraft, k)} />}
              <textarea
                ref={descRef}
                className="tk-editor__input"
                value={descDraft}
                placeholder="Bấm để thêm mô tả, ghi chú, link…"
                onFocus={() => setDescEditing(true)}
                onBlur={() => { if (!descDirty) setDescEditing(false); }}
                onChange={(e) => setDescDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    saveDesc();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    setDescDraft(task.description || '');
                    setDescEditing(false);
                    e.target.blur();
                  }
                }}
              />
              {descEditing && (
                <div className="tk-editor__foot">
                  <span className="tk-editor__hint">⌘↵ lưu · Esc huỷ</span>
                  <button
                    type="button"
                    className="tk-btn-ghost"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setDescDraft(task.description || '');
                      setDescEditing(false);
                      descRef.current?.blur();
                    }}
                  >
                    Huỷ
                  </button>
                  <button
                    type="button"
                    className="tk-btn-solid"
                    style={{ opacity: descDirty ? 1 : 0.45 }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      saveDesc();
                    }}
                  >
                    <AppIcon name="check" size={13} />
                    Lưu
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Việc con */}
          <section className="tk-drawer__section tk-drawer__section--tight">
            <div className="tk-section-head">
              <span className="tk-section-head__label">VIỆC CON</span>
              <span className="tk-section-head__count">{doneSubs}/{subtasks.length}</span>
              <span className="tk-progress"><span style={{ width: `${subPct}%` }} /></span>
            </div>
            {subtasks.map((s, i) => {
              const sDone = statusKeyOf(s) === 'done';
              return (
                <div key={s.id} className="tk-sub-row">
                  <button
                    type="button"
                    className="tk-sub-row__check"
                    title={sDone ? 'Bỏ đánh dấu xong' : 'Đánh dấu xong'}
                    onClick={() => (sDone ? uncompleteTask?.(s.id) : completeTask?.(s.id))}
                  >
                    <AppIcon
                      name={sDone ? 'checkSquare' : 'square'}
                      size={17}
                      weight={sDone ? 'fill' : 'regular'}
                      style={{ color: sDone ? 'var(--tk-st-done)' : 'var(--tk-text-mute)' }}
                    />
                  </button>
                  <button type="button" className={`tk-sub-row__title${sDone ? ' is-done' : ''}`} onClick={() => setSubIndex(i)}>
                    {s.title}
                  </button>
                </div>
              );
            })}
            <label className="tk-sub-add">
              <AppIcon name="plus" size={14} style={{ color: 'var(--tk-text-mute)' }} />
              <input
                value={subtaskInput}
                placeholder="Thêm việc con, Enter để thêm"
                onChange={(e) => setSubtaskInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubtask(); }}
              />
            </label>
          </section>

          {/* Hoạt động / Ghi chú */}
          <section className="tk-drawer__section">
            <div className="tk-seg">
              <button type="button" className={`tk-seg__btn${footerTab === 'activity' ? ' is-on' : ''}`} onClick={() => setFooterTab('activity')}>
                <AppIcon name="history" size={14} />
                Hoạt động · {activityLogs.length}
              </button>
              <button type="button" className={`tk-seg__btn${footerTab === 'notes' ? ' is-on' : ''}`} onClick={() => setFooterTab('notes')}>
                <AppIcon name="notePencil" size={14} />
                Ghi chú · {notes.length}
              </button>
            </div>

            {footerTab === 'activity' ? (
              <div className="tk-activity">
                {activityGroups.length === 0 && <div className="tk-empty-note">Chưa có hoạt động nào được ghi lại.</div>}
                {activityGroups.map((g) => (
                  <div key={g.day} className="tk-activity__group">
                    <span className="tk-activity__day">{g.day}</span>
                    {g.items.map((lg) => {
                      const d = describeActivity(lg);
                      return (
                        <div key={lg.id} className="tk-activity__item">
                          <span className="tk-activity__line" />
                          <span className="tk-activity__icon" style={{ color: actColor(lg) }}>
                            <AppIcon name={d.icon} size={13} />
                          </span>
                          <div className="tk-activity__text">
                            <span className="tk-activity__title">{d.text}</span>
                            {d.oldText && (
                              <span className="tk-activity__from">
                                <s>{d.oldText}</s>
                                <AppIcon name="arrowRight" size={11} />
                              </span>
                            )}
                            {d.newText && <span className="tk-activity__to">{d.newText}</span>}
                          </div>
                          <span className="tk-activity__at">{lg.created_at ? hhmm(lg.created_at) : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="tk-notes">
                <div className={`tk-editor${noteFocus || noteDraft ? ' is-active' : ''}`}>
                  {(noteFocus || noteDraft) && <MdToolbar tools={MD_NOTE_TOOLS} onTool={(k) => runMd(noteRef, noteDraft, setNoteDraft, k)} />}
                  <textarea
                    ref={noteRef}
                    rows={2}
                    className="tk-editor__input tk-editor__input--note"
                    value={noteDraft}
                    placeholder="Viết ghi chú…"
                    onFocus={() => setNoteFocus(true)}
                    onBlur={() => setNoteFocus(false)}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleAddNote();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        setNoteDraft('');
                        e.target.blur();
                      }
                    }}
                  />
                  <div className="tk-editor__foot">
                    <span className="tk-editor__hint">⌘↵ lưu</span>
                    {noteDraft.trim() && (
                      <button type="button" className="tk-btn-ghost" onMouseDown={(e) => { e.preventDefault(); setNoteDraft(''); }}>
                        Huỷ
                      </button>
                    )}
                    <button
                      type="button"
                      className="tk-btn-solid"
                      style={{ opacity: noteDraft.trim() ? 1 : 0.45, marginLeft: noteDraft.trim() ? 0 : 'auto' }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleAddNote();
                      }}
                    >
                      Lưu ghi chú
                    </button>
                  </div>
                </div>

                {notes.length === 0 && (
                  <div className="tk-empty-note">Chưa có ghi chú. Ghi lại tiến độ, link hoặc ý tưởng cho việc này.</div>
                )}
                {notes.map((n) => (
                  <div key={n.id} className="tk-note">
                    <span className="tk-note__avatar">{initial}</span>
                    <div className="tk-note__body">
                      <div className="tk-note__meta">
                        <span className="tk-note__who">Bạn</span>
                        <span className="tk-note__at">{n.created_at ? `${dayLabel(n.created_at)}, ${hhmm(n.created_at)}` : ''}</span>
                        <button
                          type="button"
                          className="tk-drawer__icon-btn tk-drawer__icon-btn--sm"
                          title="Xoá ghi chú"
                          onClick={async () => {
                            await deleteLog?.(n.id);
                            reloadLogs();
                          }}
                        >
                          <AppIcon name="trash" size={13} />
                        </button>
                      </div>
                      {/* Nội dung ghi chú nằm ở cột `note` (ACTIONS.NOTE) */}
                      <div className="tk-note__text">{n.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="tk-drawer__foot">
          <span className="tk-drawer__meta">{meta}</span>
          <button type="button" className="tk-btn-ghost tk-btn-ghost--icon" onClick={handleDelete}>
            <AppIcon name="trash" size={15} />
            Xoá
          </button>
        </div>
      </aside>

      {subIndex !== null && subtasks[subIndex] && (
        <TaskSubtaskModal
          parent={task}
          subtasks={subtasks}
          index={subIndex}
          onIndex={setSubIndex}
          onClose={() => setSubIndex(null)}
          onOpenParent={() => setSubIndex(null)}
          taskModel={taskModel}
          onDeleted={(id) => setFetchedSubs((prev) => prev.filter((s) => s.id !== id))}
        />
      )}
    </>
  );
}
