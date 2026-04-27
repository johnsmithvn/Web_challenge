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
import { SlashCommandExtension } from './SlashCommand';
import '../styles/tiptap.css';

/* ── Keyboard Shortcuts Data ──────────────────────────────────── */
const SHORTCUT_SECTIONS = [
  { title: '✏️ Văn bản', items: [
    { keys: ['Ctrl', 'B'], label: 'Bold' },
    { keys: ['Ctrl', 'I'], label: 'Italic' },
    { keys: ['Ctrl', 'Shift', 'X'], label: 'Strikethrough' },
    { keys: ['Ctrl', 'Shift', 'H'], label: 'Highlight' },
    { keys: ['Ctrl', 'E'], label: 'Inline Code' },
    { keys: ['Ctrl', 'Alt', '1'], label: 'Heading 1' },
    { keys: ['Ctrl', 'Alt', '2'], label: 'Heading 2' },
    { keys: ['Ctrl', 'Alt', '3'], label: 'Heading 3' },
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
  ]},
];

/* ── Shortcuts Modal (shared) ─────────────────────────────────── */
export function ShortcutsModal({ open, onClose, sections }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;
  const data = sections || SHORTCUT_SECTIONS;

  return (
    <div className="tp-shortcuts-overlay" onClick={onClose}>
      <div className="tp-shortcuts-modal" onClick={e => e.stopPropagation()}>
        <div className="tp-shortcuts-header">
          <span className="tp-shortcuts-title">⌨ Phím tắt</span>
          <button className="tp-shortcuts-close" onClick={onClose}>✕</button>
        </div>
        <div className="tp-shortcuts-grid">
          {data.map(section => (
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

export { MD_SHORTCUT_SECTIONS };

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
function TiptapToolbar({ editor, onToggleShortcuts }) {
  const [linkOpen, setLinkOpen] = useState(false);
  if (!editor) return null;

  return (
    <div className="tp-toolbar-wrap">
      <div className="tp-toolbar">
        {/* Text style */}
        <TBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)"><strong>B</strong></TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)"><em>I</em></TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough"><s>S</s></TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Highlight">▌</TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code">`</TBtn>

        <Divider />

        {/* Headings */}
        <TBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">H1</TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">H2</TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">H3</TBtn>

        <Divider />

        {/* Lists */}
        <TBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">•</TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Ordered list">1.</TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Task list">☑</TBtn>

        <Divider />

        {/* Blocks */}
        <TBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">"</TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">{'</>'}</TBtn>
        <TBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">—</TBtn>

        <Divider />

        {/* Link — opens inline popover instead of window.prompt */}
        <TBtn
          onClick={() => setLinkOpen(v => !v)}
          active={editor.isActive('link') || linkOpen}
          title="Insert link"
        >🔗</TBtn>
        <TBtn
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          title="Insert table"
        >⊞</TBtn>

        <Divider />

        {/* History */}
        <TBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">↩</TBtn>
        <TBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">↪</TBtn>

        <Divider />

        {/* Shortcuts panel toggle */}
        <TBtn onClick={onToggleShortcuts} title="Phím tắt (Ctrl+.)">⌨</TBtn>
      </div>

      {/* Inline link popover — no window.prompt */}
      <LinkPopover editor={editor} open={linkOpen} onClose={() => setLinkOpen(false)} />
    </div>
  );
}

/* ── TiptapEditor (main export) ─────────────────────────────── */
export default function TiptapEditor({ value, onChange, onSave }) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const onSaveRef = useRef(onSave);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  const toggleShortcuts = useCallback(() => setShortcutsOpen(v => !v), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: { languageClassPrefix: 'language-' },
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
      Placeholder.configure({ placeholder: 'Gõ / để chèn khối · Ctrl+. xem phím tắt' }),
      CharacterCount,
      SlashCommandExtension,
    ],
    content: (() => {
      if (!value) return '';
      try { return JSON.parse(value); }
      catch { return value; }
    })(),
    onUpdate: ({ editor }) => {
      const json = JSON.stringify(editor.getJSON());
      const text = editor.getText();
      const words = editor.storage?.characterCount?.words?.() ?? 0;
      onChange(json, text, words);
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

        // Ctrl+. → toggle shortcuts panel
        if (mod && event.key === '.') {
          event.preventDefault();
          setShortcutsOpen(v => !v);
          return true;
        }

        return false; // pass through all other keys
      },
    },
  });

  const words = editor?.storage?.characterCount?.words?.() ?? 0;

  return (
    <div className="tp-editor">
      <TiptapToolbar editor={editor} onToggleShortcuts={toggleShortcuts} />
      <div className="tp-body">
        <EditorContent editor={editor} className="tp-editor-content" />
      </div>
      <div className="tp-footer">
        <span>{words} từ</span>
        <span className="tp-footer-hint">Gõ <kbd>/</kbd> để chèn · <kbd>Ctrl+.</kbd> phím tắt</span>
      </div>
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}

/* ── TiptapReadOnly (for ReaderView) ────────────────────────── */
export function TiptapReadOnly({ content }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: true }),
      Table, TableRow, TableHeader, TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Typography,
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
