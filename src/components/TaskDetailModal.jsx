/**
 * TaskDetailModal — xem chi tiết 1 nhiệm vụ + lịch sử thay đổi + ghi chú cá nhân.
 *
 * CHỈ ĐỌC phần field. Sửa/Xoá/Hoàn thành đều uỷ quyền ngược về handler sẵn có
 * của TaskListSection — cố ý, để chỉ có MỘT đường ghi xuống user_tasks. Nếu
 * modal này cũng sửa field thì sẽ có 2 code path ghi cùng 1 task, và diff-log
 * của activity_logs v2 mất chokepoint duy nhất.
 *
 * Hai tab dùng chung 1 lần fetch `getTaskLogs(taskId)`:
 *   - Hoạt động: mọi dòng `action !== 'note'`, mới nhất trước, nhóm theo ngày.
 *   - Ghi chú:   dòng `action === 'note'`, ô nhập đặt TRÊN CÙNG (vào tab này
 *                chủ yếu để ghi, và trên mobile bàn phím ảo không che mất ô).
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import GenericModal from './GenericModal';
import AppIcon from './AppIcon';
import { useConfirm } from './ConfirmModal';
import { useActivityLog } from '../hooks/useActivityLog';
import { useAuth } from '../contexts/AuthContext';
import { toDateStr, formatDate, formatDateTime } from '../utils/dateUtils';
import {
  ACTIONS,
  PRIORITY_OPTIONS,
  describeActivity,
  describeRecurrence,
  previewValue,
} from '../utils/taskFields';
import '../styles/task-detail.css';

/** Nhãn ngày cho header nhóm trong feed. */
function dayLabel(dateStr) {
  const today = toDateStr();
  if (dateStr === today) return 'Hôm nay';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (dateStr === toDateStr(y)) return 'Hôm qua';
  return formatDate(`${dateStr}T00:00:00`);
}

const hhmm = (iso) =>
  new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/** Một giá trị cũ/mới trong feed — dài thì cắt, bấm để bung full. */
function LogValue({ value, variant, expanded, onToggle }) {
  const { text, truncated } = previewValue(value);
  return (
    <>
      <span className={`td-val td-val--${variant}`}>{expanded ? value : text}</span>
      {truncated && (
        <button type="button" className="td-more" onClick={onToggle}>
          {expanded ? 'Thu gọn' : 'Xem thêm'}
        </button>
      )}
    </>
  );
}

export default function TaskDetailModal({ task, onClose, onEdit, onComplete, onDelete }) {
  const { user } = useAuth();
  const { confirm, ConfirmModal } = useConfirm();
  const { getTaskLogs, addNote, updateNote, deleteLog } = useActivityLog();

  const [tab, setTab] = useState('activity');
  const [rows, setRows] = useState([]);
  // Modal mount lại mỗi lần mở (render có điều kiện ở TaskListSection) nên khởi
  // tạo đúng ngay từ đầu — không cần setState đồng bộ trong effect.
  const [loading, setLoading] = useState(Boolean(task?.id && user));
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editDraft, setEditDraft] = useState('');

  const taskId = task?.id;

  // ── Tải log 1 lần cho cả 2 tab ────────────────────────────────────────
  useEffect(() => {
    if (!taskId || !user) return;
    let stale = false;
    getTaskLogs(taskId).then(data => {
      if (stale) return;
      setRows(data);
      setLoading(false);
    });
    return () => { stale = true; };
  }, [taskId, user, getTaskLogs]);

  // ── Escape để đóng (GenericModal không có sẵn) ────────────────────────
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const activityRows = useMemo(() => rows.filter(r => r.action !== ACTIONS.NOTE), [rows]);
  // Ghi chú đọc xuôi theo thời gian — nó là mạch chuyện, khác Hoạt động.
  const noteRows = useMemo(
    () => rows.filter(r => r.action === ACTIONS.NOTE).slice().reverse(),
    [rows]
  );

  /** Gom feed hoạt động theo ngày ĐỊA PHƯƠNG (cùng quy ước với heatmap). */
  const grouped = useMemo(() => {
    const out = [];
    for (const row of activityRows) {
      const key = toDateStr(new Date(row.created_at));
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(row);
      else out.push({ key, items: [row] });
    }
    return out;
  }, [activityRows]);

  const handleAddNote = useCallback(async () => {
    if (!draft.trim() || saving) return;
    setSaving(true);
    const created = await addNote(taskId, draft);
    setSaving(false);
    if (created) {
      setRows(prev => [created, ...prev]);
      setDraft('');
    }
  }, [draft, saving, addNote, taskId]);

  const handleSaveEdit = useCallback(async (logId) => {
    if (!editDraft.trim()) return;
    const ok = await updateNote(logId, editDraft);
    if (ok) {
      setRows(prev => prev.map(r => (r.id === logId ? { ...r, note: editDraft.trim() } : r)));
      setEditingNoteId(null);
    }
  }, [editDraft, updateNote]);

  const handleDeleteRow = useCallback(async (row) => {
    const isNote = row.action === ACTIONS.NOTE;
    const ok = await confirm({
      title: isNote ? 'Xoá ghi chú?' : 'Xoá dòng lịch sử?',
      message: isNote
        ? 'Ghi chú này sẽ bị xoá vĩnh viễn.'
        : 'Dòng này sẽ biến mất khỏi lịch sử thay đổi của nhiệm vụ.',
      confirmLabel: 'Xoá',
      danger: true,
    });
    if (!ok) return;
    const done = await deleteLog(row.id);
    if (done) setRows(prev => prev.filter(r => r.id !== row.id));
  }, [confirm, deleteLog]);

  if (!task) return null;

  const pri = PRIORITY_OPTIONS.find(p => p.value === (task.priority || 0));
  const overdue = !task.completed && task.due_date && task.due_date < toDateStr();
  const hasTime =
    task.due_time &&
    task.due_time.substring(0, 5) !== '00:00' &&
    task.due_time.substring(0, 5) !== '23:59';

  /** Chỉ render hàng khi field thật sự có mặt — task mở từ Lịch chỉ có 5 cột,
   *  hiện "—" ở những hàng thiếu là nói sai sự thật. */
  const row = (label, value) =>
    value === undefined ? null : (
      <>
        <div className="td-grid__label">{label}</div>
        <div className="td-grid__value">{value}</div>
      </>
    );

  return (
    <>
      <GenericModal title={<><AppIcon name="file" size={17} /> Chi tiết nhiệm vụ</>} maxWidth={620} className="task-detail-modal" onClose={onClose}>
        <GenericModal.Body>
          {/* ── Đầu: tick + tiêu đề, dải màu priority như trên card ── */}
          <div
            className="td-head"
            style={pri && task.priority > 0 ? { borderLeft: `3px solid ${pri.color}`, paddingLeft: '0.6rem' } : undefined}
          >
            {!task.completed && (
              <button
                className="task-checkbox-btn"
                style={{ border: `2px solid ${overdue ? 'rgba(239,68,68,0.4)' : 'rgba(139,92,246,0.4)'}` }}
                title="Hoàn thành"
                aria-label={`Hoàn thành: ${task.title}`}
                onClick={() => { onComplete(task.id); onClose(); }}
              />
            )}
            <h3 className={`td-title ${task.completed ? 'td-title--done' : ''}`}>{task.title}</h3>
          </div>

          {/* ── Lưới field (chỉ đọc) ── */}
          <div className="td-grid">
            {row('Hạn chót', task.due_date && (
              <>
                <AppIcon name="calendar" size={14} /> {formatDate(`${task.due_date}T00:00:00`)}
                {hasTime && <> · <AppIcon name="clock" size={14} /> {task.due_time.substring(0, 5)}</>}
                {overdue && <span className="td-pill td-pill--overdue">Quá hạn</span>}
              </>
            ))}
            {row('Độ ưu tiên', pri && (
              task.priority > 0
                ? <span className="td-pill" style={{ background: `${pri.color}1f`, color: pri.color }}><AppIcon name={pri.icon} size={13} /> {pri.label}</span>
                : <span className="td-muted">Không</span>
            ))}
            {row('Lặp lại', task.recurrence_rule !== undefined && (
              task.recurrence_rule
                ? <><AppIcon name="refresh" size={14} /> {describeRecurrence(task.recurrence_rule)}</>
                : <span className="td-muted">Không lặp</span>
            ))}
            {row('Tag', task._tags !== undefined && (
              task._tags.length
                ? task._tags.map(t => (
                    <span key={t.id} className="td-pill" style={{ background: `${t.color}1f`, color: t.color }}><AppIcon name="tag" size={13} /> {t.name}</span>
                  ))
                : <span className="td-muted">Chưa gắn tag</span>
            ))}
            {row('Bài viết', task._collections !== undefined && (
              task._collections.length
                ? <><AppIcon name="link" size={14} /> {task._collections.length} bài viết</>
                : <span className="td-muted">Chưa liên kết</span>
            ))}
            {task.completed && task.completed_at
              ? row('Hoàn thành lúc', <><AppIcon name="checkCircle" size={14} /> {formatDateTime(task.completed_at)}</>)
              : null}
            {row('Tạo lúc', task.created_at && formatDateTime(task.created_at))}
            {/* Cột updated_at đến từ migration v5.0.0; task cũ trong state chưa
                có thì hàng này tự ẩn thay vì hiện rỗng. */}
            {task.updated_at ? row('Cập nhật lúc', formatDateTime(task.updated_at)) : null}
          </div>

          {task.description
            ? <div className="task-desc-box">{task.description}</div>
            : <div className="task-desc-box td-muted td-desc--empty">Chưa có mô tả</div>}

          {/* ── Tab ── */}
          <div className="tasks-viewbar td-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={tab === 'activity'}
              className={`tasks-viewbar__tab ${tab === 'activity' ? 'tasks-viewbar__tab--active' : ''}`}
              onClick={() => setTab('activity')}
            >
              <AppIcon name="clock" size={14} /> Hoạt động · {activityRows.length}
            </button>
            <button
              role="tab"
              aria-selected={tab === 'note'}
              className={`tasks-viewbar__tab ${tab === 'note' ? 'tasks-viewbar__tab--active' : ''}`}
              onClick={() => setTab('note')}
            >
              <AppIcon name="note" size={14} /> Ghi chú · {noteRows.length}
            </button>
          </div>

          <div className="td-panel">
            {!user && <div className="td-loading">Đăng nhập để xem lịch sử và ghi chú.</div>}
            {user && loading && <div className="td-loading"><AppIcon name="clock" size={14} /> Đang tải...</div>}

            {/* ── Tab Hoạt động ── */}
            {user && !loading && tab === 'activity' && (
              activityRows.length === 0 ? (
                <div className="task-empty td-empty">
                  <div className="task-empty__icon td-empty__icon"><AppIcon name="clock" size={28} weight="duotone" /></div>
                  <div className="task-empty__title">Chưa có thay đổi nào</div>
                  <div className="task-empty__hint">Mọi lần sửa nhiệm vụ này sẽ được ghi lại ở đây.</div>
                </div>
              ) : (
                grouped.map(group => (
                  <div key={group.key}>
                    <div className="td-day">{dayLabel(group.key)}</div>
                    {group.items.map(item => {
                      const d = describeActivity(item);
                      const expanded = expandedLogId === item.id;
                      return (
                        <div key={item.id} className="td-row">
                          <span className="td-icon"><AppIcon name={d.icon} size={15} /></span>
                          <div className="td-body">
                            <div className="td-line">{d.text}</div>
                            {(d.oldText || d.newText) && (
                              <div className="td-vals">
                                {d.oldText && (
                                  <LogValue
                                    value={d.oldText} variant="old" expanded={expanded}
                                    onToggle={() => setExpandedLogId(expanded ? null : item.id)}
                                  />
                                )}
                                {d.oldText && d.newText && <span className="td-arrow">→</span>}
                                {d.newText && (
                                  <LogValue
                                    value={d.newText} variant="new" expanded={expanded}
                                    onToggle={() => setExpandedLogId(expanded ? null : item.id)}
                                  />
                                )}
                              </div>
                            )}
                            <div className="td-time">{hhmm(item.created_at)}</div>
                          </div>
                          <button className="td-del" title="Xoá dòng này" onClick={() => handleDeleteRow(item)}><AppIcon name="trash" size={14} /></button>
                        </div>
                      );
                    })}
                  </div>
                ))
              )
            )}

            {/* ── Tab Ghi chú ── */}
            {user && !loading && tab === 'note' && (
              <>
                <div className="td-composer">
                  <textarea
                    className="td-textarea"
                    rows={2}
                    placeholder="Ghi chú cho nhiệm vụ này… (Ctrl+Enter để lưu)"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                      // Escape ở đây phải dừng lại, không được nổi lên đóng cả modal
                      if (e.key === 'Escape') { e.stopPropagation(); e.currentTarget.blur(); }
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddNote();
                    }}
                  />
                  <div className="td-composer__actions">
                    <button className="btn btn-ghost td-btn-add" disabled={!draft.trim() || saving} onClick={handleAddNote}>
                      <AppIcon name="plus" size={14} /> Thêm ghi chú
                    </button>
                  </div>
                </div>

                {noteRows.length === 0 ? (
                  <div className="task-empty td-empty">
                    <div className="task-empty__icon td-empty__icon td-empty__icon--note"><AppIcon name="note" size={28} weight="duotone" /></div>
                    <div className="task-empty__title">Chưa có ghi chú nào</div>
                    <div className="task-empty__hint">Ghi lại tiến độ thật của nhiệm vụ — ví dụ “đã xong nhưng chưa đúng tiến độ”.</div>
                  </div>
                ) : (
                  noteRows.map(item => (
                    <div key={item.id} className="td-note">
                      {editingNoteId === item.id ? (
                        <>
                          <textarea
                            className="td-textarea"
                            rows={3}
                            value={editDraft}
                            onChange={e => setEditDraft(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Escape') { e.stopPropagation(); setEditingNoteId(null); }
                              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveEdit(item.id);
                            }}
                          />
                          <div className="td-composer__actions">
                            <button className="btn btn-ghost td-btn-add" onClick={() => setEditingNoteId(null)}>Huỷ</button>
                            <button className="btn btn-ghost td-btn-add" disabled={!editDraft.trim()} onClick={() => handleSaveEdit(item.id)}><AppIcon name="save" size={14} /> Lưu</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="td-note__content">{item.note}</div>
                          <div className="td-note__foot">
                            <span className="td-time">{formatDateTime(item.created_at)}</span>
                            <span className="td-note__actions">
                              <button
                                className="td-del" title="Sửa ghi chú"
                                onClick={() => { setEditingNoteId(item.id); setEditDraft(item.note || ''); }}
                              ><AppIcon name="pencil" size={14} /></button>
                              <button className="td-del" title="Xoá ghi chú" onClick={() => handleDeleteRow(item)}><AppIcon name="trash" size={14} /></button>
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </GenericModal.Body>

        <GenericModal.Footer>
          <button className="btn btn-ghost td-btn td-btn--danger" onClick={() => { onClose(); onDelete(task); }}>
            <AppIcon name="trash" size={15} /> Xoá nhiệm vụ
          </button>
          <button className="btn btn-ghost td-btn" onClick={() => { onClose(); onEdit(task); }}>
            <AppIcon name="pencil" size={15} /> Sửa
          </button>
        </GenericModal.Footer>
      </GenericModal>
      {ConfirmModal}
    </>
  );
}
