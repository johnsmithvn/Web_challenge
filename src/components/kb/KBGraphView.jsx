import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { deriveGraph, TYPE_GLYPHS } from '../../utils/kbDeriveUtils';

/**
 * KBGraphView — Force-directed graph visualization.
 * Canvas rendering + aside panel.
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

export default function KBGraphView({ articles, onOpenReader, inferTagLinks = true }) {
  const [graphMode, setGraphMode] = useState('all');
  const [focusNode, setFocusNode] = useState(null);
  const canvasRef = useRef(null);
  const simRef = useRef(null);
  const dragRef = useRef(null);

  // Derive graph
  const graph = useMemo(() => deriveGraph(articles, { inferTagLinks }), [articles, inferTagLinks]);

  // Filter edges by mode
  const visibleEdges = useMemo(() => {
    if (graphMode === 'all') return graph.edges;
    return graph.edges.filter(e => e.kind === graphMode);
  }, [graph.edges, graphMode]);

  // Hub articles (sorted by degree)
  const hubs = useMemo(() =>
    [...graph.nodes].sort((a, b) => b.degree - a.degree).slice(0, 8),
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

    // Init sim nodes
    const simNodes = graph.nodes.map(n => ({ ...n }));
    initPositions(simNodes, W, H);
    simRef.current = simNodes;
    let alpha = 1;
    let rafId;

    const draw = () => {
      if (dragRef.current === null) {
        stepSimulation(simNodes, visibleEdges, W, H, alpha);
        alpha *= ALPHA_DECAY;
        if (alpha < ALPHA_MIN) alpha = ALPHA_MIN;
      }

      ctx.clearRect(0, 0, W, H);
      const nodeMap = new Map(simNodes.map(n => [n.id, n]));

      // Draw edges
      visibleEdges.forEach(e => {
        const a = nodeMap.get(e.from);
        const b = nodeMap.get(e.to);
        if (!a || !b) return;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = e.kind === 'wiki' ? 'oklch(0.78 0.11 72 / 0.3)' : 'oklch(0.312 0.014 275 / 0.3)';
        ctx.lineWidth = e.kind === 'wiki' ? 1.5 : 1;
        if (e.kind === 'tag') ctx.setLineDash([4, 4]);
        else ctx.setLineDash([]);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // Draw nodes
      simNodes.forEach(n => {
        const r = 5 + Math.min(n.degree * 2, 12);
        const meta = TYPE_GLYPHS[n.type] || TYPE_GLYPHS.note;
        const hueStyle = getComputedStyle(canvas).getPropertyValue(meta.hueVar).trim() || '#888';

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = hueStyle;
        ctx.fill();

        // Focus ring
        if (n.id === focusNode) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 4, 0, Math.PI * 2);
          ctx.strokeStyle = 'oklch(0.78 0.11 72)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Label
        ctx.font = '500 13px "Spectral", Georgia, serif';
        ctx.fillStyle = 'oklch(0.92 0.008 275)';
        ctx.textAlign = 'center';
        const label = n.title.length > 20 ? n.title.slice(0, 18) + '…' : n.title;
        ctx.fillText(label, n.x, n.y + r + 14);
      });

      rafId = requestAnimationFrame(draw);
    };

    draw();

    // Click handler
    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      for (const n of simNodes) {
        const r = 5 + Math.min(n.degree * 2, 12);
        if (Math.hypot(mx - n.x, my - n.y) <= r + 4) {
          setFocusNode(prev => prev === n.id ? null : n.id);
          return;
        }
      }
      setFocusNode(null);
    };
    canvas.addEventListener('click', handleClick);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('click', handleClick);
    };
  }, [graph.nodes, visibleEdges, focusNode]);

  return (
    <div className="kb-graph-view" style={{ animation: 'kb-in .22s ease' }}>
      {/* Canvas */}
      <div className="kb-graph__canvas-wrap">
        <canvas ref={canvasRef} className="kb-graph__canvas" />

        {/* Overlay: stats + legend */}
        <div className="kb-graph__overlay-tl">
          <div className="kb-graph__stats">{graph.nodes.length} điểm · {visibleEdges.length} liên kết</div>
          <div className="kb-graph__legend">
            {Object.entries(TYPE_GLYPHS).map(([key, m]) => (
              <div key={key} className="kb-graph__legend-row">
                <span className="kb-badge__dot" style={{ background: `var(${m.hueVar})` }} />
                <span>{m.label}</span>
              </div>
            ))}
            <div className="kb-graph__legend-row"><span style={{ width: 12, height: 2, background: 'var(--kb-brass)', display: 'inline-block' }} /> wiki</div>
            <div className="kb-graph__legend-row"><span style={{ width: 12, height: 0, borderTop: '1px dashed var(--kb-line)', display: 'inline-block' }} /> thẻ chung</div>
          </div>
        </div>

        {/* Mode switcher */}
        <div className="kb-graph__overlay-br">
          <div className="kb-segmented kb-segmented--small">
            {MODE_ITEMS.map(m => (
              <button
                key={m.key}
                className={`kb-segmented__item${graphMode === m.key ? ' kb-segmented__item--active' : ''}`}
                onClick={() => setGraphMode(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hint */}
        <div className="kb-graph__overlay-bl">
          kéo node để sắp lại · bấm để xem · cuộn để phóng
        </div>
      </div>

      {/* Aside */}
      <aside className="kb-graph__aside">
        {focusArticle ? (
          <div style={{ animation: 'kb-in .22s ease' }}>
            <div className="kb-graph__aside-type" style={{ color: `var(${(TYPE_GLYPHS[focusArticle.type] || TYPE_GLYPHS.note).hueVar})` }}>
              {(TYPE_GLYPHS[focusArticle.type] || TYPE_GLYPHS.note).label}
            </div>
            <h2 className="kb-graph__aside-title">{focusArticle.title}</h2>
            <p className="kb-graph__aside-excerpt">{(focusArticle.body_text || '').slice(0, 160)}</p>

            {(focusArticle._tags || []).length > 0 && (
              <div className="kb-graph__aside-tags">
                {focusArticle._tags.map(t => (
                  <span key={t.id || t.name} className="kb-tag-chip">
                    <span className="kb-badge__dot" style={{ background: t.color || 'var(--kb-dim)' }} />
                    {t.name}
                  </span>
                ))}
              </div>
            )}

            <button className="kb-btn-ghost" style={{ marginTop: 14 }} onClick={() => onOpenReader(focusArticle)}>
              Mở bài này →
            </button>

            {neighbors.length > 0 && (
              <div className="kb-graph__neighbors">
                <h3 className="kb-graph__neighbors-title">Nối với · {neighbors.length}</h3>
                {neighbors.map(n => (
                  <button key={n.article.id} className="kb-graph__neighbor-row" onClick={() => setFocusNode(n.article.id)}>
                    <span className="kb-badge__dot" style={{ background: `var(${(TYPE_GLYPHS[n.article.type] || TYPE_GLYPHS.note).hueVar})` }} />
                    <span className="kb-graph__neighbor-title">{n.article.title}</span>
                    <span className="kb-graph__neighbor-via">{n.via === 'wiki' ? 'wiki' : 'thẻ'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <h2 className="kb-graph__aside-title">Bản đồ tri thức</h2>
            <p className="kb-graph__aside-excerpt">
              Mỗi chấm là một bài viết. Đường nối cho thấy các bài liên kết qua [[wiki-link]] hoặc có thẻ chung.
              Bấm vào chấm để xem chi tiết.
            </p>

            {hubs.length > 0 && (
              <div className="kb-graph__hubs">
                <h3 className="kb-graph__neighbors-title">Hub chính</h3>
                {hubs.filter(h => h.degree > 0).map(h => (
                  <button key={h.id} className="kb-graph__neighbor-row" onClick={() => setFocusNode(h.id)}>
                    <span className="kb-graph__hub-degree">{h.degree}</span>
                    <span className="kb-graph__neighbor-title">{h.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
