import { useRef, useState } from 'react';
import { MAX_TOPICS } from '../../hooks/useCollectionTopics';
import AppIcon from '../AppIcon';

/**
 * KBTopicModal — Quản lý chủ đề (4b): kéo ⋮⋮ để đổi thứ tự (↑↓ khi tay cầm đang được chọn),
 * sửa tên / mô tả / màu tại chỗ, Gộp / Xoá hiện khi rê chuột hoặc bấm ⋯.
 * Parent mounts it only while open, so every open starts with a clean form.
 * Xác nhận xoá / gộp do parent làm (ConfirmModal).
 */

const SWATCHES = ['#6EF2C7', '#7FD6FF', '#B18CFF', '#FFD27F', '#9AE66E', '#FF9FB2', '#E6EAF5'];

export default function KBTopicModal({ onClose, topics, counts, currentId, onSeed, onAdd, onUpdate, onReorder, onMerge, onDelete }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [color, setColor] = useState(() => SWATCHES.find(c => !topics.some(t => t.color.toLowerCase() === c.toLowerCase())) || SWATCHES[0]);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null); // ids đang kéo (xem trước), null = theo topics
  const [dragId, setDragId] = useState(null);
  const listRef = useRef(null);
  const left = MAX_TOPICS - topics.length;

  const ids = topics.map(t => t.id);
  const byId = new Map(topics.map(t => [t.id, t]));
  const shown = (order || ids).map(id => byId.get(id)).filter(Boolean);

  const handleAdd = async () => {
    if (!name.trim()) return;
    const res = await onAdd({ name, description: desc, color });
    if (res.error) {
      setError(res.error);
      return;
    }
    setName('');
    setDesc('');
    setError('');
  };

  // Kéo bằng pointer events (chuột + cảm ứng). Vị trí đích tính theo tâm các dòng lúc bắt đầu kéo.
  const startDrag = (e, id) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const rows = [...listRef.current.querySelectorAll('[data-topic-row]')];
    const mids = rows.map(r => ({ id: r.dataset.topicRow, y: r.getBoundingClientRect().top + r.offsetHeight / 2 }));
    let next = ids;
    setDragId(id);
    setOrder(ids);

    const move = ev => {
      const others = mids.filter(m => m.id !== id);
      const at = others.filter(m => ev.clientY > m.y).length;
      next = [...others.slice(0, at).map(m => m.id), id, ...others.slice(at).map(m => m.id)];
      setOrder(next);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setDragId(null);
      setOrder(null);
      if (next.join() !== ids.join()) onReorder(next);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const nudge = (id, dir) => {
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    onReorder(next);
  };

  return (
    <div className="kb-overlay" onClick={onClose}>
      <div className="kb-modal kb-tm" role="dialog" aria-label="Quản lý chủ đề" onClick={e => e.stopPropagation()}>
        <header className="kb-modal__head">
          <div className="kb-modal__titles">
            <div className="kb-modal__title-line">
              <h2 className="kb-modal__title">Quản lý chủ đề</h2>
              <span className="kb-badge-soft">{topics.length} / {MAX_TOPICS}</span>
            </div>
            {topics.length > 1 && (
              <p className="kb-modal__sub">Kéo <span className="kb-tm__grip-hint">⋮⋮</span> để đổi thứ tự. Bấm vào tên hoặc mô tả để sửa ngay tại chỗ.</p>
            )}
          </div>
          <button className="kb-btn-ghost kb-btn-ghost--small" onClick={onClose}>Đóng <kbd className="kb-kbd">Esc</kbd></button>
        </header>

        {topics.length === 0 ? (
          <div className="kb-tm__empty">
            <p>Chưa có chủ đề nào.</p>
            <button className="kb-btn-primary" onClick={onSeed}>Dùng bộ 7 chủ đề gợi ý</button>
          </div>
        ) : (
          <div className="kb-tm__list" ref={listRef}>
            {shown.map((t, i) => (
              <TopicRow
                key={t.id}
                topic={t}
                count={counts[t.id] || 0}
                current={t.id === currentId}
                dragging={t.id === dragId}
                canUp={i > 0}
                canDown={i < shown.length - 1}
                others={topics.filter(o => o.id !== t.id)}
                onGrab={e => startDrag(e, t.id)}
                onNudge={dir => nudge(t.id, dir)}
                onUpdate={onUpdate}
                onMerge={onMerge}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}

        <footer className="kb-tm__add">
          {left <= 0 ? (
            <p className="kb-tm__note">Đủ {MAX_TOPICS} chủ đề. Gộp hai chủ đề gần nhau để có chỗ tạo thêm.</p>
          ) : (
            <>
              <span className="kb-tm__add-label">Thêm chủ đề · còn {left} chỗ</span>
              <div className="kb-tm__add-row">
                <div className="kb-tm__swatches" role="radiogroup" aria-label="Màu chủ đề mới">
                  {SWATCHES.map(c => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={color === c}
                      aria-label={`Màu ${c}`}
                      className={`kb-tm__swatch${color === c ? ' is-active' : ''}`}
                      style={{ '--kb-topic': c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
                <input
                  className="kb-input kb-tm__name-input"
                  placeholder="Tên chủ đề"
                  maxLength={40}
                  value={name}
                  onChange={e => { setName(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  aria-label="Tên chủ đề mới"
                />
                <input
                  className="kb-input kb-tm__desc-input"
                  placeholder="Một dòng: chủ đề này chứa những gì"
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  aria-label="Mô tả chủ đề mới"
                />
                <button className="kb-btn-primary" onClick={handleAdd} disabled={!name.trim()}>Thêm</button>
              </div>
            </>
          )}
          {error && <p className="kb-tm__error" role="alert">{error}</p>}
        </footer>
      </div>
    </div>
  );
}

function TopicRow({ topic, count, current, dragging, canUp, canDown, others, onGrab, onNudge, onUpdate, onMerge, onDelete }) {
  const [name, setName] = useState(topic.name);
  const [desc, setDesc] = useState(topic.description);
  const [color, setColor] = useState(topic.color);
  const [open, setOpen] = useState(false);

  const commitName = () => {
    if (!name.trim()) setName(topic.name);
    else if (name.trim() !== topic.name) onUpdate(topic.id, { name });
  };
  const commitDesc = () => {
    if (desc.trim() !== topic.description) onUpdate(topic.id, { description: desc });
  };
  const blurOnEnter = e => e.key === 'Enter' && e.currentTarget.blur();

  return (
    <div className={`kb-tm__row${dragging ? ' is-dragging' : ''}${open ? ' is-open' : ''}`} data-topic-row={topic.id}>
      <button
        className="kb-tm__grip"
        onPointerDown={onGrab}
        onKeyDown={e => {
          if (e.key === 'ArrowUp' && canUp) { e.preventDefault(); onNudge(-1); }
          if (e.key === 'ArrowDown' && canDown) { e.preventDefault(); onNudge(1); }
        }}
        aria-label={`Đổi thứ tự ${topic.name} (kéo, hoặc ↑ ↓)`}
        title="Kéo để đổi thứ tự"
      >⋮⋮</button>

      <label className="kb-tm__color" style={{ '--kb-topic': color }} title="Đổi màu">
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          onBlur={() => color !== topic.color && onUpdate(topic.id, { color })}
          aria-label={`Màu của ${topic.name}`}
        />
      </label>

      <div className="kb-tm__fields">
        <div className="kb-tm__name-line">
          <input
            className="kb-tm__name"
            value={name}
            maxLength={40}
            onChange={e => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={blurOnEnter}
            aria-label="Tên chủ đề"
          />
          {current && <span className="kb-tm__current">Đang xem</span>}
        </div>
        <input
          className="kb-tm__desc"
          value={desc}
          placeholder="Thêm mô tả…"
          onChange={e => setDesc(e.target.value)}
          onBlur={commitDesc}
          onKeyDown={blurOnEnter}
          aria-label={`Mô tả của ${topic.name}`}
        />
      </div>

      <span className="kb-tm__count">{count} bài</span>

      <div className="kb-tm__actions">
        <div className="kb-tm__more">
          {others.length > 0 && (
            <select
              className="kb-tm__merge"
              value=""
              onChange={e => e.target.value && onMerge(topic, others.find(o => o.id === e.target.value))}
              aria-label={`Gộp ${topic.name} vào chủ đề khác`}
            >
              <option value="">Gộp vào…</option>
              {others.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          <button className="kb-icon-btn kb-icon-btn--danger is-filled" onClick={() => onDelete(topic)} title="Xoá chủ đề" aria-label={`Xoá ${topic.name}`}>
            <AppIcon name="trash" size={14} />
          </button>
        </div>
        <button className="kb-icon-btn kb-tm__dots" onClick={() => setOpen(o => !o)} title="Gộp, xoá…" aria-label="Gộp, xoá…" aria-expanded={open}>⋯</button>
      </div>
    </div>
  );
}
