import '../styles/testimonials.css';

const TESTIMONIALS = [
  {
    id: 1,
    avatar: '👩‍💼',
    name: 'Nguyễn Linh',
    title: 'Marketing Manager',
    quote: 'Tôi đã thử nhiều app habit tracker nhưng đây là lần đầu tiên tôi giữ được chuỗi 21 ngày. Cái hay là nó không áp lực mà vẫn hiệu quả.',
    streak: 21,
    badge: '🏆',
  },
  {
    id: 2,
    avatar: '👨‍💻',
    name: 'Trần Minh',
    title: 'Software Developer',
    quote: 'Team mode với bạn cùng phòng thực sự khác hẳn. Biết có người nhìn vào progress của mình → tự nhiên không muốn bỏ.',
    streak: 14,
    badge: '🟡',
  },
  {
    id: 3,
    avatar: '🧑‍🎓',
    name: 'Phạm Hà',
    title: 'Sinh viên năm 3',
    quote: 'Daily Challenge mỗi ngày khác nhau giúp tôi không bị chán. Quiz não bộ thì thực sự thú vị, học được nhiều thứ về cách não hoạt động.',
    streak: 8,
    badge: '🟢',
  },
  {
    id: 4,
    avatar: '👩‍🏫',
    name: 'Lê Thu',
    title: 'Giáo viên Tiếng Anh',
    quote: 'Concept MVA bước đầu nghe lạ nhưng hiệu quả thật. Hôm nay chỉ cần mở vở ra là xong — và thực tế tôi đã học được 45 phút sau đó.',
    streak: 12,
    badge: '🟡',
  },
];

export default function TestimonialsSection() {
  return (
    <section className="section testimonials-section" id="testimonials">
      <div className="container">
        <div className="section-label">💬 Phản Hồi</div>
        <h2 className="display-2" style={{ marginBottom: '0.75rem' }}>
          Họ Đã <span className="gradient-text">Vượt Lười</span>
        </h2>
        <p className="section-desc">Thực tế từ những người đã hoàn thành thử thách</p>

        <div className="testimonials-grid">
          {TESTIMONIALS.map(t => (
            <div key={t.id} className="testimonial-card card">
              {/* Quote mark */}
              <div className="testimonial-quote-mark">"</div>

              <p className="testimonial-text">{t.quote}</p>

              <div className="testimonial-footer">
                <div className="testimonial-avatar">{t.avatar}</div>
                <div>
                  <div className="testimonial-name">{t.name}</div>
                  <div className="testimonial-title">{t.title}</div>
                </div>
                <div className="testimonial-streak">
                  <span>{t.badge}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {t.streak} ngày
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
