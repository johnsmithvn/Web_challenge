import { useState } from 'react';
import ActionMenu from './ActionMenu';
import AppIcon from './AppIcon';
import { useConfirm } from './ConfirmModal';
import { useToast } from '../contexts/ToastContext';
import { STATUS_META, nextMondayStr, statusKeyOf } from '../utils/kanbanUtils';
import { PRIORITY_LABELS, shiftDateDays } from '../utils/taskNlpParser';
import { toDateStr } from '../utils/dateUtils';
import UI_STRINGS from '../data/ui-strings.json';

/**
 * TaskActionMenu — menu ⋯ / chuột phải của một việc (Kanban, Danh sách, tab Ngày) hoặc việc con (ngăn chi tiết, khối
 * giờ tab Ngày), vẽ bằng ActionMenu.
 * Luôn mount trong view để hộp xác nhận Xoá còn sống sau khi menu đóng; `menu` = { task, x, y } khi đang mở.
 * View cấp phần nó giữ state: onStatus(task, key) (luật đổi trạng thái riêng mỗi view), onPickDate(task, x, y)
 * (mở lịch đổi hạn tại chỗ menu), onAddSub(task) (tuỳ chọn: mở bảng việc con + focus ô thêm; không truyền = ẩn mục),
 * onDeleted(id) (tuỳ chọn: view giữ bản fetch riêng). Còn lại gọi thẳng taskModel. Việc con (có parent_task_id): không
 * có "Thêm việc con" (chỉ 1 cấp), Nhân bản ra việc con cùng cha.
 */
export default function TaskActionMenu({ menu, onClose, taskModel, onStatus, onPickDate, onAddSub, onDeleted }) {
  const { confirm, ConfirmModal } = useConfirm();
  const { showToast } = useToast();
  return (
    <>
      {menu && (
        <MenuBody
          key={`${menu.task.id}:${menu.x}:${menu.y}`}
          menu={menu}
          onClose={onClose}
          taskModel={taskModel}
          onStatus={onStatus}
          onPickDate={onPickDate}
          onAddSub={onAddSub}
          onDeleted={onDeleted}
          confirm={confirm}
          showToast={showToast}
        />
      )}
      {ConfirmModal}
    </>
  );
}

function MenuBody({ menu, onClose, taskModel, onStatus, onPickDate, onAddSub, onDeleted, confirm, showToast }) {
  const [step, setStep] = useState('main'); // main | status | priority | move
  const { task } = menu;
  const { updateTask, addTask, deleteTask, linkTaskTag } = taskModel;
  const cur = statusKeyOf(task);
  const done = cur === 'done';
  const canAddSub = !!onAddSub && !task.parent_task_id;
  const today = toDateStr();
  const back = (label) => ({ key: 'back', icon: 'caretLeft', label, keepOpen: true, onSelect: () => setStep('main') });

  const duplicate = async () => {
    const copy = await addTask({
      title: `${task.title} (bản sao)`,
      description: task.description,
      dueDate: task.due_date,
      dueTime: task.due_time,
      startDate: task.start_date,
      startTime: task.start_time,
      priority: task.priority,
      recurrenceRule: task.recurrence_rule,
      parentTaskId: task.parent_task_id,
    });
    if (!copy?.id) {
      showToast('Không nhân bản được. Thử lại.');
      return;
    }
    await Promise.all((task._tags || []).map((tag) => linkTaskTag?.(copy.id, tag)));
    showToast(`Đã nhân bản "${task.title}"`);
  };

  const copyTitle = async () => {
    try {
      await navigator.clipboard.writeText(task.title);
      showToast('Đã chép tên việc');
    } catch {
      showToast('Không chép được. Thử lại.');
    }
  };

  const remove = async () => {
    const cfg = UI_STRINGS.confirm.deleteTask;
    if (!(await confirm({ ...cfg, message: cfg.message.replace('{name}', task.title) }))) return;
    await deleteTask(task.id);
    onDeleted?.(task.id);
  };

  let items;
  if (step === 'status') {
    items = [
      back('Trạng thái'),
      ...Object.entries(STATUS_META).map(([key, s], i) => ({
        key,
        divider: i === 0,
        icon: <AppIcon name={s.icon} size={16} weight={s.weight} style={{ color: s.color }} />,
        label: s.label,
        checked: cur === key,
        onSelect: () => onStatus(task, key),
      })),
    ];
  } else if (step === 'priority') {
    items = [
      back('Ưu tiên'),
      ...[5, 4, 3, 2, 1, 0].map((lvl, i) => {
        const p = PRIORITY_LABELS[lvl];
        return {
          key: String(lvl),
          divider: i === 0,
          icon: <AppIcon name={p.icon} size={16} weight={lvl === 5 ? 'fill' : 'regular'} style={{ color: p.color }} />,
          label: p.label,
          checked: (Number(task.priority) || 0) === lvl,
          onSelect: () => updateTask(task.id, { priority: lvl }),
        };
      }),
    ];
  } else if (step === 'move') {
    items = [
      back('Dời hạn'),
      ...[
        { key: 'today', label: 'Hôm nay', date: today },
        { key: 'tomorrow', label: 'Ngày mai', date: shiftDateDays(1, today) },
        { key: 'monday', label: 'Thứ Hai tuần sau', date: nextMondayStr(today) },
      ].map((d, i) => ({
        key: d.key,
        divider: i === 0,
        label: d.label,
        checked: task.due_date === d.date,
        onSelect: () => updateTask(task.id, { due_date: d.date }),
      })),
    ];
  } else {
    items = [
      { key: 'status', icon: 'circleHalf', label: 'Trạng thái', sub: true, onSelect: () => setStep('status') },
      { key: 'priority', icon: 'signalMedium', label: 'Ưu tiên', sub: true, onSelect: () => setStep('priority') },
      ...(done ? [] : [
        { key: 'date', icon: 'calendar', label: 'Đổi hạn…', onSelect: () => onPickDate(task, menu.x, menu.y) },
        { key: 'move', icon: 'arrowRight', label: 'Dời hạn', sub: true, onSelect: () => setStep('move') },
      ]),
      ...(canAddSub ? [
        { key: 'sub', icon: 'listChecks', label: 'Thêm việc con', divider: true, onSelect: () => onAddSub(task) },
      ] : []),
      { key: 'dup', icon: 'copy', label: 'Nhân bản', divider: !canAddSub, onSelect: duplicate },
      { key: 'title', icon: 'clipboard', label: 'Chép tên việc', onSelect: copyTitle },
      { key: 'delete', icon: 'trash', label: 'Xoá', danger: true, divider: true, onSelect: remove },
    ];
  }

  return <ActionMenu key={step} at={menu} items={items} onClose={onClose} label={`Thao tác với ${task.title}`} />;
}
