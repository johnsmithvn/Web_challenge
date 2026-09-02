# FEATURES.md — Life Hub

**Version:** v6.16.0 · **Updated:** 2026-09-02

Tài liệu này chỉ mô tả tính năng đang chạy. Feature đã xóa và chi tiết release nằm trong
[`CHANGELOG.md`](../CHANGELOG.md).

## Tổng quan truy cập

| Module | Route | Guest | Đăng nhập |
|---|---|:---:|:---:|
| Landing | `/` | ✅ | ✅ |
| Nhiệm vụ | `/tasks` | List in-memory | Full sync + Lịch 5 chế độ |
| Focus | `/focus` | In-memory | Sync session + XP |
| Inbox | `/inbox` | — | ✅ |
| Knowledge (PKM) | `/collect` | — | ✅ |
| Finance | `/finance/:screen?` | — | ✅ |
| Vault | `/accounts` | — | Login + Vault unlock |
| Cài đặt | `/settings` | — | ✅ |

## 1. App shell, Auth và Onboarding

**Files:** `src/App.jsx`, `src/contexts/AuthContext.jsx`, `src/components/AuthModal.jsx`,
`src/components/Navbar.jsx`, `src/components/OnboardingModal.jsx`

- Email/password và Google OAuth qua Supabase Auth.
- **Quên mật khẩu & Khôi phục tài khoản:** Hỗ trợ luồng gửi email khôi phục mật khẩu (OTP / reset password link) trực tiếp từ modal đăng nhập.
- Đăng nhập bằng username dùng RPC lookup email; kiểm tra username/email tồn tại cũng đi qua RPC.
- Navbar có sidebar desktop, topbar + bottom tabs mobile, user menu, XP bar và cảnh báo Finance.
- Landing là entry public; page khác lazy-load với `Suspense` và `ErrorBoundary`.
- Onboarding ba bước giải thích Inbox → phân loại → xử lý trong module phù hợp. Cờ đã xem nằm ở
  `vl_onboarded`; onboarding không phải route guard.
- Thiếu Supabase env sẽ tắt Auth thật. Task list và Focus vẫn dùng được in-memory; các module auth-only
  hiện cổng đăng nhập thay vì giả lập dữ liệu.

## 2. Nhiệm vụ (`/tasks`)

**Files:** `src/pages/TasksPage.jsx`, `src/components/TaskListSection.jsx`,
`src/components/TaskDetailModal.jsx`, `src/components/TaskCreateModal.jsx`,
`src/components/CalendarToolbar.jsx`, `src/components/CalendarWidgetPanel.jsx`,
`src/components/CalendarAgendaView.jsx`, `src/components/CalendarDayView.jsx`,
`src/components/WeekCalendar.jsx`, `src/components/MonthCalendar.jsx`,
`src/hooks/useUserTasks.js`, `src/hooks/useActivityLog.js`

### Danh sách
- Chia Task chưa xong thành Quá hạn, Hôm nay và Sắp tới; sắp theo ngày/giờ/priority.
- Tạo và sửa title, description, due date/time, priority, recurrence, tag và liên kết Knowledge.
- Hoàn thành dùng optimistic state; write lỗi rollback cả danh sách đang làm và khối đã hoàn thành.
- Khối Đã hoàn thành lọc theo khoảng ngày với preset; có thể bỏ hoàn thành hoặc xóa.
- Guest có Task in-memory và mất khi reload. Đăng nhập mới sync Supabase, activity log, tag/link và XP.

### Chế độ xem & Workspace Lịch
- **5 chế độ xem linh hoạt:**
  - `list` (Danh sách công việc): Chia việc theo Quá hạn, Hôm nay, Sắp tới; kèm thanh Mini Summary Bar (`Quá hạn | Hôm nay | Sắp tới`).
  - `agenda` (Lịch biểu): Dải ngày 45 ngày quanh ngày chọn, hiển thị cả ngày lễ và task theo timeline dọc.
  - `day` (Lịch Ngày): Lưới 24 giờ với trục thời gian thực (vạch đỏ), gom task cả ngày (All-day) và task có giờ.
  - `week` (Lịch Tuần): 7 cột ngày tương thích cả Chủ Nhật hoặc Thứ Hai khởi đầu, bố trí overlapping task thông minh.
  - `month` (Lịch Tháng): Hiển thị Task pending + completed, song song Dương lịch & Âm lịch Việt Nam, giới hạn chip thông minh và popup chi tiết ngày.
- **Header cố định (Workspace pattern):** `CalendarToolbar` cố định ở đỉnh trang (100dvh workspace, cuộn nội bộ), không bị giật/nhảy layout khi chuyển giữa danh sách và các chế độ lịch.
- **Modal tạo nhanh Task (`TaskCreateModal`):** Tự động kích hoạt khi click vào ô trống trong các chế độ lịch, tự động điền sẵn ngày và khung giờ click (Smart Context Prefill), phím tắt `Ctrl + Enter` lưu nhanh và `Escape` đóng.

### Cột tiện ích Lịch Việt & Sự kiện (`CalendarWidgetPanel`)
- **Lịch vạn niên & Can Chi:** Tra cứu ngày Dương lịch, Âm lịch, Can Chi Năm/Tháng/Ngày.
- **Giờ Hoàng Đạo:** 12 khung giờ hoàng đạo theo Chi của ngày, tự động highlight giờ tốt và định vị giờ hiện tại.
- **Đếm ngược sự kiện & Bật/Tắt danh mục:**
  - 🟢 Ngày lễ Việt Nam (`solar`).
  - 🟡 Ngày lễ Âm lịch (`lunar`).
  - 🌐 Ngày lễ Quốc tế LHQ & Thế giới (`international`) với hơn 55 ngày lễ chính thức.
  - 🔴 Ngày lễ Nhật Bản (`japan`).
  - 🟣 Lễ hội Coder & Dân Geek 👾 (`fun`).
  - 💖 Kỷ niệm của tôi (`custom`): Cho phép người dùng tự thêm ngày kỷ niệm (ngày cưới, hẹn hò, sinh nhật, ngày giỗ...) hỗ trợ cả Dương lịch và Âm lịch, tự động tính số năm đã trôi qua, lưu trữ an toàn trong `localStorage ('lh_custom_anniversaries')`.
- Các toggle bật/tắt lễ phản hồi tức thì và đồng bộ sang toàn bộ 5 chế độ xem lịch.

### Detail, lịch sử và XP
- Detail modal cho xem/sửa Task, activity field-diff và note cá nhân.
- `activity_logs` gắn `task_id`; xóa Task cascade lịch sử. Note sửa được, field-diff không sửa.
- Hoàn thành qua `completeTask` cộng `+10 XP` có dedup; bỏ hoàn thành xóa event tương ứng.
- “Quick Done” từ Inbox tạo thẳng một Task `completed=true`, rồi xóa Inbox item. Luồng này ghi
  `task_created`; nó không đi qua `completeTask`, nên không phát `task_completed` hoặc cộng `+10 XP`.

**Data:** `user_tasks`, `task_collections`, `task_tags`, `activity_logs`, `xp_logs`.

## 3. Focus và XP (`/focus`)

**Files:** `src/pages/FocusPage.jsx`, `src/components/FocusTimer.jsx`,
`src/hooks/useFocusTimer.js`, `src/hooks/useXpStore.js`

- Pomodoro focus/break, pause/resume/reset và tùy chỉnh thời lượng.
- Lưu session hoàn thành, thống kê phút hôm nay và danh sách session gần đây.
- Guest giữ session/XP trong memory; khi đăng nhập dùng `focus_sessions` và `xp_logs`.
- Session Focus hoàn thành cộng `+15 XP`, dedup theo session id.
- Setting timer nằm ở `vl_focus_settings`; không còn liên kết Habit/Journey.

## 4. Inbox (`/inbox`)

**Files:** `src/pages/InboxPage.jsx`, `src/hooks/useCollections.js`, `src/components/QuickCapture.jsx`

- Quick capture toàn app và form nhập nhanh trong Inbox.
- Search, chọn nhiều, snooze, archive/delete và mở detail để sửa nội dung.
- Phân loại item sang bảy loại Knowledge hiện hành.
- Số tiền dò từ ghi chú Inbox **không áp Auto-K**: "đổ xăng 5000" ra 5.000đ, không phải 5 triệu.
  Chữ chỉ độ lớn vẫn hiểu (`50k`, `2 triệu`). Form Nhập nhanh mở từ Inbox tắt Auto-K cho cả form
  và nói rõ điều đó dưới ô tiền.
- Chuyển thành Task pending hoặc completed; chuyển sang Finance transaction/hóa đơn bằng handoff một
  lần trong `sessionStorage`.
- Khi Finance ghi thành công, item Inbox nguồn được xóa. `inbox_item_id` vì vậy là provenance tạm;
  FK `ON DELETE SET NULL` không giữ link bền sau conversion.
- Trang yêu cầu đăng nhập; không có guest fallback cho `collections`.

**Data:** `collections`; handoff tạm: `lh_inbox_to_finance`.

## 5. Knowledge Base — PKM Athenaeum (`/collect`)

**Files:** `src/pages/CollectPage.jsx`, `src/components/kb/*`, `src/utils/kbDeriveUtils.js`,
`src/styles/kb-tokens.css`, `src/hooks/useCollections.js`, `src/hooks/useCollectionNotes.js`

Chi tiết kiến trúc và thiết kế: [`docs/MODULE_KNOWLEDGE.md`](MODULE_KNOWLEDGE.md).

### Tính năng Quản trị Tri thức PKM (Obsidian / Zettelkasten)
- **Liên kết 2 chiều (`[[Wiki-links]]`):** Trích dẫn bài viết khác trong nội dung bằng cú pháp `[[Tên bài viết]]`. Hệ thống tự động phân tích và tạo siêu liên kết điều hướng mượt mà giữa các bài viết.
- **Biểu đồ tri thức tương tác (`KbGraphView`):** Canvas tương tác mô phỏng mạng lưới các bài viết (nodes) và liên kết liên trang (edges). Hỗ trợ zoom, pan, hover xem tên bài và click để mở bài viết.
- **Bảng Backlinks ngữ cảnh (`KbBacklinks`):** Tự động phát hiện và trích đoạn câu chứa liên kết từ tất cả các bài viết khác đang trỏ tới bài hiện tại.
- **Chế độ đọc tập trung (`KbReader`):** Giao diện đọc tĩnh tinh tế, tự động trích xuất Mục lục (TOC / Headings navigation), hiển thị ước tính thời gian đọc (read time) và khối Backlinks cuối trang.
- **Trình soạn thảo kép (Dual-mode Editor):**
  - **Split Markdown Editor (`KbSplitEditor`):** Soạn thảo Markdown với đồng bộ cuộn thời gian thực (sync scroll) và khung xem trước (live preview).
  - **Visual Editor (`KbVisualEditor`):** Soạn thảo trực quan phong phú dựa trên Tiptap Rich Text.
- **Bảng Thống kê tri thức (`KbStats`):** Thống kê định lượng toàn bộ kho kiến thức: tổng số bài, tổng số từ, liên kết nội bộ, thời gian đọc trung bình.
- **Phím tắt nhanh (`KbShortcutsModal`):** Hỗ trợ tra cứu nhanh toàn bộ phím tắt thao tác.
- **Phân loại & Lọc chuyên sâu:** 7 danh mục (Ghi chú, Trích dẫn, Học tập, Ý tưởng, AI, Giải trí, Podcast), lọc theo tag, tìm kiếm tức thì theo từ khóa.
- **Media & Attachment:** Hỗ trợ chèn ảnh, YouTube, Audio player inline; tải tệp lên Google Drive qua `api/upload.js`.

**Data:** `collections`, `collection_notes`, `collection_tags`, `task_collections`.

## 6. Tags và Cài đặt (`/settings`)

**Files:** `src/pages/SettingsPage.jsx`, `src/hooks/useTags.js`

- Hai tab: **Chung** (tiền tệ + tag) và **Hồ sơ**.
- Cấu hình tiền tệ: tỷ giá USD và Auto-K.
- Auto-K chỉ áp cho ô **nhập mới**. Form **sửa** (Sửa giao dịch, sửa hóa đơn/thu định kỳ/vay/thẻ/cho
  vay, hạn mức đã đặt) hiển thị số ĐÃ LƯU nên không áp Auto-K: số trong ô là số sẽ lưu. Chữ chỉ độ lớn (`50k`, `2 triệu`, `10$`) vẫn hiểu ở những ô nhận chữ.
- Tag manager: tạo, đổi tên/màu, xem usage breakdown và xóa link có xác nhận.
- Tag plaintext dùng cho Knowledge, Task và Finance transaction qua ba junction riêng để giữ FK.
- Vault tag là ngoại lệ: nằm trong ciphertext và chỉ có sau unlock.
- Profile: avatar, username, display name và email.

**Data:** `tags`, `collection_tags`, `task_tags`, `finance_transaction_tags`, `profiles`.

## 7. Finance (`/finance`)

**Files:** `src/pages/FinancePage.jsx`, `src/components/finance/*`, `src/hooks/useFinance.js`,
`src/utils/financeLogic.js`, `src/data/finance-categories.json`

### Điều hướng & Bố cục
- `overview`: Tổng quan (dashboard thu chi, nhịp chi) và query `view=stats` mở Thống kê.
- `add`: Nhập nhanh bằng form, câu tự nhiên hoặc shortcut.
- `list`: Danh sách giao dịch với thanh Toolbar hợp nhất (`.fin-list__toolbar`), ô tìm kiếm ghim trên Header, bộ lọc đa cấp `FilterPop` (nhóm cha, danh mục con, khoảng ngày), xuất CSV.
- `recurring`: **Định kỳ & Quỹ** (hóa đơn, thu định kỳ, khoản vay, thẻ tín dụng, cho vay và Quỹ tiết kiệm).
- `cats`: Taxonomy chi (10 nhóm chuẩn) / thu và override label/màu/icon/subcategory.

### Hành vi chính
- **Mức độ thiết yếu 2 cấp (2-tier necessity):** Phân loại chi tiêu thành **Thiết yếu** (`need`) và **Linh hoạt / Mong muốn** (`want`).
- **Ghi chú nhiều dòng (`description`):** Cột `description TEXT` cho phép ghi chú tự do nhiều dòng, tách rời tiêu đề ngắn `note`.
- **Drawer Sửa giao dịch 560px:** Mở rộng mượt mà khi chỉnh sửa giao dịch, hỗ trợ nhập *Nơi / người nhận* (`merchant`) và bảng *Chi tiết từng món* (`items`: tên món, số lượng, đơn giá, tự động tính tổng). Phím tắt `Ctrl + Enter` lưu nhanh, `Escape` đóng.
- Hóa đơn fixed/ask, skip period, kỳ trả; thu định kỳ; khoản vay và thẻ tín dụng.
- Cho vay hiện lãi đơn theo ngày trên gốc còn lại, hỗ trợ tính lãi mất do rút tiết kiệm sớm (`forfeited_interest`).
- Quỹ tiết kiệm: Quản lý nhiều nơi gửi/sổ ngân hàng, lãi suất bình quân, đáo hạn, lock soft/term/external và yêu cầu rút term chờ 48 giờ.

**Data:** 10 bảng `finance_*` chính + `finance_transaction_tags`. Schema chi tiết ở
[`DATABASE.md`](DATABASE.md), hợp đồng sản phẩm ở [`DESIGN_FINANCE.md`](DESIGN_FINANCE.md).

## 8. Account Vault (`/accounts`)

**Files:** `src/pages/AccountsPage.jsx`, `src/components/AccountDetail.jsx`,
`src/components/AccountAvatar.jsx`, `src/hooks/useAccounts.js`, `src/utils/vaultCrypto.js`,
`src/utils/vaultLogic.js`, `src/data/account-templates.json`

### Mã hóa và khóa
- Mỗi item là một JSON AES-256-GCM gồm title, template, favorite, note, tag, field, auth method,
  recovery code, link và history.
- Passphrase Vault riêng, tối thiểu 12 ký tự. PBKDF2-SHA256 600.000 vòng tạo KEK; KEK mở DEK ngẫu
  nhiên của user. Server chỉ giữ KDF metadata và DEK đã wrap.
- DEK chỉ ở memory. Lock, sign-out, đổi user hoặc reload xóa key/plaintext khỏi React state.
- **Đổi Mật khẩu chính (Change Passphrase):** Cho phép đổi Master Passphrase ngay trong Két mật mã bằng cách giải mã DEK bằng KEK cũ, sinh KEK mới từ mật khẩu mới và salt mới, re-wrap DEK và cập nhật `vault_config` mà không cần re-encrypt toàn bộ item.
- **Khóa khôi phục khẩn cấp (Emergency Recovery Key):** Hỗ trợ tạo khóa khôi phục 24 từ / base64 ngẫu nhiên để mở DEK và khôi phục quyền truy cập khi quên Master Passphrase.
- **Sao lưu & Phục hồi:**
  - **Ciphertext Backup / Restore:** Xuất và phục hồi file JSON mã hóa (an toàn, có thể chạy khi Vault đang khóa).
  - **Plaintext JSON Export:** Xuất toàn bộ dữ liệu ra file JSON rõ nghĩa sau khi xác thực lại Master Passphrase thành công.
- Update/delete dùng `updated_at` làm revision để chặn ghi đè giữa tab/device.
- Logo item do user tự chọn, vẽ qua canvas thành PNG 48×48 lưu trong encrypted payload; không gọi mạng bên ngoài.

**Data:** `accounts` ciphertext + `vault_config`. Không có guest mode.

## 9. Media, widget và PWA

- `api/upload.js`: authenticated multipart upload vào Google Drive folder đã cấu hình.
- `api/stream.js`: folder-scoped readonly proxy, hỗ trợ HTTP Range/seek cho media.
- `GlobalAudioPlayer`: tiếp tục phát khi đổi page; `CustomAudioPlayer` dùng cho audio inline.
- `SubAlert`: sidebar cảnh báo hóa đơn/thẻ tới hạn; tự ẩn khi không có data hoặc chưa login.
- `QuoteWidget`: quote theo ngày + shuffle + audio khi có URL.
- Manifest + service worker cung cấp install metadata/cache cơ bản và Task notification best-effort.

## Routes cũ

| Route | Hành vi hiện tại |
|---|---|
| `/incubator` | Redirect `/tasks` (module Ươm mầm đã gỡ bỏ hoàn toàn) |
| `/tracker` | Redirect `/tasks` |
| `/habits` | Redirect `/tasks` |
| `/dashboard` | Redirect `/tasks` |
| `/journey` | Redirect `/tasks` |

Habit, Journey, Dashboard, Quiz, Leaderboard, Life Log, Team/Friends, Incubator và Finance legacy không còn là
feature hiện hành. Muốn xem lý do/thời điểm xóa, đọc `CHANGELOG.md`.
