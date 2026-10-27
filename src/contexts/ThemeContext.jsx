import { createContext, useContext, useState, useEffect } from 'react';
import { flushSync } from 'react-dom';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('vl_theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('vl_theme', theme);

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'light' ? '#f4f6fb' : '#0f0f13');
    }
  }, [theme]);

  // Kiểu giao diện trang Nhiệm vụ: 'default' (Aurora) | 'elf' (Rừng tiên) — độc lập với sáng/tối
  const [taskStyle, setTaskStyle] = useState(() => localStorage.getItem('vl_task_style') || 'default');

  useEffect(() => {
    localStorage.setItem('vl_task_style', taskStyle);
  }, [taskStyle]);

  // Giảm chuyển động: cài đặt của app (Settings), mặc định TẮT — cố ý không theo prefers-reduced-motion
  // của trình duyệt (máy báo bật là app mất hết hiệu ứng mà user không biết vì sao).
  // CSS đọc qua :root[data-reduce-motion]; code thả hiệu ứng đọc reduceMotion hoặc thuộc tính đó.
  const [reduceMotion, setReduceMotion] = useState(() => localStorage.getItem('vl_reduce_motion') === '1');

  useEffect(() => {
    document.documentElement.toggleAttribute('data-reduce-motion', reduceMotion);
    localStorage.setItem('vl_reduce_motion', reduceMotion ? '1' : '0');
  }, [reduceMotion]);

  // Đổi giao diện với hiệu ứng lan tròn (Circular Reveal Transition)
  const toggleTheme = (event) => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';

    // Không chạy hiệu ứng nếu user bật Giảm chuyển động hoặc trình duyệt không hỗ trợ View Transitions API
    const isReduced = reduceMotion || document.documentElement.hasAttribute('data-reduce-motion');
    if (!document.startViewTransition || isReduced) {
      setTheme(nextTheme);
      return;
    }

    // Tọa độ tâm lan tỏa (từ vị trí nút bấm hoặc giữa màn hình nếu kích hoạt qua phím/script)
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;

    if (event) {
      if (event.currentTarget && typeof event.currentTarget.getBoundingClientRect === 'function') {
        const rect = event.currentTarget.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      } else if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
        x = event.clientX;
        y = event.clientY;
      }
    }

    // Bán kính lớn nhất quét tới 4 góc màn hình
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    try {
      const transition = document.startViewTransition(() => {
        flushSync(() => {
          document.documentElement.setAttribute('data-theme', nextTheme);
          const metaThemeColor = document.querySelector('meta[name="theme-color"]');
          if (metaThemeColor) {
            metaThemeColor.setAttribute('content', nextTheme === 'light' ? '#f4f6fb' : '#0f0f13');
          }
          setTheme(nextTheme);
        });
      });

      transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 650,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            pseudoElement: '::view-transition-new(root)',
          }
        );
      }).catch(() => {});
    } catch {
      setTheme(nextTheme);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, taskStyle, setTaskStyle, reduceMotion, setReduceMotion }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
