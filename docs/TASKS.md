# TASKS — Life Hub

**Version:** v6.2.0 · **Updated:** 2026-08-09

Chỉ giữ việc còn mở. Việc đã hoàn thành xem [`CHANGELOG.md`](../CHANGELOG.md); thứ tự roadmap xem
[`PLAN.md`](PLAN.md).

## 1. Production handoff — user tự chạy

Local đã replay ordered migrations; Vault crypto/contracts và authenticated RLS smoke đã pass.
Hosted Supabase **chưa được đánh dấu đã nâng v6.0/v6.2**.

- [ ] Xác định schema production hiện tại và đối chiếu ordered chain trong README; không dùng
  `supabase db push`, linked reset hoặc chạy baseline riêng lẻ.
- [ ] Trước Vault v6.2, chạy `SELECT COUNT(*) FROM public.accounts` và chỉ tiếp tục khi kết quả `0`.
- [ ] User chạy đúng SQL còn thiếu theo thứ tự README. Migration Vault phải rollback nếu bảng không trống.
- [ ] Deploy/redeploy frontend v6.2 ngay sau schema tương thích.
- [ ] Smoke production: Auth → Task CRUD → năm màn Finance → Vault setup/create/lock/reload/unlock/delete.
- [ ] Xác nhận network/database chỉ nhận ciphertext cho nội dung Vault, rồi mới ghi production “done”.

## 2. Finance hardening

### P0 — RPC/RLS/transaction

- [ ] Chạy đủ bảy RPC với user authenticated: pay/skip bill, receive income, loan payment, card
  statement payment, saving withdrawal và saving move.
- [ ] Mỗi RPC có happy path, duplicate period, reference khác owner và rollback khi một bước lỗi.
- [ ] Dọn sạch test data sau smoke; không reset toàn database.

### P1 — liên kết và báo cáo

- [ ] Smoke Task ↔ transaction: chọn/sửa `task_id`; xác nhận không hứa navigation/tổng chi theo Task
  vì UI chưa có hai feature đó.
- [ ] Smoke Inbox → transaction/hóa đơn; xác nhận Inbox bị xóa sau conversion và FK source trở về null.
- [ ] Smoke tag, category override, budget, saving-as-expense preference và CSV export.
- [ ] Sau sửa/xóa transaction, xác nhận Tổng quan/Ngân sách/Thống kê tính lại đúng kỳ.

### P2 — UI

- [ ] QA desktop/mobile bằng dữ liệu dày: overflow, bottom sheet, sidebar, chart/legend và form dài.
- [ ] QA keyboard, focus indicator, screen-reader label và console error thuộc Finance.

## 3. Correctness còn lại

### Local date

Các chỗ logic “hôm nay” còn dùng UTC nằm trong Focus, Inbox và Finance list.

- [ ] Đổi `FocusPage` và các phép ngày trong `useFocusTimer` sang `toDateStr()`.
- [ ] Đổi grouping/filter ngày còn sót trong `InboxPage` và `components/finance/ListScreen` sang helper
  local-date dùng chung.
- [ ] Thêm một self-check GMT+7 qua mốc 00:00–06:59 để ngăn regression.

### Media API smoke

- [ ] Upload một ảnh từ Knowledge trên môi trường đã cấu hình Drive.
- [ ] Upload/phát audio và seek để xác nhận response `206 Partial Content`.
- [ ] Gọi `/api/upload` không token và xác nhận `401`.
- [ ] Chỉ thay multipart parser hoặc stream pump bằng native API khi các case filename Unicode/file lớn
  và Range vẫn pass; nếu chưa có bằng chứng thì giữ implementation hiện tại.

## 4. Vault follow-up

- [ ] Export/restore ciphertext + `vault_config`, có version check và diễn tập phục hồi.
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
