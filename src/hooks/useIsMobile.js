import { useEffect, useState } from 'react';

const MOBILE_MQ = '(max-width: 768px)';

/** true dưới 768px, cập nhật khi xoay / đổi cỡ cửa sổ. */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia?.(MOBILE_MQ).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(MOBILE_MQ);
    if (!mq) return undefined;
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}
