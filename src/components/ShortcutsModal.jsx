import { useState, useEffect } from 'react';
import AppIcon from './AppIcon';
// Style .tp-shortcuts-* nằm trong tiptap.css. Navbar import file này tĩnh nên tiptap.css vẫn ở bundle chính, đúng
// thứ tự CSS như trước khi tách; còn Tiptap (TiptapEditor.jsx) chỉ tải khi mở trình soạn / trang đọc.
import '../styles/tiptap.css';

/* ── Keyboard Shortcuts Data ──────────────────────────────────── */
const SHORTCUT_SECTIONS = [
  { title: 'Văn bản', icon: 'pencil', items: [
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
  { title: 'Khối & List', icon: 'squares', items: [
    { keys: ['Ctrl', 'Shift', '8'], label: 'Bullet List' },
    { keys: ['Ctrl', 'Shift', '7'], label: 'Ordered List' },
    { keys: ['Ctrl', 'Shift', '9'], label: 'Task List' },
    { keys: ['Ctrl', 'Shift', 'B'], label: 'Blockquote' },
    { keys: ['Ctrl', 'Alt', 'C'], label: 'Code Block' },
    { keys: ['Tab'], label: 'Thụt vào (trong list)' },
    { keys: ['Shift', 'Tab'], label: 'Lùi ra (trong list)' },
    { keys: ['Shift', 'Enter'], label: 'Xuống dòng (giữ đoạn)' },
  ]},
  { title: 'Gõ tắt Markdown', icon: 'note', items: [
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
  { title: 'Chung', icon: 'gear', items: [
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
  { title: 'Văn bản', icon: 'pencil', items: [
    { keys: ['Ctrl', 'B'], label: 'Bold **text**' },
    { keys: ['Ctrl', 'I'], label: 'Italic *text*' },
    { keys: ['Ctrl', 'Shift', 'X'], label: 'Strike ~~text~~' },
    { keys: ['Ctrl', 'E'], label: 'Code `text`' },
    { keys: ['Ctrl', 'K'], label: 'Link [text](url)' },
  ]},
  { title: 'Khối', icon: 'squares', items: [
    { keys: ['Ctrl', '1'], label: '# Heading 1' },
    { keys: ['Ctrl', '2'], label: '## Heading 2' },
    { keys: ['Ctrl', '3'], label: '### Heading 3' },
    { keys: ['Ctrl', 'Shift', '8'], label: '- Bullet List' },
    { keys: ['Ctrl', 'Shift', '7'], label: '1. Ordered List' },
    { keys: ['Ctrl', 'Shift', '9'], label: '- [ ] Task List' },
    { keys: ['Ctrl', 'Shift', 'B'], label: '> Blockquote' },
    { keys: ['Ctrl', 'Shift', 'C'], label: '``` Code Block' },
  ]},
  { title: 'Chung', icon: 'gear', items: [
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
          <span className="tp-shortcuts-title"><AppIcon name="keyboard" size={17} /> Phím tắt</span>
          <button className="tp-shortcuts-close" onClick={onClose} aria-label="Đóng"><AppIcon name="x" size={16} /></button>
        </div>

        {/* Tab switcher */}
        <div className="tp-shortcuts-tabs">
          <button
            className={`tp-shortcuts-tab${tab === 'tiptap' ? ' tp-shortcuts-tab--active' : ''}`}
            onClick={() => setTab('tiptap')}
          >
            <AppIcon name="sparkle" size={15} /> Visual Editor
          </button>
          <button
            className={`tp-shortcuts-tab${tab === 'markdown' ? ' tp-shortcuts-tab--active' : ''}`}
            onClick={() => setTab('markdown')}
          >
            <AppIcon name="pencil" size={15} /> Markdown
          </button>
        </div>

        <div className="tp-shortcuts-grid">
          {sections.map(section => (
            <div key={section.title} className="tp-shortcuts-section">
              <div className="tp-shortcuts-section-title"><AppIcon name={section.icon} size={14} /> {section.title}</div>
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
