import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useXpStore, XP_REWARDS } from '../hooks/useXpStore';
import '../styles/quiz.css';

import QUESTIONS from '../data/quiz.json';


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
