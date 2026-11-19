import { createPortal } from 'react-dom';

/**
 * Đưa lớp nổi của Chốn (sheet, ngăn chi tiết, menu, hộp xác nhận) ra <body>.
 * `.chon-page` có `isolation: isolate` (để trời nằm dưới nội dung) nên mọi z-index bên trong bị nhốt dưới
 * thanh Life Hub / tab đáy của app — trên điện thoại nút ở chân sheet bị tab đáy che. `.chon-layer` mang
 * cùng token `--chon-*` (chon.css) nên giao diện không đổi.
 */
export default function ChonLayer({ children }) {
  if (typeof document === 'undefined') return null;
  return createPortal(<div className="chon-layer">{children}</div>, document.body);
}
