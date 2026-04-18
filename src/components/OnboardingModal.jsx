import { useState } from 'react';
import '../styles/onboarding.css';

const ONBOARDED_KEY = 'vl_onboarded';

const STEPS = [
  {
    icon: '👋',
    title: 'Chào Mừng!',
    desc: 'Thử Thách Vượt Lười giúp bạn xây dựng kỷ luật trong 21 ngày — không dùng ý chí, dùng hệ thống.',
    highlight: (
      <>
        <strong>Não bộ không cần ý chí.</strong> Nó cần <strong>thói quen nhỏ lặp lại</strong> đủ lâu để thành tự động.
      </>
    ),
  },
  {
    icon: '⚡',
    title: 'MVA — Hành Động Vi Mô',
    desc: 'Mỗi ngày bạn chỉ cần làm 1 việc nhỏ nhất có thể. Nhỏ đến mức bạn không có lý do để từ chối.',
    highlight: (
      <>
        <strong>Ví dụ:</strong> Không "tập gym 1 tiếng" → chỉ cần <strong>"mang giày ra trước cửa"</strong>.
        <br /><br />
        Sau khi bắt đầu, não bộ tự tiếp tục. Đây gọi là <strong>quán tính</strong>.
      </>
    ),
  },
  {
    icon: '✅',
    title: 'Cách Dùng',
    desc: 'Mỗi ngày tick hoàn thành habit trong trang Habits. Tracker sẽ tự cập nhật streak của bạn.',
    highlight: (
      <>
        1. Vào <strong>Habits</strong> → tick các thói quen hôm nay<br />
        2. Làm <strong>Daily Challenge</strong> mỗi ngày (mỗi ngày khác nhau)<br />
        3. Duy trì streak → sau <strong>21 ngày</strong> bạn đã xây được hệ thống
      </>
    ),
  },
];

/**
 * OnboardingModal — shown once after first login.
 * Dismissed via localStorage key vl_onboarded.
 */
export function useOnboarding() {
  const shouldShow = !localStorage.getItem(ONBOARDED_KEY);
  return { shouldShow };
}

export default function OnboardingModal({ onDone }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;

  const finish = () => {
    localStorage.setItem(ONBOARDED_KEY, '1');
    onDone();
  };

  const next = () => {
    if (isLast) finish();
    else setStep(s => s + 1);
  };

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-label="Hướng dẫn bắt đầu">
      <div className="onboarding-modal">

        {/* Step dots */}
        <div className="onboarding-steps">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`onboarding-step-dot ${
                i === step ? 'onboarding-step-dot--active' :
                i < step   ? 'onboarding-step-dot--done'   : ''
              }`}
            />
          ))}
        </div>

        {/* Content — key forces re-animation on step change */}
        <div key={step}>
          <span className="onboarding-icon">{current.icon}</span>
          <h2 className="onboarding-title">{current.title}</h2>
          <p className="onboarding-desc">{current.desc}</p>
          <div className="onboarding-highlight">{current.highlight}</div>
        </div>

        {/* Navigation */}
        <div className="onboarding-nav">
          <button
            className="onboarding-skip"
            onClick={finish}
            id="onboarding-skip"
          >
            Bỏ qua
          </button>

          <button
            className="btn btn-primary"
            onClick={next}
            id={`onboarding-next-${step}`}
          >
            {isLast ? '🚀 Bắt Đầu!' : 'Tiếp →'}
          </button>
        </div>
      </div>
    </div>
  );
}
