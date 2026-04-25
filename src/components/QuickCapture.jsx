import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import supabase from '../lib/supabase';
import '../styles/quick-capture.css';

/**
 * QuickCapture — Global floating [+] button.
 * Appears on every page (except landing).
 * Captures raw text → inserts into `collections` table as type='inbox'.
 * Guest users see a prompt to login.
 */
export default function QuickCapture() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

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
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !user) return;

    setSaving(true);
    try {
      // Detect if the text looks like a URL
      const isUrl = /^https?:\/\//i.test(trimmed);

      const { error } = await supabase.from('collections').insert({
        user_id: user.id,
        type: 'inbox',
        title: trimmed,
        url: isUrl ? trimmed : null,
        status: 'inbox',
      });

      if (error) {
        console.error('[QuickCapture] insert error:', error.message);
      } else {
        setText('');
        setOpen(false);
      }
    } catch (err) {
      console.error('[QuickCapture] unexpected error:', err);
    } finally {
      setSaving(false);
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
        <div className="qc-backdrop" onClick={() => setOpen(false)}>
          <form
            className="qc-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
          >
            <div className="qc-modal__header">📥 Ghi nhanh vào Inbox</div>
            {user ? (
              <>
                <input
                  ref={inputRef}
                  className="qc-modal__input"
                  type="text"
                  placeholder="Nhập ý tưởng, link, ghi chú..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={500}
                  disabled={saving}
                />
                <div className="qc-modal__footer">
                  <span className="qc-modal__hint">Enter để lưu · Esc để hủy</span>
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
