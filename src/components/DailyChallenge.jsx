import { useState, useMemo } from 'react';
import { useXpStore, XP_REWARDS } from '../hooks/useXpStore';
import '../styles/daily.css';

// 21 challenges — one per day of the program, seeded by date
const CHALLENGES = [
  { key: 'mva-morning',   type: 'MVA',        icon: '⚡', title: 'Hành Động Vi Mô Buổi Sáng',    desc: 'Chọn 1 việc nhỏ nhất có thể làm trong 2 phút. Làm ngay sau khi thức dậy.' },
  { key: 'reflection',    type: 'Reflection',  icon: '🪞', title: 'Nhìn Lại Ngày Qua',            desc: 'Viết 3 điều bạn đã làm được hôm qua, dù nhỏ đến đâu.' },
  { key: 'team-checkin',  type: 'Team',        icon: '🤝', title: 'Check-in Đồng Đội',            desc: 'Nhắn bạn đồng hành một tin: "Hôm nay tao làm được X rồi!"' },
  { key: 'no-excuse',     type: 'Challenge',   icon: '🛡', title: 'Không Lý Do',                   desc: 'Làm MVA của bạn mà không cần "cảm hứng" hay mood tốt. Just start.' },
  { key: 'dopamine-hack', type: 'Brain',       icon: '🧠', title: 'Dopamine Hack',                 desc: 'Tạo phần thưởng nhỏ ngay sau khi hoàn thành MVA (ăn gì ngon, xem clip 5 phút...)' },
  { key: 'environment',   type: 'System',      icon: '🏗', title: 'Thiết Kế Môi Trường',          desc: 'Đặt nhắc nhở vật lý (note, vật dụng) để trigger cho thói quen ngay tầm nhìn.' },
  { key: 'identity',      type: 'Mindset',     icon: '🎭', title: 'Xác Định Danh Tính',           desc: 'Viết câu: "Tôi là người ___". Điền vào thứ bạn muốn trở thành.' },
  { key: 'body-anchor',   type: 'MVA',         icon: '💪', title: 'Neo Cơ Thể',                   desc: 'Làm 3 cái hít đất ngay bây giờ. Ngay lúc này. Không cần thay đồ.' },
  { key: 'duo-challenge',  type: 'Team',       icon: '🔥', title: 'Duo Thử Thách',                desc: 'Cả bạn và teammate hoàn thành MVA trước 12PM hôm nay.' },
  { key: 'brain-break',   type: 'Brain',       icon: '🧬', title: 'Hiểu Não Của Bạn',            desc: 'Đọc lại bài "Dopamine System". Viết 1 điều bạn sẽ áp dụng hôm nay.' },
  { key: 'momentum',      type: 'System',      icon: '🌊', title: 'Quán Tính',                     desc: 'Làm MVA ngay sau khi đánh răng sáng nay — không delay, không nghĩ.' },
  { key: 'shrink-it',     type: 'MVA',         icon: '🔬', title: 'Thu Nhỏ Nó',                   desc: 'Nhiệm vụ của bạn hôm nay quá lớn? Cắt nó còn 20%. Chỉ làm phần đó thôi.' },
  { key: 'public-commit', type: 'Challenge',   icon: '📢', title: 'Cam Kết Công Khai',            desc: 'Post lên story / nhắn bạn bè: "Hôm nay tao sẽ làm X". Accountability ngoại lực.' },
  { key: 'win-journal',   type: 'Reflection',  icon: '📓', title: 'Nhật Ký Chiến Thắng',         desc: 'Viết 1 "chiến thắng nhỏ" trong ngày hôm nay vào notepad/điện thoại.' },
  { key: 'reset-ritual',  type: 'System',      icon: '🔄', title: 'Ritual Khởi Động Lại',        desc: 'Đã bỏ streak rồi? Làm MVA ngay bây giờ. Không cần đợi ngày mai.' },
  { key: 'amygdala',      type: 'Brain',       icon: '🛡', title: 'Vượt Amygdala',               desc: 'Cảm thấy lười/sợ bắt đầu? Đó là amygdala. Chỉ cần làm 1 bước đầu tiên.' },
  { key: 'stack-habit',   type: 'System',      icon: '🔗', title: 'Ghép Thói Quen',              desc: 'Gắn MVA vào sau 1 việc đã làm hàng ngày (pha cà phê, đánh răng...)' },
  { key: 'visualization', type: 'Mindset',     icon: '🎯', title: 'Hình Dung Kết Quả',           desc: 'Nhắm mắt 2 phút. Hình dung bạn sau 21 ngày sẽ như thế nào.' },
  { key: 'gratitude',     type: 'Reflection',  icon: '🙏', title: 'Biết Ơn Chính Mình',          desc: 'Viết 1 điều bạn tự hào về bản thân hôm nay.' },
  { key: 'deep-work',     type: 'Challenge',   icon: '🏔', title: 'Deep Work Mini',              desc: 'Làm MVA với điện thoại úp ngửa, không thông báo trong 15 phút.' },
  { key: 'final-boss',    type: 'Challenge',   icon: '🏆', title: 'Final Boss',                   desc: 'Ngày cuối! Làm MVA và chia sẻ hành trình 21 ngày của bạn với 1 người.' },
];

function getDailyChallengeKey() {
  const todayStr = new Date().toISOString().split('T')[0];
  // Deterministic seed from date string
  let hash = 0;
  for (let i = 0; i < todayStr.length; i++) {
    hash = ((hash << 5) - hash) + todayStr.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % CHALLENGES.length;
  return { challenge: CHALLENGES[idx], dateKey: todayStr };
}

const TYPE_COLORS = {
  MVA: 'cyan', Reflection: 'purple', Team: 'green',
  Challenge: 'gold', Brain: 'purple', System: 'cyan', Mindset: 'blue',
};

export default function DailyChallenge() {
  const { challenge, dateKey } = useMemo(getDailyChallengeKey, []);
  const { addXp, hasMilestone } = useXpStore();
  const doneKey = `vl_dc_${dateKey}`;
  const [done, setDone] = useState(() => !!localStorage.getItem(doneKey));
  const [showXpPop, setShowXpPop] = useState(false);

  const color = TYPE_COLORS[challenge.type] || 'purple';

  const handleComplete = () => {
    if (done) return;
    localStorage.setItem(doneKey, '1');
    setDone(true);
    if (!hasMilestone('daily_challenge', { date: dateKey })) {
      addXp(XP_REWARDS.daily_challenge, 'daily_challenge', { date: dateKey });
      setShowXpPop(true);
      setTimeout(() => setShowXpPop(false), 3000);
    }
  };

  return (
    <div className={`daily-challenge card daily-challenge--${color}`} id="daily-challenge">
      {showXpPop && (
        <div className="xp-toast">⚡ +{XP_REWARDS.daily_challenge} XP — Daily Challenge!</div>
      )}

      <div className="daily-challenge__header">
        <div className="section-label" style={{ margin: 0 }}>🎯 Daily Challenge</div>
        <span className={`badge badge-${color === 'gold' ? 'gold' : color === 'green' ? 'green' : 'cyan'}`}>
          {challenge.type}
        </span>
      </div>

      <div className="daily-challenge__icon">{challenge.icon}</div>
      <h3 className="h2" style={{ marginBottom: '0.5rem' }}>{challenge.title}</h3>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '1.25rem' }}>
        {challenge.desc}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          className={`btn ${done ? 'btn-ghost' : 'btn-primary'}`}
          onClick={handleComplete}
          disabled={done}
          id="daily-challenge-complete"
          style={{ opacity: done ? 0.7 : 1 }}
        >
          {done ? '✅ Đã Hoàn Thành!' : '⚡ Hoàn Thành — +20 XP'}
        </button>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Reset mỗi ngày lúc 00:00
        </span>
      </div>
    </div>
  );
}
