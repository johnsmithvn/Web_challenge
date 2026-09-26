import { useState, useRef, useEffect, useMemo } from 'react';
import AppIcon from './AppIcon';
import { PRIORITY_OPTIONS } from '../utils/taskFields';
import '../styles/priority-picker.css';

/**
 * PriorityPicker — Dropdown popover for selecting task priority (Linear/ClickUp style).
 *
 * Props:
 *   value        — number (0..5)
 *   onChange     — (number) => void
 *   compact      — boolean: smaller size for cards/tables
 *   align        — 'left' | 'right' (default 'left')
 *   disabled     — boolean
 *   placeholder  — fallback string when value is 0 (None)
 */
export default function PriorityPicker({
  value = 0,
  onChange,
  compact = false,
  align = 'left',
  disabled = false,
  placeholder = 'Priority',
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const popoverRef = useRef(null);
  const searchInputRef = useRef(null);

  const currentOpt = useMemo(() => {
    return PRIORITY_OPTIONS.find((o) => o.value === Number(value)) || PRIORITY_OPTIONS[0];
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus search input when opened
  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => searchInputRef.current?.focus(), 40);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open]);

  const handleSelect = (val) => {
    onChange?.(val);
    setOpen(false);
  };

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return PRIORITY_OPTIONS;
    return PRIORITY_OPTIONS.filter((o) => o.label.toLowerCase().includes(q));
  }, [search]);

  return (
    <div
      className="priority-picker"
      ref={popoverRef}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={disabled}
        className={`priority-badge-btn ${compact ? 'priority-badge-btn--compact' : ''}`}
        data-priority={currentOpt.value}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((prev) => !prev);
        }}
        title={`Priority: ${currentOpt.label}`}
      >
        <AppIcon name={currentOpt.icon} size={compact ? 12 : 14} weight="bold" />
        <span>{currentOpt.value > 0 ? currentOpt.label : (compact ? 'Priority' : placeholder)}</span>
      </button>

      {open && (
        <div
          className={`priority-popover ${align === 'right' ? 'priority-popover--right' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="priority-popover__header">
            <span>Change priority</span>
            <button
              type="button"
              className="priority-popover__close-btn"
              onClick={() => setOpen(false)}
            >
              <AppIcon name="x" size={13} />
            </button>
          </div>

          <input
            ref={searchInputRef}
            type="text"
            className="priority-popover__search"
            placeholder="Search priority..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filteredOptions.length > 0) {
                handleSelect(filteredOptions[0].value);
              }
            }}
          />

          <div className="priority-popover__list">
            {filteredOptions.map((opt) => {
              const isSelected = opt.value === Number(value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  className="priority-popover__item"
                  onClick={() => handleSelect(opt.value)}
                >
                  <span className="priority-popover__item-left">
                    <span
                      className="priority-popover__item-icon"
                      style={{ color: opt.value > 0 ? opt.color : 'var(--text-muted)' }}
                    >
                      <AppIcon name={opt.icon} size={13} weight="bold" />
                    </span>
                    <span
                      style={
                        opt.value > 0
                          ? { color: opt.color, fontWeight: 600 }
                          : { color: 'var(--text-muted)' }
                      }
                    >
                      {opt.label}
                    </span>
                  </span>
                  {isSelected && (
                    <span className="priority-popover__check">
                      <AppIcon name="check" size={13} weight="bold" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
