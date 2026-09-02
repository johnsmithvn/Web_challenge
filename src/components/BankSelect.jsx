import { useState, useMemo, useRef, useEffect } from 'react';
import BANKS from '../data/banks.json';
import AppIcon from './AppIcon';

export { BANKS };

function removeAccents(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function findBank(query) {
  if (!query) return null;
  const q = String(query).trim().toLowerCase();
  const qUnaccent = removeAccents(query);

  return (
    BANKS.find(b =>
      b.name.toLowerCase() === q ||
      b.code.toLowerCase() === q ||
      b.fullName.toLowerCase() === q ||
      removeAccents(b.name) === qUnaccent ||
      removeAccents(b.code) === qUnaccent
    ) || null
  );
}

export default function BankSelect({
  value = '',
  onChange,
  placeholder = 'Nhập hoặc chọn ngân hàng (VCB, MB, ACB, Tech...)',
  className = 'fin-input',
  allowCustom = true,
  autoFocus = false,
  id,
  name,
  required = false,
  'aria-label': ariaLabel = 'Ngân hàng',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Filter banks based on current input text
  const filteredBanks = useMemo(() => {
    const text = (value || '').trim();
    if (!text) return BANKS;
    const q = text.toLowerCase();
    const qUnaccent = removeAccents(text);

    return BANKS.filter(b => {
      const nameMatch = b.name.toLowerCase().includes(q) || removeAccents(b.name).includes(qUnaccent);
      const codeMatch = b.code.toLowerCase().includes(q) || removeAccents(b.code).includes(qUnaccent);
      const fullNameMatch = b.fullName.toLowerCase().includes(q) || removeAccents(b.fullName).includes(qUnaccent);
      return nameMatch || codeMatch || fullNameMatch;
    });
  }, [value]);

  // Group filtered banks by category
  const groups = useMemo(() => {
    const map = new Map();
    for (const b of filteredBanks) {
      const g = b.group || 'Khác';
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(b);
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }, [filteredBanks]);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setHighlightIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleInputChange = (e) => {
    const newVal = e.target.value;
    onChange?.(newVal);
    if (!isOpen) setIsOpen(true);
    setHighlightIndex(0);
  };

  const handleSelectBank = (bank) => {
    onChange?.(bank.name);
    setIsOpen(false);
    setHighlightIndex(-1);
    inputRef.current?.focus();
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange?.('');
    setIsOpen(true);
    setHighlightIndex(-1);
    inputRef.current?.focus();
  };

  const handleToggleOpen = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(prev => {
      const next = !prev;
      if (next) inputRef.current?.focus();
      return next;
    });
  };

  // Keyboard navigation inside the input
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightIndex(0);
        return;
      }
      const totalCount = filteredBanks.length;
      if (totalCount > 0) {
        const next = (highlightIndex + 1) % totalCount;
        setHighlightIndex(next);
        scrollIntoView(next);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      const totalCount = filteredBanks.length;
      if (totalCount > 0) {
        const next = (highlightIndex - 1 + totalCount) % totalCount;
        setHighlightIndex(next);
        scrollIntoView(next);
      }
    } else if (e.key === 'Enter') {
      if (isOpen && highlightIndex >= 0 && filteredBanks[highlightIndex]) {
        e.preventDefault();
        handleSelectBank(filteredBanks[highlightIndex]);
      } else {
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setHighlightIndex(-1);
    }
  };

  const scrollIntoView = (index) => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('.fin-bank-option');
    if (items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  };

  const hasSearch = Boolean((value || '').trim());
  const matched = useMemo(() => findBank(value), [value]);

  return (
    <div
      className="fin-bank-autocomplete"
      ref={containerRef}
      style={{ position: 'relative', width: '100%' }}
    >
      {/* Input container with Bank icon on left and actions on right */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
        <input
          ref={inputRef}
          type="text"
          className={className}
          value={value || ''}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          id={id}
          name={name}
          required={required}
          aria-label={ariaLabel}
          aria-expanded={isOpen}
          aria-autocomplete="list"
          autoComplete="off"
          style={{
            width: '100%',
            paddingLeft: '34px',
            paddingRight: value ? '56px' : '32px',
          }}
        />

        {/* Left bank icon */}
        <div
          style={{
            position: 'absolute',
            left: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            color: matched ? 'var(--n-accent, #8b5cf6)' : 'var(--n-txt3, #888)',
          }}
        >
          <AppIcon name="bank" size={15} />
        </div>

        {/* Right controls: Clear button + Dropdown toggle button */}
        <div
          style={{
            position: 'absolute',
            right: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
          }}
        >
          {value && (
            <button
              type="button"
              onClick={handleClear}
              title="Xóa chữ đã nhập"
              tabIndex={-1}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--n-txt3, #888)',
                cursor: 'pointer',
                padding: '3px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--n-txt)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--n-txt3, #888)'}
            >
              <AppIcon name="x" size={13} />
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleOpen}
            title={isOpen ? 'Đóng danh sách' : 'Mở danh sách ngân hàng'}
            tabIndex={-1}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--n-txt3, #888)',
              cursor: 'pointer',
              padding: '3px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--n-txt)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--n-txt3, #888)'}
          >
            <AppIcon
              name="caretDown"
              size={14}
              style={{
                transition: 'transform 0.15s ease',
                transform: isOpen ? 'rotate(180deg)' : 'none',
              }}
            />
          </button>
        </div>
      </div>

      {/* Dropdown suggestions list */}
      {isOpen && (
        <div
          ref={listRef}
          className="fin-bank-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 120,
            background: 'var(--n-card, #1e1e2d)',
            border: '1px solid var(--n-border, rgba(255,255,255,0.12))',
            borderRadius: '8px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05)',
            overflowY: 'auto',
            maxHeight: '280px',
            animation: 'modalSlideIn 0.12s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {filteredBanks.length > 0 ? (
            hasSearch ? (
              // Flat matched list when user is typing
              <div style={{ padding: '4px 0' }}>
                {filteredBanks.map((b, idx) => {
                  const isSelected = value?.trim().toLowerCase() === b.name.toLowerCase() || value?.trim().toLowerCase() === b.code.toLowerCase();
                  const isHighlighted = idx === highlightIndex;

                  return (
                    <div
                      key={b.code}
                      className="fin-bank-option"
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent input blur before click
                        handleSelectBank(b);
                      }}
                      onMouseEnter={() => setHighlightIndex(idx)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        padding: '7px 12px',
                        fontSize: '12.5px',
                        cursor: 'pointer',
                        background: isHighlighted ? 'rgba(139,92,246,0.15)' : (isSelected ? 'rgba(139,92,246,0.08)' : 'transparent'),
                        color: isSelected ? 'var(--n-accent, #c4b5fd)' : 'var(--n-txt, #fff)',
                        fontWeight: isSelected ? 600 : 400,
                        transition: 'background 0.08s ease',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {b.name}
                        </span>
                        <span style={{ fontSize: '10.5px', color: 'var(--n-txt3, #888)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {b.fullName}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 600,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: 'rgba(255,255,255,0.08)',
                          color: 'var(--n-txt2, #aaa)',
                          flexShrink: 0,
                        }}
                      >
                        {b.code}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Grouped list when input is empty
              <div style={{ padding: '4px 0' }}>
                {groups.map(group => (
                  <div key={group.label}>
                    <div
                      style={{
                        padding: '6px 12px 3px',
                        fontSize: '10px',
                        fontWeight: 700,
                        color: 'var(--n-txt3, #888)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {group.label}
                    </div>
                    {group.items.map(b => {
                      const isSelected = value?.trim().toLowerCase() === b.name.toLowerCase() || value?.trim().toLowerCase() === b.code.toLowerCase();
                      const globalIdx = filteredBanks.findIndex(x => x.code === b.code);
                      const isHighlighted = globalIdx === highlightIndex;

                      return (
                        <div
                          key={b.code}
                          className="fin-bank-option"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectBank(b);
                          }}
                          onMouseEnter={() => setHighlightIndex(globalIdx)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            padding: '6px 12px',
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            background: isHighlighted ? 'rgba(139,92,246,0.15)' : (isSelected ? 'rgba(139,92,246,0.08)' : 'transparent'),
                            color: isSelected ? 'var(--n-accent, #c4b5fd)' : 'var(--n-txt, #fff)',
                            fontWeight: isSelected ? 600 : 400,
                            transition: 'background 0.08s ease',
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {b.name}
                          </span>
                          <span
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 600,
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: 'rgba(255,255,255,0.06)',
                              color: 'var(--n-txt3, #888)',
                              flexShrink: 0,
                            }}
                          >
                            {b.code}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )
          ) : (
            <div style={{ padding: '14px 12px', textAlign: 'center', color: 'var(--n-txt3, #888)', fontSize: '12px' }}>
              <div>Không có ngân hàng mẫu khớp &quot;{value}&quot;</div>
              <div style={{ fontSize: '11px', marginTop: '4px', color: 'var(--n-accent, #8b5cf6)' }}>
                ✓ Hệ thống sẽ lưu tên tự do: <strong>&quot;{value}&quot;</strong>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
