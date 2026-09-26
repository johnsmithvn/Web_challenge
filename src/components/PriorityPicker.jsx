import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import AppIcon from './AppIcon';
import { PRIORITY_OPTIONS } from '../utils/taskFields';
import '../styles/priority-picker.css';

/**
 * PriorityPicker — Dropdown popover for selecting task priority (Linear/ClickUp style).
 * Rendered via createPortal to prevent overflow clipping in modals and stacking context issues.
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
  const [coords, setCoords] = useState(null);

  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const searchInputRef = useRef(null);

  const currentOpt = useMemo(() => {
    return PRIORITY_OPTIONS.find((o) => o.value === Number(value)) || PRIORITY_OPTIONS[0];
  }, [value]);

  // Calculate coordinates for smart dropdown / dropup
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const POPOVER_WIDTH = 205;
    const POPOVER_HEIGHT = 265;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    // If not enough space below (< 265px) and above has more space -> flip to dropup
    const openUpward = spaceBelow < POPOVER_HEIGHT && spaceAbove > spaceBelow;

    let top = openUpward
      ? Math.max(8, rect.top - POPOVER_HEIGHT - 4)
      : Math.min(window.innerHeight - POPOVER_HEIGHT - 8, rect.bottom + 4);

    let left = align === 'right' ? rect.right - POPOVER_WIDTH : rect.left;
    if (left + POPOVER_WIDTH > window.innerWidth - 10) {
      left = window.innerWidth - POPOVER_WIDTH - 10;
    }
    if (left < 10) left = 10;

    setCoords({ top, left, openUpward });
  }, [align]);

  // Reposition on scroll/resize when open
  useEffect(() => {
    if (!open) return;
    updatePosition();

    const handleUpdate = () => updatePosition();
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [open, updatePosition]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
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
    <div className="priority-picker" onClick={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={`priority-badge-btn ${compact ? 'priority-badge-btn--compact' : ''} ${
          currentOpt.value === 0 ? 'priority-badge-btn--none' : ''
        }`}
        data-priority={currentOpt.value}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) {
            updatePosition();
            setOpen((prev) => !prev);
          }
        }}
        title={`Priority: ${currentOpt.label}`}
      >
        <AppIcon name={currentOpt.icon} size={compact ? 11 : 13} weight="bold" />
        <span className="priority-badge-btn__text">
          {currentOpt.value > 0 ? currentOpt.label : (compact ? 'None' : placeholder)}
        </span>
      </button>

      {open && coords && createPortal(
        <div
          ref={popoverRef}
          className={`priority-popover ${coords.openUpward ? 'priority-popover--upward' : ''}`}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            zIndex: 999999,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="priority-popover__header">
            <span>Change priority</span>
            <button
              type="button"
              className="priority-popover__close-btn"
              onClick={() => setOpen(false)}
              title="Close"
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
        </div>,
        document.body
      )}
    </div>
  );
}
