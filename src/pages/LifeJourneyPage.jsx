import { useState, useCallback } from 'react';
import { useLifeJourney } from '../hooks/useLifeJourney';
import './LifeJourneyPage.css';

// ── Shared helpers ─────────────────────────────────────────────────────
const toX = (age, lo, hi, padL, plotW) => padL + ((age - lo) / Math.max(hi - lo, 1)) * plotW;

/** Catmull-Rom smooth path through ordered points */
function catmull(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i-1, 0)];
    const p1 = pts[i];
    const p2 = pts[i+1];
    const p3 = pts[Math.min(i+2, pts.length-1)];
    d += ` C${p1.x+(p2.x-p0.x)/6},${p1.y+(p2.y-p0.y)/6},${p2.x-(p3.x-p1.x)/6},${p2.y-(p3.y-p1.y)/6},${p2.x},${p2.y}`;
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

// ── Chart constants ────────────────────────────────────────────────────
const TIER_H     = 85;   // vertical space per stagger tier
const MIN_X_GAP  = 130;  // X proximity threshold for tier escalation
const PAD_L      = 75;
const PAD_R      = 55;

// ── Chart component ────────────────────────────────────────────────────
function Chart({ events, onClickPoint, expanded }) {
  const [hov, setHov] = useState(null);
  if (!events.length) return <p style={{ textAlign:'center', color:'var(--text-muted)', padding:'3rem' }}>Chưa có cột mốc nào. Nhấn "✨ Thêm cột mốc"!</p>;

  // ── 1. Sort & age range ──
  const sorted = [...events].sort((a,b) => a.age-b.age || b.emotion-a.emotion);
  const ages   = sorted.map(e => e.age);
  const minAge = Math.max(0, Math.min(...ages) - 1);
  const maxAge = Math.max(...ages) + 2;
  const ageRange = maxAge - minAge || 1;

  // ── 2. Dynamic width ──
  const pxPerAge = expanded ? 100 : 40;
  const cW = Math.max(960, PAD_L + PAD_R + ageRange * pxPerAge);
  const PW = cW - PAD_L - PAD_R;

  // ── 3. Compute tiers (before chart height!) ──
  const tiers = new Array(sorted.length).fill(0);
  let maxPosTier = 0, maxNegTier = 0;
  if (expanded) {
    const prelimX = (age) => PAD_L + ((age - minAge) / Math.max(maxAge - minAge, 1)) * PW;
    const posIdxs = [], negIdxs = [];
    sorted.forEach((e, i) => (e.emotion >= 0 ? posIdxs : negIdxs).push(i));
    [posIdxs, negIdxs].forEach((group, gi) => {
      for (let g = 0; g < group.length; g++) {
        const ci = group[g];
        let tier = 0;
        for (let prev = g - 1; prev >= 0; prev--) {
          const pi = group[prev];
          if (Math.abs(prelimX(sorted[ci].age) - prelimX(sorted[pi].age)) < MIN_X_GAP) {
            tier = Math.max(tier, tiers[pi] + 1);
          }
        }
        tiers[ci] = tier;
        if (gi === 0) maxPosTier = Math.max(maxPosTier, tier);
        else maxNegTier = Math.max(maxNegTier, tier);
      }
    });
  }

  // ── 4. Dynamic height based on tier depth ──
  const IR   = expanded ? 20 : 15;
  const padT = expanded ? 100 + maxPosTier * TIER_H : 55;
  const padB = expanded ?  80 + maxNegTier * TIER_H : 80;
  const plotH = expanded ? 520 : 315;
  const cH   = padT + plotH + padB;

  const cToY = (e) => padT + ((5 - e) / 10) * plotH;
  const cToX = (age) => toX(age, minAge, maxAge, PAD_L, PW);

  // ── 5. Map points ──
  const pts  = sorted.map(e => ({ ...e, x: cToX(e.age), y: cToY(e.emotion) }));
  const path = catmull(pts);
  const zeroY = cToY(0), topY = cToY(5), botY = cToY(-5);
  const yTicks = [-5,-4,-3,-2,-1,0,1,2,3,4,5];
  const xTicks = Array.from({ length: ageRange + 1 }, (_, i) => minAge + i);

  // ── 6. Render ──
  return (
    <div className="lj-chart-wrapper">
      <svg viewBox={`0 0 ${cW} ${cH}`} className="lj-svg" style={{ minWidth: Math.max(620, cW * 0.65) }}>
        <defs>
          <clipPath id="lj-pos-clip"><rect x="0" y="0" width={cW} height={zeroY}/></clipPath>
          <clipPath id="lj-neg-clip"><rect x="0" y={zeroY} width={cW} height={cH - zeroY}/></clipPath>
        </defs>

        {/* Grid */}
        {yTicks.map(v => <line key={v} x1={PAD_L} x2={cW-PAD_R} y1={cToY(v)} y2={cToY(v)} className={v===0?'lj-axis-zero':'lj-grid-line'} strokeDasharray={v===0?undefined:'5 5'}/>)}
        {yTicks.map(v => <text key={v} x={PAD_L-12} y={cToY(v)+4} textAnchor="end" fontSize={expanded?14:10} fontFamily="var(--font-display)" fontWeight="700" className={v>0?'lj-txt-pos':v<0?'lj-txt-neg':'lj-txt-zero'}>{v>0?`+${v}`:v}</text>)}
        <text x={PAD_L-12} y={topY-6} textAnchor="end" fontSize={expanded?11:8} fontFamily="var(--font-display)" fontWeight="700" className="lj-txt-pos">RẤT VUI</text>
        <text x={PAD_L-12} y={botY+16} textAnchor="end" fontSize={expanded?11:8} fontFamily="var(--font-display)" fontWeight="700" className="lj-txt-neg">RẤT TỆ</text>
        <text x={PAD_L-55} y={(topY+botY)/2} textAnchor="middle" fontSize="8" fontFamily="var(--font-display)" className="lj-txt-axis" transform={`rotate(-90,${PAD_L-55},${(topY+botY)/2})`}>CẢM XÚC (-5 → +5)</text>

        {/* Axes */}
        <line x1={PAD_L} x2={PAD_L} y1={botY} y2={topY} className="lj-axis-side"/>
        <polygon points={`${PAD_L},${topY} ${PAD_L-4},${topY+8} ${PAD_L+4},${topY+8}`} className="lj-axis-arrow"/>
        <line x1={PAD_L} x2={cW-PAD_R-2} y1={zeroY} y2={zeroY} className="lj-axis-zero"/>
        <polygon points={`${cW-PAD_R},${zeroY} ${cW-PAD_R-8},${zeroY-4} ${cW-PAD_R-8},${zeroY+4}`} className="lj-axis-arrow"/>
        <text x={cW-PAD_R+6} y={zeroY+4} fontSize="11" fontFamily="var(--font-display)" fontWeight="700" className="lj-txt-axis">Tuổi</text>
        {xTicks.map(a => <g key={a}>
          <line x1={cToX(a)} x2={cToX(a)} y1={zeroY-3} y2={zeroY+3} className="lj-tick-line" strokeWidth="1"/>
          <text x={cToX(a)} y={botY+24} textAnchor="middle" fontSize={expanded?14:10} fontFamily="var(--font-display)" fontWeight="600" className="lj-txt-axis">{a}</text>
        </g>)}

        {/* Bi-color line */}
        {pts.length > 1 && <>
          <path d={path} fill="none" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" clipPath="url(#lj-pos-clip)" className="lj-line-anim"/>
          <path d={path} fill="none" stroke="var(--red)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" clipPath="url(#lj-neg-clip)" className="lj-line-anim"/>
        </>}

        {/* ── POINTS ── */}
        {pts.map((p, idx) => {
          const isPos = p.emotion >= 0;
          const col   = isPos ? 'var(--green)' : 'var(--red)';
          const isHov = hov === p.id;

          if (!expanded) {
            /* COLLAPSE: dot + hover tooltip */
            const ttA = isPos ? p.y - 65 : p.y + 25;
            return (
              <g key={p.id} className="lj-point-group" onClick={() => onClickPoint(p)} onMouseEnter={() => setHov(p.id)} onMouseLeave={() => setHov(null)}>
                <circle cx={p.x} cy={p.y} r={isHov?9:5} fill={col} stroke="var(--bg-secondary)" strokeWidth="2.5" className="lj-dot-main"/>
                {isHov && <>
                  <rect x={p.x-60} y={ttA} width="120" height="48" rx="8" fill="var(--bg-secondary)" stroke={col} strokeWidth="1.5" opacity="0.97"/>
                  <text x={p.x} y={ttA+17} textAnchor="middle" fontSize="12" fontWeight="800" fontFamily="var(--font-display)" fill={col}>{p.icon} {p.age} tuổi</text>
                  <text x={p.x} y={ttA+31} textAnchor="middle" fontSize="9" fontWeight="600" fontFamily="var(--font-display)" className="lj-txt-title">{p.label}</text>
                  <text x={p.x} y={ttA+43} textAnchor="middle" fontSize="9" fontWeight="700" fontFamily="var(--font-display)" fill={col}>Cảm xúc: {p.emotion>0?`+${p.emotion}`:p.emotion}</text>
                </>}
              </g>
            );
          }

          /* EXPAND: tier-staggered labels — chart height already accounts for tiers */
          const tier = tiers[idx];
          const off  = 24 + tier * TIER_H;
          let iconCY, ageY, nameY, scoreY;
          if (isPos) {
            iconCY = p.y - off - IR;
            ageY   = iconCY - IR - 10;
            nameY  = ageY - 16;
            scoreY = nameY - 14;
          } else {
            iconCY = p.y + off + IR;
            ageY   = iconCY + IR + 18;
            nameY  = ageY + 16;
            scoreY = nameY + 14;
          }
          const cy1 = isPos ? p.y - 6 : p.y + 6;
          const cy2 = isPos ? iconCY + IR + 2 : iconCY - IR - 2;

          return (
            <g key={p.id} className="lj-point-group" onClick={() => onClickPoint(p)} onMouseEnter={() => setHov(p.id)} onMouseLeave={() => setHov(null)}>
              <line x1={p.x} y1={cy1} x2={p.x} y2={cy2} stroke={col} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5"/>
              <circle cx={p.x} cy={iconCY} r={IR} fill={isPos?'rgba(0,200,100,0.15)':'rgba(220,60,60,0.15)'} stroke={col} strokeWidth="1.5" opacity="0.9"/>
              <text x={p.x} y={iconCY+7} textAnchor="middle" fontSize="24" style={{pointerEvents:'none',userSelect:'none'}}>{p.icon}</text>
              <text x={p.x} y={ageY} textAnchor="middle" fontSize="16" fontWeight="800" fontFamily="var(--font-display)" fill={col} style={{pointerEvents:'none'}}>{p.age} tuổi</text>
              <text x={p.x} y={nameY} textAnchor="middle" fontSize="13" fontWeight="600" fontFamily="var(--font-display)" className="lj-txt-axis" style={{pointerEvents:'none'}}>{p.label}</text>
              <text x={p.x} y={scoreY} textAnchor="middle" fontSize="12" fontWeight="700" fontFamily="var(--font-display)" fill={col} style={{pointerEvents:'none'}}>({p.emotion>0?`+${p.emotion}`:p.emotion})</text>
              <circle cx={p.x} cy={p.y} r={isHov?8:5} fill={col} stroke="var(--bg-secondary)" strokeWidth="2.5" className="lj-dot-main"/>
            </g>
          );
        })}

        {/* Legend */}
        <g transform={`translate(${PAD_L},${cH-14})`}>
          <line x1="0" x2="22" y1="0" y2="0" stroke="var(--green)" strokeWidth="3" strokeLinecap="round"/>
          <circle cx="11" cy="0" r="3" fill="var(--green)"/>
          <text x="28" y="4" fontSize="9" fontFamily="var(--font-display)" fontWeight="600" className="lj-txt-axis">Khoảng thời gian tích cực</text>
          <line x1="190" x2="212" y1="0" y2="0" stroke="var(--red)" strokeWidth="3" strokeLinecap="round"/>
          <circle cx="201" cy="0" r="3" fill="var(--red)"/>
          <text x="218" y="4" fontSize="9" fontFamily="var(--font-display)" fontWeight="600" className="lj-txt-axis">Khoảng thời gian tiêu cực</text>
          <text x={PW} y="4" textAnchor="end" fontSize="8" fontStyle="italic" fontFamily="var(--font-display)" className="lj-txt-axis">💡 Click điểm để chỉnh sửa</text>
        </g>
      </svg>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────
export default function LifeJourneyPage() {
  const { events, addEvent, updateEvent, deleteEvent, resetToDefault } = useLifeJourney();
  const [modal,     setModal]     = useState(null);
  const [expanded,  setExpanded]  = useState(false);
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
          <div className="lj-chart-toolbar">
            <button className="lj-btn-toggle" onClick={() => setExpanded(e => !e)}>
              {expanded ? '◀ Thu gọn' : '▶ Xem chi tiết'}
            </button>
          </div>
          <Chart events={events} onClickPoint={setModal} expanded={expanded} />
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
