import { useState, useCallback } from 'react';
import { useLifeJourney } from '../hooks/useLifeJourney';
import './LifeJourneyPage.css';

// ── Chart geometry ─────────────────────────────────────────────────────
const W      = 900;
const H      = 520;
const PAD    = { top: 110, right: 55, bottom: 100, left: 70 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top  - PAD.bottom;

const toX = (age, lo, hi) => PAD.left + ((age - lo) / Math.max(hi - lo, 1)) * PLOT_W;
const toY = (e)            => PAD.top  + ((5 - e) / 10) * PLOT_H; // e in [-5,+5]

/** Catmull-Rom smooth path through ordered points */
function catmull(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i-1, 0)];
    const p1 = pts[i];
    const p2 = pts[i+1];
    const p3 = pts[Math.min(i+2, pts.length-1)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x},${c1y},${c2x},${c2y},${p2.x},${p2.y}`;
  }
  return d;
}

// ── Static data ────────────────────────────────────────────────────────
const EMOJIS  = ['😊','😎','🥳','❤️','🌟','🏆','🎉','🚀','🌈','🌸','👶','👧','👦','🤝','✈️','🏠','📚','⚽','🏀','🎵','😢','😰','😤','🤕','🦶','🐟','🏥','⚡','🌧️','💔'];
const ELABELS = {5:'Rất vui 😄',4:'Vui 😊',3:'Khá tốt',2:'Tốt',1:'Bình thường',0:'Trung lập','-1':'Hơi buồn','-2':'Buồn','-3':'Khó chịu','-4':'Tệ','-5':'Rất tệ 😰'};

// ── Modal ──────────────────────────────────────────────────────────────
function EventModal({ initial, onSave, onClose, onDelete }) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState({
    age: initial?.age ?? '', emotion: initial?.emotion ?? 3,
    label: initial?.label ?? '', desc: initial?.desc ?? '', icon: initial?.icon ?? '😊',
  });
  const [emojiOpen, setEmojiOpen] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.age !== '' && Number(form.age) >= 0 && form.label.trim();
  const ec = form.emotion > 0 ? 'var(--green)' : form.emotion < 0 ? 'var(--red)' : 'var(--text-muted)';

  return (
    <div className="lj-overlay" onClick={onClose}>
      <div className="lj-modal" onClick={e => e.stopPropagation()}>
        <h3>{isEdit ? '✏️ Chỉnh sửa' : '✨ Thêm cột mốc mới'}</h3>
        <div className="lj-form-row">
          <label>Tuổi</label>
          <input type="number" min="0" max="120" value={form.age}
            onChange={e => set('age', e.target.value)} placeholder="VD: 18" />
        </div>
        <div className="lj-form-row">
          <div className="lj-emotion-display">
            <label style={{ margin: 0 }}>Cảm xúc</label>
            <span className="lj-emotion-label" style={{ color: ec }}>{ELABELS[form.emotion] ?? form.emotion}</span>
          </div>
          <input type="range" min="-5" max="5" step="1" value={form.emotion}
            onChange={e => set('emotion', Number(e.target.value))} className="lj-slider" />
          <div className="lj-slider-labels"><span>-5 Rất tệ</span><span>0</span><span>+5 Rất vui</span></div>
        </div>
        <div className="lj-form-row">
          <label>Tên cột mốc</label>
          <input type="text" value={form.label} onChange={e => set('label', e.target.value)} placeholder="VD: Vào đại học" />
        </div>
        <div className="lj-form-row">
          <label>Mô tả</label>
          <input type="text" value={form.desc} onChange={e => set('desc', e.target.value)} placeholder="VD: Đậu ĐH Bách Khoa" />
        </div>
        <div className="lj-form-row">
          <label>Icon</label>
          <div className="lj-emoji-trigger" onClick={() => setEmojiOpen(o => !o)}>
            <span className="lj-emoji-big">{form.icon}</span>
            <span className="lj-emoji-hint">Chọn icon ▾</span>
          </div>
          {emojiOpen && (
            <div className="lj-emoji-grid">
              {EMOJIS.map(e => (
                <button key={e} className={`lj-emoji-btn${form.icon === e ? ' active' : ''}`}
                  onClick={() => { set('icon', e); setEmojiOpen(false); }}>{e}</button>
              ))}
            </div>
          )}
        </div>
        <div className="lj-modal-actions">
          {isEdit && <button className="lj-btn-danger" onClick={() => onDelete(initial.id)}>🗑 Xóa</button>}
          <button className="lj-btn-secondary" onClick={onClose}>Hủy</button>
          <button className="lj-btn-primary" disabled={!valid} onClick={() => valid && onSave(form)}>
            {isEdit ? 'Lưu' : 'Thêm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Chart component ────────────────────────────────────────────────────
function Chart({ events, onClickPoint }) {
  const [hov, setHov] = useState(null);

  if (!events.length) return (
    <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
      Chưa có cột mốc nào. Nhấn "✨ Thêm cột mốc" để bắt đầu!
    </p>
  );

  /* ── 1. Sort ALL events: age ASC, same age → emotion DESC (positive first)
           This means at age 5: +5 point comes before -5 point on the line ── */
  const sorted = [...events].sort((a, b) => a.age - b.age || b.emotion - a.emotion);

  const ages   = sorted.map(e => e.age);
  const minAge = Math.min(...ages, 0);
  const maxAge = Math.max(...ages) + 1;

  // Map each event to SVG coordinates
  const pts = sorted.map(e => ({ ...e, x: toX(e.age, minAge, maxAge), y: toY(e.emotion) }));

  /* ── 2. ONE continuous Catmull-Rom path through ALL points ── */
  const singlePath = catmull(pts);

  const zeroY   = toY(0);   // y-coordinate of the zero (0) gridline
  const topY    = toY(5);   // y-coordinate of the +5 gridline  = PAD.top
  const botY    = toY(-5);  // y-coordinate of the -5 gridline  = PAD.top + PLOT_H

  const yTicks  = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];
  const xTicks  = Array.from({ length: maxAge - minAge + 1 }, (_, i) => minAge + i);

  return (
    <div className="lj-chart-wrapper">
      <svg viewBox={`0 0 ${W} ${H}`} className="lj-svg">
        <defs>
          {/*
            clipPath for GREEN: the rectangle ABOVE the zero line.
            Any part of the path that's above zeroY will be green.
          */}
          <clipPath id="lj-pos-clip">
            <rect x="0" y="0" width={W} height={zeroY} />
          </clipPath>

          {/*
            clipPath for RED: the rectangle BELOW the zero line.
            Any part of the path that's below zeroY will be red.
          */}
          <clipPath id="lj-neg-clip">
            <rect x="0" y={zeroY} width={W} height={H - zeroY} />
          </clipPath>
        </defs>

        {/* ── Grid: horizontal dashed lines ── */}
        {yTicks.map(v => (
          <line key={v}
            x1={PAD.left} x2={W - PAD.right}
            y1={toY(v)}   y2={toY(v)}
            className={v === 0 ? 'lj-axis-zero' : 'lj-grid-line'}
            strokeDasharray={v === 0 ? undefined : '5 5'} />
        ))}

        {/* ── Y-axis value labels ── */}
        {yTicks.map(v => (
          <text key={v}
            x={PAD.left - 8} y={toY(v) + 4}
            textAnchor="end" fontSize="10"
            fontFamily="var(--font-display)" fontWeight="700"
            className={v > 0 ? 'lj-txt-pos' : v < 0 ? 'lj-txt-neg' : 'lj-txt-zero'}>
            {v > 0 ? `+${v}` : v}
          </text>
        ))}

        {/* ── "RẤT VUI" / "RẤT TỆ" labels on Y axis ── */}
        <text x={PAD.left - 8} y={topY - 8}
          textAnchor="end" fontSize="9" fontFamily="var(--font-display)"
          fontWeight="700" className="lj-txt-pos">RẤT VUI</text>
        <text x={PAD.left - 8} y={botY + 18}
          textAnchor="end" fontSize="9" fontFamily="var(--font-display)"
          fontWeight="700" className="lj-txt-neg">RẤT TỆ</text>

        {/* ── Y-axis side line + arrow ── */}
        <line x1={PAD.left} x2={PAD.left}
          y1={H - PAD.bottom} y2={PAD.top}
          className="lj-axis-side" />
        <polygon
          points={`${PAD.left},${PAD.top} ${PAD.left-4},${PAD.top+9} ${PAD.left+4},${PAD.top+9}`}
          className="lj-axis-arrow" />

        {/* ── Zero horizontal axis + arrow ── */}
        <line x1={PAD.left} x2={W - PAD.right - 2}
          y1={zeroY} y2={zeroY}
          className="lj-axis-zero" />
        <polygon
          points={`${W-PAD.right},${zeroY} ${W-PAD.right-9},${zeroY-4} ${W-PAD.right-9},${zeroY+4}`}
          className="lj-axis-arrow" />
        <text x={W - PAD.right + 5} y={zeroY + 4}
          fontSize="10" fontFamily="var(--font-display)" fontWeight="600"
          className="lj-txt-axis">Tuổi</text>

        {/* ── X-axis tick marks (on zero line) + age labels at very bottom ── */}
        {xTicks.map(a => (
          <g key={a}>
            <line
              x1={toX(a, minAge, maxAge)} x2={toX(a, minAge, maxAge)}
              y1={zeroY - 4} y2={zeroY + 4}
              className="lj-tick-line" strokeWidth="1.2" />
            <text
              x={toX(a, minAge, maxAge)} y={H - 8}
              textAnchor="middle" fontSize="10"
              fontFamily="var(--font-display)" fontWeight="600"
              className="lj-txt-axis">{a}</text>
          </g>
        ))}

        {/* ── THE SINGLE LINE — drawn with two clip paths:
              Pass 1: full path, clipped to ABOVE zero → GREEN
              Pass 2: full path, clipped to BELOW zero → RED
              Both together = one continuous bi-colored line ── */}
        {pts.length > 1 && (
          <>
            <path d={singlePath} fill="none"
              stroke="var(--green)" strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round"
              clipPath="url(#lj-pos-clip)"
              className="lj-line-anim" />
            <path d={singlePath} fill="none"
              stroke="var(--red)" strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round"
              clipPath="url(#lj-neg-clip)"
              className="lj-line-anim" />
          </>
        )}

        {/* ── Dots + floating labels ──
              POSITIVE labels → rendered in PAD.top area (ABOVE +5 gridline = topY)
              NEGATIVE labels → rendered in PAD.bottom area (BELOW -5 gridline = botY)
              Each label: icon → name, connected to dot by a dashed line ── */}
        {pts.map((p, idx) => {
          const isPos = p.emotion >= 0;
          const col   = isPos ? 'var(--green)' : 'var(--red)';
          const isHov = hov === p.id;
          const alt   = idx % 2; // alternate offset to reduce overlap between neighbors

          let iconCY, nameY, connY1, connY2;

          if (isPos) {
            // Label stack (bottom→top): dashed line → icon → name
            // Place icon center at: topY - gap - alt*offset
            iconCY  = topY - 20 - alt * 26;
            nameY   = iconCY - 16;   // name text above icon
            connY1  = p.y - 6;       // top of dot
            connY2  = iconCY + 10;   // bottom of icon
          } else {
            // Label stack (top→bottom): dashed line → icon → name
            iconCY  = botY + 24 + alt * 26;
            nameY   = iconCY + 17;   // name text below icon
            connY1  = p.y + 6;       // bottom of dot
            connY2  = iconCY - 10;   // top of icon
          }

          return (
            <g key={p.id} className="lj-point-group"
              onClick={() => onClickPoint(p)}
              onMouseEnter={() => setHov(p.id)}
              onMouseLeave={() => setHov(null)}>

              {/* Dashed connector: dot ↔ label */}
              <line
                x1={p.x} y1={connY1}
                x2={p.x} y2={connY2}
                stroke={col} strokeWidth="1.2"
                strokeDasharray="3 3" opacity="0.75" />

              {/* Icon (emoji) */}
              <text
                x={p.x} y={iconCY + 6}
                textAnchor="middle" fontSize="15"
                style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {p.icon}
              </text>

              {/* Event name */}
              <text
                x={p.x} y={nameY}
                textAnchor="middle" fontSize="9" fontWeight="800"
                fontFamily="var(--font-display)" fill={col}
                style={{ pointerEvents: 'none' }}>
                {p.label}
              </text>

              {/* Emotion score (small, muted) */}
              <text
                x={p.x} y={isPos ? nameY - 11 : nameY + 12}
                textAnchor="middle" fontSize="8"
                fontFamily="var(--font-display)"
                className="lj-txt-axis"
                style={{ pointerEvents: 'none' }}>
                ({p.emotion > 0 ? `+${p.emotion}` : p.emotion})
              </text>

              {/* Dot */}
              <circle
                cx={p.x} cy={p.y}
                r={isHov ? 7 : 5}
                fill={col}
                stroke="var(--bg-secondary)" strokeWidth="2.5"
                className="lj-dot-main" />

              {/* Age label next to dot on hover */}
              {isHov && (
                <text x={p.x + 9} y={p.y - 2}
                  fontSize="9" fontFamily="var(--font-display)"
                  fontWeight="700" fill={col}
                  style={{ pointerEvents: 'none' }}>
                  {p.age} tuổi
                </text>
              )}
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
  const [modal,     setModal]     = useState(null);
  const [editTitle, setEditTitle] = useState(false);
  const [title,     setTitle]     = useState(
    () => localStorage.getItem('vl_journey_title') || 'My Life Journey'
  );

  const saveTitle = v => {
    const t = v.trim() || 'My Life Journey';
    setTitle(t);
    localStorage.setItem('vl_journey_title', t);
    setEditTitle(false);
  };

  const handleSave = useCallback(form => {
    if (modal === 'add') addEvent({ ...form, age: Number(form.age) });
    else updateEvent(modal.id, { ...form, age: Number(form.age) });
    setModal(null);
  }, [modal, addEvent, updateEvent]);

  const handleDelete = useCallback(id => {
    deleteEvent(id);
    setModal(null);
  }, [deleteEvent]);

  const pos = events.filter(e => e.emotion > 0).length;
  const neg = events.filter(e => e.emotion < 0).length;
  const avg = events.length
    ? (events.reduce((s, e) => s + e.emotion, 0) / events.length).toFixed(1)
    : 0;

  return (
    <div className="lj-page">
      <div className="container">

        {/* Header */}
        <div className="lj-header">
          <div className="lj-title-wrap">
            {editTitle ? (
              <input className="lj-title-input" defaultValue={title} autoFocus
                onBlur={e => saveTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveTitle(e.target.value)} />
            ) : (
              <h1 className="lj-title" onClick={() => setEditTitle(true)}>
                {title} <span className="lj-title-edit">✏️</span>
              </h1>
            )}
            <div className="lj-heart-icon">❤️</div>
            <p className="lj-subtitle">Những cột mốc đáng nhớ</p>
          </div>
          <div className="lj-header-actions">
            <button className="lj-btn-add" onClick={() => setModal('add')}>✨ Thêm cột mốc</button>
            <button className="lj-btn-reset"
              onClick={() => { if (window.confirm('Reset về dữ liệu mẫu?')) resetToDefault(); }}>
              🔄 Reset
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="lj-stats">
          <div className="lj-stat lj-stat-total">
            <span className="lj-stat-num">{events.length}</span>
            <span className="lj-stat-lbl">📍 Cột mốc</span>
          </div>
          <div className="lj-stat lj-stat-pos">
            <span className="lj-stat-num">{pos}</span>
            <span className="lj-stat-lbl">🟢 Tích cực</span>
          </div>
          <div className="lj-stat lj-stat-neg">
            <span className="lj-stat-num">{neg}</span>
            <span className="lj-stat-lbl">🔴 Tiêu cực</span>
          </div>
          <div className="lj-stat">
            <span className="lj-stat-num"
              style={{ color: Number(avg) >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {Number(avg) > 0 ? '+' : ''}{avg}
            </span>
            <span className="lj-stat-lbl">📊 TB cảm xúc</span>
          </div>
        </div>

        {/* Chart */}
        <div className="lj-chart-card">
          <Chart events={events} onClickPoint={setModal} />
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
            <span className="lj-legend-hint">💡 Click điểm để chỉnh sửa</span>
          </div>
        </div>

        {/* Event list */}
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
                  <div className="lj-ec-desc">{e.age} tuổi · {e.desc}</div>
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

        <p className="lj-quote">
          ❤️ "Mỗi trải nghiệm dù vui hay buồn đều là một phần tạo nên con người mình hôm nay."
        </p>
      </div>

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
