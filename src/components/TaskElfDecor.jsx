import AppIcon from './AppIcon';

/**
 * Trang trí kiểu "Rừng tiên" (mockup "Nhiệm vụ - Rừng tiên (Elf)") — chỉ render khi taskStyle = 'elf'.
 * Sáng: dây leo + hoa ở 2 góc cột, việc xong nở hoa. Tối: dây leo (cùng khung cột với bản sáng).
 * Phần nào thuộc theme nào do CSS (tasks-elf.css) bật/tắt.
 */
const PETAL = 'M10 10 C 6.2 7.4, 6 2.6, 8.5 1.3 L 10 2.8 L 11.5 1.3 C 14 2.6, 13.8 7.4, 10 10 Z';

export function ElfFlower({ petal, center, glow, size }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} style={{ overflow: 'visible', filter: `drop-shadow(0 0 4px ${glow})` }}>
      <g fill={petal}>
        {[0, 72, 144, 216, 288].map((r) => <path key={r} d={PETAL} transform={r ? `rotate(${r} 10 10)` : undefined} />)}
      </g>
      <circle cx="10" cy="10" r="2.6" fill={center} />
    </svg>
  );
}

function Vine({ className }) {
  return (
    <svg className={`tk-elf-vine ${className}`} viewBox="0 0 30 60" aria-hidden="true">
      <path className="tk-elf-vine__stem" d="M14 2 C 6 14, 20 22, 12 34 S 8 50, 14 58" />
      <path className="tk-elf-vine__curl" d="M13 34 c 6 2, 8 8, 4 10 c -3 1, -4 -2, -2 -3" />
      <path className="tk-elf-vine__leaf1" d="M12 12 q -9 -2 -10 -9 q 8 1 10 9 z" />
      <path className="tk-elf-vine__leaf2" d="M16 25 q 9 -3 11 -10 q -9 1 -11 10 z" />
      <path className="tk-elf-vine__leaf3" d="M10 45 q -9 0 -11 -7 q 8 0 11 7 z" />
    </svg>
  );
}

/** Lớp trang trí đặt đầu mỗi cột Kanban (dưới nội dung cột). */
export function ElfColumnDecor() {
  return (
    <>
      <Vine className="is-left" />
      <Vine className="is-right" />
      <span className="tk-elf-corner is-left" aria-hidden="true">
        <ElfFlower petal="#F9C4D6" center="#F08DB0" glow="rgba(255,190,215,.9)" size={17} />
        <span className="tk-elf-pollen" />
      </span>
      <span className="tk-elf-corner is-right" aria-hidden="true">
        <ElfFlower petal="#FCE1EA" center="#F3A6C1" glow="rgba(255,205,225,.9)" size={17} />
        <span className="tk-elf-pollen" />
      </span>
    </>
  );
}

/** Hoa văn dưới tên cột: vạch vàng — lá — hạt thoi — lá — vạch vàng. */
export function ElfDivider() {
  return (
    <div className="tk-elf-divider" aria-hidden="true">
      <span className="tk-elf-divider__line" />
      <AppIcon name="leaf" size={11} weight="fill" style={{ transform: 'rotate(-135deg)' }} />
      <span className="tk-elf-divider__gem" />
      <AppIcon name="leaf" size={11} weight="fill" style={{ transform: 'rotate(45deg)' }} />
      <span className="tk-elf-divider__line is-end" />
    </div>
  );
}

/** Hoa nở ở góc thẻ đã xong (chỉ bản sáng). */
export function ElfBloom() {
  return (
    <span className="tk-elf-bloom" title="Đã xong" aria-hidden="true">
      <span className="tk-elf-bloom__glow" />
      <AppIcon name="leaf" size={11} weight="fill" className="tk-elf-bloom__leaf is-left" />
      <AppIcon name="leaf" size={10} weight="fill" className="tk-elf-bloom__leaf is-right" />
      <ElfFlower petal="#F7B6CC" center="#EE7FA6" glow="rgba(255,190,215,.9)" size={23} />
      <span className="tk-elf-pollen is-lg" />
    </span>
  );
}

// Hoa 5 cánh tròn nhỏ (cụm hoa trên dây leo thẻ xong): toạ độ tâm + màu cánh
const BLOSSOMS = [[80, 1, '#F9A8D4'], [52, 4, '#FFFFFF'], [36, 1.6, '#C4B5FD']];
const petals = (cx, cy) => [[0, -2], [1.9, -0.6], [1.2, 1.6], [-1.2, 1.6], [-1.9, -0.6]].map(([dx, dy]) => [cx + dx, cy + 2 + dy]);

/** Dây leo vắt ngang mép trên thẻ: thẻ trễ hạn (bloom=false) / thẻ xong nở hoa (bloom=true). */
export function ElfCardVine({ bloom = false }) {
  return (
    <svg className="tk-elf-cardvine" width="96" height="14" viewBox="0 0 96 14" aria-hidden="true">
      <path className="tk-elf-cardvine__stem" d="M96 2 C86 5 82 1 74 3 C66 5 62 8 54 6 C46 4 42 2 34 4 C28 5 24 3 20 4 C16 5 15 8 17 9 C19 10 20 8 19 7" />
      <g className="tk-elf-cardvine__leaf">
        <path d="M86 4 C84 .5 88 -.5 89 2.6 Z" />
        <path d="M70 4 C68 7.6 71.6 9 72.6 5.6 Z" />
        <path d="M58 7 C56 10.6 59.6 12 60.6 8.6 Z" />
        <path d="M46 4.4 C44 .8 47.6 -.2 48.6 3 Z" />
        <path d="M30 4.6 C28 8.2 31.6 9.6 32.6 6.2 Z" />
      </g>
      {bloom && BLOSSOMS.map(([cx, cy, c]) => (
        <g key={cx}>
          {petals(cx, cy).map(([x, y], i) => <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="1.6" fill={c} />)}
          <circle cx={cx} cy={cy + 2} r="1" fill="#FDE047" />
        </g>
      ))}
    </svg>
  );
}

/** 3 đom đóm lượn quanh thẻ đang làm. */
export function ElfCardFireflies() {
  return (
    <span className="tk-elf-cardff" aria-hidden="true">
      <span style={{ right: 26, top: 3, width: 5, height: 5, '--dx': '-10px', '--dy': '4px', animationDuration: '2.6s' }} />
      <span style={{ left: '42%', bottom: 3, '--dx': '8px', '--dy': '-3px', animationDuration: '3.1s', animationDelay: '-1.2s' }} />
      <span style={{ right: 6, top: '46%', '--dx': '-3px', '--dy': '-8px', animationDuration: '2.2s', animationDelay: '-.6s' }} />
    </span>
  );
}

/**
 * Thẻ trễ hạn >= 3 ngày: rùa con & sợi tơ nhện rủ xuống thì thầm động viên
 * Mockup & Spec: "Chậm mà chắc nha, làm thôi!" / "Cố lên bạn ơi..."
 */
export function ElfLateNest({ days = 3 }) {
  return (
    <div className="tk-elf-late-nest" title={`Trễ ${days} ngày - Chậm mà chắc nha, làm thôi!`} aria-hidden="true">
      <svg className="tk-elf-late-nest__spider" viewBox="0 0 20 28" width="16" height="22">
        <line x1="10" y1="0" x2="10" y2="16" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1.5 1.5" opacity="0.6" />
        <circle cx="10" cy="18" r="2.2" fill="currentColor" opacity="0.75" />
        <path d="M8 18 L5 16 M12 18 L15 16 M8 19 L5 21 M12 19 L15 21" stroke="currentColor" strokeWidth="0.6" opacity="0.6" />
      </svg>
      <div className="tk-elf-turtle">
        <svg viewBox="0 0 24 16" width="18" height="12">
          <ellipse cx="11" cy="9" rx="7.5" ry="5.5" fill="#4D7C0F" />
          <path d="M6 9 Q11 5 16 9 Q11 12 6 9 Z" fill="#65A30D" opacity="0.7" />
          <circle cx="19.5" cy="9" r="2.5" fill="#84CC16" />
          <circle cx="20.5" cy="8.2" r="0.6" fill="#1E293B" />
          <ellipse cx="5" cy="13.5" rx="1.8" ry="1.2" fill="#65A30D" />
          <ellipse cx="14" cy="13.5" rx="1.8" ry="1.2" fill="#65A30D" />
          <ellipse cx="3.5" cy="9" rx="1.5" ry="1" fill="#65A30D" />
        </svg>
        <span className="tk-elf-turtle__whisper">Chậm mà chắc nha, làm thôi!</span>
      </div>
    </div>
  );
}

/** Cây chuỗi ngày (góc trái dưới, desktop): mỗi ngày làm xong hết việc thì cây lớn thêm, đủ 7 ngày nở hoa; 14 ngày có nấm phát sáng; 30 ngày có cú nhỏ ngủ canh chừng. */
export function ElfStreakTree({ streak }) {
  const f = Math.min(streak, 7) / 7;
  const leaves = ['M17 36 C12 35 9 31 10 29 C13 29 16 32 17 36 Z', 'M17 31 C22 30 25 26 24 24 C21 24 18 27 17 31 Z', 'M17 26 C12 25 9 21 10 19 C13 19 16 22 17 26 Z', 'M17 21 C22 20 25 16 24 14 C21 14 18 17 17 21 Z', 'M17 16 C12 15 9 11 10 9 C13 9 16 12 17 16 Z', 'M17 11 C22 10 25 6 24 4 C21 4 18 7 17 11 Z'];
  return (
    <span className="tk-elf-streak" title="Mỗi ngày làm xong hết việc, cây lớn thêm" data-scene-keep="">
      <svg width="34" height="46" viewBox="0 0 34 46" aria-hidden="true">
        <path className="tk-elf-streak__stem" d="M17 41 C16 34 18 28 17 22 C16 16 18 11 17 6" pathLength="1" strokeDasharray="1" strokeDashoffset={(1 - f).toFixed(3)} />
        {leaves.map((d, i) => <path key={i} className="tk-elf-streak__leaf" d={d} opacity={streak >= i + 1 ? 1 : 0} />)}
        <g opacity={streak >= 7 ? 1 : 0}>
          {[[17, 2.4], [19.5, 4.2], [18.5, 7.1], [15.5, 7.1], [14.5, 4.2]].map(([x, y]) => <circle key={x + y} cx={x} cy={y} r="2" fill="#F9A8D4" />)}
          <circle cx="17" cy="5" r="1.3" fill="#FDE047" />
        </g>
        {/* Chuỗi 14 ngày: Nấm phát sáng quanh gốc */}
        <g opacity={streak >= 14 ? 1 : 0} className="tk-elf-streak__mushrooms">
          <path d="M6 41 C6 37 7 36 7 34" stroke="#CBD5E1" strokeWidth="1" fill="none" />
          <path d="M4 35 C4 31 10 31 10 35 Z" fill="#C084FC" />
          <circle cx="7" cy="33.5" r="0.6" fill="#FFFFFF" />
          <path d="M28 41 C28 38 27 37 27 35" stroke="#CBD5E1" strokeWidth="0.9" fill="none" />
          <path d="M24.5 36 C24.5 32.5 29.5 32.5 29.5 36 Z" fill="#2DD4BF" />
          <circle cx="27" cy="34.5" r="0.5" fill="#FFFFFF" />
        </g>
        {/* Chuỗi 30 ngày: Cú nhỏ đậu ngủ gật trên cành cây, thỉnh thoảng mở mắt */}
        <g opacity={streak >= 30 ? 1 : 0} className="tk-elf-streak__owl">
          <path d="M17 18 Q23 18 28 16" stroke="#4E8B5F" strokeWidth="1.4" fill="none" />
          <ellipse cx="25" cy="13" rx="3.2" ry="4" fill="#78350F" />
          <ellipse cx="25" cy="14" rx="2" ry="2.6" fill="#FEF3C7" />
          <path className="tk-elf-owl-eye" d="M23.5 12 Q24.5 13 25.5 12 M25.5 12 Q26.5 13 27.5 12" stroke="#1E293B" strokeWidth="0.6" fill="none" />
          <polygon points="25.5,13 26,14.2 25,14.2" fill="#F59E0B" />
          <polygon points="22.5,10 23.5,8 24.5,10" fill="#78350F" />
          <polygon points="25.5,10 26.5,8 27.5,10" fill="#78350F" />
        </g>
        <path d="M9 39 H25 V41.4 H9 Z" fill="#C98B5A" />
        <path d="M10 41.4 H24 L22.4 46 H11.6 Z" fill="#B7794A" />
      </svg>
      <span className="tk-elf-streak__lbl">Chuỗi {streak} ngày</span>
    </span>
  );
}
