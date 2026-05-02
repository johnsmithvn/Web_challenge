import { useState } from 'react';
// prop-types not installed — types documented via JSDoc

/**
 * JoinSyncModal — shown when user joins a team while already having a running program
 *
 * Props:
 *   currentWeek — current user's week number (1–3)
 *   teamName    — string
 *   onChoice    — fn('restart' | 'continue')
 *   onClose     — fn()
 */
export default function JoinSyncModal({ currentWeek, teamName, onChoice, onClose }) {
  const [selected, setSelected] = useState(null); // 'restart' | 'continue'

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box join-sync-modal">
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="join-sync-modal__icon">🤝</div>
        <h2 className="join-sync-modal__title">Tham gia {teamName || 'Team'}</h2>
        <p className="join-sync-modal__sub">
          Bạn đang ở <strong>Tuần {currentWeek}</strong> của chương trình. Bạn muốn:
        </p>

        <div className="join-sync-options">
          {/* Option A: Restart */}
          <button
            className={`join-sync-option ${selected === 'restart' ? 'selected' : ''}`}
            onClick={() => setSelected('restart')}
            id="sync-restart"
          >
            <div className="join-sync-option__radio">
              <span className={selected === 'restart' ? 'radio-dot active' : 'radio-dot'} />
            </div>
            <div className="join-sync-option__content">
              <div className="join-sync-option__title">🔄 Bắt đầu lại từ Tuần 1 cùng nhóm</div>
              <div className="join-sync-option__desc">
                Cả nhóm cùng xuất phát từ đầu. Data cũ vẫn được giữ lại, không bị xóa.
              </div>
            </div>
          </button>

          {/* Option B: Continue */}
          <button
            className={`join-sync-option ${selected === 'continue' ? 'selected' : ''}`}
            onClick={() => setSelected('continue')}
            id="sync-continue"
          >
            <div className="join-sync-option__radio">
              <span className={selected === 'continue' ? 'radio-dot active' : 'radio-dot'} />
            </div>
            <div className="join-sync-option__content">
              <div className="join-sync-option__title">▶ Tiếp tục Tuần {currentWeek} của mình</div>
              <div className="join-sync-option__desc">
                Mỗi người đi theo lộ trình riêng. Teammate sẽ check cho bạn khi bạn lên Tuần 2.
              </div>
            </div>
          </button>
        </div>

        <div className="join-sync-modal__actions">
          <button className="btn btn-ghost" onClick={onClose} id="sync-cancel">
            Huỷ
          </button>
          <button
            className="btn btn-primary"
            disabled={!selected}
            onClick={() => selected && onChoice(selected)}
            id="sync-confirm"
          >
            Xác Nhận
          </button>
        </div>
      </div>
    </div>
  );
}


