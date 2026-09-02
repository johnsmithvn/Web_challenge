import { useState, useMemo } from 'react';
import BANKS from '../data/banks.json';
import AppIcon from './AppIcon';

export { BANKS };

export function findBank(query) {
  if (!query) return null;
  const q = String(query).trim().toLowerCase();
  return BANKS.find(b =>
    b.name.toLowerCase() === q ||
    b.code.toLowerCase() === q ||
    b.fullName.toLowerCase() === q
  ) || null;
}

export default function BankSelect({
  value = '',
  onChange,
  placeholder = 'Chọn ngân hàng',
  className = 'fin-input',
  allowCustom = true,
  autoFocus = false,
  id,
  name,
  required = false,
  'aria-label': ariaLabel = 'Ngân hàng',
}) {
  const matchedBank = useMemo(() => findBank(value), [value]);
  const isCustomValue = Boolean(value) && !matchedBank;
  const [customMode, setCustomMode] = useState(false);

  // Group banks by their designated category
  const groups = useMemo(() => {
    const map = new Map();
    for (const b of BANKS) {
      const g = b.group || 'Khác';
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(b);
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }, []);

  const handleSelectChange = (e) => {
    const selected = e.target.value;
    if (selected === '__custom__') {
      setCustomMode(true);
    } else {
      setCustomMode(false);
      onChange?.(selected);
    }
  };

  const handleCustomInput = (e) => {
    onChange?.(e.target.value);
  };

  const currentSelectValue = matchedBank ? matchedBank.name : (isCustomValue ? value : '');

  if (customMode) {
    return (
      <div className="fin-bank-custom-wrap" style={{ display: 'flex', gap: '6px', width: '100%' }}>
        <input
          type="text"
          className={className}
          value={value || ''}
          onChange={handleCustomInput}
          placeholder="Nhập tên ngân hàng hoặc tổ chức..."
          autoFocus
          id={id}
          name={name}
          required={required}
          aria-label={ariaLabel}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="fin-btn fin-btn--ghost fin-btn--sm"
          style={{ padding: '0 10px', whiteSpace: 'nowrap', fontSize: '11.5px', flexShrink: 0 }}
          onClick={() => setCustomMode(false)}
          title="Chọn từ danh sách có sẵn"
        >
          <AppIcon name="list" size={13} /> Danh sách
        </button>
      </div>
    );
  }

  return (
    <div className="fin-bank-select-wrap" style={{ width: '100%' }}>
      <select
        className={className}
        value={currentSelectValue}
        onChange={handleSelectChange}
        autoFocus={autoFocus}
        id={id}
        name={name}
        required={required}
        aria-label={ariaLabel}
      >
        <option value="">-- {placeholder} --</option>

        {isCustomValue && (
          <option value={value}>
            {value} (Tùy chỉnh)
          </option>
        )}

        {groups.map(({ label, items }) => (
          <optgroup key={label} label={label}>
            {items.map(b => (
              <option key={b.code} value={b.name}>
                {b.name} ({b.code})
              </option>
            ))}
          </optgroup>
        ))}

        {allowCustom && (
          <option value="__custom__">+ Ngân hàng khác (Nhập tay)...</option>
        )}
      </select>
    </div>
  );
}
