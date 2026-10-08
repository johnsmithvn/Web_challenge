import React, { useState } from 'react';
import MUSCLE_MAP from '../../data/body-muscles.json';

/**
 * MuscleAnatomy2D — Bản đồ giải phẫu cơ thể người 2D phẳng (Vector SVG)
 * Hiển thị 2 mặt Trước (Front) & Sau (Back) với các khối cơ sáng đèn theo bài tập.
 *
 * @param {Object} props
 * @param {string} [props.primary] - Key nhóm cơ chính (ví dụ 'chest')
 * @param {string[]} [props.secondary] - Danh sách key nhóm cơ phụ (ví dụ ['shoulders', 'triceps'])
 * @param {number} [props.height] - Chiều cao hiển thị (default 260)
 * @param {boolean} [props.interactive] - Cho phép hover/click xem tên nhóm cơ
 * @param {Function} [props.onSelectMuscle] - Callback khi bấm vào một nhóm cơ
 */
export default function MuscleAnatomy2D({
  primary = '',
  secondary = [],
  height = 260,
  interactive = true,
  onSelectMuscle
}) {
  const [hoveredMuscle, setHoveredMuscle] = useState(null);

  // Hàm xác định màu sắc cho từng nhóm cơ
  const getMuscleColor = (muscleKey) => {
    const isPrimary = muscleKey === primary;
    const isSecondary = Array.isArray(secondary) && secondary.includes(muscleKey);
    const isHovered = hoveredMuscle === muscleKey;

    if (isPrimary) {
      return '#2563EB'; // Xanh dương đậm chủ đạo (Vibrant Royal Blue)
    }
    if (isSecondary) {
      return '#60A5FA'; // Xanh dương nhạt cho cơ phụ (Sky Blue)
    }
    if (isHovered && interactive) {
      return 'var(--body-accent-soft, #93C5FD)';
    }
    // Cơ không tham gia: xám nhạt trung tính
    return 'var(--body-anatomy-inactive, #CBD5E1)';
  };

  const getStrokeColor = (muscleKey) => {
    const isPrimary = muscleKey === primary;
    const isSecondary = Array.isArray(secondary) && secondary.includes(muscleKey);
    if (isPrimary) return '#1D4ED8';
    if (isSecondary) return '#3B82F6';
    return 'var(--body-anatomy-stroke, #FFFFFF)';
  };

  const handleMouseEnter = (muscleKey) => {
    if (interactive) setHoveredMuscle(muscleKey);
  };

  const handleMouseLeave = () => {
    if (interactive) setHoveredMuscle(null);
  };

  const handleClick = (muscleKey) => {
    if (interactive && onSelectMuscle) {
      onSelectMuscle(muscleKey);
    }
  };

  const renderMusclePath = (muscleKey, d, label) => {
    const fill = getMuscleColor(muscleKey);
    const stroke = getStrokeColor(muscleKey);
    const isTarget = muscleKey === primary || (Array.isArray(secondary) && secondary.includes(muscleKey));

    return (
      <path
        d={d}
        fill={fill}
        stroke={stroke}
        strokeWidth={stroke === '#FFFFFF' ? '1.5' : '1.8'}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{
          cursor: interactive ? 'pointer' : 'default',
          transition: 'fill 0.2s ease, transform 0.15s ease',
          filter: isTarget ? 'drop-shadow(0 1px 3px rgba(37, 99, 235, 0.25))' : 'none'
        }}
        onMouseEnter={() => handleMouseEnter(muscleKey)}
        onMouseLeave={handleMouseLeave}
        onClick={() => handleClick(muscleKey)}
      >
        <title>{label || MUSCLE_MAP[muscleKey]?.name || muscleKey}</title>
      </path>
    );
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px',
      userSelect: 'none'
    }}>
      {/* SVG Canvas chứa 2 hình thể Trước & Sau song song */}
      <svg
        viewBox="0 0 280 270"
        style={{
          height: `${height}px`,
          width: 'auto',
          maxWidth: '100%',
          overflow: 'visible'
        }}
      >
        <defs>
          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* MẶT TRƯỚC (ANTERIOR / FRONT VIEW) — Tâm x ~ 70                      */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <g id="front-view">
          {/* Đầu & Cổ (Base) */}
          <ellipse cx="70" cy="18" rx="8" ry="11" fill="var(--body-anatomy-base, #E2E8F0)" />
          <path d="M 66 28 L 66 36 L 74 36 L 74 28 Z" fill="var(--body-anatomy-base, #E2E8F0)" />

          {/* Cầu vai trước (Traps) */}
          {renderMusclePath('traps', 'M 66 34 L 56 38 L 57 42 L 67 36 Z M 74 34 L 84 38 L 83 42 L 73 36 Z', 'Cầu vai')}

          {/* Vai trước (Shoulders / Anterior Deltoids) */}
          {renderMusclePath('shoulders', 'M 54 39 C 48 42, 45 49, 46 56 C 48 57, 51 54, 54 50 L 55 42 Z', 'Vai trái')}
          {renderMusclePath('shoulders', 'M 86 39 C 92 42, 95 49, 94 56 C 92 57, 89 54, 86 50 L 85 42 Z', 'Vai phải')}

          {/* Cơ ngực (Chest / Pectoralis major) */}
          {renderMusclePath('chest', 'M 57 43 L 69 43 L 69 58 C 63 60, 56 57, 54 51 Z', 'Ngực trái')}
          {renderMusclePath('chest', 'M 83 43 L 71 43 L 71 58 C 77 60, 84 57, 86 51 Z', 'Ngực phải')}

          {/* Bắp tay trước (Biceps) */}
          {renderMusclePath('biceps', 'M 45 57 C 42 63, 42 72, 45 77 L 50 75 C 50 68, 51 61, 49 56 Z', 'Tay trước trái')}
          {renderMusclePath('biceps', 'M 95 57 C 98 63, 98 72, 95 77 L 90 75 C 90 68, 89 61, 91 56 Z', 'Tay trước phải')}

          {/* Cẳng tay trước (Forearms) */}
          {renderMusclePath('forearms', 'M 44 78 C 39 85, 38 98, 41 106 L 45 106 C 47 98, 48 88, 48 78 Z', 'Cẳng tay trái')}
          {renderMusclePath('forearms', 'M 96 78 C 101 85, 102 98, 99 106 L 95 106 C 93 98, 92 88, 92 78 Z', 'Cẳng tay phải')}
          {/* Bàn tay */}
          <path d="M 40 107 C 39 112, 42 118, 44 120 L 45 110 Z M 100 107 C 101 112, 98 118, 96 120 L 95 110 Z" fill="var(--body-anatomy-base, #E2E8F0)" />

          {/* Cơ bụng 6 múi (Abs / Rectus Abdominis) */}
          {renderMusclePath('abs', 'M 64 59 L 69 59 L 69 66 L 64 66 Z M 71 59 L 76 59 L 76 66 L 71 66 Z', 'Bụng trên')}
          {renderMusclePath('abs', 'M 64 68 L 69 68 L 69 76 L 64 76 Z M 71 68 L 76 68 L 76 76 L 71 76 Z', 'Bụng giữa')}
          {renderMusclePath('abs', 'M 64 78 L 69 78 L 69 88 L 65 88 Z M 71 78 L 76 78 L 75 88 L 71 88 Z', 'Bụng dưới')}

          {/* Cơ liên sườn (Obliques) */}
          {renderMusclePath('obliques', 'M 54 53 L 62 61 L 62 76 C 59 74, 57 67, 55 60 Z', 'Liên sườn trái')}
          {renderMusclePath('obliques', 'M 86 53 L 78 61 L 78 76 C 81 74, 83 67, 85 60 Z', 'Liên sườn phải')}

          {/* Khung chậu / Đáy hông (Base) */}
          <path d="M 62 89 L 78 89 L 74 100 L 66 100 Z" fill="var(--body-anatomy-base, #E2E8F0)" />

          {/* Cơ đùi trước (Quads / Quadriceps) */}
          {renderMusclePath('quads', 'M 57 101 C 55 114, 54 135, 59 148 C 63 148, 66 142, 67 132 C 67 120, 68 108, 67 101 Z', 'Đùi trước trái')}
          {renderMusclePath('quads', 'M 83 101 C 85 114, 86 135, 81 148 C 77 148, 74 142, 73 132 C 73 120, 72 108, 73 101 Z', 'Đùi trước phải')}

          {/* Khớp gối (Knees base) */}
          <ellipse cx="62" cy="154" rx="4" ry="4.5" fill="var(--body-anatomy-base, #E2E8F0)" />
          <ellipse cx="78" cy="154" rx="4" ry="4.5" fill="var(--body-anatomy-base, #E2E8F0)" />

          {/* Bắp chân trước / Ống đồng (Calves & Tibialis) */}
          {renderMusclePath('calves', 'M 59 159 C 56 170, 56 188, 60 200 L 64 200 C 65 188, 65 172, 64 159 Z', 'Bắp chân trái')}
          {renderMusclePath('calves', 'M 81 159 C 84 170, 84 188, 80 200 L 76 200 C 75 188, 75 172, 76 159 Z', 'Bắp chân phải')}

          {/* Bàn chân trước (Feet base) */}
          <path d="M 59 202 L 58 214 L 64 214 L 64 202 Z M 76 202 L 76 214 L 82 214 L 81 202 Z" fill="var(--body-anatomy-base, #E2E8F0)" />

          {/* Nhãn Mặt trước */}
          <text x="70" y="235" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--body-text-muted)">
            Mặt trước
          </text>
        </g>

        {/* Đường chia cách nhẹ giữa 2 hình thể */}
        <line x1="140" y1="20" x2="140" y2="225" stroke="var(--body-card-border, #E2E8F0)" strokeDasharray="3 3" opacity="0.6" />

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* MẶT SAU (POSTERIOR / BACK VIEW) — Tâm x ~ 210                       */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <g id="back-view">
          {/* Đầu & Cổ sau (Base) */}
          <ellipse cx="210" cy="18" rx="8" ry="11" fill="var(--body-anatomy-base, #E2E8F0)" />
          <path d="M 206 28 L 206 36 L 214 36 L 214 28 Z" fill="var(--body-anatomy-base, #E2E8F0)" />

          {/* Cơ cầu vai hình thoi (Trapezius upper, mid, lower) */}
          {renderMusclePath('traps', 'M 206 33 L 194 40 L 205 58 L 210 65 L 215 58 L 226 40 L 214 33 Z', 'Cầu vai sau')}

          {/* Vai sau (Shoulders / Posterior Deltoids) */}
          {renderMusclePath('shoulders', 'M 193 40 C 187 43, 185 50, 186 56 C 188 57, 191 54, 194 48 Z', 'Vai sau trái')}
          {renderMusclePath('shoulders', 'M 227 40 C 233 43, 235 50, 234 56 C 232 57, 229 54, 226 48 Z', 'Vai sau phải')}

          {/* Bắp tay sau (Triceps / 3 đầu bắp tay sau) */}
          {renderMusclePath('triceps', 'M 185 57 C 182 64, 182 72, 185 77 L 189 75 C 190 68, 191 61, 189 56 Z', 'Tay sau trái')}
          {renderMusclePath('triceps', 'M 235 57 C 238 64, 238 72, 235 77 L 231 75 C 230 68, 229 61, 231 56 Z', 'Tay sau phải')}

          {/* Cẳng tay sau (Forearms posterior) */}
          {renderMusclePath('forearms', 'M 184 78 C 179 85, 178 98, 181 106 L 185 106 C 187 98, 188 88, 188 78 Z', 'Cẳng tay sau trái')}
          {renderMusclePath('forearms', 'M 236 78 C 241 85, 242 98, 239 106 L 235 106 C 233 98, 232 88, 232 78 Z', 'Cẳng tay sau phải')}
          {/* Bàn tay sau */}
          <path d="M 180 107 C 179 112, 182 118, 184 120 L 185 110 Z M 240 107 C 241 112, 238 118, 236 120 L 235 110 Z" fill="var(--body-anatomy-base, #E2E8F0)" />

          {/* Cơ lưng xô (Lats / Latissimus dorsi) */}
          {renderMusclePath('lats', 'M 194 51 L 204 63 L 204 84 C 197 81, 193 72, 192 59 Z', 'Lưng xô trái')}
          {renderMusclePath('lats', 'M 226 51 L 216 63 L 216 84 C 223 81, 227 72, 228 59 Z', 'Lưng xô phải')}

          {/* Cơ dựng sống / Lưng dưới (Lower Back / Erector spinae) */}
          {renderMusclePath('lowerback', 'M 205 67 L 209 67 L 209 90 L 205 90 Z M 211 67 L 215 67 L 215 90 L 211 90 Z', 'Lưng dưới')}

          {/* Cơ mông (Glutes / Gluteus Maximus) */}
          {renderMusclePath('glutes', 'M 197 92 C 195 105, 198 116, 208 118 L 208 93 Z', 'Mông trái')}
          {renderMusclePath('glutes', 'M 223 92 C 225 105, 222 116, 212 118 L 212 93 Z', 'Mông phải')}

          {/* Đùi sau (Hamstrings / Biceps femoris) */}
          {renderMusclePath('hamstrings', 'M 197 120 C 195 132, 196 142, 201 148 L 207 148 C 208 138, 208 128, 207 120 Z', 'Đùi sau trái')}
          {renderMusclePath('hamstrings', 'M 223 120 C 225 132, 224 142, 219 148 L 213 148 C 212 138, 212 128, 213 120 Z', 'Đùi sau phải')}

          {/* Khoèo chân sau (Base) */}
          <ellipse cx="204" cy="154" rx="4" ry="4.5" fill="var(--body-anatomy-base, #E2E8F0)" />
          <ellipse cx="216" cy="154" rx="4" ry="4.5" fill="var(--body-anatomy-base, #E2E8F0)" />

          {/* Bắp chuối sau (Calves / Gastrocnemius diamond) */}
          {renderMusclePath('calves', 'M 199 159 C 195 168, 196 182, 200 198 L 205 198 C 208 184, 208 170, 206 159 Z', 'Bắp chuối sau trái')}
          {renderMusclePath('calves', 'M 221 159 C 225 168, 224 182, 220 198 L 215 198 C 212 184, 212 170, 214 159 Z', 'Bắp chuối sau phải')}

          {/* Gót & Bàn chân sau (Feet base) */}
          <path d="M 199 202 L 198 214 L 204 214 L 204 202 Z M 216 202 L 216 214 L 222 214 L 221 202 Z" fill="var(--body-anatomy-base, #E2E8F0)" />

          {/* Nhãn Mặt sau */}
          <text x="210" y="235" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--body-text-muted)">
            Mặt sau
          </text>
        </g>
      </svg>

      {/* Chú thích màu sắc (Legend) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: '14px',
        fontSize: '11.5px',
        color: 'var(--body-text-muted)',
        marginTop: '-4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#2563EB', display: 'inline-block' }} />
          <span>Cơ chính: <strong>{MUSCLE_MAP[primary]?.name || primary || 'Không'}</strong></span>
        </div>

        {Array.isArray(secondary) && secondary.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#60A5FA', display: 'inline-block' }} />
            <span>Cơ phụ ({secondary.map(k => MUSCLE_MAP[k]?.name || k).join(', ')})</span>
          </div>
        )}

        {hoveredMuscle && (
          <div style={{
            fontSize: '11.5px',
            fontWeight: 700,
            color: 'var(--body-accent)',
            padding: '2px 8px',
            borderRadius: '6px',
            background: 'var(--body-accent-soft)'
          }}>
            👉 {MUSCLE_MAP[hoveredMuscle]?.name || hoveredMuscle}
          </div>
        )}
      </div>
    </div>
  );
}
