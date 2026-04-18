import '../styles/testimonials.css';
import TESTIMONIALS from '../data/testimonials.json';


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
