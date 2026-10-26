import { useState, useRef, useMemo, useCallback, useImperativeHandle, useId } from 'react';
import AppIcon from './AppIcon';
import { normalizeVi } from '../utils/kbDeriveUtils';
import '../styles/search-select.css';

/**
 * SearchSelect: Reusable Combobox / Searchable Select & Tag Multi-Select
 *
 * Props:
 * - `options`: Array<{ value, label, sub?, badge?, group?, icon?, disabled? }> hoặc Array<string>
 * - `value`: giá trị đang chọn (string/number, hoặc Array<string> nếu multiple)
 * - `onChange`: (val, optionOrOptions) => void
 * - `multiple`: boolean (chọn nhiều dưới dạng tag chip)
 * - `allowCustom`: boolean (cho phép gõ tự do vào ô như combobox/autocomplete)
 * - `placeholder`: chữ gợi ý khi ô trống
 * - `searchPlaceholder`: chữ gợi ý khi đang mở danh sách tìm kiếm
 * - `label`: nhãn phía trên
 * - `size`: 'sm' (30px) | 'md' (36px) | 'lg' (42px)
 * - `disabled`: vô hiệu hoá
 * - `clearable`: hiển thị nút xoá nhanh 'x'
 * - `menuWidth`: độ rộng tuỳ chỉnh của menu popover
 * - `className`: class bổ sung cho container
 * - `style`: style của container
 * - `menuStyle`: style của popover menu
 * - `allowCreate`: boolean | string (hiển thị option tạo mới nếu từ khoá chưa có)
 * - `onCreate`: (query) => void
 * - `renderOption`: (option, { isSelected, isHighlighted }) => ReactNode
 * - `renderSelected`: (option) => ReactNode
 * - `inputRef`: ref truyền vào thẻ <input> (để focus/select)
 * - `inputProps`: các thuộc tính bổ sung cho <input> (như NO_AUTOFILL)
 * - `onEnter`: () => void (bấm Enter khi ở chế độ allowCustom)
 * - `ariaLabel`: string
 * - `noResultsText`: string
 */
export default function SearchSelect({
  options = [],
  value = '',
  onChange,
  multiple = false,
  allowCustom = false,
  placeholder = 'Chọn một mục...',
  searchPlaceholder = 'Gõ để tìm kiếm...',
  label,
  size = 'md',
  disabled = false,
  clearable = false,
  menuWidth,
  className = '',
  style,
  menuStyle,
  allowCreate = false,
  onCreate,
  renderOption,
  renderSelected,
  inputRef,
  inputProps,
  onEnter,
  ariaLabel,
  noResultsText = 'Không tìm thấy kết quả',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [visibleCount, setVisibleCount] = useState(30);
  const [placement, setPlacement] = useState('bottom');
  // allowCustom: user đã gõ kể từ lúc mở menu chưa (xem effectiveQuery)
  const [typed, setTyped] = useState(false);

  const containerRef = useRef(null);
  const localInputRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();
  const optionId = (i) => `${listId}-${i}`;

  // allowCustom: không chọn sẵn dòng nào — Enter giữ đúng chữ đã gõ, muốn lấy gợi ý thì bấm ↓
  const firstHighlight = allowCustom ? -1 : 0;

  // Đồng bộ ref của input ra ngoài nếu có
  useImperativeHandle(inputRef, () => localInputRef.current);

  // Chuẩn hoá options thành Array<{ value, label, sub?, badge?, group?, ... }>
  const normalizedOptions = useMemo(() => {
    if (!Array.isArray(options)) return [];
    return options.map((opt) => {
      if (opt && typeof opt === 'object') {
        return {
          ...opt,
          value: opt.value !== undefined ? String(opt.value) : '',
          label: opt.label !== undefined ? String(opt.label) : (opt.title ? String(opt.title) : ''),
        };
      }
      return {
        value: String(opt),
        label: String(opt),
      };
    });
  }, [options]);

  // Danh sách các giá trị đang chọn
  const selectedValues = useMemo(() => {
    if (multiple) {
      if (Array.isArray(value)) return value.map(String);
      if (typeof value === 'string' && value.trim()) return value.split(',').map((s) => s.trim());
      return [];
    }
    return value !== null && value !== undefined && value !== '' ? [String(value)] : [];
  }, [value, multiple]);

  // Các object option tương ứng với giá trị đang chọn
  const selectedOptions = useMemo(() => {
    const valSet = new Set(selectedValues);
    return normalizedOptions.filter((o) => valSet.has(o.value));
  }, [normalizedOptions, selectedValues]);

  const singleSelectedOption = !multiple ? (selectedOptions[0] || null) : null;

  // Từ khoá dùng để lọc danh sách. allowCustom: ô gõ chứa sẵn giá trị đang chọn, nên chỉ lọc
  // khi user đã gõ từ lúc mở — mở ra với giá trị có sẵn vẫn thấy đủ danh sách để đổi.
  const effectiveQuery = allowCustom ? (typed ? String(value || '').trim() : '') : search.trim();

  // Lọc options theo từ khoá. Không so `value`: value có thể là id (LinkEditor) — gõ số/hex
  // sẽ khớp bừa. Cần tìm theo chuỗi khác label thì đưa vào `sub`.
  const filteredOptions = useMemo(() => {
    if (!effectiveQuery) return normalizedOptions;
    const q = normalizeVi(effectiveQuery);
    return normalizedOptions.filter((o) => {
      const matchLabel = normalizeVi(o.label).includes(q);
      const matchSub = o.sub && normalizeVi(o.sub).includes(q);
      const matchBadge = o.badge && normalizeVi(o.badge).includes(q);
      const matchGroup = o.group && normalizeVi(o.group).includes(q);
      return matchLabel || matchSub || matchBadge || matchGroup;
    });
  }, [normalizedOptions, effectiveQuery]);

  // Kiểm tra có cần hiển thị option "Tạo mới" hay không
  const canShowCreate = useMemo(() => {
    if (!allowCreate || !effectiveQuery) return false;
    const exactMatch = normalizedOptions.some(
      (o) => normalizeVi(o.label) === normalizeVi(effectiveQuery) || normalizeVi(o.value) === normalizeVi(effectiveQuery)
    );
    return !exactMatch;
  }, [allowCreate, effectiveQuery, normalizedOptions]);

  // Tự động kiểm tra không gian trên/dưới màn hình để đặt hướng popover
  const checkPlacement = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < 250 && spaceAbove > 200) {
        setPlacement('top');
      } else {
        setPlacement('bottom');
      }
    }
  }, []);

  // Đóng dropdown và xoá trạng thái tìm kiếm
  const closeMenu = () => {
    setIsOpen(false);
    setSearch('');
    setTyped(false);
    setHighlightIndex(-1);
  };

  // Mở dropdown
  const handleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      checkPlacement();
      setIsOpen(true);
      setVisibleCount(30);
      setHighlightIndex(firstHighlight);
    }
    localInputRef.current?.focus();
  };

  // Thay đổi ô tìm kiếm
  const handleInputChange = (e) => {
    const val = e.target.value;
    if (allowCustom) {
      setTyped(true);
      onChange?.(val, null);
    } else {
      setSearch(val);
    }
    if (!isOpen) {
      checkPlacement();
      setIsOpen(true);
    }
    setVisibleCount(30);
    setHighlightIndex(firstHighlight);
    if (listRef.current) listRef.current.scrollTop = 0;
  };

  // Chọn một option
  const handleSelectOption = (opt) => {
    if (disabled || opt.disabled) return;
    if (multiple) {
      const isAlready = selectedValues.includes(opt.value);
      const next = isAlready
        ? selectedValues.filter((v) => v !== opt.value)
        : [...selectedValues, opt.value];
      const nextOpts = normalizedOptions.filter((o) => next.includes(o.value));
      onChange?.(next, nextOpts);
      setSearch('');
      localInputRef.current?.focus();
    } else {
      onChange?.(opt.value, opt);
      closeMenu();
    }
  };

  // Chọn tạo mới
  const handleCreate = () => {
    if (onCreate) {
      onCreate(effectiveQuery);
    } else {
      onChange?.(effectiveQuery, { value: effectiveQuery, label: effectiveQuery });
    }
    closeMenu();
  };

  // Xoá tag ở chế độ multi
  const handleRemoveTag = (e, valToRemove) => {
    e.stopPropagation();
    if (disabled) return;
    const next = selectedValues.filter((v) => v !== String(valToRemove));
    const nextOpts = normalizedOptions.filter((o) => next.includes(o.value));
    onChange?.(next, nextOpts);
    localInputRef.current?.focus();
  };

  // Nút xoá nhanh toàn bộ
  const handleClear = (e) => {
    e.stopPropagation();
    if (disabled) return;
    onChange?.(multiple ? [] : '', multiple ? [] : null);
    setSearch('');
    localInputRef.current?.focus();
  };

  // Cuộn thêm option (lazy chunking)
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 40) {
      setVisibleCount((prev) => Math.min(prev + 25, filteredOptions.length));
    }
  };

  // Di chuyển dòng đang chọn bằng phím. Dòng đích có thể nằm ngoài số dòng đang vẽ
  // (↑ ở đầu nhảy về cuối) → nới visibleCount tới nó, đợi vẽ xong mới cuộn tới.
  const moveHighlight = (next) => {
    setHighlightIndex(next);
    setVisibleCount((c) => Math.max(c, next + 1));
    requestAnimationFrame(() => {
      document.getElementById(optionId(next))?.scrollIntoView({ block: 'nearest' });
    });
  };

  // Xử lý phím mũi tên và Enter
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (e.key === 'Escape') {
      closeMenu();
      e.stopPropagation();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        handleOpen();
        return;
      }
      const totalItems = filteredOptions.length + (canShowCreate ? 1 : 0);
      if (totalItems > 0) moveHighlight((highlightIndex + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        handleOpen();
        return;
      }
      const totalItems = filteredOptions.length + (canShowCreate ? 1 : 0);
      if (totalItems > 0) moveHighlight(highlightIndex <= 0 ? totalItems - 1 : highlightIndex - 1);
    } else if (e.key === 'Enter') {
      if (isOpen) {
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < filteredOptions.length) {
          handleSelectOption(filteredOptions[highlightIndex]);
        } else if (canShowCreate && highlightIndex === filteredOptions.length) {
          handleCreate();
        } else if (allowCustom) {
          closeMenu();
          onEnter?.();
        }
      } else if (allowCustom) {
        onEnter?.();
      }
    } else if (e.key === 'Backspace' && !search && multiple && selectedValues.length > 0) {
      const next = selectedValues.slice(0, -1);
      const nextOpts = normalizedOptions.filter((o) => next.includes(o.value));
      onChange?.(next, nextOpts);
    }
  };

  const visibleItems = filteredOptions.slice(0, visibleCount);
  const hasValue = multiple ? selectedValues.length > 0 : Boolean(value);
  const showClear = clearable && !disabled && (hasValue || search.length > 0);

  // Giá trị hiển thị trong input
  const inputValue = allowCustom ? (value || '') : search;

  return (
    <div
      ref={containerRef}
      className={`search-select search-select--${size} ${className}`}
      style={style}
      onBlur={(e) => {
        // Focus rời hẳn component (Tab, click ra ngoài) → đóng menu
        if (isOpen && !e.currentTarget.contains(e.relatedTarget)) closeMenu();
      }}
    >
      {label && <label className="search-select__label">{label}</label>}

      {/* Control Container */}
      <div
        className={`search-select__control ${isOpen ? 'search-select__control--open' : ''} ${
          disabled ? 'search-select__control--disabled' : ''
        }`}
        onClick={handleOpen}
        onMouseDown={(e) => {
          // Bấm khung / nút X / mũi tên: giữ focus ở ô gõ, không thì blur làm menu đóng
          if (e.target !== localInputRef.current) e.preventDefault();
        }}
      >
        <div className={`search-select__content ${multiple ? '' : 'search-select__content--nowrap'}`}>
          {/* Multi-select tag chips */}
          {multiple &&
            selectedOptions.map((opt) => (
              <span key={opt.value} className="search-select__tag">
                {opt.badge && <span className="search-select__badge">{opt.badge}</span>}
                <span>{opt.label}</span>
                {!disabled && (
                  <button
                    type="button"
                    className="search-select__tag-remove"
                    onClick={(e) => handleRemoveTag(e, opt.value)}
                    title="Xóa lựa chọn này"
                    aria-label={`Xóa ${opt.label}`}
                  >
                    <AppIcon name="x" size={11} />
                  </button>
                )}
              </span>
            ))}

          {/* Single-select: Hiển thị giá trị đã chọn khi không ở chế độ allowCustom và chưa gõ tìm kiếm */}
          {!multiple && !allowCustom && singleSelectedOption && !search && (
            <div className="search-select__selected">
              {renderSelected ? (
                renderSelected(singleSelectedOption)
              ) : (
                <>
                  {singleSelectedOption.badge && (
                    <span className="search-select__badge">{singleSelectedOption.badge}</span>
                  )}
                  <span className="search-select__selected-text">
                    {singleSelectedOption.label}
                  </span>
                  {singleSelectedOption.sub && (
                    <span className="search-select__selected-sub">
                      · {singleSelectedOption.sub}
                    </span>
                  )}
                </>
              )}
            </div>
          )}

          {/* Ô nhập tìm kiếm hoặc tự do */}
          <input
            {...inputProps}
            ref={localInputRef}
            type="text"
            value={inputValue}
            disabled={disabled}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-label={ariaLabel || label || placeholder}
            aria-expanded={isOpen}
            aria-controls={isOpen ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={isOpen && highlightIndex >= 0 ? optionId(highlightIndex) : undefined}
            placeholder={
              !multiple && !allowCustom && singleSelectedOption && !search
                ? ''
                : (isOpen && !allowCustom ? searchPlaceholder : placeholder)
            }
            className={`search-select__input ${
              !multiple && !allowCustom && singleSelectedOption && !search
                ? 'search-select__input--collapsed'
                : ''
            }`}
          />
        </div>

        {/* Nút Clear & Caret */}
        <div className="search-select__actions">
          {showClear && (
            <button
              type="button"
              className="search-select__btn search-select__clear"
              onClick={handleClear}
              title="Xóa lựa chọn"
              tabIndex={-1}
            >
              <AppIcon name="x" size={13} />
            </button>
          )}
          <button
            type="button"
            className={`search-select__btn search-select__arrow ${
              isOpen ? 'search-select__arrow--open' : ''
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (isOpen) {
                closeMenu();
              } else {
                handleOpen();
              }
            }}
            tabIndex={-1}
            aria-label={isOpen ? 'Đóng danh sách' : 'Mở danh sách'}
          >
            <AppIcon name="caretDown" size={14} />
          </button>
        </div>
      </div>

      {/* Popover Floating Menu */}
      {isOpen && (
        <div
          className={`search-select__menu search-select__menu--${placement}`}
          style={{
            ...(menuWidth ? { width: menuWidth } : {}),
            ...menuStyle,
          }}
          // Click trong menu (cả thanh cuộn) không được lấy focus khỏi ô gõ — xem onBlur ở trên
          onMouseDown={(e) => e.preventDefault()}
        >
          <div
            ref={listRef}
            id={listId}
            className="search-select__list"
            onScroll={handleScroll}
            role="listbox"
          >
            {visibleItems.length === 0 && !canShowCreate ? (
              <div className="search-select__empty">{noResultsText}</div>
            ) : (
              visibleItems.map((opt, idx) => {
                const isSelected = selectedValues.includes(opt.value);
                const isHighlighted = idx === highlightIndex;

                return (
                  <div
                    key={opt.value}
                    id={optionId(idx)}
                    role="option"
                    aria-selected={isSelected}
                    className={`search-select__option ${
                      isSelected ? 'search-select__option--selected' : ''
                    } ${isHighlighted ? 'search-select__option--highlighted' : ''} ${
                      opt.disabled ? 'search-select__option--disabled' : ''
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Tránh làm mất focus của ô gõ
                      handleSelectOption(opt);
                    }}
                    onMouseEnter={() => setHighlightIndex(idx)}
                  >
                    {renderOption ? (
                      renderOption(opt, { isSelected, isHighlighted })
                    ) : (
                      <>
                        <div className="search-select__option-main">
                          {opt.icon && <AppIcon name={opt.icon} size={15} />}
                          {opt.badge && <span className="search-select__badge">{opt.badge}</span>}
                          <span className="search-select__option-label">{opt.label}</span>
                          {opt.sub && (
                            <span className="search-select__option-sub">· {opt.sub}</span>
                          )}
                        </div>
                        {isSelected && <AppIcon name="check" size={14} />}
                      </>
                    )}
                  </div>
                );
              })
            )}

            {/* Mục tạo mới tuỳ chọn */}
            {canShowCreate && (
              <div
                id={optionId(filteredOptions.length)}
                role="option"
                aria-selected={false}
                className={`search-select__option search-select__option--create ${
                  highlightIndex === filteredOptions.length ? 'search-select__option--highlighted' : ''
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleCreate();
                }}
                onMouseEnter={() => setHighlightIndex(filteredOptions.length)}
              >
                <div className="search-select__option-main">
                  <AppIcon name="plus" size={14} />
                  <span>
                    {typeof allowCreate === 'string'
                      ? `${allowCreate}: "${effectiveQuery}"`
                      : `Tạo mới: "${effectiveQuery}"`}
                  </span>
                </div>
              </div>
            )}

            {/* Thông báo số lượng còn lại nếu danh sách dài */}
            {filteredOptions.length > visibleCount && (
              <div className="search-select__footer">
                Đang hiển thị {visibleCount} / {filteredOptions.length} mục
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
