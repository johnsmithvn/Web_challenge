import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCollections } from '../hooks/useCollections';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import '../styles/collect.css';

const TiptapEditor   = lazy(() => import('../components/TiptapEditor'));
const TiptapReadOnly = lazy(() => import('../components/TiptapEditor').then(m => ({ default: m.TiptapReadOnly })));
import { ShortcutsModal, MD_SHORTCUT_SECTIONS } from '../components/TiptapEditor';

/* ── Constants ─────────────────────────────────────────────── */
const TYPE_META = {
  note:  { emoji: '📝', label: 'Ghi chú',   color: '#8b5cf6' },
  link:  { emoji: '🔗', label: 'Link',       color: '#06b6d4' },
  quote: { emoji: '💬', label: 'Trích dẫn', color: '#f59e0b' },
  learn: { emoji: '📚', label: 'Học',        color: '#22c55e' },
  idea:  { emoji: '💡', label: 'Ý tưởng',   color: '#f97316' },
  want:  { emoji: '🛒', label: 'Muốn mua',  color: '#f43f5e' },
};

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'alpha',  label: 'A → Z' },
];

const EMPTY_DRAFT = { title: '', body: '', body_text: '', tags: [], type: 'note', url: '', content_format: 'markdown' };
const EDITOR_MODE_KEY = 'kb_editor_mode';

/* ── Helpers ──────────────────────────────────────────────── */
function readTime(text = '') {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function markdownToPlainText(md = '') {
  return md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.+?)\]\(.*?\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>|]/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


// safeHostname — guard against invalid/relative URLs crashing new URL()
function safeHostname(url) {
  try { return new URL(url).hostname; }
  catch { return url.replace(/^https?:\/\//, '').split('/')[0] || url; }
}

function getAllTags(items) {
  const set = new Set();
  items.forEach(it => (it.tags || []).forEach(t => set.add(t)));
  return [...set].sort();
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Auto-detect Tiptap JSON — fallback when content_format column not yet migrated
function isTiptapBody(item) {
  if (item.content_format === 'tiptap') return true;
  if (item.content_format === 'markdown') return false;
  // Detect from body shape: Tiptap JSON starts with {"type":"doc"
  const b = (item.body || '').trimStart();
  return b.startsWith('{"type":"doc"');
}

/* ── TagInput ─────────────────────────────────────────────── */
function TagInput({ tags = [], onChange, suggestions = [] }) {
  const [input, setInput]   = useState('');
  const [open, setOpen]     = useState(false);
  const [cursor, setCursor] = useState(-1);
  const containerRef        = useRef(null);

  // Filter: match input text, exclude already-added tags
  const filtered = useMemo(() => {
    const q = input.toLowerCase().trim();
    return suggestions
      .filter(t => !tags.includes(t) && (!q || t.includes(q)))
      .slice(0, 10);
  }, [suggestions, tags, input]);

  const slugify = (v) => v.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

  const addTag = useCallback((val) => {
    const v = slugify(val);
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput('');
    setOpen(false);
    setCursor(-1);
  }, [tags, onChange]);

  const onKey = (e) => {
    if (e.key === 'ArrowDown')  { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - (showNew ? 0 : 1))); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, -1)); }
    else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (cursor >= 0 && cursor < filtered.length) addTag(filtered[cursor]);
      else if (input.trim()) addTag(input);
    }
    else if (e.key === 'Escape')    { setOpen(false); setCursor(-1); }
    else if (e.key === 'Backspace' && !input && tags.length) onChange(tags.slice(0, -1));
  };

  // Close on outside click
  useEffect(() => {
    const h = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) { setOpen(false); setCursor(-1); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const showNew = input.trim().length > 0 && !suggestions.includes(slugify(input));

  return (
    <div className="kb-tag-input" ref={containerRef}>
      {tags.map(t => (
        <span key={t} className="kb-tag-chip kb-tag-chip--edit">
          #{t}
          <button onMouseDown={e => { e.preventDefault(); onChange(tags.filter(x => x !== t)); }} className="kb-tag-chip__rm">×</button>
        </span>
      ))}
      <input
        className="kb-tag-input__field"
        value={input}
        onChange={e => { setInput(e.target.value); setOpen(true); setCursor(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder={tags.length ? '' : 'Thêm tag...'}
        autoComplete="off"
      />

      {/* Suggestions dropdown */}
      {open && (filtered.length > 0 || showNew) && (
        <div className="kb-tag-dropdown">
          {filtered.map((t, i) => (
            <button
              key={t}
              className={`kb-tag-dropdown__item${cursor === i ? ' kb-tag-dropdown__item--active' : ''}`}
              onMouseDown={e => { e.preventDefault(); addTag(t); }}
              onMouseEnter={() => setCursor(i)}
            >
              <span className="kb-tag-dropdown__hash">#</span>{t}
            </button>
          ))}
          {showNew && (
            <button
              className={`kb-tag-dropdown__item kb-tag-dropdown__item--new${cursor === filtered.length ? ' kb-tag-dropdown__item--active' : ''}`}
              onMouseDown={e => { e.preventDefault(); addTag(input); }}
              onMouseEnter={() => setCursor(filtered.length)}
            >
              ✚ Tạo tag mới "<strong>{slugify(input)}</strong>"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── TableOfContents ──────────────────────────────────────── */
function extractHeadings(text) {
  const lines = (text || '').split('\n');
  const result = [];
  let inCode = false;
  for (const line of lines) {
    if (line.startsWith('```')) { inCode = !inCode; continue; }
    if (inCode) continue;
    const m = line.match(/^(#{1,3})\s+(.+)/);
    if (m) result.push({ level: m[1].length, text: m[2] });
  }
  return result;
}

function TableOfContents({ content }) {
  const headings = useMemo(() => extractHeadings(content), [content]);
  if (headings.length < 2) return null;

  return (
    <nav className="kb-toc">
      <div className="kb-toc__title">Mục lục</div>
      {headings.map((h, i) => (
        <a
          key={i}
          href={`#${slugify(h.text)}`}
          className={`kb-toc__item kb-toc__item--h${h.level}`}
          onClick={e => {
            e.preventDefault();
            const target = document.getElementById(slugify(h.text));
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          {h.text}
        </a>
      ))}
    </nav>
  );
}

/* ── ArticleCard ──────────────────────────────────────────── */
function ArticleCard({ item, onClick }) {
  const meta      = TYPE_META[item.type] || TYPE_META.note;
  const isTiptap  = isTiptapBody(item);
  // Use body_text (plain text) for cards — avoids showing raw JSON for Tiptap articles
  const plainText = item.body_text || (isTiptap ? '' : item.body) || '';
  const mins      = item.word_count ? Math.max(1, Math.ceil(item.word_count / 200)) : readTime(plainText);
  const excp      = plainText.trim().slice(0, 180);

  return (
    <article className="kb-card" onClick={() => onClick(item)} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick(item)}>
      <div className="kb-card__left">
        <span className="kb-card__emoji" style={{ '--type-color': meta.color }}>{meta.emoji}</span>
      </div>
      <div className="kb-card__body">
        <div className="kb-card__meta-top">
          <span className="kb-card__type" style={{ color: meta.color }}>{meta.label}</span>
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
               className="kb-card__url" onClick={e => e.stopPropagation()}>
              🔗 {safeHostname(item.url)}
            </a>
          )}
          <span className="kb-card__date">{fmtDate(item.created_at)}</span>
        </div>
        <h3 className="kb-card__title">{item.title}</h3>
        {excp && <p className="kb-card__excerpt">{excp}{plainText.length > 180 ? '…' : ''}</p>}
        <div className="kb-card__footer">
          <div className="kb-card__tags">
            {(item.tags || []).map(t => <span key={t} className="kb-tag-chip">#{t}</span>)}
          </div>
          <span className="kb-card__readtime">⏱ {mins} phút đọc</span>
        </div>
      </div>
    </article>
  );
}

/* ── Heading slug (must match extractHeadings) ────────────── */
function slugify(text) {
  return String(text).toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
}

/* Custom ReactMarkdown components — injects id attrs for TOC */
const mdComponents = {
  h1: ({ children }) => { const id = slugify(React.Children.toArray(children).join('')); return <h1 id={id}>{children}</h1>; },
  h2: ({ children }) => { const id = slugify(React.Children.toArray(children).join('')); return <h2 id={id}>{children}</h2>; },
  h3: ({ children }) => { const id = slugify(React.Children.toArray(children).join('')); return <h3 id={id}>{children}</h3>; },
  h4: ({ children }) => { const id = slugify(React.Children.toArray(children).join('')); return <h4 id={id}>{children}</h4>; },
};

/* ── ReaderView ───────────────────────────────────────────── */
function ReaderView({ item, onEdit, onDelete, onBack }) {
  const meta    = TYPE_META[item.type] || TYPE_META.note;
  const isTiptap = isTiptapBody(item);
  const mins    = item.word_count ? Math.max(1, Math.ceil(item.word_count / 200)) : readTime(item.body);

  return (
    <div className="kb-reader">
      {/* Header bar */}
      <div className="kb-reader__bar">
        <button className="kb-back-btn" onClick={onBack}>← Quay lại</button>
        <div className="kb-reader__actions">
          <button className="btn btn-ghost kb-action-btn" onClick={onEdit}>✏️ Sửa</button>
          <button className="btn btn-ghost kb-action-btn kb-action-btn--danger" onClick={onDelete}>🗑 Xóa</button>
        </div>
      </div>

      <div className="kb-reader__layout">
        {/* Main content */}
        <div className="kb-reader__main">
          <div className="kb-reader__hero">
            <span className="kb-reader__emoji" style={{ '--type-color': meta.color }}>{meta.emoji}</span>
            <h1 className="kb-reader__title">{item.title}</h1>
            <div className="kb-reader__meta">
              <span style={{ color: meta.color }}>{meta.label}</span>
              <span>·</span>
              <span>{fmtDate(item.updated_at || item.created_at)}</span>
              <span>·</span>
              <span>⏱ {mins} phút đọc</span>
              {isTiptap && <span className="kb-format-badge">🎨 Visual</span>}
            </div>
            {(item.tags || []).length > 0 && (
              <div className="kb-reader__tags">
                {item.tags.map(t => <span key={t} className="kb-tag-chip">#{t}</span>)}
              </div>
            )}
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="kb-reader__source">
                🔗 Xem nguồn: {item.url}
              </a>
            )}
          </div>

          <div className="kb-reader__divider" />

          {/* Body — auto-detect format */}
          {isTiptap ? (
            <Suspense fallback={<div className="kb-loading">Đang tải nội dung...</div>}>
              <TiptapReadOnly content={item.body} />
            </Suspense>
          ) : (
            <div className="kb-prose">
              {item.body ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{item.body}</ReactMarkdown>
              ) : (
                <p className="kb-prose__empty">Bài viết này chưa có nội dung. Nhấn ✏️ Sửa để thêm.</p>
              )}
            </div>
          )}
        </div>

        {/* TOC sidebar — only for markdown (tiptap has its own structure) */}
        {!isTiptap && <TableOfContents content={item.body} />}
      </div>
    </div>
  );
}

/* ── Custom Toolbar Button ────────────────────────────────── */
function ToolbarBtn({ label, title, onClick }) {
  return (
    <button type="button" className="kb-tb-btn" title={title} onMouseDown={e => { e.preventDefault(); onClick(); }}>
      {label}
    </button>
  );
}

/* ── MarkdownEditor (custom split-pane) ─────────────────── */
function MarkdownEditor({ value, onChange, onSave }) {
  const ref = useCallback(node => { if (node) node.focus(); }, []);
  const [mdShortcutsOpen, setMdShortcutsOpen] = useState(false);

  const insert = useCallback((before, after = '', placeholder = '') => {
    const ta = document.getElementById('kb-md-textarea');
    if (!ta) return;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const sel   = ta.value.slice(start, end) || placeholder;
    const next  = ta.value.slice(0, start) + before + sel + after + ta.value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start + before.length;
      ta.selectionEnd   = start + before.length + sel.length;
    });
  }, [onChange]);

  const insertLine = useCallback((prefix) => {
    const ta = document.getElementById('kb-md-textarea');
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1;
    const next = ta.value.slice(0, lineStart) + prefix + ta.value.slice(lineStart);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + prefix.length;
    });
  }, [onChange]);

  /* ── Keyboard shortcuts for Markdown textarea ── */
  const handleKeyDown = useCallback((e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;

    // Ctrl+S → save
    if (e.key === 's') { e.preventDefault(); if (onSave) onSave(); return; }
    // Ctrl+P → block print
    if (e.key === 'p') { e.preventDefault(); return; }
    // Ctrl+. → toggle shortcuts
    if (e.key === '.') { e.preventDefault(); setMdShortcutsOpen(v => !v); return; }
    // Ctrl+B → bold
    if (e.key === 'b') { e.preventDefault(); insert('**', '**', 'bold'); return; }
    // Ctrl+I → italic
    if (e.key === 'i') { e.preventDefault(); insert('*', '*', 'italic'); return; }
    // Ctrl+E → inline code
    if (e.key === 'e') { e.preventDefault(); insert('`', '`', 'code'); return; }
    // Ctrl+K → link
    if (e.key === 'k') { e.preventDefault(); insert('[', '](url)', 'link text'); return; }
    // Ctrl+1/2/3 → heading
    if (e.key === '1') { e.preventDefault(); insertLine('# '); return; }
    if (e.key === '2') { e.preventDefault(); insertLine('## '); return; }
    if (e.key === '3') { e.preventDefault(); insertLine('### '); return; }
    // Ctrl+Shift combos
    if (e.shiftKey) {
      if (e.key === 'X' || e.key === 'x') { e.preventDefault(); insert('~~', '~~', 'text'); return; }
      if (e.key === 'B' || e.key === 'b') { e.preventDefault(); insertLine('> '); return; }
      if (e.key === 'C' || e.key === 'c') { e.preventDefault(); insert('\n```\n', '\n```\n', 'code'); return; }
      if (e.key === '8' || e.code === 'Digit8') { e.preventDefault(); insertLine('- '); return; }
      if (e.key === '7' || e.code === 'Digit7') { e.preventDefault(); insertLine('1. '); return; }
      if (e.key === '9' || e.code === 'Digit9') { e.preventDefault(); insertLine('- [ ] '); return; }
      if (e.key === 'Z' || e.key === 'z') return; // let browser handle redo
    }
  }, [insert, insertLine, onSave]);

  const tools = [
    { label: 'B',   title: 'Bold (Ctrl+B)',       action: () => insert('**', '**', 'bold') },
    { label: 'I',   title: 'Italic (Ctrl+I)',     action: () => insert('*', '*', 'italic') },
    { label: 'S',   title: 'Strike (Ctrl+Shift+X)', action: () => insert('~~', '~~', 'text') },
    { label: 'H1',  title: 'Heading 1 (Ctrl+1)',  action: () => insertLine('# ') },
    { label: 'H2',  title: 'Heading 2 (Ctrl+2)',  action: () => insertLine('## ') },
    { label: 'H3',  title: 'Heading 3 (Ctrl+3)',  action: () => insertLine('### ') },
    { label: '`',   title: 'Code (Ctrl+E)',       action: () => insert('`', '`', 'code') },
    { label: '```', title: 'Code Block (Ctrl+Shift+C)', action: () => insert('\n```\n', '\n```\n', 'code here') },
    { label: '>',   title: 'Blockquote (Ctrl+Shift+B)', action: () => insertLine('> ') },
    { label: '—',   title: 'Divider',    action: () => { const ta = document.getElementById('kb-md-textarea'); if (!ta) return; const s = ta.selectionStart; const next = ta.value.slice(0,s)+'\n---\n'+ta.value.slice(s); onChange(next); } },
    { label: '[ ]', title: 'Task list (Ctrl+Shift+9)',  action: () => insertLine('- [ ] ') },
    { label: '•',   title: 'Bullet list (Ctrl+Shift+8)',action: () => insertLine('- ') },
    { label: '1.',  title: 'Ordered list (Ctrl+Shift+7)',action: () => insertLine('1. ') },
    { label: '🔗',  title: 'Link (Ctrl+K)',       action: () => insert('[', '](url)', 'link text') },
  ];

  return (
    <div className="kb-split">
      {/* Toolbar */}
      <div className="kb-tb">
        {tools.map((t, i) => (
          <ToolbarBtn key={i} label={t.label} title={t.title} onClick={t.action} />
        ))}
        <span className="kb-tb-divider" />
        <ToolbarBtn label="⌨" title="Phím tắt (Ctrl+.)" onClick={() => setMdShortcutsOpen(v => !v)} />
      </div>

      {/* Panes */}
      <div className="kb-split__panes">
        <div className="kb-split__pane kb-split__pane--write">
          <div className="kb-split__label">✍️ Viết</div>
          <textarea
            id="kb-md-textarea"
            ref={ref}
            className="kb-split__textarea"
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Bắt đầu viết bằng Markdown... (Ctrl+. xem phím tắt)"
            spellCheck={false}
          />
        </div>

        <div className="kb-split__pane kb-split__pane--preview">
          <div className="kb-split__label">👁 Preview</div>
          <div className="kb-prose kb-split__preview">
            {value ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {value}
              </ReactMarkdown>
            ) : (
              <p className="kb-prose__empty">Preview sẽ hiện ở đây...</p>
            )}
          </div>
        </div>
      </div>

      <ShortcutsModal open={mdShortcutsOpen} onClose={() => setMdShortcutsOpen(false)} sections={MD_SHORTCUT_SECTIONS} />
    </div>
  );
}


/* ── EditorView ───────────────────────────────────────────── */
function EditorView({ initial, onSave, onCancel, isSaving, suggestions = [], isNew = false, onConfirmSwitch }) {
  const savedMode = localStorage.getItem(EDITOR_MODE_KEY) || 'markdown';
  const initialFormat = isNew ? savedMode : (initial?.content_format || 'markdown');

  const [draft, setDraft] = useState(() => ({
    ...EMPTY_DRAFT,
    ...initial,
    content_format: initialFormat,
  }));
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  // body_text for stats display
  const bodyText = draft.content_format === 'markdown'
    ? markdownToPlainText(draft.body)
    : (draft.body_text || '');
  // Tiptap: use accurate word count from CharacterCount extension
  const wordCount = draft.content_format === 'tiptap'
    ? (draft._tiptapWordCount || 0)
    : bodyText.trim().split(/\s+/).filter(Boolean).length;
  const mins      = Math.max(1, Math.ceil(wordCount / 200));
  const canSave   = draft.title.trim().length > 0;

  const switchMode = async (mode) => {
    if (!isNew) return;
    if (draft.body && mode !== draft.content_format) {
      const ok = await onConfirmSwitch?.();
      if (!ok) return;
      set('body', '');
      set('body_text', '');
    }
    localStorage.setItem(EDITOR_MODE_KEY, mode);
    set('content_format', mode);
  };

  const handleSaveDraft = () => {
    const text = draft.content_format === 'markdown'
      ? markdownToPlainText(draft.body)
      : draft.body_text;
    const wc   = text.trim().split(/\s+/).filter(Boolean).length;
    onSave({ ...draft, body_text: text, word_count: wc });
  };

  return (
    <div className="kb-editor">
      {/* Top bar */}
      <div className="kb-editor__bar">
        <button className="kb-back-btn" onClick={onCancel}>← Hủy</button>
        <div className="kb-editor__stats">
          <span>{wordCount} từ · {mins} phút đọc</span>
        </div>
        <button
          className="btn btn-primary kb-save-btn"
          onClick={handleSaveDraft}
          disabled={!canSave || isSaving}
        >
          {isSaving ? '⏳ Đang lưu...' : '💾 Lưu'}
        </button>
      </div>

      {/* Meta row */}
      <div className="kb-editor__meta">
        <select className="kb-type-select" value={draft.type} onChange={e => set('type', e.target.value)}>
          {Object.entries(TYPE_META).map(([k, v]) => (
            <option key={k} value={k}>{v.emoji} {v.label}</option>
          ))}
        </select>
        <input
          className="kb-editor__title"
          placeholder="Tiêu đề bài viết..."
          value={draft.title}
          onChange={e => set('title', e.target.value)}
          maxLength={200}
        />
      </div>

      {/* Tags + URL + Mode toggle row */}
      <div className="kb-editor__sub-meta">
        <div style={{ flex: 1 }}>
          <TagInput tags={draft.tags} onChange={v => set('tags', v)} suggestions={suggestions} />
        </div>
        <input
          className="kb-editor__url"
          placeholder="URL nguồn (tùy chọn)"
          value={draft.url || ''}
          onChange={e => set('url', e.target.value)}
        />
        {/* Mode toggle — only for new articles */}
        {isNew && (
          <div className="kb-mode-toggle">
            <button
              className={`kb-mode-btn${draft.content_format === 'markdown' ? ' kb-mode-btn--active' : ''}`}
              onClick={() => switchMode('markdown')}
              title="Markdown editor"
            >✍️ Markdown</button>
            <button
              className={`kb-mode-btn${draft.content_format === 'tiptap' ? ' kb-mode-btn--active' : ''}`}
              onClick={() => switchMode('tiptap')}
              title="Visual editor (WYSIWYG)"
            >🎨 Visual</button>
          </div>
        )}
      </div>

      {/* Body — conditional on content_format */}
      <div className="kb-editor__body">
        {draft.content_format === 'tiptap' ? (
          <Suspense fallback={<div className="kb-loading">Đang tải editor...</div>}>
            <TiptapEditor
              value={draft.body}
              onChange={(json, text, words) => setDraft(d => ({ ...d, body: json, body_text: text, _tiptapWordCount: words || 0 }))}
              onSave={handleSaveDraft}
            />
          </Suspense>
        ) : (
          <MarkdownEditor value={draft.body} onChange={v => set('body', v)} onSave={handleSaveDraft} />
        )}
      </div>
    </div>
  );
}

/* ── Main CollectPage ─────────────────────────────────────── */
export default function CollectPage() {
  const { user } = useAuth();
  const { items, isLoading, fetchItems, addItem, updateItem, deleteItem } = useCollections();
  const { confirm, ConfirmModal } = useConfirm();

  const [view, setView]         = useState('list');
  const [selected, setSelected] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Filters
  const [search, setSearch]     = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [sort, setSort]         = useState('newest');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    if (user) fetchItems({});
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Derived data ─────────────────── */
  const allTags = useMemo(() => getAllTags(items.filter(i => i.type !== 'inbox')), [items]);

  const filtered = useMemo(() => {
    let list = items.filter(i => i.type !== 'inbox' && i.status !== 'archived');

    if (typeFilter) list = list.filter(i => i.type === typeFilter);
    if (activeTag)  list = list.filter(i => (i.tags || []).includes(activeTag));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        i.title.toLowerCase().includes(q) ||
        (i.body || '').toLowerCase().includes(q) ||
        (i.tags || []).some(t => t.includes(q))
      );
    }

    if (sort === 'newest') list = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (sort === 'oldest') list = [...list].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    if (sort === 'alpha')  list = [...list].sort((a, b) => a.title.localeCompare(b.title));

    return list;
  }, [items, typeFilter, activeTag, search, sort]);

  /* ── Handlers ────────────────────── */
  const openReader = useCallback((item) => { setSelected(item); setView('reader'); }, []);
  const openEditor = useCallback((item = null) => { setSelected(item); setView('editor'); }, []);
  const goList     = useCallback(() => { setView('list'); setSelected(null); }, []);

  const handleSave = useCallback(async (draft) => {
    setIsSaving(true);
    try {
      const payload = {
        title:          draft.title,
        body:           draft.body,
        body_text:      draft.body_text || '',
        word_count:     draft.word_count || 0,
        content_format: draft.content_format || 'markdown',
        tags:           draft.tags,
        type:           draft.type,
        url:            draft.url || null,
      };
      if (selected?.id) {
        await updateItem(selected.id, payload);
      } else {
        await addItem({ ...payload, status: 'read' });
      }
      await fetchItems({});
      goList();
    } finally {
      setIsSaving(false);
    }
  }, [selected, updateItem, addItem, fetchItems, goList]);

  const handleDelete = useCallback(async (item) => {
    const ok = await confirm({
      title: `Xóa "${item.title}"?`,
      message: 'Hành động này không thể hoàn tác.',
      confirmLabel: 'Xóa',
      danger: true,
    });
    if (!ok) return;
    await deleteItem(item.id);
    goList();
  }, [confirm, deleteItem, goList]);

  if (!user) {
    return (
      <div className="kb-page">
        <div className="kb-empty-auth">🔐 Đăng nhập để dùng Knowledge Base</div>
      </div>
    );
  }

  /* ── Editor view ─────────────────── */
  if (view === 'editor') {
    const isNew = !selected;
    const initialDraft = selected
      ? {
          title:          selected.title,
          body:           selected.body || '',
          body_text:      selected.body_text || '',
          tags:           selected.tags || [],
          type:           selected.type,
          url:            selected.url || '',
          content_format: selected.content_format || 'markdown',
        }
      : EMPTY_DRAFT;
    return (
      <div className="kb-page kb-page--editor">
        {ConfirmModal}
        <EditorView
          initial={initialDraft}
          onSave={handleSave}
          onCancel={goList}
          isSaving={isSaving}
          suggestions={allTags}
          isNew={isNew}
          onConfirmSwitch={() => confirm({
            title: 'Chuyển mode?',
            message: 'Nội dung hiện tại sẽ bị xóa. Tiếp tục?',
            confirmLabel: 'Chuyển',
            danger: true,
          })}
        />
      </div>
    );
  }

  /* ── Reader view ─────────────────── */
  if (view === 'reader' && selected) {
    return (
      <div className="kb-page kb-page--reader">
        {ConfirmModal}
        <ReaderView
          item={selected}
          onEdit={() => openEditor(selected)}
          onDelete={() => handleDelete(selected)}
          onBack={goList}
        />
      </div>
    );
  }

  /* ── List view ───────────────────── */
  return (
    <div className="kb-page">
      {ConfirmModal}
      {/* Header */}
      <div className="kb-header">
        <div>
          <div className="section-label">🧠 Knowledge Base</div>
          <h1 className="kb-title">Kho Tàng <span className="gradient-text">Kiến Thức</span></h1>
          <p className="kb-subtitle">{filtered.length} bài viết{activeTag ? ` · #${activeTag}` : ''}</p>
        </div>
        <button className="btn btn-primary kb-new-btn" onClick={() => openEditor(null)}>
          ✏️ Viết bài mới
        </button>
      </div>

      {/* Search + Sort */}
      <div className="kb-toolbar">
        <input
          className="kb-search"
          type="text"
          placeholder="🔍 Tìm kiếm tiêu đề, nội dung, tag..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="kb-sort" value={sort} onChange={e => setSort(e.target.value)}>
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Type filter pills */}
      <div className="kb-type-filters">
        <button className={`kb-type-pill${!typeFilter ? ' kb-type-pill--active' : ''}`} onClick={() => setTypeFilter('')}>
          🗂 Tất cả
        </button>
        {Object.entries(TYPE_META).map(([k, v]) => (
          <button
            key={k}
            className={`kb-type-pill${typeFilter === k ? ' kb-type-pill--active' : ''}`}
            style={typeFilter === k ? { '--pill-color': v.color } : {}}
            onClick={() => setTypeFilter(typeFilter === k ? '' : k)}
          >
            {v.emoji} {v.label}
          </button>
        ))}
      </div>

      {/* Tag filter row */}
      {allTags.length > 0 && (
        <div className="kb-tag-filters">
          <span className="kb-tag-filters__label">Tags:</span>
          <button className={`kb-tag-chip kb-tag-filter-btn${!activeTag ? ' kb-tag-chip--active' : ''}`} onClick={() => setActiveTag('')}>Tất cả</button>
          {allTags.map(t => (
            <button
              key={t}
              className={`kb-tag-chip kb-tag-filter-btn${activeTag === t ? ' kb-tag-chip--active' : ''}`}
              onClick={() => setActiveTag(activeTag === t ? '' : t)}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="kb-loading">⏳ Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div className="kb-empty">
          <div className="kb-empty__icon">🧠</div>
          <p>Chưa có bài viết nào{search ? ` cho "${search}"` : ''}.</p>
          <button className="btn btn-primary" onClick={() => openEditor(null)}>✏️ Tạo bài đầu tiên</button>
        </div>
      ) : (
        <div className="kb-list">
          {filtered.map(item => (
            <ArticleCard key={item.id} item={item} onClick={openReader} />
          ))}
        </div>
      )}
    </div>
  );
}
