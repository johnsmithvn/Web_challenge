import { useState, useCallback, useEffect, useRef } from 'react';
import '../styles/toast.css';

/* ── Toast UI ─────────────────────────────────────────────────
   Drop-in replacement for window.alert() — thông báo 1 chiều, tự biến mất,
   KHÔNG chặn tương tác (khác ConfirmModal).

   Usage via hook (recommended):
     const { showToast, Toast } = useToast();
     {Toast}
     ...
     showToast('📌 Task đã được tạo!');
──────────────────────────────────────────────────────────────── */
export function Toast({ open, message, icon = '✅', onClose, duration = 3000 }) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    timerRef.current = setTimeout(() => onClose?.(), duration);
    return () => clearTimeout(timerRef.current);
  }, [open, duration, onClose]);

  if (!open) return null;

  return (
    <div className="toast" role="status" onClick={onClose}>
      <span className="toast__icon">{icon}</span>
      <span className="toast__message">{message}</span>
    </div>
  );
}

/* ── useToast hook ────────────────────────────────────────────
   Returns { showToast, Toast }
──────────────────────────────────────────────────────────────── */
export function useToast() {
  const [state, setState] = useState(null); // null | { message, icon, duration }

  const showToast = useCallback((message, options = {}) => {
    setState({ message, ...options });
  }, []);

  const handleClose = useCallback(() => setState(null), []);

  const ToastEl = state ? (
    <Toast open message={state.message} icon={state.icon} duration={state.duration} onClose={handleClose} />
  ) : null;

  return { showToast, Toast: ToastEl };
}

export default Toast;
