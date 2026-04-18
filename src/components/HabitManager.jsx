import { useState } from 'react';
import { useCustomHabits, CATEGORIES, HABIT_ICONS, HABIT_COLORS } from '../hooks/useCustomHabits';
import '../styles/calendar.css';


function HabitForm({ initial, onSave, onCancel }) {
  const [name,        setName]        = useState(initial?.name        || '');
  const [action,      setAction]      = useState(initial?.action      || '');
  const [icon,        setIcon]        = useState(initial?.icon        || '⚡');
  const [color,       setColor]       = useState(initial?.color       || '#8B5CF6');
  const [category,    setCategory]    = useState(initial?.category    || 'other');
  const [timeTarget,  setTimeTarget]  = useState(initial?.timeTarget  || '');
  const [durationMin, setDurationMin] = useState(initial?.durationMin || 20);

  return (
    <div className="habit-form card">
      <div className="dash-card-title">{initial ? '✏️ Sửa Habit' : '➕ Tạo Habit Mới'}</div>

      {/* Icon picker */}
      <div className="habit-form__field">
        <label>Icon</label>
        <div className="icon-picker">
          {HABIT_ICONS.map(ic => (
            <button key={ic} className={`icon-btn ${icon === ic ? 'icon-btn--active' : ''}`}
              onClick={() => setIcon(ic)} id={`icon-${ic}`}>
              {ic}
            </button>
          ))}
        </div>
      </div>

      {/* Color picker */}
      <div className="habit-form__field">
        <label>Màu</label>
        <div className="color-picker">
          {HABIT_COLORS.map(c => (
            <button key={c} className={`color-btn ${color === c ? 'color-btn--active' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)} id={`color-${c}`}
            />
          ))}
        </div>
      </div>

      {/* Name */}
      <div className="habit-form__field">
        <label>Tên habit <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(danh mục chung)</span></label>
        <input className="auth-input" placeholder="VD: Học Tiếng Anh, Tập thể dục"
          value={name} onChange={e => setName(e.target.value)} id="habit-name-input" />
      </div>

      {/* Action — what user does EVERY DAY */}
      <div className="habit-form__field">
        <label>
          🎯 Hành động mỗi ngày{' '}
          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(cụ thể)</span>
        </label>
        <input className="auth-input"
          placeholder="VD: Học 30 phút Duolingo, Chạy bộ 20 phút buổi sáng"
          value={action} onChange={e => setAction(e.target.value)}
          id="habit-action-input" />
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          ℹ️ Đây là câu hỏi bạn tự hỏi mỗi ngày: “Hôm nay mình cần làm gì?”
        </div>
      </div>

      {/* Category */}
      <div className="habit-form__field">
        <label>Danh mục</label>
        <div className="category-picker">
          {CATEGORIES.map(cat => (
            <button key={cat.id}
              className={`category-btn ${category === cat.id ? 'category-btn--active' : ''}`}
              onClick={() => setCategory(cat.id)} id={`cat-${cat.id}`}>
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Time & duration */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="habit-form__field">
          <label>⏰ Giờ thực hiện</label>
          <input type="time" className="auth-input" value={timeTarget}
            onChange={e => setTimeTarget(e.target.value)} id="habit-time-input" />
        </div>
        <div className="habit-form__field">
          <label>⏱ Thời lượng (phút)</label>
          <input type="number" className="auth-input" min={5} max={120} step={5}
            value={durationMin} onChange={e => setDurationMin(+e.target.value)} id="habit-duration-input" />
        </div>
      </div>

      {/* Preview */}
      <div className="habit-preview" style={{ borderColor: color }}>
        <span className="habit-preview__icon" style={{ background: color + '22' }}>{icon}</span>
        <span className="habit-preview__name">{name || 'Tên habit...'}</span>
        <span className="habit-preview__meta">
          {timeTarget && `${timeTarget} · `}{durationMin}p
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
        <button className="btn btn-primary" style={{ flex: 1 }}
          onClick={() => name.trim() && onSave({ name, action: action.trim() || name, icon, color, category, timeTarget, durationMin })}
          id="habit-save-btn">
          {initial ? '💾 Lưu' : '➕ Thêm Habit'}
        </button>
        <button className="btn btn-ghost" onClick={onCancel} id="habit-cancel-btn">Huỷ</button>
      </div>
    </div>
  );
}

export default function HabitManager() {
  const { habits, addHabit, updateHabit, deleteHabit } = useCustomHabits();
  const [adding,   setAdding]   = useState(false);
  const [editing,  setEditing]  = useState(null); // habit id

  return (
    <div className="habit-manager" id="habit-manager">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div className="dash-card-title">📋 Habits Của Bạn</div>
        {!adding && (
          <button className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            onClick={() => setAdding(true)} id="habit-add-btn">
            ➕ Thêm
          </button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <HabitForm
          onSave={async (data) => { await addHabit(data); setAdding(false); }}
          onCancel={() => setAdding(false)}
        />
      )}

      {/* Habit list */}
      <div className="habit-list">
        {habits.map(habit => (
          <div key={habit.id}>
            {editing === habit.id ? (
              <HabitForm
                initial={habit}
                onSave={async (data) => { await updateHabit(habit.id, data); setEditing(null); }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className="habit-item" style={{ '--habit-color': habit.color }}>
                <div className="habit-item__icon" style={{ background: habit.color + '22', borderColor: habit.color + '55' }}>
                  {habit.icon}
                </div>
                <div className="habit-item__info">
                  <div className="habit-item__name">{habit.name}</div>
                  <div className="habit-item__meta">
                    {habit.action && habit.action !== habit.name && (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block', marginBottom: '0.15rem' }}>
                        🎯 {habit.action}
                      </span>
                    )}
                    {CATEGORIES.find(c => c.id === habit.category)?.icon} {habit.category}
                    {habit.timeTarget && ` · ⏰ ${habit.timeTarget}`}
                    {habit.durationMin && ` · ⏱ ${habit.durationMin}p`}
                  </div>
                </div>
                <div className="habit-item__actions">
                  <button className="btn btn-ghost" style={{ padding: '0.3rem 0.6rem', fontSize: '0.82rem' }}
                    onClick={() => setEditing(habit.id)} id={`edit-habit-${habit.id}`}>✏️</button>
                  <button className="btn btn-ghost" style={{ padding: '0.3rem 0.6rem', fontSize: '0.82rem', color: '#f87171' }}
                    onClick={() => { if (confirm(`Xóa "${habit.name}"?`)) deleteHabit(habit.id); }}
                    id={`delete-habit-${habit.id}`}>🗑</button>
                </div>
              </div>
            )}
          </div>
        ))}

        {habits.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem 0' }}>
            Chưa có habit nào. Thêm habit đầu tiên!
          </p>
        )}
      </div>
    </div>
  );
}
