import { useState, useEffect, useRef, useMemo } from 'react';
import { deriveGraph, itemPlainText } from '../../utils/kbDeriveUtils';
import { formatDate } from '../../utils/dateUtils';

/**
 * KBGraphView — Sơ đồ dạng bầu trời sao (mô phỏng lực).
 * Canvas + cột phải. Sao màu theo chủ đề, cỡ và độ sáng theo số đường nối.
 */

const MODE_ITEMS = [
  { key: 'all',  label: 'Tất cả' },
  { key: 'wiki', label: '[[wiki]]' },
  { key: 'tag',  label: 'Thẻ chung' },
];

/* ── Force simulation params (spec §8.6) ───────────────────── */
const REP_K = 2400;
const SPRING_K = 0.012;
const WIKI_WANT = 130;
const TAG_WANT = 190;
const CENTER_X = 0.0022;
const CENTER_Y = 0.0028;
const DAMPING = 0.86;
const ALPHA_DECAY = 0.988;
const ALPHA_MIN = 0.012;
const PAD = 42;

function initPositions(nodes, W, H) {
  const cx = W / 2, cy = H / 2;
  const rx = W * 0.22, ry = H * 0.28;
  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    n.x = cx + rx * Math.cos(angle);
    n.y = cy + ry * Math.sin(angle);
    n.vx = 0;
    n.vy = 0;
  });
}

function stepSimulation(nodes, edges, W, H, alpha) {
  // Repulsion
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      let dx = nodes[j].x - nodes[i].x;
      let dy = nodes[j].y - nodes[i].y;
      let d = Math.sqrt(dx * dx + dy * dy) || 1;
      let f = REP_K / (d * d);
      let fx = (dx / d) * f;
      let fy = (dy / d) * f;
      nodes[i].vx -= fx; nodes[i].vy -= fy;
      nodes[j].vx += fx; nodes[j].vy += fy;
    }
  }

  // Springs (edges)
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  edges.forEach(e => {
    const a = nodeMap.get(e.from);
    const b = nodeMap.get(e.to);
    if (!a || !b) return;
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let d = Math.sqrt(dx * dx + dy * dy) || 1;
    const want = e.kind === 'wiki' ? WIKI_WANT : TAG_WANT;
    let f = (d - want) * SPRING_K;
    let fx = (dx / d) * f;
    let fy = (dy / d) * f;
    a.vx += fx; a.vy += fy;
    b.vx -= fx; b.vy -= fy;
  });

  // Center pull
  nodes.forEach(n => {
    n.vx += (W / 2 - n.x) * CENTER_X;
    n.vy += (H / 2 - n.y) * CENTER_Y;
  });

  // Damping + update
  nodes.forEach(n => {
    n.vx *= DAMPING;
    n.vy *= DAMPING;
    n.x += n.vx * alpha * 3.2;
    n.y += n.vy * alpha * 3.2;
    // Clamp to bounds
    n.x = Math.max(PAD, Math.min(W - PAD, n.x));
    n.y = Math.max(PAD, Math.min(H - PAD, n.y));
  });
}

const starRadius = degree => (degree ? 2.6 + Math.min(degree, 6) * 0.75 : 1.8);

export default function KBGraphView({ articles, topics, onOpenReader, inferTagLinks = true }) {
  const [graphMode, setGraphMode] = useState('all');
  const [focusNode, setFocusNode] = useState(null);
  const topicMap = useMemo(() => new Map(topics.map(t => [t.id, t])), [topics]);
  const canvasRef = useRef(null);
  // Vòng vẽ đọc sao đang chọn qua ref: đổi lựa chọn không khởi động lại mô phỏng
  const focusRef = useRef(null);
  useEffect(() => { focusRef.current = focusNode; }, [focusNode]);

  // Derive graph
  const graph = useMemo(() => deriveGraph(articles, { inferTagLinks }), [articles, inferTagLinks]);

  // Filter edges by mode
  const visibleEdges = useMemo(() => {
    if (graphMode === 'all') return graph.edges;
    return graph.edges.filter(e => e.kind === graphMode);
  }, [graph.edges, graphMode]);

  // Sao sáng nhất (nhiều đường nối nhất)
  const hubs = useMemo(() =>
    [...graph.nodes].filter(n => n.degree > 0).sort((a, b) => b.degree - a.degree).slice(0, 6),
  [graph.nodes]);

  const focusArticle = useMemo(() =>
    focusNode ? articles.find(a => a.id === focusNode) : null,
  [focusNode, articles]);

  // Neighbors of focused node
  const neighbors = useMemo(() => {
    if (!focusNode) return [];
    return graph.edges
      .filter(e => e.from === focusNode || e.to === focusNode)
      .map(e => {
        const otherId = e.from === focusNode ? e.to : e.from;
        const other = articles.find(a => a.id === otherId);
        return other ? { article: other, via: e.kind } : null;
      })
      .filter(Boolean);
  }, [focusNode, graph.edges, articles]);

  // Simulation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || graph.nodes.length === 0) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    canvas.width = W * devicePixelRatio;
    canvas.height = H * devicePixelRatio;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // Màu theo token của trang (đổi theo nền sáng / tối)
    const css = getComputedStyle(canvas);
    const color = name => css.getPropertyValue(name).trim();
    const accent = color('--kb-accent');
    const gold = color('--kb-gold');
    const violet = color('--kb-violet');
    const tx = color('--kb-tx');
    const dim = color('--kb-dim');
    const font = color('--kb-font');

    const simNodes = graph.nodes.map(n => ({ ...n }));
    initPositions(simNodes, W, H);
    let alpha = 1;
    let rafId;

    const draw = () => {
      stepSimulation(simNodes, visibleEdges, W, H, alpha);
      alpha = Math.max(ALPHA_MIN, alpha * ALPHA_DECAY);

      const focus = focusRef.current;
      ctx.clearRect(0, 0, W, H);
      const nodeMap = new Map(simNodes.map(n => [n.id, n]));

      // Đường chòm sao: [[wiki]] liền, thẻ chung đứt
      visibleEdges.forEach(e => {
        const a = nodeMap.get(e.from);
        const b = nodeMap.get(e.to);
        if (!a || !b) return;
        const lit = focus && (e.from === focus || e.to === focus);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = lit ? violet : e.kind === 'wiki' ? accent : gold;
        ctx.globalAlpha = lit ? 0.95 : 0.5;
        ctx.lineWidth = lit ? 2 : 1.2;
        ctx.setLineDash(e.kind === 'tag' ? [4, 5] : []);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Sao: bài có nối sáng và to hơn, màu theo chủ đề
      simNodes.forEach(n => {
        const r = starRadius(n.degree);
        const fill = topicMap.get(n.topic_id)?.color || tx;

        if (n.id === focus) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 9, 0, Math.PI * 2);
          ctx.strokeStyle = violet;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        ctx.shadowBlur = n.degree ? 6 + r * 2 : 0;
        ctx.shadowColor = fill;
        ctx.globalAlpha = n.degree ? 1 : 0.6;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        ctx.font = `${n.id === focus ? 600 : 400} 12px ${font}`;
        ctx.fillStyle = n.id === focus ? tx : dim;
        ctx.textAlign = 'center';
        const label = n.title.length > 20 ? n.title.slice(0, 18) + '…' : n.title;
        ctx.fillText(label, n.x, n.y + r + 15);
      });

      rafId = requestAnimationFrame(draw);
    };

    draw();

    const handleClick = (e) => {
      const box = canvas.getBoundingClientRect();
      const mx = e.clientX - box.left;
      const my = e.clientY - box.top;
      const hit = simNodes.find(n => Math.hypot(mx - n.x, my - n.y) <= starRadius(n.degree) + 8);
      setFocusNode(prev => (hit && prev !== hit.id ? hit.id : null));
    };
    canvas.addEventListener('click', handleClick);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('click', handleClick);
    };
  }, [graph.nodes, visibleEdges, topicMap]);

  return (
    <div className="kb-graph-view" style={{ animation: 'kb-in .22s ease' }}>
      <div className="kb-graph__canvas-wrap">
        <canvas ref={canvasRef} className="kb-graph__canvas" />

        <div className="kb-graph__overlay-tl">
          <div className="kb-graph__stats"><b>{graph.nodes.length} sao</b> · {visibleEdges.length} đường nối</div>
          <div className="kb-graph__legend">
            <div className="kb-graph__legend-row"><span className="kb-graph__swatch kb-graph__swatch--wiki" />Liên kết [[wiki]]</div>
            <div className="kb-graph__legend-row"><span className="kb-graph__swatch kb-graph__swatch--tag" />Thẻ chung</div>
            <div className="kb-graph__legend-row"><span className="kb-graph__swatch kb-graph__swatch--lone" />Chưa nối</div>
          </div>
        </div>

        <div className="kb-graph__overlay-tr">
          <div className="kb-seg" role="group" aria-label="Kiểu nối">
            {MODE_ITEMS.map(m => (
              <button
                key={m.key}
                className={`kb-seg__item${graphMode === m.key ? ' is-active' : ''}`}
                onClick={() => setGraphMode(m.key)}
                aria-pressed={graphMode === m.key}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="kb-graph__overlay-bl">Bấm một sao để xem · bấm lần nữa để bỏ chọn</div>
      </div>

      <aside className="kb-graph__aside">
        {focusArticle ? (
          <div className="kb-graph__focus" style={{ animation: 'kb-in .22s ease' }}>
            <div className="kb-graph__aside-top">
              <span className="kb-graph__picked">Đang chọn</span>
              <button className="kb-icon-btn" onClick={() => setFocusNode(null)} title="Bỏ chọn" aria-label="Bỏ chọn">✕</button>
            </div>
            <div className="kb-graph__aside-type">
              <span style={{ color: topicMap.get(focusArticle.topic_id)?.color }}>{topicMap.get(focusArticle.topic_id)?.name || 'Chưa xếp'}</span>
              {` · ${formatDate(focusArticle.created_at)}`}
            </div>
            <h2 className="kb-graph__aside-title">{focusArticle.title}</h2>
            <p className="kb-graph__aside-excerpt">{itemPlainText(focusArticle).slice(0, 200)}</p>
            <button className="kb-btn-violet" onClick={() => onOpenReader(focusArticle)}>Mở bài ↗</button>

            {neighbors.length > 0 && (
              <div className="kb-graph__neighbors">
                <h3 className="kb-graph__neighbors-title">Nối với · {neighbors.length}</h3>
                {neighbors.map(n => (
                  <button key={n.article.id} className="kb-graph__neighbor-row" onClick={() => setFocusNode(n.article.id)}>
                    <span className="kb-dot" style={n.article._topic ? { '--kb-topic': n.article._topic.color } : undefined} />
                    <span className="kb-graph__neighbor-title">{n.article.title}</span>
                    <span className="kb-graph__neighbor-via">{n.via === 'wiki' ? '[[wiki]]' : 'thẻ chung'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <h2 className="kb-graph__aside-title">Bầu trời tri thức</h2>
            <p className="kb-graph__aside-excerpt">
              Mỗi ngôi sao là một bài. Đường nối là liên kết [[wiki]] hoặc thẻ chung — bài càng nhiều nối càng sáng.
            </p>
          </div>
        )}

        {hubs.length > 0 && (
          <div className="kb-graph__neighbors">
            <h3 className="kb-graph__neighbors-title">Sao sáng nhất</h3>
            {hubs.map(h => (
              <button key={h.id} className="kb-graph__neighbor-row" onClick={() => setFocusNode(h.id)}>
                <span className="kb-graph__neighbor-title">{h.title}</span>
                <span className="kb-graph__neighbor-via">{h.degree} nối</span>
              </button>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
