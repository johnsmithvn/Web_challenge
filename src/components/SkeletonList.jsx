import '../styles/skeleton.css';

/**
 * SkeletonList — khung chờ dạng danh sách, dùng chung cho mọi màn list.
 *
 * Trước đây mỗi màn tự xử: Finance không hiện gì (trang trống rồi list bật ra),
 * sáu màn còn lại hiện đúng một dòng chữ "Đang tải…". Cả hai đều làm layout nhảy
 * một cái khi data về. Skeleton giữ sẵn chỗ nên lúc data về không có cú giật nào.
 *
 * Một component với vài prop thay vì mỗi màn một biến thể: dòng nào cũng là
 * [icon] [chữ] [số bên phải], khác nhau chỉ ở chỗ bật/tắt từng phần.
 *
 * @param rows   số dòng giả (mặc định 4 — đủ để lấp phần nhìn thấy, không hơn)
 * @param icon   có ô icon vuông bên trái không
 * @param lines  số dòng chữ mỗi dòng (1 = chỉ tên, 2 = tên + phụ đề)
 * @param right  có khối bên phải không (số tiền, trạng thái)
 * @param plain  bỏ khung viền — dùng cho list không có card bao ngoài
 * @param gap    khoảng cách giữa các dòng, ví dụ '6px'
 */
export default function SkeletonList({
  rows = 4, icon = true, lines = 2, right = true, plain = false, heading = false,
  gap, className = '', label = 'Đang tải danh sách',
}) {
  // Bề rộng dòng chữ so le theo chu kỳ 3 để không ra một khối chữ nhật đều tăm tắp.
  const widths = [['62%', '38%'], ['48%', '54%'], ['70%', '30%']];
  return (
    <div className={`sk-list ${className}`} style={gap ? { '--sk-gap': gap } : undefined}
      role="status" aria-busy="true" aria-label={label}>
      {heading && <span className="sk-heading" />}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`sk-row${plain ? ' sk-row--plain' : ''}`}>
          {icon && <span className="sk-dot" />}
          <span className="sk-lines">
            <span className="sk-line sk-line--title" style={{ '--w': widths[i % 3][0] }} />
            {lines > 1 && <span className="sk-line sk-line--sm" style={{ '--w': widths[i % 3][1] }} />}
          </span>
          {right && (
            <span className="sk-right">
              <span className="sk-line" style={{ '--w': '68px' }} />
              <span className="sk-line sk-line--sm" style={{ '--w': '44px' }} />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
