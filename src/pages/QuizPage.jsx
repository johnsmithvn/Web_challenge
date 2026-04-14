import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useXpStore, XP_REWARDS } from '../hooks/useXpStore';
import '../styles/quiz.css';

const QUESTIONS = [
  {
    q: 'Dopamine được tiết ra khi nào?',
    options: ['Khi bạn nghỉ ngơi', 'Khi não kỳ vọng phần thưởng', 'Khi bạn buồn ngủ', 'Khi ăn ngon'],
    correct: 1,
    explain: 'Dopamine là hormone ĐỘNG LỰC, được tiết khi não kỳ vọng phần thưởng — không phải khi nhận phần thưởng. Đó là lý do anticipation thường thú vị hơn kết quả.',
  },
  {
    q: 'MVA (Minimum Viable Action) là gì?',
    options: ['Kế hoạch 30 ngày chi tiết', 'Hành động nhỏ nhất bạn không thể từ chối', 'Mục tiêu lớn nhất có thể', 'Chiến lược marketing'],
    correct: 1,
    explain: 'MVA = hành động nhỏ đến mức buồn cười nhưng đủ để bắt đầu. Ví dụ: không "tập gym 1 tiếng" mà "mang giày thể thao ra".',
  },
  {
    q: 'Amygdala gây ra điều gì khi bạn bắt đầu công việc mới?',
    options: ['Tăng năng lượng', 'Kích hoạt cơ chế sợ hãi/né tránh', 'Tăng tập trung', 'Giải phóng endorphin'],
    correct: 1,
    explain: 'Amygdala là phần não nguyên thủy xử lý sợ hãi. Khi gặp nhiệm vụ mới/khó — nó báo động "nguy hiểm" → bạn cảm thấy lười/né tránh.',
  },
  {
    q: 'Tại sao không nên dùng "ý chí" làm nguồn động lực chính?',
    options: ['Ý chí không có thật', 'Ý chí là tài nguyên hữu hạn, cạn dần trong ngày', 'Ý chí khiến bạn mập', 'Không có lý do gì'],
    correct: 1,
    explain: 'Ý chí (willpower) hoạt động như pin — cạn dần theo thời gian trong ngày. Đó là lý do buổi chiều tối khó từ chối đồ ăn/game hơn buổi sáng.',
  },
  {
    q: 'Streak psychology hoạt động như thế nào?',
    options: ['Làm bạn căng thẳng', '"Không muốn phá chuỗi" tạo động lực mạnh hơn phần thưởng', 'Không có tác dụng gì', 'Chỉ hiệu quả với trẻ em'],
    correct: 1,
    explain: 'Loss aversion (sợ mất) mạnh hơn desire (muốn được). Streak tận dụng tâm lý này — bạn làm việc để "không mất streak" hơn là để "được thưởng".',
  },
  {
    q: 'Habit stacking là gì?',
    options: ['Làm nhiều thói quen cùng lúc', 'Gắn thói quen mới sau thói quen đã có', 'Xếp hạng thói quen theo độ khó', 'Tích thưởng từng ngày'],
    correct: 1,
    explain: 'Habit stacking = "Sau khi tôi [THÓI QUEN CŨ], tôi sẽ [THÓI QUEN MỚI]". Tận dụng trigger đã có sẵn để bắt đầu thói quen mới.',
  },
  {
    q: 'Accountability partner hiệu quả nhất khi nào?',
    options: ['Khi là người lạ hoàn toàn', 'Khi là người có cùng mục tiêu và check-in hàng ngày', 'Khi là người nổi tiếng', 'Khi số lượng > 10 người'],
    correct: 1,
    explain: 'Research cho thấy 1 accountability partner check-in thường xuyên hiệu quả hơn group lớn. Cặp đôi tạo trách nhiệm cụ thể, không bị pha loãng.',
  },
  {
    q: 'Điều gì xảy ra sau khi bạn làm MVA xong?',
    options: ['Não báo "done" và muốn nghỉ ngay', 'Quán tính kéo bạn tiếp tục làm thêm', 'Không có gì đặc biệt', 'Dopamine giảm'],
    correct: 1,
    explain: 'Đây là "Newton\'s first law" của não: vật thể đang chuyển động có xu hướng tiếp tục chuyển động. Bắt đầu là khó nhất — sau MVA, bạn thường làm tiếp tự nhiên.',
  },
  {
    q: 'Tuần 2 của chương trình tập trung vào điều gì?',
    options: ['Học lý thuyết não bộ', 'Thử thách cá nhân một mình', 'Thử thách đồng đội và accountability', 'Nghỉ ngơi và review'],
    correct: 2,
    explain: 'Tuần 2 = Thử Thách Đồng Đội. Bắt cặp với 1 người, dùng trách nhiệm nhóm để duy trì kỷ luật. Sau khi đã có đà từ Tuần 1.',
  },
  {
    q: 'Cách tốt nhất để vượt qua "tôi không có cảm hứng hôm nay"?',
    options: ['Đợi cảm hứng tự đến', 'Uống cà phê thêm', 'Làm MVA — action trước, motivation theo sau', 'Xem video motivational 30 phút'],
    correct: 2,
    explain: 'Motivation follows action — không phải ngược lại. Bắt đầu nhỏ → dopamine tiết → mood tăng → muốn làm tiếp. Đợi cảm hứng là cái bẫy lớn nhất.',
  },
];

const XP_PER_CORRECT = 5;

export default function QuizPage() {
  const { addXp, hasMilestone } = useXpStore();
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [showResult, setShowResult] = useState(false);
  const [awarded, setAwarded]     = useState(false);

  const q = QUESTIONS[current];
  const isAnswered = selected !== null;
  const isCorrect  = selected === q.correct;

  const handleSelect = (idx) => {
    if (isAnswered) return;
    setSelected(idx);
  };

  const handleNext = () => {
    const newAnswers = [...answers, { q: current, chosen: selected, correct: selected === q.correct }];
    setAnswers(newAnswers);

    if (current < QUESTIONS.length - 1) {
      setCurrent(c => c + 1);
      setSelected(null);
    } else {
      setShowResult(true);
      if (!awarded) {
        const score = newAnswers.filter(a => a.correct).length;
        const xp = Math.round((score / QUESTIONS.length) * 50);
        addXp(xp, 'quiz_complete', { score, total: QUESTIONS.length });
        setAwarded(true);
      }
    }
  };

  const handleRestart = () => {
    setCurrent(0); setSelected(null); setAnswers([]); setShowResult(false); setAwarded(false);
  };

  const score = answers.filter(a => a.correct).length;

  if (showResult) {
    const xp = Math.round((score / QUESTIONS.length) * 50);
    const pct = Math.round((score / QUESTIONS.length) * 100);
    return (
      <div className="quiz-page">
        <div className="container quiz-result">
          <div className="quiz-result__icon">
            {pct >= 80 ? '🧠' : pct >= 50 ? '📚' : '🌱'}
          </div>
          <h1 className="display-2">
            {pct >= 80 ? 'Não Bộ Học!' : pct >= 50 ? 'Đang Tiến Bộ!' : 'Cần Ôn Thêm!'}
          </h1>
          <div className="quiz-result__score gradient-text">
            {score}/{QUESTIONS.length}
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            {pct}% câu đúng → <strong>+{xp} XP</strong>
          </p>

          {/* Per-question review */}
          <div className="quiz-review">
            {answers.map((a, i) => (
              <div key={i} className={`quiz-review-item ${a.correct ? 'correct' : 'wrong'}`}>
                <span>{a.correct ? '✅' : '❌'}</span>
                <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  {QUESTIONS[i].q.slice(0, 50)}...
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleRestart} id="quiz-restart">
              🔄 Làm Lại
            </button>
            <Link to="/tracker" className="btn btn-ghost">
              📊 Về Tracker
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-page">
      <div className="container">
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div className="section-label">🧠 Quiz</div>
          <h1 className="display-2">
            Quiz <span className="gradient-text">Não Bộ</span>
          </h1>
        </div>

        {/* Progress */}
        <div className="quiz-progress">
          <div className="quiz-progress__text">
            Câu {current + 1} / {QUESTIONS.length}
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${((current) / QUESTIONS.length) * 100}%` }} />
          </div>
        </div>

        {/* Question card */}
        <div className="quiz-card card" key={current}>
          <h2 className="h2" style={{ marginBottom: '1.5rem', lineHeight: 1.4 }}>{q.q}</h2>

          <div className="quiz-options">
            {q.options.map((opt, idx) => (
              <button
                key={idx}
                className={`quiz-option ${
                  !isAnswered ? '' :
                  idx === q.correct ? 'quiz-option--correct' :
                  idx === selected ? 'quiz-option--wrong' : 'quiz-option--dim'
                }`}
                onClick={() => handleSelect(idx)}
                id={`quiz-option-${idx}`}
              >
                <span className="quiz-option__letter">{String.fromCharCode(65 + idx)}</span>
                {opt}
              </button>
            ))}
          </div>

          {/* Explanation */}
          {isAnswered && (
            <div className={`quiz-explain ${isCorrect ? 'quiz-explain--correct' : 'quiz-explain--wrong'}`}>
              <strong>{isCorrect ? '✅ Chính xác!' : '❌ Chưa đúng.'}</strong>
              <p style={{ marginTop: '0.4rem' }}>{q.explain}</p>
            </div>
          )}
        </div>

        {isAnswered && (
          <div style={{ textAlign: 'right', marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={handleNext} id="quiz-next">
              {current < QUESTIONS.length - 1 ? 'Câu Tiếp →' : 'Xem Kết Quả 🏆'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
