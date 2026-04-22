import { useState, useCallback } from 'react';
import { useLifeJourney } from '../hooks/useLifeJourney';
import './LifeJourneyPage.css';

// ── Constants ──────────────────────────────────────────────────────────
const CHART_W  = 1000;
const CHART_H  = 480;
const PAD      = { top: 90, right: 60, bottom: 110, left: 90 };
const PLOT_W   = CHART_W - PAD.left - PAD.right;
const PLOT_H   = CHART_H - PAD.top - PAD.bottom;
const Y_MIN    = -5;
const Y_MAX    = 5;

const EMOJIS = ['😊','😎','🥳','❤️','🌟','🏆','🎉','🚀','🌈','🌸',
                '👶','👧','👦','🤝','✈️','🏠','📚','⚽','🏀','🎵',
                '😢','😰','😤','🤕','🦶','🐟','🏥','⚡','🌧️','💔'];

const EMOTION_LABELS = {
  5: 'Rất vui 😄', 4: 'Vui 😊', 3: 'Khá tốt 🙂', 2: 'Tốt 😌', 1: 'Bình thường',
  0: 'Trung lập 😐',
  '-1': 'Hơi buồn 😕', '-2': 'Buồn 😞', '-3': 'Khó chịu 😟', '-4': 'Tệ 😢', '-5': 'Rất tệ 😰',
};

// ── Chart helpers ──────────────────────────────────────────────────────
function toX(age, minAge, maxAge) {
  return PAD.left + ((age - minAge) / Math.max(maxAge - minAge, 1)) * PLOT_W;
}
function toY(e) {
  return PAD.top + ((Y_MAX - e) / (Y_MAX - Y_MIN)) * PLOT_H;
}

function catmullRomPath(pts) {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M${pts[0].x} ${pts[0].y} L${pts[1].x} ${pts[1].y}`;
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x} ${cp1y},${cp2x} ${cp2y},${p2.x} ${p2.y}`;
  }
  return d;
}

// ── Modal ──────────────────────────────────────────────────────────────
function EventModal({ initial, onSave, onClose, onDelete }) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState({
    age: initial?.age ?? '',
    emotion: initial?.emotion ?? 3,
    label: initial?.label ?? '',
    desc: initial?.desc ?? '',
    icon: initial?.icon ?? '😊',
  });
  const [emojiOpen, setEmojiOpen] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.age !== '' && Number(form.age) >= 0 && form.label.trim();
  const emColor = form.emotion > 0 ? '#22c55e' : form.emotion < 0 ? '#ef4444' : '#64748b';

  return (
    <div className="lj-overlay" onClick={onClose}>
      <div className="lj-modal" onClick={e => e.stopPropagation()}>
        <h3>{isEdit ? '✏️ Chỉnh sửa cột mốc' : '✨ Thêm cột mốc mới'}</h3>

        <div className="lj-form-row">
          <label>Tuổi</label>
          <input type="number" min="0" max="120" value={form.age}
            onChange={e => set('age', e.target.value)} placeholder="VD: 18" />
        </div>

        <div className="lj-form-row">
          <div className="lj-emotion-display">
            <label style={{ margin: 0 }}>Cảm xúc</label>
            <span className="lj-emotion-label" style={{ color: emColor }}>
              {EMOTION_LABELS[form.emotion] ?? form.emotion}
            </span>
          </div>
          <input type="range" min="-5" max="5" step="1" value={form.emotion}
            onChange={e => set('emotion', Number(e.target.value))} className="lj-slider" />
          <div className="lj-slider-labels">
            <span>-5 Rất tệ</span><span>0</span><span>+5 Rất vui</span>
          </div>
        </div>

        <div className="lj-form-row">
          <label>Tên cột mốc</label>
          <input type="text" value={form.label}
            onChange={e => set('label', e.target.value)} placeholder="VD: Vào đại học" />
        </div>

        <div className="lj-form-row">
          <label>Mô tả</label>
          <input type="text" value={form.desc}
            onChange={e => set('desc', e.target.value)} placeholder="VD: Đậu vào ĐH Bách Khoa" />
        </div>

        <div className="lj-form-row">
          <label>Icon đại diện</label>
          <div className="lj-emoji-trigger" onClick={() => setEmojiOpen(o => !o)}>
            <span className="lj-emoji-big">{form.icon}</span>
            <span className="lj-emoji-hint">Chọn icon ▾</span>
          </div>
          {emojiOpen && (
            <div className="lj-emoji-grid">
              {EMOJIS.map(e => (
                <button key={e}
                  className={`lj-emoji-btn ${form.icon === e ? 'active' : ''}`}
                  onClick={() => { set('icon', e); setEmojiOpen(false); }}>{e}</button>
              ))}
            </div>
          )}
        </div>

        <div className="lj-modal-actions">
          {isEdit && (
            <button className="lj-btn-danger" onClick={() => onDelete(initial.id)}>🗑 Xóa</button>
          )}
          <button className="lj-btn-secondary" onClick={onClose}>Hủy</button>
          <button className="lj-btn-primary" disabled={!valid}
            onClick={() => valid && onSave(form)}>
            {isEdit ? 'Lưu thay đổi' : '➕ Thêm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── The Chart ──────────────────────────────────────────────────────────
function JourneyChart({ events, onClickPoint }) {
  const [hovered, setHovered] = useState(null);

  const sorted = [...events].sort((a, b) => a.age - b.age);
  const ages   = sorted.map(e => e.age);
  const minAge = Math.max(0, Math.min(...ages, 0));
  const maxAge = Math.max(...ages, minAge + 1) + 1;

  // Map each event to SVG coords
  const pts = sorted.map(e => ({
    ...e,
    x: toX(e.age, minAge, maxAge),
    y: toY(e.emotion),
  }));

  const posPts = pts.filter(p => p.emotion >= 0);
  const negPts = pts.filter(p => p.emotion <= 0);

  const zero_y  = toY(0);
  const yTicks  = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];
  const xTicks  = [];
  for (let a = minAge; a <= maxAge; a++) xTicks.push(a);

  // Determine label position: above if positive, below if negative
  // Alternate offset to avoid overlap
  const getLabelOffset = (p, idx) => {
    const isPos = p.emotion >= 0;
    const base  = isPos ? -70 : 55;
    const alt   = idx % 2 === 0 ? 0 : (isPos ? -22 : 22);
    return base + alt;
  };

  return (
    <div className="lj-chart-wrapper">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="lj-svg">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#00000020" />
          </filter>
        </defs>

        {/* ── Background grid ── */}
        {yTicks.map(v => (
          <line key={v}
            x1={PAD.left} x2={CHART_W - PAD.right}
            y1={toY(v)} y2={toY(v)}
            stroke={v === 0 ? '#b0bac9' : '#e8ecf3'}
            strokeWidth={v === 0 ? 1.5 : 0.8}
            strokeDasharray={v === 0 ? 'none' : '5 5'} />
        ))}

        {/* ── Y axis labels ── */}
        {yTicks.map(v => (
          <text key={v} x={PAD.left - 10} y={toY(v) + 4}
            textAnchor="end" fontSize="11.5"
            fill={v > 0 ? '#2d8a5e' : v < 0 ? '#c0392b' : '#64748b'}
            fontWeight="700" fontFamily="Nunito, sans-serif">
            {v > 0 ? `+${v}` : v}
          </text>
        ))}

        {/* ── RẤT VUI / RẤT TỆ side labels ── */}
        <g transform={`rotate(-90, 22, ${toY(3.5)})`}>
          <text x={22} y={toY(3.5)} textAnchor="middle" fontSize="10"
            fill="#2d8a5e" fontWeight="800" fontFamily="Nunito, sans-serif">RẤT VUI (+5)</text>
        </g>
        <g transform={`rotate(-90, 22, ${toY(-3.5)})`}>
          <text x={22} y={toY(-3.5)} textAnchor="middle" fontSize="10"
            fill="#c0392b" fontWeight="800" fontFamily="Nunito, sans-serif">RẤT TỆ (-5)</text>
        </g>

        {/* CẢM XÚC label */}
        <text x={54} y={PAD.top - 20} textAnchor="middle" fontSize="11"
          fill="#64748b" fontWeight="700" fontFamily="Nunito, sans-serif">
          CẢM XÚC (-5 → +5)
        </text>

        {/* ── X axis ticks ── */}
        {xTicks.map(a => (
          <g key={a}>
            <line x1={toX(a, minAge, maxAge)} x2={toX(a, minAge, maxAge)}
              y1={zero_y - 4} y2={zero_y + 4} stroke="#b0bac9" strokeWidth="1.5" />
            <text x={toX(a, minAge, maxAge)} y={CHART_H - PAD.bottom + 20}
              textAnchor="middle" fontSize="12"
              fill="#64748b" fontWeight="700" fontFamily="Nunito, sans-serif">{a}</text>
          </g>
        ))}

        {/* TUỔI label */}
        <text x={CHART_W - PAD.right + 10} y={zero_y + 4}
          fontSize="12" fill="#64748b" fontWeight="700" fontFamily="Nunito, sans-serif">Tuổi</text>

        {/* ── Axes with arrows ── */}
        <line x1={PAD.left} x2={CHART_W - PAD.right - 2} y1={zero_y} y2={zero_y}
          stroke="#b0bac9" strokeWidth="1.8" />
        <polygon
          points={`${CHART_W - PAD.right},${zero_y} ${CHART_W - PAD.right - 10},${zero_y - 5} ${CHART_W - PAD.right - 10},${zero_y + 5}`}
          fill="#b0bac9" />

        <line x1={PAD.left} x2={PAD.left} y1={CHART_H - PAD.bottom} y2={PAD.top + 2}
          stroke="#b0bac9" strokeWidth="1.8" />
        <polygon
          points={`${PAD.left},${PAD.top} ${PAD.left - 5},${PAD.top + 10} ${PAD.left + 5},${PAD.top + 10}`}
          fill="#b0bac9" />

        {/* ── Positive curve ── */}
        {posPts.length >= 1 && (
          <path d={catmullRomPath(posPts)} fill="none"
            stroke="#2d8a5e" strokeWidth="3"
            strokeLinecap="round" strokeLinejoin="round"
            className="lj-line-anim" />
        )}

        {/* ── Negative curve ── */}
        {negPts.length >= 1 && (
          <path d={catmullRomPath(negPts)} fill="none"
            stroke="#e05252" strokeWidth="3"
            strokeLinecap="round" strokeLinejoin="round"
            className="lj-line-anim-delay" />
        )}

        {/* ── Points + floating labels ── */}
        {pts.map((p, idx) => {
          const isPos  = p.emotion >= 0;
          const isHov  = hovered === p.id;
          const dotColor = isPos ? '#2d8a5e' : '#e05252';
          const labelY   = p.y + getLabelOffset(p, idx);
          const lineEndY = isPos ? p.y - 16 : p.y + 16;

          return (
            <g key={p.id} className="lj-point-group"
              onClick={() => onClickPoint(p)}
              onMouseEnter={() => setHovered(p.id)}
              onMouseLeave={() => setHovered(null)}>

              {/* Dashed vertical line to label */}
              <line
                x1={p.x} y1={lineEndY}
                x2={p.x} y2={labelY + (isPos ? 52 : -10)}
                stroke={dotColor} strokeWidth="1.2"
                strokeDasharray="4 3" opacity="0.55" />

              {/* Floating label card */}
              <g transform={`translate(${p.x}, ${labelY})`}
                style={{ transition: 'opacity 0.15s' }}>
                {/* Icon circle */}
                <circle cx={0} cy={isPos ? 0 : 44} r="18"
                  fill={isPos ? '#e8f5ee' : '#fef2f2'}
                  stroke={dotColor} strokeWidth="1.5" />
                <text x={0} y={isPos ? 6 : 50}
                  textAnchor="middle" fontSize="16"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>{p.icon}</text>

                {/* Label text */}
                <text x={0} y={isPos ? -8 : 72}
                  textAnchor="middle" fontSize="10.5"
                  fill={dotColor} fontWeight="800"
                  fontFamily="Nunito, sans-serif">{p.label}</text>
                <text x={0} y={isPos ? -22 : 86}
                  textAnchor="middle" fontSize="9.5"
                  fill="#475569" fontFamily="Nunito, sans-serif">
                  {p.desc.length > 22 ? p.desc.slice(0, 21) + '…' : p.desc}
                </text>
                {/* Score badge */}
                <g transform={`translate(0, ${isPos ? -38 : 96})`}>
                  <rect x="-14" y="-10" width="28" height="16" rx="8"
                    fill={dotColor} opacity="0.12" />
                  <text x={0} y={2} textAnchor="middle" fontSize="10"
                    fill={dotColor} fontWeight="900"
                    fontFamily="Nunito, sans-serif">
                    {p.emotion > 0 ? `+${p.emotion}` : p.emotion}
                  </text>
                </g>
              </g>

              {/* The dot */}
              <circle cx={p.x} cy={p.y} r={isHov ? 8 : 6}
                className="lj-dot-main"
                fill={dotColor} stroke="white" strokeWidth="2.5"
                filter="url(#shadow)" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────
export default function LifeJourneyPage() {
  const { events, addEvent, updateEvent, deleteEvent, resetToDefault } = useLifeJourney();
  const [modal, setModal] = useState(null);
  const [title, setTitle] = useState(
    () => localStorage.getItem('vl_journey_title') || 'My Life Journey'
  );
  const [editingTitle, setEditingTitle] = useState(false);

  const handleSave = useCallback((form) => {
    if (modal === 'add') {
      addEvent({ ...form, age: Number(form.age) });
    } else {
      updateEvent(modal.id, { ...form, age: Number(form.age) });
    }
    setModal(null);
  }, [modal, addEvent, updateEvent]);

  const handleDelete = useCallback((id) => {
    deleteEvent(id);
    setModal(null);
  }, [deleteEvent]);

  const saveTitle = (val) => {
    const t = val.trim() || 'My Life Journey';
    setTitle(t);
    localStorage.setItem('vl_journey_title', t);
    setEditingTitle(false);
  };

  const positive   = events.filter(e => e.emotion > 0).length;
  const negative   = events.filter(e => e.emotion < 0).length;
  const avgEmotion = events.length
    ? (events.reduce((s, e) => s + e.emotion, 0) / events.length).toFixed(1)
    : 0;

  return (
    <div className="lj-page">
      {/* ── Header ── */}
      <div className="lj-header">
        <div className="lj-title-wrap">
          {editingTitle ? (
            <input className="lj-title-input" defaultValue={title} autoFocus
              onBlur={e => saveTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveTitle(e.target.value)} />
          ) : (
            <h1 className="lj-title" onClick={() => setEditingTitle(true)} title="Click để đổi tên">
              {title} <span className="lj-title-edit">✏️</span>
            </h1>
          )}
          <div className="lj-heart-icon">❤️</div>
          <p className="lj-subtitle">Những cột mốc đáng nhớ</p>
        </div>

        <div className="lj-header-actions">
          <button className="lj-btn-add" onClick={() => setModal('add')}>
            ✨ Thêm cột mốc
          </button>
          <button className="lj-btn-reset"
            onClick={() => { if (confirm('Reset về dữ liệu mẫu?')) resetToDefault(); }}>
            🔄 Reset
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="lj-stats">
        <div className="lj-stat lj-stat-total">
          <span className="lj-stat-num">{events.length}</span>
          <span className="lj-stat-lbl">📍 Cột mốc</span>
        </div>
        <div className="lj-stat lj-stat-pos">
          <span className="lj-stat-num">{positive}</span>
          <span className="lj-stat-lbl">🟢 Tích cực</span>
        </div>
        <div className="lj-stat lj-stat-neg">
          <span className="lj-stat-num">{negative}</span>
          <span className="lj-stat-lbl">🔴 Tiêu cực</span>
        </div>
        <div className="lj-stat">
          <span className="lj-stat-num" style={{ color: Number(avgEmotion) >= 0 ? '#22c55e' : '#ef4444' }}>
            {Number(avgEmotion) > 0 ? '+' : ''}{avgEmotion}
          </span>
          <span className="lj-stat-lbl">📊 TB cảm xúc</span>
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="lj-chart-card">
        <JourneyChart events={events} onClickPoint={setModal} />

        <div className="lj-legend">
          <div className="lj-legend-box">
            <div className="lj-legend-item">
              <span className="lj-legend-line green" />
              Khoảng thời gian tích cực
            </div>
            <div className="lj-legend-item">
              <span className="lj-legend-line red" />
              Khoảng thời gian tiêu cực
            </div>
          </div>
          <span className="lj-legend-hint">💡 Click vào điểm để chỉnh sửa</span>
        </div>
      </div>

      {/* ── Event Cards ── */}
      <div className="lj-event-list">
        <h2 className="lj-section-title">📋 Danh sách cột mốc</h2>
        <div className="lj-event-grid">
          {[...events].sort((a, b) => a.age - b.age).map(e => (
            <div key={e.id}
              className={`lj-event-card ${e.emotion >= 0 ? 'pos' : 'neg'}`}
              onClick={() => setModal(e)}>
              <span className="lj-ec-icon">{e.icon}</span>
              <div className="lj-ec-body">
                <div className="lj-ec-label">{e.label}</div>
                <div className="lj-ec-desc">{e.desc}</div>
              </div>
              <span className={`lj-ec-score ${e.emotion >= 0 ? 'pos' : 'neg'}`}>
                {e.emotion > 0 ? '+' : ''}{e.emotion}
              </span>
            </div>
          ))}
          <div className="lj-event-card lj-event-add-card" onClick={() => setModal('add')}>
            <span className="lj-ec-icon">✨</span>
            <div className="lj-ec-body">
              <div className="lj-ec-label">Thêm cột mốc mới</div>
              <div className="lj-ec-desc">Click để thêm sự kiện vào hành trình</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quote ── */}
      <p className="lj-quote">
        ❤️ "Mỗi trải nghiệm dù vui hay buồn đều là một phần tạo nên con người mình hôm nay."
      </p>

      {/* ── Modal ── */}
      {modal && (
        <EventModal
          initial={modal === 'add' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
