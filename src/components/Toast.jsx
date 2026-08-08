import { useState, useCallback, useEffect, useRef } from 'react';
import '../styles/toast.css';
import AppIcon from './AppIcon';

/* ── Toast UI ─────────────────────────────────────────────────
   Drop-in replacement for window.alert() — thông báo 1 chiều, tự biến mất,
   KHÔNG chặn tương tác (khác ConfirmModal).

   Global usage (recommended) — gọi từ bất kỳ component/hook nào:
     import { useToast } from '../contexts/ToastContext';
     const { showToast } = useToast();
     showToast('📌 Task đã được tạo!');

   `useToastState` bên dưới chỉ dành cho ToastProvider dùng nội bộ để quản lý
   1 instance Toast duy nhất — không import trực tiếp ở nơi khác.
──────────────────────────────────────────────────────────────── */
export function Toast({ open, message, icon = 'checkCircle', onClose, duration = 3000 }) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    timerRef.current = setTimeout(() => onClose?.(), duration);
    return () => clearTimeout(timerRef.current);
  }, [open, duration, onClose]);

  if (!open) return null;

  return (
    <div className="toast" role="status" onClick={onClose}>
      <span className="toast__icon"><AppIcon name={icon} size={19} weight="duotone" /></span>
      <span className="toast__message">{message}</span>
    </div>
  );
}

/* ── useToastState ────────────────────────────────────────────
   Internal state manager — used once by ToastProvider. Returns { showToast, Toast }
──────────────────────────────────────────────────────────────── */
export function useToastState() {
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
