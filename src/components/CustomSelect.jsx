import { useState, useRef, useEffect } from 'react';

/**
 * CustomSelect — A premium glassmorphic custom dropdown replacement for native select elements.
 * Fully theme-aware (Light/Dark) and click-outside close behavior.
 */
export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Chọn...',
  className = '',
  id = '',
  style = {},
  autoFocus = false
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Handle autofocus when the dropdown is created
  useEffect(() => {
    if (autoFocus && containerRef.current) {
      const trigger = containerRef.current.querySelector('.kb-sort-trigger, .kb-type-select');
      if (trigger) trigger.focus();
    }
  }, [autoFocus]);

  const selectedOpt = options.find(o => o.value === value);

  return (
    <div
      ref={containerRef}
      className={`kb-custom-select ${className}`}
      style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle', ...style }}
      id={id}
    >
      <button
        type="button"
        className="kb-sort-trigger"
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', justifyContent: 'space-between', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
      >
        <span>{selectedOpt ? selectedOpt.label : placeholder}</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>▼</span>
      </button>

      {open && (
        <div className="kb-sort-dropdown" style={{ left: 0, right: 'auto', minWidth: '100%' }}>
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              className={`kb-sort-dropdown-item ${value === o.value ? 'kb-sort-dropdown-item--active' : ''}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}
            >
              <span>{o.label}</span>
              {value === o.value && <span style={{ color: 'var(--purple)', fontWeight: 'bold' }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
