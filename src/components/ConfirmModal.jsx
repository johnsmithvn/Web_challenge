import { useState, useCallback, useRef, useEffect } from 'react';
import '../styles/confirm-modal.css';

/* ── ConfirmModal UI ──────────────────────────────────────────
   Usage via hook (recommended):
     const { confirm, ConfirmModal } = useConfirm();
     <ConfirmModal />
     ...
     if (await confirm({ title: 'Xóa?', message: '...' })) { ... }

   Or standalone:
     <ConfirmModal
       open={open}
       title="Xóa bài viết?"
       message="Hành động này không thể hoàn tác."
       confirmLabel="Xóa"
       danger
       onConfirm={() => ...}
       onCancel={() => ...}
     />
──────────────────────────────────────────────────────────────── */
export function ConfirmModal({
  open = false,
  title = 'Xác nhận',
  message = '',
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  danger = false,
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null);

  // Focus confirm button when opened
  useEffect(() => {
    if (open && confirmRef.current) {
      setTimeout(() => confirmRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onCancel?.(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="cm-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel?.(); }}>
      <div className="cm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="cm-title">
        <div className="cm-icon">{danger ? '⚠️' : '❓'}</div>
        <h2 className="cm-title" id="cm-title">{title}</h2>
        {message && <p className="cm-message">{message}</p>}
        <div className="cm-actions">
          <button className="cm-btn cm-btn--cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            className={`cm-btn cm-btn--confirm${danger ? ' cm-btn--danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── useConfirm hook ──────────────────────────────────────────
   Drop-in replacement for window.confirm()
   Returns { confirm, ConfirmModal }
──────────────────────────────────────────────────────────────── */
export function useConfirm() {
  const [state, setState] = useState(null); // null | { resolve, title, message, ... }

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      setState({ resolve, ...options });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state?.resolve(true);
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    state?.resolve(false);
    setState(null);
  }, [state]);

  const Modal = state ? (
    <ConfirmModal
      open
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      danger={state.danger}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { confirm, ConfirmModal: Modal };
}

export default ConfirmModal;
