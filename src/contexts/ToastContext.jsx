import { createContext, useContext, useEffect } from 'react';
import { useToastState } from '../components/Toast';

/**
 * ToastContext — 1 instance Toast duy nhất mount ở App root, gọi được từ
 * bất kỳ component hay hook nào (kể cả bên trong hooks như useUserTasks)
 * mà không cần mỗi page tự useToastState() + render riêng.
 */
const ToastContext = createContext(null);

// Bridge cho code chạy ngoài React tree (vd ProseMirror paste/drop handler
// trong TiptapEditor) không thể gọi hook — xem showToast() export bên dưới.
let bridgeShowToast = null;

export function ToastProvider({ children }) {
  const { showToast, Toast } = useToastState();

  useEffect(() => {
    bridgeShowToast = showToast;
    return () => { bridgeShowToast = null; };
  }, [showToast]);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {Toast}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const showToast = useContext(ToastContext);
  return { showToast };
}

/** Dùng cho code không phải component/hook (vd ProseMirror plugin). */
export function showToast(message, options) {
  bridgeShowToast?.(message, options);
}
