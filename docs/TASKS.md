# TASKS — Life Hub

**Version:** v6.40.0 · **Updated:** 2026-11-25

Chỉ giữ việc còn mở. Việc đã hoàn thành xem [`CHANGELOG.md`](../CHANGELOG.md); thứ tự roadmap xem
[`PLAN.md`](PLAN.md).

## 1. Chờ user duyệt / tự chạy

Code đã xong, agent không tự kiểm chứng được — tick theo lời user.

- [ ] **Chốn G2 — Chuyến đi** (v6.39.0 + vá v6.40.0): user duyệt theo `PLAN_CHON.md` trước khi mở việc mới
  cho Chốn.
- [ ] Chạy `migration_v6.9.0_finance_rule_detach.sql` trên hosted (nếu chưa), rồi smoke tay bốn nút xóa quy
  tắc (hóa đơn, thu nhập, khoản vay, thẻ).
- [ ] Chạy `migration_v6.10.0_drop_inspirational_quotes.sql` trên hosted (nếu chưa). Fail-closed: từ chối
  chạy nếu bảng còn dù một dòng.
- [ ] Smoke segment Cho vay trên hosted sau `migration_v6.4.0_finance_lending.sql`: tạo khoản, ghi vài lần
  thu, xác nhận giao dịch thu về `excluded` và không lọt vào tổng thu nhập.

## 2. Finance — UI còn mở

- [ ] Đối chiếu bốn màn còn lại với prototype handoff (`Chi tieu.dc.html` — file 370 KB được đính kèm
  dưới tên `HOA-DON.md`): Tổng quan, Nhập nhanh, Giao dịch, Phân tích. Màn Hóa đơn đã đối chiếu xong
  2026-08-15. Tổng quan / Báo cáo đã sửa nhiều cho mobile (v6.28.1, v6.30.5–v6.30.8) nhưng chưa đối chiếu
  lại với handoff.
- [ ] QA desktop/mobile bằng dữ liệu dày: overflow, bottom sheet, sidebar, chart/legend và form dài.
  `finance.css` giờ đã có ~21 khối `@media` (trước 2); phần còn lại là bấm tay trên máy thật.
- [ ] QA keyboard + focus indicator + console error thuộc Finance (cần bấm tay).
- [ ] **Đóng vòng dữ liệu ngoài cửa sổ fetch.** Cửa sổ bắt đầu 01/01 năm ngoái và giữ mọi giao dịch gắn
  quy tắc, nên không có tính toán nào sai. Nhưng khoản chi lẻ cũ hơn thì không ai xem lại được. Khi cần:
  fetch theo yêu cầu lúc user chọn kỳ ngoài cửa sổ, hoặc nút "tải thêm".

## 3. Accessibility — nhóm B của audit 2026-08-16

Đã kiểm lại với code 2026-11-25 (`TaskPicker`, `InboxPage` đã bị xoá; `MonthCalendar` không còn
`role="button"`). Còn:

- [ ] `Navbar.jsx` — `.nav-avatar` là `<div role="button">` thiếu `tabIndex` + xử lý Enter/Space.
- [ ] Esc để đóng cho `GenericModal` và `DatePickerPopover` (chưa có handler `Escape`).
- [ ] Một hook `useFocusTrap` dùng chung cho modal (chưa tồn tại).

## 4. Media API smoke

- [ ] Upload một ảnh trên môi trường đã cấu hình Drive (Knowledge, hoặc ảnh cảm nhận của Chốn — cùng
  đi qua `/api/upload`).
- [ ] Upload/phát audio và seek để xác nhận response `206 Partial Content`.
- [ ] Gọi `/api/upload` không token và xác nhận `401`.
- [ ] Chỉ thay multipart parser hoặc stream pump bằng native API khi các case filename Unicode/file lớn
  và Range vẫn pass; nếu chưa có bằng chứng thì giữ implementation hiện tại.

## 5. Chốn — follow-up (ngoài phạm vi G1/G2)

Chi tiết ở `PLAN_CHON.md` §10. Chỉ mở sau khi G2 được duyệt.

- [ ] Hoàn thành task "Đi …" bên Nhiệm vụ thì mở màn thắp đèn của chốn đó (đụng `TasksPage`).
- [ ] Chốn trên Trang chủ (`components/dashboard/HomeDashboard.jsx`, có từ v6.22.0).
- Chỉ khi có nhu cầu thật: geocoding địa chỉ → toạ độ (cần dịch vụ ngoài), chia sẻ chốn cho người khác.
  Tự lấy tiêu đề/ảnh từ link TikTok/FB: **không làm** (quyết định #2).

## 6. Vault follow-up

- [ ] **Diễn tập phục hồi thật** — chưa làm, và đây là phần khiến export có nghĩa hay không:
  1. Export ở màn hình khoá, giữ file.
  2. Xoá hết item trong Vault (hoặc dùng account test), rồi Restore đúng file đó.
  3. Unlock bằng passphrase gốc và xác nhận **mở được đủ item, đọc được nội dung**.
  Chưa qua bước 3 thì UI vẫn phải cảnh báo mất passphrase là mất quyền giải mã, và Vault vẫn không được
  dùng làm bản sao duy nhất.
- [ ] Nâng KDF/payload/encryption version có migration và rollback rõ ràng.
- [ ] Rotate DEK + re-encrypt toàn item khi nghi lộ khóa.
- [ ] Inactivity auto-lock với thời lượng user chọn.
- [ ] Clipboard auto-clear cho secret đã copy.
- [ ] TOTP client-side từ seed nằm trong encrypted payload.

Không triển khai recovery “giả”: nếu chưa có quy trình khôi phục đã test, UI phải tiếp tục cảnh báo mất
passphrase là mất quyền giải mã và không dùng Vault làm bản sao duy nhất.

## 7. Quyết định sản phẩm đang mở

- [ ] **Dependency:** xác nhận có use case “Task B bị chặn bởi Task A” trước khi thêm self-FK mới.
  (Task cha–con đã có từ v6.19.0/v6.20.0; dependency sẽ là quan hệ self-FK thứ ba.)
- [ ] **Hoàn tác khi xóa quy tắc Finance** — hộp xác nhận đang là lớp bảo vệ duy nhất; chỉ làm khi có nhu
  cầu thật.

Priority + tag đã đủ hai trục phân loại hiện tại; không thêm `type/category` thứ ba nếu chưa có truy vấn
cụ thể. Assignee, sprint, Gantt, workload, custom status/field và time tracking không phải mục tiêu của
app một người dùng; Focus đã đảm nhiệm time-boxing.

## 8. Technical debt — icebox

- [ ] Xóa fallback query cho junction cũ chỉ sau khi production schema được kiểm chứng; không dựa vào
  tài liệu cũ để đoán.
- [ ] Quyết định giữ/bỏ retry của recurring task dựa trên tính idempotent và log lỗi, không chỉ dựa vào
  số dòng code.
- [ ] Thu gọn state/form của `TaskListSection` theo từng thay đổi có test; không rewrite cả page.
- [ ] Chuẩn hóa các modal đang dùng và loại CSS modal không còn consumer.
- [ ] Chuyển inline style sang CSS theo từng page khi đang sửa page đó; không tạo sprint thay hàng loạt.
- [ ] Đánh giá `tagged_items` khi có unified search thật; nếu vẫn không có consumer thì cân nhắc bỏ view
  bằng migration mới.
- [ ] Cột `profiles.bio` không còn form nào ghi; xóa cột cần migration riêng, chỉ làm khi chắc không dùng lại.

Icebox cần user duyệt riêng. Không trộn các refactor này vào production handoff hoặc security fix.
