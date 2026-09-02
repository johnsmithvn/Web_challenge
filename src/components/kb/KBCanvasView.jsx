import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * KBCanvasView — whiteboard canvas with draggable nodes + edges.
 * Storage: localStorage (kb_canvas_nodes / kb_canvas_edges).
 */

const LS_NODES = 'kb_canvas_nodes';
const LS_EDGES = 'kb_canvas_edges';

function loadNodes() {
  try { return JSON.parse(localStorage.getItem(LS_NODES) || '[]'); }
  catch { return []; }
}
function loadEdges() {
  try { return JSON.parse(localStorage.getItem(LS_EDGES) || '[]'); }
  catch { return []; }
}
function saveNodes(nodes) { localStorage.setItem(LS_NODES, JSON.stringify(nodes)); }
function saveEdges(edges) { localStorage.setItem(LS_EDGES, JSON.stringify(edges)); }

let nextId = Date.now();
function genId() { return 'cn_' + (nextId++); }

const NODE_KINDS = [
  { key: 'idea',   label: 'Ý tưởng',   accent: 'oklch(0.78 0.11 72)' },
  { key: 'note',   label: 'Ghi chú',    accent: 'oklch(0.74 0.10 250)' },
  { key: 'task',   label: 'Nhiệm vụ',   accent: 'oklch(0.74 0.09 165)' },
  { key: 'ref',    label: 'Tham chiếu',  accent: 'oklch(0.74 0.10 300)' },
];

export default function KBCanvasView({ articles, onOpenReader }) {
  const [nodes, setNodes] = useState(loadNodes);
  const [edges, setEdges] = useState(loadEdges);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFrom, setConnectFrom] = useState(null);
  const containerRef = useRef(null);
  const dragRef = useRef(null);

  // Persist
  useEffect(() => { saveNodes(nodes); }, [nodes]);
  useEffect(() => { saveEdges(edges); }, [edges]);

  const addBlankNode = useCallback(() => {
    const kind = NODE_KINDS[0];
    setNodes(prev => [...prev, {
      id: genId(), kind: kind.key, text: '', accent: kind.accent,
      x: 100 + Math.random() * 300, y: 100 + Math.random() * 200,
      w: 220, ref: null,
    }]);
  }, []);

  const addFromLibrary = useCallback(() => {
    if (articles.length === 0) return;
    const a = articles[0]; // TODO: open picker
    setNodes(prev => [...prev, {
      id: genId(), kind: 'ref', text: a.title, accent: NODE_KINDS[3].accent,
      x: 150 + Math.random() * 300, y: 150 + Math.random() * 200,
      w: 240, ref: a.id,
    }]);
  }, [articles]);

  const deleteNode = useCallback((id) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setEdges(prev => prev.filter(e => e[0] !== id && e[1] !== id));
  }, []);

  const updateNodeText = useCallback((id, text) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, text } : n));
  }, []);

  // Drag handlers
  const handlePointerDown = useCallback((e, nodeId) => {
    if (connectMode) {
      if (!connectFrom) setConnectFrom(nodeId);
      else {
        if (connectFrom !== nodeId) {
          setEdges(prev => [...prev, [connectFrom, nodeId]]);
        }
        setConnectFrom(null);
      }
      return;
    }

    e.preventDefault();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const startX = e.clientX, startY = e.clientY;
    const origX = node.x, origY = node.y;
    dragRef.current = { nodeId, startX, startY, origX, origY };

    const handleMove = (ev) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setNodes(prev => prev.map(n =>
        n.id === dragRef.current.nodeId
          ? { ...n, x: dragRef.current.origX + dx, y: dragRef.current.origY + dy }
          : n
      ));
    };
    const handleUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [connectMode, connectFrom, nodes]);

  return (
    <div className="kb-canvas-view" style={{ animation: 'kb-in .22s ease' }}>
      {/* Toolbar */}
      <div className="kb-canvas__toolbar">
        <span className="kb-canvas__toolbar-label">Canvas</span>
        <div className="kb-canvas__toolbar-spacer" />
        <button className="kb-btn-ghost kb-btn-ghost--small" onClick={addBlankNode}>＋ Thẻ trắng</button>
        <button className="kb-btn-ghost kb-btn-ghost--small" onClick={addFromLibrary}>＋ Từ thư viện</button>
        <button
          className={`kb-btn-ghost kb-btn-ghost--small${connectMode ? ' kb-btn-ghost--active' : ''}`}
          onClick={() => { setConnectMode(v => !v); setConnectFrom(null); }}
        >
          {connectMode ? '✕ Hủy nối' : '⟷ Nối'}
        </button>
      </div>

      {/* Canvas area */}
      <div className="kb-canvas__area" ref={containerRef}>
        {/* Edges (SVG) */}
        <svg className="kb-canvas__svg">
          {edges.map(([fromId, toId], i) => {
            const from = nodes.find(n => n.id === fromId);
            const to = nodes.find(n => n.id === toId);
            if (!from || !to) return null;
            return (
              <line
                key={i}
                x1={from.x + (from.w || 220) / 2} y1={from.y + 30}
                x2={to.x + (to.w || 220) / 2} y2={to.y + 30}
                stroke="var(--kb-line)" strokeWidth={1.5}
              />
            );
          })}
        </svg>

        {/* Nodes */}
        {nodes.map(node => {
          const refArticle = node.ref ? articles.find(a => a.id === node.ref) : null;
          return (
            <div
              key={node.id}
              className="kb-canvas-node"
              style={{
                left: node.x, top: node.y, width: node.w || 220,
                borderLeftColor: node.accent,
              }}
              onPointerDown={e => handlePointerDown(e, node.id)}
            >
              <div className="kb-canvas-node__header">
                <span className="kb-canvas-node__dot" style={{ background: node.accent }} />
                <span className="kb-canvas-node__kind">
                  {(NODE_KINDS.find(k => k.key === node.kind) || NODE_KINDS[0]).label}
                </span>
                <button className="kb-canvas-node__close" onClick={() => deleteNode(node.id)}>×</button>
              </div>
              <div
                className="kb-canvas-node__text"
                contentEditable
                suppressContentEditableWarning
                onBlur={e => updateNodeText(node.id, e.currentTarget.textContent)}
              >
                {node.text}
              </div>
              {refArticle && (
                <button
                  className="kb-canvas-node__ref-link"
                  onClick={(e) => { e.stopPropagation(); onOpenReader(refArticle); }}
                >
                  đọc bài →
                </button>
              )}
            </div>
          );
        })}

        {/* Connect mode hint */}
        {connectMode && (
          <div className="kb-canvas__connect-hint">
            {connectFrom ? 'Bấm node đích để tạo nối' : 'Bấm node nguồn để bắt đầu'}
          </div>
        )}
      </div>
    </div>
  );
}
