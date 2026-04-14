import { useState } from 'react';
import '../styles/sections.css';

const WEEKS = [
  {
    id: 1,
    label: 'Tuần 1',
    sublabel: 'Thử Thách Cá Nhân',
    desc: 'Chọn 1 thói quen tối thiểu (MVA). Tự mình thực hành, làm quen với nhịp độ kỷ luật nhẹ nhàng để lấy lại quán tính.',
    badge: '🟢 Lấy Đà',
    badgeCls: 'badge-green',
    tasks: [
      'Chọn 1 MVA (Minimum Viable Action)',
      'Thực hành mỗi sáng trong 7 ngày',
      'Tick checkbox vào cuối ngày',
      'Ghi nhận cảm xúc / khó khăn',
      'Không thay đổi MVA giữa chừng',
      'Tự review cuối tuần: gì hoạt động?',
    ],
  },
  {
    id: 2,
    label: 'Tuần 2',
    sublabel: 'Thử Thách Đồng Đội',
    desc: 'Bắt cặp cùng một người đồng hành. Dùng sức mạnh của trách nhiệm nhóm để duy trì kỷ luật và cổ vũ nhau.',
    badge: '🟡 Bứt Phá',
    badgeCls: 'badge-gold',
    tasks: [
      'Ghép cặp với 1 người đồng hành',
      'Báo cáo chéo mỗi ngày',
      'Cổ vũ nhau bằng reaction 👍🔥',
      'Xem tiến độ của nhau',
      'Gửi nhắc nhở nếu partner bỏ',
      'Duo streak: cả 2 cùng done mỗi ngày',
    ],
  },
  {
    id: 3,
    label: 'Tuần 3',
    sublabel: 'Giải Mã Não Bộ',
    desc: 'Sau khi đã quen với việc hành động, chúng ta mới học kiến thức não bộ để hiểu tại sao mình làm được — từ đó duy trì vĩnh viễn.',
    badge: '🏆 Hoàn Thành',
    badgeCls: 'badge-gold',
    tasks: [
      'Học cơ chế Dopamine Loop',
      'Hiểu tại sao Amygdala cản trở',
      'Thiết kế lại MVA theo khoa học',
      'Tối ưu môi trường (trigger stack)',
      'Viết habit plan dài hạn',
      'Chia sẻ kết quả với cộng đồng',
    ],
  },
];

export default function RoadmapSection() {
  const [openId, setOpenId] = useState(1);

  return (
    <section className="section roadmap-section" id="roadmap">
      <div className="container">
        <div className="section-label">🗓 Lộ Trình</div>
        <h2 className="display-2" style={{ marginBottom: '0.75rem' }}>
          Hành Trình <span className="gradient-text">3 Tuần</span>
        </h2>
        <p className="section-desc">Click từng tuần để xem nhiệm vụ chi tiết</p>

        <div className="roadmap-timeline">
          {WEEKS.map(week => (
            <div key={week.id} className="roadmap-item">
              <div
                className={`roadmap-node roadmap-node--${week.id}${openId === week.id ? ' active' : ''}`}
                onClick={() => setOpenId(openId === week.id ? null : week.id)}
                id={`roadmap-week-${week.id}`}
              >
                {week.label.replace('Tuần ', 'W')}
              </div>

              <div className="roadmap-body">
                <div
                  className="roadmap-title"
                  onClick={() => setOpenId(openId === week.id ? null : week.id)}
                >
                  {week.sublabel}
                  <span className={`badge ${week.badgeCls}`}>{week.badge}</span>
                  <span style={{ marginLeft: 'auto', opacity: 0.4, fontSize: '0.9rem' }}>
                    {openId === week.id ? '▲' : '▼'}
                  </span>
                </div>
                <p className="roadmap-desc">{week.desc}</p>

                {openId === week.id && (
                  <ul className={`roadmap-tasks roadmap-tasks--${week.id}`}>
                    {week.tasks.map((task, i) => (
                      <li key={i} className="roadmap-task">
                        <span className="roadmap-task-dot" />
                        {task}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
