import { useEffect, useRef, useState } from 'react';
import AppIcon from './AppIcon';
import { parseTaskQuickText } from '../utils/taskNlpParser';
import { STATUS_META } from '../utils/kanbanUtils';

/*
 * TaskQuickAdd — sheet "Việc mới" (mockup mobile; desktop là hộp giữa màn hình):
 * gõ "mai 9h !cao #UI" → chip xem trước hạn/giờ/ưu tiên/nhãn, nút chèn nhanh, Enter để thêm.
 */
const TOKENS = [
  { label: 'Hôm nay', tok: 'nay', icon: 'sun' },
  { label: 'Ngày mai', tok: 'mai', icon: 'sunHorizon' },
  { label: '9:00', tok: '9h', icon: 'clock' },
  { label: 'Cao', tok: '!cao', icon: 'signalHigh' },
  { label: '#nhãn', tok: '#', icon: 'hash' },
];

export default function TaskQuickAdd({ open, status = 'todo', today, onClose, onCreate, onOpenFullForm }) {
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const parsed = parseTaskQuickText(val, today);

  useEffect(() => {
    if (!open) return undefined;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const submit = async () => {
    if (!parsed.title || saving) return;
    setSaving(true);
    try {
      await onCreate(val, status);
      setVal('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const addTok = (tok) => {
    setVal((v) => `${v.trim()} ${tok}`.trim() + (tok === '#' ? '' : ' '));
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <>
      <div className="tk-qa-scrim" onClick={onClose} />
      <div className="tk-qa" role="dialog" aria-label="Việc mới">
        <span className="tk-qa__grip" />
        <div className="tk-qa__head">
          <span className="tk-qa__title">Việc mới</span>
          {status !== 'todo' && <span className="tk-qa__sub">vào cột {STATUS_META[status]?.label}</span>}
          <button type="button" className="tk-drawer__icon-btn" onClick={onClose} aria-label="Đóng">
            <AppIcon name="x" size={15} />
          </button>
        </div>
        <input
          ref={inputRef}
          className="tk-qa__input"
          value={val}
          placeholder="Tên việc… thử “mai 9h !cao #UI”"
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="tk-qa__chips">
          {parsed.chips.length ? (
            parsed.chips.map((c, i) => (
              <span key={i} className="tk-qa__chip">
                <AppIcon name={c.ic} size={12} />
                {c.n}
              </span>
            ))
          ) : (
            <span className="tk-qa__hint">Gõ hoặc bấm nhanh bên dưới để đặt hạn, giờ, ưu tiên</span>
          )}
        </div>
        <div className="tk-qa__toks">
          {TOKENS.map((t) => (
            <button key={t.tok} type="button" className="tk-qa__tok" onMouseDown={(e) => e.preventDefault()} onClick={() => addTok(t.tok)}>
              <AppIcon name={t.icon} size={14} style={{ color: 'var(--tk-text-sub)' }} />
              {t.label}
            </button>
          ))}
        </div>
        <div className="tk-qa__actions">
          {/* Mở ngăn chi tiết ở chế độ tạo mới, chữ đã gõ điền sẵn */}
          {onOpenFullForm && (
            <button type="button" className="tk-qa__more" title="Mở form đầy đủ" onClick={() => onOpenFullForm(parsed, status)}>
              <AppIcon name="arrowsOutSimple" size={16} />
              Chi tiết
            </button>
          )}
          <button type="button" className="tk-qa__submit" disabled={!parsed.title || saving} onClick={submit}>
            Thêm việc
          </button>
        </div>
      </div>
    </>
  );
}
