# TASKS — Life Hub

**Version:** v6.4.0 · **Updated:** 2026-08-15

Chỉ giữ việc còn mở. Việc đã hoàn thành xem [`CHANGELOG.md`](../CHANGELOG.md); thứ tự roadmap xem
[`PLAN.md`](PLAN.md).

## 1. Production handoff — user tự chạy

Local đã replay ordered migrations; Vault crypto/contracts và authenticated RLS smoke đã pass.

**User xác nhận 2026-08-11:** SQL migration đã chạy lên hosted Supabase, frontend v6.2 đã deploy trên
Vercel, và đã smoke thật Auth/Task/Finance/Vault trên production. Các dòng dưới đây tick theo lời user,
không phải do agent kiểm chứng.

- [x] Xác định schema production hiện tại và đối chiếu ordered chain trong README; không dùng
  `supabase db push`, linked reset hoặc chạy baseline riêng lẻ.
- [x] Trước Vault v6.2, chạy `SELECT COUNT(*) FROM public.accounts` và chỉ tiếp tục khi kết quả `0`.
- [x] User chạy đúng SQL còn thiếu theo thứ tự README. Migration Vault phải rollback nếu bảng không trống.
- [x] Deploy/redeploy frontend v6.2 ngay sau schema tương thích.
- [x] Smoke production: Auth → Task CRUD → năm màn Finance → Vault setup/create/lock/reload/unlock/delete.
- [x] Xác nhận network/database chỉ nhận ciphertext cho nội dung Vault, rồi mới ghi production “done”.
      Kiểm 2026-08-11 trên DevTools → Network prod: response `accounts?select=…` chỉ có `id`, `user_id`,
      `encrypted_payload` (base64), `encryption_nonce`, `encryption_version`, `created_at`, `updated_at`.
      Không tồn tại cột nội dung nào → không rò được về mặt cấu trúc, không phải chỉ "lần này không thấy".

**MỤC 1 ĐÓNG 2026-08-11.** Production chạy đúng ordered schema v6.0/v6.2, frontend v6.3.0 đã deploy,
Vault đã smoke thật và chỉ nhận ciphertext.

## 2. Finance hardening

**User xác nhận 2026-08-11:** đã smoke Finance trên production, kết quả OK. P0/P1 đóng theo lời user;
agent không tự kiểm chứng được RPC trên hosted DB.

### P0 — RPC/RLS/transaction

- [x] Chạy đủ bảy RPC với user authenticated: pay/skip bill, receive income, loan payment, card
  statement payment, saving withdrawal và saving move.
- [x] Mỗi RPC có happy path, duplicate period, reference khác owner và rollback khi một bước lỗi.
- [x] Dọn sạch test data sau smoke; không reset toàn database.

### P1 — liên kết và báo cáo

- [x] Smoke Task ↔ transaction: chọn/sửa `task_id`; xác nhận không hứa navigation/tổng chi theo Task
  vì UI chưa có hai feature đó.
- [x] Smoke Inbox → transaction/hóa đơn; xác nhận Inbox bị xóa sau conversion và FK source trở về null.
- [x] Smoke tag, category override, budget, saving-as-expense preference và CSV export.
- [x] Sau sửa/xóa transaction, xác nhận Tổng quan/Ngân sách/Thống kê tính lại đúng kỳ.

### P2 — UI

- [ ] Đối chiếu bốn màn còn lại với prototype handoff (`Chi tieu.dc.html` — file 370 KB được đính kèm
  dưới tên `HOA-DON.md`): Tổng quan, Nhập nhanh, Giao dịch, Phân tích. Màn Hóa đơn đã đối chiếu xong
  2026-08-15; bốn màn kia dựng theo bản mô tả nên nhiều khả năng còn lệch.
- [ ] Smoke segment Cho vay trên hosted sau khi chạy `migration_v6.4.0_finance_lending.sql`: tạo khoản,
  ghi vài lần thu, xác nhận giao dịch thu về `excluded` và không lọt vào tổng thu nhập.
- [ ] QA desktop/mobile bằng dữ liệu dày: overflow, bottom sheet, sidebar, chart/legend và form dài.
- [ ] QA keyboard, focus indicator, screen-reader label và console error thuộc Finance.

## 3. Correctness còn lại

### Local date — xong 2026-08-11

- [x] Đổi `FocusPage` và các phép ngày trong `useFocusTimer` sang `toDateStr()`.
- [x] Đổi grouping/filter ngày còn sót trong `InboxPage` và `components/finance/ListScreen` sang helper
  local-date dùng chung. (`ListScreen.dayLabel` là chỗ cuối, sửa 2026-08-11.)
- [x] Thêm một self-check GMT+7 qua mốc 00:00–06:59 để ngăn regression.
  (`src/utils/dateUtils.test.js` case 00:30 — đã có sẵn, không cần thêm file test.)

`InboxPage:418` còn một `toISOString()` nhưng là mốc **timestamp** so với `created_at` (timestamptz),
không phải date-string — đúng cách dùng, đừng "dọn" sang `toDateStr()`.

### Media API smoke

- [ ] Upload một ảnh từ Knowledge trên môi trường đã cấu hình Drive.
- [ ] Upload/phát audio và seek để xác nhận response `206 Partial Content`.
- [ ] Gọi `/api/upload` không token và xác nhận `401`.
- [ ] Chỉ thay multipart parser hoặc stream pump bằng native API khi các case filename Unicode/file lớn
  và Range vẫn pass; nếu chưa có bằng chứng thì giữ implementation hiện tại.

## 4. Vault follow-up

- [x] Export/restore ciphertext + `vault_config`, có version check. **Code xong 2026-08-11** — nút ở màn
  hình khoá; export chạy được khi đang khoá; restore chặn `userId` lệch (AAD gắn key + item vào user id),
  chỉ chạy vào Vault trống, và khoá lại sau khi xong.
- [ ] **Diễn tập phục hồi thật** — chưa làm, và đây là phần khiến export có nghĩa hay không:
  1. Export ở màn hình khoá, giữ file.
  2. Xoá hết item trong Vault (hoặc dùng account test), rồi Restore đúng file đó.
  3. Unlock bằng passphrase gốc và xác nhận **mở được đủ item, đọc được nội dung**.
  Chưa qua bước 3 thì UI vẫn phải cảnh báo mất passphrase là mất quyền giải mã, và Vault vẫn không được
  dùng làm bản sao duy nhất.
- [ ] Đổi passphrase bằng re-wrap cùng DEK; không re-encrypt item không cần thiết.
- [ ] Nâng KDF/payload/encryption version có migration và rollback rõ ràng.
- [ ] Rotate DEK + re-encrypt toàn item khi nghi lộ khóa.
- [ ] Inactivity auto-lock với thời lượng user chọn.
- [ ] Clipboard auto-clear cho secret đã copy.
- [ ] TOTP client-side từ seed nằm trong encrypted payload.

Không triển khai recovery “giả”: nếu chưa có quy trình khôi phục đã test, UI phải tiếp tục cảnh báo mất
passphrase là mất quyền giải mã và không dùng Vault làm bản sao duy nhất.

## 5. Quyết định sản phẩm đang mở

- [ ] **Subtask:** chọn một trong hai mô hình trước khi viết migration:
  - row Task con đầy đủ nếu thật sự cần deadline/priority/recurrence riêng;
  - checklist trong Task nếu chỉ cần các bước nhỏ.
- [ ] **Dependency:** xác nhận có use case “Task B bị chặn bởi Task A” trước khi thêm self-FK mới.

Priority + tag đã đủ hai trục phân loại hiện tại; không thêm `type/category` thứ ba nếu chưa có truy vấn
cụ thể. Assignee, sprint, Gantt, workload, custom status/field và time tracking không phải mục tiêu của
app một người dùng; Focus đã đảm nhiệm time-boxing.

## 6. Technical debt — icebox

- [ ] Xóa fallback query cho junction cũ chỉ sau khi production schema được kiểm chứng; không dựa vào
  tài liệu cũ để đoán.
- [ ] Quyết định giữ/bỏ retry của recurring task dựa trên tính idempotent và log lỗi, không chỉ dựa vào
  số dòng code.
- [ ] Thu gọn state/form của `TaskListSection` theo từng thay đổi có test; không rewrite cả page.
- [ ] Chuẩn hóa các modal đang dùng và loại CSS modal không còn consumer.
- [ ] Chuyển inline style sang CSS theo từng page khi đang sửa page đó; không tạo sprint thay hàng loạt.
- [ ] Đánh giá `tagged_items` khi có unified search thật; nếu vẫn không có consumer thì cân nhắc bỏ view
  bằng migration mới.

Icebox cần user duyệt riêng. Không trộn các refactor này vào production handoff hoặc security fix.
