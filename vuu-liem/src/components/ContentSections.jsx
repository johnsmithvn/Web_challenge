import { useState, useEffect, useRef } from 'react';
import '../styles/sections.css';

const approaches = {
  old: {
    label: '❌ Dùng ý chí',
    color: 'red',
    items: [
      { icon: '😤', text: '"Lần này tao phải kỷ luật hơn"' },
      { icon: '📋', text: 'Lập kế hoạch cực kỳ phức tạp' },
      { icon: '💪', text: 'Cố gắng bằng ý chí thuần túy' },
      { icon: '😩', text: 'Mệt → bỏ → tự trách bản thân' },
      { icon: '🔄', text: 'Vòng lặp thất bại lặp đi lặp lại' },
    ],
    result: '😞 Thất bại sau 1–2 tuần'
  },
  new: {
    label: '✅ Hiểu não bộ',
    color: 'green',
    items: [
      { icon: '🧠', text: 'Hiểu cách dopamine hoạt động' },
      { icon: '🎯', text: 'Chọn 1 hành động vi mô (MVA)' },
      { icon: '⚡', text: 'Bắt đầu cực nhỏ, không cần "cảm hứng"' },
      { icon: '🔥', text: 'Streak tự nhiên tạo đà' },
      { icon: '🏆', text: 'Hệ thống duy trì vĩnh viễn' },
    ],
    result: '🎉 Duy trì được 21 ngày+'
  }
};

const KNOWLEDGE_CARDS = [
  {
    id: 'dopamine',
    icon: '🧠',
    color: 'purple',
    title: 'Dopamine System',
    preview: 'Não bộ thưởng dopamine khi bạn hoàn thành — không phải khi bạn cố gắng.',
    example: 'Ví dụ: Đánh dấu ✓ vào checkbox → não tiết dopamine → bạn muốn làm tiếp',
    lesson: {
      title: '🧠 Hệ Thống Dopamine',
      content: [
        'Dopamine không phải là "hormone hạnh phúc" — đó là hormone **động lực**.',
        'Não bộ tiết dopamine khi **kỳ vọng phần thưởng**, không phải khi nhận phần thưởng.',
        'Trick: Làm nhỏ để não "cảm thấy" thành công → dopamine → muốn làm thêm.',
        '**MVA (Minimum Viable Action)**: Chỉ cần làm 2 phút. Não đã coi đó là thành công.',
      ]
    }
  },
  {
    id: 'amygdala',
    icon: '🛡',
    color: 'cyan',
    title: 'Vượt Kháng Cự',
    preview: 'Amygdala coi mọi thứ mới là "nguy hiểm" — đó là lý do bạn lười.',
    example: 'Ví dụ: Bắt đầu tập gym → amygdala báo động "khó quá → thôi đi"',
    lesson: {
      title: '🛡 Amygdala & Kháng Cự',
      content: [
        'Amygdala là phần não nguyên thủy xử lý **sợ hãi và né tránh**.',
        'Khi gặp nhiệm vụ mới/khó: amygdala kích hoạt → cơ thể "đóng băng".',
        'Giải pháp: Thu nhỏ nhiệm vụ đến mức não không thấy đe doạ.',
        '**"Tôi chỉ cần mở trang sách ra"** — đủ để amygdala thả lỏng.',
      ]
    }
  },
  {
    id: 'mva',
    icon: '⚡',
    color: 'gold',
    title: 'Hành Động Vi Mô (MVA)',
    preview: 'Minimum Viable Action — hành động nhỏ nhất bạn không thể từ chối.',
    example: 'Ví dụ: Không tập 30 phút. Chỉ cần mang giày thể thao ra. Đó là MVA.',
    lesson: {
      title: '⚡ MVA — Hành Động Vi Mô',
      content: [
        'MVA = hành động **nhỏ đến mức buồn cười** nhưng đủ để bắt đầu.',
        'Nguyên tắc: Nếu bạn "không muốn làm", MVA còn quá lớn.',
        'Ví dụ MVA: Mở laptop → mở file → gõ 1 chữ → done.',
        'Sau MVA, **quán tính** tự nhiên kéo bạn tiếp tục (Newton đúng với não bộ).',
      ]
    }
  }
];

function KnowledgeCard({ card, onOpen }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className={`k-card card card-glow-${card.color}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onOpen(card)}
      id={`knowledge-card-${card.id}`}
    >
      <div className={`k-card__icon k-card__icon--${card.color}`}>{card.icon}</div>
      <h3 className="h3" style={{ margin: '0.75rem 0 0.5rem' }}>{card.title}</h3>
      <p className="k-card__preview">{card.preview}</p>
      {hovered && (
        <div className="k-card__example">
          <span className="k-card__example-label">💡 Ví dụ thực tế</span>
          <p>{card.example}</p>
        </div>
      )}
      <button className={`k-card__btn btn-${card.color === 'gold' ? 'gold' : card.color === 'cyan' ? 'neon' : 'ghost'} btn`} style={{ marginTop: '1rem', fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
        Xem chi tiết →
      </button>
    </div>
  );
}

function MiniLesson({ card, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="h2" style={{ marginBottom: '1.5rem' }}>{card.lesson.title}</h2>
        <div className="mini-lesson__content">
          {card.lesson.content.map((line, i) => (
            <div key={i} className="mini-lesson__item">
              <span className="mini-lesson__num">{i + 1}</span>
              <p dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
          ))}
        </div>
        <div className={`badge badge-${card.color === 'gold' ? 'gold' : card.color === 'cyan' ? 'cyan' : 'purple'}`} style={{ marginTop: '1.5rem' }}>
          {card.icon} {card.title}
        </div>
      </div>
    </div>
  );
}

function ProblemSection() {
  const [active, setActive] = useState('old');
  const current = approaches[active];

  return (
    <section className="section problem-section" id="problem">
      <div className="container">
        <div className="section-label">🤔 Vấn Đề</div>
        <h2 className="display-2" style={{ marginBottom: '1rem' }}>
          Tại sao bạn <span className="gradient-text">thất bại?</span>
        </h2>
        <p className="section-desc">Không phải vì bạn lười. Vì bạn dùng sai công cụ.</p>

        {/* Toggle */}
        <div className="problem__toggle">
          <button
            className={`problem__toggle-btn ${active === 'old' ? 'active-red' : ''}`}
            onClick={() => setActive('old')}
            id="toggle-old-approach"
          >
            ❌ Dùng ý chí
          </button>
          <button
            className={`problem__toggle-btn ${active === 'new' ? 'active-green' : ''}`}
            onClick={() => setActive('new')}
            id="toggle-new-approach"
          >
            ✅ Hiểu não bộ
          </button>
        </div>

        {/* Content panel */}
        <div className={`problem__panel glass-panel problem__panel--${current.color}`} key={active}>
          <div className="problem__items">
            {current.items.map((item, i) => (
              <div key={i} className="problem__item" style={{ animationDelay: `${i * 0.08}s` }}>
                <span className="problem__item-icon">{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
          <div className={`problem__result problem__result--${current.color}`}>
            {current.result}
          </div>
        </div>
      </div>
    </section>
  );
}

function KnowledgeSection() {
  const [openCard, setOpenCard] = useState(null);
  return (
    <section className="section" id="knowledge">
      <div className="container">
        <div className="section-label">🧬 Kiến Thức Cốt Lõi</div>
        <h2 className="display-2" style={{ marginBottom: '0.75rem' }}>
          3 Bí Mật <span className="gradient-text">Não Bộ</span>
        </h2>
        <p className="section-desc">Hover để xem ví dụ • Click để học chi tiết</p>

        <div className="k-grid">
          {KNOWLEDGE_CARDS.map(card => (
            <KnowledgeCard key={card.id} card={card} onOpen={setOpenCard} />
          ))}
        </div>
      </div>
      {openCard && <MiniLesson card={openCard} onClose={() => setOpenCard(null)} />}
    </section>
  );
}

export { ProblemSection, KnowledgeSection };
