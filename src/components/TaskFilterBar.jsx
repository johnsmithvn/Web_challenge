import { useState } from 'react';
import AppIcon from './AppIcon';
import { DateRangePopover } from './TaskFloatingPopovers';

/*
 * TaskFilterBar — thanh lọc theo thời gian + tìm kiếm (mockup "Nhiệm vụ · Kanban").
 * Desktop: các pill Tất cả / Hôm nay / 7 ngày tới / Quá hạn + "Chọn ngày" + ô tìm bên phải.
 * Mobile : segmented 4 nút (Quá hạn hiện số đỏ) + nút lịch; ô tìm nằm ở header (icon kính lúp).
 */

const TIME_FILTERS = [
  { id: 'all', label: 'Tất cả', short: 'Tất cả' },
  { id: 'today', label: 'Hôm nay', short: 'Hôm nay' },
  { id: '7d', label: '7 ngày tới', short: '7 ngày' },
  { id: 'late', label: 'Quá hạn', short: 'Quá hạn' },
];

const dm = (v) => `${Number(v.slice(8, 10))}/${Number(v.slice(5, 7))}`;
const rangeLabel = (r) => (!r ? 'Chọn ngày' : r.customFrom === r.customTo ? dm(r.customFrom) : `${dm(r.customFrom)} – ${dm(r.customTo)}`);

export default function TaskFilterBar({
  filter,
  onFilter,
  range,
  onRange,
  search,
  onSearch,
  counts = {},
  resultCount = 0,
}) {
  const [pop, setPop] = useState(null);
  const rangeOn = filter === 'custom' && !!range;

  const openRange = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPop({ x: r.left, y: r.bottom + 6 });
  };
  const clearRange = (e) => {
    e.stopPropagation();
    onRange(null);
    onFilter('all');
  };

  return (
    <>
      {pop && (
        <DateRangePopover
          initialFrom={range?.customFrom}
          initialTo={range?.customTo}
          onApply={(from, to) => {
            onRange({ customFrom: from, customTo: to });
            onFilter('custom');
          }}
          onClose={() => setPop(null)}
          style={{ position: 'fixed', top: `${pop.y}px`, left: `${Math.min(pop.x, window.innerWidth - 276)}px` }}
        />
      )}

      {/* ── Desktop ── */}
      <div className="tk-filter-bar tk-desktop-only">
        {TIME_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilter(f.id)}
            className={`tk-filter-pill${filter === f.id ? ' tk-filter-pill--active' : ''}`}
          >
            {f.label}
            <span className="tk-filter-pill__count">{counts[f.id] ?? 0}</span>
          </button>
        ))}
        <button type="button" onClick={openRange} className={`tk-filter-pill${rangeOn ? ' tk-filter-pill--active' : ''}`}>
          <AppIcon name="calendar" size={13} />
          {rangeOn ? rangeLabel(range) : 'Chọn ngày'}
          {rangeOn && (
            <span role="button" aria-label="Bỏ lọc ngày" className="tk-filter-pill__clear" onClick={clearRange}>
              <AppIcon name="x" size={10} />
            </span>
          )}
        </button>

        <div className="tk-filter-bar__right">
          {search.trim() && <span className="tk-filter-bar__result">{resultCount} kết quả</span>}
          <label className="tk-search-box">
            <AppIcon name="search" size={15} style={{ color: 'var(--tk-text-sub)', flex: 'none' }} />
            <input
              type="text"
              placeholder="Tìm việc, mô tả, việc con, #nhãn"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  onSearch('');
                  e.target.blur();
                }
              }}
            />
            {search && (
              <button type="button" className="tk-search-box__clear" onClick={() => onSearch('')} title="Xoá tìm kiếm">
                <AppIcon name="x" size={11} />
              </button>
            )}
          </label>
        </div>
      </div>

      {/* ── Mobile ── */}
      <div className="tk-mfilter tk-mobile-only">
        <div className="tk-mfilter__seg">
          {TIME_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onFilter(f.id)}
              className={`tk-mfilter__btn${filter === f.id ? ' is-on' : ''}`}
            >
              {f.short}
              {f.id === 'late' && (counts.late ?? 0) > 0 && <span className="tk-mfilter__late">{counts.late}</span>}
            </button>
          ))}
        </div>
        <button type="button" className={`tk-mfilter__range${rangeOn ? ' is-on' : ''}`} onClick={openRange} aria-label="Chọn khoảng ngày">
          <AppIcon name="calendar" size={16} />
        </button>
      </div>
      {rangeOn && (
        <div className="tk-mfilter__chip-row tk-mobile-only">
          <button type="button" className="tk-mfilter__chip" onClick={clearRange}>
            <AppIcon name="calendar" size={13} />
            {rangeLabel(range)}
            <AppIcon name="x" size={11} />
          </button>
        </div>
      )}
    </>
  );
}
