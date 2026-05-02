import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Extension } from '@tiptap/core';
import { Suggestion } from '@tiptap/suggestion';
import { createRoot } from 'react-dom/client';

/* ── Slash Command Items ──────────────────────────────────────── */
const SLASH_ITEMS = [
  { icon: '¶',   title: 'Paragraph',     desc: 'Đoạn văn thông thường',      aliases: ['text','plain','p'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run() },
  { icon: 'H₁',  title: 'Heading 1',     desc: 'Tiêu đề lớn',                aliases: ['h1','title'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run() },
  { icon: 'H₂',  title: 'Heading 2',     desc: 'Tiêu đề trung',              aliases: ['h2','subtitle'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run() },
  { icon: 'H₃',  title: 'Heading 3',     desc: 'Tiêu đề nhỏ',                aliases: ['h3'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run() },
  { icon: '•',   title: 'Bullet List',   desc: 'Danh sách gạch đầu',         aliases: ['ul','unordered','list'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run() },
  { icon: '1.',  title: 'Numbered List', desc: 'Danh sách đánh số',           aliases: ['ol','ordered','number'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run() },
  { icon: '☑',   title: 'Task List',     desc: 'Danh sách checkbox',          aliases: ['todo','check','task'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run() },
  { icon: '"',   title: 'Blockquote',    desc: 'Trích dẫn',                   aliases: ['quote','bq'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run() },
  { icon: '</>', title: 'Code Block',    desc: 'Khối code',                   aliases: ['code','pre','snippet'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run() },
  { icon: '—',   title: 'Divider',       desc: 'Đường kẻ ngang',              aliases: ['hr','line','rule'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run() },
  { icon: '⊞',   title: 'Table',         desc: 'Bảng 3×3',                    aliases: ['grid','table'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { icon: '▌',   title: 'Highlight',     desc: 'Đánh dấu text',              aliases: ['mark','color','hl'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleHighlight().run() },
];

/* ── SlashCommandList (React UI) ──────────────────────────────── */
const SlashCommandList = forwardRef(function SlashCommandList(props, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef(null);

  // Reset selected index when items change
  useEffect(() => setSelectedIndex(0), [props.items]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector('.tp-slash-item--active');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Expose keyboard handlers to suggestion plugin
  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex(i => (i + props.items.length - 1) % props.items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex(i => (i + 1) % props.items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  const selectItem = useCallback((index) => {
    const item = props.items[index];
    if (item) props.command(item);
  }, [props.items, props.command]);

  if (!props.items.length) {
    return (
      <div className="tp-slash-menu">
        <div className="tp-slash-empty">Không tìm thấy lệnh</div>
      </div>
    );
  }

  return (
    <div className="tp-slash-menu" ref={listRef}>
      {props.items.map((item, i) => (
        <button
          key={item.title}
          className={`tp-slash-item${i === selectedIndex ? ' tp-slash-item--active' : ''}`}
          onClick={() => selectItem(i)}
          onMouseEnter={() => setSelectedIndex(i)}
        >
          <span className="tp-slash-item__icon">{item.icon}</span>
          <div className="tp-slash-item__text">
            <span className="tp-slash-item__title">{item.title}</span>
            <span className="tp-slash-item__desc">{item.desc}</span>
          </div>
        </button>
      ))}
    </div>
  );
});

/* ── Suggestion render() — React Portal lifecycle ─────────────── */
function createSuggestionRenderer() {
  let root = null;
  let container = null;
  let componentRef = { current: null };

  return {
    onStart: (props) => {
      container = document.createElement('div');
      container.className = 'tp-slash-portal';
      document.body.appendChild(container);
      root = createRoot(container);

      // Position near cursor
      const rect = props.clientRect?.();
      if (rect) {
        container.style.position = 'fixed';
        container.style.left = `${rect.left}px`;
        container.style.top = `${rect.bottom + 4}px`;
        container.style.zIndex = '9999';
      }

      root.render(
        <SlashCommandList
          ref={componentRef}
          items={props.items}
          command={props.command}
        />
      );
    },

    onUpdate: (props) => {
      if (!root || !container) return;

      const rect = props.clientRect?.();
      if (rect) {
        container.style.left = `${rect.left}px`;
        container.style.top = `${rect.bottom + 4}px`;
      }

      root.render(
        <SlashCommandList
          ref={componentRef}
          items={props.items}
          command={props.command}
        />
      );
    },

    onKeyDown: (props) => {
      if (props.event.key === 'Escape') {
        container?.remove();
        root?.unmount();
        root = null;
        container = null;
        return true;
      }
      return componentRef.current?.onKeyDown(props) ?? false;
    },

    onExit: () => {
      root?.unmount();
      container?.remove();
      root = null;
      container = null;
    },
  };
}

/* ── Tiptap Extension ─────────────────────────────────────────── */
export const SlashCommandExtension = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        items: ({ query }) => {
          const q = query.toLowerCase();
          return SLASH_ITEMS.filter(item =>
            item.title.toLowerCase().includes(q) ||
            item.aliases.some(a => a.includes(q))
          ).slice(0, 10); // max 10 results
        },
        render: createSuggestionRenderer,
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
