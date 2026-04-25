import '../styles/placeholder-page.css';

/**
 * InboxPage — Phase 6.4
 * Quick items chưa phân loại, classify → Collect/Task/Finance
 */
export default function InboxPage() {
  return (
    <div className="placeholder-page">
      <div className="placeholder-page__icon">📥</div>
      <h1 className="placeholder-page__title">Inbox</h1>
      <p className="placeholder-page__desc">
        Trạm trung chuyển — phân loại các ghi chú nhanh của bạn.
      </p>
      <div className="placeholder-page__badge">Coming Soon</div>
      <p className="placeholder-page__hint">
        Sử dụng nút <strong>+</strong> ở góc phải để ghi nhanh ý tưởng!
      </p>
    </div>
  );
}
