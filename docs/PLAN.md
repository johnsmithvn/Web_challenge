# PLAN.md — Life Hub

**Current version:** v6.2.0 · **Updated:** 2026-08-09

PLAN chỉ giữ thứ tự roadmap hiện tại. Checklist có thể chạy nằm trong [`TASKS.md`](TASKS.md); lịch sử
đã hoàn thành nằm trong [`CHANGELOG.md`](../CHANGELOG.md).

## Thứ tự roadmap

| Ưu tiên | Milestone | Trạng thái |
|---:|---|---|
| 1 | Production handoff cho ordered schema v6.0/v6.2 + deploy + smoke | User-run; local đã xác minh |
| 2 | Finance hardening: RPC/RLS/rollback → liên kết → responsive/accessibility QA | Chưa hoàn tất |
| 3 | Correctness còn lại: local-date trong Focus/Inbox/Finance + smoke upload/stream | Chưa làm |
| 4 | Vault vận hành: export/restore → đổi passphrase/version → rotate DEK | Follow-up |
| 5 | Vault UX security: inactivity auto-lock, clipboard clear, TOTP | Follow-up |
| 6 | Task model và refactor UI lớn | Icebox; cần quyết định riêng |

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

- Thống nhất mọi logic “hôm nay” còn sót sang `toDateStr()` để không lệch UTC ở GMT+7.
- Smoke upload ảnh, audio, Range/206 và unauthorized/401 trên môi trường có Drive env.
- Chỉ đơn giản hóa multipart/stream implementation nếu smoke chứng minh native API thay thế an toàn.

## Milestone 4–5 — Vault follow-up

Thứ tự an toàn:

1. Export/restore có version check và hướng phục hồi thử được.
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
