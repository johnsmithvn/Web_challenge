# PLAN.md — Life Hub

**Current version:** v6.10.0 · **Updated:** 2026-08-18

PLAN chỉ giữ thứ tự roadmap hiện tại. Checklist có thể chạy nằm trong [`TASKS.md`](TASKS.md); lịch sử
đã hoàn thành nằm trong [`CHANGELOG.md`](../CHANGELOG.md).

## Thứ tự roadmap

| Ưu tiên | Milestone | Trạng thái |
|---:|---|---|
| 1 | Production handoff cho ordered schema v6.0/v6.2 + deploy + smoke | **XONG 2026-08-11** — SQL, deploy v6.3.0, smoke, ciphertext đều đã xác nhận |
| 2 | Finance hardening: RPC/RLS/rollback → liên kết → responsive/accessibility QA | P0/P1 xong (user smoke production); còn P2 UI/a11y QA |
| 3 | Correctness còn lại: local-date trong Focus/Inbox/Finance + smoke upload/stream | Local-date xong 2026-08-11; còn media smoke |
| 4 | Vault vận hành: export/restore → đổi passphrase/version → rotate DEK | Export/restore code xong 2026-08-11, chờ diễn tập phục hồi; phần còn lại chưa làm |
| 5 | Vault UX security: inactivity auto-lock, clipboard clear, TOTP | Follow-up |
| 6 | Task model và refactor UI lớn | Icebox; cần quyết định riêng |

## Thứ tự làm tiếp — chốt 2026-08-16

**Đã chốt/đã xong 2026-08-16:** `excluded` chọn phương án (a) — giữ nguyên, không nới invariant. Dài
đuôi nhãn a11y + bỏ trường `bio` đã làm.

**Làm trước** (nhỏ, độc lập, không chờ ai):

1. **Đối chiếu 4 màn Finance với handoff** — việc lớn nhất còn lại của module chính. Bắt đầu từ Tổng quan.
2. Áp cảnh báo Auto-K cho 11 ô tiền còn lại; cân nhắc mặc định TẮT Auto-K.

**Làm sau** (mỗi mục một sprint riêng, không trộn):

3. QA responsive/mobile bằng dữ liệu dày, bắt đầu từ các màn dùng `finance.css`.
4. QA keyboard/focus + nhóm B của audit a11y: `role="button"` thiếu `tabIndex`/keydown (Navbar,
   MonthCalendar), `<div onClick>` trần (Inbox, Ươm mầm), Esc để đóng cho `GenericModal` +
   `DatePickerPopover` + `TaskPicker` + `AuthModal` + `LinkKBModal`, và một hook `useFocusTrap` dùng
   chung (**không modal nào trong repo có focus trap** — Tab vẫn thoát ra nền sau).
5. Media API smoke (upload ảnh, audio Range/206, 401).
6. Chẻ nhỏ `RecurringScreen.jsx` (1400 dòng) và `CollectPage.jsx` (1470 dòng) — **theo từng lần chạm
   vào chúng**, không mở sprint rewrite.

**Cuối cùng, sau khi app đã hoàn thiện** (user chốt 2026-08-16 — làm sau, không phải bỏ):

7. **Diễn tập phục hồi Vault** đủ 3 bước (export → restore → unlock đọc được item). Tới lúc đó mới
   được coi export là đường phục hồi thật; từ giờ đến đó UI vẫn phải cảnh báo mất passphrase là mất
   quyền giải mã, và **Vault không được dùng làm bản sao duy nhất** của secret quan trọng.
8. Vault follow-up: đổi passphrase re-wrap → auto-lock → clipboard clear → TOTP.

**Chỉ làm khi có nhu cầu thật** (đừng làm vì thấy thiếu):

- Hoàn tác cho thao tác xóa quy tắc — hộp xác nhận đang là lớp bảo vệ duy nhất.
- Đồng bộ nhiều thiết bị bằng Supabase Realtime — app một người dùng hiếm khi phiền.
- Fetch theo yêu cầu cho kỳ cũ hơn cửa sổ dữ liệu.

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
2. Smoke liên kết Task, Inbox conversion, tag, category override, budget và CSV.
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
   (export → restore → unlock → đọc được item); xem TASKS §4 cho 3 bước.
2. Đổi passphrase bằng re-wrap cùng DEK.
3. Nâng payload/KDF/encryption version có migration rõ ràng.
4. Rotate DEK và re-encrypt item khi nghi lộ.
5. Inactivity auto-lock, clipboard auto-clear và TOTP client-side.

Cho tới khi bước 1 hoàn tất, Vault không được dùng làm bản sao duy nhất của secret quan trọng.

## Icebox

- Task subtask: chọn rõ row con đầy đủ hay checklist JSON trước khi đụng schema.
- Task dependency: chỉ làm khi có use case thực tế; tránh thêm quan hệ self-FK thứ ba theo suy đoán.
- Xóa fallback migration cũ chỉ sau khi production schema được xác minh ở trạng thái cuối.
- Refactor form/modal/inline CSS theo từng phạm vi nhỏ; không gom thành rewrite toàn app.

Các mục icebox không tự động trở thành sprint tiếp theo. User phải chọn và duyệt phạm vi trước.
