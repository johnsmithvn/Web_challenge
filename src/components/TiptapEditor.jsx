import { useState, useRef, useEffect } from 'react';
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
import '../styles/tiptap.css';

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
      </div>

      {/* Inline link popover — no window.prompt */}
      <LinkPopover editor={editor} open={linkOpen} onClose={() => setLinkOpen(false)} />
    </div>
  );
}

/* ── TiptapEditor (main export) ─────────────────────────────── */
export default function TiptapEditor({ value, onChange }) {
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
      Placeholder.configure({ placeholder: 'Bắt đầu viết...' }),
      CharacterCount,
    ],
    content: (() => {
      if (!value) return '';
      try { return JSON.parse(value); }
      catch { return value; }
    })(),
    onUpdate: ({ editor }) => {
      const json = JSON.stringify(editor.getJSON());
      const text = editor.getText();
      onChange(json, text);
    },
    editorProps: {
      attributes: { class: 'tp-content' },
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
      </div>
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
