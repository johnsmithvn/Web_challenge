import { useState } from 'react';

/**
 * CustomJourneyModal
 * Simple modal to let user create a custom journey (no template).
 *
 * Props:
 *   onConfirm  — ({ title, targetDays, description }) => void
 *   onClose    — () => void
 *   loading    — boolean
 */

const DURATION_OPTIONS = [14, 21, 30, 60];

export default function CustomJourneyModal({ onConfirm, onClose, loading }) {
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [targetDays,  setTargetDays]  = useState(21);
  const [customDays,  setCustomDays]  = useState('');

  const activeDays = customDays ? parseInt(customDays) || 21 : targetDays;

  const handleSubmit = () => {
    const t = title.trim();
    if (!t) return;
    onConfirm({ title: t, description: description.trim() || null, targetDays: activeDays });
  };

  return (
    <div className="journey-modal-overlay" onClick={onClose}>
      <div className="journey-modal" onClick={e => e.stopPropagation()}>
        <h3>✏️ Tạo Lộ Trình Riêng</h3>

        <div className="journey-modal-field">
          <label>Tên lộ trình *</label>
          <input
            className="journey-modal-input"
            type="text"
            placeholder="VD: Kỷ luật sáng của tôi"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={60}
            autoFocus
          />
        </div>

        <div className="journey-modal-field">
          <label>Mô tả (tuỳ chọn)</label>
          <input
            className="journey-modal-input"
            type="text"
            placeholder="Mục tiêu của lộ trình này..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            maxLength={120}
          />
        </div>

        <div className="journey-modal-field">
          <label>Thời gian</label>
          <div className="journey-duration-grid">
            {DURATION_OPTIONS.map(d => (
              <button
                key={d}
                className={`journey-duration-btn ${!customDays && targetDays === d ? 'active' : ''}`}
                onClick={() => { setTargetDays(d); setCustomDays(''); }}
              >
                {d} ngày
              </button>
            ))}
            <input
              className="journey-modal-input journey-duration-btn"
              type="number"
              min="7"
              max="365"
              placeholder="Tuỳ chỉnh"
              value={customDays}
              onChange={e => { setCustomDays(e.target.value); }}
              style={{ gridColumn: 'span 4', textAlign: 'center', cursor: 'text' }}
            />
          </div>
        </div>

        <div className="journey-modal-actions">
          <button className="btn-modal-cancel" onClick={onClose} disabled={loading}>
            Huỷ
          </button>
          <button
            className="btn-modal-confirm"
            onClick={handleSubmit}
            disabled={!title.trim() || loading || activeDays < 7}
          >
            {loading ? '⏳ Đang tạo...' : '🚀 Bắt Đầu'}
          </button>
        </div>
      </div>
    </div>
  );
}
