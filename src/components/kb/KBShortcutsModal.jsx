/**
 * KBShortcutsModal — bảng phím tắt (?) cho Knowledge Base.
 */

const GROUPS = [
  {
    title: 'Điều hướng',
    items: [
      ['J / K', 'Bài kế / bài trước'],
      ['↵', 'Mở bài đang chọn'],
      ['Esc', 'Quay lại · đóng lớp phủ · xóa lọc'],
      ['G rồi L', 'Về danh sách'],
      ['G rồi G', 'Sơ đồ liên kết'],
      ['G rồi C', 'Canvas'],
      ['G rồi Q', 'Gallery trích dẫn'],
    ],
  },
  {
    title: 'Thao tác',
    items: [
      ['N', 'Bài mới'],
      ['E', 'Sửa bài đang mở'],
      ['X', 'Chọn / bỏ chọn (chế độ chọn nhiều)'],
      ['V', 'Bật chế độ chọn nhiều'],
      ['⌫', 'Xóa bài đang chọn'],
      ['⌘Z', 'Hoàn tác lần xóa gần nhất'],
      ['F', 'Chế độ đọc tập trung'],
    ],
  },
  {
    title: 'Soạn & tìm',
    items: [
      ['/', 'Nhảy vào ô tìm kiếm'],
      ['?', 'Bảng phím tắt này'],
      ['⌘S', 'Lưu bài đang soạn'],
      ['[[', 'Chèn liên kết wiki'],
      ['⌘B · ⌘I', 'Đậm · nghiêng (Visual)'],
      ['T', 'Đổi nền sáng/tối'],
    ],
  },
];

export default function KBShortcutsModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="kb-overlay" onClick={onClose}>
      <div className="kb-shortcuts-modal" onClick={e => e.stopPropagation()} style={{ animation: 'kb-pop .16s ease' }}>
        <div className="kb-shortcuts-modal__header">
          <h2 className="kb-shortcuts-modal__title">Phím tắt</h2>
          <button className="kb-btn-ghost kb-btn-ghost--small" onClick={onClose}>esc</button>
        </div>

        <div className="kb-shortcuts-modal__body">
          {GROUPS.map(group => (
            <div key={group.title} className="kb-shortcuts-group">
              <h3 className="kb-shortcuts-group__title">{group.title}</h3>
              {group.items.map(([key, desc]) => (
                <div key={key} className="kb-shortcuts-row">
                  <kbd className="kb-shortcuts-kbd">{key}</kbd>
                  <span className="kb-shortcuts-desc">{desc}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
