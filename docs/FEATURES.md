# FEATURES.md — Life Hub

**Version:** v6.22.0 · **Updated:** 2026-10-08

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
| Body | `/body` | — | ✅ |
| Vault | `/accounts` | — | Login + Vault unlock |
| Cài đặt | `/settings` | — | ✅ |

## 1. App shell, Auth và Onboarding

**Files:** `src/App.jsx`, `src/contexts/AuthContext.jsx`, `src/components/AuthModal.jsx`,
`src/components/Navbar.jsx`

- Email/password và Google OAuth qua Supabase Auth.
- **Quên mật khẩu & Khôi phục tài khoản:** Hỗ trợ luồng gửi email khôi phục mật khẩu (OTP / reset password link) trực tiếp từ modal đăng nhập.
- Đăng nhập bằng username dùng RPC lookup email; kiểm tra username/email tồn tại cũng đi qua RPC.
- Navbar có sidebar desktop, topbar + bottom tabs mobile, user menu, XP bar và cảnh báo Finance.
- Landing là entry public; page khác lazy-load với `Suspense` và `ErrorBoundary`.
- Onboarding ba bước giải thích Inbox → phân loại → xử lý trong module phù hợp. Cờ đã xem nằm ở
  `vl_onboarded`; onboarding không phải route guard.
- Thiếu Supabase env sẽ tắt Auth thật. Task list và Focus vẫn dùng được in-memory; các module auth-only
  hiện cổng đăng nhập thay vì giả lập dữ liệu.

### Trang chủ khi đã đăng nhập (`HomeDashboard`, `dashboardAlerts.js`)

- **Cần xử lý ngay:** khoản tài chính quá hạn/đến hạn hôm nay (hóa đơn, sao kê thẻ kể cả nợ kỳ cũ, kỳ vay,
  tất toán gốc, cho vay quá hẹn, sổ tiết kiệm đã đáo hạn) + nhiệm vụ quá hạn. Task đến hạn hôm nay chỉ nằm
  ở card "Nhiệm vụ hôm nay", không lặp lại. Bấm cảnh báo tài chính mở đúng tab con của màn Định kỳ; "Bỏ kỳ"
  hỏi xác nhận trước.
- Chưa tải xong hoặc Finance lỗi thì **không** báo "mọi thứ đúng hạn": hiện trạng thái đang tải, hoặc banner
  lỗi kèm nút Tải lại.
- **Sắp tới hạn:** task/hóa đơn/vay/cho vay còn 1–3 ngày, sao kê và phí thường niên ≤5 ngày, sổ đáo hạn
  ≤14 ngày; bấm được, có số tiền, quá 5 mục thì "Xem thêm". Vượt ngân sách theo danh mục hiện ở widget ngân
  sách (tên danh mục thật), % đã dùng hiện số thật kể cả khi >100%.
- Lời chào, ngày (kèm âm lịch và năm can chi) và lịch tập tự sang ngày mới khi tab mở qua đêm. Buổi tập dở
  chỉ tính trong ngày.
- Khoản có số tiền biết trước (hóa đơn cố định, sao kê thẻ, kỳ vay) có nút **"Đã trả"** ngay trong khối gấp:
  hỏi xác nhận rồi ghi hôm nay, không gắn thẻ nguồn; muốn đổi ngày/số tiền/thẻ thì mở màn Định kỳ.
- **Nhiệm vụ hôm nay:** việc đã xong trong ngày vẫn hiện (gạch ngang, `x/y xong`) và bỏ tick được. Trống thì
  gợi ý tối đa 3 việc có hạn trong 7 ngày tới (hạn gần trước, cùng hạn ưu tiên cao trước) với nút "+ Hôm nay"
  và "Thêm cả N"; thanh tiến độ ẩn khi trống.
- Khối "Cần xử lý ngay" chỉ hiện cột còn mục; cột đã hết thành nhãn xanh ở góc tiêu đề.
- **Dự kiến cuối tháng** = chi cố định đã trả + chi cố định còn đến hạn trong tháng + chi biến đổi ÷ số ngày đã
  qua × số ngày của tháng. Chi cố định = giao dịch `is_fixed` (hóa đơn, lãi vay ghi qua Định kỳ tự đánh dấu);
  khoản cố định nhập tay không đánh dấu vẫn bị coi là biến đổi.
- **Bức tranh nhịp sống** (`dashboardMetrics.js`, chỉ dữ liệu thật — thiếu thì hiện "—"/trạng thái trống):
  biểu đồ chi cộng dồn tháng (bậc thang) so với đường cộng dồn tháng trước + dự kiến cuối tháng, 4 nhóm chi
  nhiều nhất kèm % trong tổng và so cùng kỳ tháng trước (không có hạn mức — module Ngân sách đã gỡ 01/09/2026);
  lịch thanh toán tháng (hóa đơn tới kỳ, sao kê thẻ, kỳ vay, phí thường niên — đã trả/quá hạn/hôm nay/sắp tới
  đọc từ giao dịch); 5 ô module: việc xong 14 ngày + % đúng hạn, chi TB/ngày so tháng trước, cân nặng tới mục
  tiêu, số ghi chú + mới tuần này. Vault mã hóa nên chỉ hiện trạng thái, không đọc số mục khi chưa mở khóa.
- Card Body: trạng thái buổi tập (đang dở có tiến độ set thật / xong / có lịch / nghỉ kèm buổi tới / chưa có
  lộ trình), nhóm cơ Cần nghỉ/Đang hồi/Sẵn sàng theo set đã tập, thanh tuần T2→CN (đã tập/bỏ lỡ/sắp tới).

## 2. Nhiệm vụ (`/tasks`)

**Files:** `src/pages/TasksPage.jsx`, `src/components/TaskListSection.jsx`,
`src/components/TaskDetailModal.jsx`, `src/components/TaskDetailDrawer.jsx`,
`src/components/CalendarToolbar.jsx`, `src/components/CalendarWidgetPanel.jsx`,
`src/components/CalendarAgendaView.jsx`, `src/components/CalendarDayView.jsx`,
`src/components/WeekCalendar.jsx`, `src/components/MonthCalendar.jsx`,
`src/hooks/useUserTasks.js`, `src/hooks/useActivityLog.js`

### Subtask (v6.20.0)
- Subtask là **task đầy đủ chi tiết** (`user_tasks.parent_task_id`): mô tả, Bắt đầu, Hạn, ưu tiên, tag, ghi
  chú, lịch sử — nhưng **chỉ sống bên trong task cha**: không hiện ở Kanban, Danh sách, Lịch, số đếm hay bộ chọn
  task của Finance/Knowledge. Thay checklist JSONB `subtasks` của v6.18.0 (cột cũ không còn dùng).
- **Mặt trước** (thẻ Kanban, hàng Danh sách): badge `☑ 2/4`; mở ra tick trực tiếp, bấm tên → popup Chi tiết
  của subtask.
- **Đang làm (v6.30.0):** nút ▶ trên hàng việc con (thẻ Kanban/Danh sách, ngăn chi tiết) chuyển việc đó sang
  "Đang làm" (không cần đặt giờ; ⏸ = dừng, về Chưa làm). Mỗi task cha chỉ 1 việc con đang làm; task cha còn "Cần làm"
  thì tự sang "Đang làm". Hàng đang làm nổi màu vàng + lên đầu; mặt thẻ (kể cả khi thu gọn) có dòng "● Đang làm: …".
- **Nhắc hạn (v6.30.0):** việc con có giờ hạn hoặc hạn khác task cha hiện chip giờ: quá hạn / trễ giờ đỏ, còn ≤ 60
  phút vàng đậm "còn 25p" (icon nhấp nháy), hôm nay vàng, sắp tới xanh. Việc con cùng hạn task cha, không giờ → không chip.
- **Thứ tự (v6.29.0, v6.30.0):** việc con đang làm lên đầu, **đã xong / bỏ qua tự xuống cuối**; trong mỗi nhóm ưu
  tiên cao trước (Khẩn → Không), cùng mức thì theo kéo thả — áp mọi nơi hiện subtask
  (thẻ Kanban/Danh sách, ngăn chi tiết, popup Chi tiết, hộp việc con ‹ ›, khối giờ tab Ngày). **Kéo thả** bằng tay
  nắm `⠿` trên thẻ Kanban/Danh sách và ngăn chi tiết (chuột + cảm ứng; bàn phím Alt + ↑/↓) chỉ đổi chỗ trong cùng
  nhóm trạng thái + mức ưu tiên: kéo vượt nhóm thì dừng ở đầu/cuối nhóm, vạch thả hiện đúng chỗ sẽ rơi. Muốn đổi nhóm → đổi ưu tiên
  bằng **nút ưu tiên trên từng hàng** (icon màu; chưa đặt thì icon mờ hiện khi rê chuột, cảm ứng luôn hiện mờ).
- **Popup Chi tiết** task cha và form **sửa**: khu Subtask — tick, bấm tên để mở, **kéo thả sắp xếp** (bàn phím:
  Alt + ↑/↓ trên tay nắm), xoá (có xác nhận), Enter ở ô cuối để thêm (hạn = hạn task cha). Mọi thao tác lưu ngay.
- Form **tạo** task: thêm subtask nháp (Enter thêm tiếp), tạo cùng task cha khi bấm Lưu.
- Popup của subtask có chip **↳ Task cha** để quay về. Chỉ 1 cấp (subtask không có subtask).
- Subtask đặt giờ Bắt đầu/Hạn **vẫn được nhắc giờ**. Hoàn thành subtask **không** cộng XP; tick hết không tự hoàn
  thành task cha.
- Xoá task cha → **xoá luôn subtask**. Task cha lặp → kỳ sau mang theo subtask (chưa xong, hạn dời theo, không
  mang chuỗi lặp riêng của subtask).

### Thời gian của task (v6.21.0)
- Form có 1 dòng **Thời gian** mở popover chọn cả 2 mốc: ô Bắt đầu / ô Hạn (ô đang chọn nhận lần bấm lịch, mặc
  định Hạn; đặt Bắt đầu xong tự sang Hạn), lịch tô khoảng giữa, giờ ẩn sau nút **Thêm giờ**.
- 2 mốc, **đều tuỳ chọn** (ngày và giờ trong mỗi mốc cũng tuỳ chọn): **Bắt đầu** (`start_date` + `start_time`) và
  **Hạn** (`due_date` + `due_time`). Không có "kết thúc" riêng — kết thúc = Hạn (khung 9–10h = Bắt đầu 9:00, Hạn
  10:00). Bắt đầu phải trước Hạn; task lặp bắt buộc có Hạn. Không giờ = để trống (không còn "23:59 = Hết ngày").
- Task mới **mặc định không ngày** (form Danh sách, nút thêm Kanban, QuickCapture); tạo từ Lịch thì điền sẵn ngày,
  bấm ô giờ trống trên lưới Ngày/Tuần → Bắt đầu = ô đó, Hạn +1 giờ (kiểu Google Calendar).
- **Lúc bắt đầu làm thật** (`started_at`) do app tự ghi khi task sang Doing **lần đầu** (kéo thẻ, nút nhanh, popup,
  hoặc tạo thẳng vào cột Doing) — không đè Bắt đầu kế hoạch, không theo sang kỳ lặp sau. Thẻ Doing hiện
  `▶ từ 14:05`; popup Chi tiết hiện "Bắt đầu làm" và "mất 2h25p" khi xong.
- Thông báo (PWA service worker, best-effort, cho task chưa xong): "⏱ Đến giờ làm" lúc Bắt đầu (bỏ qua nếu task đã
  ở Doing, không nhắc muộn sau giờ Hạn cùng ngày) và "📌 Nhiệm Vụ Đến Hạn" lúc Hạn — chỉ khi mốc có giờ; mỗi nhắc
  1 lần/ngày.

### Danh sách
- Task **Bỏ qua** (cột Skip của Kanban, `status = 'skip'`) không còn là việc cần làm: không vào Quá hạn/Hôm nay/
  Sắp tới, không đếm, không hiện trên Lịch, không nhắc giờ. Kéo về To Do/Doing để làm lại.
  Bỏ qua một task **lặp lại** = bỏ qua kỳ này: kỳ sau vẫn được sinh (không cộng XP), chuỗi lặp không bị đứt.
- Chia Task chưa xong thành Quá hạn, Hôm nay, Sắp tới và **Không hạn**; sắp theo ngày/giờ/priority.
- Tạo và sửa title, description, Bắt đầu, Hạn, priority, recurrence, tag và liên kết Knowledge.
  Một form dùng chung (`TaskForm`) cho form thêm, sửa tại hàng, popup Chi tiết và modal tạo từ Lịch/Kanban;
  Enter ở ô tiêu đề hoặc `Ctrl + Enter` để lưu.
- Hoàn thành dùng optimistic state; write lỗi rollback cả danh sách đang làm và khối đã hoàn thành.
- Khối Đã hoàn thành lọc theo khoảng ngày với preset; có thể bỏ hoàn thành hoặc xóa.
- Guest có Task in-memory và mất khi reload. Đăng nhập mới sync Supabase, activity log, tag/link và XP.

### Chế độ xem & Workspace Lịch
- **6 chế độ xem** (mặc định `kanban`, nhớ lựa chọn trong `lh_tasks_active_view`):
  - `kanban` (Bảng Kanban): 4 cột To Do · Doing · Done · Skip, kéo thả hoặc nút chuyển cột trên mobile, thu gọn
    cột, bộ lọc thời gian (Tất cả / Hôm nay / 7 ngày / Tuỳ chọn — To Do/Doing/Skip lọc theo ngày hạn, Done theo
    ngày hoàn thành; task không hạn chỉ hiện ở Tất cả, xếp cuối cột), double-click cột hoặc nút "Thêm việc" để
    tạo nhanh (không ngày). Bấm thẻ → ngăn chi tiết **nổi đè** lên bảng (không đẩy các cột co lại; mobile là sheet
    dưới có phủ mờ). Chỉ khi đăng nhập.
  - `list` (Danh sách công việc): Chia việc theo Quá hạn, Hôm nay, Sắp tới; kèm thanh Mini Summary Bar (`Quá hạn | Hôm nay | Sắp tới`).
  - `agenda` (Lịch biểu): Dải ngày 45 ngày quanh ngày chọn, hiển thị cả ngày lễ và task theo timeline dọc.
  - `day` (Lịch Ngày): Lưới 24 giờ với trục thời gian thực (vạch đỏ), gom task cả ngày (All-day) và task có giờ.
    Khối dài (≥ ~1g45) dồn nội dung lên đầu và hiện **việc con** (tick được, bấm tên mở hộp việc con) vừa đủ chiều
    cao khối, thiếu chỗ thì "+N việc con"; dòng trạng thái có tiến độ `☑ 2/4`. Khung "Chưa xếp giờ" (xem hôm nay)
    tách nhóm **Quá hạn** riêng — việc hạn từ hôm trước (kể cả có giờ, ghi "Hôm qua, 15:00"); kéo vào lưới = dời sang hôm nay.
    Thả việc có giờ vào "Cả ngày" / "Chưa xếp giờ" = bỏ giờ, có toast **Hoàn tác**; thả lại đúng chỗ cũ thì không đổi gì.
    Mọi giờ hợp lệ (kể cả 00:00, 23:59) là giờ thật; chỉ giờ trống mới là "không giờ".
  - `week` (Lịch Tuần): 7 cột ngày tương thích cả Chủ Nhật hoặc Thứ Hai khởi đầu, bố trí overlapping task thông minh.
  - `month` (Lịch Tháng): Hiển thị Task pending + completed, song song Dương lịch & Âm lịch Việt Nam, giới hạn chip thông minh và popup chi tiết ngày.
- **Task đã xong trên Lịch** nằm ở ngày kế hoạch (Bắt đầu→Hạn), gạch/đánh dấu ✓ — không nhảy sang ngày bấm
  hoàn thành. Thời điểm hoàn thành (`completed_at`) là lịch sử: xem ở khối "Đã xong" của Danh sách và Kanban.
- Task hiện trên lịch ở **mọi ngày từ Bắt đầu đến Hạn** (chỉ 1 mốc → đúng ngày đó; không ngày → không lên lịch).
  Lưới Ngày/Tuần: Bắt đầu + Hạn cùng ngày, cả hai có giờ → khối thật Bắt đầu→Hạn; ngày Hạn có giờ → mốc ngắn `⏰`;
  ngày Bắt đầu có giờ → mốc ngắn `▶` (không vẽ khối tới nửa đêm); ngày giữa của task nhiều ngày hoặc không giờ →
  hàng "Cả ngày". Chip Cả ngày / Lịch Tháng của task nhiều ngày có `▶` (ngày đầu), `↔` (ngày giữa), `⏰` (ngày Hạn);
  Lịch biểu hiện `▶ 09:00`, `⏰ 17:00` hoặc "↔ Nhiều ngày".
- **Header cố định (Workspace pattern):** `CalendarToolbar` cố định ở đỉnh trang (100dvh workspace, cuộn nội bộ), không bị giật/nhảy layout khi chuyển giữa danh sách và các chế độ lịch.
- **Tạo việc đầy đủ = ngăn chi tiết ở chế độ tạo mới (`TaskDetailDrawer` prop `draft`):** mở từ nút "+ Việc mới"
  trên header desktop, nút "Chi tiết" ở ô thêm nhanh đầu cột Kanban và ở sheet "Việc mới". Chữ đã gõ ("mai 9h !cao
  #UI") điền sẵn tên/hạn/giờ/ưu tiên/nhãn, cột đang thêm thành trạng thái. Đầu ngăn "VIỆC MỚI · <cột>", ẩn Thực tế và
  tab Hoạt động/Ghi chú; sửa trên bản nháp cục bộ, chỉ ghi DB khi bấm "Tạo việc" (`Ctrl/⌘ + Enter`; mờ khi chưa có
  tên). X / Huỷ / `Escape` bỏ bản nháp. Tên trống thì ô tên tự focus.

- **Đổi ngày giờ** (nhãn hạn trên thẻ, ngăn chi tiết, bấm giờ của việc ở Lịch biểu): ô Bắt đầu + Kết thúc (tuỳ
  chọn), lịch có ngày âm; ô đang chọn nhận lần bấm (không tự nhảy ô); ✕ "Bỏ hạn" xoá hết, ✕ "Bỏ ngày kết thúc" chỉ
  bỏ ngày cuối; "Thêm giờ" mở dòng giờ bắt đầu → kết thúc (1 ngày có cả 2 giờ = khối giờ cùng ngày). Lưu mờ khi
  chưa đổi. Lọc khoảng ngày: 4 khoảng nhanh + "Bấm ngày đầu, rồi ngày cuối".
- Phụ đề hàng điều hướng: Tuần "Bính Ngọ · N việc có giờ, M cả ngày", Tháng "Bính Ngọ · N việc có hạn".

### Bảng Lịch & sự kiện (`CalendarWidgetPanel`)
Desktop nổi bên phải, mobile là sheet; mở bằng nút "Lịch & sự kiện" / bấm ngày ở đầu trang mobile.
- **Tab Lịch vạn niên:** Dương lịch | Âm lịch hôm nay (số lớn, thứ, tháng, pha trăng) + chip Năm/Tháng/Ngày can chi
  và **tiết khí** (`getSolarTerm`); "Hôm nay có" (sự kiện hôm nay) + lối tắt "N việc đến hạn hôm nay →" (mở xem Ngày);
  **giờ hoàng đạo** 12 ô (vàng = giờ tốt, viền = giờ hiện tại) + "Bây giờ: giờ …" / "Giờ tốt kế tiếp: …, còn …";
  **lịch tháng nhỏ** (ngày âm, chấm sự kiện + chấm việc đến hạn; bấm ngày → xem Ngày); **Lịch hiển thị trên bảng**:
  bật/tắt Ngày lễ Việt Nam (`solar`), Âm lịch (`lunar`), Quốc tế (`international`), Nhật Bản (`japan`), Kỷ niệm
  (`custom`), Geek (`fun`) — đồng bộ sang mọi chế độ xem lịch (`lh_cal_holiday_toggles`).
- **Ngày kỷ niệm riêng:** nút + ở dòng Kỷ niệm mở form (tên, Dương/Âm lịch, ngày, tháng, năm tuỳ chọn, biểu tượng);
  tự tính số năm; lưu `localStorage` `lh_custom_anniversaries`; xoá ở tab Sự kiện.
- **Tab Sự kiện · N:** lọc theo lịch (có số đếm), nhóm Hôm nay / 7 ngày tới / Sau đó (90 ngày tới), mỗi sự kiện có
  ngày dương + âm, đếm ngược (≤ 3 ngày tô đỏ), nút "Tạo việc" / "Đã thêm".

### Nền trang & hiệu ứng (kiểu Mặc định / Rừng tiên)
- Nền theo giờ và theme: Mặc định = trời đêm (aurora, Ngân Hà, trăng đúng pha âm lịch có chú Cuội, chòm sao, đom
  đóm) / bình minh–hoàng hôn; Rừng tiên = rừng ngày (cây, suối, nắng, sương mù) / rừng đêm. Tắt hết khi máy bật giảm
  chuyển động.
- Hình bay ngẫu nhiên qua trời (máy bay, UFO, Hằng Nga… / hươu, rồng, hồ ly, phù thuỷ…) + ban đêm có hiệu ứng thiên
  nhiên chung: sao ước nguyện (bấm trúng → thẻ điều ước), Thợ Săn, cầu vồng trăng, Ngân Hà, hồ, sương, lá
  bạc, bồ công anh, rêu; thỉnh thoảng nguyệt thực.
- Nút "Ngắm cảnh" / "Ngắm rừng": ẩn giao diện để xem nền.
- Rừng tiên: bấm nấm → "boing!", bấm đom đóm → bay theo chuột, bấm nền → rung cây; sương tan quanh con trỏ; thẻ trễ
  có dây leo, xong có hoa, đang làm có đom đóm; xong việc → tiên bay lên, xong hết việc hôm nay → trái tim đom đóm;
  cây chuỗi ngày góc trái dưới (desktop).

### Detail, lịch sử và XP
- Detail modal cho xem/sửa Task, activity field-diff và note cá nhân. Khu Hoạt động & Ghi chú **thu gọn mặc
  định** (hiện số dòng), bấm để mở.
- `activity_logs` gắn `task_id`; xóa Task cascade lịch sử. Note sửa được, field-diff không sửa.
- Hoàn thành qua `completeTask` cộng `+10 XP` có dedup (trừ subtask); bỏ hoàn thành xóa event tương ứng.
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
- Số tiền dò từ ghi chú Inbox lấy đúng số đã viết: "đổ xăng 5000" ra 5.000đ. Chữ chỉ độ lớn vẫn
  hiểu (`50k`, `2 triệu`).
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

- Hai tab: **Chung** (giao diện trang Nhiệm vụ + tag) và **Hồ sơ**.
- Ô tiền lưu đúng số gõ; chỉ nhân khi có chữ chỉ độ lớn (`50k`, `2 triệu`, `3tr`, `1 củ`).
  Auto-K và tỷ giá USD đã bỏ 2026-10-11 (key localStorage cũ `lh_auto_k`, `lh_usd_rate` không còn đọc).
- Tag manager: tạo, đổi tên/màu, xem usage breakdown và xóa link có xác nhận.
- Tag plaintext dùng cho Knowledge, Task và Finance transaction qua ba junction riêng để giữ FK.
- Vault tag là ngoại lệ: nằm trong ciphertext và chỉ có sau unlock.
- Profile: avatar, username, display name và email.

**Data:** `tags`, `collection_tags`, `task_tags`, `finance_transaction_tags`, `profiles`.

## 7. Finance (`/finance`)

**Files:** `src/pages/FinancePage.jsx`, `src/components/finance/*`, `src/hooks/useFinance.js`,
`src/utils/financeLogic.js`, `src/data/finance-categories.json`

### Điều hướng & Bố cục
- `overview`: Tổng quan + Báo cáo gộp một trang, dùng chung bộ chọn kỳ Tháng/Quý/Năm (cảnh báo, chỉ số, nhịp chi, khoản lớn nhất, quỹ tiết kiệm, rồi các thẻ Báo cáo). `/finance/report` và `?view=stats` chuyển về đây.
- `add`: Nhập nhanh **khoản chi** bằng form, câu tự nhiên hoặc shortcut (gửi/rút quỹ nằm ở `recurring`). Finance chỉ
  theo dõi chi: không có chỗ ghi thu nhập tay; khoản thu chỉ còn lãi cho vay và giao dịch thu cũ.
- `list`: Danh sách giao dịch với thanh Toolbar hợp nhất (`.fin-list__toolbar`), ô tìm kiếm ghim trên Header, bộ lọc đa cấp `FilterPop` (nhóm cha, danh mục con, khoảng ngày), xuất CSV.
- `recurring`: **Định kỳ & Quỹ** (hóa đơn, khoản vay, thẻ tín dụng, cho vay và Quỹ tiết kiệm). Giao diện Hub hợp nhất (v6.23) với:
  - Bố cục 2 cột trên Desktop (Timeline danh sách + Panel chi tiết) và Bottom Sheet trượt trên Mobile.
  - 6 ô KPI kiêm bộ lọc: Tất cả / Hóa đơn = còn phải chi tháng này + số kỳ đã xong; Thẻ = sao kê cần trả + % hạn mức đã dùng; Khoản vay = dư nợ gốc + tiến độ kỳ; Quỹ = đang gửi + % mục tiêu; Cho vay = còn phải thu + đã thu.
  - Dải lịch mini trực quan 28–31 ngày hiển thị phân bổ hạn trả trong tháng và ngày hôm nay.
  - Nhóm theo timeline (`Quá hạn` — gồm kỳ lỡ từ tháng trước, `Tuần này`, `Tuần sau`, `Cuối tháng`, `Không có kỳ trong tháng` — gồm hạn rơi sang tháng sau) và nhóm `Đã xong` dạng thu gọn.
  - Mục lưu trữ thu gọn: hóa đơn đang tắt / đã kết thúc, khoản vay đã tất toán, cho vay đã thu xong, sổ đã tất toán — vẫn mở được để sửa, bật lại / mở lại, xem lịch sử, xóa.
  - Panel chi tiết: thanh toán / bỏ kỳ / bỏ đánh dấu (chỉ cho kỳ đã bỏ — hủy một lần trả làm ở màn Giao dịch), khối tiến độ, biểu đồ 6 kỳ gần nhất (hóa đơn, khoản vay, quỹ) kèm trung bình.
  - Quỹ không còn màn riêng: bấm dòng quỹ để xổ các sổ con (ngày đáo hạn, lãi suất, phần kỳ hạn đã trôi). Panel quỹ: Góp tiền / Rút ra (khóa kỳ hạn → yêu cầu chờ 48 giờ), Thêm sổ, Xóa quỹ, lãi khi đáo hạn, lãi bình quân, sổ gần đáo hạn, phân bổ ngân hàng. Panel sổ: Xử lý đáo hạn, Sửa / Xóa sổ (hộp thoại), Mở lại sổ đã tất toán. Lọc Quỹ hiện dải tổng mọi sổ (đang gửi, lãi khi đến hạn, lãi bình quân, để dành tháng này, phân bổ). Cảnh báo sổ đáo hạn ở trang chủ chọn sẵn sổ đó.
  - Thêm / Sửa nguồn chi trong một hộp thoại chung; quỹ tiết kiệm tạo/sửa tại đây gồm cả khóa khi rút (mềm / kỳ hạn + ngày mở / ngoài app) và "tiền còn ở tài khoản thường".
  - Chưa có đổi tháng: mọi kỳ tính theo hôm nay.
- `cats`: Taxonomy chi (10 nhóm chuẩn) / thu và override label/màu/icon/subcategory.

### Hành vi chính
- **Mức độ thiết yếu 2 cấp (2-tier necessity):** Phân loại chi tiêu thành **Thiết yếu** (`need`) và **Linh hoạt / Mong muốn** (`want`).
- **Ghi chú nhiều dòng (`description`):** Cột `description TEXT` cho phép ghi chú tự do nhiều dòng, tách rời tiêu đề ngắn `note`.
- **Drawer Sửa giao dịch 560px:** Mở rộng mượt mà khi chỉnh sửa giao dịch, hỗ trợ nhập *Nơi / người nhận* (`merchant`) và bảng *Chi tiết từng món* (`items`: tên món, số lượng, đơn giá, tự động tính tổng). Phím tắt `Ctrl + Enter` lưu nhanh, `Escape` đóng.
- Hóa đơn fixed/ask, skip period, kỳ trả; khoản vay và thẻ tín dụng.
- **Nhịp chi trong kỳ** (Tổng quan) dùng chung `spendingRhythm` với mọi tổng chi khác; màu theo token
  Nocturne nên đọc được cả sáng lẫn tối.
- **Kỳ cũ chưa trả không biến mất khi sang kỳ mới:** hóa đơn hằng tháng bám kỳ tháng trước (chỉ khi kỳ đó
  từ ngày bắt đầu/ngày tạo trở đi); khoản vay bám kỳ tháng trước theo số kỳ đã ghi (không báo oan dữ liệu
  cũ trả muộn mang nhãn tháng mới, bỏ kỳ trước `opened_at`); thẻ hiện nợ sao kê kỳ trước còn treo — tiền trả
  trừ vào nợ cũ nhất trước.
- Cho vay hiện lãi đơn theo ngày trên gốc còn lại, hỗ trợ tính lãi mất do rút tiết kiệm sớm (`forfeited_interest`).
- Quỹ tiết kiệm: Quản lý nhiều nơi gửi/sổ ngân hàng, lãi suất bình quân, đáo hạn, lock soft/term/external và yêu cầu rút term chờ 48 giờ.
- Sổ đã đáo hạn: nút Xử lý → rút về hoặc gửi lại (chỉ gốc / gốc + lãi). Sổ cũ đóng và vào "Lịch sử sổ đã tất toán" (mở lại được), gửi lại là một dòng sổ mới, lãi thực nhận ghi thành Thu › Lãi tiết kiệm; toast có Hoàn tác.

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

### Sắp xếp và chuỗi phụ thuộc
- **Nhóm theo mục đích** là điều hướng chính (cột trái): mỗi item có một nhóm tối đa 2 cấp
  (`Tài chính/Ngân hàng`), gõ ở chế độ Edit với gợi ý nhóm đã có. Nhóm nằm trong encrypted payload
  như tag; danh sách nhóm suy ra từ item, không có nhóm rỗng. Item chưa có nhóm ở mục Ungrouped.
  Tạo item khi đang mở một nhóm thì item mới vào sẵn nhóm đó. Lọc theo loại là select nhỏ ở đầu
  danh sách; tìm kiếm khớp cả tên nhóm.
- **Depends on this** ở trang chi tiết: những item phụ thuộc vào item đang xem — qua link thật, hoặc
  vì một field của chúng trùng email/SĐT mà item này đại diện (Identity, hoặc item có tiêu đề chính là
  email/SĐT đó) — kèm cấp 2, 3 (Gmail → ngân hàng → thẻ). Có dòng tóm tắt và cảnh báo khi item chỉ
  đăng nhập bằng mật khẩu.

**Data:** `accounts` ciphertext + `vault_config`. Không có guest mode.

## 9. Body — Thể Hình & Sức Khỏe (`/body`)

**Files:** `src/pages/BodyPage.jsx`, `src/components/body/*`, `src/hooks/useWorkouts.js`, `src/hooks/useBiometrics.js`, `src/hooks/useNutrition.js`, `src/hooks/useExerciseVideo.js`, `src/utils/workoutLogic.js`, `src/utils/bodyMetrics.js`

Module quản lý toàn diện thể trạng và rèn luyện thể chất, tuân thủ nguyên tắc tối giản và không ngụy tạo số liệu:

- **Điều hướng:** desktop có dải tab 7 màn trên header + viên "Buổi dở" (tên buổi, số set đã xong, Tiếp tục). Mobile (≤840px): header gồm nút về Life Hub, tiêu đề, nút + theo màn (Cơ thể: thêm cân đo; Tổng quan: ghi nhanh), đổi theme và dải chip 7 màn cuộn ngang — không có bottom nav. Khi đang tập, sidebar Life Hub ẩn để màn tập chiếm trọn chiều ngang.

### Lộ trình & Tập luyện (Core Workout)
- **Lộ trình theo thứ trong tuần (D1):** Gán bài tập cố định theo thứ trong tuần (T2..CN). Nếu bỏ buổi không tự dời ngày làm lệch tuần; cho phép tập bù buổi đã bỏ bất kỳ lúc nào.
  - Bấm tên lộ trình để đổi lộ trình / xem trước mẫu / tạo mới. Lịch tuần dọc có ngày tháng, chuyển tuần trước/sau; ngày đã tập đánh dấu theo thứ của buổi (tập bù vẫn gắn đúng thứ), buổi đang dở hiện trên ngày đó kèm số set đã xong.
  - Thêm bài: tìm không dấu (tên Việt/Anh), lọc nhóm cơ và dụng cụ. Kéo ⋮⋮ đổi thứ tự bài trong ngày; bấm "rep/giây" đổi kiểu mục tiêu (đặt lại 10 rep / 30s).
- **Tăng tiến tự động (Auto-progression - D2):** Khi hoàn thành tất cả các set $\ge$ mục tiêu, hệ thống tự động gợi ý tăng $+1\text{ rep}$ (hoặc $+5\text{s}$) và hiển thị checkbox cho người dùng duyệt áp dụng vào lộ trình gốc.
- **Phòng tập trực tiếp (Live Session):**
  - Chế độ tập Straight Sets, Circuit (chuyển bài 20s, hết vòng 90s), Superset (2 bài trong cặp liên tục 0s, nghỉ 75s sau mỗi cặp); chọn trước khi bắt đầu, kèm thời lượng ước tính và thứ tự A1 → B1…
  - Khóa chọn chế độ khi buổi tập đã bắt đầu nhằm bảo toàn hàng đợi và tính toàn vẹn dữ liệu.
  - Tải lại trang / mở lại buổi dở: tiếp tục đúng set còn trống, giữ chế độ và thời gian đã tập (lưu khi về Lộ trình).
  - Màn tập tách khỏi điều hướng Body: ‹ về Lộ trình giữ buổi dở; Tạm dừng tại chỗ dừng cả đồng hồ buổi lẫn đồng hồ nghỉ; Kết thúc sang màn kết quả (Tập tiếp / Hủy buổi có xác nhận / Lưu).
  - Quay lại sửa set: "Sửa set vừa ghi" ở màn nghỉ, "‹ Set trước", hoặc bấm ô set bất kỳ. Ghi lại set đã có cập nhật bản ghi cũ, không tạo bản ghi trùng; số từng set vẫn sửa được ở màn kết quả.
  - Màn kết quả: bấm hàng "Hôm nay" (hoặc "Sửa") của từng bài mở sheet sửa số đã ghi — đổi rep/giây từng set bằng − / + hoặc gõ số, ghi lại set đã bỏ, bỏ set, thêm set ngoài mục tiêu. Tổng rep, gợi ý buổi sau và kỷ lục (PR) tính lại theo số mới.
  - Mỗi bài mới có màn hướng dẫn và "Lần trước" (buổi gần nhất của bài đó); chip trạng thái từng set; nút "Bỏ bài"; bài tính giây có vòng đếm và gợi ý tư thế.
  - Video thị phạm: link tự gắn lưu trên Supabase (`body_exercise_videos`), đồng bộ giữa các máy; gỡ link tự gắn thì quay về video mặc định.
  - Đồng hồ đếm giờ delta timestamp chống lệch giờ khi khóa màn hình điện thoại hoặc chuyển tab.
  - Chuông beep dùng Web Audio API tổng hợp âm tần OscillatorNode báo hiệu khi kết thúc thời gian nghỉ mà không phụ thuộc tài nguyên mạng.
  - Cho phép bỏ qua set (`null`) không tính vào tăng tiến; upsert an toàn chống xung đột id.
  - Bắt đầu buổi mới khi còn phiên dở → hỏi xác nhận rồi mới hủy (`abandoned`) phiên cũ, tuân thủ unique index PostgreSQL. Buổi tự do / tập lẻ không gắn vào lộ trình.
- **Kỷ lục cá nhân (PR Detection):** Mốc riêng cho bodyweight (rep/giây tối đa) và có tạ (1RM Epley); lần đầu tập một bài chỉ là mốc, không tính PR; tối đa 1 PR mỗi bài mỗi buổi.
- **Tiến bộ:** lịch tháng (vạch màu theo loại buổi, nhiều buổi một ngày thì nhiều vạch; ngày có lịch sắp tới viền tròn) + thẻ ngày (buổi đã tập với số từng set, hoặc Dự kiến / Bỏ lỡ kèm nút mở Lộ trình). Tiến bộ từng bài: biểu đồ cột mỗi set qua các buổi, đường mục tiêu, cột mờ "Buổi tới" (lấy từ Lộ trình ở thứ gần nhất có bài đó, không có thì +1 rep / +5s nếu buổi trước đạt), cao nhất / số buổi / so với buổi đầu. Chỉ tính buổi đã hoàn thành.
- **Tỷ lệ bám lịch:** số buổi đã hoàn thành / số buổi theo lịch từ ngày bắt đầu lộ trình (tập bù vẫn tính; hôm nay chưa tập không bị trừ).

### Thư viện bài
- Lọc theo dụng cụ (Tay không / Tạ đơn / Xà / Máy) và vùng cơ, tìm không dấu tên Việt/Anh. Bài tự tạo cũng hiện trong thư viện và ô thêm bài của Lộ trình.
- Chi tiết 4 tab: Tổng quan (video, mức tác động từng nhóm cơ, nhịp thở, tempo), Kỹ thuật, An toàn (rủi ro, không nên tập khi, bài thay thế), Biến thể (bậc thang dễ → khó, bài đang xem được đánh dấu). "Thêm vào kế hoạch" chọn thứ trong tuần (hiện số bài đã có / ngày nghỉ), số hiệp và mục tiêu; "Tập bài này ngay" mở buổi tập lẻ. Mobile: chi tiết mở toàn màn với thanh nút đáy.

### Bản đồ cơ 3D (Three.js Canvas - D5)
- Đóng gói Three.js từ npm package, render mô hình khối cầu giải phẫu 14 nhóm cơ xoay 360°, cuộn zoom, tooltip tên tiếng Việt.
- Cơ chế giải phóng tài nguyên triệt để khi unmount (dispose geometries, materials, textures, force context loss) chống memory leak trên mobile và WebGL crash.
- 3 chế độ tô màu: **Nhóm cơ** (chọn & phụ trợ), **Tải 7 ngày** (thang màu nhiệt tính từ khối lượng tập thật trong 7 ngày gần nhất), **Phục hồi** (3 trạng thái: Sẵn sàng, Đang hồi, Cần nghỉ suy từ thời gian nghỉ sau buổi tập gần nhất; chỉ hiện trạng thái + số giờ, không hiện % — D4).
- Fallback 2D canvas mượt mà khi thiết bị không hỗ trợ WebGL.

### Sinh trắc học & Dinh dưỡng (Biometrics & Nutrition)
- **Sinh trắc học:** Tính toán BMI chuẩn WHO châu Á kèm kim đồng hồ gauge (dải cân theo chiều cao thật; chưa có chiều cao thì không có kim), BMR (Mifflin-St Jeor, cần chiều cao + giới tính + năm sinh trong Hồ sơ), TDEE và Body Score (0-100) trên dữ liệu thực tế; lưới 9 chỉ số ghi rõ Đã đo / Công thức / Chưa đo (không tự điền giá trị đoán); xu hướng lọc 7 ngày / 30 ngày / 3 tháng / năm, cần ≥ 2 lần đo; mục tiêu chỉ có cân nặng (`goal_weight_kg`); đo thước dây US Navy ra % mỡ và tỉ lệ eo/cao; đánh dấu các lần cân đo lệch giờ (outlier). Màn chia 3 tab: Phân tích (gauge BMI, xu hướng, 9 chỉ số, thành phần cơ thể), Lịch sử (nhóm theo ngày, bấm một lần đo để xem chi tiết / đánh dấu lệch giờ / xóa — mobile là bottom sheet), Hồ sơ (BMR/TDEE, tiến độ mục tiêu cân, form hồ sơ). Thêm cân đo: chỉ bắt buộc cân nặng, Ctrl+Enter để lưu, mobile là bottom sheet.
- **Dinh dưỡng tối giản:** Ghi nhận 4 bữa ăn với calo & macro (đạm, carb, béo) tự động cân đối theo TDEE, chọn nhanh từ danh sách món mẫu đã lưu, theo dõi mục tiêu 8 ly nước (2.000ml) theo múi giờ địa phương GMT+7 (`toDateStr`).
- **Check-in tuần:** Đánh giá thể trạng 4 tiêu chí (1-5 sao, khởi tạo 0 để tránh gửi điểm giả), cân nặng trung bình tuần và số đo vòng eo; tính số tuần theo chuẩn ISO-8601.

## 10. Media, widget và PWA

- `api/upload.js`: authenticated multipart upload vào Google Drive folder đã cấu hình.
- `api/stream.js`: folder-scoped readonly proxy, hỗ trợ HTTP Range/seek cho media.
- `GlobalAudioPlayer`: tiếp tục phát khi đổi page; `CustomAudioPlayer` dùng cho audio inline.
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
