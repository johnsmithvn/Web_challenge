import '../styles/sections.css';

const OLD_STEPS = [
  { icon: '😤', text: '"Lần này tao quyết tâm thật sự"' },
  { icon: '📋', text: 'Lập kế hoạch 30 trang' },
  { icon: '💪', text: 'Cố mấy ngày đầu bằng ý chí' },
  { icon: '😩', text: 'Mệt mỏi → bỏ cuộc' },
  { icon: '😞', text: 'Tự đổ lỗi → mất động lực' },
];

const NEW_STEPS = [
  { icon: '🎯', text: 'Chọn 1 MVA — nhỏ đến mức không thể từ chối' },
  { icon: '⚡', text: 'Làm 2 phút → não tiết dopamine' },
  { icon: '🔥', text: 'Streak tự nhiên hình thành' },
  { icon: '🤝', text: 'Partner accountability giữ bạn đi tiếp' },
  { icon: '🧠', text: 'Hiểu não bộ → kỷ luật trở thành bản năng' },
];

export default function ReverseSection() {
  return (
    <section className="section reverse-section" id="method">
      <div className="container">
        <div className="section-label">🔄 Chiến Thuật Đảo Ngược</div>
        <h2 className="display-2" style={{ marginBottom: '0.75rem' }}>
          Đây là lý do{' '}
          <span className="gradient-text">bạn cần đảo ngược</span>
        </h2>
        <p className="section-desc">
          Không phải cố gắng nhiều hơn — mà là làm theo đúng hướng
        </p>

        <div className="reverse-split">
          {/* Old */}
          <div className="reverse-panel reverse-panel--old">
            <div className="reverse-panel__header">❌ Lộ Trình Cũ (Thất Bại)</div>
            {OLD_STEPS.map((s, i) => (
              <div key={i} className="reverse-item">
                <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{s.icon}</span>
                <span>{s.text}</span>
              </div>
            ))}
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--radius-md)', color: '#f87171', fontWeight: 700, fontSize: '0.9rem' }}>
              Kết quả: Bỏ cuộc sau 2 tuần 😞
            </div>
          </div>

          {/* New */}
          <div className="reverse-panel reverse-panel--new">
            <div className="reverse-panel__header">✅ Chiến Thuật Đảo Ngược (Thành Công)</div>
            {NEW_STEPS.map((s, i) => (
              <div key={i} className="reverse-item">
                <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{s.icon}</span>
                <span>{s.text}</span>
              </div>
            ))}
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(0,255,136,0.08)', borderRadius: 'var(--radius-md)', color: 'var(--green)', fontWeight: 700, fontSize: '0.9rem' }}>
              Kết quả: Duy trì 21+ ngày 🏆
            </div>
          </div>
        </div>

        {/* Arrow connector */}
        <div style={{ textAlign: 'center', fontSize: '2rem', margin: '1rem 0', animation: 'float 2s ease-in-out infinite' }}>
          ⬇️
        </div>
        <div style={{ textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
          <blockquote style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', fontStyle: 'italic', borderLeft: '3px solid var(--purple)', paddingLeft: '1rem', textAlign: 'left' }}>
            "Kỷ luật không phải là thứ bạn CÓ — đó là thứ bạn XÂY DỰNG từng viên gạch nhỏ."
          </blockquote>
        </div>
      </div>
    </section>
  );
}
