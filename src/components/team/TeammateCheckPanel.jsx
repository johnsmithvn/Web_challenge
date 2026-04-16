import { useState } from 'react';
// prop-types not installed — types documented via JSDoc

/**
 * TeammateCheckPanel — Modal/panel to check a teammate's day (Week 2 flow)
 *
 * Props:
 *   member      — target member object
 *   onSubmit    — fn(checkedId, status, reason)
 *   onClose     — fn()
 *   submitting  — boolean
 *   submitError — string
 */
export default function TeammateCheckPanel({ member, onSubmit, onClose, submitting, submitError }) {
  const [status, setStatus] = useState(null);   // true | false
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (status === null) return;
    onSubmit(member.id, status, reason);
  };

  const name = member?.display_name?.split(' ').slice(-1)[0] || 'người này';

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box team-check-panel">
        {/* Header */}
        <div className="team-check-panel__header">
          <div className="team-check-panel__avatar">
            {member?.avatar_url
              ? <img src={member.avatar_url} alt={member.display_name} />
              : <span>{member?.display_name?.[0]?.toUpperCase() || '👤'}</span>
            }
          </div>
          <div>
            <div className="team-check-panel__title">Check cho {member?.display_name}</div>
            <div className="team-check-panel__sub">Tuần 2 — Cần đồng đội xác nhận</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Question */}
        <div className="team-check-panel__question">
          🧐 Hôm nay <strong>{name}</strong> đã hoàn thành thử thách chưa?
        </div>

        {/* Choice buttons */}
        <div className="team-check-panel__choices">
          <button
            className={`team-check-choice team-check-choice--done ${status === true ? 'active' : ''}`}
            onClick={() => setStatus(true)}
            id="check-done"
          >
            <span className="choice-icon">✅</span>
            <span>Đã làm rồi!</span>
          </button>
          <button
            className={`team-check-choice team-check-choice--fail ${status === false ? 'active' : ''}`}
            onClick={() => setStatus(false)}
            id="check-fail"
          >
            <span className="choice-icon">❌</span>
            <span>Chưa làm</span>
          </button>
        </div>

        {/* Reason field — required on fail, optional on done */}
        {status !== null && (
          <div className="team-check-panel__reason">
            <label>
              {status === false
                ? '📝 Lý do không làm (bắt buộc)'
                : '💬 Ghi chú thêm (tuỳ chọn)'}
            </label>
            <textarea
              className="auth-input"
              placeholder={status === false ? 'VD: Thấy ngủ quên, không checkin...' : 'VD: Làm xong sớm lắm, 10 điểm!'}
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
              id="check-reason"
            />
          </div>
        )}

        {submitError && (
          <div className="auth-error" style={{ marginTop: '0.5rem' }}>{submitError}</div>
        )}

        {/* Submit */}
        <div className="team-check-panel__actions">
          <button className="btn btn-ghost" onClick={onClose} id="check-cancel">
            Huỷ
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={status === null || submitting || (status === false && !reason.trim())}
            id="check-submit"
          >
            {submitting ? '⏳ Đang lưu...' : '✓ Xác Nhận Check'}
          </button>
        </div>
      </div>
    </div>
  );
}


