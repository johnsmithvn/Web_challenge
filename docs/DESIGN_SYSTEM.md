# Life Hub Design System & Layout Architecture Standards

> **Tài liệu Quy Chuẩn Thiết Kế & Bố Cục Không Gian Toàn Hệ Thống**  
> Áp dụng bắt buộc cho mọi phân hệ: Nhiệm Vụ (`/tasks`), Tài Chính (`/finance`), Kiến Thức (`/collect`), Két Mật Mã (`/accounts`), Hộp Thư Đến (`/inbox`).

---

## 1. Triết Lý Thiết Kế (Design Philosophy)
Life Hub không phải là một website đọc tin tức đơn thuần, mà là một **Hệ Điều Hành Đời Sống Cá Nhân (Personal Life OS)**. Do đó, trải nghiệm tương tác phải đạt các tiêu chuẩn của phần mềm ứng dụng cao cấp (Desktop App-like):
- **Phẳng, thanh thoát, tinh tế**: Lấy cảm hứng từ sự chỉn chu của Google Calendar, Linear và Apple Notes.
- **Không chớp giật layout (Zero Layout Jump)**: Thanh công cụ, tiêu đề và bộ lọc luôn đứng vững vàng độc lập với nội dung cuộn.
- **Không xung đột thanh cuộn (Zero Scroll Trap)**: Triệt tiêu hoàn toàn hiện tượng 2 thanh cuộn lồng nhau hoặc cuộn trang thừa thãi.
- **Dữ liệu không bao giờ bị méo mó**: Mọi bảng lưới và cột thông tin phải co giãn thông minh, không bị text dài phá vỡ cấu trúc.

---

## 2. Quy Tắc Bố Cục Không Gian (Layout Patterns)

Mọi màn hình trong Life Hub được phân thành đúng **2 Mô hình Bố cục**:

### Mô hình A: Workspace Pattern (Lịch, Editor, Bảng Điều Khiển, Danh mục Tài chính)
*Áp dụng cho các màn hình làm việc tương tác cao, nơi người dùng thao tác liên tục.*
*   **Chiều cao**: Bắt buộc ăn trọn **`100dvh`** trên Desktop (`height: 100dvh; overflow: hidden;`).
*   **Thanh cuộn toàn trang (`body`)**: **Tuyệt đối cấm**. Người dùng không bao giờ bị cuộn cả trang làm mất thanh điều hướng.
*   **Header / Toolbar**: Cố định độc lập ở đỉnh (`flex-shrink: 0;`). Khi chuyển view hay lọc dữ liệu, Header hoàn toàn đứng im.
*   **Vùng làm việc (Workspace Scroll)**: Chỉ duy nhất vùng danh sách/lưới nội dung bên trong được phép cuộn (`overflow-y: auto; flex: 1; min-height: 0;`).
*   **Đệm né nút FAB**: Khoảng đệm né nút tròn `+` (`QuickCapture FAB`) luôn nằm **nội bộ bên trong vùng cuộn** (`padding-bottom: 40px;`), giữ khung card ngoài chạm kịch đáy màn hình, không làm hở chân trang.

### Mô hình B: Document Pattern (Cài đặt, Nhật ký Audit Logs, Điều khoản)
*Áp dụng cho các trang đọc thông tin dạng bài viết dài.*
*   Cuộn trang một luồng tự nhiên từ trên xuống dưới (`min-height: 100dvh`).
*   Căn giữa với độ rộng đọc tối ưu (`max-width: 900px`).

---

## 3. Quy Tắc Lưới An Toàn (`minmax(0, 1fr)`)

Trong CSS Grid, **tuyệt đối không dùng `1fr` trơn cho các cột có chứa nội dung động**:
*   *Lý do kỹ thuật*: Theo chuẩn CSS Grid spec, `1fr` tương đương `minmax(auto, 1fr)`. Nếu bên trong ô có văn bản dài hoặc nhiều tag con nằm ngang không ngắt dòng, cột đó sẽ bị phình to ra và ép méo toàn bộ các cột còn lại trong bảng.
*   *Quy tắc chuẩn*:
    ```css
    /* Chuẩn an toàn cho lưới nhiều cột: */
    grid-template-columns: repeat(N, minmax(0, 1fr));
    
    /* Với bảng có cột nhãn cố định bên trái (như Lịch Tuần): */
    grid-template-columns: 60px repeat(7, minmax(0, 1fr));
    ```
*   Mọi phần tử con bên trong ô lưới phải có `min-width: 0; box-sizing: border-box;` và văn bản một dòng phải có `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`.

---

## 4. Hệ Thống Khoảng Cách (8-Point Spacing Grid)

| Token | Giá trị | Ứng dụng chuẩn |
| :--- | :--- | :--- |
| `--space-xs` | `0.25rem` (4px) | Khoảng cách giữa icon và chữ, khoảng cách giữa các badge |
| `--space-sm` | `0.5rem` (8px) | Padding viền ngoài trang Desktop, khoảng cách giữa các chip bộ lọc |
| `--space-md` | `1.0rem` (16px) | Padding bên trong Card, khoảng cách giữa các khối thông tin |
| `--space-lg` | `1.5rem` (24px) | Khoảng cách phân cách giữa các section lớn |
| `--radius-sm` | `8px` | Bo góc nút bấm, thẻ sự kiện (Event Chip), dropdown menu |
| `--radius-md` | `12px` | Bo góc modal phụ, danh thiếp thông tin |
| `--radius-lg` | `16px` | Bo góc Khung Card làm việc chính (`.week-cal`, `.task-list-card`) |
| `--radius-full` | `9999px` | Bo tròn Segmented Pill Switcher, Avatar, Nút FAB |

---

## 5. Quy Chuẩn Form & Modal Tạo Mới (Creation Experience)

Mọi thao tác tạo mới đối tượng (Nhiệm vụ, Khoản chi tiêu, Thẻ mật mã, Ghi chú) đều phải tuân thủ hợp đồng tương tác:
1.  **AutoFocus tức thì**: Con trỏ tự động kích hoạt vào ô nhập liệu chính (Tên task / Số tiền / Tiêu đề) ngay khi modal hiện lên.
2.  **Điền sẵn thông minh (Smart Context Prefill)**: Tự động nhận diện ngữ cảnh người dùng đang xem (Ví dụ click vào ô 9h sáng ngày 30/8 $\rightarrow$ form tự điền ngày 30/8 và giờ 09:00).
3.  **Phím tắt chuẩn hóa**:
    *   `Escape`: Đóng form ngay lập tức.
    *   `Ctrl + Enter` (hoặc `Cmd + Enter` trên macOS): Lưu và hoàn tất tức thì.
4.  **Hiệu ứng thị giác (Glassmorphism & Elevation)**:
    *   Backdrop mờ `backdrop-filter: blur(8px); background: rgba(0, 0, 0, 0.45);`.
    *   Đổ bóng đa lớp `box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);`.

---

## 6. Bảng Phối Màu Ngữ Nghĩa (Semantic Palette)

| Mục đích | Màu hiển thị (Hex / HSL) | Ý nghĩa |
| :--- | :--- | :--- |
| **Active / Focus** | `#1a73e8` (Google Blue) / `#8b5cf6` (Neon Purple) | Trạng thái đang chọn, ngày hôm nay, nút thao tác chính |
| **Overdue / Danger** | `#d93025` / `#ef4444` (Deep Red) | Quá hạn, cảnh báo xóa vĩnh viễn, số dư âm |
| **Done / Success** | `#188038` / `#00ff88` (Vibrant Green) | Đã hoàn thành, tăng trưởng, bảo mật an toàn |
| **Holiday / Official** | `#0b8043` (Forest Green) | Ngày lễ quốc gia chính thống |
| **Geek / Special / Fun** | `#7c3aed` / `#a78bfa` (Purple Tint) | Dịp kỷ niệm đặc biệt, Dev Day, sự kiện công nghệ |
| **Warning / Pending** | `#e37400` / `#f59e0b` (Amber Gold) | Sắp đến hạn, ưu tiên cao P4-P5, cảnh báo hạn mức |
