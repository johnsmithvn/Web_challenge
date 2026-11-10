import { useRef, useState } from 'react';
import FIGURE from '../../data/body-muscle-figure.json';
import MUSCLE_MAP from '../../data/body-muscles.json';

/**
 * Hình cơ thể 2D (SVG) dùng chung: Bản đồ cơ, Tổng quan, chi tiết bài tập.
 * Hình lấy từ react-body-highlighter v2.0.5 (MIT) — xem src/data/body-muscle-figure.json.
 * Màu từng nhóm do muscleFigureFills() (workoutLogic.js) tính.
 *
 * @param {'front'|'back'|'both'} side
 * @param {Object<string,string>} fills  id nhóm cơ → màu CSS; nhóm không có màu vẽ như thân nền
 * @param {Object<string,boolean>} glow  id → phát sáng
 * @param {string|null} selected
 * @param {(id:string)=>void} [onSelect]  không truyền = chỉ hiển thị
 * @param {(id:string)=>string} [labelOf]  tên cho tooltip / aria
 * @param {number|string} height  px hoặc chuỗi CSS
 */

const SIDE_LABEL = { front: 'TRƯỚC', back: 'SAU' };
const defaultLabel = id => MUSCLE_MAP[id]?.name || id;

// Gom polygon theo nhóm cơ; phần không thuộc 14 nhóm (đầu, cổ, gối…) thành thân nền
function groupParts(parts) {
  const base = [];
  const groups = new Map();
  parts.forEach(p => {
    if (!p.id) base.push(...p.points);
    else groups.set(p.id, [...(groups.get(p.id) || []), ...p.points]);
  });
  return { base, groups: [...groups.entries()] };
}

const SIDES = { front: groupParts(FIGURE.front), back: groupParts(FIGURE.back) };

export default function MuscleAnatomy2D({
  side = 'both',
  fills = {},
  glow = {},
  selected = null,
  onSelect,
  labelOf = defaultLabel,
  height = 260,
  className = ''
}) {
  const wrapRef = useRef(null);
  const tipRef = useRef(null);
  const [tipId, setTipId] = useState(null);
  const interactive = typeof onSelect === 'function';
  const sides = side === 'both' ? ['front', 'back'] : [side];

  const moveTip = (e, id) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (r && tipRef.current) {
      tipRef.current.style.left = `${e.clientX - r.left}px`;
      tipRef.current.style.top = `${e.clientY - r.top}px`;
    }
    if (tipId !== id) setTipId(id);
  };

  const litLabels = Object.keys(fills).map(labelOf).join(', ');

  return (
    <div
      ref={wrapRef}
      className={`body-fig${className ? ` ${className}` : ''}`}
      role={interactive ? undefined : 'img'}
      aria-label={interactive ? undefined : `Hình cơ thể${litLabels ? `: ${litLabels}` : ''}`}
    >
      {sides.map(s => (
        <figure key={s} className="body-fig-side">
          <svg
            className="body-fig-svg"
            viewBox={FIGURE.viewBox}
            style={{ height }}
            aria-hidden={interactive ? undefined : 'true'}
          >
            {SIDES[s].base.map((pts, i) => (
              <polygon key={i} className="body-fig-base" points={pts} />
            ))}
            {SIDES[s].groups.map(([id, polys]) => {
              const color = fills[id];
              const isSel = selected === id;
              const cls = `body-fig-muscle${color ? ' is-lit' : ''}${glow[id] ? ' is-glow' : ''}${isSel ? ' is-sel' : ''}`;
              const events = interactive ? {
                role: 'button',
                tabIndex: 0,
                'aria-label': labelOf(id),
                'aria-pressed': isSel,
                onClick: () => onSelect(id),
                onKeyDown: e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(id);
                  }
                },
                onMouseMove: e => moveTip(e, id),
                onMouseLeave: () => setTipId(null)
              } : {};
              return (
                <g key={id} className={cls} style={color ? { '--fig-c': color } : undefined} {...events}>
                  {polys.map((pts, i) => <polygon key={i} points={pts} />)}
                </g>
              );
            })}
          </svg>
          {side === 'both' && <figcaption className="body-fig-cap">{SIDE_LABEL[s]}</figcaption>}
        </figure>
      ))}
      {interactive && (
        <div ref={tipRef} className={`body-fig-tip${tipId ? ' is-on' : ''}`} aria-hidden="true">
          {tipId ? labelOf(tipId) : ''}
        </div>
      )}
    </div>
  );
}
