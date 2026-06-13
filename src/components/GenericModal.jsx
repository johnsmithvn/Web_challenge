/**
 * GenericModal — Shared modal backdrop + container component.
 * 
 * Replaces `incubator-modal-backdrop` / `incubator-modal` CSS class coupling
 * across FinancePage and IncubatorPage with a proper shared component.
 *
 * Usage:
 *   <GenericModal onClose={handleClose} title="✏️ Sửa chi tiêu" maxWidth={380}>
 *     <GenericModal.Body>
 *       <label className="generic-modal__label">Số tiền</label>
 *       <input className="generic-modal__input" ... />
 *     </GenericModal.Body>
 *     <GenericModal.Footer>
 *       <button onClick={handleClose}>Huỷ</button>
 *       <button type="submit">Lưu</button>
 *     </GenericModal.Footer>
 *   </GenericModal>
 */
import '../styles/generic-modal.css';

export default function GenericModal({ onClose, title, maxWidth, children, className = '' }) {
  return (
    <div className="generic-modal-backdrop" onClick={onClose}>
      <div
        className={`generic-modal ${className}`}
        onClick={e => e.stopPropagation()}
        style={maxWidth ? { maxWidth } : undefined}
      >
        {title && (
          <div className="generic-modal__header">
            <span>{title}</span>
            <button className="generic-modal__close" onClick={onClose}>✕</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** Body section inside GenericModal */
GenericModal.Body = function ModalBody({ children }) {
  return <div className="generic-modal__body">{children}</div>;
};

/** Footer section inside GenericModal */
GenericModal.Footer = function ModalFooter({ children }) {
  return <div className="generic-modal__footer">{children}</div>;
};
