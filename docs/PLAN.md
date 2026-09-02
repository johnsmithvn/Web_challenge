# PLAN.md — Life Hub

**Current version:** v6.16.0 · **Updated:** 2026-09-02

PLAN chỉ giữ thứ tự roadmap hiện tại. Checklist có thể chạy nằm trong [`TASKS.md`](TASKS.md); lịch sử
đã hoàn thành nằm trong [`CHANGELOG.md`](../CHANGELOG.md).

## Thứ tự roadmap

| Ưu tiên | Milestone | Trạng thái |
|---:|---|---|
| 1 | Production handoff cho ordered schema v6.0/v6.2 + deploy + smoke | **XONG 2026-08-11** — SQL, deploy v6.3.0, smoke, ciphertext đều đã xác nhận |
| 2 | Finance hardening: RPC/RLS/rollback → liên kết → responsive/accessibility QA | P0/P1 xong (user smoke production); 2-tier necessity & multi-line description xong |
| 3 | Correctness còn lại: local-date trong Focus/Inbox/Finance + smoke upload/stream | Local-date xong; còn media smoke |
| 4 | Vault vận hành: export/restore → đổi passphrase → Emergency Recovery Key | **XONG 2026-08-31 (v6.14.0/v6.15.0)** — Đổi passphrase, Recovery Key 24 từ, Plaintext/Ciphertext backup/restore |
| 5 | Knowledge Base PKM & Không gian Lịch 5 chế độ | **XONG 2026-09-02 (v6.16.0)** — Athenaeum PKM (Wiki-links, Graph, Backlinks), Lịch 5 view + Lịch Âm |
| 6 | Vault UX security: inactivity auto-lock, clipboard clear, TOTP | Follow-up |
| 7 | Task model và refactor UI lớn | Icebox; cần quyết định riêng |

## Thứ tự làm tiếp

**Làm trước** (nhỏ, độc lập, không chờ ai):

1. **Đối chiếu 4 màn Finance với handoff** — Bắt đầu từ Tổng quan.
2. Áp cảnh báo Auto-K cho các ô tiền còn lại; cân nhắc mặc định TẮT Auto-K.

**Làm sau** (mỗi mục một sprint riêng, không trộn):

3. QA responsive/mobile bằng dữ liệu dày, bắt đầu từ các màn dùng `finance.css`.
4. QA keyboard/focus + nhóm B của audit a11y: `role="button"` thiếu `tabIndex`/keydown (Navbar,
   MonthCalendar), `<div onClick>` trần (Inbox), Esc để đóng cho `GenericModal` +
   `DatePickerPopover` + `TaskPicker` + `AuthModal` + `LinkKBModal`, và một hook `useFocusTrap` dùng
   chung.
5. Media API smoke (upload ảnh, audio Range/206, 401).

**Cuối cùng, sau khi app đã hoàn thiện**:

6. **Diễn tập phục hồi Vault** đủ 3 bước (export → restore → unlock đọc được item).
7. Vault follow-up: auto-lock → clipboard clear → TOTP.

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
