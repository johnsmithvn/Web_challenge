import HeroSection from '../components/HeroSection';
import { ProblemSection, KnowledgeSection } from '../components/ContentSections';
import RoadmapSection from '../components/RoadmapSection';
import TrackerSection from '../components/TrackerSection';
import ReverseSection from '../components/ReverseSection';
import TestimonialsSection from '../components/TestimonialsSection';
import PricingSection from '../components/PricingSection';

export default function LandingPage() {
  return (
    <main>
      <HeroSection />
      <ProblemSection />
      <KnowledgeSection />
      <RoadmapSection />
      <TrackerSection />
      <ReverseSection />
      <TestimonialsSection />
      <PricingSection />
      <footer style={{
        background: 'var(--bg-secondary)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '2rem 0',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.85rem',
      }}>
        <div className="container">
          <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="#problem"       style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Vấn Đề</a>
            <a href="#knowledge"     style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Kiến Thức</a>
            <a href="#roadmap"       style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Lộ Trình</a>
            <a href="#tracker"       style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Tracker</a>
            <a href="#testimonials"  style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Phản Hồi</a>
            <a href="#pricing"       style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Tham Gia</a>
          </div>
          <div style={{ marginBottom: '0.5rem', fontSize: '1.2rem' }}>
            <span style={{ background: 'var(--grad-text)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              ⚡ Vượt Lười
            </span>
          </div>
          © 2026 Thử Thách Vượt Lười — Kỷ Luật Là Hệ Thống, Không Phải Ý Chí
        </div>
      </footer>
    </main>
  );
}
