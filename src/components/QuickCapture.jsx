import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCollections } from '../hooks/useCollections';
import '../styles/quick-capture.css';

/**
 * QuickCapture — Global floating [+] button.
 * Appears on every page (except landing).
 * Captures raw text → inserts into `collections` table as type='inbox'.
 * Uses useCollections.addItem() for consistency with InboxPage.
 * Guest users see a prompt to login.
 */
export default function QuickCapture() {
  const { user } = useAuth();
  const { addItem } = useCollections();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  // Track where mousedown started — only close if mousedown AND mouseup both hit the backdrop
  const mouseDownTarget = useRef(null);

  // Auto-focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !user) return;

    setSaving(true);
    try {
      const isUrl = /^https?:\/\//i.test(trimmed);
      const words = trimmed.split(/\s+/);
      const isLong = words.length > 25 || trimmed.length > 100;

      // Auto-split: long text → truncated title + full body (same logic as InboxPage)
      let title = trimmed;
      let body = '';
      if (isLong && !isUrl) {
        title = words.slice(0, 25).join(' ') + (words.length > 25 ? '…' : '');
        body = trimmed; // full original text preserved in body
      }

      const result = await addItem({
        type: 'inbox',
        title,
        url: isUrl ? trimmed : null,
        body: body || null,
      });

      if (result) {
        setText('');
        setOpen(false);
      }
    } catch (err) {
      console.error('[QuickCapture] unexpected error:', err);
    } finally {
      setSaving(false);
    }
  };

  // Enter = submit, Shift+Enter = new line
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <>
      {/* Floating action button */}
      <button
        className={`qc-fab${open ? ' qc-fab--open' : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-label="Quick Capture"
        id="quick-capture-fab"
      >
        <span className="qc-fab__icon">{open ? '✕' : '+'}</span>
      </button>

      {/* Capture modal */}
      {open && (
        <div
          className="qc-backdrop"
          onMouseDown={(e) => { mouseDownTarget.current = e.target; }}
          onMouseUp={(e) => {
            if (mouseDownTarget.current === e.currentTarget && e.target === e.currentTarget) {
              setOpen(false);
            }
            mouseDownTarget.current = null;
          }}
        >
          <form
            className="qc-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
          >
            <div className="qc-modal__header">📥 Ghi nhanh vào Inbox</div>
            {user ? (
              <>
                <textarea
                  ref={inputRef}
                  className="qc-modal__input"
                  placeholder="Nhập ý tưởng, link, ghi chú..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={saving}
                  rows={2}
                />
                <div className="qc-modal__footer">
                  <span className="qc-modal__hint">Enter để lưu · Shift+Enter xuống dòng · Esc để hủy</span>
                  <button
                    type="submit"
                    className="btn btn-primary qc-modal__submit"
                    disabled={!text.trim() || saving}
                  >
                    {saving ? '...' : 'Lưu'}
                  </button>
                </div>
              </>
            ) : (
              <div className="qc-modal__guest">
                🔐 Đăng nhập để sử dụng Quick Capture
              </div>
            )}
          </form>
        </div>
      )}
    </>
  );
}
