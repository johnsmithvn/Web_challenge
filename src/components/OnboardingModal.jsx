import { useState } from 'react';
import '../styles/onboarding.css';
import AppIcon from './AppIcon';

const ONBOARDED_KEY = 'vl_onboarded';

// v5.0.0: viết lại toàn bộ. Nội dung cũ hướng dẫn sản phẩm "Thử Thách Vượt Lười
// 21 ngày" — nói về MVA, streak, trang Habits, Daily Challenge. Cả 4 thứ đó đã
// gỡ hẳn, nên onboarding đang chỉ đường tới những nơi không còn tồn tại.
const STEPS = [
  {
    icon: 'sparkle',
    title: 'Chào Mừng!',
    desc: 'Life Hub gom việc cần làm, thứ cần nhớ và tiền đã tiêu về một chỗ — thay vì rải ra năm bảy app khác nhau.',
    highlight: (
      <>
        Đây là <strong>hệ thống riêng của bạn</strong>. Không mạng xã hội,
        không bảng xếp hạng, không ai nhìn thấy dữ liệu của bạn.
      </>
    ),
  },
  {
    icon: 'inbox',
    title: 'Ghi Trước, Phân Loại Sau',
    desc: 'Nghĩ ra gì thì gõ thẳng vào Inbox. Đừng dừng lại để quyết định nó thuộc loại nào — làm vậy là mất mạch.',
    highlight: (
      <>
        Lúc rảnh mới mở Inbox ra dọn: cái này thành <strong>Nhiệm vụ</strong>,
        cái kia thành <strong>Bài viết</strong>, cái nọ là <strong>Khoản chi</strong>.
        <br /><br />
        Chưa quyết được? Đẩy sang <strong>Incubator</strong> để đó, hẹn ngày xem lại.
      </>
    ),
  },
  {
    icon: 'mapPin',
    title: 'Sáu Chỗ Để Đi',
    desc: 'Mỗi module làm đúng một việc. Bắt đầu từ Inbox, phần còn lại dùng tới đâu khám phá tới đó.',
    highlight: (
      <>
        <span><AppIcon name="inbox" size={14} /> <strong>Inbox</strong> — thu gom</span>
        <span><AppIcon name="pushPin" size={14} /> <strong>Nhiệm Vụ</strong> — việc cần làm</span>
        <span><AppIcon name="brain" size={14} /> <strong>Knowledge</strong> — bài viết</span>
        <span><AppIcon name="money" size={14} /> <strong>Finance</strong> — chi tiêu</span>
        <span><AppIcon name="egg" size={14} /> <strong>Incubator</strong> — dự định</span>
        <span><AppIcon name="timer" size={14} /> <strong>Focus</strong> — Pomodoro</span>
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
          <span className="onboarding-icon"><AppIcon name={current.icon} size={38} weight="duotone" /></span>
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
            {isLast ? <><AppIcon name="rocket" size={16} /> Bắt Đầu!</> : <>Tiếp <AppIcon name="arrowRight" size={15} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
