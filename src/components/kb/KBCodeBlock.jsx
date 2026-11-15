import { useEffect, useRef, useState } from 'react';
import AppIcon from '../AppIcon';
import { useToast } from '../../contexts/ToastContext';

/**
 * Khối code ở trang đọc Kiến thức: tô màu cú pháp (lowlight = highlight.js, bộ 37 ngôn ngữ phổ biến),
 * thanh nhãn ngôn ngữ + nút Copy. Một kiểu cho cả bài Markdown (react-markdown + rehype-highlight)
 * lẫn bài Visual (TiptapReadOnly + CodeBlockLowlight trong TiptapEditor.jsx, dùng lại CodeHead — để Tiptap
 * vẫn chỉ tải khi mở bài Visual). Không ghi ngôn ngữ thì tự đoán. Màu ở kb-tokens.css.
 */

export function CodeHead({ lang, getText }) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(getText());
    } catch {
      showToast('Không copy được. Bôi đen đoạn code rồi Ctrl+C.');
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="kb-code__head" contentEditable={false}>
      <span className="kb-code__lang">{lang || 'code'}</span>
      <button type="button" className="kb-code__copy" onClick={copy}>
        <AppIcon name={copied ? 'check' : 'copy'} size={13} />
        {copied ? 'Đã chép' : 'Copy'}
      </button>
    </div>
  );
}

/** `pre` của react-markdown: rehype-highlight đã gắn class `language-x` (kể cả khi tự đoán) lên `code`. */
export function MarkdownCodeBlock({ node, children }) {
  const ref = useRef(null);
  const lang = node?.children?.[0]?.properties?.className
    ?.find((c) => String(c).startsWith('language-'))?.slice(9);
  return (
    <div className="kb-code">
      <CodeHead lang={lang} getText={() => ref.current?.textContent ?? ''} />
      <pre ref={ref} className="kb-code__pre">{children}</pre>
    </div>
  );
}
