# PLAN.md — Life Hub

**Current version:** v6.40.0 · **Updated:** 2026-11-25

PLAN chỉ giữ thứ tự roadmap hiện tại. Checklist có thể chạy nằm trong [`TASKS.md`](TASKS.md); lịch sử
đã hoàn thành nằm trong [`CHANGELOG.md`](../CHANGELOG.md).

## Thứ tự roadmap

| Ưu tiên | Milestone | Trạng thái |
|---:|---|---|
| 1 | Production handoff cho ordered schema v6.0/v6.2 + deploy + smoke | **XONG 2026-08-11** |
| 2 | Finance hardening: RPC/RLS/rollback → liên kết → responsive/accessibility QA | P0/P1 xong; còn đối chiếu 4 màn với handoff + QA tay |
| 3 | Correctness còn lại: local-date + smoke upload/stream | Local-date xong; còn media smoke |
| 4 | Vault vận hành: export/restore → đổi passphrase → Recovery Key | **XONG 2026-08-31** (v6.14.0/v6.15.0); còn diễn tập phục hồi |
| 5 | Knowledge PKM, Lịch 5 chế độ, Chủ đề + Sổ lệnh | **XONG** (v6.16.0 → v6.36.0) |
| 6 | Nhiệm vụ: khung giờ, việc con, nền trời + FX Lab, menu thao tác | **XONG** (v6.17.0 → v6.40.0) |
| 7 | Body + Trang chủ dashboard; Body giao diện Ngân hà | **XONG** (v6.22.0, v6.37.0) |
| 8 | Chốn: G1 lõi + G2 Chuyến đi ([`PLAN_CHON.md`](PLAN_CHON.md)) | G1 xong; **G2 chờ user duyệt** |
| 9 | Vault UX security: inactivity auto-lock, clipboard clear, TOTP | Follow-up |
| 10 | Task model và refactor UI lớn | Icebox; cần quyết định riêng |

## Thứ tự làm tiếp

**Làm trước** (nhỏ, độc lập, không chờ ai):

1. **User duyệt Chốn G2** — chưa duyệt thì không mở việc mới cho Chốn.
2. **Đối chiếu 4 màn Finance với handoff** — bắt đầu từ Tổng quan.

**Làm sau** (mỗi mục một sprint riêng, không trộn):

3. QA responsive/mobile bằng dữ liệu dày, bắt đầu từ các màn dùng `finance.css`.
4. QA keyboard/focus + phần còn lại của nhóm B audit a11y (TASKS §3): `.nav-avatar` thiếu
   `tabIndex`/keydown, Esc để đóng `GenericModal` + `DatePickerPopover`, hook `useFocusTrap` dùng chung.
5. Media API smoke (upload ảnh, audio Range/206, 401).
6. Chốn follow-up sau G2: hoàn thành task "Đi …" → mở màn thắp đèn; Chốn trên Trang chủ.

**Cuối cùng, sau khi app đã hoàn thiện**:

7. **Diễn tập phục hồi Vault** đủ 3 bước (export → restore → unlock đọc được item).
8. Vault follow-up: auto-lock → clipboard clear → TOTP.

**Chỉ làm khi có nhu cầu thật** (đừng làm vì thấy thiếu):

- Hoàn tác cho thao tác xóa quy tắc — hộp xác nhận đang là lớp bảo vệ duy nhất.
- Đồng bộ nhiều thiết bị bằng Supabase Realtime — app một người dùng hiếm khi phiền.
- Fetch theo yêu cầu cho kỳ cũ hơn cửa sổ dữ liệu.
- Chốn: geocoding địa chỉ → toạ độ, chia sẻ chốn cho người khác.

## Milestone 1 — production handoff

Mục tiêu: production dùng đúng ordered chain, không dùng remote push/reset và không đánh dấu đã deploy
trước khi user xác nhận.

Điều kiện hoàn thành:

- User kiểm tra Vault production trống trước migration v6.2.
- Chạy đúng thứ tự SQL trong README; không chạy baseline hoặc migration cũ riêng lẻ.
- Deploy frontend ngay sau schema tương thích.
- Smoke Auth, Task, Finance và Vault lock/unlock/ciphertext.
- Ghi kết quả thật vào TASKS/CHANGELOG; không suy diễn từ local.

## Milestone 2 — Finance hardening

Thứ tự phụ thuộc:

1. Kiểm đủ bảy RPC bằng user đã auth: happy path, trùng kỳ, khác owner và rollback.
2. Smoke liên kết Task, tag, category override và CSV.
3. QA dữ liệu dày trên desktop/mobile, keyboard, focus, overflow và console.
4. Production smoke sau khi user triển khai schema/code.

Không đưa auto-sinh Task nhắc nghĩa vụ hoặc `activity_logs` khi thanh toán vào hardening. Hai ý tưởng
này chỉ làm khi có nhu cầu dùng thật.

## Milestone 3 — correctness và media

- ~~Thống nhất mọi logic “hôm nay” còn sót sang `toDateStr()`~~ — xong 2026-08-11 (`ListScreen.dayLabel`
  là chỗ cuối). Chỉ còn mốc timestamp so với `timestamptz`, không được đổi.
- Smoke upload ảnh, audio, Range/206 và unauthorized/401 trên môi trường có Drive env.
- Chỉ đơn giản hóa multipart/stream implementation nếu smoke chứng minh native API thay thế an toàn.

## Milestone 4–5 — Vault follow-up

Thứ tự an toàn:

1. ~~Export/restore có version check~~ — code xong 2026-08-11. **Còn phải diễn tập phục hồi thật**
   (export → restore → unlock → đọc được item); xem TASKS §6 cho 3 bước.
2. ~~Đổi passphrase bằng re-wrap cùng DEK~~ — xong 2026-08-31.
3. Nâng payload/KDF/encryption version có migration rõ ràng.
4. Rotate DEK và re-encrypt item khi nghi lộ.
5. Inactivity auto-lock, clipboard auto-clear và TOTP client-side.

Cho tới khi bước 1 hoàn tất, Vault không được dùng làm bản sao duy nhất của secret quan trọng.

## Icebox

- Task dependency: chỉ làm khi có use case thực tế; tránh thêm quan hệ self-FK thứ ba theo suy đoán.
- Xóa fallback migration cũ chỉ sau khi production schema được xác minh ở trạng thái cuối.
- Refactor form/modal/inline CSS theo từng phạm vi nhỏ; không gom thành rewrite toàn app.

Các mục icebox không tự động trở thành sprint tiếp theo. User phải chọn và duyệt phạm vi trước.
