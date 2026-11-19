import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from '../AppIcon';
import { useUserTasks } from '../../hooks/useUserTasks';
import { addPrepItem, prepProgress, prepDueDate } from '../../utils/tripLogic';
import { shortDay } from '../../utils/placeLogic';

/**
 * "Chuẩn bị" của chuyến (mockup 2E). Một nguồn sự thật mỗi lúc (docs/PLAN_CHON.md §3.2):
 *  - chưa đẩy: danh sách nằm ở trips.prep_items, tích / thêm / xoá ngay tại đây;
 *  - "Đẩy sang Nhiệm vụ": tạo việc cha "Chuẩn bị <chuyến>" (hạn = trước ngày đi một ngày) + việc con cho mục chưa
 *    xong, lưu prep_task_id, xoá prep_items. Sau đó chỉ hiện tiến độ đọc từ Nhiệm vụ; tích ở bên đó.
 * useUserTasks chỉ mount trong khối này (trang chuyến), không ở danh sách Chốn.
 *
 * @param {(patch, extra?) => Promise<{data?, error?}>} onUpdateTrip
 */
export default function ChonTripPrep({ trip, today, onUpdateTrip, onToast }) {
  const navigate = useNavigate();
  const { addTask, addSubtasks, getSubtasks } = useUserTasks();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [subtasks, setSubtasks] = useState(null);
  const pushedId = trip.prep_task_id;

  useEffect(() => {
    let alive = true;
    if (pushedId) getSubtasks(pushedId).then(list => { if (alive) setSubtasks(list || []); });
    return () => { alive = false; };
  }, [pushedId, getSubtasks]);

  const items = Array.isArray(trip.prep_items) ? trip.prep_items : [];
  const save = (next) => onUpdateTrip({ prep_items: next }).then(r => { if (r?.error) onToast(r.error); });

  const add = () => {
    const next = addPrepItem(items, draft);
    setDraft('');
    if (next !== items) save(next);
  };

  const push = async () => {
    const todo = items.filter(i => !i.done).map(i => i.text);
    if (!todo.length || busy) return;
    setBusy(true);
    const title = `Chuẩn bị ${trip.title}`;
    const due = prepDueDate(trip, today);
    const parent = await addTask({ title, dueDate: due });
    if (!parent?.id) { setBusy(false); onToast('Chưa tạo được việc bên Nhiệm vụ. Thử lại.'); return; }
    const created = await addSubtasks({ id: parent.id, due_date: due }, todo);
    const ok = new Set(created.map(t => t.title));
    const left = items.filter(i => !i.done && !ok.has(i.text));   // mục tạo hỏng giữ lại để đẩy lần nữa
    const r = await onUpdateTrip(
      { prep_task_id: parent.id, prep_items: left },
      { prep_task: { id: parent.id, title, due_date: due, completed: false } },
    );
    setBusy(false);
    if (r?.error) { onToast(r.error); return; }
    setSubtasks(created);
    onToast(left.length
      ? `Đã đẩy ${created.length}/${todo.length} mục sang Nhiệm vụ — còn ${left.length} mục chưa tạo được.`
      : `Đã thêm “${title}” với ${created.length} việc con vào Nhiệm vụ`);
  };

  const local = prepProgress(items);
  const pushedDone = subtasks ? subtasks.filter(t => t.completed).length : 0;

  return (
    <section className="chon-trip-box" aria-labelledby="chon-prep-h">
      <div className="chon-sec-head">
        <h2 id="chon-prep-h" className="chon-h2">Chuẩn bị</h2>
        <span className="chon-faint">
          {pushedId ? (subtasks ? `${pushedDone}/${subtasks.length} xong` : '…') : local.total ? `${local.done}/${local.total} xong` : ''}
        </span>
      </div>

      {pushedId && (
        <div className="chon-prep-pushed">
          <p className="chon-prep-pushed__title">
            <AppIcon name="checkSquare" size={16} />
            {trip.prep_task?.title || 'Việc chuẩn bị'}
            {trip.prep_task?.due_date && <span className="chon-faint"> · hạn {shortDay(trip.prep_task.due_date)}</span>}
          </p>
          {subtasks && subtasks.length > 0 && (
            <ul className="chon-checklist chon-checklist--readonly">
              {subtasks.map(t => (
                <li key={t.id} className={t.completed ? 'is-done' : ''}>
                  <AppIcon name={t.completed ? 'checkCircle' : 'circle'} size={16} weight={t.completed ? 'fill' : 'regular'} />{t.title}
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="chon-btn chon-btn--ghost chon-btn--sm" onClick={() => navigate('/tasks', { state: { openTaskId: pushedId } })}>
            <AppIcon name="external" size={14} />Mở ở Nhiệm vụ
          </button>
        </div>
      )}

      {(!pushedId || items.length > 0) && (
        <>
          {items.length > 0 && (
            <ul className="chon-checklist">
              {items.map(it => (
                <li key={it.id} className={it.done ? 'is-done' : ''}>
                  <label>
                    <input type="checkbox" checked={!!it.done}
                      onChange={() => save(items.map(x => (x.id === it.id ? { ...x, done: !x.done } : x)))} />
                    <span>{it.text}</span>
                  </label>
                  <button type="button" className="chon-icon-btn chon-icon-btn--sm" aria-label={`Bỏ “${it.text}”`}
                    onClick={() => save(items.filter(x => x.id !== it.id))}>
                    <AppIcon name="x" size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="chon-input-icon">
            <AppIcon name="plus" size={15} />
            <input className="chon-input chon-input--bare" value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
              placeholder="Vé máy bay, áo ấm, bằng lái… Enter" aria-label="Thêm mục chuẩn bị" maxLength={120} />
          </label>
          <button type="button" className="chon-btn chon-btn--soft chon-btn--sm chon-self-start" onClick={push}
            disabled={busy || !items.some(i => !i.done)}>
            <AppIcon name="pushPin" size={14} />{busy ? 'Đang đẩy…' : 'Đẩy sang Nhiệm vụ'}
          </button>
        </>
      )}
    </section>
  );
}
