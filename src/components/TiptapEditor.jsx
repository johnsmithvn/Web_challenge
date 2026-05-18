import { useState, useRef, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Link } from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Highlight } from '@tiptap/extension-highlight';
import { Typography } from '@tiptap/extension-typography';
import { Placeholder } from '@tiptap/extension-placeholder';
import { CharacterCount } from '@tiptap/extension-character-count';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Image as TiptapImage } from '@tiptap/extension-image';
import { Youtube } from '@tiptap/extension-youtube';
import { AudioNode } from '../extensions/AudioNode';
import { Undo2, Redo2, Bold, Italic, Underline as UnderlineIcon, Strikethrough, Highlighter, Code, Link as LinkIcon, Quote, List, ListOrdered, ListTodo, Minus, AlignLeft, AlignCenter, AlignRight, AlignJustify, ChevronDown, RemoveFormatting, Palette, Table as TableIcon, Heading1, Heading2, Heading3, Type, ImageIcon, Video, Music } from 'lucide-react';
import { SlashCommandExtension } from './SlashCommand';
import UrlInputPopover from './UrlInputPopover';
import '../styles/tiptap.css';

/* ── Keyboard Shortcuts Data ──────────────────────────────────── */
const SHORTCUT_SECTIONS = [
  { title: '✏️ Văn bản', items: [
    { keys: ['Ctrl', 'B'], label: 'Bold' },
    { keys: ['Ctrl', 'I'], label: 'Italic' },
    { keys: ['Ctrl', 'U'], label: 'Underline' },
    { keys: ['Ctrl', 'Shift', 'X'], label: 'Strikethrough' },
    { keys: ['Ctrl', 'Shift', 'H'], label: 'Highlight' },
    { keys: ['Ctrl', 'Shift', 'H'], label: 'Highlight' },
    { keys: ['Ctrl', 'E'], label: 'Inline Code' },
    { keys: ['Ctrl', 'Alt', '1'], label: 'Heading 1' },
    { keys: ['Ctrl', 'Alt', '2'], label: 'Heading 2' },
    { keys: ['Ctrl', 'Alt', '3'], label: 'Heading 3' },
    { keys: ['Ctrl', 'Shift', 'L'], label: 'Căn trái' },
    { keys: ['Ctrl', 'Shift', 'E'], label: 'Căn giữa' },
    { keys: ['Ctrl', 'Shift', 'R'], label: 'Căn phải' },
    { keys: ['Ctrl', 'Shift', 'J'], label: 'Căn đều' },
  ]},
  { title: '📐 Khối & List', items: [
    { keys: ['Ctrl', 'Shift', '8'], label: 'Bullet List' },
    { keys: ['Ctrl', 'Shift', '7'], label: 'Ordered List' },
    { keys: ['Ctrl', 'Shift', '9'], label: 'Task List' },
    { keys: ['Ctrl', 'Shift', 'B'], label: 'Blockquote' },
    { keys: ['Ctrl', 'Alt', 'C'], label: 'Code Block' },
    { keys: ['Tab'], label: 'Thụt vào (trong list)' },
    { keys: ['Shift', 'Tab'], label: 'Lùi ra (trong list)' },
    { keys: ['Shift', 'Enter'], label: 'Xuống dòng (giữ đoạn)' },
  ]},
  { title: '✍️ Gõ tắt Markdown', items: [
    { keys: ['#', 'Space'], label: '→ Heading 1' },
    { keys: ['##', 'Space'], label: '→ Heading 2' },
    { keys: ['###', 'Space'], label: '→ Heading 3' },
    { keys: ['-', 'Space'], label: '→ Bullet List' },
    { keys: ['1.', 'Space'], label: '→ Ordered List' },
    { keys: ['>', 'Space'], label: '→ Blockquote' },
    { keys: ['```'], label: '→ Code Block' },
    { keys: ['---'], label: '→ Đường kẻ ngang' },
    { keys: ['[]', 'Space'], label: '→ Task List' },
  ]},
  { title: '⚙️ Chung', items: [
    { keys: ['Ctrl', 'Z'], label: 'Undo' },
    { keys: ['Ctrl', 'Shift', 'Z'], label: 'Redo' },
    { keys: ['Ctrl', 'A'], label: 'Select All' },
    { keys: ['/'], label: 'Slash Menu (Chèn khối)' },
    { keys: ['Ctrl', '.'], label: 'Bảng phím tắt' },
    { keys: ['Ctrl', 'S'], label: 'Lưu bài viết' },
    { keys: ['Ctrl', 'V'], label: 'Paste (giữ format)' },
    { keys: ['Ctrl', 'Shift', 'V'], label: 'Paste (plain text)' },
  ]},
];

const MD_SHORTCUT_SECTIONS = [
  { title: '✏️ Văn bản', items: [
    { keys: ['Ctrl', 'B'], label: 'Bold **text**' },
    { keys: ['Ctrl', 'I'], label: 'Italic *text*' },
    { keys: ['Ctrl', 'Shift', 'X'], label: 'Strike ~~text~~' },
    { keys: ['Ctrl', 'E'], label: 'Code `text`' },
    { keys: ['Ctrl', 'K'], label: 'Link [text](url)' },
  ]},
  { title: '📐 Khối', items: [
    { keys: ['Ctrl', '1'], label: '# Heading 1' },
    { keys: ['Ctrl', '2'], label: '## Heading 2' },
    { keys: ['Ctrl', '3'], label: '### Heading 3' },
    { keys: ['Ctrl', 'Shift', '8'], label: '- Bullet List' },
    { keys: ['Ctrl', 'Shift', '7'], label: '1. Ordered List' },
    { keys: ['Ctrl', 'Shift', '9'], label: '- [ ] Task List' },
    { keys: ['Ctrl', 'Shift', 'B'], label: '> Blockquote' },
    { keys: ['Ctrl', 'Shift', 'C'], label: '``` Code Block' },
  ]},
  { title: '⚙️ Chung', items: [
    { keys: ['Ctrl', 'Z'], label: 'Undo' },
    { keys: ['Ctrl', 'Shift', 'Z'], label: 'Redo' },
    { keys: ['Ctrl', 'A'], label: 'Select All' },
    { keys: ['Ctrl', '.'], label: 'Bảng phím tắt' },
    { keys: ['Ctrl', 'S'], label: 'Lưu bài viết' },
    { keys: ['Ctrl', 'V'], label: 'Paste (giữ format)' },
    { keys: ['Ctrl', 'Shift', 'V'], label: 'Paste (plain text)' },
  ]},
];

/* ── Shortcuts Modal — 2 tabs: Visual (Tiptap) + Markdown ──────── */
export function ShortcutsModal({ open, onClose }) {
  const [tab, setTab] = useState('tiptap');

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;
  const sections = tab === 'markdown' ? MD_SHORTCUT_SECTIONS : SHORTCUT_SECTIONS;

  return (
    <div className="tp-shortcuts-overlay" onClick={onClose}>
      <div className="tp-shortcuts-modal" onClick={e => e.stopPropagation()}>
        <div className="tp-shortcuts-header">
          <span className="tp-shortcuts-title">⌨ Phím tắt</span>
          <button className="tp-shortcuts-close" onClick={onClose}>✕</button>
        </div>

        {/* Tab switcher */}
        <div className="tp-shortcuts-tabs">
          <button
            className={`tp-shortcuts-tab${tab === 'tiptap' ? ' tp-shortcuts-tab--active' : ''}`}
            onClick={() => setTab('tiptap')}
          >
            🎨 Visual Editor
          </button>
          <button
            className={`tp-shortcuts-tab${tab === 'markdown' ? ' tp-shortcuts-tab--active' : ''}`}
            onClick={() => setTab('markdown')}
          >
            ✍️ Markdown
          </button>
        </div>

        <div className="tp-shortcuts-grid">
          {sections.map(section => (
            <div key={section.title} className="tp-shortcuts-section">
              <div className="tp-shortcuts-section-title">{section.title}</div>
              {section.items.map(item => (
                <div key={item.label} className="tp-shortcuts-row">
                  <span className="tp-shortcuts-label">{item.label}</span>
                  <span className="tp-shortcuts-keys">
                    {item.keys.map((k, i) => (
                      <span key={i}>
                        <kbd className="tp-shortcuts-key">{k}</kbd>
                        {i < item.keys.length - 1 && <span className="tp-shortcuts-plus">+</span>}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Toolbar Button ─────────────────────────────────────────── */
function TBtn({ onClick, active, disabled, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className={`tp-btn${active ? ' tp-btn--active' : ''}`}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

function Divider() { return <span className="tp-divider" />; }

/* ── Inline Link Popover ────────────────────────────────────── */
function LinkPopover({ editor, open, onClose }) {
  const [url, setUrl] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setUrl(editor?.getAttributes('link').href || '');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, editor]);

  useEffect(() => {
    if (!open) return;
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;

  const apply = () => {
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      const href = url.startsWith('http') ? url : `https://${url}`;
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    onClose();
  };

  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    onClose();
  };

  return (
    <div className="tp-link-popover" onMouseDown={e => e.stopPropagation()}>
      <input
        ref={inputRef}
        className="tp-link-input"
        value={url}
        onChange={e => setUrl(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }}
        placeholder="https://..."
      />
      <button className="tp-link-btn tp-link-btn--apply" onMouseDown={e => { e.preventDefault(); apply(); }}>✓</button>
      {editor?.isActive('link') && (
        <button className="tp-link-btn tp-link-btn--remove" onMouseDown={e => { e.preventDefault(); remove(); }}>✕</button>
      )}
    </div>
  );
}

/* ── Tiptap Toolbar ─────────────────────────────────────────── */
function TiptapToolbar({ editor }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [mediaPopover, setMediaPopover] = useState(null); // null | 'image' | 'youtube' | 'audio'
  const toolbarRef = useRef(null);

  // Listen for slash command media events
  useEffect(() => {
    const handler = (e) => {
      const type = e.detail?.type;
      if (type) {
        setMediaPopover(type);
        setLinkOpen(false);
      }
    };
    document.addEventListener('tiptap:open-media', handler);
    return () => document.removeEventListener('tiptap:open-media', handler);
  }, []);

  if (!editor) return null;

  const openMedia = (type) => {
    setMediaPopover(prev => prev === type ? null : type);
    setLinkOpen(false);
  };

  const handleMediaSubmit = (url) => {
    if (mediaPopover === 'image') {
      editor.chain().focus().setImage({ src: url }).run();
    } else if (mediaPopover === 'youtube') {
      editor.chain().focus().setYoutubeVideo({ src: url }).run();
    } else if (mediaPopover === 'audio') {
      editor.chain().focus().setAudioBlock({ src: url, title: url.split('/').pop() || 'Audio' }).run();
    }
  };

  return (
    <div className="tp-toolbar-wrap" ref={toolbarRef}>
      <div className="tp-toolbar">
        {/* History */}
        <TBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)"><Undo2 size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Shift+Z)"><Redo2 size={15} /></TBtn>

        <Divider />

        {/* Headings */}
        <TBtn onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')} title="Normal text (Ctrl+Alt+0)"><Type size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1 (Ctrl+Alt+1)"><Heading1 size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2 (Ctrl+Alt+2)"><Heading2 size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3 (Ctrl+Alt+3)"><Heading3 size={15} /></TBtn>

        <Divider />

        {/* Text style */}
        <TBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)"><Bold size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)"><Italic size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (Ctrl+U)"><UnderlineIcon size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough (Ctrl+Shift+X)"><Strikethrough size={15} /></TBtn>

        {/* Colors */}
        <div className="tp-color-picker" title="Text Color">
          <Palette size={15} style={{ color: editor.getAttributes('textStyle').color || 'currentColor' }} />
          <input 
            type="color" 
            onInput={event => editor.chain().focus().setColor(event.target.value).run()}
            value={editor.getAttributes('textStyle').color || '#000000'}
          />
        </div>
        <TBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Highlight Color (Ctrl+Shift+H)"><Highlighter size={15} /></TBtn>

        <Divider />

        {/* Align */}
        <TBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left (Ctrl+Shift+L)"><AlignLeft size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align Center (Ctrl+Shift+E)"><AlignCenter size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right (Ctrl+Shift+R)"><AlignRight size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justify (Ctrl+Shift+J)"><AlignJustify size={15} /></TBtn>

        <Divider />

        {/* Lists */}
        <TBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list (Ctrl+Shift+8)"><List size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list (Ctrl+Shift+7)"><ListOrdered size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Task list (Ctrl+Shift+9)"><ListTodo size={15} /></TBtn>

        <Divider />

        {/* Blocks & Insert */}
        <TBtn
          onClick={() => setLinkOpen(v => !v)}
          active={editor.isActive('link') || linkOpen}
          title="Insert link (Ctrl+K)"
        ><LinkIcon size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table"><TableIcon size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code (Ctrl+E)"><Code size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote (Ctrl+Shift+B)"><Quote size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal line"><Minus size={15} /></TBtn>
        <TBtn onClick={() => openMedia('image')} active={mediaPopover === 'image'} title="Chèn ảnh (URL)"><ImageIcon size={15} /></TBtn>
        <TBtn onClick={() => openMedia('youtube')} active={mediaPopover === 'youtube'} title="Chèn YouTube video"><Video size={15} /></TBtn>
        <TBtn onClick={() => openMedia('audio')} active={mediaPopover === 'audio'} title="Chèn audio (URL)"><Music size={15} /></TBtn>
        <TBtn onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Clear formatting"><RemoveFormatting size={15} /></TBtn>

      </div>

      {/* Inline link popover — no window.prompt */}
      <LinkPopover editor={editor} open={linkOpen} onClose={() => setLinkOpen(false)} />
      <UrlInputPopover
        open={!!mediaPopover}
        onClose={() => setMediaPopover(null)}
        onSubmit={handleMediaSubmit}
        label={mediaPopover === 'image' ? 'URL ảnh' : mediaPopover === 'youtube' ? 'YouTube URL' : 'Audio URL'}
        placeholder={mediaPopover === 'image' ? 'https://example.com/photo.jpg' : mediaPopover === 'youtube' ? 'https://youtu.be/...' : 'https://example.com/audio.mp3'}
        icon={mediaPopover === 'image' ? '🖼️' : mediaPopover === 'youtube' ? '▶️' : '🎵'}
        allowUpload={mediaPopover === 'image' || mediaPopover === 'audio'}
        accept={mediaPopover === 'image' ? 'image/*' : mediaPopover === 'audio' ? 'audio/*' : undefined}
        anchorRef={toolbarRef}
      />
    </div>
  );
}

/* ── Auto-upload image helper (paste/drop) ──────────────────── */
async function uploadAndInsertImage(tr, view, file) {
  const { state } = view;
  const imageType = state.schema.nodes.image;
  if (!imageType) return;

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'images');

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) {
      showUploadToast('⚠ Upload thất bại — cần deploy Vercel + IMGUR_CLIENT_ID');
      return;
    }

    const data = await res.json();
    if (data.url) {
      const node = imageType.create({ src: data.url });
      view.dispatch(view.state.tr.replaceSelectionWith(node));
    } else {
      showUploadToast('⚠ Upload không trả về URL');
    }
  } catch {
    showUploadToast('⚠ Upload API không khả dụng (local dev). Dùng nút 🖼️ → nhập URL.');
  }
}

/** Simple toast notification for upload errors */
function showUploadToast(msg) {
  let toast = document.getElementById('tp-upload-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'tp-upload-toast';
    Object.assign(toast.style, {
      position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
      padding: '0.6rem 1.2rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: '600',
      background: 'rgba(239,68,68,0.9)', color: '#fff', zIndex: '9999',
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)', transition: 'opacity 0.3s',
    });
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 3500);
}

/* ── TiptapEditor (main export) ─────────────────────────────── */
export default function TiptapEditor({ value, onChange, onSave }) {
  const onSaveRef = useRef(onSave);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: { languageClassPrefix: 'language-' },
        // Disable bundled v3 versions — we configure these explicitly below
        link: false,
        underline: false,
      }),
      Link.configure({ openOnClick: false, autolink: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: false }),
      Typography,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Placeholder.configure({ placeholder: 'Gõ / để chèn khối · Ctrl+. xem phím tắt' }),
      CharacterCount,
      SlashCommandExtension,
      TiptapImage.configure({ inline: false, allowBase64: true }),
      Youtube.configure({ inline: false, nocookie: true }),
      AudioNode,
    ],
    content: (() => {
      if (!value) return '';
      try { return JSON.parse(value); }
      catch { return value; }
    })(),
    onUpdate: ({ editor }) => {
      const json = JSON.stringify(editor.getJSON());
      const text = editor.getText();
      const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
      const chars = editor.storage?.characterCount?.characters?.() ?? text.length;
      onChange(json, text, words, chars);
    },
    editorProps: {
      attributes: { class: 'tp-content' },
      handleKeyDown(view, event) {
        const mod = event.ctrlKey || event.metaKey;

        // Ctrl+S → trigger external save, prevent browser Save Page
        if (mod && event.key === 's') {
          event.preventDefault();
          if (onSaveRef.current) onSaveRef.current();
          return true;
        }

        // Ctrl+P → block browser Print dialog
        if (mod && event.key === 'p') {
          event.preventDefault();
          return true;
        }

        return false; // pass through all other keys
      },

      // Auto-upload pasted images → Imgur/R2
      // Ctrl+V = paste with formatting | Ctrl+Shift+V = paste plain text
      handlePaste(view, event) {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (const item of items) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) uploadAndInsertImage(view.state.tr, view, file);
            return true;
          }
        }
        return false;
      },

      // Auto-upload dropped images
      handleDrop(view, event) {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;

        const imageFile = [...files].find(f => f.type.startsWith('image/'));
        if (imageFile) {
          event.preventDefault();
          uploadAndInsertImage(view.state.tr, view, imageFile);
          return true;
        }
        return false;
      },
    },
  });

  const words = editor?.storage?.characterCount?.words?.() ?? 0;

  return (
    <div className="tp-editor">
      <TiptapToolbar editor={editor} />
      <div className="tp-body">
        <EditorContent editor={editor} className="tp-editor-content" />
      </div>
      <div className="tp-footer">
        <span>{words} từ</span>
        <span className="tp-footer-hint">Gõ <kbd>/</kbd> để chèn khối · <kbd>Ctrl+Shift+V</kbd> paste không format</span>
      </div>
    </div>
  );
}

/* ── TiptapReadOnly (for ReaderView) ────────────────────────── */
export function TiptapReadOnly({ content }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable bundled v3 versions — we configure Link explicitly below
        link: false,
      }),
      Link.configure({ openOnClick: true }),
      Table, TableRow, TableHeader, TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Typography,
      TiptapImage.configure({ inline: false }),
      Youtube.configure({ inline: false, nocookie: true }),
      AudioNode,
    ],
    content: (() => {
      if (!content) return '';
      try { return JSON.parse(content); }
      catch { return content; }
    })(),
    editable: false,
    editorProps: {
      attributes: { class: 'tp-content tp-content--readonly' },
    },
  });

  return (
    <div className="kb-prose tp-readonly">
      <EditorContent editor={editor} />
    </div>
  );
}
