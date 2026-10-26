import { createContext, useContext, useState, useEffect } from 'react';

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

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, taskStyle, setTaskStyle, reduceMotion, setReduceMotion }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
