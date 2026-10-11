import { useState } from 'react';
import AppIcon from './AppIcon';
import { STATUS_META, ksStyle, statusKeyOf, taskCardModel } from '../utils/kanbanUtils';
import { PRIORITY_LABELS } from '../utils/taskNlpParser';

/*
 * TaskCard — thẻ việc dùng chung theo mockup "Nhiệm vụ · Kanban tối & sáng".
 *   variant="card"   : thẻ Kanban desktop (nhãn ngày + ưu tiên ở đầu, tên, mô tả, meta)
 *   variant="row"    : dòng Danh sách desktop (một hàng, chip dồn bên phải)
 *   variant="mobile" : thẻ mobile (vùng chạm trạng thái 40px, tên 2 dòng, hàng chip)
 * Màu theo tình trạng thời gian lấy từ token --tk-ks-<k>-* (xem tasks-aurora.css).
 */

const SUB_LIMIT = 10;

function SubtaskPanel({ variant, subtasks, onToggleSub, onOpenSub, onAddSub, onOpenMore }) {
  const [val, setVal] = useState('');
  const shown = subtasks.slice(0, SUB_LIMIT);
  return (
    <div className={`tk-subs tk-subs--${variant}`} onClick={(e) => e.stopPropagation()}>
      {shown.map((s) => {
        const done = statusKeyOf(s) === 'done';
        return (
          <div key={s.id} className="tk-subs__row">
            <button type="button" className="tk-subs__check" title={done ? 'Bỏ đánh dấu xong' : 'Đánh dấu xong'} onClick={() => onToggleSub?.(s)}>
              <AppIcon
                name={done ? 'checkSquare' : 'square'}
                size={variant === 'mobile' ? 18 : 15}
                weight={done ? 'fill' : 'regular'}
                style={{ color: done ? 'var(--tk-st-done)' : 'var(--tk-text-mute)' }}
              />
            </button>
            <button type="button" className={`tk-subs__title${done ? ' is-done' : ''}`} title="Mở việc con" onClick={() => onOpenSub?.(s)}>
              {s.title}
            </button>
          </div>
        );
      })}
      {subtasks.length > SUB_LIMIT && (
        <button type="button" className="tk-subs__more" onClick={onOpenMore}>
          <AppIcon name="dots" size={14} />
          Xem thêm {subtasks.length - SUB_LIMIT} việc con
        </button>
      )}
      <label className="tk-subs__add">
        <span className="tk-subs__add-icon"><AppIcon name="plus" size={13} /></span>
        <input
          value={val}
          placeholder={variant === 'mobile' ? 'Thêm việc con' : 'Thêm việc con, Enter'}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter' && val.trim()) {
              onAddSub?.(val.trim());
              setVal('');
            }
          }}
        />
      </label>
    </div>
  );
}

export default function TaskCard({
  task,
  today,
  variant = 'card',
  selected = false,
  showDesc = true,
  subtasks = [],
  expanded = false,
  onToggleExpand,
  onOpen,
  onStatus,
  onDate,
  onPriority,
  onToggleSub,
  onOpenSub,
  onAddSub,
  dragProps,
}) {
  const m = taskCardModel(task, today);
  const st = STATUS_META[m.st];
  const pr = PRIORITY_LABELS[m.priority] || PRIORITY_LABELS[0];
  const subDone = subtasks.filter((s) => statusKeyOf(s) === 'done').length;
  const subPct = subtasks.length ? Math.round((subDone / subtasks.length) * 100) : 0;
  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn?.(e);
  };

  const style = ksStyle(m.k);

  const statusBtn = (
    <button type="button" className="tk-st-btn" title="Đổi trạng thái" onClick={stop(onStatus)} style={{ color: st.color }}>
      <AppIcon name={st.icon} size={variant === 'mobile' ? 20 : 17} weight={st.weight} />
    </button>
  );

  const badge = (short = false) => (
    <button
      type="button"
      className={`tk-due-badge${m.badge.dashed ? ' is-dashed' : ''}`}
      onClick={m.done ? (e) => e.stopPropagation() : stop(onDate)}
      title={m.done ? undefined : 'Đổi hạn'}
    >
      <AppIcon name={m.badge.icon} size={12} />
      {short ? m.badge.short : m.badge.text}
    </button>
  );

  const prChip = m.hasPriority && (
    <button type="button" className="tk-pr-chip" style={{ color: pr.color }} onClick={stop(onPriority)} title="Đổi ưu tiên">
      <AppIcon name={pr.icon} size={12.5} weight={m.priority === 5 ? 'fill' : 'regular'} />
      {pr.label}
    </button>
  );

  const subsBtn = subtasks.length > 0 && (
    <button type="button" className="tk-subs-btn" onClick={stop(onToggleExpand)} title="Xem việc con">
      <AppIcon name="listChecks" size={13} />
      {subDone}/{subtasks.length}
      {variant !== 'mobile' && <span className="tk-subs-btn__bar"><span style={{ width: `${subPct}%` }} /></span>}
      <AppIcon name={expanded ? 'caretUp' : 'caretDown'} size={variant === 'mobile' ? 10 : 11} />
    </button>
  );

  const runChip = m.run && (
    <span className="tk-run" title={task.started_at ? `Bắt đầu ${new Date(task.started_at).toLocaleString('vi-VN')}` : undefined}>
      <AppIcon name={m.run.icon} size={11.5} />
      {m.run.text}
    </span>
  );

  const tags = m.tags.map((t) => <span key={t} className="tk-tag-text">#{t}</span>);

  const subsPanel = expanded && (
    <SubtaskPanel
      variant={variant}
      subtasks={subtasks}
      onToggleSub={onToggleSub}
      onOpenSub={onOpenSub}
      onAddSub={onAddSub}
      onOpenMore={stop(onOpen)}
    />
  );

  if (variant === 'row') {
    return (
      <div className="tk-row-wrap">
        <div className={`tk-row${selected ? ' is-selected' : ''}`} style={style} onClick={() => onOpen?.(task)} {...dragProps}>
          <span className="tk-k-bar" />
          {statusBtn}
          <div className="tk-row__text">
            <span className={`tk-row__title${m.done ? ' is-done' : m.skip ? ' is-skip' : ''}`}>{task.title}</span>
            {showDesc && task.description && <span className="tk-row__desc">{task.description}</span>}
          </div>
          <div className="tk-row__aside">
            {runChip}
            {subsBtn}
            {tags}
            {prChip}
            {badge()}
            {m.late && <span className="tk-late tk-late--fixed">{m.late}</span>}
          </div>
        </div>
        {subsPanel}
      </div>
    );
  }

  if (variant === 'mobile') {
    return (
      <div className={`tk-mcard${selected ? ' is-selected' : ''}`} style={style} onClick={() => onOpen?.(task)} {...dragProps}>
        <span className="tk-k-bar tk-k-bar--3" />
        {statusBtn}
        <div className="tk-mcard__body">
          <span className={`tk-mcard__title${m.done ? ' is-done' : m.skip ? ' is-skip' : ''}`}>{task.title}</span>
          <div className="tk-mcard__chips">
            {badge()}
            {prChip}
            {subsBtn}
            {runChip}
            {tags}
          </div>
          {subsPanel}
        </div>
      </div>
    );
  }

  // variant === 'card' (Kanban desktop)
  const hasMeta = !!(m.run || subtasks.length || m.repeat || m.tags.length);
  return (
    <div className={`tk-card${selected ? ' is-selected' : ''}`} style={style} onClick={() => onOpen?.(task)} {...dragProps}>
      <span className="tk-k-bar" />
      <div className="tk-card__top">
        {badge()}
        {prChip}
        {m.canSetPriority && (
          <button type="button" className="tk-pr-set" title="Đặt ưu tiên" onClick={stop(onPriority)}>
            <AppIcon name="signalMedium" size={12} />
          </button>
        )}
        {m.late && <span className="tk-late">{m.late}</span>}
      </div>
      <div className="tk-card__main">
        {statusBtn}
        <span className={`tk-card__title${m.done ? ' is-done' : m.skip ? ' is-skip' : ''}`}>{task.title}</span>
      </div>
      {showDesc && task.description && <div className="tk-card__desc">{task.description}</div>}
      {hasMeta && (
        <div className="tk-card__meta">
          {runChip}
          {subsBtn}
          {m.repeat && <AppIcon name="repeat" size={13} style={{ color: 'var(--tk-text-sub)' }} title="Lặp lại" />}
          {tags}
        </div>
      )}
      {subsPanel}
    </div>
  );
}
