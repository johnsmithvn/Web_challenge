import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCollections } from '../hooks/useCollections';
import { useUserTasks } from '../hooks/useUserTasks';
import { useTags } from '../hooks/useTags';
import { useKnowledgeGroups } from '../hooks/useKnowledgeGroups';
import { useCollectionNotes } from '../hooks/useCollectionNotes';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import '../styles/collect.css';

const TiptapEditor   = lazy(() => import('../components/TiptapEditor'));
const TiptapReadOnly = lazy(() => import('../components/TiptapEditor').then(m => ({ default: m.TiptapReadOnly })));
import { FileText, MessageSquareQuote, BookOpen, Lightbulb, Library, FolderOpen, Bot, Gamepad2, Heart, Link } from 'lucide-react';
import QuoteWidget from '../components/QuoteWidget';
import UrlInputPopover from '../components/UrlInputPopover';
import KNOWLEDGE_DATA from '../data/knowledge.json';
import { stripMediaTag } from '../utils/mediaUtils';
import { formatDateTime } from '../utils/dateUtils';
import MediaPreview from '../components/MediaPreview';
import CustomSelect from '../components/CustomSelect';

/* ── Constants ─────────────────────────────────────────────── */
const ICON_MAP = {
  FileText, Link, MessageSquareQuote, BookOpen, Lightbulb, Bot, Gamepad2, Heart,
  Library, FolderOpen
};

const TYPE_META = KNOWLEDGE_DATA.types.reduce((acc, t) => {
  acc[t.key] = {
    icon: ICON_MAP[t.icon] || FileText,
    label: t.label,
    color: t.color
  };
  return acc;
}, {});

const POSTCARD_GRADIENT_COUNT = 8;
function postcardGradientClass(index) {
  return `kb-postcard--g${index % POSTCARD_GRADIENT_COUNT}`;
}

/** Detect audio URL in body text */
function detectAudioUrl(body = '') {
  const match = body.match(/https?:\/\/[^\s)"]+\.(mp3|m4a|ogg|wav|aac|flac)(\?[^\s)"]*)?/i);
  return match ? match[0] : null;
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'alpha',  label: 'A → Z' },
  { value: 'rev-alpha', label: 'Z → A' },
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

function formatDate(iso) {
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

/* ── TagInput (v4.1.0 — accepts tag objects with color) ──── */
function TagInput({ tags = [], onChange, suggestions = [] }) {
  const [input, setInput]   = useState('');
  const [open, setOpen]     = useState(false);
  const [cursor, setCursor] = useState(-1);
  const containerRef        = useRef(null);

  // tags = [{id, name, color}, ...] or string[] (backward compat)
  const tagNames = tags.map(t => typeof t === 'string' ? t : t.name);

  // Filter: match input text, exclude already-added tags
  const filtered = useMemo(() => {
    const q = input.toLowerCase().trim();
    return suggestions
      .filter(s => {
        const sName = typeof s === 'string' ? s : s.name;
        return !tagNames.includes(sName) && (!q || sName.includes(q));
      })
      .slice(0, 10);
  }, [suggestions, tagNames, input]);

  const slugify = (v) => v.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

  const addTag = useCallback((val) => {
    // val can be string or tag object
    const tagObj = typeof val === 'string'
      ? suggestions.find(s => (typeof s === 'string' ? s : s.name) === slugify(val)) || { name: slugify(val), color: '#8b5cf6' }
      : val;
    const name = typeof tagObj === 'string' ? tagObj : tagObj.name;
    if (name && !tagNames.includes(name)) onChange([...tags, tagObj]);
    setInput('');
    setOpen(false);
    setCursor(-1);
  }, [tags, tagNames, onChange, suggestions]);

  const showNew = input.trim().length > 0 && !suggestions.some(s => (typeof s === 'string' ? s : s.name) === slugify(input));

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

  return (
    <div className="kb-tag-input" ref={containerRef}>
      {tags.map(t => {
        const name = typeof t === 'string' ? t : t.name;
        const color = typeof t === 'string' ? '#8b5cf6' : (t.color || '#8b5cf6');
        return (
          <span key={name} className="kb-tag-chip kb-tag-chip--edit">
            <span className="kb-tag-dot" style={{ background: color }} />
            #{name}
            <button onMouseDown={e => { e.preventDefault(); onChange(tags.filter(x => (typeof x === 'string' ? x : x.name) !== name)); }} className="kb-tag-chip__rm">×</button>
          </span>
        );
      })}
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
          {filtered.map((t, i) => {
            const name = typeof t === 'string' ? t : t.name;
            const color = typeof t === 'string' ? '#8b5cf6' : (t.color || '#8b5cf6');
            return (
              <button
                key={name}
                className={`kb-tag-dropdown__item${cursor === i ? ' kb-tag-dropdown__item--active' : ''}`}
                onMouseDown={e => { e.preventDefault(); addTag(t); }}
                onMouseEnter={() => setCursor(i)}
              >
                <span className="kb-tag-dot" style={{ background: color }} />
                <span className="kb-tag-dropdown__hash">#</span>{name}
              </button>
            );
          })}
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

/* ── GroupPicker (for editor — inline creation) ──────────── */
function GroupPicker({ selected = [], onChange, groups = [], onCreateGroup }) {
  const [input, setInput] = useState('');
  const [open, setOpen]   = useState(false);
  const containerRef      = useRef(null);

  const selectedIds = selected.map(g => g.id);
  const filtered = useMemo(() => {
    const q = input.toLowerCase().trim();
    return groups.filter(g => !selectedIds.includes(g.id) && (!q || g.title.toLowerCase().includes(q))).slice(0, 10);
  }, [groups, selectedIds, input]);

  const showNew = input.trim().length > 0 && !groups.some(g => g.title.toLowerCase() === input.trim().toLowerCase());

  const addGroup = useCallback(async (group) => {
    onChange([...selected, group]);
    setInput('');
    setOpen(false);
  }, [selected, onChange]);

  const createAndAdd = useCallback(async () => {
    if (!input.trim() || !onCreateGroup) return;
    const newG = await onCreateGroup(input.trim());
    if (newG) addGroup(newG);
  }, [input, onCreateGroup, addGroup]);

  useEffect(() => {
    const h = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) { setOpen(false); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="kb-group-picker" ref={containerRef}>
      {selected.map(g => (
        <span key={g.id} className="kb-group-chip">
          {g.emoji} {g.title}
          <button className="kb-group-chip__rm" onMouseDown={e => { e.preventDefault(); onChange(selected.filter(x => x.id !== g.id)); }}>×</button>
        </span>
      ))}
      <input
        className="kb-group-picker__field"
        value={input}
        onChange={e => { setInput(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'Enter' && showNew) { e.preventDefault(); createAndAdd(); }
          else if (e.key === 'Enter' && filtered.length > 0) { e.preventDefault(); addGroup(filtered[0]); }
          else if (e.key === 'Backspace' && !input && selected.length) onChange(selected.slice(0, -1));
          else if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={selected.length ? '' : '📁 Thêm vào nhóm...'}
        autoComplete="off"
      />
      {open && (filtered.length > 0 || showNew) && (
        <div className="kb-tag-dropdown">
          {filtered.map(g => (
            <button key={g.id} className="kb-tag-dropdown__item" onMouseDown={e => { e.preventDefault(); addGroup(g); }}>
              {g.emoji} {g.title} <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{g._articleCount || 0}</span>
            </button>
          ))}
          {showNew && (
            <button className="kb-tag-dropdown__item kb-tag-dropdown__item--new" onMouseDown={e => { e.preventDefault(); createAndAdd(); }}>
              ✚ Tạo nhóm mới "<strong>{input.trim()}</strong>"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── SubNotes Section (reader view) ──────────────────────── */
function SubNotesSection({ collectionId, notesHook }) {
  const { notes, isLoading, fetchNotes, addNote, updateNote, deleteNote } = notesHook;
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId]   = useState(null);
  const [editContent, setEditContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => { if (collectionId) fetchNotes(collectionId); }, [collectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    await addNote(collectionId, newContent);
    setNewContent('');
    setIsExpanded(false);
  };

  const handleUpdate = async (id) => {
    if (!editContent.trim()) return;
    await updateNote(id, editContent);
    setEditingId(null);
    setEditContent('');
  };

  // Using centralized dateUtils

  return (
    <div className="kb-subnotes">
      <div className="kb-subnotes__header">
        <span className="kb-subnotes__title">💭 Ghi Chú Cá Nhân</span>
        {notes.length > 0 && <span className="kb-subnotes__count">{notes.length}</span>}
      </div>

      {isLoading && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Đang tải...</div>}

      {notes.map(n => (
        <div key={n.id} className={`kb-subnote${editingId === n.id ? ' kb-subnote--editing' : ''}`}>
          {editingId === n.id ? (
            <>
              <textarea
                className="kb-subnote__edit-textarea"
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleUpdate(n.id); if (e.key === 'Escape') { setEditingId(null); setEditContent(''); } }}
              />
              <div className="kb-subnote-form__actions">
                <button className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }} onClick={() => { setEditingId(null); setEditContent(''); }}>Hủy</button>
                <button className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }} onClick={() => handleUpdate(n.id)}>Lưu</button>
              </div>
            </>
          ) : (
            <>
              <div className="kb-subnote__content">{n.content}</div>
              <div className="kb-subnote__footer">
                <span className="kb-subnote__date">{formatDateTime(n.created_at)}</span>
                <div className="kb-subnote__actions">
                  <button className="kb-subnote__btn" onClick={() => { setEditingId(n.id); setEditContent(n.content); }}>✏️</button>
                  <button className="kb-subnote__btn kb-subnote__btn--danger" onClick={() => deleteNote(n.id)}>🗑</button>
                </div>
              </div>
            </>
          )}
        </div>
      ))}

      <div className={`kb-subnote-form ${isExpanded ? 'is-expanded' : ''}`}>
        <textarea
          className="kb-subnote-form__textarea"
          value={newContent}
          onChange={e => setNewContent(e.target.value)}
          placeholder="Viết ghi chú..."
          onFocus={() => setIsExpanded(true)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAdd(); if (e.key === 'Escape') { setIsExpanded(false); setNewContent(''); } }}
        />
        {isExpanded && (
          <div className="kb-subnote-form__actions">
            <button className="btn btn-ghost" style={{ fontSize: '0.82rem', padding: '0.35rem 0.7rem' }} onClick={() => { setIsExpanded(false); setNewContent(''); }}>Hủy</button>
            <button className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '0.35rem 0.7rem' }} disabled={!newContent.trim()} onClick={handleAdd}>💾 Lưu</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── ArticleCard ──────────────────────────────────────────── */
function ArticleCard({ item, onClick, onGroupClick }) {
  const meta      = TYPE_META[item.type] || TYPE_META.note;
  const isTiptap  = isTiptapBody(item);
  // Use body_text (plain text) for cards — avoids showing raw JSON for Tiptap articles
  // If body_text is missing for Tiptap, extract text from JSON content
  let plainText = item.body_text || '';
  if (!plainText && isTiptap) {
    try {
      const json = typeof item.body === 'string' ? JSON.parse(item.body) : item.body;
      const extractText = (node) => {
        if (!node) return '';
        if (node.text) return node.text;
        if (node.content) return node.content.map(extractText).join(' ');
        return '';
      };
      plainText = extractText(json).trim();
    } catch { plainText = ''; }
  } else if (!plainText) {
    plainText = item.body || '';
  }
  const mins      = item.word_count ? Math.max(1, Math.ceil(item.word_count / 200)) : readTime(plainText);
  const excp      = plainText.trim().slice(0, 180);

  return (
    <article className="kb-card" onClick={() => onClick(item)} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick(item)}>
      <div className="kb-card__left">
        <span className="kb-card__emoji" style={{ '--type-color': meta.color }}>
          <meta.icon size={20} />
        </span>
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
          <span className={`kb-format-badge ${isTiptap ? 'kb-format-badge--visual' : 'kb-format-badge--markdown'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
            {isTiptap ? '🎨 Visual' : '✍️ MD'}
          </span>
          <span className="kb-card__date">{formatDate(item.created_at)}</span>
        </div>
        <h3 className="kb-card__title">{item.title}</h3>
        {excp && <p className="kb-card__excerpt">{excp}{plainText.length > 180 ? '…' : ''}</p>}
        <div className="kb-card__footer">
          <div className="kb-card__tags">
            {(item._tags || item.tags || []).map(t => {
              const name = typeof t === 'string' ? t : t.name;
              const color = typeof t === 'string' ? '#8b5cf6' : (t.color || '#8b5cf6');
              return <span key={name} className="kb-tag-chip"><span className="kb-tag-dot" style={{ background: color }} />#{name}</span>;
            })}
            {(item._linkedTaskCount || 0) > 0 && (
              <span className="kb-tag-chip" style={{ background: 'rgba(6,182,212,0.1)', color: '#22d3ee', borderColor: 'rgba(6,182,212,0.2)' }}>
                📌 {item._linkedTaskCount} task{item._linkedTaskCount > 1 ? 's' : ''}
              </span>
            )}
            {(item._groups || []).map(g => (
              <span key={g.id} className="kb-group-badge" onClick={e => { e.stopPropagation(); onGroupClick?.(g); }}>
                {g.emoji} {g.title}
              </span>
            ))}
          </div>
          <span className="kb-card__readtime">⏱ {mins} phút đọc</span>
        </div>
      </div>
    </article>
  );
}

/* ── PostcardCard (v4.13.0 — quote gallery view) ─────────── */
function PostcardCard({ item, index, onClick }) {
  const isTiptap = isTiptapBody(item);
  let quoteText = item.body_text || '';
  if (!quoteText && isTiptap) {
    try {
      const json = typeof item.body === 'string' ? JSON.parse(item.body) : item.body;
      const walk = (node) => {
        if (!node) return '';
        if (node.text) return node.text;
        if (node.content) return node.content.map(walk).join(' ');
        return '';
      };
      quoteText = walk(json).trim();
    } catch { quoteText = ''; }
  } else if (!quoteText) {
    quoteText = markdownToPlainText(item.body || '');
  }
  // Use body text as the quote; title becomes the author/source
  const displayText = quoteText || item.title;
  const isShort = displayText.length < 120;
  const isTruncated = displayText.length > 250;
  const audioUrl = detectAudioUrl(item.body || '');

  return (
    <article
      className={`kb-postcard ${postcardGradientClass(index)}`}
      onClick={() => onClick(item)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick(item)}
    >
      <span className="kb-postcard__mark">&ldquo;</span>
      <p className={`kb-postcard__text${isShort ? ' kb-postcard__text--short' : ''}${isTruncated ? ' kb-postcard__text--truncated' : ''}`}>
        {displayText.slice(0, 350)}
      </p>
      {quoteText && <div className="kb-postcard__author">— {item.title}</div>}
      <div className="kb-postcard__footer">
        {(item._tags || []).map(t => {
          const name = typeof t === 'string' ? t : t.name;
          const color = typeof t === 'string' ? '#8b5cf6' : (t.color || '#8b5cf6');
          return <span key={name} className="kb-tag-chip"><span className="kb-tag-dot" style={{ background: color }} />#{name}</span>;
        })}
        {audioUrl && <span className="kb-postcard__audio-badge">🔊 Audio</span>}
        <span className="kb-postcard__date">{formatDate(item.created_at)}</span>
      </div>
    </article>
  );
}

/* ── Heading slug (must match extractHeadings) ────────────── */
function slugify(text) {
  return String(text).toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
}

const REMARK_PLUGINS = [remarkGfm];

/* Custom ReactMarkdown components — injects id attrs for TOC + media embeds */
const createMdComponents = (onUrlToggle) => ({
  h1: ({ children }) => { const id = slugify(React.Children.toArray(children).join('')); return <h1 id={id}>{children}</h1>; },
  h2: ({ children }) => { const id = slugify(React.Children.toArray(children).join('')); return <h2 id={id}>{children}</h2>; },
  h3: ({ children }) => { const id = slugify(React.Children.toArray(children).join('')); return <h3 id={id}>{children}</h3>; },
  h4: ({ children }) => { const id = slugify(React.Children.toArray(children).join('')); return <h4 id={id}>{children}</h4>; },
  /* Responsive images with lazy loading */
  img: ({ src, alt }) => (
    <img src={src} alt={alt || ''} className="kb-md-image" loading="lazy" />
  ),
  /* Auto-detect YouTube + audio URLs in links */
  a: ({ href, children }) => {
    // YouTube → embed via MediaPreview (which is memoized)
    if (href && /youtube\.com\/watch|youtu\.be\/|youtube\.com\/embed\//.test(href)) {
      return <MediaPreview url={href} title={children} onToggleFormat={onUrlToggle ? (newUrl) => onUrlToggle(href, newUrl) : undefined} />;
    }
    // Audio file → native player
    if (href && /\.(mp3|m4a|ogg|wav|aac|flac)(\?|$)/i.test(href)) {
      return <MediaPreview url={href} title={children} onToggleFormat={onUrlToggle ? (newUrl) => onUrlToggle(href, newUrl) : undefined} />;
    }
    // Google Drive Audio/Video Player
    if (href && /drive\.google\.com\//.test(href)) {
      return <MediaPreview url={href} title={children} onToggleFormat={onUrlToggle ? (newUrl) => onUrlToggle(href, newUrl) : undefined} />;
    }
    // Normal link
    return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
  },
});

const mdComponents = createMdComponents();

/* ── ReaderView ───────────────────────────────────────────── */
function ReaderView({ item, onEdit, onDelete, onBack, onCreateTask, notesHook, onUpdateUrl }) {
  const meta    = TYPE_META[item.type] || TYPE_META.note;
  const isTiptap = isTiptapBody(item);
  const mins    = item.word_count ? Math.max(1, Math.ceil(item.word_count / 200)) : readTime(item.body);

  return (
    <div className="kb-reader">
      {/* Header bar */}
      <div className="kb-reader__bar">
        <button className="kb-back-btn" onClick={onBack}>← Quay lại</button>
        <div className="kb-reader__actions">
          <button className="btn btn-ghost kb-action-btn" onClick={() => onCreateTask(item)} title="Tạo task liên kết">📌 Task</button>
          <button className="btn btn-ghost kb-action-btn" onClick={onEdit}>✏️ Sửa</button>
          <button className="btn btn-ghost kb-action-btn kb-action-btn--danger" onClick={onDelete}>🗑 Xóa</button>
        </div>
      </div>

      <div className="kb-reader__layout">
        {/* Main content */}
        <div className="kb-reader__main">
          <div className="kb-reader__hero">
            <span className="kb-reader__emoji" style={{ '--type-color': meta.color }}><meta.icon size={32} /></span>
            <h1 className="kb-reader__title" title={item.title}>{item.title}</h1>
            <div className="kb-reader__meta">
              <span style={{ color: meta.color }}>{meta.label}</span>
              <span>·</span>
              <span>{formatDate(item.updated_at || item.created_at)}</span>
              <span>·</span>
              <span>⏱ {mins} phút đọc</span>
              <span className={`kb-format-badge ${isTiptap ? 'kb-format-badge--visual' : 'kb-format-badge--markdown'}`}>
                {isTiptap ? '🎨 Visual' : '✍️ Markdown'}
              </span>
            </div>
            {(item._tags || item.tags || []).length > 0 && (
              <div className="kb-reader__tags">
                {(item._tags || item.tags || []).map(t => {
                  const name = typeof t === 'string' ? t : t.name;
                  const color = typeof t === 'string' ? '#8b5cf6' : (t.color || '#8b5cf6');
                  return <span key={name} className="kb-tag-chip"><span className="kb-tag-dot" style={{ background: color }} />#{name}</span>;
                })}
              </div>
            )}
            {item.url && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                <MediaPreview url={item.url} type={item.type} onToggleFormat={onUpdateUrl} />
                <a href={stripMediaTag(item.url)} target="_blank" rel="noopener noreferrer" className="kb-reader__source" style={{ marginTop: 0 }}>
                  🔗 Xem nguồn: {stripMediaTag(item.url)}
                </a>
              </div>
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
                <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={mdComponents}>{item.body}</ReactMarkdown>
              ) : (
                <p className="kb-prose__empty">Bài viết này chưa có nội dung. Nhấn ✏️ Sửa để thêm.</p>
              )}
            </div>
          )}
        </div>

        {/* TOC sidebar — only for markdown (tiptap has its own structure) */}
        {!isTiptap && <TableOfContents content={item.body} />}
      </div>

      {/* Sub-notes section */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 1.5rem 4rem' }}>
        <SubNotesSection collectionId={item.id} notesHook={notesHook} />
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
  const [mdMediaPopover, setMdMediaPopover] = useState(null); // 'image' | 'youtube' | 'audio' | null

  const handleUrlToggle = useCallback((oldUrl, newUrl) => {
    const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedOld = escapeRegExp(oldUrl);
    const regex = new RegExp(escapedOld, 'g');
    const next = value.replace(regex, newUrl);
    onChange(next);
  }, [value, onChange]);

  const handleUrlToggleRef = useRef(handleUrlToggle);
  useEffect(() => {
    handleUrlToggleRef.current = handleUrlToggle;
  }, [handleUrlToggle]);

  const previewComponents = useMemo(() => {
    return createMdComponents((oldUrl, newUrl) => {
      handleUrlToggleRef.current?.(oldUrl, newUrl);
    });
  }, []);

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

  const mdToolbarRef = useRef(null);

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
    { label: '🖼️',  title: 'Chèn ảnh',             action: () => setMdMediaPopover(p => p === 'image' ? null : 'image') },
    { label: '▶️',  title: 'Chèn YouTube',          action: () => setMdMediaPopover(p => p === 'youtube' ? null : 'youtube') },
    { label: '🎵',  title: 'Chèn Audio',            action: () => setMdMediaPopover(p => p === 'audio' ? null : 'audio') },
  ];

  return (
    <div className="kb-split">
      {/* Toolbar */}
      <div className="kb-tb" ref={mdToolbarRef}>
        {tools.map((t, i) => (
          <ToolbarBtn key={i} label={t.label} title={t.title} onClick={t.action} />
        ))}
        <span className="kb-tb-divider" />
      </div>

      {/* Media URL popover (replaces window.prompt) */}
      <UrlInputPopover
        open={!!mdMediaPopover}
        onClose={() => setMdMediaPopover(null)}
        onSubmit={(url) => {
          if (mdMediaPopover === 'image') insert('\n![', `](${url})\n`, 'mô tả ảnh');
          else if (mdMediaPopover === 'youtube') insert('\n[Video](', `${url})\n`);
          else if (mdMediaPopover === 'audio') {
            const cleanUrl = url.trim();
            const taggedUrl = (cleanUrl.includes('#audio') || cleanUrl.includes('#video'))
              ? cleanUrl
              : `${cleanUrl}#audio`;
            insert('\n[Audio](', `${taggedUrl})\n`);
          }
        }}
        label={mdMediaPopover === 'image' ? 'URL ảnh' : mdMediaPopover === 'youtube' ? 'YouTube URL' : 'Audio URL'}
        placeholder={mdMediaPopover === 'image' ? 'https://example.com/photo.jpg' : mdMediaPopover === 'youtube' ? 'https://youtu.be/...' : 'https://example.com/audio.mp3'}
        icon={mdMediaPopover === 'image' ? '🖼️' : mdMediaPopover === 'youtube' ? '▶️' : '🎵'}
        allowUpload={mdMediaPopover === 'image' || mdMediaPopover === 'audio'}
        accept={mdMediaPopover === 'image' ? 'image/*' : mdMediaPopover === 'audio' ? 'audio/*' : undefined}
        anchorRef={mdToolbarRef}
      />

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
              <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={previewComponents}>
                {value}
              </ReactMarkdown>
            ) : (
              <p className="kb-prose__empty">Preview sẽ hiện ở đây...</p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}


/* ── EditorView ───────────────────────────────────────────── */
function EditorView({ initial, onSave, onCancel, isSaving, suggestions = [], isNew = false, onConfirmSwitch, groups = [], onCreateGroup, selectedGroups = [], onGroupsChange }) {
  const savedMode = localStorage.getItem(EDITOR_MODE_KEY) || 'markdown';
  // Auto-detect tiptap from body shape when content_format wasn't saved (legacy bug)
  const detectFormat = (item) => {
    if (item?.content_format === 'tiptap') return 'tiptap';
    if (item?.content_format === 'markdown') {
      // Double-check: body might actually be tiptap JSON (saved before fix)
      const b = (item?.body || '').trimStart();
      if (b.startsWith('{"type":"doc"')) return 'tiptap';
      return 'markdown';
    }
    // No content_format at all — detect from body
    const b = (item?.body || '').trimStart();
    return b.startsWith('{"type":"doc"') ? 'tiptap' : 'markdown';
  };
  const initialFormat = isNew ? savedMode : detectFormat(initial);

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
  const wordCount = draft.content_format === 'tiptap'
    ? (draft._tiptapWordCount ?? (bodyText.trim() ? bodyText.trim().split(/\s+/).filter(Boolean).length : 0))
    : (bodyText.trim() ? bodyText.trim().split(/\s+/).filter(Boolean).length : 0);
  const charCount = draft.content_format === 'tiptap'
    ? (draft._tiptapCharCount ?? bodyText.length)
    : bodyText.length;
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
          <span>{wordCount} từ · {charCount} ký tự · {mins} phút đọc</span>
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
        <CustomSelect
          className="kb-type-select"
          value={draft.type}
          onChange={val => set('type', val)}
          options={Object.entries(TYPE_META).map(([k, v]) => ({ value: k, label: v.label }))}
        />
        <input
          className="kb-editor__title"
          placeholder="Tiêu đề bài viết..."
          value={draft.title}
          onChange={e => set('title', e.target.value)}
          maxLength={200}
        />
      </div>

      {/* Groups row */}
      <div className="kb-editor__sub-meta">
        <div style={{ flex: 1 }}>
          <GroupPicker selected={selectedGroups} onChange={onGroupsChange} groups={groups} onCreateGroup={onCreateGroup} />
        </div>
      </div>

      {/* Tags + URL + Mode toggle row */}
      <div className="kb-editor__sub-meta">
        <div style={{ flex: 1 }}>
          <TagInput tags={draft.tags} onChange={v => set('tags', v)} suggestions={suggestions} />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            className="kb-editor__url"
            placeholder="URL nguồn (tùy chọn)"
            value={draft.url || ''}
            onChange={e => set('url', e.target.value)}
          />
          {draft.url && (
            <div className="kb-editor-format-pill">
              <button
                type="button"
                className={`kb-format-pill-btn ${!draft.url.includes('#video') ? 'active' : ''}`}
                onClick={() => set('url', draft.url.split('#')[0] + '#audio')}
                title="Dạng Audio"
              >
                🎵 Audio
              </button>
              <button
                type="button"
                className={`kb-format-pill-btn ${draft.url.includes('#video') ? 'active' : ''}`}
                onClick={() => set('url', draft.url.split('#')[0] + '#video')}
                title="Dạng Video"
              >
                📺 Video
              </button>
            </div>
          )}
        </div>
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
              onChange={(json, text, words, chars) => setDraft(d => ({ ...d, body: json, body_text: text, _tiptapWordCount: words || 0, _tiptapCharCount: chars || 0 }))}
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
  const { addTask, pendingTasks } = useUserTasks();
  const { tags: centralTags, addTag: addCentralTag, linkTag, unlinkTag } = useTags();
  const groupsHook = useKnowledgeGroups();
  const notesHook = useCollectionNotes();
  const { confirm, ConfirmModal } = useConfirm();

  const [view, setView]         = useState('list');
  const [selected, setSelected] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeGroupView, setActiveGroupView] = useState(null); // group drill-down
  const [groupArticles, setGroupArticles] = useState([]);
  const [editGroups, setEditGroups] = useState([]); // groups selected in editor
  const [groupNewName, setGroupNewName] = useState(''); // separate state for group creation input

  // Filters
  const [search, setSearch]     = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [sort, setSort]         = useState('newest');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [filterTaskId, setFilterTaskId] = useState(''); // filter KB by linked task
  const [showTaskFilter, setShowTaskFilter] = useState(false); // task filter popup
  const [taskSearch, setTaskSearch] = useState(''); // search inside task filter
  const taskFilterRef = useRef(null);
  const sortRef = useRef(null);

  // Bulk actions
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState(new Set());

  useEffect(() => {
    if (user) { fetchItems({}); groupsHook.fetchGroups(); }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close task filter popup on outside click
  useEffect(() => {
    if (!showTaskFilter) return;
    const handler = (e) => {
      if (taskFilterRef.current && !taskFilterRef.current.contains(e.target)) {
        setShowTaskFilter(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTaskFilter]);

  // Close sort dropdown on outside click
  useEffect(() => {
    if (!showSortDropdown) return;
    const handler = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setShowSortDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSortDropdown]);

  /* ── Derived data ─────────────────── */
  const allTags = useMemo(() => {
    // Merge central tags with any tags found on items (for display completeness)
    const map = new Map();
    centralTags.forEach(t => map.set(t.id, t));
    items.filter(i => i.type !== 'inbox').forEach(i => {
      (i._tags || []).forEach(t => { if (t && t.id) map.set(t.id, t); });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [items, centralTags]);

  const filtered = useMemo(() => {
    let list = items.filter(i => i.type !== 'inbox' && i.status !== 'archived');

    if (typeFilter) list = list.filter(i => i.type === typeFilter);
    if (activeTag) {
      // activeTag is now a tag id
      list = list.filter(i => (i._tags || []).some(t => t.id === activeTag));
    }
    // Task link filter
    if (filterTaskId) {
      list = list.filter(i => (i._linkedTaskIds || []).includes(filterTaskId));
    }
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
    if (sort === 'rev-alpha') list = [...list].sort((a, b) => b.title.localeCompare(a.title));

    return list;
  }, [items, typeFilter, activeTag, filterTaskId, search, sort]);

  /* ── Handlers ────────────────────── */
  const openReader = useCallback((item) => { setSelected(item); setView('reader'); }, []);
  const openEditor = useCallback(async (item = null) => {
    setSelected(item);
    setView('editor');
    // Load existing groups for this article
    if (item?.id) {
      const articleGroups = await groupsHook.getGroupsForArticle(item.id);
      setEditGroups(articleGroups);
    } else {
      setEditGroups(activeGroupView ? [activeGroupView] : []);
    }
  }, [activeGroupView]); // eslint-disable-line react-hooks/exhaustive-deps
  const goList = useCallback(() => {
    setView('list');
    setSelected(null);
    if (activeGroupView) {
      // Refresh group articles
      groupsHook.fetchGroupArticles(activeGroupView.id).then(setGroupArticles);
    }
  }, [activeGroupView]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async (draft) => {
    setIsSaving(true);
    try {
      const payload = {
        title:          draft.title,
        body:           draft.body,
        body_text:      draft.body_text || '',
        word_count:     draft.word_count || 0,
        content_format: draft.content_format || 'markdown',
        type:           draft.type,
        url:            draft.url || null,
      };

      let savedId;
      if (selected?.id) {
        await updateItem(selected.id, payload);
        savedId = selected.id;
      } else {
        const created = await addItem({ ...payload, status: 'read' });
        savedId = created?.id;
      }

      // v4.1.0: Sync tags via junction table
      if (savedId && draft.tags) {
        const draftTagNames = draft.tags.map(t => typeof t === 'string' ? t : t.name);
        const existingTags = selected?._tags || [];
        const existingNames = existingTags.map(t => t.name);

        // Tags to add (in draft but not in existing)
        for (const t of draft.tags) {
          const name = typeof t === 'string' ? t : t.name;
          if (!existingNames.includes(name)) {
            // Ensure tag exists in central table
            const tagObj = await addCentralTag(name, typeof t === 'string' ? '#8b5cf6' : (t.color || '#8b5cf6'));
            if (tagObj) await linkTag(savedId, tagObj.id, 'collection');
          }
        }

        // Tags to remove (in existing but not in draft)
        for (const t of existingTags) {
          if (!draftTagNames.includes(t.name)) {
            await unlinkTag(savedId, t.id, 'collection');
          }
        }
      }

      // v4.11.0: Sync group links
      if (savedId && editGroups) {
        const existingGroups = selected?._groups || [];
        const existingIds = existingGroups.map(g => g.id);
        const newIds = editGroups.map(g => g.id);

        // Groups to link
        for (const g of editGroups) {
          if (!existingIds.includes(g.id)) {
            await groupsHook.linkArticle(savedId, g.id);
          }
        }
        // Groups to unlink
        for (const g of existingGroups) {
          if (!newIds.includes(g.id)) {
            await groupsHook.unlinkArticle(savedId, g.id);
          }
        }
      }

      await fetchItems({});
      await groupsHook.fetchGroups();
      goList();
    } finally {
      setIsSaving(false);
    }
  }, [selected, updateItem, addItem, fetchItems, goList, addCentralTag, linkTag, unlinkTag, editGroups]); // eslint-disable-line react-hooks/exhaustive-deps

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
          tags:           selected._tags || selected.tags || [],
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
          groups={groupsHook.groups}
          onCreateGroup={groupsHook.addGroup}
          selectedGroups={editGroups}
          onGroupsChange={setEditGroups}
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
          notesHook={notesHook}
          onUpdateUrl={async (newUrl) => {
            await updateItem(selected.id, { url: newUrl });
            setSelected(prev => ({ ...prev, url: newUrl }));
            await fetchItems({});
          }}
          onCreateTask={async (item) => {
            const result = await addTask({
              title: item.title,
              description: item.url || (item.body_text || '').slice(0, 200) || '',
              collectionId: item.id,
            });
            if (result) {
              alert(`📌 Task "${item.title}" đã được tạo!`);
            }
          }}
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
          <p className="kb-subtitle">{filtered.length} bài viết{activeTag ? ` · #${allTags.find(t => t.id === activeTag)?.name || ''}` : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {filtered.length > 0 && (
            <button
              className={`kb-type-pill${bulkMode ? ' kb-type-pill--active' : ''}`}
              onClick={() => { setBulkMode(v => !v); setBulkSelected(new Set()); }}
            >
              {bulkMode ? '✕ Thoát' : '☑ Chọn nhiều'}
            </button>
          )}
          <button className="btn btn-primary kb-new-btn" onClick={() => openEditor(null)}>
            ✏️ Viết bài mới
          </button>
        </div>
      </div>

      {/* Daily quote */}
      <QuoteWidget pageKey="knowledge" kbQuotes={items.filter(i => i.type === 'quote' && i.status !== 'archived')} />

      {/* Search + Sort + Task Filter */}
      <div className="kb-toolbar">
        <input
          className="kb-search"
          type="text"
          placeholder="🔍 Tìm kiếm tiêu đề, nội dung, tag..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div ref={sortRef} style={{ position: 'relative' }}>
          <button
            className="kb-sort-trigger"
            onClick={() => setShowSortDropdown(v => !v)}
            id="kb-sort-trigger-btn"
          >
            <span>{SORT_OPTIONS.find(o => o.value === sort)?.label}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.2rem' }}>▼</span>
          </button>

          {showSortDropdown && (
            <div className="kb-sort-dropdown">
              {SORT_OPTIONS.map(o => (
                <button
                  key={o.value}
                  className={`kb-sort-dropdown-item${sort === o.value ? ' kb-sort-dropdown-item--active' : ''}`}
                  onClick={() => {
                    setSort(o.value);
                    setShowSortDropdown(false);
                  }}
                >
                  <span>{o.label}</span>
                  {sort === o.value && <span style={{ color: 'var(--purple)', fontWeight: 'bold' }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Task filter icon + dropdown */}
        {pendingTasks.length > 0 && (
          <div ref={taskFilterRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowTaskFilter(v => !v)}
              title="Lọc theo Task"
              id="kb-task-filter-btn"
              className={`kb-task-filter-btn${filterTaskId ? ' kb-task-filter-btn--active' : ''}`}
            >
              📌{filterTaskId ? ' 1' : ''}
            </button>

            {showTaskFilter && (() => {
              const q = taskSearch.trim().toLowerCase();
              const filteredTasks = pendingTasks
                .filter(t => !q || t.title?.toLowerCase().includes(q))
                .slice(0, 10);
              return (
              <div className="kb-task-filter-popover">
                {/* Header */}
                <div className="kb-task-filter-header">
                  <span>📌 Lọc theo Task</span>
                  {filterTaskId && (
                    <button
                      onClick={() => { setFilterTaskId(''); setShowTaskFilter(false); setTaskSearch(''); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: '#f87171', fontFamily: 'inherit' }}
                    >Xóa bộ lọc</button>
                  )}
                </div>

                {/* Search */}
                <div className="kb-task-filter-search-container">
                  <input
                    type="text"
                    placeholder="Tìm task..."
                    value={taskSearch}
                    onChange={e => setTaskSearch(e.target.value)}
                    autoFocus
                    className="kb-task-filter-search-input"
                  />
                </div>

                {/* Task list */}
                <div className="kb-task-filter-list">
                  {filteredTasks.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', padding: '1rem 0' }}>
                      Không tìm thấy task
                    </div>
                  )}
                  {filteredTasks.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setFilterTaskId(filterTaskId === t.id ? '' : t.id); setShowTaskFilter(false); setTaskSearch(''); }}
                      className={`kb-task-filter-item ${filterTaskId === t.id ? 'kb-task-filter-item--active' : ''}`}
                    >
                      <span className={`kb-task-filter-checkbox ${filterTaskId === t.id ? 'kb-task-filter-checkbox--active' : ''}`}>
                        {filterTaskId === t.id ? '✓' : ''}
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.title}
                      </span>
                    </button>
                  ))}
                  {pendingTasks.filter(t => !q || t.title?.toLowerCase().includes(q)).length > 10 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.7rem', padding: '0.4rem 0' }}>
                      Hiện tối đa 10 · thu hẹp từ khoá
                    </div>
                  )}
                </div>
              </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Type filter pills */}
      <div className="kb-type-filters">
        <button className={`kb-type-pill${!typeFilter && !activeGroupView ? ' kb-type-pill--active' : ''}`} onClick={() => { setTypeFilter(''); setActiveGroupView(null); }}>
          <Library size={14} style={{ marginRight: 6 }} /> Tất cả
        </button>
        {Object.entries(TYPE_META).map(([k, v]) => {
          const Icon = v.icon;
          return (
            <button
              key={k}
              className={`kb-type-pill${typeFilter === k ? ' kb-type-pill--active' : ''}`}
              style={typeFilter === k ? { '--pill-color': v.color } : {}}
              onClick={() => { setTypeFilter(typeFilter === k ? '' : k); setActiveGroupView(null); }}
            >
              <Icon size={14} style={{ marginRight: 6 }} /> {v.label}
            </button>
          );
        })}
        <button
          className={`kb-type-pill${activeGroupView || typeFilter === '__groups' ? ' kb-type-pill--active' : ''}`}
          style={activeGroupView || typeFilter === '__groups' ? { '--pill-color': '#8b5cf6' } : {}}
          onClick={() => { setTypeFilter(typeFilter === '__groups' ? '' : '__groups'); setActiveGroupView(null); }}
        >
          <FolderOpen size={14} style={{ marginRight: 6 }} /> Nhóm
        </button>
      </div>

      {/* ── GROUP DRILL-DOWN VIEW ───────────────────── */}
      {activeGroupView ? (
        <>
          {/* Breadcrumb */}
          <div className="kb-breadcrumb">
            <button className="kb-breadcrumb__link" onClick={() => { setActiveGroupView(null); setTypeFilter('__groups'); setSearch(''); }}>🧠 Kho Tàng</button>
            <span className="kb-breadcrumb__sep">›</span>
            <span className="kb-breadcrumb__current">{activeGroupView.emoji} {activeGroupView.title}</span>
          </div>

          {/* Group header */}
          <div className="kb-group-header">
            <div className="kb-group-header__info">
              <div className="kb-group-header__emoji">{activeGroupView.emoji}</div>
              <h2 className="kb-group-header__title">{activeGroupView.title}</h2>
              <div className="kb-group-header__meta">
                {groupArticles.length} bài · Tạo {formatDate(activeGroupView.created_at)}
                {activeGroupView.description && <> · {activeGroupView.description}</>}
              </div>
            </div>
            <div className="kb-group-header__actions">
              <button className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '0.4rem 0.8rem' }} onClick={() => openEditor(null)}>＋ Thêm bài</button>
              <button className="btn btn-ghost" style={{ fontSize: '0.82rem', padding: '0.4rem 0.8rem' }} onClick={async () => {
                const ok = await confirm({
                  title: `Xóa nhóm "${activeGroupView.emoji} ${activeGroupView.title}"?`,
                  message: `${groupArticles.length} bài viết bên trong sẽ KHÔNG bị xóa — chỉ gỡ khỏi nhóm này.`,
                  confirmLabel: 'Xóa nhóm',
                  danger: true,
                });
                if (!ok) return;
                await groupsHook.deleteGroup(activeGroupView.id);
                setActiveGroupView(null);
                setTypeFilter('__groups');
                fetchItems({});
              }}>🗑 Xóa nhóm</button>
            </div>
          </div>

          {/* Contextual search */}
          <div className="kb-toolbar">
            <input
              className="kb-search"
              type="text"
              placeholder={`🔍 Tìm trong "${activeGroupView.title}"...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Articles in group */}
          {(() => {
            let list = groupArticles;
            if (search) {
              const q = search.toLowerCase();
              list = list.filter(i => i.title.toLowerCase().includes(q) || (i.body || '').toLowerCase().includes(q));
            }
            return list.length === 0 ? (
              <div className="kb-empty">
                <div className="kb-empty__icon">📁</div>
                <p>Chưa có bài viết nào trong nhóm{search ? ` cho "${search}"` : ''}.</p>
                <button className="btn btn-primary" onClick={() => openEditor(null)}>✏️ Thêm bài</button>
              </div>
            ) : (
              <div className="kb-list">
                {list.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <ArticleCard item={item} onClick={openReader} onGroupClick={(g) => {
                        if (g.id !== activeGroupView.id) {
                          setActiveGroupView(g);
                          groupsHook.fetchGroupArticles(g.id).then(setGroupArticles);
                          setSearch('');
                        }
                      }} />
                    </div>
                    <button
                      className="kb-subnote__btn"
                      title="Gỡ khỏi nhóm"
                      style={{ opacity: 0.5, flexShrink: 0 }}
                      onClick={async () => {
                        await groupsHook.unlinkArticle(item.id, activeGroupView.id);
                        setGroupArticles(prev => prev.filter(a => a.id !== item.id));
                        groupsHook.fetchGroups();
                      }}
                    >✕</button>
                  </div>
                ))}
              </div>
            );
          })()}
        </>

      /* ── GROUP LIST TAB ──────────────────────────── */
      ) : typeFilter === '__groups' ? (
        <>
          {/* Create group inline */}
          <div className="kb-create-group">
            <input
              className="kb-create-group__input"
              placeholder="Tên nhóm mới..."
              value={groupNewName}
              onChange={e => setGroupNewName(e.target.value)}
              onKeyDown={async e => {
                if (e.key === 'Enter' && groupNewName.trim()) {
                  await groupsHook.addGroup(groupNewName.trim());
                  setGroupNewName('');
                }
              }}
            />
            <button
              className="btn btn-primary"
              style={{ fontSize: '0.85rem', padding: '0.45rem 0.9rem', whiteSpace: 'nowrap' }}
              disabled={!groupNewName.trim()}
              onClick={async () => {
                if (!groupNewName.trim()) return;
                await groupsHook.addGroup(groupNewName.trim());
                setGroupNewName('');
              }}
            >＋ Tạo nhóm</button>
          </div>

          {/* Group list with search filter */}
          {(() => {
            const q = search.toLowerCase();
            const filteredGroups = search
              ? groupsHook.groups.filter(g => g.title.toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q))
              : groupsHook.groups;

            if (groupsHook.isLoading) return <div className="kb-loading">⏳ Đang tải nhóm...</div>;
            if (filteredGroups.length === 0) return (
              <div className="kb-empty">
                <div className="kb-empty__icon">📁</div>
                <p>{search ? `Không tìm thấy nhóm cho "${search}"` : 'Chưa có nhóm nào. Tạo nhóm đầu tiên ở trên!'}</p>
              </div>
            );
            return (
              <div className="kb-group-list">
                {filteredGroups.map(g => (
                  <div
                    key={g.id}
                    className="kb-group-card"
                    onClick={async () => {
                      setActiveGroupView(g);
                      setTypeFilter('');
                      setSearch('');
                      const articles = await groupsHook.fetchGroupArticles(g.id);
                      setGroupArticles(articles);
                    }}
                  >
                    <div className="kb-group-card__emoji">{g.emoji}</div>
                    <div className="kb-group-card__body">
                      <h3 className="kb-group-card__title">{g.title}</h3>
                      {g.description && <p className="kb-group-card__desc">{g.description}</p>}
                    </div>
                    <span className="kb-group-card__count">{g._articleCount || 0} bài</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </>

      /* ── NORMAL ARTICLE LIST ─────────────────────── */
      ) : (
        <>
          {/* Tag filter row */}
          {allTags.length > 0 && (
            <div className="kb-tag-filters">
              <span className="kb-tag-filters__label">Tags:</span>
              <button className={`kb-tag-chip kb-tag-filter-btn${!activeTag ? ' kb-tag-chip--active' : ''}`} onClick={() => setActiveTag('')}>Tất cả</button>
              {allTags.map(t => (
                <button
                  key={t.id}
                  className={`kb-tag-chip kb-tag-filter-btn${activeTag === t.id ? ' kb-tag-chip--active' : ''}`}
                  onClick={() => setActiveTag(activeTag === t.id ? '' : t.id)}
                >
                  <span className="kb-tag-dot" style={{ background: t.color || '#8b5cf6' }} />
                  #{t.name}
                </button>
              ))}
            </div>
          )}

          {/* List */}
          {isLoading ? (
            <div className="kb-loading">⏳ Đang tải...</div>
          ) : filtered.length === 0 ? (
            <div className="kb-empty">
              <div className="kb-empty__icon">{typeFilter === 'quote' ? '💬' : '🧠'}</div>
              <p>{typeFilter === 'quote'
                ? `Chưa có trích dẫn nào${search ? ` cho "${search}"` : ''}. Bắt đầu sưu tầm thôi!`
                : `Chưa có bài viết nào${search ? ` cho "${search}"` : ''}.`}</p>
              <button className="btn btn-primary" onClick={() => openEditor(null)}>
                ✏️ {typeFilter === 'quote' ? 'Tạo trích dẫn đầu tiên' : 'Tạo bài đầu tiên'}
              </button>
            </div>
          ) : typeFilter === 'quote' ? (
            /* ── POSTCARD GALLERY (quote type) ──────────── */
            <>
              {bulkMode && (
                <div className="inbox-bulk-bar" style={{ marginBottom: '0.75rem' }}>
                  <button
                    className="inbox-bulk-bar__btn"
                    onClick={() => {
                      if (bulkSelected.size >= filtered.length) setBulkSelected(new Set());
                      else setBulkSelected(new Set(filtered.map(i => i.id)));
                    }}
                  >
                    {bulkSelected.size >= filtered.length ? '☐ Bỏ chọn' : '☑ Chọn tất cả'}
                  </button>
                  {bulkSelected.size > 0 && (
                    <button
                      className="inbox-bulk-bar__btn inbox-bulk-bar__btn--delete"
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Xóa ${bulkSelected.size} trích dẫn?`,
                          message: 'Hành động này không thể hoàn tác.',
                          confirmLabel: 'Xóa tất cả',
                          danger: true,
                        });
                        if (!ok) return;
                        for (const id of bulkSelected) { await deleteItem(id); }
                        setBulkSelected(new Set());
                        setBulkMode(false);
                        fetchItems({});
                      }}
                    >
                      🗑 Xóa ({bulkSelected.size})
                    </button>
                  )}
                </div>
              )}
              <div className="kb-postcard-grid">
                {filtered.map((item, idx) => (
                  <PostcardCard key={item.id} item={item} index={idx} onClick={openReader} />
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Bulk bar */}
              {bulkMode && (
                <div className="inbox-bulk-bar" style={{ marginBottom: '0.75rem' }}>
                  <button
                    className="inbox-bulk-bar__btn"
                    onClick={() => {
                      if (bulkSelected.size >= filtered.length) setBulkSelected(new Set());
                      else setBulkSelected(new Set(filtered.map(i => i.id)));
                    }}
                  >
                    {bulkSelected.size >= filtered.length ? '☐ Bỏ chọn' : '☑ Chọn tất cả'}
                  </button>
                  {bulkSelected.size > 0 && (
                    <button
                      className="inbox-bulk-bar__btn inbox-bulk-bar__btn--delete"
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Xóa ${bulkSelected.size} bài viết?`,
                          message: 'Hành động này không thể hoàn tác.',
                          confirmLabel: 'Xóa tất cả',
                          danger: true,
                        });
                        if (!ok) return;
                        for (const id of bulkSelected) { await deleteItem(id); }
                        setBulkSelected(new Set());
                        setBulkMode(false);
                        fetchItems({});
                      }}
                    >
                      🗑 Xóa ({bulkSelected.size})
                    </button>
                  )}
                </div>
              )}
              <div className="kb-list">
                {filtered.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  {bulkMode && (
                    <label style={{ paddingTop: '1.1rem', cursor: 'pointer', flexShrink: 0 }}>
                      <input
                        type="checkbox"
                        checked={bulkSelected.has(item.id)}
                        onChange={() => setBulkSelected(prev => {
                          const next = new Set(prev);
                          if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                          return next;
                        })}
                        style={{ width: 18, height: 18, accentColor: 'var(--purple)', cursor: 'pointer' }}
                      />
                    </label>
                  )}
                  <div style={{ flex: 1 }}>
                    <ArticleCard item={item} onClick={openReader} onGroupClick={(g) => {
                      setActiveGroupView(g);
                      setTypeFilter('');
                      setSearch('');
                      groupsHook.fetchGroupArticles(g.id).then(setGroupArticles);
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </>
          )}
        </>
      )}
    </div>
  );
}
