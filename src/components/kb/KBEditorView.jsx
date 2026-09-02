import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  TYPE_GLYPHS,
  markdownToPlainText,
  tiptapToPlainText,
  readTime,
  parseWikiLinks,
} from '../../utils/kbDeriveUtils';
import UrlInputPopover from '../UrlInputPopover';

const TiptapEditor = lazy(() => import('../TiptapEditor'));

const REMARK_PLUGINS = [remarkGfm];
const EDITOR_MODE_KEY = 'kb_editor_mode';

export default function KBEditorView({
  initial,
  onSave,
  onCancel,
  isSaving,
  suggestions = [],
  isNew = false,
  onOpenLinkModal,
}) {
  const savedMode = localStorage.getItem(EDITOR_MODE_KEY) || 'markdown';
  const initialFormat = initial?.content_format || (isNew ? savedMode : (initial?.body?.startsWith('{"type":"doc"') ? 'tiptap' : 'markdown'));

  const [draft, setDraft] = useState(() => ({
    id: initial?.id,
    title: initial?.title || '',
    body: initial?.body || '',
    body_text: initial?.body_text || '',
    tags: initial?._tags || initial?.tags || [],
    type: initial?.type || 'note',
    url: initial?.url || '',
    content_format: initialFormat,
  }));

  const [tagInput, setTagInput] = useState('');
  const [mdMediaPopover, setMdMediaPopover] = useState(null);
  const mdTextareaRef = useRef(null);
  const mdToolbarRef = useRef(null);

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  // Word count & stats
  const bodyText = draft.content_format === 'markdown'
    ? markdownToPlainText(draft.body)
    : (draft.body_text || (draft.body?.startsWith('{') ? tiptapToPlainText(draft.body) : draft.body));

  const words = bodyText.trim().split(/\s+/).filter(Boolean).length;
  const mins = readTime(bodyText);
  const wikiLinksCount = parseWikiLinks(draft.body || '').length;

  const canSave = draft.title.trim().length > 0;

  const handleSave = () => {
    if (!canSave || isSaving) return;
    const text = draft.content_format === 'markdown' ? markdownToPlainText(draft.body) : draft.body_text;
    const wc = text.trim().split(/\s+/).filter(Boolean).length;
    onSave({
      ...draft,
      body_text: text,
      word_count: wc,
    });
  };

  // Switch between Markdown and Visual
  const switchFormat = (fmt) => {
    localStorage.setItem(EDITOR_MODE_KEY, fmt);
    set('content_format', fmt);
  };

  // Markdown insert helper
  const insertMd = useCallback((before, after = '', placeholder = '') => {
    const ta = mdTextareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = ta.value.slice(start, end) || placeholder;
    const next = ta.value.slice(0, start) + before + sel + after + ta.value.slice(end);
    set('body', next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + sel.length;
    });
  }, []);

  const insertLine = useCallback((prefix) => {
    const ta = mdTextareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1;
    const next = ta.value.slice(0, lineStart) + prefix + ta.value.slice(lineStart);
    set('body', next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + prefix.length;
    });
  }, []);

  // Keyboard shortcut listener (⌘S to save, ⌘K for link)
  useEffect(() => {
    const handler = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canSave, isSaving, draft]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tag add/remove
  const handleAddTag = (name) => {
    const clean = name.trim().replace(/^#/, '');
    if (!clean) return;
    const tagNames = draft.tags.map(t => typeof t === 'string' ? t : t.name);
    if (!tagNames.includes(clean)) {
      set('tags', [...draft.tags, { name: clean, color: 'var(--kb-dim)' }]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (name) => {
    set('tags', draft.tags.filter(t => (typeof t === 'string' ? t : t.name) !== name));
  };

  return (
    <div className="kb-editor" style={{ animation: 'kb-in .22s ease' }}>
      {/* Top action bar */}
      <div className="kb-editor__bar">
        <button className="kb-back-btn" onClick={onCancel}>← Hủy</button>

        {/* Editor mode toggle */}
        <div className="kb-segmented kb-segmented--small">
          <button
            className={`kb-segmented__item${draft.content_format === 'markdown' ? ' kb-segmented__item--active' : ''}`}
            onClick={() => switchFormat('markdown')}
          >
            Markdown
          </button>
          <button
            className={`kb-segmented__item${draft.content_format === 'tiptap' ? ' kb-segmented__item--active' : ''}`}
            onClick={() => switchFormat('tiptap')}
          >
            Trực quan
          </button>
        </div>

        {/* Stats */}
        <div className="kb-editor__stats">
          <span>{words} từ · {wikiLinksCount} liên kết · {mins} phút đọc</span>
        </div>

        {/* Link picker modal trigger */}
        {onOpenLinkModal && (
          <button className="kb-btn-ghost kb-btn-ghost--small" onClick={onOpenLinkModal}>
            [[ Liên kết ]]
          </button>
        )}

        {/* Save button */}
        <button
          className="kb-btn-primary"
          disabled={!canSave || isSaving}
          onClick={handleSave}
        >
          {isSaving ? 'Đang lưu…' : 'Lưu · ⌘S'}
        </button>
      </div>

      {/* Header section: Title + Types + Tags + URL */}
      <div className="kb-editor__title-wrap">
        <input
          className="kb-editor__title-input"
          placeholder="Tiêu đề bài viết"
          value={draft.title}
          onChange={e => set('title', e.target.value)}
          autoFocus
        />

        <div className="kb-editor__meta-row">
          {/* Type chips */}
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {Object.entries(TYPE_GLYPHS).map(([key, m]) => (
              <button
                key={key}
                className={`kb-type-chip${draft.type === key ? ' kb-type-chip--active' : ''}`}
                onClick={() => set('type', key)}
              >
                <span className="kb-type-chip__dot" style={{ background: `var(${m.hueVar})` }} />
                {m.label}
              </button>
            ))}
          </div>

          <span className="kb-editor__meta-sep" />

          {/* Tags */}
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
            {draft.tags.map(t => {
              const name = typeof t === 'string' ? t : t.name;
              return (
                <span key={name} className="kb-tag-chip kb-tag-chip--edit">
                  #{name}
                  <button className="kb-tag-chip__rm" onClick={() => handleRemoveTag(name)}>×</button>
                </span>
              );
            })}
            <input
              className="kb-tag-input__field"
              placeholder="+ thẻ"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag(tagInput);
                } else if (e.key === 'Backspace' && !tagInput && draft.tags.length > 0) {
                  const last = draft.tags[draft.tags.length - 1];
                  handleRemoveTag(typeof last === 'string' ? last : last.name);
                }
              }}
            />
          </div>

          <span className="kb-editor__meta-sep" />

          {/* URL input */}
          <input
            type="text"
            style={{
              background: 'transparent',
              border: 'none',
              fontFamily: 'var(--kb-mono)',
              fontSize: '0.85rem',
              color: 'var(--kb-dim)',
              outline: 'none',
              minWidth: '160px',
            }}
            placeholder="URL nguồn (tùy chọn)"
            value={draft.url || ''}
            onChange={e => set('url', e.target.value)}
          />
        </div>
      </div>

      {/* Body editor */}
      <div className="kb-editor__body">
        {draft.content_format === 'tiptap' ? (
          <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 30px 90px' }}>
            <Suspense fallback={<div className="kb-loading">Đang tải trình soạn thảo...</div>}>
              <TiptapEditor
                value={draft.body}
                onChange={(json, text) => setDraft(d => ({ ...d, body: json, body_text: text }))}
                onSave={handleSave}
              />
            </Suspense>
          </div>
        ) : (
          <div className="kb-split">
            {/* Markdown toolbar */}
            <div className="kb-tb" ref={mdToolbarRef}>
              <button type="button" className="kb-tb-btn" onClick={() => insertMd('**', '**', 'đậm')}>B</button>
              <button type="button" className="kb-tb-btn" onClick={() => insertMd('*', '*', 'nghiêng')}>I</button>
              <button type="button" className="kb-tb-btn" onClick={() => insertLine('## ')}>H2</button>
              <button type="button" className="kb-tb-btn" onClick={() => insertLine('### ')}>H3</button>
              <button type="button" className="kb-tb-btn" onClick={() => insertLine('> ')}>Trích dẫn</button>
              <button type="button" className="kb-tb-btn" onClick={() => insertLine('- ')}>• Danh sách</button>
              <button type="button" className="kb-tb-btn" onClick={() => insertLine('1. ')}>1. Số</button>
              <button type="button" className="kb-tb-btn" onClick={() => insertMd('`', '`', 'code')}>Code</button>
              <button type="button" className="kb-tb-btn" onClick={() => insertMd('[[', ']]', 'Tên bài')}>[[ Wiki ]]</button>
              <span className="kb-tb-divider" />
              <button type="button" className="kb-tb-btn" onClick={() => setMdMediaPopover('image')}>Ảnh</button>
              <button type="button" className="kb-tb-btn" onClick={() => setMdMediaPopover('video')}>Video</button>
              <button type="button" className="kb-tb-btn" onClick={() => setMdMediaPopover('audio')}>Audio</button>
            </div>

            {/* Media Popover */}
            <UrlInputPopover
              open={!!mdMediaPopover}
              onClose={() => setMdMediaPopover(null)}
              onSubmit={(url) => {
                if (mdMediaPopover === 'image') insertMd('\n![', `](${url})\n`, 'mô tả ảnh');
                else if (mdMediaPopover === 'video') insertMd('\n[Video](', `${url})\n`);
                else if (mdMediaPopover === 'audio') insertMd('\n[Audio](', `${url})\n`);
              }}
              label={mdMediaPopover === 'image' ? 'URL ảnh' : mdMediaPopover === 'video' ? 'Video/YouTube URL' : 'Audio URL'}
              placeholder="https://..."
              icon={mdMediaPopover === 'image' ? 'image' : mdMediaPopover === 'video' ? 'play' : 'music'}
              anchorRef={mdToolbarRef}
            />

            {/* Split Panes */}
            <div className="kb-split__panes">
              {/* Write pane */}
              <div className="kb-split__pane kb-split__pane--write">
                <div className="kb-split__label">Markdown</div>
                <textarea
                  ref={mdTextareaRef}
                  className="kb-split__textarea"
                  value={draft.body}
                  onChange={e => set('body', e.target.value)}
                  placeholder="## Tiêu đề mục&#10;&#10;Viết markdown. [[Tên bài]] để tạo liên kết wiki..."
                  spellCheck={false}
                  onKeyDown={e => {
                    // Trigger wiki-link on "[["
                    if (e.key === '[' && mdTextareaRef.current) {
                      const val = mdTextareaRef.current.value;
                      const selStart = mdTextareaRef.current.selectionStart;
                      if (val.slice(0, selStart).endsWith('[')) {
                        // user typed second '['
                        if (onOpenLinkModal) {
                          e.preventDefault();
                          insertMd('[', ']]', 'Tên bài');
                        }
                      }
                    }
                  }}
                />
              </div>

              {/* Preview pane */}
              <div className="kb-split__pane kb-split__pane--preview">
                <div className="kb-split__label">Xem trước</div>
                <div className="kb-prose kb-split__preview">
                  {draft.body ? (
                    <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>
                      {draft.body}
                    </ReactMarkdown>
                  ) : (
                    <p style={{ color: 'var(--kb-faint)', fontStyle: 'italic' }}>Bản xem trước sẽ hiện ở đây…</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
