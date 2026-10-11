import AppIcon from './AppIcon';

/**
 * Trang trí kiểu "Rừng tiên" (mockup "Nhiệm vụ - Rừng tiên (Elf)") — chỉ render khi taskStyle = 'elf'.
 * Sáng: dây leo + hoa ở 2 góc cột, việc xong nở hoa. Tối: đỉnh cột là vòm nhọn viền vàng + lá ở đỉnh.
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
      <span className="tk-elf-arch" aria-hidden="true">
        <span className="tk-elf-arch__bg" />
        <span className="tk-elf-arch__gold" />
        <span className="tk-elf-arch__mint" />
        <span className="tk-elf-arch__leaf"><AppIcon name="leaf" size={14} weight="fill" /></span>
      </span>
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
