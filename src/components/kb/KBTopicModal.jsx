import { useState } from 'react';
import { MAX_TOPICS } from '../../hooks/useCollectionTopics';

/**
 * KBTopicModal — quản lý chủ đề: thêm, sửa tên / định nghĩa / màu, đổi thứ tự, gộp, xoá.
 * Parent mounts it only while open, so every open starts with a clean form.
 * Xác nhận xoá / gộp do parent làm (ConfirmModal).
 */
export default function KBTopicModal({ onClose, topics, counts, onSeed, onAdd, onUpdate, onMove, onMerge, onDelete }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [error, setError] = useState('');
  const full = topics.length >= MAX_TOPICS;

  const handleAdd = async () => {
    if (!name.trim()) return;
    const res = await onAdd({ name, description: desc });
    if (res.error) {
      setError(res.error);
      return;
    }
    setName('');
    setDesc('');
    setError('');
  };

  return (
    <div className="kb-overlay" onClick={onClose}>
      <div className="kb-palette kb-topic-modal" role="dialog" aria-label="Quản lý chủ đề" onClick={e => e.stopPropagation()}>
        <div className="kb-topic-modal__head">
          <span>Chủ đề · {topics.length}/{MAX_TOPICS}</span>
          <button className="kb-btn-ghost kb-btn-ghost--small" onClick={onClose}>esc</button>
        </div>

        {topics.length === 0 ? (
          <div className="kb-topic-modal__empty">
            <p>Chưa có chủ đề nào.</p>
            <button className="kb-btn-primary" onClick={onSeed}>Dùng bộ 7 chủ đề gợi ý</button>
          </div>
        ) : (
          <div className="kb-palette__list">
            {topics.map((t, i) => (
              <TopicRow
                key={t.id}
                topic={t}
                count={counts[t.id] || 0}
                canUp={i > 0}
                canDown={i < topics.length - 1}
                others={topics.filter(o => o.id !== t.id)}
                onUpdate={onUpdate}
                onMove={onMove}
                onMerge={onMerge}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}

        <div className="kb-topic-modal__add">
          {full ? (
            <p className="kb-topic-modal__note">Đủ {MAX_TOPICS} chủ đề. Gộp hai chủ đề gần nhau để có chỗ tạo thêm.</p>
          ) : (
            <>
              <input
                className="kb-topic-modal__input"
                placeholder="Tên chủ đề mới"
                maxLength={40}
                value={name}
                onChange={e => { setName(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                aria-label="Tên chủ đề mới"
              />
              <input
                className="kb-topic-modal__input kb-topic-modal__input--wide"
                placeholder="Một dòng định nghĩa: chủ đề này chứa những gì"
                value={desc}
                onChange={e => setDesc(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                aria-label="Định nghĩa chủ đề mới"
              />
              <button className="kb-btn-primary" onClick={handleAdd} disabled={!name.trim()}>Thêm</button>
            </>
          )}
          {error && <p className="kb-topic-modal__error" role="alert">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function TopicRow({ topic, count, canUp, canDown, others, onUpdate, onMove, onMerge, onDelete }) {
  const [name, setName] = useState(topic.name);
  const [desc, setDesc] = useState(topic.description);
  const [color, setColor] = useState(topic.color);

  const commitName = () => {
    if (!name.trim()) setName(topic.name);
    else if (name.trim() !== topic.name) onUpdate(topic.id, { name });
  };
  const commitDesc = () => {
    if (desc.trim() !== topic.description) onUpdate(topic.id, { description: desc });
  };
  const blurOnEnter = e => e.key === 'Enter' && e.currentTarget.blur();

  return (
    <div className="kb-topic-modal__row">
      <input
        type="color"
        className="kb-topic-modal__color"
        value={color}
        onChange={e => setColor(e.target.value)}
        onBlur={() => color !== topic.color && onUpdate(topic.id, { color })}
        aria-label={`Màu của ${topic.name}`}
      />
      <div className="kb-topic-modal__fields">
        <input
          className="kb-topic-modal__name"
          value={name}
          maxLength={40}
          onChange={e => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={blurOnEnter}
          aria-label="Tên chủ đề"
        />
        <input
          className="kb-topic-modal__desc"
          value={desc}
          placeholder="Thêm định nghĩa…"
          onChange={e => setDesc(e.target.value)}
          onBlur={commitDesc}
          onKeyDown={blurOnEnter}
          aria-label={`Định nghĩa của ${topic.name}`}
        />
      </div>
      <span className="kb-topic-modal__count">{count} bài</span>
      <div className="kb-topic-modal__actions">
        <button className="kb-btn-ghost kb-btn-ghost--small" disabled={!canUp} onClick={() => onMove(topic.id, -1)} aria-label="Lên trên">↑</button>
        <button className="kb-btn-ghost kb-btn-ghost--small" disabled={!canDown} onClick={() => onMove(topic.id, 1)} aria-label="Xuống dưới">↓</button>
        {others.length > 0 && (
          <select
            className="kb-topic-modal__merge"
            value=""
            onChange={e => e.target.value && onMerge(topic, others.find(o => o.id === e.target.value))}
            aria-label={`Gộp ${topic.name} vào chủ đề khác`}
          >
            <option value="">Gộp vào…</option>
            {others.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <button className="kb-btn-ghost kb-btn-ghost--small kb-btn-ghost--danger" onClick={() => onDelete(topic)}>Xoá</button>
      </div>
    </div>
  );
}
