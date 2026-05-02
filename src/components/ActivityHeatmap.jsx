import { useMemo } from 'react';

/**
 * ActivityHeatmap — GitHub-style yearly contribution heatmap (SVG).
 * Data: [{ date: 'YYYY-MM-DD', count: N }]
 *
 * Renders 53 columns × 7 rows = 371 cells for a full year.
 * Color intensity scales with count.
 */

const DAY_LABELS = ['', 'T2', '', 'T4', '', 'T6', ''];
const MONTH_LABELS = ['Th1','Th2','Th3','Th4','Th5','Th6','Th7','Th8','Th9','Th10','Th11','Th12'];

// Color scale (dark mode)
const COLORS = [
  'rgba(255,255,255,0.04)', // 0 — empty
  'rgba(139,92,246,0.2)',   // 1
  'rgba(139,92,246,0.4)',   // 2-3
  'rgba(139,92,246,0.6)',   // 4-6
  'rgba(139,92,246,0.85)',  // 7+
];

function getColor(count) {
  if (count === 0) return COLORS[0];
  if (count === 1) return COLORS[1];
  if (count <= 3)  return COLORS[2];
  if (count <= 6)  return COLORS[3];
  return COLORS[4];
}

function buildYearGrid(data, year) {
  const countMap = {};
  data.forEach(d => { countMap[d.date] = d.count; });

  // Start from Jan 1
  const start = new Date(year, 0, 1);
  const startDay = start.getDay(); // 0=Sun, 1=Mon, ...
  // Adjust to start from Monday
  const adjustedStart = new Date(start);
  adjustedStart.setDate(adjustedStart.getDate() - ((startDay + 6) % 7));

  const weeks = [];
  const current = new Date(adjustedStart);

  for (let w = 0; w < 53; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = current.toISOString().split('T')[0];
      const inYear = current.getFullYear() === year;
      week.push({
        date: dateStr,
        count: inYear ? (countMap[dateStr] || 0) : -1,
        inYear,
      });
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

// Month labels with approximate column positions
function getMonthPositions(year) {
  const positions = [];
  for (let m = 0; m < 12; m++) {
    const firstDay = new Date(year, m, 1);
    const yearStart = new Date(year, 0, 1);
    const startDay = yearStart.getDay();
    const adjustedStart = new Date(yearStart);
    adjustedStart.setDate(adjustedStart.getDate() - ((startDay + 6) % 7));
    const daysDiff = Math.floor((firstDay - adjustedStart) / (1000 * 60 * 60 * 24));
    const weekIndex = Math.floor(daysDiff / 7);
    positions.push({ month: m, weekIndex });
  }
  return positions;
}

export default function ActivityHeatmap({ data = [], year, onDateClick }) {
  const currentYear = year || new Date().getFullYear();
  const weeks = useMemo(() => buildYearGrid(data, currentYear), [data, currentYear]);
  const monthPositions = useMemo(() => getMonthPositions(currentYear), [currentYear]);

  const cellSize = 12;
  const cellGap = 2;
  const step = cellSize + cellGap;
  const labelWidth = 26;
  const topPadding = 18;
  const width = labelWidth + weeks.length * step + 10;
  const height = topPadding + 7 * step + 4;

  const totalCount = useMemo(() => data.reduce((sum, d) => sum + d.count, 0), [data]);

  return (
    <div className="heatmap-container">
      <div className="heatmap-header">
        <span className="heatmap-total">{totalCount} hoạt động trong {currentYear}</span>
      </div>
      <svg className="heatmap-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Month labels */}
        {monthPositions.map(({ month, weekIndex }) => (
          <text
            key={month}
            x={labelWidth + weekIndex * step}
            y={12}
            className="heatmap-month-label"
            fontSize="9"
            fill="var(--text-muted)"
          >
            {MONTH_LABELS[month]}
          </text>
        ))}

        {/* Day labels */}
        {DAY_LABELS.map((label, i) => (
          label && (
            <text
              key={i}
              x={0}
              y={topPadding + i * step + cellSize - 2}
              className="heatmap-day-label"
              fontSize="9"
              fill="var(--text-muted)"
            >
              {label}
            </text>
          )
        ))}

        {/* Cells */}
        {weeks.map((week, wi) =>
          week.map((day, di) => (
            day.inYear && (
              <rect
                key={day.date}
                x={labelWidth + wi * step}
                y={topPadding + di * step}
                width={cellSize}
                height={cellSize}
                rx={2}
                fill={getColor(day.count)}
                className="heatmap-cell"
                onClick={() => onDateClick?.(day.date)}
                style={{ cursor: onDateClick ? 'pointer' : 'default' }}
              >
                <title>{day.date}: {day.count} hoạt động</title>
              </rect>
            )
          ))
        )}
      </svg>

      {/* Legend */}
      <div className="heatmap-legend">
        <span className="heatmap-legend__label">Ít</span>
        {COLORS.map((color, i) => (
          <div key={i} className="heatmap-legend__cell" style={{ background: color }} />
        ))}
        <span className="heatmap-legend__label">Nhiều</span>
      </div>
    </div>
  );
}
